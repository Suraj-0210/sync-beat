// Import the functions you need from the SDKs you need
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { environment } from './environments/environment'; // use Angular environment system

// Your web app's Firebase configuration
export const firebaseConfig = {
  apiKey: environment.firebaseApiKey,
  authDomain: 'syncbeat-20fdb.firebaseapp.com',
  projectId: 'syncbeat-20fdb',
  storageBucket: 'syncbeat-20fdb.firebasestorage.app',
  messagingSenderId: '635662751094',
  appId: '1:635662751094:web:2b26d1d12e2e2cb882d657',
};

// Initialize Firebase
export const firebaseApp = initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
