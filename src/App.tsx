import { useEffect, useState } from 'react';
import { LayoutDashboard, MessagesSquare, Bot, Package, ShoppingBag, History, Settings, ChevronDown, ArrowUpRight, LogOut, Bell, Menu, X, CheckCircle2, CircleAlert, HelpCircle, Sparkles, ArrowRight } from 'lucide-react';
import { api, post, put, useResource, relativeTime } from './api';
import { AppContext } from './context';
import { Avatar, Logo, Modal, HelpContent, Spinner } from './components';
import { Auth } from './pages/Auth';
import { Dashboard } from './pages/Dashboard';
import { Inbox } from './pages/Inbox';
import { Assistant } from './pages/Assistant';
import { Products, Orders, ActivityLog } from './pages/Store';
import { SettingsPage } from './pages/Settings';
import type { Activity, Conversation, Page, Session } from './types';

const navigation = [
  { id: 'overview', label: 'Resumen', icon: LayoutDashboard, group: 'TU ESPACIO' },
  { id: 'inbox', label: 'Conversaciones', icon: MessagesSquare },
  { id: 'assistant', label: 'Asistente IA', icon: Bot },
  { id: 'products', label: 'Productos', icon: Package, group: 'TU TIENDA' },
  { id: 'orders', label: 'Pedidos', icon: ShoppingBag },
  { id: 'activity', label: 'Registro de actividad', icon: History, group: 'GESTIÓN' },
  { id: 'settings', label: 'Configuración', icon: Settings },
] as const;
const currentPage = (): Page => navigation.some(p => p.id === location.hash.slice(1)) ? location.hash.slice(1) as Page : 'overview';

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [connectionError, setConnectionError] = useState('');
  const [page, setPage] = useState<Page>(currentPage);
  const [conversationId, setConversationId] = useState<string>();
  const [version, setVersion] = useState(0);
  const [toast, setToast] = useState<{ text: string; error: boolean } | null>(null);
  const [help, setHelp] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [notifications, setNotifications] = useState(false);
  const refresh = () => setVersion(v => v + 1);
  const notify = (text: string, error = false) => setToast({ text, error });
  const refreshSession = async () => { setSession(await api<Session>('/me')); refresh(); };
  useEffect(() => {
    api<Session>('/me').then(setSession).catch(e => { if (e.status !== 401) setConnectionError(e.message); }).finally(() => setLoading(false));
  }, []);
  useEffect(() => { const handler = () => setPage(currentPage()); addEventListener('hashchange', handler); return () => removeEventListener('hashchange', handler); }, []);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(null), 5500); return () => clearTimeout(timer); }, [toast]);
  function navigate(next: Page, id?: string) { if (id) setConversationId(id); setPage(next); location.hash = next; setMobile(false); setNotifications(false); }
  async function logout() {
    try { await post('/auth/logout'); setSession(null); location.hash = 'login'; }
    catch (e) { notify((e as Error).message, true); }
  }
  if (loading) return <div className="app-loading"><Logo/><Spinner label="Preparando tu espacio..."/></div>;
  if (connectionError) return <div className="app-loading"><Logo/><p role="alert">{connectionError}</p><button className="button primary" onClick={() => location.reload()}>Volver a intentar</button></div>;
  if (!session) return <Auth onAuthenticated={refreshSession}/>;
  const title = navigation.find(p => p.id === page)?.label;
  return <AppContext.Provider value={{ session, version, refresh, refreshSession, navigate, notify }}><div className={`app-shell ${mobile ? 'mobile-open' : ''}`}>
    {mobile && <button className="sidebar-overlay" aria-label="Cerrar menú" onClick={() => setMobile(false)}/>}
    <aside className="sidebar"><div className="sidebar-logo"><Logo/><button className="icon-button mobile-close" aria-label="Cerrar menú" onClick={() => setMobile(false)}><X size={19}/></button></div>
      <button className="workspace-picker" onClick={() => navigate('settings')}><span className="store-avatar">{session.workspace.name[0]?.toUpperCase()}</span><span><strong>{session.workspace.name}</strong><small>Tu tienda online</small></span><ChevronDown size={15}/></button>
      <nav aria-label="Navegación principal">{navigation.map(item => <div key={item.id}>{'group' in item && <div className="nav-group">{item.group}</div>}<button className={`nav-item ${page === item.id ? 'active' : ''}`} onClick={() => navigate(item.id)}><item.icon size={19} strokeWidth={1.7}/><span>{item.label}</span>{item.id === 'inbox' && <InboxCounter version={version}/>} {page === item.id && <span className="nav-active-dot"/>}</button></div>)}</nav>
      <div className="sidebar-bottom"><div className="sidebar-tip"><span className="tip-icon"><Sparkles size={19}/></span><h4>Menos tareas.<br/>Más conversaciones.</h4><p>Tu asistente se ocupa de las preguntas de siempre.</p><button onClick={() => navigate('assistant')}>Hazlo tuyo <ArrowUpRight size={15}/></button></div>
      <button className="help-link" onClick={() => setHelp(true)}><HelpCircle size={18}/> Una mano para empezar <ArrowUpRight size={14}/></button>
      <div className="user-profile"><Avatar name={session.user.name} size="small"/><span><strong>{session.user.name}</strong><small>{session.demo ? 'Cuenta de demostración' : 'Administración'}</small></span><button className="icon-button" title="Cerrar sesión" aria-label="Cerrar sesión" onClick={() => void logout()}><LogOut size={17}/></button></div></div>
    </aside>
    <div className="main-shell"><header className="topbar"><div className="breadcrumb"><button className="icon-button menu-button" aria-label="Abrir menú" onClick={() => setMobile(true)}><Menu size={21}/></button><span>Tu espacio</span><span className="breadcrumb-divider">/</span><strong>{title}</strong></div><div className="topbar-actions">{session.demo && <span className="demo-badge">Modo demo</span>}<button className={`assistant-status ${session.settings.active ? '' : 'paused'}`} title="Cambiar estado del asistente" onClick={async () => { try { await put('/settings', { active: !session.settings.active }); await refreshSession(); notify(session.settings.active ? 'Asistente pausado.' : 'Asistente activado.'); } catch (e) { notify((e as Error).message, true); } }}><span className="status-dot"/>{session.settings.active ? 'Asistente activo' : 'Asistente pausado'}<ChevronDown size={13}/></button><div className="notification-wrap"><button className={`icon-button notification-button ${notifications ? 'selected' : ''}`} aria-label="Ver actividad reciente" aria-expanded={notifications} onClick={() => setNotifications(n => !n)}><Bell size={19}/><span/></button>{notifications && <NotificationPanel version={version} onAll={() => navigate('activity')}/>}</div><Avatar name={session.user.name} size="small"/></div></header>
    <main className={`main-content page-${page}`} key={page}>{page === 'overview' && <Dashboard/>}{page === 'inbox' && <Inbox initialId={conversationId}/>}{page === 'assistant' && <Assistant/>}{page === 'products' && <Products/>}{page === 'orders' && <Orders/>}{page === 'activity' && <ActivityLog/>}{page === 'settings' && <SettingsPage/>}</main>
    <footer className="app-footer"><span>Conecta. Conversa. Crece.</span><span>Cerca <span className="footer-dot"/> Hecho para estar presente</span></footer></div>
    {toast && <div className={`toast ${toast.error ? 'error' : ''}`} role={toast.error ? 'alert' : 'status'}>{toast.error ? <CircleAlert size={19}/> : <CheckCircle2 size={19}/>}<span>{toast.text}</span><button aria-label="Cerrar aviso" onClick={() => setToast(null)}><X size={16}/></button></div>}
    {help && <Modal title="Bienvenido a Cerca" onClose={() => setHelp(false)}><HelpContent onGo={() => { setHelp(false); navigate('settings'); }}/></Modal>}
  </div></AppContext.Provider>;
}
function InboxCounter({ version }: { version: number }) {
  const { data } = useResource<Conversation[]>('/conversations', version, 15000);
  const count = data?.reduce((n, c) => n + (c.unread > 0 ? 1 : 0), 0) ?? 0;
  return count ? <span className="nav-count">{count}</span> : null;
}
function NotificationPanel({ version, onAll }: { version: number; onAll: () => void }) {
  const { data, loading, error } = useResource<Activity[]>('/activities', version);
  return <div className="notification-panel"><div className="notification-title"><strong>Lo que está pasando</strong><History size={17}/></div>{loading ? <Spinner/> : error ? <p className="muted">{error}</p> : !data?.length ? <p className="muted">Todavía no hay actividad.</p> : data.slice(0, 4).map(a => <div className="notification-item" key={a.id}><span className="activity-dot"/><div><p>{a.description}</p><small>{relativeTime(a.created_at)}</small></div></div>)}<button onClick={onAll}>Ver todo el registro <ArrowRight size={15}/></button></div>;
}
