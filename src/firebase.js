import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, // Novo
  signOut,
  updateProfile
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

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Login
export const loginEmailPassword = async (email, password) => {
  return await signInWithEmailAndPassword(auth, email, password);
};

// Registro (Novo: Cria Auth + Perfil no Firestore com Role)
export const registerUser = async (email, password, name, role) => {
  try {
    // 1. Criar Auth
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // 2. Atualizar Nome
    await updateProfile(user, { displayName: name });

    // 3. Criar Documento no Firestore
    await setDoc(doc(db, "users", user.uid), {
      email: user.email,
      displayName: name,
      role: role, // 'advertiser' ou 'clipper'
      balance: role === 'advertiser' ? 1000 : 0, // Bônus inicial para testar
      createdAt: serverTimestamp()
    });

    return user;
  } catch (error) {
    console.error("Erro no registro:", error);
    throw error;
  }
};

export const logout = () => signOut(auth);

export { auth, db };
