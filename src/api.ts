import { useEffect, useState, useCallback } from 'react';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) { super(message); this.status = status; }
}
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api${path}`, { ...options, credentials: 'same-origin', headers: { 'Content-Type': 'application/json', ...options.headers } });
  const data = await response.json();
  if (!response.ok) throw new ApiError(data.error || 'No pudimos completar la solicitud.', response.status);
  return data as T;
}
export const post = <T,>(path: string, body: unknown = {}) => api<T>(path, { method: 'POST', body: JSON.stringify(body) });
export const put = <T,>(path: string, body: unknown) => api<T>(path, { method: 'PUT', body: JSON.stringify(body) });
export const patch = <T,>(path: string, body: unknown) => api<T>(path, { method: 'PATCH', body: JSON.stringify(body) });

export function useResource<T>(path: string, version = 0, poll = 0) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const reload = useCallback(() => setRevision(r => r + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    let alive = true;
    async function load() {
      try {
        const result = await api<T>(path, { signal: controller.signal });
        if (alive) { setData(result); setError(''); }
      } catch (e) { if (alive && !controller.signal.aborted) setError(e instanceof Error ? e.message : 'Error de conexión.'); }
      finally { if (alive) setLoading(false); }
    }
    void load();
    const timer = poll ? setInterval(() => void load(), poll) : undefined;
    return () => { alive = false; controller.abort(); clearInterval(timer); };
  }, [path, version, revision, poll]);
  return { data, error, loading, reload };
}

export const money = (n: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
export const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
export const time = (date: string) => new Date(date).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Bogota' });
export const dateLabel = (date: string) => new Date(date).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', timeZone: 'America/Bogota' });
export function relativeTime(date: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 60000));
  if (minutes < 1) return 'Ahora';
  if (minutes < 60) return `Hace ${minutes} min`;
  if (minutes < 1440) return `Hace ${Math.floor(minutes / 60)} h`;
  return dateLabel(date);
}
export function exportCsv(filename: string, rows: (string | number)[][]) {
  const csv = '\uFEFF' + rows.map(row => row.map(value => {
    let s = String(value);
    if (/^[=+@\-\t\r]/.test(s)) s = "'" + s;
    return '"' + s.replaceAll('"', '""') + '"';
  }).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
