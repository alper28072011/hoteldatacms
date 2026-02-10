
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
import { HotelNode, HotelSummary, HotelTemplate } from '../types';

const HOTELS_COLLECTION = 'hotels';
const CATEGORIES_SUBCOLLECTION = 'categories';
const TEMPLATES_COLLECTION = 'templates';

// --- LOCAL STORAGE HELPERS (OFFLINE FALLBACK) ---
const LS_KEYS = {
  HOTELS_LIST: 'cms_hotels_list',
  TEMPLATES_LIST: 'cms_templates_list',
  HOTEL_PREFIX: 'cms_hotel_data_',
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

// --- SCALABLE FIRESTORE ARCHITECTURE ---

/**
 * Creates a new hotel using the Sharding Strategy.
 * 1. Creates the Root Metadata Document.
 * 2. Uses updateHotelData logic to shard the children into sub-collections.
 */
export const createNewHotel = async (initialData: HotelNode): Promise<string> => {
  try {
    // 1. Create a reference to generate an ID automatically
    const newHotelRef = doc(collection(db, HOTELS_COLLECTION));
    const newId = newHotelRef.id;

    // 2. Assign this ID to the root node
    const dataWithId = { ...initialData, id: newId };

    // 3. Use the sharded update logic to save everything
    await updateHotelData(newId, dataWithId);

    return newId;
  } catch (error) {
    console.warn("Firestore unavailable (Offline Mode). Creating in LocalStorage.", error);
    
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
 * SHARDING SAVE STRATEGY:
 * Instead of saving one huge JSON, we split the root node and its children.
 * - Root Doc: Contains metadata (id, name, type='root').
 * - Sub-Collection 'categories': Each direct child of root is saved as a separate document.
 */
export const updateHotelData = async (hotelId: string, data: HotelNode): Promise<void> => {
  try {
    if (!hotelId) throw new Error("No hotel ID provided");
    if (!data) throw new Error("No data provided to save");

    const hotelRef = doc(db, HOTELS_COLLECTION, hotelId);

    // 1. Prepare Root Data (Strip children to keep it light)
    // We clone the object to avoid mutating the state in the UI
    const { children, ...rootData } = data;
    
    // 2. Prepare Children (Categories) for Sub-Collection
    const categories = children || [];

    // 3. START BATCH OPERATION
    // Firestore Batch ensures all writes happen together or fail together.
    const batch = writeBatch(db);

    // Step A: Update the Root Document
    batch.set(hotelRef, rootData);

    // Step B: Manage Sub-Collection (Add/Update)
    const categoriesRef = collection(hotelRef, CATEGORIES_SUBCOLLECTION);
    
    // Track IDs we are saving to handle deletions later
    const currentCategoryIds = new Set<string>();

    categories.forEach((category) => {
        // Ensure category has an ID (it should from the UI, but safety first)
        const catId = category.id || `cat_${Date.now()}_${Math.random()}`;
        const catRef = doc(categoriesRef, catId);
        
        currentCategoryIds.add(catId);
        batch.set(catRef, category);
    });

    // Step C: Handle Deletions (Clean up orphaned categories in DB)
    // We need to fetch existing docs to know what to delete. 
    // Optimization: We only fetch IDs, not full data.
    const existingDocsSnapshot = await getDocs(categoriesRef);
    
    existingDocsSnapshot.forEach((doc) => {
        if (!currentCategoryIds.has(doc.id)) {
            // This document exists in DB but is not in our new data -> DELETE IT
            batch.delete(doc.ref);
        }
    });

    // 4. Commit the Batch
    await batch.commit();
    console.log("Hotel data successfully sharded and saved to Cloud!");

  } catch (error) {
    console.warn("Firestore unavailable (Offline Mode). Saving to LocalStorage.", error);
    if (!hotelId) throw new Error("No hotel ID provided");
    
    // Fallback: Save monolithic JSON to LocalStorage
    saveLocalHotelData(hotelId, data);
    
    // Update Index
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
 * 1. Fetch Root Document.
 * 2. Fetch all documents from 'categories' sub-collection.
 * 3. Stitch them back together into a single HotelNode tree.
 */
export const fetchHotelById = async (hotelId: string): Promise<HotelNode | null> => {
  try {
    if (!hotelId) return null;
    const hotelRef = doc(db, HOTELS_COLLECTION, hotelId);
    
    // 1. Fetch Root
    const rootSnap = await getDoc(hotelRef);

    if (!rootSnap.exists()) {
      // Fallback check for LocalStorage
      const local = getLocalHotelData(hotelId);
      if (local) return local;
      return null;
    }

    const rootData = rootSnap.data() as HotelNode;

    // 2. Fetch Children (Shards)
    const categoriesRef = collection(hotelRef, CATEGORIES_SUBCOLLECTION);
    const categoriesSnap = await getDocs(categoriesRef);

    const assembledChildren: HotelNode[] = [];
    categoriesSnap.forEach((doc) => {
        assembledChildren.push(doc.data() as HotelNode);
    });

    // 3. Reassemble Tree
    // Note: We might want to sort them if order is maintained via an index property, 
    // but for now, Firestore order is sufficient or UI handles sorting.
    const fullTree: HotelNode = {
        ...rootData,
        children: assembledChildren
    };

    return fullTree;

  } catch (error) {
    console.warn("Firestore unavailable (Offline Mode). Fetching from LocalStorage.", error);
    return getLocalHotelData(hotelId);
  }
};

/**
 * Fetches list of hotels.
 * Since Root doc is now small, this is very fast.
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
    console.warn("Firestore unavailable (Offline Mode). Using LocalStorage.", error);
    return getLocalHotelsList();
  }
};

// --- TEMPLATE SERVICES (Templates are usually smaller, kept monolithic for simplicity) ---

export const saveTemplate = async (template: Omit<HotelTemplate, 'id'>): Promise<string> => {
  try {
    const docRef = await addDoc(collection(db, TEMPLATES_COLLECTION), template);
    return docRef.id;
  } catch (error) {
    console.warn("Firestore unavailable (Offline Mode). Saving Template locally.", error);
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
    console.warn("Firestore unavailable (Offline Mode). Fetching local templates.", error);
    return getLocalTemplates();
  }
};

export const deleteTemplate = async (templateId: string): Promise<void> => {
  try {
    await deleteDoc(doc(db, TEMPLATES_COLLECTION, templateId));
  } catch (error) {
    console.warn("Firestore unavailable (Offline Mode). Deleting local template.", error);
    const list = getLocalTemplates();
    const filtered = list.filter(t => t.id !== templateId);
    saveLocalTemplates(filtered);
  }
};
