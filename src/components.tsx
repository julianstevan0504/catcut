import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import {
  X,
  LoaderCircle,
  Search,
  ArrowRight,
  MessageCircle,
  Sparkles,
  Check,
  CircleAlert,
} from "lucide-react";
import { initials } from "./api";

export function Logo({ small = false }: { small?: boolean }) {
  return (
    <div className={`brand ${small ? "small" : ""}`}>
      <svg viewBox="0 0 44 44" aria-hidden="true">
        <rect width="44" height="44" rx="14" fill="currentColor" />
        <path
          d="M31 15.5a11.5 11.5 0 1 0 0 13"
          fill="none"
          stroke="#d6f9a2"
          strokeWidth="5"
          strokeLinecap="round"
        />
        <circle cx="29" cy="22" r="2.7" fill="#d6f9a2" />
      </svg>
      <span>
        cerca<span className="brand-dot">.</span>
      </span>
    </div>
  );
}
export function Avatar({
  name,
  size = "",
  index = 0,
}: {
  name: string;
  size?: string;
  index?: number;
}) {
  return (
    <span className={`avatar ${size} avatar-${index % 5}`}>
      {initials(name)}
    </span>
  );
}
export function Spinner({ label = "Cargando..." }: { label?: string }) {
  return (
    <div className="loading-state" role="status">
      <LoaderCircle className="spin" size={22} />
      <span>{label}</span>
    </div>
  );
}
export function ErrorState({
  message,
  retry,
}: {
  message: string;
  retry?: () => void;
}) {
  return (
    <div className="error-state" role="alert">
      <CircleAlert size={22} />
      <p>{message}</p>
      {retry && (
        <button className="button secondary" onClick={retry}>
          Volver a intentar
        </button>
      )}
    </div>
  );
}
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <MessageCircle size={26} />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function PageHeading({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow?: string;
  title: string;
  subtitle: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      {action && <div className="heading-action">{action}</div>}
    </div>
  );
}
export function SearchBox({
  value,
  onChange,
  placeholder = "Buscar...",
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  label?: string;
}) {
  return (
    <label className="search-box">
      <Search size={17} />
      <input
        aria-label={label ?? placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
      {value && (
        <button
          type="button"
          className="icon-button"
          aria-label="Limpiar búsqueda"
          onClick={() => onChange("")}
        >
          <X size={14} />
        </button>
      )}
    </label>
  );
}
export function StatusBadge({ status }: { status: string }) {
  const labels: Record<string, string> = {
    open: "En curso",
    pending: "Necesita atención",
    resolved: "Resuelta",
    confirmed: "Confirmado",
    preparing: "Preparando",
    shipped: "En camino",
    delivered: "Entregado",
    cancelled: "Cancelado",
  };
  return (
    <span className={`badge status-${status}`}>
      <i />
      {labels[status] ?? status}
    </span>
  );
}
export function Toggle({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className={`toggle ${checked ? "on" : ""}`}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      disabled={disabled}
    >
      <span />
    </button>
  );
}
export function Modal({
  title,
  description,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusTarget =
      ref.current?.querySelector<HTMLElement>("[data-autofocus]") ??
      ref.current?.querySelector<HTMLElement>(
        "input:not([type=file]), textarea, select",
      ) ??
      ref.current?.querySelector<HTMLElement>("button");
    focusTarget?.focus();
    const listener = (e: KeyboardEvent) => {
      if (e.key === "Escape") close.current();
      if (e.key === "Tab") {
        const nodes = ref.current?.querySelectorAll<HTMLElement>(
          "button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href]",
        );
        if (!nodes?.length) return;
        const first = nodes[0],
          last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", listener);
    return () => {
      document.removeEventListener("keydown", listener);
      document.body.style.overflow = previous;
      before?.focus();
    };
  }, []);
  return (
    <div
      className="modal-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`modal ${wide ? "wide" : ""}`}
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className="modal-header">
          <div>
            <h2 id="modal-title">{title}</h2>
            {description && <p>{description}</p>}
          </div>
          <button
            className="icon-button"
            aria-label="Cerrar ventana"
            onClick={onClose}
          >
            <X size={21} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
export function SaveButton({
  busy,
  children = "Guardar cambios",
}: {
  busy: boolean;
  children?: ReactNode;
}) {
  return (
    <button className="button primary" type="submit" disabled={busy}>
      {busy ? <LoaderCircle size={17} className="spin" /> : <Check size={17} />}{" "}
      {busy ? "Guardando..." : children}
    </button>
  );
}
export function HelpContent({ onGo }: { onGo: () => void }) {
  return (
    <div className="help-content">
      <div className="help-hero">
        <Sparkles size={27} />
        <h3>Una buena conversación empieza aquí.</h3>
        <p>
          Prepara tu tienda en tres pasos y deja las preguntas repetidas en
          manos de Cerca.
        </p>
      </div>
      {[
        [
          "1",
          "Cuéntale sobre tu tienda",
          "Define los horarios, envíos y el tono de tu asistente.",
        ],
        [
          "2",
          "Agrega productos y pedidos",
          "El asistente usa tu catálogo y solo muestra pedidos vinculados al número del cliente.",
        ],
        [
          "3",
          "Conecta WhatsApp Business",
          "Necesitas una aplicación de Meta, un número habilitado para la API y una dirección HTTPS pública.",
        ],
      ].map(([n, title, text]) => (
        <div className="help-step" key={n}>
          <span>{n}</span>
          <div>
            <h4>{title}</h4>
            <p>{text}</p>
          </div>
        </div>
      ))}
      <button className="button primary full-width" onClick={onGo}>
        Ir a configuración <ArrowRight size={16} />
      </button>
    </div>
  );
}
