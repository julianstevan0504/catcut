import { useState } from "react";
import type { FormEvent } from "react";
import {
  ArrowUpRight,
  Check,
  CheckCircle2,
  ChevronRight,
  Copy,
  ExternalLink,
  KeyRound,
  Link2,
  LoaderCircle,
  LockKeyhole,
  MessageCircle,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Store,
  UserRound,
  Zap,
} from "lucide-react";
import { post, put } from "../api";
import { useApp } from "../context";
import { Avatar, PageHeading, SaveButton } from "../components";
import { RecoveryPanel } from "../AccountRecovery";
import { SecurityTools } from "../Workbench";

export function SettingsPage() {
  const { session } = useApp();
  const [tab, setTab] = useState("general");
  return (
    <>
      <PageHeading
        eyebrow="HECHO A LA MEDIDA DE TU NEGOCIO"
        title="Tu tienda. Tus reglas."
        subtitle="Los detalles que hacen que todo funcione, en un solo lugar."
      />
      <div className="settings-layout">
        <nav className="settings-nav" aria-label="Secciones de configuración">
          {[
            {
              id: "general",
              label: "Tu tienda",
              description: "Nombre e información",
              icon: Store,
            },
            {
              id: "whatsapp",
              label: "WhatsApp Business",
              description: "Conecta tu número",
              icon: MessageCircle,
            },
            {
              id: "account",
              label: "Tu cuenta",
              description: "Perfil y seguridad",
              icon: UserRound,
            },
            {
              id: "security",
              label: "Datos y seguridad",
              description: "Sesiones y exportaciones",
              icon: ShieldCheck,
            },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={tab === t.id ? "active" : ""}
            >
              <t.icon size={19} />
              <span>
                <strong>{t.label}</strong>
                <small>{t.description}</small>
              </span>
              <ChevronRight size={15} />
            </button>
          ))}
          <div className="settings-nav-note">
            <ShieldCheck size={22} />
            <strong>Tu espacio es tuyo.</strong>
            <p>
              Las credenciales de WhatsApp se guardan cifradas y nunca se
              muestran en los registros.
            </p>
          </div>
        </nav>
        <section className="settings-content">
          {tab === "general" && (
            <GeneralSettings onWhatsApp={() => setTab("whatsapp")} />
          )}{" "}
          {tab === "whatsapp" && <WhatsAppSettings />}
          {tab === "account" && <AccountSettings />}
          {tab === "security" && (
            <>
              <SecurityTools />
              <RecoveryPanel />
            </>
          )}
          <div className="settings-bottom-note">
            <LockKeyhole size={13} />
            {session.offline
              ? "Demo independiente: no ingreses contraseñas, datos sensibles ni credenciales reales."
              : session.demo
                ? "Estás en una demo compartida. No ingreses datos ni credenciales reales."
                : "Solo las personas con acceso a tu cuenta pueden administrar esta tienda."}
          </div>
        </section>
      </div>
    </>
  );
}

function GeneralSettings({ onWhatsApp }: { onWhatsApp: () => void }) {
  const { session, refreshSession, navigate, notify } = useApp();
  const [name, setName] = useState(session.workspace.name),
    [busy, setBusy] = useState(false);
  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await put("/settings", { storeName: name });
      await refreshSession();
      notify("Información de la tienda actualizada.");
    } catch (e) {
      notify((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <form className="card" onSubmit={(e) => void save(e)}>
        <div className="card-header">
          <div>
            <h3>Un nombre que tus clientes recuerdan.</h3>
            <p>La información principal de tu negocio.</p>
          </div>
          <Store size={21} />
        </div>
        <div className="form-section">
          <div className="store-brand-preview">
            <span className="store-monogram">
              {name[0]?.toUpperCase() || "T"}
            </span>
            <span>
              <strong>{name || "Tu tienda"}</strong>
              <small>Tienda independiente · Colombia</small>
            </span>
            <span className="pill">Tu negocio</span>
          </div>
          <label className="field-label">
            Nombre de la tienda
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
              required
            />
          </label>
          <div className="form-row">
            <label className="field-label">
              País
              <input value="Colombia" readOnly />
            </label>
            <label className="field-label">
              Zona horaria
              <input value="Bogotá (UTC −05:00)" readOnly />
            </label>
          </div>
          <div className="info-note">
            <MessageCircle size={18} />
            <p>
              Los horarios, las políticas y las preguntas frecuentes se
              configuran en tu asistente.
            </p>
            <button
              type="button"
              className="icon-button"
              aria-label="Configurar información del asistente"
              onClick={() => navigate("assistant")}
            >
              <ArrowUpRight size={18} />
            </button>
          </div>
        </div>
        <div className="form-actions">
          <span />
          <SaveButton busy={busy} />
        </div>
      </form>
      <div className="card connection-overview">
        <div className="connection-logo whatsapp">
          <MessageCircle size={26} />
        </div>
        <div>
          <h3>WhatsApp Business</h3>
          <p>
            {session.integration.status === "verified"
              ? `Número verificado: ${session.integration.displayPhone || session.integration.phoneNumberId}`
              : session.integration.configured
                ? "Credenciales guardadas. Completa la verificación."
                : "El lugar donde empiezan las buenas conversaciones."}
          </p>
        </div>
        <button className="button secondary" onClick={onWhatsApp}>
          {session.integration.configured ? "Administrar" : "Conectar"}
          <ArrowUpRight size={15} />
        </button>
      </div>
      <div className="card connection-overview">
        <div className="connection-logo ai">
          <Sparkles size={25} />
        </div>
        <div>
          <h3>
            {session.ai.configured
              ? "Clasificación con IA configurada"
              : "Asistente local incluido"}
          </h3>
          <p>
            {session.ai.configured
              ? `${session.ai.model} interpreta consultas ambiguas; las respuestas usan los datos guardados.`
              : "Responde usando tu catálogo y las políticas que configures."}
          </p>
        </div>
        <span
          className={`badge ${session.ai.configured ? "status-open" : "neutral"}`}
        >
          <i />
          {session.ai.configured ? "Configurada" : "Modo local"}
        </span>
      </div>
      <div className="info-note ai-explanation">
        <Zap size={18} />
        <p>
          La clasificación con IA es opcional y puede tener costos de uso. Se
          configura en el alojamiento con una clave del proveedor. Sin ella,
          puedes seguir usando el asistente local.
        </p>
      </div>
    </>
  );
}

function WhatsAppSettings() {
  const { session, refreshSession, notify } = useApp();
  const [form, setForm] = useState({
    phoneNumberId: session.integration.phoneNumberId,
    accessToken: "",
    appSecret: "",
    verifyToken: "",
  });
  const [busy, setBusy] = useState(false),
    [testing, setTesting] = useState(false),
    [error, setError] = useState("");
  const change = (key: keyof typeof form, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));
  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await put("/integrations/whatsapp", form);
      await refreshSession();
      setForm((f) => ({ ...f, accessToken: "", appSecret: "" }));
      notify(
        "Credenciales guardadas y cifradas. Ahora comprueba la conexión y configura el webhook en Meta.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function test() {
    setTesting(true);
    setError("");
    try {
      await post("/integrations/whatsapp/test");
      await refreshSession();
      notify(
        "Meta confirmó el acceso al número. Comprueba también la suscripción del webhook.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setTesting(false);
    }
  }
  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      notify("Copiado al portapapeles.");
    } catch {
      notify(
        "No se pudo copiar. Selecciona el texto y cópialo manualmente.",
        true,
      );
    }
  }
  const isPublic = session.integration.webhookUrl.startsWith("https://");
  return (
    <>
      <div className="card whatsapp-connection-card">
        <div className="whatsapp-connection-hero">
          <span className="connection-logo whatsapp">
            <MessageCircle size={30} />
          </span>
          <span
            className={`badge ${session.integration.status === "verified" ? "status-open" : "status-pending"}`}
          >
            <i />
            {session.integration.status === "verified"
              ? "Número verificado"
              : session.integration.configured
                ? "Pendiente de verificar"
                : "Sin conectar"}
          </span>
          <h3>De tu WhatsApp a tu nuevo equipo.</h3>
          <p>
            Recibe las conversaciones de tus clientes y deja que tu asistente
            responda desde tu número de negocio.
          </p>
        </div>
        <div className="connection-steps">
          <div>
            <span>1</span>
            <p>Prepara tu cuenta y número en Meta.</p>
            <a
              href="https://developers.facebook.com/apps/"
              target="_blank"
              rel="noreferrer"
            >
              Abrir Meta <ExternalLink size={13} />
            </a>
          </div>
          <div>
            <span>2</span>
            <p>Guarda las credenciales de la API.</p>
          </div>
          <div>
            <span>3</span>
            <p>
              Configura y suscribe el webhook a <code>messages</code>.
            </p>
          </div>
        </div>
      </div>
      {session.demo && (
        <div className="inline-notice">
          <ShieldCheck size={20} />
          <div>
            <strong>Prueba con tranquilidad.</strong>
            <p>
              La demo es compartida y no permite conectar números reales. Cierra
              sesión y crea tu propia cuenta para guardar tus credenciales.
            </p>
          </div>
        </div>
      )}
      {!isPublic && (
        <div className="inline-notice">
          <Link2 size={20} />
          <div>
            <strong>Antes de conectar: publica tu plataforma.</strong>
            <p>
              Meta necesita una dirección HTTPS pública para entregar mensajes.
              En esta instalación local puedes usar el simulador.
            </p>
          </div>
        </div>
      )}
      <form className="card" onSubmit={(e) => void save(e)}>
        <div className="card-header">
          <div>
            <h3>Credenciales de WhatsApp Cloud API</h3>
            <p>
              Se encuentran en tu aplicación de Meta, en WhatsApp →
              Configuración de la API.
            </p>
          </div>
          <KeyRound size={21} />
        </div>
        <fieldset className="form-section" disabled={session.demo || busy}>
          <label className="field-label">
            ID del número de teléfono
            <input
              value={form.phoneNumberId}
              onChange={(e) => change("phoneNumberId", e.target.value)}
              placeholder="Ej. 123456789012345"
              required
              pattern="[0-9]{5,30}"
              maxLength={30}
            />
            <small>
              Es el identificador que da Meta, no tu número de WhatsApp.
            </small>
          </label>
          <label className="field-label">
            Token de acceso
            <input
              type="password"
              autoComplete="new-password"
              value={form.accessToken}
              onChange={(e) => change("accessToken", e.target.value)}
              minLength={20}
              maxLength={8192}
              required
              placeholder="Pega tu token de acceso de Meta"
            />
            <small>
              Usa un token de usuario del sistema con los permisos de WhatsApp
              correspondientes.
            </small>
          </label>
          <label className="field-label">
            Secreto de la aplicación de Meta
            <input
              type="password"
              autoComplete="new-password"
              value={form.appSecret}
              onChange={(e) => change("appSecret", e.target.value)}
              minLength={32}
              maxLength={32}
              required
              placeholder="32 caracteres, en Configuración → Básica"
            />
            <small>
              Permite comprobar que los mensajes entrantes vienen de Meta.
            </small>
          </label>
          <label className="field-label">
            Código de verificación del webhook
            <div className="input-with-button">
              <input
                value={form.verifyToken}
                onChange={(e) => change("verifyToken", e.target.value)}
                minLength={16}
                maxLength={128}
                pattern="[A-Za-z0-9_-]+"
                required
                placeholder="Crea un código seguro y cópialo en Meta"
              />
              <button
                className="button secondary"
                type="button"
                onClick={() =>
                  change(
                    "verifyToken",
                    [...crypto.getRandomValues(new Uint8Array(24))]
                      .map((n) => n.toString(16).padStart(2, "0"))
                      .join(""),
                  )
                }
              >
                Generar
              </button>
            </div>
            <small>
              Cópialo en Meta antes de salir: no se vuelve a mostrar después de
              recargar.
            </small>
          </label>
        </fieldset>
        {error && (
          <div className="inline-error settings-error" role="alert">
            {error}
          </div>
        )}
        <div className="form-actions">
          <button
            type="button"
            className="button secondary"
            disabled={
              !session.integration.configured || testing || session.demo
            }
            onClick={() => void test()}
          >
            {testing ? (
              <LoaderCircle size={16} className="spin" />
            ) : (
              <RefreshCw size={16} />
            )}{" "}
            Comprobar conexión
          </button>
          <button
            type="submit"
            className="button primary"
            disabled={session.demo || busy}
          >
            {busy ? (
              <LoaderCircle size={16} className="spin" />
            ) : (
              <LockKeyhole size={16} />
            )}{" "}
            Guardar credenciales
          </button>
        </div>
      </form>
      <div className="card webhook-card">
        <div className="card-header">
          <div>
            <h3>La puerta de entrada a tus conversaciones.</h3>
            <p>
              En Meta, usa esta URL como callback y suscribe el campo
              «messages».
            </p>
          </div>
          <Link2 size={20} />
        </div>
        <div className="form-section">
          <label className="field-label">
            URL del webhook
            <div className="copy-field">
              <input readOnly value={session.integration.webhookUrl} />
              <button
                className="icon-button"
                aria-label="Copiar URL del webhook"
                onClick={() => void copy(session.integration.webhookUrl)}
              >
                <Copy size={17} />
              </button>
            </div>
          </label>
          <div className="webhook-check">
            <CheckCircle2 size={16} />
            <p>
              Los mensajes entrantes se validan con la firma de Meta y los
              eventos duplicados no se procesan dos veces.
            </p>
          </div>
          <div className="info-note">
            <MessageCircle size={17} />
            <p>
              Las respuestas libres solo se envían dentro de las 24 horas
              posteriores al mensaje del cliente. Esta versión atiende texto;
              imágenes y audios se derivan al equipo.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

function AccountSettings() {
  const { session, notify, refresh } = useApp();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget,
      values = Object.fromEntries(new FormData(form));
    setBusy(true);
    setError("");
    if (values.newPassword !== values.confirmPassword) {
      setError("Las contraseñas nuevas no coinciden.");
      setBusy(false);
      return;
    }
    try {
      await put("/account/password", values);
      form.reset();
      refresh();
      notify("Contraseña actualizada. Las otras sesiones se cerraron.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="card">
        <div className="card-header">
          <div>
            <h3>La persona detrás de la tienda.</h3>
            <p>Tu perfil de administración.</p>
          </div>
          <UserRound size={20} />
        </div>
        <div className="form-section">
          <div className="account-profile">
            <Avatar name={session.user.name} size="large" />
            <span>
              <h3>{session.user.name}</h3>
              <p>Administración · {session.workspace.name}</p>
            </span>
            <span className="pill">
              {session.demo ? "Demo" : "Propietario"}
            </span>
          </div>
          <div className="form-row">
            <label className="field-label">
              Nombre
              <input readOnly value={session.user.name} />
            </label>
            <label className="field-label">
              Correo electrónico
              <input readOnly value={session.user.email} />
            </label>
          </div>
        </div>
      </div>
      <form className="card password-card" onSubmit={(e) => void save(e)}>
        <div className="card-header">
          <div>
            <h3>Un poco de cuidado, mucha tranquilidad.</h3>
            <p>
              Actualiza tu contraseña. Se cerrarán las otras sesiones de tu
              cuenta.
            </p>
          </div>
          <ShieldCheck size={21} />
        </div>
        <fieldset className="form-section" disabled={session.demo || busy}>
          <label className="field-label">
            Contraseña actual
            <input
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              maxLength={128}
              required
            />
          </label>
          <div className="form-row">
            <label className="field-label">
              Nueva contraseña
              <input
                name="newPassword"
                type="password"
                autoComplete="new-password"
                minLength={10}
                maxLength={128}
                placeholder="Mínimo 10 caracteres"
                required
              />
            </label>
            <label className="field-label">
              Confirma la nueva contraseña
              <input
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                minLength={10}
                maxLength={128}
                required
              />
            </label>
          </div>
          {session.demo && (
            <div className="info-note">
              <Sparkles size={16} />
              <p>
                La contraseña de la cuenta compartida de demo no se puede
                cambiar.
              </p>
            </div>
          )}
        </fieldset>
        {error && (
          <div className="inline-error settings-error" role="alert">
            {error}
          </div>
        )}
        <div className="form-actions">
          <span>
            <LockKeyhole size={14} /> Tus accesos están protegidos
          </span>
          <button
            type="submit"
            className="button primary"
            disabled={session.demo || busy}
          >
            {busy ? (
              <LoaderCircle size={16} className="spin" />
            ) : (
              <Check size={16} />
            )}{" "}
            Cambiar contraseña
          </button>
        </div>
      </form>
    </>
  );
}
