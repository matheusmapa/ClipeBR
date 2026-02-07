import React, { useState, useEffect, createContext, useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { 
  collection, addDoc, query, where, orderBy, onSnapshot, 
  doc, updateDoc, serverTimestamp, runTransaction, getDoc, setDoc 
} from 'firebase/firestore';
import { auth, db, loginGoogle, logout } from './firebase';
import { 
  Video, DollarSign, CheckCircle, XCircle, Clock, 
  LogOut, Upload, ShieldCheck, User 
} from 'lucide-react';

// --- Contexto de Autenticação ---
const AuthContext = createContext();

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null); // Dados do Firestore (isAdmin, saldo, pix)
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // Buscar dados extras do usuário no Firestore
        const userRef = doc(db, "users", currentUser.uid);
        const docSnap = await getDoc(userRef);
        
        if (docSnap.exists()) {
          setUserData(docSnap.data());
        } else {
          // Criar perfil inicial
          const newProfile = {
            email: currentUser.email,
            displayName: currentUser.displayName,
            role: 'user', // 'admin' ou 'user'
            pixKey: '',
            balance: 0,
            createdAt: serverTimestamp()
          };
          await setDoc(userRef, newProfile);
          setUserData(newProfile);
        }
      } else {
        setUserData(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  return (
    <AuthContext.Provider value={{ user, userData, loading }}>
      {!loading && children}
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
  
  const labels = {
    pending: "Em Análise",
    approved: "Aprovado",
    rejected: "Recusado",
    paid: "Pago"
  };

  return (
    <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${styles[status]}`}>
      {labels[status]}
    </span>
  );
};

// --- Telas ---

// 1. Tela de Login
const Login = () => {
  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="bg-gray-800 p-8 rounded-2xl shadow-xl max-w-md w-full text-center border border-gray-700">
        <div className="mb-6 flex justify-center">
          <div className="bg-purple-600 p-3 rounded-full">
            <Video size={32} className="text-white" />
          </div>
        </div>
        <h1 className="text-3xl font-bold text-white mb-2">ViralReward</h1>
        <p className="text-gray-400 mb-8">Monetize seus cortes virais. Receba por visualização.</p>
        
        <button 
          onClick={loginGoogle}
          className="w-full bg-white hover:bg-gray-100 text-gray-900 font-bold py-3 px-4 rounded-lg flex items-center justify-center transition-all"
        >
          <img src="https://www.google.com/favicon.ico" alt="G" className="w-5 h-5 mr-3" />
          Entrar com Google
        </button>
      </div>
    </div>
  );
};

// 2. Dashboard do Usuário (Clipador)
const UserDashboard = () => {
  const { user, userData } = useAuth();
  const [videoLink, setVideoLink] = useState('');
  const [claimedViews, setClaimedViews] = useState('');
  const [submissions, setSubmissions] = useState([]);
  const [pixKey, setPixKey] = useState(userData?.pixKey || '');

  // Carregar submissões do usuário
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "submissions"), 
      where("userId", "==", user.uid),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(q, (snapshot) => {
      setSubmissions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return unsub;
  }, [user]);

  // Atualizar chave PIX
  const handleSavePix = async () => {
    if (!pixKey) return;
    await updateDoc(doc(db, "users", user.uid), { pixKey });
    alert("Chave PIX salva!");
  };

  // Enviar novo vídeo
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!videoLink || !claimedViews) return alert("Preencha tudo!");

    try {
      await addDoc(collection(db, "submissions"), {
        userId: user.uid,
        userEmail: user.email,
        videoLink,
        claimedViews: Number(claimedViews),
        status: 'pending', // pending, approved, rejected, paid
        rewardAmount: 0, // Será calculado pelo admin
        createdAt: serverTimestamp(),
        campaign: "Campanha Padrão" // Pode ser dinâmico depois
      });
      setVideoLink('');
      setClaimedViews('');
      alert("Vídeo enviado para análise!");
    } catch (error) {
      console.error(error);
      alert("Erro ao enviar.");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Video className="text-purple-600" />
            <h1 className="font-bold text-gray-800 text-xl">ViralReward</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">Saldo: <b>R$ {userData?.balance?.toFixed(2) || '0.00'}</b></span>
            <button onClick={logout} className="text-red-500 hover:bg-red-50 p-2 rounded-full">
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 mt-8 grid gap-8 md:grid-cols-3">
        {/* Coluna Esquerda: Envio */}
        <div className="md:col-span-1 space-y-6">
          {/* Card PIX */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <User size={18} /> Dados de Pagamento
            </h3>
            <input 
              type="text" 
              placeholder="Sua Chave PIX" 
              className="w-full border rounded p-2 mb-2 text-sm"
              value={pixKey}
              onChange={(e) => setPixKey(e.target.value)}
            />
            <button onClick={handleSavePix} className="w-full bg-gray-800 text-white text-sm py-2 rounded hover:bg-gray-700">
              Salvar PIX
            </button>
          </div>

          {/* Card Envio */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Upload size={18} /> Enviar Corte
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs text-gray-500 uppercase font-bold">Link do Vídeo</label>
                <input 
                  type="url" 
                  placeholder="https://tiktok.com/..." 
                  className="w-full border rounded p-2 mt-1"
                  required
                  value={videoLink}
                  onChange={(e) => setVideoLink(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 uppercase font-bold">Visualizações Atuais</label>
                <input 
                  type="number" 
                  placeholder="Ex: 15000" 
                  className="w-full border rounded p-2 mt-1"
                  required
                  value={claimedViews}
                  onChange={(e) => setClaimedViews(e.target.value)}
                />
              </div>
              <button type="submit" className="w-full bg-purple-600 text-white font-bold py-3 rounded hover:bg-purple-700 transition">
                Enviar para Análise
              </button>
            </form>
          </div>
        </div>

        {/* Coluna Direita: Histórico */}
        <div className="md:col-span-2">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100">
              <h2 className="font-bold text-gray-800 text-lg">Seus Envios</h2>
            </div>
            {submissions.length === 0 ? (
              <div className="p-8 text-center text-gray-400">Nenhum envio ainda.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 text-gray-500">
                    <tr>
                      <th className="p-4">Data</th>
                      <th className="p-4">Link</th>
                      <th className="p-4">Views (Decl.)</th>
                      <th className="p-4">Recompensa</th>
                      <th className="p-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {submissions.map((sub) => (
                      <tr key={sub.id} className="hover:bg-gray-50">
                        <td className="p-4 text-gray-500">
                          {sub.createdAt?.toDate().toLocaleDateString('pt-BR')}
                        </td>
                        <td className="p-4">
                          <a href={sub.videoLink} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline truncate max-w-[150px] block">
                            Abrir Vídeo
                          </a>
                        </td>
                        <td className="p-4 font-mono">{sub.claimedViews.toLocaleString()}</td>
                        <td className="p-4 font-bold text-green-700">
                          {sub.status === 'approved' || sub.status === 'paid' 
                            ? `R$ ${sub.rewardAmount.toFixed(2)}` 
                            : '-'}
                        </td>
                        <td className="p-4"><StatusBadge status={sub.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// 3. Dashboard do Admin (Você)
const AdminDashboard = () => {
  const [submissions, setSubmissions] = useState([]);
  const [filter, setFilter] = useState('pending'); // pending, all

  // Carregar submissões globais
  useEffect(() => {
    let q = collection(db, "submissions");
    if (filter === 'pending') {
      q = query(collection(db, "submissions"), where("status", "==", "pending"), orderBy("createdAt", "desc"));
    } else {
      q = query(collection(db, "submissions"), orderBy("createdAt", "desc"));
    }

    const unsub = onSnapshot(q, (snapshot) => {
      setSubmissions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return unsub;
  }, [filter]);

  // AÇÃO CRÍTICA: Aprovar e Pagar (Simulação no BD)
  const handleApprove = async (submissionId, userId, claimedViews) => {
    const verifiedViews = prompt("Quantas views REAIS você auditou?", claimedViews);
    if (!verifiedViews) return;

    const rpm = 10; // R$ 10,00 a cada 1000 views
    const reward = (parseInt(verifiedViews) / 1000) * rpm;
    
    if(!window.confirm(`Confirma aprovar?\nViews: ${verifiedViews}\nValor: R$ ${reward.toFixed(2)}`)) return;

    try {
      await runTransaction(db, async (transaction) => {
        // 1. Atualizar o status da submissão
        const subRef = doc(db, "submissions", submissionId);
        transaction.update(subRef, {
          status: 'approved',
          verifiedViews: parseInt(verifiedViews),
          rewardAmount: reward,
          processedAt: serverTimestamp()
        });

        // 2. Adicionar saldo ao usuário
        const userRef = doc(db, "users", userId);
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists()) throw "Usuário não existe!";
        
        const newBalance = (userDoc.data().balance || 0) + reward;
        transaction.update(userRef, { balance: newBalance });
      });
      alert("Aprovado com sucesso!");
    } catch (e) {
      console.error(e);
      alert("Erro na transação: " + e.message);
    }
  };

  const handleReject = async (submissionId) => {
    const reason = prompt("Motivo da rejeição:", "Fraude / Link inválido");
    if (!reason) return;

    await updateDoc(doc(db, "submissions", submissionId), {
      status: 'rejected',
      rejectionReason: reason,
      processedAt: serverTimestamp()
    });
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <ShieldCheck className="text-blue-600" /> Painel Admin
          </h1>
          <div className="space-x-4">
            <button onClick={() => setFilter('pending')} className={`px-4 py-2 rounded ${filter === 'pending' ? 'bg-blue-600 text-white' : 'bg-white'}`}>Pendentes</button>
            <button onClick={() => setFilter('all')} className={`px-4 py-2 rounded ${filter === 'all' ? 'bg-blue-600 text-white' : 'bg-white'}`}>Todos</button>
            <button onClick={logout} className="text-red-600 font-bold px-4">Sair</button>
          </div>
        </div>

        <div className="grid gap-4">
          {submissions.map((sub) => (
            <div key={sub.id} className="bg-white p-6 rounded-lg shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-bold text-gray-800">{sub.userEmail}</span>
                  <StatusBadge status={sub.status} />
                </div>
                <div className="text-sm text-gray-500 mb-2">
                  Enviado em: {sub.createdAt?.toDate().toLocaleString()}
                </div>
                <div className="flex items-center gap-4">
                  <a href={sub.videoLink} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-blue-600 font-semibold hover:underline">
                    <Video size={16} /> Ver Vídeo
                  </a>
                  <span className="bg-gray-100 px-2 py-1 rounded text-sm font-mono text-gray-700">
                    Decl: {sub.claimedViews.toLocaleString()} views
                  </span>
                </div>
              </div>

              {sub.status === 'pending' && (
                <div className="flex gap-2">
                  <button 
                    onClick={() => handleReject(sub.id)}
                    className="flex items-center gap-2 px-4 py-2 bg-red-100 text-red-700 rounded hover:bg-red-200 transition"
                  >
                    <XCircle size={18} /> Rejeitar
                  </button>
                  <button 
                    onClick={() => handleApprove(sub.id, sub.userId, sub.claimedViews)}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition shadow-lg"
                  >
                    <CheckCircle size={18} /> Aprovar & Pagar
                  </button>
                </div>
              )}

              {sub.status === 'approved' && (
                <div className="text-right">
                  <div className="text-xs text-gray-500">Valor Pago</div>
                  <div className="font-bold text-xl text-green-600">R$ {sub.rewardAmount?.toFixed(2)}</div>
                </div>
              )}
            </div>
          ))}
          
          {submissions.length === 0 && (
            <p className="text-center text-gray-500 py-12">Nenhuma tarefa encontrada.</p>
          )}
        </div>
      </div>
    </div>
  );
};

// --- Roteamento Principal ---

const App = () => {
  const { user, userData, loading } = useAuth();

  if (loading) return <div className="h-screen flex items-center justify-center text-gray-500">Carregando...</div>;

  return (
    <Router>
      <Routes>
        <Route path="/login" element={!user ? <Login /> : <Navigate to="/" />} />
        
        {/* Rota Protegida Principal */}
        <Route path="/" element={
          user ? (
            // Se for admin, manda pro painel admin. Se não, user.
            // NOTA: Para testar, mude manualmente no Firestore o campo 'role' do seu usuário para 'admin'
            userData?.role === 'admin' ? <AdminDashboard /> : <UserDashboard />
          ) : (
            <Navigate to="/login" />
          )
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
