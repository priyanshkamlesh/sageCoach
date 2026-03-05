// src/firebase.js
// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCV6bbQw49Np4s8xvXfWApjf6cbRGGtfHg",
  authDomain: "studio-a0e88.firebaseapp.com",
  projectId: "studio-a0e88",
  storageBucket: "studio-a0e88.firebasestorage.app",
  messagingSenderId: "224073093304",
  appId: "1:224073093304:web:d73710ad52d70e40b1244d",
  measurementId: "G-66SXKLWDCX"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export default app;
