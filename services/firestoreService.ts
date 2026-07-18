
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
  increment
} from 'firebase/firestore';
import { HotelNode, HotelSummary, HotelTemplate, AIPersona, NodeTemplate, GeminiConfig } from '../types';
import { getLocalizedValue } from '../utils/treeUtils';

const HOTELS_COLLECTION = 'hotels';
const STRUCTURE_SUBCOLLECTION = 'structure'; // The sub-collection for sharded data
const PERSONAS_SUBCOLLECTION = 'personas'; // Sub-collection for personas
const NODE_TEMPLATES_SUBCOLLECTION = 'node_templates'; // DEPRECATED: Old sub-collection
const GLOBAL_NODE_TEMPLATES_COLLECTION = 'global_node_templates'; // NEW: Global collection for node templates
const TEMPLATES_COLLECTION = 'templates'; // Global templates for cloning hotels

// --- LOCAL STORAGE HELPERS (OFFLINE FALLBACK & HYBRID SYNC) ---
const LS_KEYS = {
  HOTELS_LIST: 'cms_hotels_list',
  TEMPLATES_LIST: 'cms_templates_list',
  HOTEL_PREFIX: 'cms_hotel_data_',
  PERSONAS_PREFIX: 'cms_personas_',
  GLOBAL_NODE_TEMPLATES: 'cms_global_node_templates', // Updated key
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
  try {
    localStorage.setItem(LS_KEYS.HOTEL_PREFIX + id, JSON.stringify(data));
  } catch (e) {
    console.error("Failed to save local backup", e);
  }
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

// Node Template Local Storage Helpers (GLOBAL)
const getLocalNodeTemplates = (): NodeTemplate[] => {
  try {
    const data = localStorage.getItem(LS_KEYS.GLOBAL_NODE_TEMPLATES);
    return data ? JSON.parse(data) : [];
  } catch (e) { return []; }
};

const saveLocalNodeTemplates = (templates: NodeTemplate[]) => {
  localStorage.setItem(LS_KEYS.GLOBAL_NODE_TEMPLATES, JSON.stringify(templates));
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

// Helper: Sanitize data coming FROM Firestore (convert Timestamps, remove Refs)
const sanitizeFromFirestore = (data: any): any => {
  if (data === null || data === undefined) return data;
  if (typeof data !== 'object') return data;
  
  // Handle Arrays
  if (Array.isArray(data)) {
      return data.map(sanitizeFromFirestore);
  }

  // Handle Timestamp (duck typing)
  if (typeof data.toMillis === 'function') {
      return data.toMillis();
  }

  // Handle DocumentReference or other internal circular types
  // If it has 'firestore' property (DocumentReference), we strip it to avoid circular refs
  if (data.firestore && data.path) {
      // Just return the path string as a safe fallback
      return data.path; 
  }

  // Handle plain objects
  const clean: any = {};
  Object.keys(data).forEach(key => {
      clean[key] = sanitizeFromFirestore(data[key]);
  });
  return clean;
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
    const nameStr = getLocalizedValue(initialData.name, 'en') || "Untitled Hotel";
    list.push({ id: newId, name: nameStr });
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

    // Fetch all other hotels in the system to support global shared node updates
    let otherHotels: { id: string; categoryOrder: string[] }[] = [];
    try {
      const hotelsSnapshot = await getDocs(collection(db, HOTELS_COLLECTION));
      hotelsSnapshot.forEach((doc) => {
        if (doc.id !== hotelId) {
          otherHotels.push({
            id: doc.id,
            categoryOrder: doc.data().categoryOrder || []
          });
        }
      });
    } catch (e) {
      console.warn("Failed to fetch other hotels for shared propagation", e);
    }

    // 3. BATCH INIT & PROPAGATION PREPARATION
    const batch = writeBatch(db);
    const otherHotelOrders = new Map<string, string[]>();
    const otherHotelUpdated = new Map<string, boolean>();

    otherHotels.forEach(oh => {
      otherHotelOrders.set(oh.id, [...oh.categoryOrder]);
      otherHotelUpdated.set(oh.id, false);
    });

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

        // PROPAGATION: If child is shared, write it to all other hotels as well
        if (child.isShared === true) {
          otherHotels.forEach(oh => {
            const otherChildRef = doc(db, HOTELS_COLLECTION, oh.id, STRUCTURE_SUBCOLLECTION, childId);
            batch.set(otherChildRef, sanitizeForFirestore(child));
            
            // Ensure this child ID is in the other hotel's category order
            const order = otherHotelOrders.get(oh.id) || [];
            if (!order.includes(childId)) {
              order.push(childId);
              otherHotelOrders.set(oh.id, order);
              otherHotelUpdated.set(oh.id, true);
            }
          });
        }
    });

    // 6. CLEANUP ORPHANS & DELETION PROPAGATION
    // Fetch existing docs to identify what to delete.
    const existingDocsSnapshot = await getDocs(structureRef);
    
    existingDocsSnapshot.forEach((existingDoc) => {
        if (!currentChildIds.has(existingDoc.id)) {
            // This doc exists in DB but not in our new data -> Delete it
            batch.delete(existingDoc.ref);

            // PROPAGATION: If the deleted node was shared, delete it from other hotels too!
            const wasShared = existingDoc.data()?.isShared === true;
            if (wasShared) {
              otherHotels.forEach(oh => {
                const otherChildRef = doc(db, HOTELS_COLLECTION, oh.id, STRUCTURE_SUBCOLLECTION, existingDoc.id);
                batch.delete(otherChildRef);

                // Remove from the other hotel's category order
                const order = otherHotelOrders.get(oh.id) || [];
                const idx = order.indexOf(existingDoc.id);
                if (idx !== -1) {
                  order.splice(idx, 1);
                  otherHotelOrders.set(oh.id, order);
                  otherHotelUpdated.set(oh.id, true);
                }
              });
            }
        }
    });

    // 7. WRITE THE UPDATED CATEGORY ORDERS FOR OTHER HOTELS
    otherHotels.forEach(oh => {
      if (otherHotelUpdated.get(oh.id)) {
        const otherRootRef = doc(db, HOTELS_COLLECTION, oh.id);
        batch.set(otherRootRef, { categoryOrder: otherHotelOrders.get(oh.id) }, { merge: true });
      }
    });

    // 8. COMMIT
    await batch.commit();
    console.log("Hotel data and shared nodes successfully sharded and saved via Batch Write!");

  } catch (error) {
    console.warn("Firestore save failed. Falling back to LocalStorage.", error);
    if (!hotelId) throw new Error("No hotel ID provided");
    
    // Fallback: Save the entire Monolithic JSON to LocalStorage
    saveLocalHotelData(hotelId, data);

    // PROPAGATION FOR OFFLINE LOCALSTORAGE: Sync shared nodes to other local hotels too
    try {
      const otherHotelsList = getLocalHotelsList();
      otherHotelsList.forEach(oh => {
        if (oh.id === hotelId) return;
        const otherData = getLocalHotelData(oh.id);
        if (otherData) {
          let updated = false;
          const otherChildren = otherData.children || [];
          const otherChildrenMap = new Map<string, HotelNode>();
          otherChildren.forEach(c => otherChildrenMap.set(c.id, c));

          // Sync shared nodes (add/update)
          const childrenList = data.children || [];
          childrenList.forEach(child => {
            if (child.isShared === true) {
              otherChildrenMap.set(child.id, child);
              updated = true;
            }
          });

          // Sync deleted shared nodes
          if (data && data.children) {
            const currentChildIdsLocal = new Set(data.children.map(c => c.id));
            // Check if any shared node in otherData is missing in data.children (meaning it was deleted)
            otherChildren.forEach(child => {
              if (child.isShared === true && !currentChildIdsLocal.has(child.id)) {
                otherChildrenMap.delete(child.id);
                updated = true;
              }
            });
          }

          if (updated) {
            const reassembledChildren: HotelNode[] = [];
            // Keep original order, but filter out deleted, and add new ones at the end
            const originalOrder = otherData.categoryOrder || otherChildren.map(c => c.id);
            const newOrder: string[] = [];

            originalOrder.forEach(id => {
              if (otherChildrenMap.has(id)) {
                reassembledChildren.push(otherChildrenMap.get(id)!);
                newOrder.push(id);
                otherChildrenMap.delete(id);
              }
            });

            otherChildrenMap.forEach(child => {
              reassembledChildren.push(child);
              newOrder.push(child.id);
            });

            otherData.children = reassembledChildren;
            otherData.categoryOrder = newOrder;
            saveLocalHotelData(oh.id, otherData);
          }
        }
      });
    } catch (e) {
      console.warn("Offline shared node propagation failed", e);
    }
    
    // Update Local Index if name changed
    const list = getLocalHotelsList();
    const index = list.findIndex(h => h.id === hotelId);
    const newName = getLocalizedValue(data.name, 'en') || "Untitled Hotel";
    if (index !== -1) {
        if (list[index].name !== newName) {
            list[index].name = newName;
            saveLocalHotelsList(list);
        }
    } else {
        list.push({ id: hotelId, name: newName });
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

    // SANITIZE ROOT DATA
    const rawRootData = rootSnap.data();
    const rootData = sanitizeFromFirestore(rawRootData) as HotelNode & { categoryOrder?: string[] };

    // 2. Fetch Sharded Children
    const structureRef = collection(hotelRef, STRUCTURE_SUBCOLLECTION);
    const structureSnap = await getDocs(structureRef);

    const assembledChildren: HotelNode[] = [];
    structureSnap.forEach((doc) => {
        // SANITIZE CHILD DATA
        const cleanChild = sanitizeFromFirestore(doc.data());
        assembledChildren.push(cleanChild as HotelNode);
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
      const name = getLocalizedValue(data.name, 'en') || "Untitled Hotel";
      hotels.push({
        id: doc.id,
        name: name
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
        snapshot.forEach(doc => personas.push(sanitizeFromFirestore(doc.data()) as AIPersona));
        return personas;
    } catch (e) {
        console.warn("Fetching local personas.", e);
        return getLocalPersonas(hotelId);
    }
};

export const savePersona = async (hotelId: string, persona: AIPersona): Promise<void> => {
    try {
        const docRef = doc(db, HOTELS_COLLECTION, hotelId, PERSONAS_SUBCOLLECTION, persona.id);
        await setDoc(docRef, sanitizeForFirestore(persona));
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

// --- NODE TEMPLATE SERVICES (GLOBAL) ---

export const getNodeTemplates = async (): Promise<NodeTemplate[]> => {
    try {
        const templatesRef = collection(db, GLOBAL_NODE_TEMPLATES_COLLECTION);
        const snapshot = await getDocs(templatesRef);
        const templates: NodeTemplate[] = [];
        snapshot.forEach(doc => templates.push(sanitizeFromFirestore(doc.data()) as NodeTemplate));
        return templates;
    } catch (e) {
        console.warn("Fetching local node templates.", e);
        return getLocalNodeTemplates();
    }
};

export const saveNodeTemplate = async (template: NodeTemplate): Promise<void> => {
    try {
        const docRef = doc(db, GLOBAL_NODE_TEMPLATES_COLLECTION, template.id);
        await setDoc(docRef, sanitizeForFirestore(template));
    } catch (e) {
        console.warn("Saving node template locally.", e);
        const current = getLocalNodeTemplates();
        const index = current.findIndex(t => t.id === template.id);
        if (index >= 0) current[index] = template;
        else current.push(template);
        saveLocalNodeTemplates(current);
    }
};

export const deleteNodeTemplate = async (templateId: string): Promise<void> => {
    try {
        await deleteDoc(doc(db, GLOBAL_NODE_TEMPLATES_COLLECTION, templateId));
    } catch (e) {
        console.warn("Deleting node template locally.", e);
        const current = getLocalNodeTemplates();
        saveLocalNodeTemplates(current.filter(t => t.id !== templateId));
    }
};

export const migrateLegacyTemplates = async (hotelId: string): Promise<void> => {
    try {
        const oldRef = collection(db, HOTELS_COLLECTION, hotelId, NODE_TEMPLATES_SUBCOLLECTION);
        const snapshot = await getDocs(oldRef);
        
        if (snapshot.empty) return;

        const batch = writeBatch(db);
        
        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            const newDocRef = doc(db, GLOBAL_NODE_TEMPLATES_COLLECTION, docSnap.id);
            batch.set(newDocRef, data);
            batch.delete(docSnap.ref);
        });

        await batch.commit();
        console.log(`Migrated ${snapshot.size} templates to global.`);
    } catch (e) {
        console.error("Migration failed", e);
    }
};

// --- TEMPLATE SERVICES (GLOBAL) ---

export const saveTemplate = async (template: Omit<HotelTemplate, 'id'>): Promise<string> => {
  try {
    const docRef = await addDoc(collection(db, TEMPLATES_COLLECTION), sanitizeForFirestore(template));
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
      const data = sanitizeFromFirestore(doc.data()) as Omit<HotelTemplate, 'id'>;
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

// --- TOKEN TRACKING ---
export const logTokenUsage = async (model: string, tokens: number) => {
  try {
     const dateStr = new Date().toISOString().split('T')[0];
     const docId = `${dateStr}_${model}`;
     const docRef = doc(db, 'token_usage', docId);
     
     await setDoc(docRef, {
        date: dateStr,
        model: model,
        tokens: increment(tokens),
        updatedAt: new Date()
     }, { merge: true });
  } catch (e) {
     console.error("Token log failed", e);
  }
};

export const getTokenUsageLogs = async () => {
  try {
      const q = query(collection(db, 'token_usage'));
      const snapshot = await getDocs(q);
      const logs = snapshot.docs.map(doc => doc.data() as { date: string, model: string, tokens: number });
      return logs.sort((a, b) => b.date.localeCompare(a.date));
  } catch(e) {
      return [];
  }
};

// --- USER & ROLE MANAGEMENT (RBAC) ---
export const getUserRole = async (email: string): Promise<{ role: 'superadmin' | 'editor'; allowedHotels: string[] }> => {
  if (!email) return { role: 'editor', allowedHotels: [] };
  if (email.toLowerCase() === 'alper28072011@gmail.com') {
    return { role: 'superadmin', allowedHotels: [] };
  }
  try {
    const docRef = doc(db, 'user_roles', email.toLowerCase().trim());
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        role: data.role || 'editor',
        allowedHotels: data.allowedHotels || []
      };
    }
  } catch (error) {
    console.error("getUserRole error", error);
  }
  return { role: 'editor', allowedHotels: [] };
};

export const getAllUserRoles = async (): Promise<{ email: string; role: 'superadmin' | 'editor'; allowedHotels: string[] }[]> => {
  try {
    const snapshot = await getDocs(collection(db, 'user_roles'));
    return snapshot.docs.map(doc => ({
      email: doc.id,
      role: doc.data().role || 'editor',
      allowedHotels: doc.data().allowedHotels || []
    }));
  } catch (error) {
    console.error("getAllUserRoles error", error);
    return [];
  }
};

export const saveUserRole = async (email: string, role: 'superadmin' | 'editor', allowedHotels: string[]) => {
  try {
    const docRef = doc(db, 'user_roles', email.toLowerCase().trim());
    await setDoc(docRef, {
      role,
      allowedHotels,
      updatedAt: new Date()
    }, { merge: true });
  } catch (error) {
    console.error("saveUserRole error", error);
    throw error;
  }
};

// --- SYSTEM SETTINGS (GEMINI API KEY & MODEL SHARDING) ---
export const getGeminiConfig = async (): Promise<GeminiConfig | null> => {
  try {
    const docRef = doc(db, 'system_settings', 'gemini');
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data() as GeminiConfig;
    }
  } catch (error) {
    console.error("getGeminiConfig error", error);
  }
  return null;
};

export const saveGeminiConfig = async (config: GeminiConfig) => {
  try {
    const docRef = doc(db, 'system_settings', 'gemini');
    await setDoc(docRef, sanitizeForFirestore(config), { merge: true });
  } catch (error) {
    console.error("saveGeminiConfig error", error);
    throw error;
  }
};

