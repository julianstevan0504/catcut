import { useEffect, useRef, useState, lazy, Suspense } from "react";
import {
  LayoutDashboard,
  MessagesSquare,
  Bot,
  ShoppingBag,
  History,
  Settings,
  ChevronDown,
  ArrowUpRight,
  LogOut,
  Menu,
  X,
  CheckCircle2,
  CircleAlert,
  HelpCircle,
  Sparkles,
  Search,
  Moon,
  Sun,
  ShieldCheck,
  CalendarDays,
  ChefHat,
  UtensilsCrossed,
  Store,
  Headphones,
  Paintbrush,
} from "lucide-react";
import { api, post, put, useResource } from "./api";
import { AppContext } from "./context";
import { Avatar, Logo, Modal, HelpContent, Spinner } from "./components";
import { Auth } from "./pages/Auth";
const Dashboard = lazy(() =>
  import("./Restaurant").then((m) => ({ default: m.RestaurantDashboard })),
);
const RestaurantSettings = lazy(() =>
  import("./Restaurant").then((m) => ({ default: m.RestaurantSettings })),
);
const Reservations = lazy(() =>
  import("./Restaurant").then((m) => ({ default: m.Reservations })),
);
const Kitchen = lazy(() =>
  import("./Restaurant").then((m) => ({ default: m.Kitchen })),
);
const SupportPage = lazy(() =>
  import("./Support").then((m) => ({ default: m.SupportPage })),
);
const PlatformPage = lazy(() =>
  import("./Support").then((m) => ({ default: m.PlatformPage })),
);
const RestaurantDirectory = lazy(() =>
  import("./Directory").then((m) => ({ default: m.RestaurantDirectory })),
);
const StorefrontBuilder = lazy(() =>
  import("./StorefrontBuilder").then((m) => ({ default: m.StorefrontBuilder })),
);
const Inbox = lazy(() =>
  import("./pages/Inbox").then((m) => ({ default: m.Inbox })),
);
const Assistant = lazy(() =>
  import("./pages/Assistant").then((m) => ({ default: m.Assistant })),
);
const Products = lazy(() =>
  import("./pages/Store").then((m) => ({ default: m.Products })),
);
const Orders = lazy(() =>
  import("./pages/Store").then((m) => ({ default: m.Orders })),
);
const ActivityLog = lazy(() =>
  import("./pages/Store").then((m) => ({ default: m.ActivityLog })),
);
const SettingsPage = lazy(() =>
  import("./pages/Settings").then((m) => ({ default: m.SettingsPage })),
);
import { OrderNotifications } from "./OrderNotifications";
import { downloadCodes } from "./recoveryCodes";
import { QuickSearch } from "./Workbench";
import type { Conversation, Page, Session } from "./types";

const navigation = [
  {
    id: "overview",
    label: "Resumen",
    icon: LayoutDashboard,
    group: "TU ESPACIO",
  },
  { id: "inbox", label: "Conversaciones", icon: MessagesSquare },
  { id: "assistant", label: "Asistente IA", icon: Bot },
  { id: "kitchen", label: "Cocina", icon: ChefHat, group: "EL SERVICIO" },
  { id: "reservations", label: "Reservas", icon: CalendarDays },
  {
    id: "products",
    label: "Menú y fotos",
    icon: UtensilsCrossed,
    group: "TU RESTAURANTE",
  },
  { id: "restaurant", label: "Mi restaurante", icon: Store },
  { id: "storefront", label: "Mi página pública", icon: Paintbrush },
  { id: "orders", label: "Historial de pedidos", icon: ShoppingBag },
  {
    id: "activity",
    label: "Registro de actividad",
    icon: History,
    group: "GESTIÓN",
  },
  { id: "settings", label: "Configuración", icon: Settings },
  { id: "support", label: "Soporte técnico", icon: Headphones },
  { id: "platform", label: "Administración", icon: ShieldCheck },
] as const;
const currentPage = (): Page =>
  navigation.some((p) => p.id === location.hash.slice(1))
    ? (location.hash.slice(1) as Page)
    : location.pathname === "/admin" ||
        new URLSearchParams(location.search).has("admin")
      ? "platform"
      : "overview";

export default function App() {
  const [entryHash, setEntryHash] = useState(location.hash);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [connectionError, setConnectionError] = useState("");
  const [page, setPage] = useState<Page>(currentPage);
  const [conversationId, setConversationId] = useState<string>();
  const [version, setVersion] = useState(0);
  const [toast, setToast] = useState<{ text: string; error: boolean } | null>(
    null,
  );
  const [help, setHelp] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [smallScreen, setSmallScreen] = useState(
    () => matchMedia("(max-width: 780px)").matches,
  );
  const sidebar = useRef<HTMLElement>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [navigationVersion, setNavigationVersion] = useState(0);
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    try {
      return localStorage.getItem("cerca.theme") === "dark" ? "dark" : "light";
    } catch {
      return "light";
    }
  });
  useEffect(() => {
    const receive = (e: Event) => {
      const codes = (e as CustomEvent).detail;
      if (Array.isArray(codes) && codes.every((x) => typeof x === "string"))
        setRecoveryCodes(codes);
    };
    addEventListener("cerca:recovery-codes", receive);
    return () => removeEventListener("cerca:recovery-codes", receive);
  }, []);
  const refresh = () => setVersion((v) => v + 1);
  const notify = (text: string, error = false) => setToast({ text, error });
  const refreshSession = async () => {
    setSession(await api<Session>("/me"));
    refresh();
  };
  useEffect(() => {
    const media = matchMedia("(max-width: 780px)");
    const resize = () => {
      setSmallScreen(media.matches);
      if (!media.matches) setMobile(false);
    };
    media.addEventListener("change", resize);
    return () => media.removeEventListener("change", resize);
  }, []);
  useEffect(() => {
    if (!mobile) return;
    const before = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusable = () =>
      Array.from(
        sidebar.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), a[href], [tabindex="0"]',
        ) ?? [],
      ).filter((node) => node.getClientRects().length > 0);
    focusable()[0]?.focus();
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setMobile(false);
      } else if (event.key === "Tab") {
        const nodes = focusable(),
          first = nodes[0],
          last = nodes[nodes.length - 1];
        if (!first || !last) return;
        if (
          !sidebar.current?.contains(document.activeElement) ||
          (event.shiftKey
            ? document.activeElement === first
            : document.activeElement === last)
        ) {
          event.preventDefault();
          (event.shiftKey ? last : first).focus();
        }
      }
    };
    document.addEventListener("keydown", keyboard);
    return () => {
      document.removeEventListener("keydown", keyboard);
      document.body.style.overflow = previousOverflow;
      before?.focus();
    };
  }, [mobile]);
  useEffect(() => {
    api<Session>("/me")
      .then(setSession)
      .catch((e) => {
        if (e.status !== 401) setConnectionError(e.message);
      })
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    const handler = () => {
      setPage(currentPage());
      setEntryHash(location.hash);
      setMobile(false);
    };
    addEventListener("hashchange", handler);
    return () => removeEventListener("hashchange", handler);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 5500);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("cerca.theme", theme);
    } catch {
      /* Preferences can remain in memory. */
    }
  }, [theme]);
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (session) {
          setMobile(false);
          setSearchOpen((v) => !v);
        }
      }
    };
    addEventListener("keydown", listener);
    return () => removeEventListener("keydown", listener);
  }, [session]);
  useEffect(() => {
    const expired = () => {
      setSession(null);
      setMobile(false);
      setConnectionError("");
      setToast({
        text: "Tu sesión terminó. Vuelve a iniciar sesión para continuar.",
        error: false,
      });
    };
    addEventListener("cerca:session-expired", expired);
    return () => removeEventListener("cerca:session-expired", expired);
  }, []);
  useEffect(() => {
    const warning = () => {
      setSession((current) =>
        current?.offline ? { ...current, persistence: "memory" } : current,
      );
      setToast({
        text: "No se pudieron guardar los cambios en este navegador. Exporta una copia antes de cerrar la pestaña.",
        error: true,
      });
    };
    addEventListener("cerca:storage-unavailable", warning);
    return () => removeEventListener("cerca:storage-unavailable", warning);
  }, []);
  function navigate(next: Page, id?: string, skipGuard = false) {
    if (!skipGuard) {
      const event = new CustomEvent("cerca:before-navigation", {
        cancelable: true,
        detail: { proceed: () => navigate(next, id, true) },
      });
      if (!dispatchEvent(event)) return;
    }
    setConversationId(id);
    setNavigationVersion((v) => v + 1);
    setPage(next);
    location.hash = next;
    setMobile(false);
  }
  async function logout() {
    try {
      await post("/auth/logout");
      setSession(null);
      setMobile(false);
      setRecoveryCodes([]);
      location.hash = "login";
    } catch (e) {
      notify((e as Error).message, true);
    }
  }
  if (loading)
    return (
      <div className="app-loading">
        <Logo />
        <Spinner label="Preparando tu espacio..." />
      </div>
    );
  if (connectionError)
    return (
      <div className="app-loading">
        <Logo />
        <p role="alert">{connectionError}</p>
        <button className="button primary" onClick={() => location.reload()}>
          Volver a intentar
        </button>
        <a className="button secondary" href="./Cerca.html">
          Abrir demo sin servidor
        </a>
      </div>
    );
  if (!session)
    return (
      <Suspense fallback={<Spinner />}>
        {entryHash === "#login" ||
        entryHash === "#register" ||
        location.pathname === "/admin" ||
        new URLSearchParams(location.search).has("admin") ? (
          <Auth onAuthenticated={refreshSession} />
        ) : (
          <RestaurantDirectory onAuthenticated={refreshSession} />
        )}
      </Suspense>
    );
  const title = navigation.find((p) => p.id === page)?.label;
  return (
    <AppContext.Provider
      value={{ session, version, refresh, refreshSession, navigate, notify }}
    >
      <div className={`app-shell ${mobile ? "mobile-open" : ""}`}>
        <a
          className="app-skip-link"
          href="#contenido-principal"
          onClick={(event) => {
            event.preventDefault();
            document.getElementById("contenido-principal")?.focus();
          }}
        >
          Ir al contenido principal
        </a>
        {mobile && (
          <button
            className="sidebar-overlay"
            aria-label="Cerrar menú"
            tabIndex={-1}
            onClick={() => setMobile(false)}
          />
        )}
        <aside
          className="sidebar"
          id="restaurant-navigation"
          ref={sidebar}
          role={mobile ? "dialog" : undefined}
          aria-modal={mobile || undefined}
          aria-label="Menú del restaurante"
          inert={smallScreen && !mobile}
        >
          <div className="sidebar-logo">
            <Logo />
            <button
              className="icon-button mobile-close"
              aria-label="Cerrar menú"
              onClick={() => setMobile(false)}
            >
              <X size={19} />
            </button>
          </div>
          <button
            className="workspace-picker"
            onClick={() => navigate("settings")}
          >
            <span className="store-avatar">
              {session.workspace.name[0]?.toUpperCase()}
            </span>
            <span>
              <strong>{session.workspace.name}</strong>
              <small>Tu restaurante</small>
            </span>
            <ChevronDown size={15} />
          </button>
          <nav aria-label="Navegación principal">
            {navigation
              .filter((item) => item.id !== "platform" || session.platformAdmin)
              .map((item) => (
                <div key={item.id}>
                  {"group" in item && (
                    <div className="nav-group">{item.group}</div>
                  )}
                  <button
                    className={`nav-item ${page === item.id ? "active" : ""}`}
                    aria-current={page === item.id ? "page" : undefined}
                    onClick={() => navigate(item.id)}
                  >
                    <item.icon size={19} strokeWidth={1.7} />
                    <span>{item.label}</span>
                    {item.id === "inbox" && (
                      <InboxCounter version={version} />
                    )}{" "}
                    {page === item.id && <span className="nav-active-dot" />}
                  </button>
                </div>
              ))}
          </nav>
          <div className="sidebar-bottom">
            <div className="sidebar-tip">
              <span className="tip-icon">
                <Sparkles size={19} />
              </span>
              <h4>
                Menos tareas.
                <br />
                Más conversaciones.
              </h4>
              <p>Tu asistente se ocupa de las preguntas de siempre.</p>
              <button onClick={() => navigate("assistant")}>
                Hazlo tuyo <ArrowUpRight size={15} />
              </button>
            </div>
            <button
              className="help-link"
              onClick={() => {
                setMobile(false);
                setHelp(true);
              }}
            >
              <HelpCircle size={18} /> Una mano para empezar{" "}
              <ArrowUpRight size={14} />
            </button>
            <div className="user-profile">
              <Avatar name={session.user.name} size="small" />
              <span>
                <strong>{session.user.name}</strong>
                <small>
                  {session.demo ? "Cuenta de demostración" : "Administración"}
                </small>
              </span>
              <button
                className="icon-button"
                title="Cerrar sesión"
                aria-label="Cerrar sesión"
                onClick={() => void logout()}
              >
                <LogOut size={17} />
              </button>
            </div>
          </div>
        </aside>
        <div className="main-shell" inert={mobile && smallScreen}>
          <header className="topbar">
            <div className="breadcrumb">
              <button
                className="icon-button menu-button"
                aria-label="Abrir menú"
                aria-expanded={mobile}
                aria-controls="restaurant-navigation"
                onClick={() => setMobile(true)}
              >
                <Menu size={21} />
              </button>
              <span>Tu espacio</span>
              <span className="breadcrumb-divider">/</span>
              <strong>{title}</strong>
            </div>
            <div className="topbar-actions">
              <button
                className="global-search-trigger"
                onClick={() => setSearchOpen(true)}
              >
                <Search size={17} />
                <span>Buscar en tu tienda</span>
                <kbd>
                  {navigator.platform.toLowerCase().includes("mac")
                    ? "⌘ K"
                    : "Ctrl K"}
                </kbd>
              </button>
              {session.demo && <span className="demo-badge">Modo demo</span>}
              <button
                className={`assistant-status ${session.settings.active ? "" : "paused"}`}
                title="Cambiar estado del asistente"
                onClick={async () => {
                  try {
                    await put("/settings", {
                      active: !session.settings.active,
                    });
                    await refreshSession();
                    notify(
                      session.settings.active
                        ? "Asistente pausado."
                        : "Asistente activado.",
                    );
                  } catch (e) {
                    notify((e as Error).message, true);
                  }
                }}
              >
                <span className="status-dot" />
                {session.settings.active
                  ? "Asistente activo"
                  : "Asistente pausado"}
                <ChevronDown size={13} />
              </button>
              <OrderNotifications />
              <button
                className="icon-button theme-toggle"
                aria-label={
                  theme === "light"
                    ? "Activar modo oscuro"
                    : "Activar modo claro"
                }
                title={theme === "light" ? "Modo oscuro" : "Modo claro"}
                onClick={() =>
                  setTheme((t) => (t === "light" ? "dark" : "light"))
                }
              >
                {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
              </button>
              <Avatar name={session.user.name} size="small" />
            </div>
          </header>
          {session.offline && (
            <div className="offline-banner">
              <span>
                <ShieldCheck size={16} />
                <strong>Demo interactiva · sin instalación</strong>
                <span>
                  {session.persistence === "memory"
                    ? "Este navegador no permite guardar los cambios al cerrar."
                    : "Tus pruebas se guardan en este navegador. No se envían mensajes reales."}
                </span>
              </span>
              <button onClick={() => setHelp(true)}>
                Cómo usar la versión real <ArrowUpRight size={13} />
              </button>
            </div>
          )}
          {session.offline && session.persistence === "memory" && (
            <div className="storage-warning" role="alert">
              <CircleAlert size={18} />
              <span>
                <strong>
                  No se pudieron guardar los cambios en este navegador.
                </strong>{" "}
                Se mantendrán en esta pestaña. Exporta una copia en
                Configuración → Datos y seguridad antes de cerrar.
              </span>
              <button onClick={() => navigate("settings")}>
                Ir a mis datos <ArrowUpRight size={14} />
              </button>
            </div>
          )}
          {recoveryCodes.length > 0 && (
            <div
              className="recovery-new-account-banner"
              role="region"
              aria-label="Códigos de recuperación de tu cuenta"
            >
              <ShieldCheck size={20} />
              <span>
                <strong>
                  Tu cuenta está lista. Guarda una forma de volver.
                </strong>
                <small>
                  Descarga los códigos privados que te permitirán recuperar el
                  acceso.
                </small>
              </span>
              <button
                className="button secondary"
                onClick={() => downloadCodes(recoveryCodes)}
              >
                Descargar códigos
              </button>
              <button
                className="icon-button"
                aria-label="Cerrar aviso de recuperación"
                onClick={() => setRecoveryCodes([])}
              >
                <X size={16} />
              </button>
            </div>
          )}
          {session.businessState === "suspended" && (
            <div className="voice-error" role="alert">
              Tu restaurante está suspendido. Consulta el motivo con Soporte
              técnico.
            </div>
          )}
          <main
            id="contenido-principal"
            tabIndex={-1}
            className={`main-content page-${page}`}
            key={`${page}:${navigationVersion}`}
          >
            <Suspense fallback={<Spinner label="Cargando tu espacio…" />}>
              {page === "overview" && <Dashboard />}
              {page === "inbox" && <Inbox initialId={conversationId} />}
              {page === "assistant" && <Assistant />}
              {page === "restaurant" && <RestaurantSettings />}
              {page === "storefront" && <StorefrontBuilder />}
              {page === "reservations" && <Reservations />}
              {page === "kitchen" && <Kitchen />}
              {page === "support" && <SupportPage />}
              {page === "platform" && <PlatformPage />}
              {page === "products" && <Products initialId={conversationId} />}
              {page === "orders" && <Orders initialId={conversationId} />}
              {page === "activity" && <ActivityLog />}
              {page === "settings" && <SettingsPage />}
            </Suspense>
          </main>
          <footer className="app-footer">
            <span>Conecta. Conversa. Crece.</span>
            <span>
              Cerca <span className="footer-dot" /> Hecho para estar presente
            </span>
          </footer>
        </div>
        {toast && (
          <div
            className={`toast ${toast.error ? "error" : ""}`}
            role={toast.error ? "alert" : "status"}
          >
            {toast.error ? (
              <CircleAlert size={19} />
            ) : (
              <CheckCircle2 size={19} />
            )}
            <span>{toast.text}</span>
            <button aria-label="Cerrar aviso" onClick={() => setToast(null)}>
              <X size={16} />
            </button>
          </div>
        )}
        {help && (
          <Modal title="Bienvenido a Cerca" onClose={() => setHelp(false)}>
            <HelpContent
              onGo={() => {
                setHelp(false);
                navigate("settings");
              }}
            />
          </Modal>
        )}
        {searchOpen && <QuickSearch onClose={() => setSearchOpen(false)} />}
      </div>
    </AppContext.Provider>
  );
}
function InboxCounter({ version }: { version: number }) {
  const { data } = useResource<Conversation[]>(
    "/conversations",
    version,
    15000,
  );
  const count = data?.reduce((n, c) => n + (c.unread > 0 ? 1 : 0), 0) ?? 0;
  return count ? <span className="nav-count">{count}</span> : null;
}
