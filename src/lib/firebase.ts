// Import the functions you need from the SDKs you need

import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import { getFirestore, Firestore } from "firebase/firestore";
import { getDatabase } from "firebase/database";

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyCie0kwF2oZDrvkdxTboQZeJ5WMywaExWw",
    authDomain: "aim-revival.firebaseapp.com",
    projectId: "aim-revival",
    storageBucket: "aim-revival.firebasestorage.app",
    messagingSenderId: "163074052702",
    appId: "1:163074052702:web:0fc2ceadcba87e839e1acf"
};

// Avoid re-initializing if app already exists
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Export initialized services
const auth: Auth = getAuth(app);
const db: Firestore = getFirestore(app);
const database = getDatabase(app);

export { auth, db, database };