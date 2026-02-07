import React, { useState, useEffect, createContext, useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { 
  collection, addDoc, query, where, orderBy, onSnapshot, 
  doc, updateDoc, serverTimestamp, runTransaction, getDoc, setDoc 
} from 'firebase/firestore';
import { auth, db, loginEmailPassword, logout } from './firebase';
import { 
  Video, LogOut, Upload, ShieldCheck, User, XCircle, CheckCircle 
} from 'lucide-react';

// --- Contexto de Autenticação (CORREÇÃO DE TELA BRANCA AQUI) ---
const AuthContext = createContext();

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      try {
        setUser(currentUser);
        if (currentUser) {
          // Tenta buscar dados do usuário no Firestore
          const userRef = doc(db, "users", currentUser.uid);
          const docSnap = await getDoc(userRef).catch(e => {
            console.warn("Erro ao ler perfil do usuário (pode ser permissão):", e);
            return null;
          });
          
          if (docSnap && docSnap.exists()) {
            setUserData(docSnap.data());
          } else {
            // Se não existe ou deu erro, usa dados básicos
            setUserData({ 
              email: currentUser.email, 
              role: 'user', 
              balance: 0 
            });
          }
        } else {
          setUserData(null);
        }
      } catch (err) {
        console.error("ERRO FATAL NO AUTH:", err);
      } finally {
        // OBRIGATÓRIO: Parar o loading independente de erro
        setLoading(false);
      }
    });
    return unsubscribe;
  }, []);

  return (
    <AuthContext.Provider value={{ user, userData, loading }}>
      {!loading ? children : (
        <div className="h-screen flex flex-col items-center justify-center bg-gray-900 text-white">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mb-4"></div>
            <p>Carregando sistema...</p>
        </div>
      )}
    </AuthContext.Provider>
  );
};

const useAuth = () => useContext(AuthContext);

// --- Componentes UI ---

const StatusBadge = ({ status }) => {
  const styles = {
    pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
    approved: "bg-green-100 text-green-800 border-green-200",
    rejected: "bg-red-100 text-red-800 border-red-200",
    paid: "bg-blue-100 text-blue-800 border-blue-200"
  };
  const labels = { pending: "Análise", approved: "Aprovado", rejected: "Recusado", paid: "Pago" };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-bold border ${styles[status] || styles.pending}`}>
      {labels[status] || status}
    </span>
  );
};

// --- Telas ---

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await loginEmailPassword(email, password);
    } catch (err) {
      console.error(err);
      setError("Erro ao entrar: Verifique usuário/senha.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="bg-gray-800 p-8 rounded-xl shadow-2xl max-w-sm w-full border border-gray-700">
        <h1 className="text-2xl font-bold text-white mb-6 text-center flex justify-center items-center gap-2">
           <Video className="text-purple-500" /> ViralReward
        </h1>
        <form onSubmit={handleLogin} className="space-y-4">
          <input type="email" required className="w-full bg-gray-700 text-white rounded p-3" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
          <input type="password" required className="w-full bg-gray-700 text-white rounded p-3" placeholder="Senha" value={password} onChange={e => setPassword(e.target.value)} />
          {error && <p className="text-red-400 text-sm text-center">{error}</p>}
          <button type="submit" disabled={loading} className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 rounded transition-all">
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
};

const UserDashboard = () => {
  const { user, userData } = useAuth();
  const [videoLink, setVideoLink] = useState('');
  const [claimedViews, setClaimedViews] = useState('');
  const [submissions, setSubmissions] = useState([]);

  useEffect(() => {
    if (!user) return;
    // Query segura: Se falhar (falta de index), não quebra a tela
    try {
        const q = query(collection(db, "submissions"), where("userId", "==", user.uid), orderBy("createdAt", "desc"));
        const unsub = onSnapshot(q, (snapshot) => {
            setSubmissions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }, (error) => {
            console.error("Erro ao carregar envios:", error);
        });
        return unsub;
    } catch(e) {
        console.error("Erro na query:", e);
    }
  }, [user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!videoLink || !claimedViews) return;
    try {
      await addDoc(collection(db, "submissions"), {
        userId: user.uid,
        userEmail: user.email,
        videoLink,
        claimedViews: Number(claimedViews),
        status: 'pending',
        rewardAmount: 0,
        createdAt: serverTimestamp()
      });
      setVideoLink(''); setClaimedViews(''); alert("Enviado!");
    } catch (error) {
      alert("Erro ao enviar: " + error.message);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow p-4 flex justify-between items-center">
        <h1 className="font-bold text-gray-800">Painel do Creator</h1>
        <div className="flex items-center gap-4">
            <span className="text-sm font-semibold text-green-700 bg-green-100 px-3 py-1 rounded-full">
                Saldo: R$ {userData?.balance?.toFixed(2) || '0.00'}
            </span>
            <button onClick={logout} className="text-red-500"><LogOut size={20}/></button>
        </div>
      </header>
      <main className="max-w-4xl mx-auto p-4 mt-6 grid gap-6 md:grid-cols-3">
        <div className="md:col-span-1 bg-white p-6 rounded-lg shadow h-fit">
            <h2 className="font-bold mb-4 flex items-center gap-2"><Upload size={18}/> Novo Envio</h2>
            <form onSubmit={handleSubmit} className="space-y-3">
                <input type="url" placeholder="Link do TikTok/Reels" className="w-full border p-2 rounded" value={videoLink} onChange={e=>setVideoLink(e.target.value)} required />
                <input type="number" placeholder="Visualizações" className="w-full border p-2 rounded" value={claimedViews} onChange={e=>setClaimedViews(e.target.value)} required />
                <button className="w-full bg-purple-600 text-white p-2 rounded font-bold">Enviar</button>
            </form>
        </div>
        <div className="md:col-span-2 bg-white p-6 rounded-lg shadow overflow-hidden">
            <h2 className="font-bold mb-4">Histórico</h2>
            <div className="overflow-y-auto max-h-[500px]">
                {submissions.length === 0 ? <p className="text-gray-400">Nenhum envio.</p> : (
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 text-gray-500">
                            <tr><th className="p-2">Data</th><th className="p-2">Views</th><th className="p-2">R$</th><th className="p-2">Status</th></tr>
                        </thead>
                        <tbody className="divide-y">
                            {submissions.map(sub => (
                                <tr key={sub.id}>
                                    <td className="p-2">{sub.createdAt?.toDate().toLocaleDateString() || '...'}</td>
                                    <td className="p-2">{sub.claimedViews}</td>
                                    <td className="p-2 text-green-600 font-bold">{sub.rewardAmount > 0 ? `R$ ${sub.rewardAmount}` : '-'}</td>
                                    <td className="p-2"><StatusBadge status={sub.status}/></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
      </main>
    </div>
  );
};

const AdminDashboard = () => {
    const [submissions, setSubmissions] = useState([]);
    useEffect(() => {
        const q = query(collection(db, "submissions"), orderBy("createdAt", "desc"));
        return onSnapshot(q, snap => setSubmissions(snap.docs.map(d => ({id: d.id, ...d.data()}))));
    }, []);

    const handleAction = async (id, userId, action, declaredViews) => {
        if (action === 'reject') {
            await updateDoc(doc(db, "submissions", id), { status: 'rejected' });
            return;
        }
        const realViews = prompt("Views auditadas:", declaredViews);
        if (!realViews) return;
        const reward = (parseInt(realViews)/1000) * 10; // R$10 por 1k

        await runTransaction(db, async (t) => {
            t.update(doc(db, "submissions", id), { status: 'approved', rewardAmount: reward });
            const userRef = doc(db, "users", userId);
            const userDoc = await t.get(userRef);
            const newBal = (userDoc.data()?.balance || 0) + reward;
            t.update(userRef, { balance: newBal });
        });
    };

    return (
        <div className="p-8 bg-gray-100 min-h-screen">
            <div className="flex justify-between mb-6">
                <h1 className="text-2xl font-bold flex gap-2"><ShieldCheck/> Admin</h1>
                <button onClick={logout} className="text-red-600 font-bold">Sair</button>
            </div>
            <div className="space-y-4">
                {submissions.map(sub => (
                    <div key={sub.id} className="bg-white p-4 rounded shadow flex justify-between items-center">
                        <div>
                            <p className="font-bold text-sm text-gray-600">{sub.userEmail}</p>
                            <a href={sub.videoLink} target="_blank" className="text-blue-600 text-sm hover:underline">{sub.videoLink}</a>
                            <p className="text-xs text-gray-400">Declarado: {sub.claimedViews}</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <StatusBadge status={sub.status}/>
                            {sub.status === 'pending' && (
                                <>
                                    <button onClick={() => handleAction(sub.id, sub.userId, 'reject')} className="text-red-500 hover:bg-red-50 p-2 rounded"><XCircle/></button>
                                    <button onClick={() => handleAction(sub.id, sub.userId, 'approve', sub.claimedViews)} className="text-green-500 hover:bg-green-50 p-2 rounded"><CheckCircle/></button>
                                </>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

// --- App Principal ---

const App = () => {
  const { user, userData, loading } = useAuth();

  if (loading) return null; // O loading é tratado dentro do AuthProvider

  return (
    <Router>
      <Routes>
        <Route path="/login" element={!user ? <Login /> : <Navigate to="/" />} />
        <Route path="/" element={
          user ? (userData?.role === 'admin' ? <AdminDashboard /> : <UserDashboard />) : <Navigate to="/login" />
        } />
      </Routes>
    </Router>
  );
};

const WrappedApp = () => (
  <AuthProvider>
    <App />
  </AuthProvider>
);

export default WrappedApp;
