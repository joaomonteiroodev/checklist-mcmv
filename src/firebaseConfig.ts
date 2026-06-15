import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDRX-PoPWj5nRLw9kOaKfIMhy5mtL9aDTg",
  authDomain: "checklist-mcmv.firebaseapp.com",
  projectId: "checklist-mcmv",
  storageBucket: "checklist-mcmv.firebasestorage.app",
  messagingSenderId: "452869588978",
  appId: "1:452869588978:web:d9f5609ef3faef98d38d6b",
  measurementId: "G-8BYS0R3JSG",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);