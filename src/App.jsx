import React, { useState, useEffect, createContext, useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { 
  collection, addDoc, query, where, orderBy, onSnapshot, 
  doc, updateDoc, serverTimestamp, runTransaction, getDoc, setDoc 
} from 'firebase/firestore';
import { auth, db, loginEmailPassword, logout } from './firebase';
import { 
  Video, LogOut, Upload, ShieldCheck, User, XCircle, CheckCircle, Save 
} from 'lucide-react';

// --- Contexto de Autenticação (BLINDADO CONTRA ERROS) ---
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
          // O catch aqui evita que o app trave se o usuário não existir no banco ainda
          const docSnap = await getDoc(userRef).catch(e => {
            console.warn("Aviso: Perfil ainda não existe no banco ou sem permissão.", e);
            return null;
          });
          
          if (docSnap && docSnap.exists()) {
            setUserData(docSnap.data());
          } else {
            // Se não tem perfil no banco, usa dados temporários da memória
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
        console.error("ERRO CRÍTICO NO AUTH:", err);
      } finally {
        // OBRIGATÓRIO: Parar o loading para não dar tela branca infinita
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

// --- Componentes UI Auxiliares ---

const StatusBadge = ({ status }) => {
  const styles = {
    pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
    approved: "bg-green-100 text-green-800 border-green-200",
    rejected: "bg-red-100 text-red-800 border-red-200",
    paid: "bg-blue-100 text-blue-800 border-blue-200"
  };
  const labels = { pending: "Em Análise", approved: "Aprovado", rejected: "Recusado", paid: "Pago" };
  return (
    <span className={`px-2 py-1 rounded text-xs font-bold border ${styles[status] || styles.pending}`}>
      {labels[status] || status}
    </span>
  );
};

// --- TELA 1: LOGIN ---

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
      setError("Erro ao entrar: Verifique se o usuário existe no Firebase Authentication.");
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
          <div>
            <label className="text-gray-400 text-xs uppercase font-bold">Email</label>
            <input type="email" required className="w-full bg-gray-700 text-white rounded p-3 mt-1 focus:outline-none focus:ring-2 focus:ring-purple-500" placeholder="seu@email.com" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="text-gray-400 text-xs uppercase font-bold">Senha</label>
            <input type="password" required className="w-full bg-gray-700 text-white rounded p-3 mt-1 focus:outline-none focus:ring-2 focus:ring-purple-500" placeholder="******" value={password} onChange={e => setPassword(e.target.value)} />
          </div>
          
          {error && <div className="bg-red-900/50 border border-red-500 text-red-200 text-sm p-3 rounded">{error}</div>}
          
          <button type="submit" disabled={loading} className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 rounded transition-all disabled:opacity-50">
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
        <p className="text-gray-500 text-xs text-center mt-4">
            Ainda não tem conta? Peça ao admin para criar no Firebase Console.
        </p>
      </div>
    </div>
  );
};

// --- TELA 2: DASHBOARD DO USUÁRIO ---

const UserDashboard = () => {
  const { user, userData } = useAuth();
  const [videoLink, setVideoLink] = useState('');
  const [claimedViews, setClaimedViews] = useState('');
  const [submissions, setSubmissions] = useState([]);

  // Carregar envios
  useEffect(() => {
    if (!user) return;
    try {
        // Query segura
        const q = query(collection(db, "submissions"), where("userId", "==", user.uid), orderBy("createdAt", "desc"));
        const unsub = onSnapshot(q, (snapshot) => {
            setSubmissions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }, (error) => {
            console.error("Erro ao carregar envios (verifique index no console):", error);
        });
        return unsub;
    } catch(e) {
        console.error("Erro na query:", e);
    }
  }, [user]);

  // --- BOTÃO DE FORÇAR SALVAMENTO (Para você virar admin) ---
  const handleForceSaveProfile = async () => {
    if (!user) return;
    try {
      const userRef = doc(db, "users", user.uid);
      await setDoc(userRef, {
        email: user.email,
        role: 'user', // Salva como user. Depois você muda pra admin no console.
        balance: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }, { merge: true });
      alert("✅ Perfil salvo com sucesso!\n\nAgora vá no Firebase Console -> Firestore -> users -> seu ID e mude 'role' para 'admin'. Depois recarregue a página.");
      window.location.reload();
    } catch (error) {
      alert("❌ Erro ao salvar: " + error.message);
    }
  };

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
      setVideoLink(''); setClaimedViews(''); alert("Enviado com sucesso!");
    } catch (error) {
      alert("Erro ao enviar: " + error.message);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 pb-10">
      <header className="bg-white shadow p-4 flex flex-col md:flex-row justify-between items-center gap-4">
        <h1 className="font-bold text-gray-800 text-xl flex items-center gap-2">
            <Video className="text-purple-600"/> Painel do Creator
        </h1>
        
        <div className="flex flex-wrap items-center gap-3">
            {/* BOTÃO DE EMERGÊNCIA */}
            <button 
              onClick={handleForceSaveProfile}
              className="flex items-center gap-1 bg-yellow-100 text-yellow-800 px-3 py-1 rounded border border-yellow-300 text-xs font-bold hover:bg-yellow-200"
            >
              <Save size={14}/> Salvar Perfil no BD
            </button>

            <span className="text-sm font-semibold text-green-700 bg-green-100 px-3 py-1 rounded-full border border-green-200">
                Saldo: R$ {userData?.balance?.toFixed(2) || '0.00'}
            </span>
            <button onClick={logout} className="text-red-500 hover:bg-red-50 p-2 rounded-full transition">
                <LogOut size={20}/>
            </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-4 mt-6 grid gap-6 md:grid-cols-3">
        {/* Formulário de Envio */}
        <div className="md:col-span-1 bg-white p-6 rounded-xl shadow-sm border border-gray-200 h-fit">
            <h2 className="font-bold mb-4 flex items-center gap-2 text-gray-700"><Upload size={18}/> Novo Envio</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="text-xs font-bold text-gray-500 uppercase">Link do Vídeo</label>
                    <input 
                      type="url" 
                      placeholder="https://tiktok.com/..." 
                      className="w-full border p-2 rounded mt-1 focus:ring-2 focus:ring-purple-500 outline-none" 
                      value={videoLink} 
                      onChange={e=>setVideoLink(e.target.value)} 
                      required 
                    />
                </div>
                <div>
                    <label className="text-xs font-bold text-gray-500 uppercase">Visualizações</label>
                    <input 
                      type="number" 
                      placeholder="Ex: 10000" 
                      className="w-full border p-2 rounded mt-1 focus:ring-2 focus:ring-purple-500 outline-none" 
                      value={claimedViews} 
                      onChange={e=>setClaimedViews(e.target.value)} 
                      required 
                    />
                </div>
                <button className="w-full bg-purple-600 hover:bg-purple-700 transition text-white py-2 rounded font-bold shadow-md">
                  Enviar para Análise
                </button>
            </form>
        </div>

        {/* Histórico */}
        <div className="md:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-6 border-b border-gray-100">
                <h2 className="font-bold text-gray-700">Histórico de Envios</h2>
            </div>
            <div className="overflow-x-auto max-h-[500px]">
                {submissions.length === 0 ? (
                  <p className="text-gray-400 text-center py-8">Você ainda não enviou nenhum corte.</p>
                ) : (
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 text-gray-500 font-semibold">
                            <tr>
                              <th className="p-4">Data</th>
                              <th className="p-4">Views</th>
                              <th className="p-4">Recompensa</th>
                              <th className="p-4">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {submissions.map(sub => (
                                <tr key={sub.id} className="hover:bg-gray-50 transition">
                                    <td className="p-4 text-gray-500">{sub.createdAt?.toDate().toLocaleDateString() || '-'}</td>
                                    <td className="p-4 font-mono">{sub.claimedViews}</td>
                                    <td className="p-4 text-green-600 font-bold">{sub.rewardAmount > 0 ? `R$ ${sub.rewardAmount.toFixed(2)}` : '-'}</td>
                                    <td className="p-4"><StatusBadge status={sub.status}/></td>
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

// --- TELA 3: DASHBOARD DO ADMIN ---

const AdminDashboard = () => {
    const [submissions, setSubmissions] = useState([]);
    
    useEffect(() => {
        // Carrega TODOS os envios
        const q = query(collection(db, "submissions"), orderBy("createdAt", "desc"));
        return onSnapshot(q, snap => setSubmissions(snap.docs.map(d => ({id: d.id, ...d.data()}))));
    }, []);

    const handleAction = async (id, userId, action, declaredViews) => {
        if (action === 'reject') {
            const reason = prompt("Motivo da rejeição:", "Fraude / Link inválido");
            if (!reason) return;
            await updateDoc(doc(db, "submissions", id), { status: 'rejected', rejectionReason: reason });
            return;
        }
        
        // Aprovação
        const realViews = prompt("Quantas views REAIS você auditou?", declaredViews);
        if (!realViews) return;
        
        const rpm = 10; // R$ 10,00 a cada 1000 views
        const reward = (parseInt(realViews) / 1000) * rpm;

        if(!window.confirm(`Confirma PAGAR R$ ${reward.toFixed(2)} para este usuário?`)) return;

        try {
            await runTransaction(db, async (t) => {
                // 1. Atualiza status do envio
                const subRef = doc(db, "submissions", id);
                t.update(subRef, { 
                    status: 'approved', 
                    verifiedViews: parseInt(realViews),
                    rewardAmount: reward,
                    processedAt: serverTimestamp() 
                });
                
                // 2. Adiciona saldo ao usuário
                const userRef = doc(db, "users", userId);
                const userDoc = await t.get(userRef);
                if (!userDoc.exists()) throw new Error("Usuário não encontrado no banco!");
                
                const newBal = (userDoc.data()?.balance || 0) + reward;
                t.update(userRef, { balance: newBal });
            });
            alert("✅ Aprovado e pago com sucesso!");
        } catch (e) {
            alert("Erro: " + e.message);
        }
    };

    return (
        <div className="p-8 bg-gray-100 min-h-screen">
            <div className="max-w-6xl mx-auto">
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-2xl font-bold flex items-center gap-2 text-gray-800">
                        <ShieldCheck className="text-blue-600"/> Painel Administrativo
                    </h1>
                    <button onClick={logout} className="bg-white text-red-600 font-bold px-4 py-2 rounded shadow hover:bg-red-50">
                        Sair
                    </button>
                </div>
                
                <div className="grid gap-4">
                    {submissions.map(sub => (
                        <div key={sub.id} className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 flex flex-col md:flex-row justify-between items-center gap-4">
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="font-bold text-gray-800 text-sm">{sub.userEmail}</span>
                                    <StatusBadge status={sub.status}/>
                                </div>
                                <div className="flex items-center gap-4 mt-2">
                                    <a href={sub.videoLink} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-blue-600 font-semibold hover:underline text-sm">
                                        <Video size={16} /> Ver Vídeo
                                    </a>
                                    <span className="bg-gray-100 px-2 py-1 rounded text-xs font-mono text-gray-600">
                                        Declarado: {sub.claimedViews} views
                                    </span>
                                </div>
                                {sub.status === 'rejected' && (
                                    <p className="text-xs text-red-500 mt-1">Motivo: {sub.rejectionReason}</p>
                                )}
                            </div>
                            
                            {/* Ações */}
                            {sub.status === 'pending' && (
                                <div className="flex gap-2">
                                    <button 
                                      onClick={() => handleAction(sub.id, sub.userId, 'reject')} 
                                      className="flex items-center gap-1 px-3 py-2 bg-red-50 text-red-600 rounded hover:bg-red-100 transition text-sm font-bold"
                                    >
                                        <XCircle size={16}/> Rejeitar
                                    </button>
                                    <button 
                                      onClick={() => handleAction(sub.id, sub.userId, 'approve', sub.claimedViews)} 
                                      className="flex items-center gap-1 px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition shadow text-sm font-bold"
                                    >
                                        <CheckCircle size={16}/> Aprovar & Pagar
                                    </button>
                                </div>
                            )}

                            {sub.status === 'approved' && (
                                <div className="text-right">
                                    <div className="text-xs text-gray-500 uppercase font-bold">Pago</div>
                                    <div className="font-bold text-xl text-green-600">R$ {sub.rewardAmount?.toFixed(2)}</div>
                                </div>
                            )}
                        </div>
                    ))}
                    
                    {submissions.length === 0 && (
                        <p className="text-center text-gray-500 py-12">Nenhuma tarefa pendente.</p>
                    )}
                </div>
            </div>
        </div>
    );
};

// --- ROTEAMENTO PRINCIPAL ---

const App = () => {
  const { user, userData, loading } = useAuth();

  // Loading é tratado dentro do AuthProvider, aqui só retorna null se ainda estiver carregando
  if (loading) return null;

  return (
    <Router>
      <Routes>
        <Route path="/login" element={!user ? <Login /> : <Navigate to="/" />} />
        <Route path="/" element={
          user ? (
            // Verifica se é admin ou user
            userData?.role === 'admin' ? <AdminDashboard /> : <UserDashboard />
          ) : (
            <Navigate to="/login" />
          )
        } />
      </Routes>
    </Router>
  );
};

// Envolve o App no Contexto
const WrappedApp = () => (
  <AuthProvider>
    <App />
  </AuthProvider>
);

export default WrappedApp;
