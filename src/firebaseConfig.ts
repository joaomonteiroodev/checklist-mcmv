import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDZmdl7xKIIO3_oB3_9AkSyqmQ2cdRqkno",
  authDomain: "checklist-mcmv-prod.firebaseapp.com",
  projectId: "checklist-mcmv-prod",
  storageBucket: "checklist-mcmv-prod.firebasestorage.app",
  messagingSenderId: "350574290293",
  appId: "1:350574290293:web:1e8c84c08c4684adbb9f3c"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);