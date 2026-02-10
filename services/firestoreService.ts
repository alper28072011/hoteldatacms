import { db } from '../firebaseConfig';
import { doc, setDoc, getDoc, collection, getDocs, addDoc, deleteDoc } from 'firebase/firestore';
import { HotelNode, HotelSummary, HotelTemplate } from '../types';

const HOTELS_COLLECTION = 'hotels';
const TEMPLATES_COLLECTION = 'templates';

/**
 * Fetches a list of all hotels (ID and Name only) for the selector.
 */
export const getHotelsList = async (): Promise<HotelSummary[]> => {
  try {
    const querySnapshot = await getDocs(collection(db, HOTELS_COLLECTION));
    const hotels: HotelSummary[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      // Assume root node name is the hotel name
      hotels.push({
        id: doc.id,
        name: data.name || "Untitled Hotel"
      });
    });
    return hotels;
  } catch (error) {
    console.error("Error fetching hotel list:", error);
    throw error;
  }
};

/**
 * Creates a new hotel with initial data and returns its ID.
 */
export const createNewHotel = async (initialData: HotelNode): Promise<string> => {
  try {
    // We add a new document to the collection
    const docRef = await addDoc(collection(db, HOTELS_COLLECTION), initialData);
    return docRef.id;
  } catch (error) {
    console.error("Error creating new hotel:", error);
    throw error;
  }
};

/**
 * Saves/Updates a specific hotel data tree to Firestore.
 */
export const updateHotelData = async (hotelId: string, data: HotelNode): Promise<void> => {
  try {
    if (!hotelId) throw new Error("No hotel ID provided");
    const docRef = doc(db, HOTELS_COLLECTION, hotelId);
    
    if (!data) throw new Error("No data provided to save");
    
    await setDoc(docRef, data);
    console.log("Document successfully written!");
  } catch (error) {
    console.error("Error writing document: ", error);
    throw error;
  }
};

/**
 * Retrieves a specific hotel data tree from Firestore.
 */
export const fetchHotelById = async (hotelId: string): Promise<HotelNode | null> => {
  try {
    if (!hotelId) return null;
    const docRef = doc(db, HOTELS_COLLECTION, hotelId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return docSnap.data() as HotelNode;
    } else {
      console.log("No such document!");
      return null;
    }
  } catch (error) {
    console.error("Error getting document:", error);
    throw error;
  }
};

// --- TEMPLATE SERVICES ---

export const saveTemplate = async (template: Omit<HotelTemplate, 'id'>): Promise<string> => {
  try {
    const docRef = await addDoc(collection(db, TEMPLATES_COLLECTION), template);
    return docRef.id;
  } catch (error) {
    console.error("Error saving template:", error);
    throw error;
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
    console.error("Error fetching templates:", error);
    throw error;
  }
};

export const deleteTemplate = async (templateId: string): Promise<void> => {
  try {
    await deleteDoc(doc(db, TEMPLATES_COLLECTION, templateId));
  } catch (error) {
    console.error("Error deleting template:", error);
    throw error;
  }
};