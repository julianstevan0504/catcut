import { useEffect, useState } from "react";
import {
  ArrowDownToLine,
  ArrowRight,
  Check,
  CircleAlert,
  FileSpreadsheet,
  Laptop,
  LoaderCircle,
  MessageCircle,
  Package,
  Search,
  ShieldCheck,
  ShoppingBag,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  api,
  dateLabel,
  exportCsv,
  money,
  post,
  relativeTime,
  useResource,
} from "./api";
import { useApp } from "./context";
import {
  EmptyState,
  ErrorState,
  Modal,
  Spinner,
  StatusBadge,
} from "./components";
import { parseCatalogCsv } from "../shared/catalog";
import type { ProductInput } from "../shared/catalog";
import type { Conversation, Order, Product } from "./types";

export function QuickSearch({ onClose }: { onClose: () => void }) {
  const { navigate } = useApp();
  const [query, setQuery] = useState(""),
    [debounced, setDebounced] = useState("");
  useEffect(() => {
    const timer = setTimeout(
      () => setDebounced(query.trim().slice(0, 80)),
      200,
    );
    return () => clearTimeout(timer);
  }, [query]);
  const { data, error, loading } = useResource<{
    products: Product[];
    orders: Order[];
    conversations: Conversation[];
  }>(`/search?q=${encodeURIComponent(debounced)}`);
  const count =
    (data?.products.length ?? 0) +
    (data?.orders.length ?? 0) +
    (data?.conversations.length ?? 0);
  function go(page: "products" | "orders" | "inbox", id: string) {
    onClose();
    navigate(page, id);
  }
  return (
    <Modal
      title="Encuentra lo que necesitas."
      description="Busca productos, pedidos o conversaciones de tu tienda."
      onClose={onClose}
      wide
    >
      <div className="command-search">
        <label>
          <Search size={20} />
          <input
            autoFocus
            aria-label="Buscar en toda la tienda"
            placeholder="Nombre, SKU, pedido o teléfono..."
            maxLength={80}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button
              className="icon-button"
              aria-label="Limpiar búsqueda global"
              onClick={() => setQuery("")}
            >
              <X size={16} />
            </button>
          )}
        </label>
      </div>
      <div className="command-results">
        {query.length < 2 ? (
          <EmptyState
            title="Todo tu negocio, a una búsqueda."
            description="Escribe al menos dos caracteres. Puedes abrir esta ventana con Ctrl + K o ⌘ + K."
          />
        ) : error ? (
          <ErrorState message={error} />
        ) : loading || debounced !== query.trim() ? (
          <Spinner label="Buscando en tu tienda..." />
        ) : !count ? (
          <EmptyState
            title="No encontramos coincidencias"
            description="Prueba con otra palabra, un SKU o el código del pedido."
          />
        ) : (
          <>
            {!!data?.conversations.length && (
              <>
                <div className="command-group">CONVERSACIONES</div>
                {data.conversations.map((c) => (
                  <button key={c.id} onClick={() => go("inbox", c.id)}>
                    <span className="command-icon">
                      <MessageCircle size={18} />
                    </span>
                    <span>
                      <strong>{c.name}</strong>
                      <small>{c.phone}</small>
                    </span>
                    <StatusBadge status={c.status} />
                    <ArrowRight size={15} />
                  </button>
                ))}
              </>
            )}
            {!!data?.products.length && (
              <>
                <div className="command-group">PRODUCTOS</div>
                {data.products.map((p) => (
                  <button key={p.id} onClick={() => go("products", p.id)}>
                    <span className="command-icon">
                      <Package size={18} />
                    </span>
                    <span>
                      <strong>{p.name}</strong>
                      <small>
                        {p.sku} · {p.stock} unidades
                      </small>
                    </span>
                    <b>{money(p.price)}</b>
                    <ArrowRight size={15} />
                  </button>
                ))}
              </>
            )}
            {!!data?.orders.length && (
              <>
                <div className="command-group">PEDIDOS</div>
                {data.orders.map((o) => (
                  <button key={o.id} onClick={() => go("orders", o.id)}>
                    <span className="command-icon">
                      <ShoppingBag size={18} />
                    </span>
                    <span>
                      <strong>#{o.code}</strong>
                      <small>{o.customer}</small>
                    </span>
                    <StatusBadge status={o.status} />
                    <ArrowRight size={15} />
                  </button>
                ))}
              </>
            )}
          </>
        )}
      </div>
      <div className="command-footer">
        <ShieldCheck size={13} /> Los resultados pertenecen solo a tu tienda.
        <span>Esc para cerrar</span>
      </div>
    </Modal>
  );
}

export function ImportCatalog({
  onClose,
  onDone,
}: {
  onClose: () => void;
  onDone: () => void;
}) {
  const { notify } = useApp();
  const [products, setProducts] = useState<ProductInput[]>([]),
    [errors, setErrors] = useState<string[]>([]),
    [fileName, setFileName] = useState(""),
    [updateExisting, setUpdateExisting] = useState(false),
    [busy, setBusy] = useState(false);
  async function read(file?: File) {
    if (!file) return;
    setProducts([]);
    setErrors([]);
    setFileName(file.name);
    try {
      if (file.size > 1000000) throw new Error("El archivo supera 1 MB.");
      const parsed = parseCatalogCsv(await file.text());
      setProducts(parsed.products);
      setErrors(parsed.errors);
    } catch (e) {
      setErrors([(e as Error).message]);
    }
  }
  function template() {
    exportCsv("plantilla-catalogo-cerca.csv", [
      ["nombre", "sku", "descripcion", "categoria", "precio", "stock", "color"],
      [
        "Mi primer producto",
        "NUEVO-001",
        "Describe materiales, tallas o detalles",
        "General",
        45000,
        10,
        "sage",
      ],
    ]);
  }
  async function submit() {
    setBusy(true);
    try {
      const result = await post<{ created: number; updated: number }>(
        "/products/import",
        { products, updateExisting },
      );
      notify(
        `Catálogo actualizado: ${result.created} nuevos y ${result.updated} actualizados.`,
      );
      onDone();
    } catch (e) {
      setErrors([(e as Error).message]);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title="Tu catálogo, sin copiar uno por uno."
      description="Importa un CSV de Excel o Google Sheets. Revisaremos los datos antes de guardarlos."
      onClose={onClose}
      wide
    >
      <div className="import-body">
        <div className="import-template">
          <span>
            <FileSpreadsheet size={21} />
            <span>
              <strong>Empieza con la plantilla</strong>
              <small>Columnas y un producto de ejemplo para guiarte.</small>
            </span>
          </span>
          <button className="button secondary" onClick={template}>
            <ArrowDownToLine size={15} /> Descargar
          </button>
        </div>
        <label className="file-drop">
          <Upload size={28} />
          <strong>{fileName || "Selecciona tu catálogo en CSV"}</strong>
          <span>
            Hasta 500 productos · 1 MB · separador coma o punto y coma
          </span>
          <input
            type="file"
            accept=".csv,text/csv"
            aria-label="Archivo CSV del catálogo"
            onChange={(e) => void read(e.target.files?.[0])}
          />
        </label>
        {errors.length > 0 && (
          <div className="import-errors" role="alert">
            <strong>
              <CircleAlert size={16} /> Revisa estos datos antes de importar
            </strong>
            <ul>
              {errors.slice(0, 8).map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
            {errors.length > 8 && (
              <p>
                Y {errors.length - 8} errores más. No se guardará ninguna fila
                hasta corregirlos.
              </p>
            )}
          </div>
        )}
        {products.length > 0 && (
          <>
            <div className="import-preview-heading">
              <strong>Vista previa</strong>
              <span>{products.length} productos válidos</span>
            </div>
            <div className="table-scroll import-preview">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>PRODUCTO</th>
                    <th>SKU</th>
                    <th>PRECIO COP</th>
                    <th>STOCK</th>
                  </tr>
                </thead>
                <tbody>
                  {products.slice(0, 6).map((p) => (
                    <tr key={p.sku}>
                      <td>{p.name}</td>
                      <td>{p.sku}</td>
                      <td>{money(p.price)}</td>
                      <td>{p.stock}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {products.length > 6 && (
              <p className="import-more">
                Se muestran 6 de {products.length} productos.
              </p>
            )}
            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={updateExisting}
                onChange={(e) => setUpdateExisting(e.target.checked)}
              />
              <span>
                <strong>Actualizar productos que ya tengan el mismo SKU</strong>
                <small>
                  Reemplazará nombre, descripción, categoría, precio y stock de
                  esos productos. Los demás se agregarán como nuevos.
                </small>
              </span>
            </label>
          </>
        )}
      </div>
      <div className="modal-actions import-actions">
        <button className="button secondary" onClick={onClose}>
          Cancelar
        </button>
        <button
          className="button primary"
          onClick={() => void submit()}
          disabled={busy || !products.length || !!errors.length}
        >
          {busy ? (
            <LoaderCircle size={16} className="spin" />
          ) : (
            <Check size={16} />
          )}{" "}
          {busy
            ? "Importando..."
            : `Importar ${products.length || ""} productos`}
        </button>
      </div>
    </Modal>
  );
}

type DeviceSession = {
  id: string;
  user_agent: string;
  current: boolean;
  created_at: string;
  last_seen_at: string;
};
export function SecurityTools() {
  const { session, notify, refresh, refreshSession } = useApp();
  const [exporting, setExporting] = useState(false),
    [resetting, setResetting] = useState(false),
    [confirmReset, setConfirmReset] = useState(false);
  async function exportData() {
    setExporting(true);
    try {
      const data = await post("/account/export");
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = `cerca-datos-${new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" })}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      notify(
        "Copia exportada. No incluye contraseñas ni credenciales de WhatsApp.",
      );
      refresh();
    } catch (e) {
      notify((e as Error).message, true);
    } finally {
      setExporting(false);
    }
  }
  async function reset() {
    setResetting(true);
    try {
      await post("/demo/reset");
      await refreshSession();
      setConfirmReset(false);
      notify("La demo volvió a sus datos de ejemplo.");
    } catch (e) {
      notify((e as Error).message, true);
    } finally {
      setResetting(false);
    }
  }
  return (
    <>
      <section className="card security-overview">
        <div className="security-hero">
          <span className="security-shield">
            <ShieldCheck size={28} />
          </span>
          <div>
            <h3>Más tranquilidad para tu negocio.</h3>
            <p>
              {session.offline
                ? "Esta demo funciona en tu navegador y no utiliza contraseñas ni credenciales reales."
                : "Tu cuenta usa contraseñas protegidas, sesiones con caducidad y comprobaciones de seguridad en cada cambio."}
            </p>
          </div>
        </div>
        <div className="security-checks">
          <span>
            <Check size={15} /> Datos separados por tienda
          </span>
          <span>
            <Check size={15} /> Credenciales cifradas en el servidor
          </span>
          <span>
            <Check size={15} /> Seguimiento de pedidos autorizado
          </span>
          <span>
            <Check size={15} /> Registro de cambios y accesos
          </span>
        </div>
      </section>
      {!session.offline && <SessionList />}
      <section className="card">
        <div className="card-header">
          <div>
            <h3>Tus datos también viajan contigo.</h3>
            <p>
              Descarga productos, pedidos, conversaciones y actividad en un
              archivo JSON.
            </p>
          </div>
          <ArrowDownToLine size={21} />
        </div>
        <div className="data-export">
          <p>
            La copia contiene información de tu tienda y clientes. Guárdala en
            un lugar privado. No incluye contraseñas, claves de IA, tokens ni
            secretos de Meta.
          </p>
          <button
            className="button secondary"
            onClick={() => void exportData()}
            disabled={exporting}
          >
            {exporting ? (
              <LoaderCircle size={16} className="spin" />
            ) : (
              <ArrowDownToLine size={16} />
            )}{" "}
            Exportar mis datos
          </button>
        </div>
      </section>
      {session.offline && (
        <section className="card demo-reset-card">
          <div>
            <h3>Empieza otra vez, sin perderte.</h3>
            <p>
              Puedes exportar tus pruebas antes de restaurar los datos de
              ejemplo de esta demo.
            </p>
          </div>
          <button
            className="button secondary"
            onClick={() => setConfirmReset(true)}
          >
            <Trash2 size={15} /> Reiniciar demo
          </button>
        </section>
      )}
      {confirmReset && (
        <Modal
          title="¿Volver a los datos de ejemplo?"
          description="Se reemplazarán los cambios de esta demo guardados en tu navegador. Exporta una copia primero si quieres conservarlos."
          onClose={() => setConfirmReset(false)}
        >
          <div className="modal-actions">
            <button
              className="button secondary"
              onClick={() => setConfirmReset(false)}
            >
              Conservar mis pruebas
            </button>
            <button
              className="button danger-button"
              onClick={() => void reset()}
              disabled={resetting}
            >
              {resetting ? (
                <LoaderCircle size={16} className="spin" />
              ) : (
                <Trash2 size={16} />
              )}{" "}
              Restaurar demo
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
function SessionList() {
  const { version, notify } = useApp();
  const { data, loading, error, reload } = useResource<DeviceSession[]>(
    "/account/sessions",
    version,
  );
  const [busy, setBusy] = useState("");
  async function revoke(id?: string) {
    setBusy(id ?? "all");
    try {
      if (id)
        await api(`/account/sessions/${id}`, { method: "DELETE", body: "{}" });
      else await post("/account/sessions/revoke-others");
      reload();
      notify(
        id
          ? "Sesión cerrada en ese dispositivo."
          : "Las otras sesiones se cerraron.",
      );
    } catch (e) {
      notify((e as Error).message, true);
    } finally {
      setBusy("");
    }
  }
  return (
    <section className="card">
      <div className="card-header">
        <div>
          <h3>¿Dónde está abierta tu cuenta?</h3>
          <p>
            Las sesiones caducan tras 24 horas sin actividad o a los 7 días de
            abrirlas.
          </p>
        </div>
        <Laptop size={21} />
      </div>
      {loading ? (
        <Spinner />
      ) : error ? (
        <ErrorState message={error} retry={reload} />
      ) : (
        <div className="device-sessions">
          {data?.map((s) => (
            <div key={s.id}>
              <span className="session-device-icon">
                <Laptop size={21} />
              </span>
              <span>
                <strong>
                  {/mobile|android|iphone/i.test(s.user_agent)
                    ? "Dispositivo móvil"
                    : "Computador"}{" "}
                  {s.current && <b>Esta sesión</b>}
                </strong>
                <small>
                  Última actividad: {relativeTime(s.last_seen_at)} · abierta el{" "}
                  {dateLabel(s.created_at)}
                </small>
                <small className="device-user-agent" title={s.user_agent}>
                  {s.user_agent}
                </small>
              </span>
              {!s.current && (
                <button
                  className="button secondary"
                  disabled={!!busy}
                  onClick={() => void revoke(s.id)}
                >
                  {busy === s.id ? (
                    <LoaderCircle size={14} className="spin" />
                  ) : (
                    <X size={14} />
                  )}{" "}
                  Cerrar
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      <div className="form-actions">
        <span>
          <ShieldCheck size={14} /> Solo se muestran tus sesiones
        </span>
        <button
          className="button secondary"
          disabled={!!busy || (data?.length ?? 0) < 2}
          onClick={() => void revoke()}
        >
          {busy === "all" ? (
            <LoaderCircle size={15} className="spin" />
          ) : (
            <X size={15} />
          )}{" "}
          Cerrar las otras sesiones
        </button>
      </div>
    </section>
  );
}
