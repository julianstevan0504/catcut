import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { KeyRound, Download } from "lucide-react";
import { api, post } from "./api";
import { useApp } from "./context";
import { downloadCodes } from "./recoveryCodes";
export function RecoveryPanel() {
  const { session, refreshSession, notify } = useApp();
  const [data, setData] = useState<{
      remaining: number;
      emailEnabled: boolean;
      adminSetupAvailable: boolean;
      platformAdmin: boolean;
    } | null>(null),
    [codes, setCodes] = useState<string[]>([]),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    api<typeof data>("/account/recovery")
      .then(setData)
      .catch(() => {});
  }, []);
  async function generate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setBusy(true);
    try {
      const r = await post<{ codes: string[] }>("/account/recovery-codes", {
        password: new FormData(form).get("password"),
      });
      setCodes(r.codes);
      setData((d) => (d ? { ...d, remaining: r.codes.length } : null));
      form.reset();
      notify("Códigos renovados. Guarda la nueva copia.");
    } catch (e) {
      notify((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  }
  async function claim(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    try {
      await post(
        "/platform/claim",
        Object.fromEntries(new FormData(e.currentTarget)),
      );
      await refreshSession();
      setData((d) =>
        d ? { ...d, adminSetupAvailable: false, platformAdmin: true } : null,
      );
      notify(
        "Administración activada. Ya puedes abrir el panel de plataforma.",
      );
    } catch (e) {
      notify((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="card recovery-settings">
      <div className="voice-section-title">
        <span className="studio-icon">
          <KeyRound size={22} />
        </span>
        <div>
          <h3>Recuperación de cuenta</h3>
          <p>
            {data
              ? `${data.remaining} códigos disponibles · ${data.emailEnabled ? "correo configurado" : "recuperación con códigos"}`
              : "Protege el acceso a tu restaurante."}
          </p>
        </div>
      </div>
      <p className="form-hint">
        Los códigos se muestran una vez y cada uno sirve para recuperar tu
        cuenta junto con tu correo. Renovarlos invalida los anteriores.
      </p>
      {codes.length > 0 && (
        <div className="recovery-codes-box">
          <code>{codes.join("\n")}</code>
          <button
            className="button secondary"
            onClick={() => downloadCodes(codes)}
          >
            <Download size={16} /> Descargar códigos
          </button>
        </div>
      )}
      {!session.demo && (
        <form
          className="recovery-inline-form"
          onSubmit={(e) => void generate(e)}
        >
          <label className="field-label">
            Contraseña actual para renovar los códigos
            <input
              type="password"
              name="password"
              required
              autoComplete="current-password"
            />
          </label>
          <button className="button secondary" disabled={busy}>
            Crear nuevos códigos
          </button>
        </form>
      )}
      {data?.adminSetupAvailable && !session.demo && (
        <details className="admin-claim">
          <summary>Activar administración de la plataforma</summary>
          <p>
            Solo para quien administra esta instalación. Usa la clave privada
            PLATFORM_SETUP_TOKEN del servidor y tu contraseña.
          </p>
          <form className="modal-form" onSubmit={(e) => void claim(e)}>
            <label className="field-label">
              Clave de activación de la plataforma
              <input
                name="setupToken"
                type="password"
                required
                minLength={32}
                autoComplete="off"
              />
            </label>
            <label className="field-label">
              Tu contraseña actual
              <input
                name="password"
                type="password"
                required
                autoComplete="current-password"
              />
            </label>
            <button className="button primary" disabled={busy}>
              Activar administración
            </button>
          </form>
        </details>
      )}
    </section>
  );
}
