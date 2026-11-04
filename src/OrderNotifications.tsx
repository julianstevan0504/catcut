import { useEffect, useRef, useState } from "react";
import {
  Bell,
  Check,
  ChefHat,
  ArrowRight,
  MapPin,
  Volume2,
} from "lucide-react";
import { post, useResource, relativeTime } from "./api";
import { useApp } from "./context";
import { Spinner } from "./components";
type OrderNotice = {
  id: string;
  code: string;
  customer: string;
  phone: string;
  items: string;
  total: number;
  created_at: string;
  fulfillment: string;
  delivery_address: string;
};
export function OrderNotifications() {
  const { session, version, navigate, notify } = useApp(),
    { data, error, loading, reload } = useResource<{
      items: OrderNotice[];
      unread: number;
    }>("/restaurant/notifications", version, 5000),
    [open, setOpen] = useState(false),
    [enabled, setEnabled] = useState(false),
    [permissionMessage, setPermissionMessage] = useState(""),
    [busy, setBusy] = useState(false),
    seen = useRef<Set<string> | null>(null),
    wrap = useRef<HTMLDivElement>(null);
  const preferenceKey = "cerca.order-notifications." + session.workspace.id;
  useEffect(() => {
    try {
      setEnabled(localStorage.getItem(preferenceKey) === "true");
    } catch {}
  }, [preferenceKey]);
  useEffect(() => {
    if (!data) return;
    const current = new Set(data.items.map((x) => x.id));
    if (seen.current) {
      const fresh = data.items.filter((x) => !seen.current!.has(x.id));
      if (fresh.length) {
        const latest = fresh[0];
        notify(
          "Nuevo pedido " +
            latest.code +
            " de " +
            latest.customer +
            ". Revisa tu cocina.",
        );
        if (
          enabled &&
          "Notification" in window &&
          Notification.permission === "granted"
        ) {
          const notice = new Notification(
            "Nuevo pedido para " + session.workspace.name,
            {
              body: "Tu cocina recibió un pedido nuevo. Abre el panel para atenderlo.",
              tag: latest.id,
            },
          );
          notice.onclick = () => {
            window.focus();
            navigate("kitchen");
            notice.close();
          };
        }
      }
    }
    seen.current = current;
  }, [data]);
  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (
        e instanceof KeyboardEvent
          ? e.key === "Escape"
          : !wrap.current?.contains(e.target as Node)
      )
        setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);
  async function enable() {
    setPermissionMessage("");
    if (!("Notification" in window)) {
      setPermissionMessage(
        "Este navegador muestra los avisos dentro del panel.",
      );
      return;
    }
    try {
      const granted = await Notification.requestPermission();
      const active = granted === "granted";
      setEnabled(active);
      try {
        localStorage.setItem(preferenceKey, String(active));
      } catch {}
      setPermissionMessage(
        active
          ? "Avisos activados mientras tengas abierto el panel en este dispositivo."
          : "Los pedidos seguirán apareciendo en la campana y en Cocina.",
      );
    } catch {
      setPermissionMessage("Los avisos siguen disponibles dentro del panel.");
    }
  }
  async function read(ids: string[]) {
    setBusy(true);
    try {
      await post("/restaurant/notifications/read", { ids });
      reload();
    } catch (e) {
      notify((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="notification-wrap" ref={wrap}>
      <button
        className={
          "icon-button notification-button " + (open ? "selected" : "")
        }
        aria-label={
          "Ver notificaciones de pedidos" +
          (data?.unread ? ", " + data.unread + " sin leer" : "")
        }
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <Bell size={19} />
        {Boolean(data?.unread) && (
          <span className="order-notice-count">
            {data!.unread > 99 ? "99+" : data!.unread}
          </span>
        )}
      </button>
      {open && (
        <section
          className="notification-panel order-notice-panel"
          aria-label="Avisos de pedidos"
        >
          <header className="notification-title">
            <strong>Tu cocina tiene noticias.</strong>
            <ChefHat size={19} />
          </header>
          {loading ? (
            <Spinner />
          ) : error ? (
            <p className="form-hint">
              No pudimos consultar los avisos.{" "}
              <button className="text-button" onClick={reload}>
                Reintentar
              </button>
            </p>
          ) : data?.items.length ? (
            <div className="order-notice-list">
              {data.items.map((o) => (
                <article key={o.id}>
                  <button
                    onClick={() => {
                      void read([o.id]);
                      setOpen(false);
                      navigate("kitchen");
                    }}
                  >
                    <span>
                      <strong>
                        {o.code} · {o.customer}
                      </strong>
                      <small>{relativeTime(o.created_at)}</small>
                    </span>
                    <p>{o.items}</p>
                    {o.delivery_address && (
                      <p>
                        <MapPin size={13} />
                        {o.delivery_address}
                      </p>
                    )}
                    <b>
                      Ver en cocina <ArrowRight size={13} />
                    </b>
                  </button>
                </article>
              ))}
            </div>
          ) : (
            <div className="order-notice-empty">
              <Check size={24} />
              <strong>Estás al día.</strong>
              <p>Los pedidos nuevos aparecerán aquí y en tu cocina.</p>
            </div>
          )}
          {Boolean(data?.items.length) && (
            <button
              className="text-button"
              disabled={busy}
              onClick={() => void read(data!.items.map((x) => x.id))}
            >
              Marcar estos avisos como leídos
            </button>
          )}
          <div className="order-notice-options">
            <button className="text-button" onClick={() => void enable()}>
              <Volume2 size={15} />
              {enabled
                ? "Avisos del dispositivo activados"
                : "Activar avisos en este dispositivo"}
            </button>
            {permissionMessage && <p role="status">{permissionMessage}</p>}
            <small>
              Los avisos se actualizan mientras el panel esté abierto. Las
              notificaciones del dispositivo requieren permiso del navegador.
            </small>
          </div>
          <button
            className="order-notice-footer"
            onClick={() => {
              setOpen(false);
              navigate("activity");
            }}
          >
            Ver registro de actividad <ArrowRight size={14} />
          </button>
        </section>
      )}
    </div>
  );
}
