// src/firebase.js
// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: 'AIzaSyBqbeFX6n48YRz-bbQkUfYBHGh2wtEBbmI',
  authDomain: 'sagecoach-cae7a.firebaseapp.com',
  projectId: 'sagecoach-cae7a',
  storageBucket: 'sagecoach-cae7a.appspot.com',
  messagingSenderId: '1051492988888',
  appId: '1:1051492988888:web:1234567890abcdef'
};

// prevent duplicate initialization
const app = !getApps().length
  ? initializeApp(firebaseConfig)
  : getApp();

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export default app
