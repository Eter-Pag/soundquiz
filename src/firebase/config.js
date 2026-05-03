import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey:            'AIzaSyAjHs3DKYzWxV9IhkbAtSiqovrMGjnYOmE',
  authDomain:        'soundquiz-bbf7e.firebaseapp.com',
  projectId:         'soundquiz-bbf7e',
  storageBucket:     'soundquiz-bbf7e.firebasestorage.app',
  messagingSenderId: '1071686758943',
  appId:             '1:1071686758943:web:85ab34f9e4d2b4c4b4db2a',
  measurementId:     'G-D5D07NJ52H',
};

const app = initializeApp(firebaseConfig);
export const db      = getFirestore(app);
export const storage = getStorage(app);
