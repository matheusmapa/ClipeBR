import React, { useState, useEffect, createContext, useContext, useMemo } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { 
  collection, addDoc, query, where, orderBy, onSnapshot, 
  doc, updateDoc, serverTimestamp, runTransaction, getDoc 
} from 'firebase/firestore';
import { auth, db, loginUser, registerUser, logoutUser } from './firebase';

// Ícones (Lucide React)
import { 
  LayoutDashboard, ShoppingBag, Wallet, Settings, LogOut, 
  PlusCircle, Video, Search, Filter, AlertTriangle, CheckCircle, 
  XCircle, Clock, UploadCloud, ChevronRight, TrendingUp, Users, 
  DollarSign, FileText, Image as ImageIcon, ExternalLink, ShieldAlert
} from 'lucide-react';

/* ==================================================================================
   1. UTILITIES & CONFIG
   ================================================================================== */

const CURRENCY = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const DATE_FMT = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute:'2-digit' });

const STATUS_COLORS = {
    pending: "bg-yellow-50 text-yellow-700 border-yellow-200",
    under_review: "bg-blue-50 text-blue-700 border-blue-200",
    approved: "bg-green-50 text-green-700 border-green-200",
    rejected: "bg-red-50 text-red-700 border-red-200",
    paid: "bg-purple-50 text-purple-700 border-purple-200"
};

const STATUS_LABELS = {
    pending: "Aguardando",
    under_review: "Em Análise",
    approved: "Aprovado (A Pagar)",
    rejected: "Rejeitado",
    paid: "Pago"
};

/* ==================================================================================
   2. CONTEXTS & HOOKS
   ================================================================================== */

const AuthContext = createContext();

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // Realtime Listener for Profile (Balance updates instantly)
        const unsubDb = onSnapshot(doc(db, "users", currentUser.uid), (docSnap) => {
            if (docSnap.exists()) setProfile(docSnap.data());
        });
        return () => unsubDb();
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return unsubAuth;
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, loading }}>
      {!loading ? children : (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-white">
            <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="animate-pulse">Carregando Ecossistema...</p>
        </div>
      )}
    </AuthContext.Provider>
  );
};
const useAuth = () => useContext(AuthContext);

// Toast Notification System (Simple implementation)
const ToastContext = createContext();
const ToastProvider = ({ children }) => {
    const [toast, setToast] = useState(null);
    const showToast = (msg, type = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 4000);
    };
    return (
        <ToastContext.Provider value={showToast}>
            {children}
            {toast && (
                <div className={`fixed bottom-5 right-5 px-6 py-3 rounded-lg shadow-xl text-white font-bold z-50 animate-bounce ${toast.type === 'error' ? 'bg-red-600' : 'bg-green-600'}`}>
                    {toast.msg}
                </div>
            )}
        </ToastContext.Provider>
    );
};
const useToast = () => useContext(ToastContext);

/* ==================================================================================
   3. SHARED COMPONENTS (UI LIBRARY)
   ================================================================================== */

const Sidebar = () => {
    const { profile } = useAuth();
    const location = useLocation();
    
    const menuItems = profile?.role === 'advertiser' ? [
        { icon: LayoutDashboard, label: 'Visão Geral', path: '/' },
        { icon: PlusCircle, label: 'Criar Campanha', path: '/campaigns/new' },
        { icon: FileText, label: 'Auditoria & Envios', path: '/audit' },
        { icon: Wallet, label: 'Financeiro', path: '/wallet' },
    ] : [
        { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
        { icon: ShoppingBag, label: 'Mercado de Cortes', path: '/marketplace' },
        { icon: Video, label: 'Meus Envios', path: '/submissions' },
        { icon: Wallet, label: 'Minha Carteira', path: '/wallet' },
    ];

    return (
        <aside className="w-64 bg-white border-r border-gray-200 hidden md:flex flex-col h-screen fixed left-0 top-0 z-10">
            <div className="p-6 border-b border-gray-100">
                <h1 className="text-2xl font-black text-gray-800 flex items-center gap-2">
                    <span className="bg-purple-600 text-white p-1 rounded">VR</span> ViralReward
                </h1>
                <p className="text-xs text-gray-400 mt-1 uppercase font-bold tracking-wider">{profile?.role === 'advertiser' ? 'Advertiser Pro' : 'Clipper Studio'}</p>
            </div>
            
            <nav className="flex-1 p-4 space-y-2">
                {menuItems.map((item) => (
                    <Link 
                        key={item.path} 
                        to={item.path} 
                        className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all font-medium ${location.pathname === item.path ? 'bg-purple-50 text-purple-700 border border-purple-100' : 'text-gray-600 hover:bg-gray-50'}`}
                    >
                        <item.icon size={20} />
                        {item.label}
                    </Link>
                ))}
            </nav>

            <div className="p-4 border-t border-gray-100">
                <div className="bg-gray-900 rounded-xl p-4 text-white mb-4">
                    <p className="text-xs text-gray-400 mb-1">Saldo Disponível</p>
                    <p className="text-xl font-bold">{CURRENCY.format(profile?.balance || 0)}</p>
                </div>
                <button onClick={logoutUser} className="flex items-center gap-2 text-red-500 hover:bg-red-50 w-full p-2 rounded transition text-sm font-bold">
                    <LogOut size={16} /> Sair do Sistema
                </button>
            </div>
        </aside>
    );
};

const Modal = ({ isOpen, onClose, title, children }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto animate-fadeIn">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-2xl">
                    <h3 className="font-bold text-lg text-gray-800">{title}</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-red-500"><XCircle size={24}/></button>
                </div>
                <div className="p-6">{children}</div>
            </div>
        </div>
    );
};

/* ==================================================================================
   4. MODULES & PAGES
   ================================================================================== */

// --- AUTHENTICATION MODULE ---
const AuthPage = () => {
    const [isRegister, setIsRegister] = useState(false);
    const [role, setRole] = useState('clipper');
    const [form, setForm] = useState({ email: '', password: '', name: '', pix: '', social: '' });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { profile } = useAuth(); // Redirect if already logged in

    if (profile) return <Navigate to="/" />;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true); setError('');
        try {
            if (isRegister) {
                await registerUser(form.email, form.password, form.name, role, form.pix, form.social);
            } else {
                await loginUser(form.email, form.password);
            }
        } catch (err) {
            setError(err.message.replace('Firebase:', ''));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 to-purple-900 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl flex overflow-hidden min-h-[600px]">
                {/* Left Side: Marketing */}
                <div className="hidden md:flex flex-col justify-center p-12 w-1/2 bg-purple-600 text-white relative">
                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-20"></div>
                    <h1 className="text-4xl font-black mb-4 z-10">Monetize seus Cortes.</h1>
                    <p className="text-purple-100 text-lg z-10">A plataforma #1 para Influenciadores e Clipadores profissionais. Segurança, auditoria e pagamentos automáticos.</p>
                </div>

                {/* Right Side: Form */}
                <div className="w-full md:w-1/2 p-8 md:p-12 flex flex-col justify-center bg-white">
                    <h2 className="text-2xl font-bold text-gray-800 mb-2">{isRegister ? 'Crie sua conta' : 'Bem-vindo de volta'}</h2>
                    <p className="text-gray-500 mb-8 text-sm">Gerencie campanhas ou fature com views.</p>

                    {isRegister && (
                        <div className="flex bg-gray-100 p-1 rounded-lg mb-6">
                            <button onClick={() => setRole('clipper')} className={`flex-1 py-2 text-sm font-bold rounded-md transition ${role === 'clipper' ? 'bg-white shadow text-purple-700' : 'text-gray-500'}`}>Sou Clipador</button>
                            <button onClick={() => setRole('advertiser')} className={`flex-1 py-2 text-sm font-bold rounded-md transition ${role === 'advertiser' ? 'bg-white shadow text-blue-700' : 'text-gray-500'}`}>Sou Anunciante</button>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {isRegister && (
                            <>
                                <input type="text" placeholder="Nome Completo" required className="input-field" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
                                <div className="grid grid-cols-2 gap-4">
                                    <input type="text" placeholder="Chave PIX" required className="input-field" value={form.pix} onChange={e => setForm({...form, pix: e.target.value})} />
                                    <input type="text" placeholder="@Instagram/TikTok" required className="input-field" value={form.social} onChange={e => setForm({...form, social: e.target.value})} />
                                </div>
                            </>
                        )}
                        <input type="email" placeholder="Email Corporativo" required className="input-field" value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
                        <input type="password" placeholder="Senha" required className="input-field" value={form.password} onChange={e => setForm({...form, password: e.target.value})} />

                        {error && <div className="bg-red-100 text-red-700 p-3 rounded text-sm text-center font-medium">{error}</div>}

                        <button disabled={loading} className="w-full bg-gray-900 text-white font-bold py-3.5 rounded-lg hover:bg-black transition shadow-lg disabled:opacity-70">
                            {loading ? 'Processando...' : (isRegister ? 'Finalizar Cadastro' : 'Acessar Painel')}
                        </button>
                    </form>

                    <p className="mt-6 text-center text-sm text-gray-500">
                        {isRegister ? 'Já possui conta?' : 'Novo por aqui?'} 
                        <button onClick={() => setIsRegister(!isRegister)} className="ml-1 text-purple-600 font-bold hover:underline">
                            {isRegister ? 'Fazer Login' : 'Criar Conta Grátis'}
                        </button>
                    </p>
                </div>
            </div>
        </div>
    );
};

// --- ADVERTISER MODULE ---

const AdvertiserDashboard = () => {
    const { user } = useAuth();
    const [stats, setStats] = useState({ activeCampaigns: 0, totalSpent: 0, pendingAudits: 0 });

    useEffect(() => {
        // Mocking aggregation (Firestore needs cloud functions for real aggregation, doing client-side for MVP)
        const qCamp = query(collection(db, "campaigns"), where("advertiserId", "==", user.uid));
        const unsub = onSnapshot(qCamp, (snap) => {
            let spent = 0;
            snap.forEach(doc => spent += doc.data().budgetSpent);
            setStats(prev => ({ ...prev, activeCampaigns: snap.size, totalSpent: spent }));
        });
        
        const qSubs = query(collection(db, "submissions"), where("status", "==", "pending")); // In prod: filter by adv ID
        const unsub2 = onSnapshot(qSubs, (snap) => {
             // Client side filter due to lack of composite index in MVP
             const pending = snap.docs.filter(d => d.data().advertiserId === user.uid).length;
             setStats(prev => ({ ...prev, pendingAudits: pending }));
        });
        return () => { unsub(); unsub2(); };
    }, [user]);

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-800">Visão Geral</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
                    <div className="p-4 bg-purple-100 text-purple-600 rounded-full"><Video size={24}/></div>
                    <div>
                        <p className="text-gray-500 text-sm font-medium">Campanhas Ativas</p>
                        <p className="text-2xl font-bold text-gray-900">{stats.activeCampaigns}</p>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
                    <div className="p-4 bg-green-100 text-green-600 rounded-full"><DollarSign size={24}/></div>
                    <div>
                        <p className="text-gray-500 text-sm font-medium">Total Investido</p>
                        <p className="text-2xl font-bold text-gray-900">{CURRENCY.format(stats.totalSpent)}</p>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4 cursor-pointer hover:shadow-md transition">
                    <div className="p-4 bg-yellow-100 text-yellow-600 rounded-full"><AlertTriangle size={24}/></div>
                    <div>
                        <p className="text-gray-500 text-sm font-medium">Pendentes de Auditoria</p>
                        <p className="text-2xl font-bold text-gray-900">{stats.pendingAudits}</p>
                        <Link to="/audit" className="text-xs text-blue-600 hover:underline">Resolver Agora &rarr;</Link>
                    </div>
                </div>
            </div>
            {/* Chart placeholder could go here */}
        </div>
    );
};

const CreateCampaign = () => {
    const { user, profile } = useAuth();
    const showToast = useToast();
    const [form, setForm] = useState({ title: '', rpm: '', budget: '', rules: '', hashtag: '' });

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (profile.balance < Number(form.budget)) return showToast("Saldo insuficiente na carteira!", 'error');

        try {
            await addDoc(collection(db, "campaigns"), {
                advertiserId: user.uid,
                advertiserName: profile.displayName,
                title: form.title,
                hashtag: form.hashtag,
                rpm: Number(form.rpm),
                budgetTotal: Number(form.budget),
                budgetSpent: 0,
                rules: form.rules,
                status: 'active',
                createdAt: serverTimestamp()
            });
            showToast("Campanha lançada com sucesso!");
            setForm({ title: '', rpm: '', budget: '', rules: '', hashtag: '' });
        } catch (e) {
            showToast("Erro ao criar campanha", 'error');
        }
    };

    return (
        <div className="max-w-3xl mx-auto">
            <h1 className="text-2xl font-bold mb-6 text-gray-800">Nova Campanha</h1>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="col-span-2">
                            <label className="form-label">Título da Campanha</label>
                            <input type="text" className="input-field" placeholder="Ex: Lançamento MedImporter 2.0" value={form.title} onChange={e => setForm({...form, title: e.target.value})} required />
                        </div>
                        <div>
                            <label className="form-label">RPM (R$ por 1k views)</label>
                            <div className="relative">
                                <span className="absolute left-3 top-3 text-gray-400">R$</span>
                                <input type="number" className="input-field pl-10" placeholder="10.00" value={form.rpm} onChange={e => setForm({...form, rpm: e.target.value})} required />
                            </div>
                            <p className="text-xs text-gray-500 mt-1">Valor pago ao clipador a cada mil visualizações.</p>
                        </div>
                        <div>
                            <label className="form-label">Orçamento Total (Budget)</label>
                            <div className="relative">
                                <span className="absolute left-3 top-3 text-gray-400">R$</span>
                                <input type="number" className="input-field pl-10" placeholder="1000.00" value={form.budget} onChange={e => setForm({...form, budget: e.target.value})} required />
                            </div>
                            <p className="text-xs text-gray-500 mt-1">A campanha pausa automaticamente ao atingir este valor.</p>
                        </div>
                        <div className="col-span-2">
                            <label className="form-label">Hashtag Obrigatória</label>
                            <input type="text" className="input-field" placeholder="#MedImporter #CortesMedicina" value={form.hashtag} onChange={e => setForm({...form, hashtag: e.target.value})} required />
                        </div>
                        <div className="col-span-2">
                            <label className="form-label">Regras de Aprovação</label>
                            <textarea className="input-field h-32" placeholder="- Vídeo deve ter boa qualidade&#10;- Não pode conter palavrões&#10;- Obrigatório marcar o perfil @medimporter" value={form.rules} onChange={e => setForm({...form, rules: e.target.value})} required ></textarea>
                        </div>
                    </div>
                    <div className="flex justify-end pt-4 border-t border-gray-100">
                        <button className="bg-purple-600 text-white font-bold py-3 px-8 rounded-lg hover:bg-purple-700 shadow-lg transition">
                            Publicar e Alocar Saldo
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const AuditSubmissions = () => {
    const { user } = useAuth();
    const showToast = useToast();
    const [submissions, setSubmissions] = useState([]);
    const [selectedSub, setSelectedSub] = useState(null); // For Modal

    // Load submissions needing audit
    useEffect(() => {
        const q = query(collection(db, "submissions"), orderBy("createdAt", "desc"));
        const unsub = onSnapshot(q, (snap) => {
            // Client-side filtering for MVP simplicity
            const mySubs = snap.docs
                .map(d => ({id: d.id, ...d.data()}))
                .filter(d => d.advertiserId === user.uid && d.status !== 'pending_payment'); // Show all history or just pending? Let's show all but sort pending first
            
            setSubmissions(mySubs.sort((a,b) => (a.status === 'pending' ? -1 : 1)));
        });
        return unsub;
    }, [user]);

    const handleAction = async (action, auditData = null) => {
        if (!selectedSub) return;
        
        try {
            if (action === 'reject') {
                await updateDoc(doc(db, "submissions", selectedSub.id), {
                    status: 'rejected',
                    rejectionReason: auditData, // Reason text
                    auditedAt: serverTimestamp()
                });
                showToast("Vídeo rejeitado.", 'success');
            } else if (action === 'approve') {
                const { realViews } = auditData;
                const cost = (realViews / 1000) * selectedSub.rpmSnapshot;

                await runTransaction(db, async (t) => {
                    const advRef = doc(db, "users", user.uid);
                    const clipRef = doc(db, "users", selectedSub.clipperId);
                    const campRef = doc(db, "campaigns", selectedSub.campaignId);
                    const subRef = doc(db, "submissions", selectedSub.id);

                    const advDoc = await t.get(advRef);
                    const campDoc = await t.get(campRef);

                    // Financial Logic
                    if (advDoc.data().balance < cost) throw "Saldo insuficiente no momento.";
                    if (campDoc.data().budgetSpent + cost > campDoc.data().budgetTotal) throw "Budget da campanha estourado.";

                    // 1. Move Money
                    t.update(advRef, { balance: advDoc.data().balance - cost });
                    t.update(clipRef, { balance: (await t.get(clipRef)).data().balance + cost });

                    // 2. Register Transactions
                    const txRef = doc(collection(db, "transactions"));
                    t.set(txRef, { userId: selectedSub.clipperId, type: 'payment', amount: cost, from: user.uid, date: serverTimestamp() });
                    
                    const txDebitRef = doc(collection(db, "transactions"));
                    t.set(txDebitRef, { userId: user.uid, type: 'payment_fee', amount: -cost, to: selectedSub.clipperId, date: serverTimestamp() });

                    // 3. Update Status
                    t.update(campRef, { budgetSpent: campDoc.data().budgetSpent + cost });
                    t.update(subRef, { 
                        status: 'paid', 
                        auditedViews: realViews, 
                        rewardAmount: cost,
                        auditedAt: serverTimestamp()
                    });
                });
                showToast(`Pago R$ ${cost.toFixed(2)} ao clipador!`, 'success');
            }
            setSelectedSub(null);
        } catch (e) {
            showToast("Erro: " + e, 'error');
        }
    };

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-gray-800">Auditoria de Envios (Estilo Airtable)</h1>
            
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 font-semibold uppercase tracking-wider text-xs">
                            <tr>
                                <th className="p-4">Data</th>
                                <th className="p-4">Clipador</th>
                                <th className="p-4">Campanha</th>
                                <th className="p-4">Link / Prova</th>
                                <th className="p-4 text-right">Views Declaradas</th>
                                <th className="p-4 text-center">Status</th>
                                <th className="p-4 text-center">Ação</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {submissions.map(sub => (
                                <tr key={sub.id} className="hover:bg-gray-50 transition">
                                    <td className="p-4 text-gray-500">{sub.createdAt?.toDate().toLocaleDateString()}</td>
                                    <td className="p-4 font-medium flex flex-col">
                                        <span className="text-gray-900">{sub.clipperName}</span>
                                        <span className="text-xs text-gray-400">{sub.clipperSocial}</span>
                                    </td>
                                    <td className="p-4">{sub.campaignTitle}</td>
                                    <td className="p-4">
                                        <div className="flex gap-2">
                                            <a href={sub.videoLink} target="_blank" className="flex items-center gap-1 text-blue-600 hover:underline"><Video size={14}/> Vídeo</a>
                                            {sub.printUrl && (
                                                <a href={sub.printUrl} target="_blank" className="flex items-center gap-1 text-purple-600 hover:underline"><ImageIcon size={14}/> Print</a>
                                            )}
                                        </div>
                                    </td>
                                    <td className="p-4 text-right font-mono text-gray-700">{sub.declaredViews.toLocaleString()}</td>
                                    <td className="p-4 text-center">
                                        <span className={`px-2 py-1 rounded text-xs font-bold border ${STATUS_COLORS[sub.status]}`}>
                                            {STATUS_LABELS[sub.status]}
                                        </span>
                                    </td>
                                    <td className="p-4 text-center">
                                        {sub.status === 'pending' ? (
                                            <button onClick={() => setSelectedSub(sub)} className="bg-gray-900 text-white px-3 py-1.5 rounded text-xs font-bold hover:bg-black transition">
                                                Auditar
                                            </button>
                                        ) : (
                                            <span className="text-gray-400">-</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* AUDIT MODAL */}
            <Modal isOpen={!!selectedSub} onClose={() => setSelectedSub(null)} title="Auditar Envio">
                {selectedSub && (
                    <div className="space-y-6">
                        {/* Evidence Section */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="col-span-2 bg-yellow-50 p-3 rounded text-xs text-yellow-800 flex gap-2">
                                <ShieldAlert size={16}/>
                                <span>Verifique se o vídeo tem mais de 24h e se as hashtags estão corretas.</span>
                            </div>
                            
                            <a href={selectedSub.videoLink} target="_blank" className="block p-4 bg-gray-50 rounded border text-center hover:bg-gray-100">
                                <Video className="mx-auto mb-2 text-blue-600"/>
                                <span className="text-blue-600 font-bold underline text-sm">Abrir Vídeo Original</span>
                            </a>
                            
                            {selectedSub.printUrl ? (
                                <div className="border rounded p-1">
                                    <img src={selectedSub.printUrl} alt="Print" className="w-full h-32 object-cover rounded cursor-pointer" onClick={() => window.open(selectedSub.printUrl)} />
                                </div>
                            ) : (
                                <div className="flex items-center justify-center border rounded bg-gray-50 text-gray-400 text-xs">Sem Print</div>
                            )}
                        </div>

                        {/* Audit Form */}
                        <div className="border-t pt-4">
                            <label className="text-sm font-bold text-gray-700 block mb-2">Visualizações Reais (Auditadas)</label>
                            <input type="number" id="auditViews" className="w-full border-2 border-purple-100 p-3 rounded-lg text-lg font-bold text-purple-700 focus:outline-none focus:border-purple-500" placeholder={selectedSub.declaredViews} />
                            <p className="text-xs text-gray-500 mt-1">RPM contratado: <b>R$ {selectedSub.rpmSnapshot.toFixed(2)}</b></p>
                        </div>

                        <div className="flex gap-3">
                            <button 
                                onClick={() => {
                                    const reason = prompt("Motivo da rejeição (Ex: Fraude, link quebrado):");
                                    if(reason) handleAction('reject', reason);
                                }}
                                className="flex-1 border border-red-200 text-red-600 py-3 rounded-lg font-bold hover:bg-red-50"
                            >
                                Rejeitar
                            </button>
                            <button 
                                onClick={() => {
                                    const val = document.getElementById('auditViews').value;
                                    if(!val) return alert("Digite as views auditadas!");
                                    handleAction('approve', { realViews: parseInt(val) });
                                }}
                                className="flex-1 bg-green-600 text-white py-3 rounded-lg font-bold hover:bg-green-700 shadow-lg"
                            >
                                Aprovar e Pagar
                            </button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};

// --- CLIPPER MODULE ---

const Marketplace = () => {
    const { user, profile } = useAuth();
    const showToast = useToast();
    const [campaigns, setCampaigns] = useState([]);
    const [filter, setFilter] = useState('');
    const [submitModal, setSubmitModal] = useState(null);
    
    // Form State
    const [link, setLink] = useState('');
    const [views, setViews] = useState('');
    const [printFile, setPrintFile] = useState(null); // Simulated

    useEffect(() => {
        const q = query(collection(db, "campaigns"), where("status", "==", "active"));
        const unsub = onSnapshot(q, (snap) => {
            setCampaigns(snap.docs.map(d => ({id: d.id, ...d.data()})));
        });
        return unsub;
    }, []);

    const filtered = campaigns.filter(c => c.title.toLowerCase().includes(filter.toLowerCase()));

    const handleSubmit = async () => {
        if (!link || !views) return showToast("Preencha todos os campos", 'error');
        
        // Simulating Image Upload (In real app: uploadBytes to Firebase Storage -> getDownloadURL)
        const fakeUrl = printFile ? URL.createObjectURL(printFile) : null; 

        try {
            await addDoc(collection(db, "submissions"), {
                campaignId: submitModal.id,
                campaignTitle: submitModal.title,
                advertiserId: submitModal.advertiserId,
                clipperId: user.uid,
                clipperName: profile.displayName,
                clipperSocial: profile.socialHandle,
                videoLink: link,
                printUrl: fakeUrl, // Use storage URL here in production
                declaredViews: Number(views),
                rpmSnapshot: submitModal.rpm,
                status: 'pending',
                createdAt: serverTimestamp()
            });
            showToast("Trabalho enviado para auditoria!", 'success');
            setSubmitModal(null); setLink(''); setViews(''); setPrintFile(null);
        } catch(e) {
            showToast("Erro no envio", 'error');
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <h1 className="text-2xl font-bold text-gray-800">Mural de Oportunidades</h1>
                <div className="relative w-full md:w-64">
                    <Search className="absolute left-3 top-3 text-gray-400" size={18}/>
                    <input type="text" placeholder="Buscar campanhas..." className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500" value={filter} onChange={e => setFilter(e.target.value)} />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filtered.map(camp => (
                    <div key={camp.id} className="bg-white rounded-xl border border-gray-200 hover:shadow-lg transition flex flex-col overflow-hidden group">
                        <div className="p-6 flex-1">
                            <div className="flex justify-between items-start mb-4">
                                <div className="bg-purple-100 text-purple-700 p-2 rounded-lg font-bold text-xs uppercase tracking-wide">
                                    {camp.hashtag}
                                </div>
                                <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-1 rounded-full">
                                    Ativa
                                </span>
                            </div>
                            <h3 className="font-bold text-lg text-gray-900 mb-1">{camp.title}</h3>
                            <p className="text-sm text-gray-500 mb-4">por {camp.advertiserName}</p>
                            
                            <div className="flex items-center gap-2 mb-4 bg-gray-50 p-3 rounded-lg">
                                <TrendingUp className="text-green-600" size={20}/>
                                <div>
                                    <p className="text-xs text-gray-400 uppercase font-bold">Paga por 1k views</p>
                                    <p className="text-lg font-black text-green-600">{CURRENCY.format(camp.rpm)}</p>
                                </div>
                            </div>

                            <p className="text-sm text-gray-600 line-clamp-3 bg-yellow-50 p-3 rounded border border-yellow-100 text-xs">
                                ⚠️ Regras: {camp.rules}
                            </p>
                        </div>
                        <div className="p-4 bg-gray-50 border-t border-gray-100">
                            <button 
                                onClick={() => setSubmitModal(camp)}
                                className="w-full bg-gray-900 text-white font-bold py-3 rounded-lg hover:bg-purple-600 transition flex items-center justify-center gap-2"
                            >
                                <UploadCloud size={18}/> Enviar Corte
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* SUBMIT MODAL */}
            <Modal isOpen={!!submitModal} onClose={() => setSubmitModal(null)} title={`Enviar para: ${submitModal?.title}`}>
                <div className="space-y-4">
                    <div>
                        <label className="form-label">Link da Publicação (TikTok/Reels/Shorts)</label>
                        <input type="url" className="input-field" placeholder="https://..." value={link} onChange={e => setLink(e.target.value)} />
                    </div>
                    <div>
                        <label className="form-label">Visualizações Atuais</label>
                        <input type="number" className="input-field" placeholder="0" value={views} onChange={e => setViews(e.target.value)} />
                    </div>
                    <div>
                        <label className="form-label">Print das Estatísticas (Prova)</label>
                        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:bg-gray-50 transition relative">
                            <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={e => setPrintFile(e.target.files[0])} accept="image/*" />
                            <div className="text-gray-400">
                                {printFile ? (
                                    <span className="text-purple-600 font-bold">{printFile.name}</span>
                                ) : (
                                    <>
                                        <ImageIcon className="mx-auto mb-2"/>
                                        <span className="text-sm">Clique para enviar print</span>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="pt-4">
                         <div className="bg-blue-50 text-blue-800 p-3 rounded text-xs mb-4 flex gap-2">
                             <Clock size={16}/>
                             O vídeo deve ter sido postado há pelo menos 24 horas.
                         </div>
                         <button onClick={handleSubmit} className="w-full bg-purple-600 text-white font-bold py-3 rounded-lg hover:bg-purple-700">Enviar para Análise</button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

// --- WALLET MODULE ---

const WalletPage = () => {
    const { user, profile } = useAuth();
    const [transactions, setTransactions] = useState([]);

    useEffect(() => {
        // Query transactions related to this user
        const q = query(collection(db, "transactions"), where("userId", "==", user.uid), orderBy("date", "desc"));
        const unsub = onSnapshot(q, snap => {
            setTransactions(snap.docs.map(d => ({id: d.id, ...d.data()})));
        });
        return unsub;
    }, [user]);

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <h1 className="text-2xl font-bold text-gray-800">Minha Carteira</h1>
            
            {/* Balance Card */}
            <div className="bg-gradient-to-r from-gray-900 to-gray-800 rounded-2xl p-8 text-white shadow-xl flex justify-between items-center">
                <div>
                    <p className="text-gray-400 font-medium mb-1">Saldo Total</p>
                    <h2 className="text-4xl font-black tracking-tight">{CURRENCY.format(profile?.balance || 0)}</h2>
                    <p className="text-sm text-gray-500 mt-2 font-mono">{profile?.pixKey ? `PIX: ${profile.pixKey}` : 'Sem chave PIX cadastrada'}</p>
                </div>
                <div className="bg-white/10 p-4 rounded-xl backdrop-blur-sm">
                    <Wallet size={40} className="text-purple-400"/>
                </div>
            </div>

            {/* History Table */}
            <div>
                <h3 className="font-bold text-gray-700 mb-4">Histórico de Transações</h3>
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 text-gray-500 font-semibold border-b border-gray-200">
                            <tr>
                                <th className="p-4">Data</th>
                                <th className="p-4">Descrição</th>
                                <th className="p-4 text-right">Valor</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {transactions.map(tx => (
                                <tr key={tx.id}>
                                    <td className="p-4 text-gray-500">{tx.date?.toDate().toLocaleString()}</td>
                                    <td className="p-4 font-medium capitalize">
                                        {tx.type === 'payment' ? 'Recebimento por Corte' : 
                                         tx.type === 'payment_fee' ? 'Pagamento de Campanha' : 
                                         tx.type === 'deposit' ? 'Depósito Inicial' : tx.type}
                                    </td>
                                    <td className={`p-4 text-right font-bold ${tx.amount > 0 ? 'text-green-600' : 'text-gray-900'}`}>
                                        {tx.amount > 0 ? '+' : ''}{CURRENCY.format(tx.amount)}
                                    </td>
                                </tr>
                            ))}
                            {transactions.length === 0 && (
                                <tr>
                                    <td colSpan="3" className="p-8 text-center text-gray-400">Nenhuma movimentação ainda.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

/* ==================================================================================
   5. ROUTER & APP LAYOUT
   ================================================================================== */

const AppLayout = () => {
    const { profile } = useAuth();
    if (!profile) return <Navigate to="/auth" />;

    return (
        <div className="flex min-h-screen bg-gray-50 font-sans">
            <Sidebar />
            <main className="flex-1 md:ml-64 p-4 md:p-8 overflow-y-auto">
                <div className="max-w-7xl mx-auto animate-fadeIn">
                    <Routes>
                        {/* Rotas Dinâmicas baseadas na Role */}
                        <Route path="/" element={profile.role === 'advertiser' ? <AdvertiserDashboard /> : <div className="text-center py-20"><h1 className="text-3xl font-bold">Bem vindo, Clipador!</h1><p className="text-gray-500 mb-6">Vá ao mercado para começar.</p><Link to="/marketplace" className="btn-primary">Ir ao Mercado</Link></div>} />
                        
                        {/* Advertiser Routes */}
                        {profile.role === 'advertiser' && (
                            <>
                                <Route path="/campaigns/new" element={<CreateCampaign />} />
                                <Route path="/audit" element={<AuditSubmissions />} />
                            </>
                        )}

                        {/* Clipper Routes */}
                        {profile.role === 'clipper' && (
                            <>
                                <Route path="/marketplace" element={<Marketplace />} />
                                <Route path="/submissions" element={<div className="p-4">Histórico de Envios (Implementar Reuse de Tabela)</div>} />
                            </>
                        )}

                        {/* Shared Routes */}
                        <Route path="/wallet" element={<WalletPage />} />
                        <Route path="*" element={<Navigate to="/" />} />
                    </Routes>
                </div>
            </main>
        </div>
    );
};

const App = () => {
  return (
    <Router>
      <AuthProvider>
        <ToastProvider>
            <Routes>
                <Route path="/auth" element={<AuthPage />} />
                <Route path="/*" element={<AppLayout />} />
            </Routes>
        </ToastProvider>
      </AuthProvider>
    </Router>
  );
};

// CSS in JS Utility classes (Simulated tailwind injection for clarity if missing)
const styles = `
    .input-field { @apply w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all; }
    .form-label { @apply block text-sm font-bold text-gray-700 mb-1; }
    .btn-primary { @apply bg-purple-600 text-white font-bold py-2 px-4 rounded hover:bg-purple-700 transition; }
`;

export default App;
