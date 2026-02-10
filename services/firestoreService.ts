
import { db } from '../firebaseConfig';
import { doc, setDoc, getDoc, collection, getDocs, addDoc, deleteDoc } from 'firebase/firestore';
import { HotelNode, HotelSummary, HotelTemplate } from '../types';

const HOTELS_COLLECTION = 'hotels';
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

// --- SERVICE FUNCTIONS ---

/**
 * Fetches a list of all hotels (ID and Name only).
 * Falls back to LocalStorage if Firestore is unreachable.
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

/**
 * Creates a new hotel with initial data.
 * Falls back to LocalStorage if Firestore is unreachable.
 */
export const createNewHotel = async (initialData: HotelNode): Promise<string> => {
  try {
    const docRef = await addDoc(collection(db, HOTELS_COLLECTION), initialData);
    return docRef.id;
  } catch (error) {
    console.warn("Firestore unavailable (Offline Mode). Creating in LocalStorage.", error);
    
    // Generate a local ID
    const newId = 'local_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    const newHotelData = { ...initialData, id: newId }; // Ensure root ID matches doc ID if needed, or just keep data as is.
    
    // 1. Save Data
    saveLocalHotelData(newId, newHotelData);
    
    // 2. Update Index
    const list = getLocalHotelsList();
    list.push({ id: newId, name: initialData.name || "Untitled Hotel" });
    saveLocalHotelsList(list);
    
    return newId;
  }
};

/**
 * Saves/Updates a specific hotel data tree.
 * Falls back to LocalStorage if Firestore is unreachable.
 */
export const updateHotelData = async (hotelId: string, data: HotelNode): Promise<void> => {
  try {
    if (!hotelId) throw new Error("No hotel ID provided");
    const docRef = doc(db, HOTELS_COLLECTION, hotelId);
    
    if (!data) throw new Error("No data provided to save");
    
    await setDoc(docRef, data);
    console.log("Document successfully written to Cloud!");
  } catch (error) {
    console.warn("Firestore unavailable (Offline Mode). Saving to LocalStorage.", error);
    
    if (!hotelId) throw new Error("No hotel ID provided");
    
    // 1. Save Data locally
    saveLocalHotelData(hotelId, data);
    
    // 2. Update name in index if it changed
    const list = getLocalHotelsList();
    const index = list.findIndex(h => h.id === hotelId);
    if (index !== -1) {
        if (list[index].name !== data.name) {
            list[index].name = data.name || "Untitled Hotel";
            saveLocalHotelsList(list);
        }
    } else {
        // Edge case: It's being saved but wasn't in list (maybe created offline differently)
        list.push({ id: hotelId, name: data.name || "Untitled Hotel" });
        saveLocalHotelsList(list);
    }
  }
};

/**
 * Retrieves a specific hotel data tree.
 * Falls back to LocalStorage if Firestore is unreachable.
 */
export const fetchHotelById = async (hotelId: string): Promise<HotelNode | null> => {
  try {
    if (!hotelId) return null;
    const docRef = doc(db, HOTELS_COLLECTION, hotelId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return docSnap.data() as HotelNode;
    } else {
      // If not in cloud, check local (maybe created locally)
      const local = getLocalHotelData(hotelId);
      if (local) return local;
      
      console.log("No such document in Cloud or Local!");
      return null;
    }
  } catch (error) {
    console.warn("Firestore unavailable (Offline Mode). Fetching from LocalStorage.", error);
    return getLocalHotelData(hotelId);
  }
};

// --- TEMPLATE SERVICES ---

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
