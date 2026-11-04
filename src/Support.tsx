import { useState } from "react";
import type { FormEvent } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Headphones,
  LifeBuoy,
  MessageSquare,
  Plus,
  Send,
  ShieldCheck,
  Store,
  Users,
  Wallet,
  Search,
  PauseCircle,
  PlayCircle,
  Activity,
} from "lucide-react";
import { post, put, useResource, relativeTime } from "./api";
import { useApp } from "./context";
import {
  Modal,
  PageHeading,
  Spinner,
  ErrorState,
  EmptyState,
  SaveButton,
} from "./components";
type Ticket = {
  id: string;
  subject: string;
  category: string;
  status: string;
  updated_at: string;
  restaurant?: string;
};
type TicketDetail = Ticket & {
  messages: {
    author_role: string;
    author_name: string;
    text: string;
    created_at: string;
  }[];
};
const labels: Record<string, string> = {
    open: "Abierto",
    working: "En revisión",
    closed: "Resuelto",
  },
  categories = {
    account: "Cuenta y acceso",
    orders: "Pedidos y menú",
    reservations: "Reservas",
    whatsapp: "WhatsApp y llamadas",
    billing: "Servicio y facturación",
    other: "Otra consulta",
  };
export function TicketConversation({
  ticket,
  platform = false,
  onClose,
  onUpdated,
}: {
  ticket: Ticket;
  platform?: boolean;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [version, setVersion] = useState(0),
    { data, loading, error, reload } = useResource<TicketDetail>(
      (platform ? "/platform/support/" : "/support/tickets/") + ticket.id,
      version,
      7000,
    ),
    [busy, setBusy] = useState(false),
    [text, setText] = useState(""),
    [status, setStatus] = useState("working");
  const { notify } = useApp();
  async function send(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await post(
        (platform ? "/platform/support/" : "/support/tickets/") +
          ticket.id +
          "/messages",
        { text, status },
      );
      setText("");
      setVersion((v) => v + 1);
      onUpdated();
    } catch (e) {
      notify((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={ticket.subject}
      description={
        ticket.restaurant ??
        "Conversación privada con la administración de la plataforma."
      }
      onClose={onClose}
    >
      {loading ? (
        <Spinner />
      ) : error ? (
        <ErrorState message={error} retry={reload} />
      ) : (
        <>
          <div className="support-thread">
            <span className={"restaurant-state " + (data?.status ?? "open")}>
              {labels[data?.status ?? "open"]}
            </span>
            {data?.messages.map((m, i) => (
              <article className={"support-message " + m.author_role} key={i}>
                <div>
                  <strong>
                    {m.author_role === "platform"
                      ? "Soporte de Cerca"
                      : m.author_name}
                  </strong>
                  <small>{relativeTime(m.created_at)}</small>
                </div>
                <p>{m.text}</p>
              </article>
            ))}
          </div>
          <form
            className="modal-form support-reply"
            onSubmit={(e) => void send(e)}
          >
            <label className="field-label">
              {platform ? "Respuesta de soporte" : "Mensaje para soporte"}
              <textarea
                required
                rows={3}
                maxLength={5000}
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
            </label>
            {platform && (
              <label className="field-label">
                Estado de la solicitud
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  {Object.entries(labels).map(([id, label]) => (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <button className="button primary" disabled={busy || !text.trim()}>
              <Send size={15} /> Enviar mensaje
            </button>
          </form>
        </>
      )}
    </Modal>
  );
}
export function SupportPage() {
  const { version, refresh, notify, navigate } = useApp(),
    { data, loading, error, reload } = useResource<Ticket[]>(
      "/support/tickets",
      version,
      15000,
    );
  const [adding, setAdding] = useState(false),
    [selected, setSelected] = useState<Ticket | null>(null),
    [busy, setBusy] = useState(false);
  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    try {
      await post(
        "/support/tickets",
        Object.fromEntries(new FormData(e.currentTarget)),
      );
      setAdding(false);
      refresh();
      notify(
        "Solicitud registrada. La administración puede verla y responder en este apartado.",
      );
    } catch (e) {
      notify((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="CUIDAMOS LA EXPERIENCIA COMPLETA"
        title="Un lugar para resolverlo."
        subtitle="Consulta tus solicitudes y conversa con la administración de la plataforma."
        action={
          <button className="button primary" onClick={() => setAdding(true)}>
            <Plus size={16} /> Nueva solicitud
          </button>
        }
      />
      <section className="support-hero">
        <span>
          <Headphones size={36} />
        </span>
        <div>
          <h2>
            Que la tecnología acompañe
            <br />
            el buen servicio.
          </h2>
          <p>
            Describe qué pasó y qué estabas intentando hacer. El equipo que
            opera la plataforma recibirá tu consulta en su panel de soporte.
          </p>
        </div>
        <button className="button secondary" onClick={() => setAdding(true)}>
          Pedir ayuda <ArrowRight size={16} />
        </button>
      </section>
      <div className="support-shortcuts">
        {[
          {
            icon: ShieldCheck,
            title: "Acceso y recuperación",
            text: "Contraseña, sesiones y códigos de recuperación.",
            page: "settings",
          },
          {
            icon: Store,
            title: "Preparar mi restaurante",
            text: "Horarios, capacidad, servicios y menú público.",
            page: "restaurant",
          },
          {
            icon: MessageSquare,
            title: "Configurar el asistente",
            text: "Guía del negocio, voz y conversaciones.",
            page: "assistant",
          },
        ].map((x) => (
          <button
            key={x.title}
            className="card"
            onClick={() => navigate(x.page as "settings")}
          >
            <x.icon size={22} />
            <strong>{x.title}</strong>
            <p>{x.text}</p>
            <ArrowRight size={16} />
          </button>
        ))}
      </div>
      <section className="card support-tickets">
        <div className="restaurant-card-heading">
          <div>
            <span className="eyebrow">EL SEGUIMIENTO IMPORTA</span>
            <h2>Tus solicitudes.</h2>
          </div>
          <span>{data?.length ?? 0} registradas</span>
        </div>
        {loading ? (
          <Spinner />
        ) : error ? (
          <ErrorState message={error} retry={reload} />
        ) : !data?.length ? (
          <div className="restaurant-soft-empty">
            <LifeBuoy size={35} />
            <h3>Todavía no hay consultas.</h3>
            <p>
              Cuando necesites ayuda, abre una solicitud. Solo tu restaurante y
              la administración pueden verla.
            </p>
          </div>
        ) : (
          data.map((t) => (
            <button
              className="support-ticket-row"
              key={t.id}
              onClick={() => setSelected(t)}
            >
              <span className="restaurant-small-icon">
                <MessageSquare size={17} />
              </span>
              <span>
                <strong>{t.subject}</strong>
                <small>
                  {categories[t.category as keyof typeof categories]} ·{" "}
                  {relativeTime(t.updated_at)}
                </small>
              </span>
              <span className={"restaurant-state " + t.status}>
                {labels[t.status]}
              </span>
              <ArrowRight size={15} />
            </button>
          ))
        )}
      </section>
      {adding && (
        <Modal
          title="Cuéntanos qué necesitas."
          description="No incluyas contraseñas, códigos de recuperación ni credenciales de tus proveedores."
          onClose={() => setAdding(false)}
        >
          <form className="modal-form" onSubmit={(e) => void create(e)}>
            <label className="field-label">
              Asunto de la consulta
              <input name="subject" required maxLength={150} />
            </label>
            <label className="field-label">
              Tipo de consulta
              <select name="category">
                {Object.entries(categories).map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field-label">
              ¿Qué pasó y qué necesitas resolver?
              <textarea required name="text" maxLength={5000} rows={5} />
            </label>
            <button className="button primary" disabled={busy}>
              <Send size={16} /> Crear solicitud
            </button>
          </form>
        </Modal>
      )}
      {selected && (
        <TicketConversation
          ticket={selected}
          onClose={() => setSelected(null)}
          onUpdated={refresh}
        />
      )}
    </>
  );
}
type PlatformData = {
  metrics: {
    restaurants: number;
    active: number;
    suspended: number;
    openTickets: number;
    orders: number;
    reservations: number;
  };
  restaurants: {
    id: string;
    name: string;
    owner_email: string;
    status: string;
    reason: string;
    orders: number;
    reservations: number;
    images: number;
    created_at: string;
  }[];
  settings: {
    registrationOpen: boolean;
    brandName: string;
    supportEmail: string;
  };
  events: {
    action: string;
    target: string;
    details: string;
    created_at: string;
  }[];
};
export function PlatformPage() {
  const { session, version, refresh, notify } = useApp(),
    { data, loading, error, reload } = useResource<PlatformData>(
      "/platform/overview",
      version,
      15000,
    ),
    { data: tickets } = useResource<Ticket[]>(
      "/platform/support",
      version,
      15000,
    );
  const [tab, setTab] = useState("restaurants"),
    [search, setSearch] = useState(""),
    [selected, setSelected] = useState<Ticket | null>(null),
    [suspend, setSuspend] = useState<
      PlatformData["restaurants"][number] | null
    >(null),
    [busy, setBusy] = useState(false);
  if (!session.platformAdmin)
    return (
      <EmptyState
        title="Este espacio es de la administración."
        description="Activa el acceso con la clave de instalación en Datos y seguridad si administras esta plataforma."
      />
    );
  if (loading) return <Spinner />;
  if (error || !data) return <ErrorState message={error} retry={reload} />;
  async function state(id: string, status: string, reason = "") {
    setBusy(true);
    try {
      await put("/platform/restaurants/" + id + "/state", { status, reason });
      setSuspend(null);
      refresh();
      notify("Estado del negocio actualizado.");
    } catch (e) {
      notify((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  }
  async function settings(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget));
    setBusy(true);
    try {
      await put("/platform/settings", {
        ...f,
        registrationOpen: f.registrationOpen === "on",
      });
      refresh();
      notify("Configuración de plataforma guardada.");
    } catch (e) {
      notify((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="ADMINISTRACIÓN DE LA PLATAFORMA"
        title="Muchos restaurantes. Un buen sistema."
        subtitle="Indicadores globales, negocios registrados y soporte. Los datos operativos privados permanecen en cada restaurante."
      />
      <div className="platform-metrics">
        {[
          {
            name: "Negocios registrados",
            value: data.metrics.restaurants,
            icon: Store,
          },
          {
            name: "Negocios activos",
            value: data.metrics.active,
            icon: CheckCircle2,
          },
          {
            name: "Soporte por resolver",
            value: data.metrics.openTickets,
            icon: Headphones,
          },
          {
            name: "Pedidos del menú",
            value: data.metrics.orders,
            icon: ShoppingBagIcon,
          },
          {
            name: "Reservas recibidas",
            value: data.metrics.reservations,
            icon: Users,
          },
        ].map((x) => (
          <div className="card" key={x.name}>
            <x.icon size={20} />
            <strong>{x.value}</strong>
            <span>{x.name}</span>
          </div>
        ))}
      </div>
      <div className="restaurant-toolbar">
        <div className="segmented-control">
          {[
            { id: "restaurants", name: "Restaurantes" },
            { id: "support", name: "Soporte técnico" },
            { id: "settings", name: "Configuración" },
            { id: "activity", name: "Registro" },
          ].map((t) => (
            <button
              key={t.id}
              className={tab === t.id ? "selected" : ""}
              onClick={() => setTab(t.id)}
            >
              {t.name}
            </button>
          ))}
        </div>
      </div>
      {tab === "restaurants" && (
        <section className="card platform-restaurants">
          <label className="public-menu-search">
            <Search size={17} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar negocio o correo…"
              aria-label="Buscar restaurantes registrados"
            />
          </label>
          <div className="platform-business-list">
            {data.restaurants
              .filter((r) =>
                (r.name + " " + r.owner_email)
                  .toLowerCase()
                  .includes(search.toLowerCase()),
              )
              .map((r) => (
                <article key={r.id}>
                  <span className="restaurant-small-icon">
                    <Store size={21} />
                  </span>
                  <div>
                    <h3>{r.name}</h3>
                    <p>{r.owner_email}</p>
                    <small>
                      {r.orders} pedidos · {r.reservations} reservas ·{" "}
                      {r.images} fotos
                    </small>
                    {r.reason && <blockquote>{r.reason}</blockquote>}
                  </div>
                  <span className={"restaurant-state " + r.status}>
                    {r.status === "active" ? "Activo" : "Suspendido"}
                  </span>
                  <button
                    className="button secondary"
                    disabled={busy}
                    onClick={() =>
                      r.status === "active"
                        ? setSuspend(r)
                        : void state(r.id, "active")
                    }
                  >
                    {r.status === "active" ? (
                      <PauseCircle size={15} />
                    ) : (
                      <PlayCircle size={15} />
                    )}{" "}
                    {r.status === "active" ? "Suspender" : "Reactivar"}
                  </button>
                </article>
              ))}
          </div>
        </section>
      )}
      {tab === "support" && (
        <section className="card support-tickets">
          <h2>Consultas de los restaurantes.</h2>
          {!tickets?.length ? (
            <div className="restaurant-soft-empty">
              <Headphones size={35} />
              <p>No hay solicitudes de soporte.</p>
            </div>
          ) : (
            tickets.map((t) => (
              <button
                className="support-ticket-row"
                key={t.id}
                onClick={() => setSelected(t)}
              >
                <span className="restaurant-small-icon">
                  <Headphones size={18} />
                </span>
                <span>
                  <strong>{t.subject}</strong>
                  <small>
                    {t.restaurant} · {relativeTime(t.updated_at)}
                  </small>
                </span>
                <span className={"restaurant-state " + t.status}>
                  {labels[t.status]}
                </span>
                <ArrowRight size={15} />
              </button>
            ))
          )}
        </section>
      )}
      {tab === "settings" && (
        <form
          className="card platform-settings modal-form"
          onSubmit={(e) => void settings(e)}
        >
          <h2>Las reglas de tu plataforma.</h2>
          <label className="field-label">
            Nombre de la plataforma
            <input
              name="brandName"
              defaultValue={data.settings.brandName}
              maxLength={100}
              required
            />
          </label>
          <label className="field-label">
            Correo público de soporte
            <input
              name="supportEmail"
              type="email"
              defaultValue={data.settings.supportEmail}
              maxLength={254}
            />
          </label>
          <label className="restaurant-confirm">
            <input
              name="registrationOpen"
              type="checkbox"
              defaultChecked={data.settings.registrationOpen}
            />
            Permitir que nuevos restaurantes creen su cuenta
          </label>
          <p className="form-hint">
            El acceso de administración se comprueba en el servidor. Ningún
            restaurante puede asignarse permisos por cambiar datos en el
            navegador.
          </p>
          <SaveButton busy={busy} />
        </form>
      )}
      {tab === "activity" && (
        <section className="card platform-events">
          <h2>Registro de administración.</h2>
          {data.events.map((event, i) => (
            <article key={i}>
              <Activity size={16} />
              <div>
                <strong>{event.action}</strong>
                <p>{event.details}</p>
              </div>
              <small>{relativeTime(event.created_at)}</small>
            </article>
          ))}
        </section>
      )}
      {selected && (
        <TicketConversation
          platform
          ticket={selected}
          onClose={() => setSelected(null)}
          onUpdated={refresh}
        />
      )}{" "}
      {suspend && (
        <Modal
          title={"Suspender " + suspend.name}
          description="El restaurante dejará de recibir pedidos, reservas y llamadas públicas. Podrá entrar a soporte para resolver el motivo."
          onClose={() => setSuspend(null)}
        >
          <form
            className="modal-form"
            onSubmit={(e) => {
              e.preventDefault();
              void state(
                suspend.id,
                "suspended",
                String(new FormData(e.currentTarget).get("reason")),
              );
            }}
          >
            <label className="field-label">
              Motivo de suspensión
              <textarea name="reason" required maxLength={500} rows={3} />
            </label>
            <button className="button danger-button" disabled={busy}>
              Suspender restaurante
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
function ShoppingBagIcon() {
  return <Wallet size={20} />;
}
