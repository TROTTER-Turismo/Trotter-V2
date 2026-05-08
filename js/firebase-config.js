import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth }        from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore }   from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey:            "AIzaSyAXlycGmhc26J5E5Q4K5Hrb6yQtGENw30s",
  authDomain:        "trotter-turismo.firebaseapp.com",
  projectId:         "turismo de trote",
  storageBucket:     "trotter-turismo.firebasestorage.app",
  messagingSenderId: "17842479646",
  appId:             "1:17842479646:web:fd955d73680c135a88040f"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db   = getFirestore(app);
