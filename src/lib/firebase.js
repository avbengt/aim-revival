import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getDatabase } from "firebase/database";

// Read from env (Next.js: define these in .env.local with NEXT_PUBLIC_*)
const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

console.log('Firebase config:', {
    apiKey: firebaseConfig.apiKey ? 'SET' : 'NOT SET',
    authDomain: firebaseConfig.authDomain ? 'SET' : 'NOT SET',
    projectId: firebaseConfig.projectId ? 'SET' : 'NOT SET',
    storageBucket: firebaseConfig.storageBucket ? 'SET' : 'NOT SET',
    messagingSenderId: firebaseConfig.messagingSenderId ? 'SET' : 'NOT SET',
    appId: firebaseConfig.appId ? 'SET' : 'NOT SET',
});

// Avoid re-initializing during HMR
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// Services
const auth = getAuth(app);
const db = getFirestore(app);
const database = getDatabase(app);

console.log('Firebase services initialized:', { auth: !!auth, db: !!db, database: !!database });

export { auth, db, database };