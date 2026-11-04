import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import {
  ArrowLeft,
  KeyRound,
  Mail,
  ShieldCheck,
  LoaderCircle,
} from "lucide-react";
import { api, post } from "./api";
import { Logo } from "./components";
export function AccountRecovery({ token }: { token: string }) {
  const reset = /^[a-f0-9]{64}$/.test(token),
    [mode, setMode] = useState(reset ? "reset" : "email"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [done, setDone] = useState(false),
    [emailEnabled, setEmailEnabled] = useState<boolean | null>(null);
  useEffect(() => {
    api<{ emailRecoveryEnabled: boolean }>("/bootstrap")
      .then((r) => {
        setEmailEnabled(r.emailRecoveryEnabled);
        if (!r.emailRecoveryEnabled && !reset) setMode("code");
      })
      .catch(() => {});
  }, [reset]);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    const fields = Object.fromEntries(new FormData(e.currentTarget));
    try {
      if (mode !== "email" && fields.password !== fields.confirmPassword)
        throw Error("Las contraseñas no coinciden.");
      const result = await post<{ message: string }>(
        mode === "email" ? "/auth/forgot-password" : "/auth/reset-password",
        { ...fields, ...(reset ? { token } : {}) },
      );
      setMessage(result.message);
      if (mode !== "email") setDone(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="account-recovery-page">
      <Logo />
      <section className="recovery-card">
        <span className="restaurant-section-icon">
          <KeyRound size={26} />
        </span>
        <span className="eyebrow">TU RESTAURANTE, EN TUS MANOS</span>
        <h1>{done ? "Vuelve a tu restaurante." : "Recupera tu cuenta."}</h1>
        <p>Un acceso seguro para volver a lo importante.</p>
        {!done && (
          <>
            {!reset && (
              <div className="segmented-control">
                <button
                  className={mode === "email" ? "selected" : ""}
                  onClick={() => setMode("email")}
                >
                  <Mail size={15} /> Por correo
                </button>
                <button
                  className={mode === "code" ? "selected" : ""}
                  onClick={() => setMode("code")}
                >
                  <KeyRound size={15} /> Con un código
                </button>
              </div>
            )}
            {mode === "email" && emailEnabled === false && (
              <p className="form-hint">
                Esta instalación aún no tiene proveedor de correo. Puedes usar
                uno de los códigos que guardaste al crear tu cuenta.
              </p>
            )}
            <form className="modal-form" onSubmit={(e) => void submit(e)}>
              {!reset && (
                <label className="field-label">
                  Correo de tu cuenta
                  <input
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                    maxLength={254}
                  />
                </label>
              )}
              {mode === "code" && (
                <label className="field-label">
                  Código de recuperación
                  <input
                    name="recoveryCode"
                    required
                    maxLength={80}
                    autoComplete="off"
                    placeholder="CERCA-…"
                  />
                </label>
              )}
              {mode !== "email" && (
                <label className="field-label">
                  Nueva contraseña
                  <input
                    name="password"
                    type="password"
                    required
                    minLength={10}
                    maxLength={128}
                    autoComplete="new-password"
                  />
                </label>
              )}
              {mode !== "email" && (
                <label className="field-label">
                  Confirmar nueva contraseña
                  <input
                    name="confirmPassword"
                    type="password"
                    required
                    minLength={10}
                    maxLength={128}
                    autoComplete="new-password"
                  />
                </label>
              )}
              {error && (
                <p className="inline-error" role="alert">
                  {error}
                </p>
              )}
              <button className="button primary full-width" disabled={busy}>
                {busy ? (
                  <LoaderCircle size={17} className="spin" />
                ) : (
                  <ShieldCheck size={17} />
                )}{" "}
                {mode === "email"
                  ? "Solicitar enlace"
                  : "Restablecer contraseña"}
              </button>
            </form>
          </>
        )}
        {message && (
          <p className="recovery-message" role="status">
            {message}
          </p>
        )}
        <a className="text-button" href="/">
          <ArrowLeft size={15} /> Volver al ingreso
        </a>
      </section>
      <footer>Cerca Restaurantes · Hecho para atender mejor.</footer>
    </main>
  );
}
