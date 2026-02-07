import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  signOut 
} from "firebase/auth";
import { 
  getFirestore, 
  doc, 
  getDoc, 
  setDoc, 
  serverTimestamp 
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyC2ZUz4GNlF-rA6Inaw8WicsPAioZuydjY",
  authDomain: "cortes-335a1.firebaseapp.com",
  projectId: "cortes-335a1",
  storageBucket: "cortes-335a1.firebasestorage.app",
  messagingSenderId: "712833600204",
  appId: "1:712833600204:web:764c546d76a060eeb81069"
};

// Inicializa Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Função de Login Email/Senha
export const loginEmailPassword = async (email, password) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    return user;
  } catch (error) {
    console.error("Erro no login Firebase:", error);
    throw error;
  }
};

// Função de Logout
export const logout = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Erro ao sair:", error);
  }
};

// Exportações essenciais
export { auth, db, app };
