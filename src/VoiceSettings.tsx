import { useState } from "react";
import type { FormEvent } from "react";
import {
  Check,
  Copy,
  ExternalLink,
  Globe,
  PhoneCall,
  ShieldCheck,
  Link2,
  Unplug,
} from "lucide-react";
import { api, put, useResource, relativeTime } from "./api";
import { useApp } from "./context";
import { SaveButton, Toggle, ErrorState, Spinner } from "./components";
type VoiceConfig = {
  publicEnabled: boolean;
  publicUrl: string;
  configured: boolean;
  accountSid: string;
  businessNumber: string;
  forwardNumber: string;
  status: string;
  lastWebhookAt: string | null;
  incomingUrl: string;
  statusUrl: string;
};
export function VoiceSettings() {
  const { session, version, refresh, notify } = useApp();
  const { data, loading, error, reload } = useResource<VoiceConfig>(
    "/voice/config",
    version,
  );
  const [busy, setBusy] = useState(false),
    [copied, setCopied] = useState(""),
    [editing, setEditing] = useState(false);
  const [fields, setFields] = useState({
    accountSid: "",
    authToken: "",
    businessNumber: "",
    forwardNumber: "",
  });
  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(value);
      setTimeout(() => setCopied(""), 2000);
    } catch {
      notify("Selecciona y copia la dirección que aparece en el campo.", true);
    }
  }
  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await put("/voice/integration", fields);
      setFields((f) => ({ ...f, authToken: "" }));
      setEditing(false);
      refresh();
      notify(
        "Configuración cifrada guardada. Activa WhatsApp Calling con tu proveedor y prueba una llamada.",
      );
    } catch (e) {
      notify((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  }
  async function togglePublic() {
    if (!data) return;
    setBusy(true);
    try {
      await put("/voice/channel", { enabled: !data.publicEnabled });
      refresh();
      notify(
        data.publicEnabled
          ? "Enlace de llamadas desactivado."
          : "Tu enlace de voz está disponible para tus clientes.",
      );
    } catch (e) {
      notify((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  }
  if (loading) return <Spinner />;
  if (error) return <ErrorState message={error} retry={reload} />;
  if (!data) return null;
  const urlField = (label: string, value: string) => (
    <label className="field-label voice-url-field">
      {label}
      <span>
        <input readOnly value={value} onFocus={(e) => e.target.select()} />
        <button
          type="button"
          className="icon-button"
          onClick={() => void copy(value)}
          aria-label={`Copiar ${label}`}
        >
          {copied === value ? <Check size={16} /> : <Copy size={16} />}
        </button>
      </span>
    </label>
  );
  return (
    <div className="voice-settings-stack">
      <section className="card voice-settings-card">
        <div className="voice-section-title">
          <span className="studio-icon">
            <Globe size={20} />
          </span>
          <div>
            <h3>Llamadas desde tu web</h3>
            <p>
              Comparte un enlace para que tus clientes hablen con tu asistente.
            </p>
          </div>
        </div>
        <div className="voice-setting-row">
          <span>
            <strong>Enlace público de voz</strong>
            <small>
              {session.offline
                ? "Disponible al ejecutar el servidor y publicar con HTTPS."
                : "Puedes activarlo o desactivarlo cuando quieras."}
            </small>
          </span>
          <Toggle
            checked={data.publicEnabled}
            onChange={() => {
              if (!busy && !session.offline) void togglePublic();
            }}
            label="Activar enlace público de voz"
          />
        </div>
        {!session.offline && data.publicEnabled && (
          <>
            {urlField("Enlace para tus clientes", data.publicUrl)}
            <a
              className="button secondary"
              href={data.publicUrl}
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink size={15} /> Abrir vista del cliente
            </a>
          </>
        )}
        <p className="form-hint">
          Solo muestra la tienda y su asistente. Los clientes no acceden al
          panel, credenciales ni pedidos privados.
        </p>
      </section>
      <section className="card voice-settings-card">
        <div className="voice-section-title">
          <span className="studio-icon purple">
            <PhoneCall size={20} />
          </span>
          <div>
            <h3>Llamadas por WhatsApp</h3>
            <p>
              Conexión con Twilio Programmable Voice y WhatsApp Business
              Calling.
            </p>
          </div>
        </div>
        <span
          className={`voice-provider-status ${data.lastWebhookAt ? "observed" : ""}`}
        >
          <i />
          {data.lastWebhookAt
            ? "Webhook firmado recibido"
            : "Activación del proveedor pendiente"}
        </span>
        <p className="voice-provider-explanation">
          Necesitas un remitente de WhatsApp habilitado para llamadas en Twilio
          y una dirección HTTPS pública. La conexión de mensajes con Meta se
          configura por separado. Si tu número ya está en Meta, revisa su
          compatibilidad o migración con el proveedor. Twilio puede cobrar por
          su servicio.
        </p>
        {session.offline || session.demo ? (
          <div className="voice-notice">
            La demo permite probar voz en la web. Conecta el proveedor desde tu
            cuenta real, con el servidor en funcionamiento.
          </div>
        ) : (
          <>
            {!data.configured || editing ? (
              <form
                className="voice-provider-form"
                onSubmit={(e) => void save(e)}
              >
                <label className="field-label">
                  Twilio Account SID
                  <input
                    required
                    autoComplete="off"
                    maxLength={34}
                    pattern="AC[a-fA-F0-9]{32}"
                    value={fields.accountSid}
                    onChange={(e) =>
                      setFields((f) => ({ ...f, accountSid: e.target.value }))
                    }
                    placeholder="AC…"
                  />
                </label>
                <label className="field-label">
                  Twilio Auth Token
                  <input
                    required
                    type="password"
                    autoComplete="new-password"
                    maxLength={32}
                    minLength={32}
                    value={fields.authToken}
                    onChange={(e) =>
                      setFields((f) => ({ ...f, authToken: e.target.value }))
                    }
                    placeholder="Se guarda cifrado; nunca se muestra de nuevo"
                  />
                </label>
                <div className="form-row">
                  <label className="field-label">
                    Número de WhatsApp
                    <input
                      required
                      type="tel"
                      value={fields.businessNumber}
                      onChange={(e) =>
                        setFields((f) => ({
                          ...f,
                          businessNumber: e.target.value,
                        }))
                      }
                      placeholder="+573001112233"
                    />
                  </label>
                  <label className="field-label">
                    Número del equipo (opcional)
                    <input
                      type="tel"
                      value={fields.forwardNumber}
                      onChange={(e) =>
                        setFields((f) => ({
                          ...f,
                          forwardNumber: e.target.value,
                        }))
                      }
                      placeholder="+57…"
                    />
                  </label>
                </div>
                <p className="form-hint">
                  Si solicitan una persona, se intenta transferir a este número.
                  Si lo dejas vacío, queda pendiente en conversaciones.
                </p>
                <SaveButton busy={busy} />
              </form>
            ) : (
              <div className="voice-connected-details">
                <strong>{data.businessNumber}</strong>
                <p>
                  {data.lastWebhookAt
                    ? `Último webhook: ${relativeTime(data.lastWebhookAt)}`
                    : "Credenciales guardadas. Aún no se ha recibido una llamada firmada."}
                </p>
                <button
                  className="button secondary"
                  onClick={() => {
                    setFields({
                      accountSid: data.accountSid,
                      authToken: "",
                      businessNumber: data.businessNumber,
                      forwardNumber: data.forwardNumber,
                    });
                    setEditing(true);
                  }}
                >
                  Editar conexión
                </button>
                <button
                  className="text-button danger"
                  onClick={async () => {
                    try {
                      await api("/voice/integration", {
                        method: "DELETE",
                        body: "{}",
                      });
                      refresh();
                      notify("Proveedor desconectado.");
                    } catch (e) {
                      notify((e as Error).message, true);
                    }
                  }}
                >
                  <Unplug size={14} /> Desconectar
                </button>
              </div>
            )}
            <div className="voice-webhook-help">
              <Link2 size={16} />
              <p>
                En la consola de Twilio, configura estas direcciones con método{" "}
                <strong>POST</strong>. Los eventos se verifican con la firma del
                proveedor.
              </p>
            </div>
            {urlField("Webhook de llamada entrante", data.incomingUrl)}
            {urlField("Webhook de estado", data.statusUrl)}
            <a
              className="text-button"
              href="https://www.twilio.com/docs/voice/whatsapp-business-calling"
              target="_blank"
              rel="noreferrer"
            >
              Guía del proveedor <ExternalLink size={13} />
            </a>
          </>
        )}
        <p className="voice-private">
          <ShieldCheck size={14} /> Cerca guarda transcripciones, no
          grabaciones. No introduzcas claves en un archivo de demo ni en un
          chat.
        </p>
      </section>
    </div>
  );
}
