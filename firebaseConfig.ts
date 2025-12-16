
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { initializeFirestore } from "firebase/firestore";

// --- INSTRUCTIONS ---
// 1. Create a project at https://console.firebase.google.com/
// 2. Register a Web App in your Firebase project settings.
// 3. Copy the "firebaseConfig" object provided by Firebase.
// 4. Replace the values below with your actual keys.

const firebaseConfig = {
  apiKey: "AIzaSyAvLUZYoiUiUdfTjps6R8RV5sE8ZIHyqqA",
  authDomain: "ai-learn-57647.firebaseapp.com",
  projectId: "ai-learn-57647",
  storageBucket: "ai-learn-57647.firebasestorage.app",
  messagingSenderId: "559758799276",
  appId: "1:559758799276:web:bf1e465e5e318e6aa98a09"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Use initializeFirestore with polling to fix offline errors in environments like StackBlitz/Replit
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
});
