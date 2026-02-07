import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  signInWithEmailAndPassword, // Mudança aqui
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

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Nova função de Login
export const loginEmailPassword = async (email, password) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Verificar se o documento do usuário existe no Firestore, se não, cria
    const userRef = doc(db, "users", user.uid);
    const docSnap = await getDoc(userRef);

    if (!docSnap.exists()) {
      await setDoc(userRef, {
        email: user.email,
        role: 'user', // Padrão é user
        balance: 0,
        createdAt: serverTimestamp()
      });
    }
    
    return user;
  } catch (error) {
    throw error; // Repassa o erro para o front mostrar o alerta
  }
};

export const logout = () => signOut(auth);

export { auth, db };
