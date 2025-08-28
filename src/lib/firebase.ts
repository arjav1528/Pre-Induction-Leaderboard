import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DB_URL,
};

const app = initializeApp(firebaseConfig);

export const database = getDatabase(app);

