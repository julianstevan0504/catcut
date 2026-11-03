import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import {
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  LoaderCircle,
  MessageCircle,
  Sparkles,
  LockKeyhole,
  ArrowUpRight,
} from "lucide-react";
import { api, post } from "../api";
import { Logo } from "../components";
import { standaloneMode } from "../standalone";

export function Auth({
  onAuthenticated,
}: {
  onAuthenticated: () => Promise<void>;
}) {
  const [register, setRegister] = useState(
    !standaloneMode && location.hash === "#register",
  );
  const [flags, setFlags] = useState<{
    demoEnabled: boolean;
    registrationAllowed: boolean;
  } | null>(null);
  const [busy, setBusy] = useState(false),
    [demoBusy, setDemoBusy] = useState(false);
  const [error, setError] = useState(""),
    [visible, setVisible] = useState(false);
  useEffect(() => {
    api<{ demoEnabled: boolean; registrationAllowed: boolean }>("/bootstrap")
      .then(setFlags)
      .catch((e) => setError(e.message));
  }, []);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const fields = Object.fromEntries(new FormData(e.currentTarget));
    try {
      await post(register ? "/auth/register" : "/auth/login", fields);
      await onAuthenticated();
      location.hash = "overview";
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function demo() {
    setDemoBusy(true);
    setError("");
    try {
      await post("/auth/demo");
      await onAuthenticated();
      location.hash = "overview";
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setDemoBusy(false);
    }
  }
  function switchMode() {
    setRegister((r) => !r);
    setError("");
    location.hash = register ? "login" : "register";
  }
  return (
    <div className="auth-shell">
      <section className="auth-story">
        <Logo />
        <div className="auth-story-content">
          <span className="auth-kicker">
            <span /> TU NUEVO MEJOR EQUIPO
          </span>
          <h1>
            Tu tienda,
            <br />
            siempre <span>cerca.</span>
          </h1>
          <p>
            Las buenas conversaciones hacen crecer los negocios. Dale a cada
            cliente la atención que merece, por WhatsApp.
          </p>
          <div className="auth-conversation">
            <div className="auth-chat-heading">
              <span className="bot-avatar">
                <Sparkles size={20} />
              </span>
              <div>
                <strong>Sofía · Tu asistente</strong>
                <small>
                  <i /> Siempre lista para ayudar
                </small>
              </div>
              <MessageCircle size={21} />
            </div>
            <div className="auth-chat-body">
              <div className="auth-bubble customer">
                ¡Hola! ¿Todavía tienen el Bolso Alba? 👀<small>10:24</small>
              </div>
              <div className="auth-bubble assistant">
                ¡Hola! Sí, está disponible 🌿 Cuesta $129.900 COP. ¿Te cuento
                más?
                <small>
                  10:24 <Check size={13} />
                  <Check size={13} />
                </small>
              </div>
            </div>
            <div className="auth-example-label">
              Una conversación de ejemplo. Una atención muy tuya.
            </div>
          </div>
          <div className="auth-perks">
            <span>
              <Check size={16} /> Respuestas naturales
            </span>
            <span>
              <Check size={16} /> Todo bajo tu control
            </span>
          </div>
        </div>
        <div className="auth-story-footer">
          Menos «ya te respondo». Más clientes felices. <Sparkles size={17} />
        </div>
      </section>
      <section className="auth-form-section">
        <div className="auth-top-link">
          {register ? "¿Ya tienes cuenta?" : "¿Primera vez por aquí?"}{" "}
          {flags?.registrationAllowed !== false || register ? (
            <button onClick={switchMode}>
              {register ? "Inicia sesión" : "Crea tu cuenta"}{" "}
              <ArrowUpRight size={15} />
            </button>
          ) : (
            <span>
              {standaloneMode
                ? "Demo independiente · sin contraseña"
                : "Contacta a administración"}
            </span>
          )}
        </div>
        <div className="auth-form-container">
          <span className="auth-form-icon">
            <MessageCircle size={26} />
          </span>
          <div className="eyebrow">HAGAMOS ESPACIO PARA TU TIENDA</div>
          <h2>
            {register
              ? "El comienzo de algo bueno."
              : "Qué bueno tenerte de vuelta."}
          </h2>
          <p>
            {register
              ? "Crea tu cuenta y dale una voz a tu negocio."
              : "Entra a tu espacio. Tu próxima conversación te espera."}
          </p>
          {standaloneMode && (
            <div className="inline-notice">
              <Sparkles size={19} />
              <div>
                <strong>Tu tienda de ejemplo está lista.</strong>
                <p>
                  Explora productos, pedidos y conversaciones sin una cuenta
                  real. Para conectar WhatsApp y crear tu cuenta, usa el
                  iniciador de la versión con servidor.
                </p>
              </div>
            </div>
          )}
          {!standaloneMode && (
            <form onSubmit={(e) => void submit(e)}>
              {register && (
                <>
                  <label className="field-label">
                    Tu nombre
                    <input
                      name="name"
                      autoComplete="name"
                      placeholder="¿Cómo te llamas?"
                      required
                      maxLength={80}
                    />
                  </label>
                  <label className="field-label">
                    Nombre de tu tienda
                    <input
                      name="storeName"
                      autoComplete="organization"
                      placeholder="El nombre de tu negocio"
                      required
                      maxLength={100}
                    />
                  </label>
                </>
              )}
              <label className="field-label">
                Correo electrónico
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="tu@tienda.com"
                  required
                  maxLength={254}
                />
              </label>
              <label className="field-label">
                Contraseña
                <div className="password-input">
                  <input
                    name="password"
                    type={visible ? "text" : "password"}
                    autoComplete={
                      register ? "new-password" : "current-password"
                    }
                    placeholder={
                      register ? "Mínimo 10 caracteres" : "Tu contraseña"
                    }
                    minLength={register ? 10 : undefined}
                    maxLength={128}
                    required
                  />
                  <button
                    type="button"
                    aria-label={
                      visible ? "Ocultar contraseña" : "Mostrar contraseña"
                    }
                    onClick={() => setVisible((v) => !v)}
                  >
                    {visible ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </label>
              {error && (
                <div className="inline-error" role="alert">
                  {error}
                </div>
              )}
              <button
                type="submit"
                className="button primary full-width auth-submit"
                disabled={busy || demoBusy}
              >
                {busy ? <LoaderCircle className="spin" size={18} /> : null}
                {register ? "Crear mi espacio" : "Entrar a mi tienda"}
                <ArrowRight size={18} />
              </button>
            </form>
          )}
          {flags?.demoEnabled && (
            <>
              <div className="auth-divider">
                <span />o echa un vistazo primero
                <span />
              </div>
              <button
                className="button secondary full-width"
                disabled={demoBusy || busy}
                onClick={() => void demo()}
              >
                {demoBusy ? (
                  <LoaderCircle size={18} className="spin" />
                ) : (
                  <Sparkles size={18} />
                )}{" "}
                Explorar la demo <ArrowUpRight size={16} />
              </button>
              <p className="demo-note">
                Sin registros. Sin mensajes reales. Con todas las posibilidades.
              </p>
            </>
          )}
          <div className="auth-security">
            <LockKeyhole size={14} />
            <span>Tus conversaciones y tus datos, en tu espacio.</span>
          </div>
        </div>
        <div className="auth-bottom">
          Cerca © {new Date().getFullYear()}{" "}
          <span>Una forma más humana de conectar.</span>
        </div>
      </section>
    </div>
  );
}
