import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// LÜTFEN BU ALANI KENDİ FIREBASE PROJE BİLGİLERİNİZLE GÜNCELLEYİN
// PLEASE UPDATE THIS AREA WITH YOUR FIREBASE PROJECT CONFIGURATION
const firebaseConfig = {
  apiKey: "AIzaSyAD8CTZcRBu9EhD5FhPbGyqv9zYKL8Y0Xc",
  authDomain: "hotel-data-cms.firebaseapp.com",
  projectId: "hotel-data-cms",
  storageBucket: "hotel-data-cms.firebasestorage.app",
  messagingSenderId: "517254695342",
  appId: "1:517254695342:web:c156d1bd908a3e0cdba03f"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore
export const db = getFirestore(app);