import React, { useState, useEffect, createContext, useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useParams } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { 
  collection, addDoc, query, where, orderBy, onSnapshot, 
  doc, updateDoc, serverTimestamp, runTransaction, getDoc 
} from 'firebase/firestore';
import { auth, db, loginEmailPassword, registerUser, logout } from './firebase';
import { 
  Video, LogOut, PlusCircle, DollarSign, Users, CheckCircle, 
  XCircle, Clock, Briefcase, TrendingUp, Wallet, Search, AlertCircle 
} from 'lucide-react';

// --- CONTEXTO DE AUTENTICAÇÃO ---
const AuthContext = createContext();

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // Observer em tempo real para o saldo atualizar na hora
        const unsubDoc = onSnapshot(doc(db, "users", currentUser.uid), (docSnap) => {
           if (docSnap.exists()) {
             setUserData(docSnap.data());
           }
           setLoading(false);
        });
        return () => unsubDoc();
      } else {
        setUserData(null);
        setLoading(false);
      }
    });
    return unsubscribe;
  }, []);

  return (
    <AuthContext.Provider value={{ user, userData, loading }}>
      {!loading ? children : (
        <div className="h-screen flex items-center justify-center bg-gray-900 text-white gap-3">
           <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
           <p>Carregando Marketplace...</p>
        </div>
      )}
    </AuthContext.Provider>
  );
};
const useAuth = () => useContext(AuthContext);

// --- COMPONENTES VISUAIS (UI) ---

const Badge = ({ status }) => {
  const map = {
    pending: { color: 'bg-yellow-100 text-yellow-800 border-yellow-200', label: 'Em Análise' },
    approved: { color: 'bg-green-100 text-green-800 border-green-200', label: 'Aprovado' },
    rejected: { color: 'bg-red-100 text-red-800 border-red-200', label: 'Recusado' },
    active: { color: 'bg-blue-100 text-blue-800 border-blue-200', label: 'Ativa' },
    paused: { color: 'bg-gray-100 text-gray-800 border-gray-200', label: 'Pausada' }
  };
  const s = map[status] || map['pending'];
  return <span className={`px-2 py-0.5 rounded text-xs font-bold border ${s.color}`}>{s.label}</span>;
};

const Navbar = () => {
  const { userData } = useAuth();
  const isAdvertiser = userData?.role === 'advertiser';

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 h-16 flex justify-between items-center">
        <Link to="/" className="flex items-center gap-2 font-bold text-xl text-gray-800">
          <div className="bg-purple-600 text-white p-1.5 rounded-lg">
            <Video size={20} />
          </div>
          Viral<span className="text-purple-600">Market</span>
        </Link>

        <div className="flex items-center gap-6">
          {/* Menu Contextual */}
          <div className="hidden md:flex gap-6 text-sm font-medium text-gray-600">
            <Link to="/" className="hover:text-purple-600 transition">Dashboard</Link>
            {isAdvertiser ? (
               <Link to="/campaigns/new" className="hover:text-purple-600 transition">Criar Campanha</Link>
            ) : (
               <Link to="/marketplace" className="hover:text-purple-600 transition">Buscar Jobs</Link>
            )}
          </div>

          {/* Wallet & Profile */}
          <div className="flex items-center gap-4 pl-6 border-l border-gray-200">
            <div className="text-right hidden sm:block">
              <p className="text-xs text-gray-400 font-bold uppercase">{isAdvertiser ? 'Investimento' : 'Ganhos'}</p>
              <p className={`font-bold ${isAdvertiser ? 'text-gray-800' : 'text-green-600'}`}>
                R$ {userData?.balance?.toFixed(2) || '0.00'}
              </p>
            </div>
            <button onClick={logout} className="text-gray-400 hover:text-red-500 transition">
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};

// --- FLUXO DE AUTENTICAÇÃO ---

const AuthPage = () => {
  const [isRegister, setIsRegister] = useState(false);
  const [role, setRole] = useState('clipper'); // clipper ou advertiser
  const [formData, setFormData] = useState({ email: '', password: '', name: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      if (isRegister) {
        await registerUser(formData.email, formData.password, formData.name, role);
      } else {
        await loginEmailPassword(formData.email, formData.password);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full border border-gray-100">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">ViralMarket</h1>
          <p className="text-gray-500 mt-2">
            {isRegister ? 'Crie sua conta para começar.' : 'Bem-vindo de volta.'}
          </p>
        </div>

        {/* Seletor de Tipo de Conta (Só no Registro) */}
        {isRegister && (
          <div className="grid grid-cols-2 gap-3 mb-6">
            <button 
              type="button"
              onClick={() => setRole('clipper')}
              className={`p-3 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${role === 'clipper' ? 'border-purple-600 bg-purple-50 text-purple-700' : 'border-gray-200 text-gray-500 hover:border-purple-200'}`}
            >
              <Briefcase size={24} />
              <span className="font-bold text-sm">Sou Clipador</span>
            </button>
            <button 
              type="button"
              onClick={() => setRole('advertiser')}
              className={`p-3 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${role === 'advertiser' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-500 hover:border-blue-200'}`}
            >
              <Users size={24} />
              <span className="font-bold text-sm">Sou Influencer</span>
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegister && (
            <input 
              type="text" placeholder="Seu Nome" required
              className="w-full bg-gray-50 border border-gray-200 rounded-lg p-3 outline-none focus:ring-2 focus:ring-purple-500"
              value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})}
            />
          )}
          <input 
            type="email" placeholder="Email" required
            className="w-full bg-gray-50 border border-gray-200 rounded-lg p-3 outline-none focus:ring-2 focus:ring-purple-500"
            value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})}
          />
          <input 
            type="password" placeholder="Senha" required
            className="w-full bg-gray-50 border border-gray-200 rounded-lg p-3 outline-none focus:ring-2 focus:ring-purple-500"
            value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})}
          />
          
          {error && <p className="text-red-500 text-sm text-center">{error}</p>}
          
          <button disabled={loading} className="w-full bg-gray-900 text-white font-bold py-3 rounded-lg hover:bg-black transition disabled:opacity-50">
            {loading ? 'Processando...' : (isRegister ? 'Criar Conta' : 'Entrar')}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-500">
          {isRegister ? 'Já tem conta?' : 'Novo por aqui?'} 
          <button onClick={() => setIsRegister(!isRegister)} className="ml-1 text-purple-600 font-bold hover:underline">
            {isRegister ? 'Faça Login' : 'Cadastre-se'}
          </button>
        </p>
      </div>
    </div>
  );
};

// --- ÁREA DO ANUNCIANTE (INFLUENCER) ---

const CreateCampaign = () => {
  const { user, userData } = useAuth();
  const [form, setForm] = useState({ title: '', rpm: '', budget: '', rules: '' });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (userData.balance < Number(form.budget)) {
      return alert("Saldo insuficiente na carteira para criar este budget!");
    }
    
    await addDoc(collection(db, "campaigns"), {
      advertiserId: user.uid,
      advertiserName: userData.displayName,
      title: form.title,
      rpm: Number(form.rpm),
      budgetTotal: Number(form.budget),
      budgetSpent: 0,
      rules: form.rules,
      status: 'active',
      createdAt: serverTimestamp()
    });
    alert("Campanha criada! Os clipadores já podem vê-la.");
    window.location.href = "/";
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6 flex items-center gap-2"><PlusCircle /> Nova Campanha</h1>
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-bold text-gray-700">Título da Campanha</label>
            <input type="text" required placeholder="Ex: Lançamento Curso Python" className="w-full border p-2 rounded mt-1" 
              value={form.title} onChange={e => setForm({...form, title: e.target.value})} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-bold text-gray-700">RPM (R$ por 1k views)</label>
              <input type="number" required placeholder="10.00" className="w-full border p-2 rounded mt-1" 
                value={form.rpm} onChange={e => setForm({...form, rpm: e.target.value})} />
            </div>
            <div>
              <label className="text-sm font-bold text-gray-700">Orçamento Total (R$)</label>
              <input type="number" required placeholder="1000.00" className="w-full border p-2 rounded mt-1" 
                value={form.budget} onChange={e => setForm({...form, budget: e.target.value})} />
            </div>
          </div>
          <div>
            <label className="text-sm font-bold text-gray-700">Regras & Hashtags</label>
            <textarea required rows="4" placeholder="Use #PythonMaster. Proibido conteúdo ofensivo..." className="w-full border p-2 rounded mt-1"
              value={form.rules} onChange={e => setForm({...form, rules: e.target.value})} />
          </div>
          <button className="w-full bg-purple-600 text-white font-bold py-3 rounded hover:bg-purple-700">Publicar Campanha</button>
        </form>
      </div>
    </div>
  );
};

const AdvertiserDashboard = () => {
  const { user } = useAuth();
  const [campaigns, setCampaigns] = useState([]);
  const [submissions, setSubmissions] = useState([]);

  useEffect(() => {
    // Busca campanhas do usuário
    const q1 = query(collection(db, "campaigns"), where("advertiserId", "==", user.uid));
    onSnapshot(q1, snap => setCampaigns(snap.docs.map(d => ({id: d.id, ...d.data()}))));

    // Busca submissões pendentes para as campanhas dele
    // Nota: Em produção, faríamos uma query mais complexa ou cloud functions, aqui filtro no cliente por simplicidade
    const q2 = query(collection(db, "submissions"), where("status", "==", "pending"));
    onSnapshot(q2, snap => {
        const subs = snap.docs.map(d => ({id: d.id, ...d.data()}));
        // Filtra só as que pertencem a mim (já que não tenho index composto complexo aqui)
        // Idealmente: where("advertiserId", "==", user.uid)
        setSubmissions(subs.filter(s => s.advertiserId === user.uid));
    });
  }, [user]);

  // AÇÃO DE APROVAÇÃO
  const handleApprove = async (sub) => {
    const realViews = prompt("Confirme as views auditadas no link:", sub.claimedViews);
    if(!realViews) return;

    const cost = (parseInt(realViews) / 1000) * sub.rpmSnapshot;

    try {
        await runTransaction(db, async (t) => {
            // 1. Pega dados atualizados do Anunciante e Clipador
            const advertiserRef = doc(db, "users", user.uid);
            const clipperRef = doc(db, "users", sub.clipperId);
            const campaignRef = doc(db, "campaigns", sub.campaignId);
            const subRef = doc(db, "submissions", sub.id);

            const advDoc = await t.get(advertiserRef);
            const cmpDoc = await t.get(campaignRef);

            if (advDoc.data().balance < cost) throw new Error("Sem saldo suficiente!");
            if (cmpDoc.data().budgetSpent + cost > cmpDoc.data().budgetTotal) throw new Error("Estourou o budget da campanha!");

            // 2. Executa Transferência
            t.update(advertiserRef, { balance: advDoc.data().balance - cost });
            t.update(clipperRef, { balance: (await t.get(clipperRef)).data().balance + cost }); // assume que existe
            
            // 3. Atualiza Campanha e Submissão
            t.update(campaignRef, { budgetSpent: cmpDoc.data().budgetSpent + cost });
            t.update(subRef, { 
                status: 'approved', 
                verifiedViews: parseInt(realViews), 
                rewardAmount: cost,
                processedAt: serverTimestamp()
            });
        });
        alert("✅ Pago com sucesso!");
    } catch (e) {
        alert("Erro: " + e.message);
    }
  };

  const handleReject = async (id) => {
      const reason = prompt("Motivo:");
      if(reason) await updateDoc(doc(db, "submissions", id), { status: 'rejected', rejectionReason: reason });
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      {/* Seção 1: Pendências */}
      <div>
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><AlertCircle className="text-yellow-600"/> Envios Pendentes de Aprovação</h2>
        {submissions.length === 0 ? <p className="text-gray-400">Tudo limpo por aqui.</p> : (
            <div className="grid gap-4">
                {submissions.map(sub => (
                    <div key={sub.id} className="bg-white p-4 rounded-lg shadow-sm border border-l-4 border-l-yellow-400 flex justify-between items-center">
                        <div>
                            <p className="font-bold text-gray-800">{sub.campaignTitle}</p>
                            <p className="text-sm text-gray-500">Clipador: {sub.clipperName}</p>
                            <a href={sub.videoLink} target="_blank" className="text-blue-600 text-sm hover:underline">{sub.videoLink}</a>
                            <p className="text-xs font-mono mt-1">Declarado: {sub.claimedViews} views</p>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => handleReject(sub.id)} className="px-3 py-1 bg-red-100 text-red-700 rounded text-sm font-bold">Recusar</button>
                            <button onClick={() => handleApprove(sub)} className="px-3 py-1 bg-green-600 text-white rounded text-sm font-bold shadow">Pagar</button>
                        </div>
                    </div>
                ))}
            </div>
        )}
      </div>

      {/* Seção 2: Minhas Campanhas */}
      <div>
        <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-800">Minhas Campanhas</h2>
            <Link to="/campaigns/new" className="text-purple-600 font-bold hover:underline">+ Nova</Link>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {campaigns.map(c => (
                <div key={c.id} className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                    <div className="flex justify-between items-start mb-2">
                        <h3 className="font-bold text-lg">{c.title}</h3>
                        <Badge status={c.status} />
                    </div>
                    <div className="text-sm text-gray-500 mb-4 h-10 overflow-hidden">{c.rules}</div>
                    <div className="flex justify-between text-sm mb-2">
                        <span>Gasto: <b>R$ {c.budgetSpent?.toFixed(2)}</b></span>
                        <span>Total: <b>R$ {c.budgetTotal}</b></span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                        <div className="bg-purple-600 h-2 rounded-full" style={{width: `${(c.budgetSpent/c.budgetTotal)*100}%`}}></div>
                    </div>
                </div>
            ))}
        </div>
      </div>
    </div>
  );
};

// --- ÁREA DO CLIPADOR (FREELANCER) ---

const ClipperMarketplace = () => {
  const [campaigns, setCampaigns] = useState([]);
  const [modalOpen, setModalOpen] = useState(null); // ID da campanha selecionada
  const { user, userData } = useAuth();
  
  // States do formulário de envio
  const [link, setLink] = useState('');
  const [views, setViews] = useState('');

  useEffect(() => {
    const q = query(collection(db, "campaigns"), where("status", "==", "active"));
    onSnapshot(q, snap => setCampaigns(snap.docs.map(d => ({id: d.id, ...d.data()}))));
  }, []);

  const handleSubmitWork = async (campaign) => {
    if(!link || !views) return;
    try {
        await addDoc(collection(db, "submissions"), {
            campaignId: campaign.id,
            campaignTitle: campaign.title,
            advertiserId: campaign.advertiserId,
            clipperId: user.uid,
            clipperName: userData.displayName,
            videoLink: link,
            claimedViews: Number(views),
            rpmSnapshot: campaign.rpm, // Salva o valor do RPM no momento do envio
            status: 'pending',
            createdAt: serverTimestamp()
        });
        alert("Enviado com sucesso!");
        setModalOpen(null); setLink(''); setViews('');
    } catch(e) {
        alert("Erro: " + e.message);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2">Mural de Oportunidades</h1>
        <p className="text-gray-500">Escolha uma campanha, faça o corte e ganhe por view.</p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {campaigns.map(c => (
            <div key={c.id} className="bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition flex flex-col">
                <div className="p-6 flex-1">
                    <div className="flex items-center gap-2 mb-3">
                        <div className="bg-purple-100 text-purple-700 p-2 rounded-lg"><Video size={20}/></div>
                        <div>
                            <h3 className="font-bold text-gray-900 leading-tight">{c.title}</h3>
                            <p className="text-xs text-gray-500">por {c.advertiserName}</p>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-2 mb-4 bg-green-50 text-green-800 px-3 py-2 rounded-lg w-fit">
                        <TrendingUp size={16}/>
                        <span className="font-bold">R$ {c.rpm.toFixed(2)}</span>
                        <span className="text-xs opacity-75">/ 1k views</span>
                    </div>

                    <p className="text-sm text-gray-600 mb-4 line-clamp-3">{c.rules}</p>
                </div>
                
                <div className="p-4 border-t border-gray-100 bg-gray-50 rounded-b-xl">
                    <button 
                        onClick={() => setModalOpen(c)}
                        className="w-full bg-black text-white font-bold py-2 rounded-lg hover:bg-gray-800 transition"
                    >
                        Enviar Corte
                    </button>
                </div>
            </div>
        ))}
      </div>

      {/* Modal de Envio */}
      {modalOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-xl p-6 max-w-md w-full">
                  <h3 className="font-bold text-lg mb-4">Enviar para: {modalOpen.title}</h3>
                  <div className="space-y-4">
                      <div>
                          <label className="text-xs font-bold uppercase text-gray-500">Link da Publicação</label>
                          <input type="url" className="w-full border p-2 rounded" value={link} onChange={e=>setLink(e.target.value)} placeholder="https://tiktok.com/..." />
                      </div>
                      <div>
                          <label className="text-xs font-bold uppercase text-gray-500">Views Atuais</label>
                          <input type="number" className="w-full border p-2 rounded" value={views} onChange={e=>setViews(e.target.value)} placeholder="10000" />
                          <p className="text-xs text-gray-400 mt-1">O valor será auditado pelo anunciante.</p>
                      </div>
                      <div className="flex gap-2 pt-2">
                          <button onClick={() => setModalOpen(null)} className="flex-1 bg-gray-200 text-gray-800 py-2 rounded font-bold">Cancelar</button>
                          <button onClick={() => handleSubmitWork(modalOpen)} className="flex-1 bg-purple-600 text-white py-2 rounded font-bold">Enviar</button>
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

const ClipperDashboard = () => {
    const { user } = useAuth();
    const [submissions, setSubmissions] = useState([]);

    useEffect(() => {
        const q = query(collection(db, "submissions"), where("clipperId", "==", user.uid), orderBy("createdAt", "desc"));
        onSnapshot(q, snap => setSubmissions(snap.docs.map(d => ({id: d.id, ...d.data()}))));
    }, [user]);

    return (
        <div className="max-w-5xl mx-auto p-6">
            <h1 className="text-2xl font-bold mb-6">Meus Jobs Enviados</h1>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 text-gray-500 border-b border-gray-200">
                        <tr>
                            <th className="p-4">Campanha</th>
                            <th className="p-4">Link</th>
                            <th className="p-4">Views</th>
                            <th className="p-4">Ganho</th>
                            <th className="p-4">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {submissions.map(sub => (
                            <tr key={sub.id} className="hover:bg-gray-50">
                                <td className="p-4 font-medium">{sub.campaignTitle}</td>
                                <td className="p-4"><a href={sub.videoLink} target="_blank" className="text-blue-600 hover:underline">Abrir</a></td>
                                <td className="p-4">{sub.claimedViews}</td>
                                <td className="p-4 font-bold text-green-600">{sub.rewardAmount ? `R$ ${sub.rewardAmount.toFixed(2)}` : '-'}</td>
                                <td className="p-4"><Badge status={sub.status}/></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {submissions.length === 0 && <p className="p-8 text-center text-gray-400">Nenhum envio ainda. Vá ao Mercado!</p>}
            </div>
        </div>
    );
};

// --- ROTEAMENTO FINAL ---

const App = () => {
  const { user, userData, loading } = useAuth();

  if (loading) return null;

  return (
    <Router>
      {!user ? (
        <AuthPage />
      ) : (
        <div className="min-h-screen bg-gray-50 font-sans text-gray-900">
          <Navbar />
          <Routes>
            {/* ROTAS DO ANUNCIANTE */}
            {userData?.role === 'advertiser' && (
                <>
                    <Route path="/" element={<AdvertiserDashboard />} />
                    <Route path="/campaigns/new" element={<CreateCampaign />} />
                </>
            )}

            {/* ROTAS DO CLIPADOR */}
            {userData?.role === 'clipper' && (
                <>
                    <Route path="/" element={<ClipperDashboard />} />
                    <Route path="/marketplace" element={<ClipperMarketplace />} />
                </>
            )}

            {/* Rota genérica para capturar 404 ou redirecionar */}
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </div>
      )}
    </Router>
  );
};

// Wrapper para fornecer o contexto
const WrappedApp = () => (
  <AuthProvider>
    <App />
  </AuthProvider>
);

export default WrappedApp;
