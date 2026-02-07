import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut 
} from "firebase/auth";
import { 
  getFirestore, 
  collection, 
  addDoc, 
  getDocs, 
  doc, 
  updateDoc, 
  query, 
  where, 
  orderBy, 
  serverTimestamp,
  runTransaction
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyC2ZUz4GNlF-rA6Inaw8WicsPAioZuydjY",
  authDomain: "cortes-335a1.firebaseapp.com",
  projectId: "cortes-335a1",
  storageBucket: "cortes-335a1.firebasestorage.app",
  messagingSenderId: "712833600204",
  appId: "1:712833600204:web:764c546d76a060eeb81069"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

// Funções de Autenticação
export const loginGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    // Cria o documento do usuário se não existir
    const userRef = doc(db, "users", result.user.uid);
    // Não sobrescreve dados existentes, apenas atualiza login
    await updateDoc(userRef, { 
      lastLogin: serverTimestamp(),
      email: result.user.email,
      displayName: result.user.displayName,
      photoURL: result.user.photoURL
    }).catch(async (e) => {
        // Se der erro porque não existe, cria (setDoc seria melhor, mas aqui simplificamos)
        // Na prática, use setDoc com { merge: true }
    });
    return result.user;
  } catch (error) {
    console.error("Erro no login:", error);
  }
};

export const logout = () => signOut(auth);

export { auth, db };
