
import { db } from '../firebaseConfig';
import { 
  doc, 
  setDoc, 
  getDoc, 
  collection, 
  getDocs, 
  addDoc, 
  deleteDoc, 
  writeBatch,
  query,
  select
} from 'firebase/firestore';
import { HotelNode, HotelSummary, HotelTemplate, AIPersona } from '../types';

const HOTELS_COLLECTION = 'hotels';
const STRUCTURE_SUBCOLLECTION = 'structure'; // The sub-collection for sharded data
const PERSONAS_SUBCOLLECTION = 'personas'; // New sub-collection for personas
const TEMPLATES_COLLECTION = 'templates';

// --- LOCAL STORAGE HELPERS (OFFLINE FALLBACK & HYBRID SYNC) ---
const LS_KEYS = {
  HOTELS_LIST: 'cms_hotels_list',
  TEMPLATES_LIST: 'cms_templates_list',
  HOTEL_PREFIX: 'cms_hotel_data_',
  PERSONAS_PREFIX: 'cms_personas_',
};

const getLocalHotelsList = (): HotelSummary[] => {
  try {
    const data = localStorage.getItem(LS_KEYS.HOTELS_LIST);
    return data ? JSON.parse(data) : [];
  } catch (e) { return []; }
};

const saveLocalHotelsList = (list: HotelSummary[]) => {
  localStorage.setItem(LS_KEYS.HOTELS_LIST, JSON.stringify(list));
};

const getLocalHotelData = (id: string): HotelNode | null => {
  try {
    const data = localStorage.getItem(LS_KEYS.HOTEL_PREFIX + id);
    return data ? JSON.parse(data) : null;
  } catch (e) { return null; }
};

// LocalStorage saves the MONOLITHIC tree as a backup
const saveLocalHotelData = (id: string, data: HotelNode) => {
  localStorage.setItem(LS_KEYS.HOTEL_PREFIX + id, JSON.stringify(data));
};

const getLocalTemplates = (): HotelTemplate[] => {
  try {
    const data = localStorage.getItem(LS_KEYS.TEMPLATES_LIST);
    return data ? JSON.parse(data) : [];
  } catch (e) { return []; }
};

const saveLocalTemplates = (list: HotelTemplate[]) => {
  localStorage.setItem(LS_KEYS.TEMPLATES_LIST, JSON.stringify(list));
};

// Persona Local Storage Helpers
const getLocalPersonas = (hotelId: string): AIPersona[] => {
  try {
    const data = localStorage.getItem(LS_KEYS.PERSONAS_PREFIX + hotelId);
    return data ? JSON.parse(data) : [];
  } catch (e) { return []; }
};

const saveLocalPersonas = (hotelId: string, personas: AIPersona[]) => {
  localStorage.setItem(LS_KEYS.PERSONAS_PREFIX + hotelId, JSON.stringify(personas));
};


// Helper: Recursively remove undefined values for Firestore
const sanitizeForFirestore = (obj: any): any => {
  if (Array.isArray(obj)) {
    return obj.map(sanitizeForFirestore);
  } else if (obj !== null && typeof obj === 'object') {
    const newObj: any = {};
    Object.keys(obj).forEach(key => {
      const val = obj[key];
      if (val !== undefined) {
        newObj[key] = sanitizeForFirestore(val);
      }
    });
    return newObj;
  }
  return obj;
};

// --- SCALABLE FIRESTORE ARCHITECTURE (SHARDING) ---

/**
 * Creates a new hotel using the Sharding Strategy.
 * Generates an ID and calls the sharded update logic.
 */
export const createNewHotel = async (initialData: HotelNode): Promise<string> => {
  try {
    // 1. Create a reference to generate an auto-ID
    const newHotelRef = doc(collection(db, HOTELS_COLLECTION));
    const newId = newHotelRef.id;

    // 2. Assign this ID to the root node
    const dataWithId = { ...initialData, id: newId };

    // 3. Use the sharded update logic to save everything
    await updateHotelData(newId, dataWithId);

    return newId;
  } catch (error) {
    console.warn("Firestore unavailable (Offline Mode). Creating in LocalStorage.", error);
    
    // Offline Fallback
    const newId = 'local_' + Date.now();
    const newHotelData = { ...initialData, id: newId };
    
    saveLocalHotelData(newId, newHotelData);
    
    const list = getLocalHotelsList();
    list.push({ id: newId, name: initialData.name || "Untitled Hotel" });
    saveLocalHotelsList(list);
    
    return newId;
  }
};

/**
 * SHARDING UPDATE STRATEGY:
 * - Root Document: Contains metadata (id, name, type='root') AND categoryOrder.
 * - Sub-Collection 'structure': Each direct child of root is a separate document.
 */
export const updateHotelData = async (hotelId: string, data: HotelNode): Promise<void> => {
  try {
    if (!hotelId) throw new Error("No hotel ID provided");
    if (!data) throw new Error("No data provided to save");

    const hotelRef = doc(db, HOTELS_COLLECTION, hotelId);
    const structureRef = collection(hotelRef, STRUCTURE_SUBCOLLECTION);

    // 1. SEPARATION: Split Root Data from Children
    const { children, ...rootMetadata } = data;
    
    const childrenToSave = children || [];

    // 2. ORDERING LOGIC
    // We save the IDs of the children in order, so we can reconstruct the sort later.
    const categoryOrder = childrenToSave.map(child => child.id);

    // 3. BATCH INIT
    const batch = writeBatch(db);

    // 4. ROOT UPDATE
    // Save metadata + order to the main document
    // Sanitize to remove undefined fields which Firestore hates
    batch.set(hotelRef, sanitizeForFirestore({ ...rootMetadata, categoryOrder }));

    // 5. CHILDREN UPDATE (Sub-Collection)
    const currentChildIds = new Set<string>();

    childrenToSave.forEach((child) => {
        // Ensure child has an ID. If not, generate one.
        const childId = child.id || `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        // Fix ID in object if it was missing
        if (!child.id) child.id = childId;

        const childRef = doc(structureRef, childId);
        
        // Add to batch with sanitation
        batch.set(childRef, sanitizeForFirestore(child));
        currentChildIds.add(childId);
    });

    // 6. CLEANUP ORPHANS
    // Fetch existing docs to identify what to delete.
    const existingDocsSnapshot = await getDocs(structureRef);
    
    existingDocsSnapshot.forEach((doc) => {
        if (!currentChildIds.has(doc.id)) {
            // This doc exists in DB but not in our new data -> Delete it
            batch.delete(doc.ref);
        }
    });

    // 7. COMMIT
    await batch.commit();
    console.log("Hotel data successfully sharded and saved via Batch Write!");

  } catch (error) {
    console.warn("Firestore save failed. Falling back to LocalStorage.", error);
    if (!hotelId) throw new Error("No hotel ID provided");
    
    // Fallback: Save the entire Monolithic JSON to LocalStorage
    saveLocalHotelData(hotelId, data);
    
    // Update Local Index if name changed
    const list = getLocalHotelsList();
    const index = list.findIndex(h => h.id === hotelId);
    if (index !== -1) {
        if (list[index].name !== data.name) {
            list[index].name = data.name || "Untitled Hotel";
            saveLocalHotelsList(list);
        }
    } else {
        list.push({ id: hotelId, name: data.name || "Untitled Hotel" });
        saveLocalHotelsList(list);
    }
  }
};

/**
 * REASSEMBLY FETCH STRATEGY:
 * 1. Fetch Root Document (Metadata & Order).
 * 2. Fetch all documents from 'structure' sub-collection.
 * 3. Sort children based on root's 'categoryOrder'.
 */
export const fetchHotelById = async (hotelId: string): Promise<HotelNode | null> => {
  try {
    if (!hotelId) return null;
    const hotelRef = doc(db, HOTELS_COLLECTION, hotelId);
    
    // 1. Fetch Root Metadata
    const rootSnap = await getDoc(hotelRef);

    if (!rootSnap.exists()) {
      // Check LocalStorage if Cloud fails/empty
      const local = getLocalHotelData(hotelId);
      if (local) return local;
      return null;
    }

    const rootData = rootSnap.data() as HotelNode & { categoryOrder?: string[] };

    // 2. Fetch Sharded Children
    const structureRef = collection(hotelRef, STRUCTURE_SUBCOLLECTION);
    const structureSnap = await getDocs(structureRef);

    const assembledChildren: HotelNode[] = [];
    structureSnap.forEach((doc) => {
        assembledChildren.push(doc.data() as HotelNode);
    });

    // 3. Reassemble & Sort Tree
    const categoryOrder = rootData.categoryOrder || [];
    
    // Create a map for O(1) lookup
    const childrenMap = new Map<string, HotelNode>();
    assembledChildren.forEach(child => childrenMap.set(child.id, child));

    const sortedChildren: HotelNode[] = [];

    // Add items in specific order
    categoryOrder.forEach(id => {
      if (childrenMap.has(id)) {
        sortedChildren.push(childrenMap.get(id)!);
        childrenMap.delete(id); // Remove so we know what's left
      }
    });

    // Add any remaining items (newly created or orphans not in order list)
    childrenMap.forEach(child => {
      sortedChildren.push(child);
    });
    
    const fullTree: HotelNode = {
        ...rootData,
        children: sortedChildren
    };

    return fullTree;

  } catch (error) {
    console.warn("Firestore fetch failed. Using LocalStorage.", error);
    return getLocalHotelData(hotelId);
  }
};

/**
 * Fetches list of hotels.
 */
export const getHotelsList = async (): Promise<HotelSummary[]> => {
  try {
    const querySnapshot = await getDocs(collection(db, HOTELS_COLLECTION));
    const hotels: HotelSummary[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      hotels.push({
        id: doc.id,
        name: data.name || "Untitled Hotel"
      });
    });
    return hotels;
  } catch (error) {
    console.warn("Firestore list failed. Using LocalStorage.", error);
    return getLocalHotelsList();
  }
};

// --- PERSONA SERVICES (SUB-COLLECTION) ---

export const getPersonas = async (hotelId: string): Promise<AIPersona[]> => {
    try {
        const personasRef = collection(db, HOTELS_COLLECTION, hotelId, PERSONAS_SUBCOLLECTION);
        const snapshot = await getDocs(personasRef);
        const personas: AIPersona[] = [];
        snapshot.forEach(doc => personas.push(doc.data() as AIPersona));
        return personas;
    } catch (e) {
        console.warn("Fetching local personas.", e);
        return getLocalPersonas(hotelId);
    }
};

export const savePersona = async (hotelId: string, persona: AIPersona): Promise<void> => {
    try {
        const docRef = doc(db, HOTELS_COLLECTION, hotelId, PERSONAS_SUBCOLLECTION, persona.id);
        await setDoc(docRef, persona);
    } catch (e) {
        console.warn("Saving persona locally.", e);
        const current = getLocalPersonas(hotelId);
        const index = current.findIndex(p => p.id === persona.id);
        if (index >= 0) current[index] = persona;
        else current.push(persona);
        saveLocalPersonas(hotelId, current);
    }
};

export const deletePersona = async (hotelId: string, personaId: string): Promise<void> => {
    try {
        await deleteDoc(doc(db, HOTELS_COLLECTION, hotelId, PERSONAS_SUBCOLLECTION, personaId));
    } catch (e) {
        console.warn("Deleting persona locally.", e);
        const current = getLocalPersonas(hotelId);
        saveLocalPersonas(hotelId, current.filter(p => p.id !== personaId));
    }
};

// --- TEMPLATE SERVICES ---

export const saveTemplate = async (template: Omit<HotelTemplate, 'id'>): Promise<string> => {
  try {
    const docRef = await addDoc(collection(db, TEMPLATES_COLLECTION), template);
    return docRef.id;
  } catch (error) {
    console.warn("Saving Template locally.", error);
    const newId = 'template_' + Date.now();
    const newTemplate = { ...template, id: newId };
    const list = getLocalTemplates();
    list.push(newTemplate);
    saveLocalTemplates(list);
    return newId;
  }
};

export const getTemplatesList = async (): Promise<HotelTemplate[]> => {
  try {
    const querySnapshot = await getDocs(collection(db, TEMPLATES_COLLECTION));
    const templates: HotelTemplate[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data() as Omit<HotelTemplate, 'id'>;
      templates.push({
        id: doc.id,
        ...data
      });
    });
    return templates;
  } catch (error) {
    console.warn("Fetching local templates.", error);
    return getLocalTemplates();
  }
};

export const deleteTemplate = async (templateId: string): Promise<void> => {
  try {
    await deleteDoc(doc(db, TEMPLATES_COLLECTION, templateId));
  } catch (error) {
    console.warn("Deleting local template.", error);
    const list = getLocalTemplates();
    const filtered = list.filter(t => t.id !== templateId);
    saveLocalTemplates(filtered);
  }
};
