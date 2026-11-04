import { useEffect, useState, useCallback, useRef } from "react";
import { standaloneMode, standaloneRequest } from "./standalone";
import { quoteCsvCell } from "../shared/catalog";

let csrfToken = "";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}
export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  if (standaloneMode) return standaloneRequest<T>(path, options);
  const controller = new AbortController();
  const externalAbort = () => controller.abort();
  options.signal?.addEventListener("abort", externalAbort, { once: true });
  if (options.signal?.aborted) controller.abort();
  const timeout = setTimeout(
    () => controller.abort(),
    path === "/simulator" || /\/voice\/sessions\/.+\/turn$/.test(path)
      ? 45000
      : 15000,
  );
  try {
    const response = await fetch(`/api${path}`, {
      ...options,
      signal: controller.signal,
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
        ...options.headers,
      },
    });
    if (!response.headers.get("content-type")?.includes("application/json"))
      throw new ApiError(
        "Esta dirección no está ejecutando el servidor de Cerca. Abre Cerca.html para la demo o usa el iniciador de la aplicación completa.",
        503,
      );
    const data = await response.json();
    if (!response.ok) {
      if (
        response.status === 401 &&
        path !== "/me" &&
        !path.startsWith("/auth/")
      )
        window.dispatchEvent(new Event("cerca:session-expired"));
      throw new ApiError(
        data.error || "No pudimos completar la solicitud.",
        response.status,
      );
    }
    if (typeof data.csrfToken === "string") csrfToken = data.csrfToken;
    if (path === "/auth/logout") csrfToken = "";
    return data as T;
  } catch (e) {
    if (controller.signal.aborted && !options.signal?.aborted)
      throw new ApiError(
        "El servidor tardó demasiado en responder. Comprueba que el iniciador siga abierto e inténtalo de nuevo.",
        504,
      );
    if (e instanceof TypeError)
      throw new ApiError(
        "No podemos conectar con el servidor. Mantén abierto el iniciador o abre Cerca.html para probar la demo sin servidor.",
        503,
      );
    throw e;
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener("abort", externalAbort);
  }
}
export const post = <T>(path: string, body: unknown = {}) =>
  api<T>(path, { method: "POST", body: JSON.stringify(body) });
export const put = <T>(path: string, body: unknown) =>
  api<T>(path, { method: "PUT", body: JSON.stringify(body) });
export const patch = <T>(path: string, body: unknown) =>
  api<T>(path, { method: "PATCH", body: JSON.stringify(body) });

export function useResource<T>(path: string, version = 0, poll = 0) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const currentPath = useRef(path);
  const reload = useCallback(() => setRevision((r) => r + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    if (currentPath.current !== path) {
      currentPath.current = path;
      setLoading(true);
      setData(null);
    }
    let alive = true;
    async function load() {
      try {
        const result = await api<T>(path, { signal: controller.signal });
        if (alive) {
          setData(result);
          setError("");
        }
      } catch (e) {
        if (alive && !controller.signal.aborted)
          setError(e instanceof Error ? e.message : "Error de conexión.");
      } finally {
        if (alive) setLoading(false);
      }
    }
    void load();
    const timer = poll ? setInterval(() => void load(), poll) : undefined;
    return () => {
      alive = false;
      controller.abort();
      clearInterval(timer);
    };
  }, [path, version, revision, poll]);
  return { data, error, loading, reload };
}

export const money = (n: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(n);
export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
export const time = (date: string) =>
  new Date(date).toLocaleTimeString("es-CO", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Bogota",
  });
export const dateLabel = (date: string) =>
  new Date(date).toLocaleDateString("es-CO", {
    day: "numeric",
    month: "short",
    timeZone: "America/Bogota",
  });
export function relativeTime(date: string) {
  const minutes = Math.max(
    0,
    Math.floor((Date.now() - new Date(date).getTime()) / 60000),
  );
  if (minutes < 1) return "Ahora";
  if (minutes < 60) return `Hace ${minutes} min`;
  if (minutes < 1440) return `Hace ${Math.floor(minutes / 60)} h`;
  return dateLabel(date);
}
export function exportCsv(filename: string, rows: (string | number)[][]) {
  const csv =
    "\uFEFF" + rows.map((row) => row.map(quoteCsvCell).join(",")).join("\r\n");
  const url = URL.createObjectURL(
    new Blob([csv], { type: "text/csv;charset=utf-8;" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
