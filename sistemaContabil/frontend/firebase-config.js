// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCRoev29QkVCQlys0LRnixsL9mhas3fjJ8",
  authDomain: "sistema-de-contabilidade-4096a.firebaseapp.com",
  projectId: "sistema-de-contabilidade-4096a",
  storageBucket: "sistema-de-contabilidade-4096a.firebasestorage.app",
  messagingSenderId: "681154547167",
  appId: "1:681154547167:web:65f125fca40ec91825c86a",
  measurementId: "G-1KBLFQ6YQC"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

export { app, analytics };
