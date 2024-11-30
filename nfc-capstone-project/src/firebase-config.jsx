// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from 'firebase/storage';
import { getDatabase, ref, set } from 'firebase/database'
import { getAuth, signInWithEmailAndPassword, signOut, GoogleAuthProvider, signInWithPopup,
  deleteUser } from "firebase/auth"

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyC8tDVbDIrKuylsyF3rbDSSPlzsEHXqZIs",
  authDomain: "online-attendance-21f95.firebaseapp.com",
  projectId: "online-attendance-21f95",
  storageBucket: "online-attendance-21f95.appspot.com",
  messagingSenderId: "756223518392",
  appId: "1:756223518392:web:5e8d28c78f7eefb8be764d"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const storage = getStorage();
const db = getFirestore(app);
const auth = getAuth();
const database = getDatabase(app);

export { db, storage, getAuth, signInWithEmailAndPassword, auth, signOut, GoogleAuthProvider, signInWithPopup,
  deleteUser, database, ref, set };