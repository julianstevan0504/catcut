import { useEffect, useRef, useState } from "react";
import type { CSSProperties, FormEvent } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  CheckCircle2,
  ChefHat,
  Clock3,
  Coffee,
  Copy,
  QrCode,
  ExternalLink,
  Flame,
  MapPin,
  Minus,
  Phone,
  Plus,
  Search,
  ShoppingBag,
  Sparkles,
  Trash2,
  Users,
  UtensilsCrossed,
  Printer,
  Globe,
  ShieldCheck,
} from "lucide-react";
import { post, put, useResource, money, relativeTime } from "./api";
import { useApp } from "./context";
import {
  Modal,
  PageHeading,
  Spinner,
  ErrorState,
  Toggle,
  SaveButton,
  Logo,
} from "./components";
import { standaloneMode } from "./standalone";
import { ImageUploader, PhotoLibrary, imageSrc } from "./Images";
import type { Product } from "./types";
import type { RestaurantProfile } from "../shared/restaurant";
import {
  defaultDesign,
  storefrontTheme,
  whatsappUrl,
} from "../shared/storefront";
import {
  localParts,
  restaurantStatusLabels,
  restaurantHours,
} from "../shared/restaurant";
export type Reservation = {
  id: string;
  code: string;
  name: string;
  phone: string;
  party_size: number;
  start_at: string;
  end_at: string;
  status: string;
  notes: string;
  source: string;
};
export type KitchenOrder = {
  id: string;
  code: string;
  customer: string;
  phone: string;
  status: string;
  total: number;
  created_at: string;
  lines: {
    product_id: string;
    name: string;
    unit_price: number;
    quantity: number;
  }[];
  details: {
    fulfillment: "dineIn" | "pickup" | "delivery";
    delivery_address: string;
    delivery_zone: string;
    delivery_fee: number;
    table_label: string;
    notes: string;
    payment_method: string;
  };
  paymentStatus: string;
};
const serviceName = {
  dineIn: "En mesa",
  pickup: "Para recoger",
  delivery: "A domicilio",
};
const reservationLabels: Record<string, string> = {
  pending: "Por confirmar",
  confirmed: "Confirmada",
  seated: "En mesa",
  completed: "Finalizada",
  cancelled: "Cancelada",
  "no-show": "No asistió",
};
const reservationTime = (date: string, zone = "America/Bogota") =>
  new Intl.DateTimeFormat("es-CO", {
    timeZone: zone,
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
export function DishArt({ kind = "dish" }: { kind?: string }) {
  return (
    <svg
      viewBox="0 0 240 170"
      className={"dish-art dish-" + kind}
      aria-hidden="true"
    >
      <ellipse
        cx="120"
        cy="143"
        rx="72"
        ry="12"
        fill="currentColor"
        opacity=".09"
      />
      {kind === "drink" ? (
        <g fill="none" stroke="currentColor" strokeWidth="3">
          <path
            d="M84 39H156L146 139H94Z"
            fill="currentColor"
            fillOpacity=".11"
          />
          <path d="M103 108 132 15H166M87 69Q120 85 153 69" />
          <circle
            cx="151"
            cy="39"
            r="23"
            fill="currentColor"
            fillOpacity=".08"
          />
          <path d="M151 17V61M130 39H173" />
        </g>
      ) : (
        <g fill="none" stroke="currentColor" strokeWidth="2.5">
          <ellipse
            cx="120"
            cy="92"
            rx="76"
            ry="45"
            fill="currentColor"
            fillOpacity=".08"
          />
          <ellipse cx="120" cy="88" rx="58" ry="32" />
          <path d="M27 32V68Q27 79 19 79V140M11 32V67M19 32V140M209 31V140M209 31Q235 57 209 81" />
          <path d="M88 88Q101 65 121 81T153 89M93 105Q120 126 150 103" />
          <path d="M104 40Q93 30 105 17M126 40Q115 30 127 17" />
        </g>
      )}
    </svg>
  );
}
export function RestaurantDashboard() {
  const { session, navigate, version } = useApp();
  const { data: profile } = useResource<RestaurantProfile>(
      "/restaurant",
      version,
    ),
    { data: orders } = useResource<KitchenOrder[]>("/kitchen", version, 10000),
    { data: reservations } = useResource<Reservation[]>(
      "/reservations",
      version,
      15000,
    ),
    { data: products } = useResource<Product[]>("/products", version);
  const today = localParts(
      new Date(),
      profile?.timezone ?? "America/Bogota",
    ).date,
    arrivals = (reservations ?? []).filter(
      (r) =>
        localParts(new Date(r.start_at), profile?.timezone ?? "America/Bogota")
          .date === today && !["cancelled", "no-show"].includes(r.status),
    ),
    waiting = (reservations ?? []).filter((r) => r.status === "pending");
  return (
    <div className="restaurant-dashboard">
      <section className="restaurant-dashboard-hero">
        <div>
          <span className="restaurant-eyebrow">
            <span /> TU RESTAURANTE, CONECTADO
          </span>
          <h1>
            Hoy se cocina
            <br />
            algo bueno<span>.</span>
          </h1>
          <p>
            Hola, {session.user.name}. Tu atención, tus mesas y tu cocina,
            <br />
            en un mismo lugar.
          </p>
          <div className="restaurant-hero-actions">
            <button
              className="button primary"
              onClick={() => navigate("assistant")}
            >
              <Sparkles size={16} /> Abrir mi asistente
            </button>
            <button
              className="button secondary"
              onClick={() => navigate("restaurant")}
            >
              Mi restaurante <ArrowUpRight size={15} />
            </button>
          </div>
        </div>
        <div className="restaurant-hero-plate" aria-hidden="true">
          <div className="hero-plate-ring" />
          <DishArt />
          <span className="hero-plate-note">
            <i /> Buen servicio, de principio a fin.
          </span>
          <span className="hero-float one">
            <ChefHat size={21} />
          </span>
          <span className="hero-float two">
            <Coffee size={19} />
          </span>
        </div>
      </section>
      <div className="restaurant-metrics">
        {[
          {
            value: orders?.length ?? 0,
            label: "Pedidos en curso",
            note: "Recibidos desde tu menú",
            icon: ChefHat,
            to: "kitchen",
          },
          {
            value: arrivals.length,
            label: "Reservas para hoy",
            note:
              arrivals.reduce((n, r) => n + r.party_size, 0) +
              " personas previstas",
            icon: CalendarDays,
            to: "reservations",
          },
          {
            value: waiting.length,
            label: "Por confirmar",
            note: "Reservas que necesitan revisión",
            icon: Users,
            to: "reservations",
          },
          {
            value: products?.filter((p) => p.stock > 0).length ?? 0,
            label: "Opciones disponibles",
            note: "Actualizadas con tu inventario",
            icon: UtensilsCrossed,
            to: "products",
          },
        ].map((x) => (
          <button
            key={x.label}
            className="restaurant-metric"
            onClick={() => navigate(x.to as "kitchen")}
          >
            <span>
              <x.icon size={18} />
              <ArrowUpRight size={14} />
            </span>
            <strong>{x.value}</strong>
            <b>{x.label}</b>
            <small>{x.note}</small>
          </button>
        ))}
      </div>
      <div className="restaurant-dashboard-grid">
        <section className="card restaurant-section">
          <div className="restaurant-card-heading">
            <div>
              <span className="eyebrow">EL SIGUIENTE SERVICIO</span>
              <h2>Tu cocina, al día.</h2>
            </div>
            <button className="text-button" onClick={() => navigate("kitchen")}>
              Ver cocina <ArrowRight size={15} />
            </button>
          </div>
          {orders?.length ? (
            orders.slice(0, 4).map((o) => (
              <button
                className="restaurant-order-summary"
                key={o.id}
                onClick={() => navigate("kitchen")}
              >
                <span className="restaurant-small-icon">
                  <ShoppingBag size={18} />
                </span>
                <span>
                  <strong>
                    {o.code} · {o.customer}
                  </strong>
                  <small>
                    {serviceName[o.details.fulfillment]} ·{" "}
                    {relativeTime(o.created_at)}
                  </small>
                </span>
                <b>{restaurantStatusLabels[o.status]}</b>
              </button>
            ))
          ) : (
            <div className="restaurant-soft-empty">
              <ChefHat size={35} />
              <h3>Todo preparado para recibir pedidos.</h3>
              <p>
                Publica tu menú y comparte su enlace. Los pedidos aparecerán
                aquí y en Cocina.
              </p>
              <button
                className="button secondary"
                onClick={() => navigate("restaurant")}
              >
                Preparar mi menú público
              </button>
            </div>
          )}
        </section>
        <section className="card restaurant-section restaurant-next-steps">
          <span className="restaurant-section-icon">
            <UtensilsCrossed size={23} />
          </span>
          <h2>
            Un restaurante
            <br />
            con todo a punto.
          </h2>
          <p>
            Completa estos pasos para que tus clientes puedan elegir, pedir y
            reservar.
          </p>
          {[
            {
              done: Boolean(products?.length),
              label: "Cargar platos, precios y fotos",
              to: "products",
            },
            {
              done: Boolean(profile?.address),
              label: "Configurar local y horarios",
              to: "restaurant",
            },
            {
              done: Boolean(profile?.publicEnabled),
              label: "Publicar el menú del restaurante",
              to: "restaurant",
            },
            {
              done: Boolean(profile?.reservationsEnabled),
              label: "Habilitar reservas con capacidad",
              to: "restaurant",
            },
          ].map((x) => (
            <button
              key={x.label}
              onClick={() => navigate(x.to as "restaurant")}
            >
              <span className={x.done ? "complete" : ""}>
                {x.done ? <Check size={13} /> : <span />}
              </span>
              {x.label}
              <ArrowRight size={14} />
            </button>
          ))}
        </section>
      </div>
      <section className="restaurant-service-strip">
        <div>
          <span>
            <Phone size={20} />
          </span>
          <strong>Llamadas que pueden interrumpirse</strong>
          <p>Una conversación más natural, con datos del restaurante.</p>
        </div>
        <div>
          <span>
            <CalendarDays size={20} />
          </span>
          <strong>Mesas sin sobrecupos</strong>
          <p>La disponibilidad se comprueba antes de registrar cada reserva.</p>
        </div>
        <div>
          <span>
            <ShieldCheck size={20} />
          </span>
          <strong>Tu negocio tiene su espacio</strong>
          <p>Menú, clientes, pedidos y conversaciones separados por cuenta.</p>
        </div>
      </section>
    </div>
  );
}
export function RestaurantSettings() {
  const { version, notify, refresh } = useApp();
  const { data, loading, error, reload } = useResource<
      RestaurantProfile & { publicUrl: string }
    >("/restaurant", version),
    { data: products } = useResource<Product[]>("/products", version);
  const [draft, setDraft] = useState<RestaurantProfile | null>(null),
    [busy, setBusy] = useState(false),
    [tab, setTab] = useState("brand"),
    [photos, setPhotos] = useState(false);
  useEffect(() => {
    if (data && !draft) setDraft(data);
  }, [data, draft]);
  if (error) return <ErrorState message={error} retry={reload} />;
  if (loading || !draft) return <Spinner />;
  const change = <K extends keyof RestaurantProfile>(
    k: K,
    v: RestaurantProfile[K],
  ) => setDraft((d) => (d ? { ...d, [k]: v } : d));
  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await put("/restaurant", draft);
      refresh();
      notify("Tu restaurante y su menú público están actualizados.");
    } catch (e) {
      notify((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  }
  async function qr() {
    try {
      if (!data?.publicEnabled)
        throw Error("Publica el menú antes de crear su código QR.");
      const QR = await import("qrcode");
      const uri = await QR.toDataURL(data.publicUrl, {
        width: 1024,
        margin: 3,
        color: { dark: "#2c5544", light: "#ffffff" },
      });
      const a = document.createElement("a");
      a.href = uri;
      a.download = "menu-" + data.slug + "-qr.png";
      a.click();
      notify("Código QR del menú descargado.");
    } catch (e) {
      notify((e as Error).message, true);
    }
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(data!.publicUrl);
      notify("Enlace del menú copiado.");
    } catch {
      notify("Selecciona y copia el enlace del campo.", true);
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="LA EXPERIENCIA EMPIEZA AQUÍ"
        title="Un lugar que se siente tuyo."
        subtitle="Define el estilo, los horarios y cómo atenderás a tus clientes."
      />
      {photos && <PhotoLibrary onClose={() => setPhotos(false)} />}
      <div className="restaurant-setup-layout">
        <form
          className="card restaurant-settings-form"
          onSubmit={(e) => void save(e)}
        >
          <div className="restaurant-tabs">
            {[
              { id: "brand", name: "Identidad y menú" },
              { id: "service", name: "Atención y pedidos" },
              { id: "booking", name: "Horarios y reservas" },
            ].map((t) => (
              <button
                type="button"
                key={t.id}
                className={tab === t.id ? "selected" : ""}
                onClick={() => setTab(t.id)}
              >
                {t.name}
              </button>
            ))}
          </div>
          {tab === "brand" && (
            <div className="restaurant-settings-body">
              <span className="eyebrow">LA PRIMERA IMPRESIÓN</span>
              <h2>Tu marca en cada detalle.</h2>
              <div className="restaurant-photos">
                <ImageUploader
                  label="Foto de portada del restaurante"
                  value={
                    draft.coverImageId
                      ? imageSrc(draft.coverImageId)
                      : undefined
                  }
                  onChange={(id) => change("coverImageId", id)}
                />
                <ImageUploader
                  label="Logo del restaurante"
                  value={
                    draft.logoImageId ? imageSrc(draft.logoImageId) : undefined
                  }
                  onChange={(id) => change("logoImageId", id)}
                />
              </div>
              <button
                type="button"
                className="text-button"
                onClick={() => setPhotos(true)}
              >
                Gestionar fotos y espacio
              </button>
              <label className="field-label">
                Tipo de cocina
                <input
                  value={draft.cuisine}
                  required
                  maxLength={100}
                  onChange={(e) => change("cuisine", e.target.value)}
                  placeholder="Ej. Cocina colombiana de autor"
                />
              </label>
              <label className="field-label">
                Presentación del restaurante
                <textarea
                  rows={3}
                  maxLength={500}
                  value={draft.welcome}
                  onChange={(e) => change("welcome", e.target.value)}
                />
              </label>
              <fieldset className="restaurant-theme-picker">
                <legend>Estilo del menú</legend>
                {[
                  { id: "terracotta", name: "Tierra · cálido y cercano" },
                  { id: "jade", name: "Jade · fresco y natural" },
                  { id: "violet", name: "Ciruela · contemporáneo" },
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className={
                      t.id + (draft.accent === t.id ? " selected" : "")
                    }
                    aria-pressed={draft.accent === t.id}
                    onClick={() =>
                      change("accent", t.id as RestaurantProfile["accent"])
                    }
                  >
                    <i />
                    {t.name}
                    {draft.accent === t.id && <Check size={15} />}
                  </button>
                ))}
              </fieldset>
              <div className="voice-setting-row">
                <span>
                  <strong>Publicar el menú</strong>
                  <small>
                    Permite que los clientes vean el menú y envíen pedidos desde
                    su enlace.
                  </small>
                </span>
                <Toggle
                  label="Publicar menú del restaurante"
                  checked={draft.publicEnabled}
                  onChange={() => change("publicEnabled", !draft.publicEnabled)}
                />
              </div>
              <label className="field-label">
                Nombre del enlace
                <input
                  required
                  value={draft.slug}
                  maxLength={60}
                  pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                  onChange={(e) => change("slug", e.target.value)}
                  placeholder="mi-restaurante"
                />
              </label>
            </div>
          )}
          {tab === "service" && (
            <div className="restaurant-settings-body">
              <span className="eyebrow">COMO PREFIEREN TUS CLIENTES</span>
              <h2>Una cocina, distintas formas de atender.</h2>
              <div className="voice-setting-row">
                <span>
                  <strong>Recibir pedidos del menú y del asistente</strong>
                  <small>
                    Pausa al cerrar o si la cocina está saturada. El menú y las
                    reservas siguen visibles; el cambio es manual.
                  </small>
                </span>
                <Toggle
                  label="Recibir pedidos online"
                  checked={draft.acceptingOrders}
                  onChange={() =>
                    change("acceptingOrders", !draft.acceptingOrders)
                  }
                />
              </div>
              <div className="form-row">
                <label className="field-label">
                  Dirección del restaurante
                  <input
                    value={draft.address}
                    maxLength={300}
                    onChange={(e) => change("address", e.target.value)}
                    placeholder="Dirección real para visitas y recogida"
                  />
                </label>
                <label className="field-label">
                  Teléfono de contacto
                  <input
                    type="tel"
                    value={draft.phone}
                    maxLength={30}
                    onChange={(e) => change("phone", e.target.value)}
                    placeholder="+57…"
                  />
                </label>
              </div>
              {(["dineIn", "pickup", "delivery"] as const).map((key) => (
                <div className="voice-setting-row" key={key}>
                  <span>
                    <strong>{serviceName[key]}</strong>
                    <small>
                      {key === "delivery"
                        ? "Configura zonas y tarifas para calcular el total."
                        : key === "dineIn"
                          ? "Los clientes indican su mesa al pedir."
                          : "El cliente recoge su pedido en el local."}
                    </small>
                  </span>
                  <Toggle
                    label={"Habilitar " + serviceName[key].toLowerCase()}
                    checked={draft.services[key]}
                    onChange={() =>
                      change("services", {
                        ...draft.services,
                        [key]: !draft.services[key],
                      })
                    }
                  />
                </div>
              ))}
              {draft.services.delivery && (
                <div className="delivery-zone-editor">
                  <h3>Zonas de domicilio</h3>
                  {draft.deliveryZones.map((z) => (
                    <div className="delivery-zone-row" key={z.id}>
                      <label className="field-label">
                        Zona
                        <input
                          required
                          value={z.name}
                          maxLength={100}
                          onChange={(e) =>
                            change(
                              "deliveryZones",
                              draft.deliveryZones.map((x) =>
                                x.id === z.id
                                  ? { ...x, name: e.target.value }
                                  : x,
                              ),
                            )
                          }
                        />
                      </label>
                      <label className="field-label">
                        Tarifa COP
                        <input
                          required
                          type="number"
                          min={0}
                          step={1}
                          max={100000000}
                          value={z.fee}
                          onChange={(e) =>
                            change(
                              "deliveryZones",
                              draft.deliveryZones.map((x) =>
                                x.id === z.id
                                  ? { ...x, fee: Number(e.target.value) }
                                  : x,
                              ),
                            )
                          }
                        />
                      </label>
                      <button
                        className="icon-button danger"
                        type="button"
                        aria-label={"Eliminar zona " + z.name}
                        onClick={() =>
                          change(
                            "deliveryZones",
                            draft.deliveryZones.filter((x) => x.id !== z.id),
                          )
                        }
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    className="button secondary"
                    onClick={() =>
                      change("deliveryZones", [
                        ...draft.deliveryZones,
                        { id: crypto.randomUUID(), name: "", fee: 0 },
                      ])
                    }
                  >
                    <Plus size={15} /> Agregar zona
                  </button>
                </div>
              )}
              <div className="form-row">
                <label className="field-label">
                  Preparación estimada (minutos)
                  <input
                    type="number"
                    min={5}
                    max={240}
                    required
                    value={draft.prepMinutes}
                    onChange={(e) =>
                      change("prepMinutes", Number(e.target.value))
                    }
                  />
                </label>
                <label className="field-label">
                  Pedido mínimo de productos (COP)
                  <input
                    type="number"
                    min={0}
                    max={1000000000}
                    required
                    value={draft.minimumOrder}
                    onChange={(e) =>
                      change("minimumOrder", Number(e.target.value))
                    }
                  />
                </label>
              </div>
              <p className="form-hint">
                Los pagos se verifican en el restaurante. La plataforma no
                solicita números de tarjeta ni confirma pagos automáticamente.
              </p>
            </div>
          )}
          {tab === "booking" && (
            <div className="restaurant-settings-body">
              <span className="eyebrow">EL ESPACIO PARA COMPARTIR</span>
              <h2>Reservas con capacidad real.</h2>
              <div className="voice-setting-row">
                <span>
                  <strong>Aceptar solicitudes de reserva</strong>
                  <small>
                    Quedan por confirmar en tu panel y ocupan capacidad hasta
                    que se revisen o cancelen.
                  </small>
                </span>
                <Toggle
                  label="Aceptar reservas"
                  checked={draft.reservationsEnabled}
                  onChange={() =>
                    change("reservationsEnabled", !draft.reservationsEnabled)
                  }
                />
              </div>
              <div className="form-row">
                <label className="field-label">
                  Capacidad total de personas
                  <input
                    type="number"
                    min={1}
                    max={500}
                    required
                    value={draft.capacity}
                    onChange={(e) => change("capacity", Number(e.target.value))}
                  />
                </label>
                <label className="field-label">
                  Grupo máximo por reserva
                  <input
                    type="number"
                    min={1}
                    max={50}
                    required
                    value={draft.maxParty}
                    onChange={(e) => change("maxParty", Number(e.target.value))}
                  />
                </label>
              </div>
              <div className="form-row">
                <label className="field-label">
                  Duración de la visita (minutos)
                  <input
                    type="number"
                    min={30}
                    max={240}
                    step={15}
                    required
                    value={draft.visitMinutes}
                    onChange={(e) =>
                      change("visitMinutes", Number(e.target.value))
                    }
                  />
                </label>
                <label className="field-label">
                  Separación entre horarios (minutos)
                  <input
                    type="number"
                    min={15}
                    max={120}
                    step={15}
                    required
                    value={draft.slotMinutes}
                    onChange={(e) =>
                      change("slotMinutes", Number(e.target.value))
                    }
                  />
                </label>
              </div>
              <label className="field-label">
                Anticipación máxima (días)
                <input
                  type="number"
                  min={1}
                  max={180}
                  required
                  value={draft.horizonDays}
                  onChange={(e) =>
                    change("horizonDays", Number(e.target.value))
                  }
                />
              </label>
              <label className="field-label">
                Zona horaria
                <select
                  value={draft.timezone}
                  onChange={(e) => change("timezone", e.target.value)}
                >
                  {[
                    "America/Bogota",
                    "America/Mexico_City",
                    "America/Lima",
                    "America/Santiago",
                    "America/New_York",
                    "Europe/Madrid",
                  ].map((z) => (
                    <option key={z}>{z}</option>
                  ))}
                </select>
              </label>
              <div className="restaurant-weekly-hours">
                <h3>Horarios del restaurante</h3>
                {[
                  "Domingo",
                  "Lunes",
                  "Martes",
                  "Miércoles",
                  "Jueves",
                  "Viernes",
                  "Sábado",
                ].map((day, i) => {
                  const ranges = draft.schedule.filter((r) => r.day === i);
                  return (
                    <div className="restaurant-day" key={day}>
                      <label className="schedule-day-check">
                        <input
                          type="checkbox"
                          checked={ranges.length > 0}
                          onChange={(e) =>
                            change(
                              "schedule",
                              e.target.checked
                                ? [
                                    ...draft.schedule,
                                    { day: i, open: "12:00", close: "22:00" },
                                  ]
                                : draft.schedule.filter((r) => r.day !== i),
                            )
                          }
                        />
                        {day}
                      </label>
                      <div>
                        {ranges.length ? (
                          ranges.map((r, index) => (
                            <div className="schedule-range" key={index}>
                              <input
                                type="time"
                                aria-label={
                                  "Apertura " + day + " " + (index + 1)
                                }
                                value={r.open}
                                onChange={(e) =>
                                  change(
                                    "schedule",
                                    draft.schedule.map((x) =>
                                      x === r
                                        ? { ...x, open: e.target.value }
                                        : x,
                                    ),
                                  )
                                }
                              />
                              <span>a</span>
                              <input
                                type="time"
                                aria-label={"Cierre " + day + " " + (index + 1)}
                                value={r.close}
                                onChange={(e) =>
                                  change(
                                    "schedule",
                                    draft.schedule.map((x) =>
                                      x === r
                                        ? { ...x, close: e.target.value }
                                        : x,
                                    ),
                                  )
                                }
                              />
                              {ranges.length === 2 && (
                                <button
                                  type="button"
                                  className="icon-button danger"
                                  aria-label={"Quitar franja " + day}
                                  onClick={() =>
                                    change(
                                      "schedule",
                                      draft.schedule.filter((x) => x !== r),
                                    )
                                  }
                                >
                                  <Trash2 size={13} />
                                </button>
                              )}
                            </div>
                          ))
                        ) : (
                          <small>Cerrado</small>
                        )}
                        {ranges.length === 1 && (
                          <button
                            type="button"
                            className="text-button"
                            onClick={() =>
                              change("schedule", [
                                ...draft.schedule,
                                { day: i, open: "19:00", close: "22:00" },
                              ])
                            }
                          >
                            Añadir segunda franja
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              <label className="field-label">
                Fechas de cierre (una por línea, AAAA-MM-DD)
                <textarea
                  rows={3}
                  value={draft.closedDates.join("\n")}
                  onChange={(e) =>
                    change(
                      "closedDates",
                      e.target.value
                        .split("\n")
                        .map((x) => x.trim())
                        .filter(Boolean),
                    )
                  }
                  placeholder="2026-12-25"
                />
              </label>
            </div>
          )}
          <div className="form-actions">
            <span>
              <ShieldCheck size={14} /> Cambios solo para tu restaurante
            </span>
            <SaveButton busy={busy} />
          </div>
        </form>
        <aside>
          <div className={"restaurant-preview-card theme-" + draft.accent}>
            <div className="restaurant-preview-art">
              {draft.coverImageId ? (
                <img
                  src={imageSrc(draft.coverImageId)}
                  alt="Vista previa de la portada"
                />
              ) : (
                <DishArt />
              )}
            </div>
            <span className="restaurant-preview-tag">{draft.cuisine}</span>
            <h2>
              Tu restaurante,
              <br />
              siempre cerca.
            </h2>
            <p>{draft.welcome}</p>
            <span className="restaurant-preview-pill">
              <i />
              {draft.publicEnabled
                ? "Menú público habilitado"
                : "Menú en preparación"}
            </span>
          </div>
          <div className="card restaurant-link-card">
            <Globe size={21} />
            <h3>La puerta a tu menú.</h3>
            <p>
              Compártelo en tus redes, WhatsApp o en las mesas del restaurante.
            </p>
            <label className="field-label">
              Enlace público
              <input
                readOnly
                value={data?.publicUrl ?? ""}
                onFocus={(e) => e.target.select()}
              />
            </label>
            <div>
              <button className="button secondary" onClick={() => void copy()}>
                <Copy size={14} /> Copiar
              </button>
              {data?.publicEnabled && (
                <a
                  className="button primary"
                  href={data.publicUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Abrir menú <ExternalLink size={14} />
                </a>
              )}
            </div>
            {!standaloneMode && (
              <button
                type="button"
                className="button secondary restaurant-qr"
                disabled={!data?.publicEnabled}
                onClick={() => void qr()}
              >
                <QrCode size={15} /> Descargar QR del menú
              </button>
            )}
            <small>
              {products?.length ?? 0} productos ·{" "}
              {products?.filter((p) => p.image_id).length ?? 0} con foto
            </small>
          </div>
        </aside>
      </div>
    </>
  );
}
export function BookingForm({
  profile,
  endpoint,
  onDone,
}: {
  profile: RestaurantProfile;
  endpoint: string;
  onDone: (result: { viewUrl: string; code: string; status: string }) => void;
}) {
  const [date, setDate] = useState(
      localParts(new Date(), profile.timezone).date,
    ),
    [party, setParty] = useState(2),
    [time, setTime] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [rid] = useState(() => crypto.randomUUID());
  const availability = endpoint.startsWith("/public/")
    ? endpoint.replace(/\/reservations$/, "")
    : endpoint;
  const { data, loading, reload } = useResource<{
    slots: { time: string; remaining: number }[];
  }>(availability + "/availability?date=" + date + "&partySize=" + party);
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const fields = Object.fromEntries(new FormData(e.currentTarget));
      const result = await post<{
        viewUrl: string;
        code: string;
        status: string;
      }>(endpoint, {
        ...fields,
        date,
        time,
        partySize: party,
        requestId: rid,
        confirm: true,
      });
      onDone(result);
    } catch (e) {
      setError((e as Error).message);
      reload();
      setTime("");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="booking-form modal-form" onSubmit={(e) => void save(e)}>
      <div className="form-row">
        <label className="field-label">
          Fecha de la reserva
          <input
            type="date"
            required
            value={date}
            min={localParts(new Date(), profile.timezone).date}
            onChange={(e) => {
              setDate(e.target.value);
              setTime("");
            }}
          />
        </label>
        <label className="field-label">
          Número de personas
          <input
            type="number"
            required
            min={1}
            max={profile.maxParty}
            value={party}
            onChange={(e) => {
              setParty(Number(e.target.value));
              setTime("");
            }}
          />
        </label>
      </div>
      <fieldset className="booking-times">
        <legend>Horarios disponibles · {profile.timezone}</legend>
        {loading ? (
          <Spinner label="Consultando disponibilidad…" />
        ) : data?.slots.length ? (
          <div>
            {data.slots.map((s) => (
              <button
                type="button"
                key={s.time}
                className={time === s.time ? "selected" : ""}
                aria-pressed={time === s.time}
                onClick={() => setTime(s.time)}
              >
                {s.time}
              </button>
            ))}
          </div>
        ) : (
          <p>
            No hay horarios disponibles para este día y grupo. Prueba otra
            fecha.
          </p>
        )}
      </fieldset>
      <div className="form-row">
        <label className="field-label">
          Nombre de la reserva
          <input name="name" required maxLength={100} autoComplete="name" />
        </label>
        <label className="field-label">
          Teléfono de contacto
          <input
            type="tel"
            name="phone"
            required
            placeholder="+573001112233"
            maxLength={30}
            autoComplete="tel"
          />
        </label>
      </div>
      <label className="field-label">
        Notas para el restaurante
        <textarea
          name="notes"
          maxLength={1000}
          rows={2}
          placeholder="Accesibilidad, silla para bebé u otra solicitud a confirmar."
        />
      </label>
      <label className="restaurant-confirm">
        <input type="checkbox" required />
        Confirmo los datos. El restaurante revisará la solicitud y podrá
        contactarme para esta reserva.
      </label>
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
      <button className="button primary full-width" disabled={!time || busy}>
        {busy ? (
          <Spinner label="Guardando reserva…" />
        ) : (
          <CalendarDays size={17} />
        )}{" "}
        Solicitar reserva
      </button>
    </form>
  );
}
export function OrderCheckout({
  products,
  profile,
  cart,
  onCart,
  endpoint,
  onDone,
  onRefresh,
}: {
  products: Product[];
  profile: RestaurantProfile;
  cart: Record<string, number>;
  onCart: (cart: Record<string, number>) => void;
  endpoint: string;
  onDone: (r: { viewUrl: string; code: string; total: number }) => void;
  onRefresh?: () => void;
}) {
  const [fulfillment, setFulfillment] = useState<
      "dineIn" | "pickup" | "delivery"
    >(() =>
      profile.services.pickup
        ? "pickup"
        : profile.services.dineIn
          ? "dineIn"
          : "delivery",
    ),
    [zone, setZone] = useState(profile.deliveryZones[0]?.id ?? ""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [rid] = useState(() => crypto.randomUUID());
  const lines = products.filter((p) => cart[p.id] > 0),
    subtotal = lines.reduce((n, p) => n + p.price * cart[p.id], 0),
    fee =
      fulfillment === "delivery"
        ? (profile.deliveryZones.find((z) => z.id === zone)?.fee ?? 0)
        : 0,
    total = subtotal + fee;
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const body = Object.fromEntries(new FormData(e.currentTarget)),
        r = await post<{ viewUrl: string; code: string; total: number }>(
          endpoint,
          {
            ...body,
            items: lines.map((p) => ({
              productId: p.id,
              quantity: cart[p.id],
            })),
            fulfillment,
            deliveryZone: zone,
            requestId: rid,
            expectedTotal: total,
            confirm: true,
          },
        );
      onDone(r);
    } catch (e) {
      setError((e as Error).message);
      onRefresh?.();
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="order-checkout modal-form" onSubmit={(e) => void save(e)}>
      <div className="checkout-lines">
        {lines.map((p) => (
          <div key={p.id}>
            <span>
              <strong>{p.name}</strong>
              <small>{money(p.price)} por unidad</small>
            </span>
            <div className="quantity-control">
              <button
                type="button"
                aria-label={"Quitar una unidad de " + p.name}
                onClick={() =>
                  onCart({ ...cart, [p.id]: Math.max(0, cart[p.id] - 1) })
                }
              >
                <Minus size={13} />
              </button>
              <span>{cart[p.id]}</span>
              <button
                type="button"
                aria-label={"Agregar una unidad de " + p.name}
                disabled={cart[p.id] >= Math.min(p.stock, 20)}
                onClick={() => onCart({ ...cart, [p.id]: cart[p.id] + 1 })}
              >
                <Plus size={13} />
              </button>
            </div>
            <b>{money(p.price * cart[p.id])}</b>
          </div>
        ))}
      </div>
      <label className="field-label">
        ¿Cómo quieres tu pedido?
        <select
          value={fulfillment}
          onChange={(e) => setFulfillment(e.target.value as typeof fulfillment)}
        >
          {(["dineIn", "pickup", "delivery"] as const)
            .filter((k) => profile.services[k])
            .map((k) => (
              <option key={k} value={k}>
                {serviceName[k]}
              </option>
            ))}
        </select>
      </label>
      {fulfillment === "dineIn" && (
        <label className="field-label">
          Mesa
          <input
            name="table"
            required
            maxLength={30}
            defaultValue={
              new URLSearchParams(location.search).get("table") ?? ""
            }
            placeholder="Ej. 5"
          />
        </label>
      )}
      <div className="form-row">
        <label className="field-label">
          Tu nombre{fulfillment === "dineIn" ? " (opcional)" : ""}
          <input
            name="name"
            required={fulfillment !== "dineIn"}
            maxLength={100}
            autoComplete="name"
          />
        </label>
        <label className="field-label">
          Tu teléfono{fulfillment === "dineIn" ? " (opcional)" : ""}
          <input
            name="phone"
            required={fulfillment !== "dineIn"}
            maxLength={30}
            type="tel"
            placeholder="+573001112233"
            autoComplete="tel"
          />
        </label>
      </div>
      {fulfillment === "delivery" && (
        <>
          <label className="field-label">
            Zona de domicilio
            <select
              required
              value={zone}
              onChange={(e) => setZone(e.target.value)}
            >
              {profile.deliveryZones.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.name} · {money(z.fee)}
                </option>
              ))}
            </select>
          </label>
          <label className="field-label">
            Dirección de entrega
            <input
              name="address"
              required
              maxLength={300}
              autoComplete="street-address"
            />
          </label>
        </>
      )}
      <div className="form-row">
        <label className="field-label">
          Forma de pago
          <select name="paymentMethod" defaultValue="pay-at-restaurant">
            <option value="pay-at-restaurant">
              Pagar al recibir / en el restaurante
            </option>
            <option value="cash">Efectivo</option>
            <option value="transfer">
              Transferencia a confirmar con el equipo
            </option>
          </select>
        </label>
        <label className="field-label">
          Notas para cocina
          <textarea
            name="notes"
            rows={2}
            maxLength={1000}
            placeholder="Las solicitudes especiales requieren confirmación del equipo."
          />
        </label>
      </div>
      <div className="checkout-total">
        <span>
          Productos <b>{money(subtotal)}</b>
        </span>
        {fulfillment === "delivery" && (
          <span>
            Domicilio <b>{money(fee)}</b>
          </span>
        )}
        <strong>
          Total <b>{money(total)} COP</b>
        </strong>
        <small>
          Pago pendiente de verificar en el restaurante. Preparación estimada:{" "}
          {profile.prepMinutes} minutos.
        </small>
      </div>
      <label className="restaurant-confirm">
        <input type="checkbox" required />
        Revisé los productos, cantidades y total de mi pedido.
      </label>
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
      <button
        className="button primary full-width"
        disabled={!lines.length || busy || !profile.acceptingOrders}
      >
        {busy ? (
          <Spinner label="Enviando pedido…" />
        ) : (
          <ShoppingBag size={17} />
        )}{" "}
        Confirmar pedido · {money(total)}
      </button>
    </form>
  );
}
export type StorefrontData = {
  name: string;
  profile: RestaurantProfile & { coverImageUrl: string; logoImageUrl: string };
  products: Product[];
  assistantName: string;
  voiceUrl: string | null;
};
export function PublicRestaurant({ slug }: { slug: string }) {
  const { data, loading, error, reload } = useResource<StorefrontData>(
    "/public/restaurants/" + slug,
  );
  if (loading)
    return (
      <main className="public-restaurant-loading">
        <Logo />
        <Spinner label="Preparando tu mesa…" />
      </main>
    );
  if (error || !data)
    return (
      <main className="public-restaurant-loading">
        <Logo />
        <h1>El restaurante no está disponible.</h1>
        <p>{error}</p>
        <a href="/">Ir a Cerca</a>
      </main>
    );
  return <RestaurantStorefront data={data} slug={slug} reload={reload} />;
}
export function RestaurantStorefront({
  data,
  slug,
  reload = () => {},
  preview = false,
}: {
  data: StorefrontData;
  slug: string;
  reload?: () => void;
  preview?: boolean;
}) {
  const [category, setCategory] = useState("Todas"),
    [search, setSearch] = useState(""),
    [cart, setCart] = useState<Record<string, number>>({}),
    [modal, setModal] = useState<"booking" | "cart" | "whatsapp" | null>(null),
    [success, setSuccess] = useState<{
      viewUrl: string;
      code: string;
      status?: string;
    } | null>(null);
  const p = data.profile,
    categories = ["Todas", ...new Set(data.products.map((x) => x.category))],
    filtered = data.products.filter(
      (x) =>
        (category === "Todas" || x.category === category) &&
        (x.name + " " + x.description + " " + (x.ingredients ?? ""))
          .toLowerCase()
          .includes(search.toLowerCase()),
    ),
    count = Object.values(cart).reduce((n, x) => n + x, 0),
    total = data.products.reduce((n, x) => n + x.price * (cart[x.id] ?? 0), 0);
  const design = { ...defaultDesign(p.accent), ...p.design },
    wa = whatsappUrl(p.whatsappNumber, data.name),
    phone = /^\+?[\d\s()-]{7,30}$/.test(p.phone || p.whatsappNumber)
      ? "tel:" + (p.phone || p.whatsappNumber).replace(/[^+0-9]/g, "")
      : "";
  const browseUrl = standaloneMode
    ? location.pathname + "?explore=restaurants"
    : "/?explore=restaurants";
  function add(product: Product) {
    if (preview) return;
    setCart((c) => ({
      ...c,
      [product.id]: Math.min((c[product.id] ?? 0) + 1, product.stock, 20),
    }));
  }
  const Container = preview ? "div" : "main";
  return (
    <Container
      className={
        "public-restaurant custom-storefront theme-" +
        p.accent +
        " hero-" +
        design.heroLayout +
        " menu-" +
        design.menuLayout +
        " align-" +
        design.alignment +
        (preview ? " storefront-preview" : "")
      }
      style={storefrontTheme(design) as CSSProperties}
    >
      {standaloneMode && (
        <div className="restaurant-demo-banner" role="status">
          Restaurante de demostración. Los pedidos y reservas se guardan solo en
          este navegador.
        </div>
      )}
      <header className="public-menu-header">
        <a
          className="public-restaurant-brand"
          href={
            preview
              ? undefined
              : standaloneMode
                ? "?restaurant=" + slug
                : "/r/" + slug
          }
        >
          {p.logoImageUrl ? (
            <img src={p.logoImageUrl} alt="" />
          ) : (
            <span>
              <UtensilsCrossed size={20} />
            </span>
          )}
          <strong>{data.name}</strong>
        </a>
        <nav aria-label="Atención del restaurante">
          {!preview && <a href={browseUrl}>Explorar restaurantes</a>}
          {wa && (
            <a
              className="storefront-whatsapp"
              href={preview ? undefined : wa}
              target="_blank"
              rel="noopener noreferrer"
            >
              WhatsApp <ArrowUpRight size={14} />
            </a>
          )}
          {phone && (
            <a href={preview ? undefined : phone}>
              <Phone size={15} /> Llamar al restaurante
            </a>
          )}
          {p.reservationsEnabled && (
            <button disabled={preview} onClick={() => setModal("booking")}>
              <CalendarDays size={16} /> Reservar mesa
            </button>
          )}
          {data.voiceUrl && (
            <a href={preview ? undefined : data.voiceUrl}>
              <Phone size={16} /> Hablar con {data.assistantName}
            </a>
          )}
          {wa && (
            <button disabled={preview} onClick={() => setModal("whatsapp")}>
              <Phone size={15} />
              Llamar por WhatsApp
            </button>
          )}
          <button
            disabled={preview}
            className="public-cart-button"
            onClick={() => setModal("cart")}
          >
            <ShoppingBag size={17} />
            <span>Mi pedido</span>
            <b>{count}</b>
          </button>
        </nav>
      </header>
      <section className="public-menu-hero">
        <div>
          <span className="public-menu-eyebrow">
            <span /> {p.cuisine.toUpperCase()}
          </span>
          <h1>{design.heroTitle}</h1>
          <p>{p.welcome}</p>
          <div className="public-menu-info">
            {p.address && (
              <span>
                <MapPin size={14} />
                {p.address}
              </span>
            )}
            <span>
              <Clock3 size={14} />
              {p.prepMinutes} min de preparación estimada
            </span>
          </div>
          <details className="public-opening-hours">
            <summary>Consultar horarios de atención</summary>
            <p>{restaurantHours(p)}</p>
          </details>
          {p.reservationsEnabled && (
            <button
              disabled={preview}
              className="button public-menu-primary"
              onClick={() => setModal("booking")}
            >
              Nos vemos en la mesa <ArrowUpRight size={16} />
            </button>
          )}
        </div>
        <div className="public-menu-cover">
          {p.coverImageUrl ? (
            <img src={p.coverImageUrl} alt={"El restaurante " + data.name} />
          ) : (
            <div className="public-menu-illustration">
              <DishArt />
              <span>Hecho con ganas de compartir.</span>
            </div>
          )}
          <span className="public-menu-cover-label">
            <ChefHat size={15} /> Cocina con personalidad
          </span>
        </div>
      </section>
      <div className="public-storefront-sections">
        <section
          className="public-menu-content"
          style={{ order: design.sections.indexOf("menu") }}
        >
          {!p.acceptingOrders && (
            <div className="restaurant-demo-banner" role="status">
              La cocina tiene pausada la recepción de pedidos. Puedes consultar
              la carta y contactar con el equipo.
            </div>
          )}
          <div className="public-menu-section-heading">
            <div>
              <span className="eyebrow">ELIGE TU PRÓXIMO FAVORITO</span>
              <h2>{design.menuTitle}</h2>
            </div>
            <label className="public-menu-search">
              <Search size={17} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Buscar en el menú"
                placeholder="¿Qué te provoca hoy?"
              />
            </label>
          </div>
          <div className="public-menu-categories">
            {categories.map((c) => (
              <button
                className={category === c ? "selected" : ""}
                key={c}
                aria-pressed={category === c}
                onClick={() => setCategory(c)}
              >
                {c}
              </button>
            ))}
          </div>
          <div className="public-menu-grid">
            {filtered.map((product) => (
              <article
                className={
                  "public-dish-card " + (!product.stock ? "soldout" : "")
                }
                key={product.id}
              >
                <div className="public-dish-image">
                  {product.image_url ? (
                    <img
                      src={product.image_url}
                      alt={product.name}
                      loading="lazy"
                    />
                  ) : (
                    <DishArt kind={product.kind} />
                  )}
                  <span>{product.stock ? "Disponible" : "Agotado"}</span>
                </div>
                <div className="public-dish-body">
                  <small>{product.category}</small>
                  <h3>{product.name}</h3>
                  <p>{product.description}</p>
                  <details>
                    <summary>Ingredientes y alérgenos</summary>
                    <p>
                      <strong>Ingredientes:</strong>{" "}
                      {product.ingredients ||
                        "Por confirmar con el restaurante."}
                    </p>
                    <p>
                      <strong>Alérgenos:</strong>{" "}
                      {product.allergens ||
                        "Sin información confirmada. Consulta al equipo si tienes una alergia."}
                    </p>
                  </details>
                  <div>
                    <strong>
                      {money(product.price)}
                      <small> COP</small>
                    </strong>
                    <button
                      aria-label={
                        "Agregar " +
                        product.name +
                        " al pedido" +
                        (cart[product.id]
                          ? ". " + cart[product.id] + " en tu pedido"
                          : "")
                      }
                      disabled={
                        preview ||
                        !product.stock ||
                        !p.acceptingOrders ||
                        (cart[product.id] ?? 0) >= Math.min(product.stock, 20)
                      }
                      onClick={() => add(product)}
                    >
                      <Plus size={18} />
                      {cart[product.id] ? (
                        <b aria-hidden="true">{cart[product.id]}</b>
                      ) : null}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
          {!filtered.length && (
            <div className="restaurant-soft-empty">
              <UtensilsCrossed size={35} />
              <h3>Aún no hay opciones en esta selección.</h3>
              <p>Prueba otra categoría o consulta con el restaurante.</p>
            </div>
          )}
        </section>
        {design.showStory && design.about && (
          <section
            className="storefront-story"
            style={{ order: design.sections.indexOf("story") }}
          >
            <span className="eyebrow">DETRÁS DE CADA SABOR</span>
            <h2>{design.aboutTitle}</h2>
            <p>{design.about}</p>
            <span className="storefront-story-mark" aria-hidden="true">
              ✳
            </span>
          </section>
        )}
        {design.showContact && (
          <section
            className="storefront-contact"
            style={{ order: design.sections.indexOf("contact") }}
          >
            <div>
              <span className="eyebrow">NOS VEMOS CERCA</span>
              <h2>Encuéntranos y conversemos.</h2>
              <p>
                {p.address ||
                  "Consulta con el restaurante la ubicación del local."}
                {p.city ? " · " + p.city : ""}
              </p>
              <p>{p.phone}</p>
              <details>
                <summary>Horarios de atención</summary>
                <p>{restaurantHours(p)}</p>
              </details>
            </div>
            <div className="storefront-contact-actions">
              {wa && (
                <a
                  href={preview ? undefined : wa}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Escribir por WhatsApp <ArrowUpRight size={17} />
                </a>
              )}
              {phone && (
                <a href={preview ? undefined : phone}>
                  Llamar al restaurante <Phone size={17} />
                </a>
              )}
              {data.voiceUrl && (
                <a href={preview ? undefined : data.voiceUrl}>
                  Hablar con {data.assistantName} <Phone size={17} />
                </a>
              )}
            </div>
          </section>
        )}
      </div>
      {count > 0 && (
        <button
          className="public-floating-cart"
          onClick={() => setModal("cart")}
        >
          <span>
            <ShoppingBag size={18} />
            {count} {count === 1 ? "producto" : "productos"}
          </span>
          <strong>
            Ver mi pedido · {money(total)} <ArrowRight size={16} />
          </strong>
        </button>
      )}
      <footer className="public-menu-footer">
        <div>
          <UtensilsCrossed size={20} />
          <strong>{data.name}</strong>
        </div>
        <span>Con el cariño de siempre. Con la tecnología de Cerca.</span>
        <a href={preview ? undefined : browseUrl}>
          Cerca para restaurantes <ArrowUpRight size={14} />
        </a>
      </footer>
      {modal && (
        <Modal
          title={
            modal === "booking"
              ? "Una mesa para compartir."
              : modal === "whatsapp"
                ? "Conversemos por WhatsApp."
                : "Tu pedido, a tu gusto."
          }
          description={
            modal === "booking"
              ? "Elige un horario disponible. El restaurante revisará tu solicitud."
              : modal === "whatsapp"
                ? "Abre el chat de este restaurante y pulsa el icono de teléfono en WhatsApp para llamar."
                : "El total se verifica con los precios y las existencias actuales."
          }
          onClose={() => setModal(null)}
        >
          {modal === "whatsapp" ? (
            <div className="whatsapp-call-guide">
              <Phone size={32} />
              <h3>{data.name}</h3>
              <p>{p.whatsappNumber}</p>
              <a
                className="button primary"
                href={wa}
                target="_blank"
                rel="noopener noreferrer"
              >
                Abrir WhatsApp para llamar <ArrowUpRight size={16} />
              </a>
              <p>
                La llamada se inicia en WhatsApp. El restaurante debe tener
                disponibles las llamadas en su número.
              </p>
              {data.voiceUrl && (
                <a className="button secondary" href={data.voiceUrl}>
                  Hablar con {data.assistantName} desde esta web
                </a>
              )}
            </div>
          ) : modal === "booking" ? (
            <BookingForm
              profile={p}
              endpoint={"/public/restaurants/" + slug + "/reservations"}
              onDone={(r) => {
                setSuccess(r);
                setModal(null);
              }}
            />
          ) : (
            <OrderCheckout
              profile={p}
              products={data.products}
              cart={cart}
              onCart={setCart}
              endpoint={"/public/restaurants/" + slug + "/orders"}
              onRefresh={reload}
              onDone={(r) => {
                setSuccess(r);
                setCart({});
                setModal(null);
                reload();
              }}
            />
          )}
        </Modal>
      )}
      {success && (
        <Modal
          title={
            success.status === "pending"
              ? "Tu solicitud de reserva fue recibida."
              : "Tu pedido está en el restaurante."
          }
          onClose={() => setSuccess(null)}
        >
          <div className="restaurant-success">
            <CheckCircle2 size={42} />
            <strong>{success.code}</strong>
            <p>
              {success.status === "pending"
                ? "Está pendiente de confirmación por el equipo. Puedes consultar su estado desde el enlace."
                : "El equipo verá tu pedido en cocina. El pago se confirma con el restaurante."}
            </p>
            <a className="button primary" href={success.viewUrl}>
              Ver seguimiento <ArrowRight size={15} />
            </a>
          </div>
        </Modal>
      )}
    </Container>
  );
}
export function GuestTracking({
  token,
  type,
}: {
  token: string;
  type: "order" | "reservation";
}) {
  const { data, loading, error, reload } = useResource<Record<string, unknown>>(
      "/public/" + (type === "order" ? "orders" : "reservations") + "/" + token,
      0,
      5000,
    ),
    [busy, setBusy] = useState(false),
    [actionError, setActionError] = useState("");
  const previousStatus = useRef<string | null>(null),
    [statusNotice, setStatusNotice] = useState("");
  useEffect(() => {
    const status = String(data?.status ?? "");
    if (!status) return;
    if (
      previousStatus.current &&
      previousStatus.current !== status &&
      type === "order"
    )
      setStatusNotice(
        status === "preparing"
          ? "¡Tu pedido ya está en cocina! El restaurante está preparando tus productos."
          : status === "ready"
            ? "Tu pedido está listo."
            : status === "shipped"
              ? "Tu pedido salió a domicilio."
              : status === "delivered"
                ? "Tu pedido fue marcado como entregado."
                : "El restaurante actualizó el estado de tu pedido.",
      );
    previousStatus.current = status;
  }, [data?.status, type]);
  if (loading)
    return (
      <div className="public-restaurant-loading">
        <Logo />
        <Spinner />
      </div>
    );
  if (error || !data)
    return (
      <main className="public-restaurant-loading">
        <Logo />
        <h1>No encontramos ese enlace.</h1>
        <p>{error}</p>
      </main>
    );
  const lines = (data.lines ?? []) as KitchenOrder["lines"],
    details = data.details as KitchenOrder["details"] | undefined;
  return (
    <main className="guest-tracking-page">
      {standaloneMode && (
        <div className="restaurant-demo-banner">
          Seguimiento de demostración; no corresponde a un restaurante real.
        </div>
      )}
      <Logo />
      <section className="guest-tracking-card">
        <span className="restaurant-section-icon">
          {type === "order" ? (
            <ChefHat size={28} />
          ) : (
            <CalendarDays size={28} />
          )}
        </span>
        <span className="eyebrow">{String(data.restaurant)}</span>
        <h1>
          {type === "order"
            ? "Tu pedido está cerca."
            : "Tu próxima buena mesa."}
        </h1>
        <strong className="tracking-code">{String(data.code)}</strong>
        <span className={"restaurant-state " + String(data.status)}>
          {type === "order"
            ? (restaurantStatusLabels[String(data.status)] ??
              String(data.status))
            : (reservationLabels[String(data.status)] ?? String(data.status))}
        </span>
        {statusNotice && (
          <p className="guest-status-notice" role="status">
            {statusNotice}
          </p>
        )}
        {type === "order" ? (
          <>
            <ol
              className="guest-order-timeline"
              aria-label="Progreso del pedido"
            >
              {[
                "confirmed",
                "preparing",
                "ready",
                ...(details?.fulfillment === "delivery" ? ["shipped"] : []),
                "delivered",
              ].map((stage, i, stages) => (
                <li
                  key={stage}
                  className={
                    (stages.indexOf(String(data.status)) >= i ? "done " : "") +
                    (String(data.status) === stage ? "current" : "")
                  }
                  aria-current={
                    String(data.status) === stage ? "step" : undefined
                  }
                >
                  <i>
                    {stages.indexOf(String(data.status)) > i ? (
                      <Check size={12} />
                    ) : (
                      i + 1
                    )}
                  </i>
                  <span>
                    {
                      {
                        confirmed: "Recibido",
                        preparing: "En cocina",
                        ready: "Listo",
                        shipped: "En camino",
                        delivered: "Entregado",
                      }[stage]
                    }
                  </span>
                </li>
              ))}
            </ol>
            <p className="guest-live-note">
              El estado se actualiza aquí mientras tengas abierta esta página.
            </p>
            <div className="guest-order-lines">
              {lines.map((l) => (
                <div key={l.product_id}>
                  <span>
                    {l.quantity} × {l.name}
                  </span>
                  <strong>{money(l.quantity * l.unit_price)}</strong>
                </div>
              ))}
              {details?.delivery_fee ? (
                <div>
                  <span>Domicilio</span>
                  <strong>{money(details.delivery_fee)}</strong>
                </div>
              ) : null}
              <div className="guest-order-total">
                <span>Total</span>
                <strong>{money(Number(data.total))} COP</strong>
              </div>
            </div>
            <p>
              {details ? serviceName[details.fulfillment] : ""}
              {details?.table_label ? " · Mesa " + details.table_label : ""}
            </p>
            <small>
              {data.paymentStatus === "verified"
                ? "El restaurante marcó el pago como verificado."
                : "Pago pendiente de verificación con el restaurante."}{" "}
              La preparación estimada puede variar.
            </small>
          </>
        ) : (
          <>
            <div className="guest-reservation-facts">
              <span>
                <Users size={18} />
                {String(data.partySize)} personas
              </span>
              <span>
                <CalendarDays size={18} />
                {reservationTime(String(data.startAt), String(data.timezone))}
              </span>
              <strong>{String(data.name)}</strong>
            </div>
            {data.status === "pending" && (
              <p>
                El equipo aún debe confirmar tu solicitud. Consulta este enlace
                para ver las novedades.
              </p>
            )}
            {["pending", "confirmed"].includes(String(data.status)) && (
              <button
                className="button secondary"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  setActionError("");
                  try {
                    await post("/public/reservations/" + token + "/cancel");
                    reload();
                  } catch (e) {
                    setActionError((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Cancelar esta reserva
              </button>
            )}
          </>
        )}
        {actionError && (
          <p className="inline-error" role="alert">
            {actionError}
          </p>
        )}
        <p className="tracking-private-note">
          <ShieldCheck size={14} /> Este enlace es privado. Guárdalo para
          consultar el estado.
        </p>
      </section>
    </main>
  );
}
export function Reservations() {
  const { version, refresh, notify } = useApp(),
    { data, loading, error, reload } = useResource<Reservation[]>(
      "/reservations",
      version,
      10000,
    ),
    { data: profile } = useResource<RestaurantProfile>("/restaurant", version);
  const [adding, setAdding] = useState(false),
    [filter, setFilter] = useState("upcoming"),
    [busy, setBusy] = useState("");
  const filtered = (data ?? [])
    .filter((r) =>
      filter === "all" || filter === "pending"
        ? filter === "all" || r.status === "pending"
        : !["cancelled", "completed", "no-show"].includes(r.status) &&
          r.end_at > new Date().toISOString(),
    )
    .sort((a, b) => a.start_at.localeCompare(b.start_at));
  async function status(r: Reservation, next: string) {
    setBusy(r.id);
    try {
      await put("/reservations/" + r.id, { status: next });
      refresh();
      notify("Reserva actualizada.");
    } catch (e) {
      notify((e as Error).message, true);
    } finally {
      setBusy("");
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="HAY UN LUGAR PARA CADA ENCUENTRO"
        title="Mesas listas para recibir."
        subtitle="Revisa solicitudes, confirma grupos y acompaña cada visita."
        action={
          <button className="button primary" onClick={() => setAdding(true)}>
            <Plus size={16} /> Nueva reserva
          </button>
        }
      />
      <div className="restaurant-toolbar">
        <div className="segmented-control">
          {[
            { id: "upcoming", name: "Próximas" },
            { id: "pending", name: "Por confirmar" },
            { id: "all", name: "Todas" },
          ].map((t) => (
            <button
              key={t.id}
              className={filter === t.id ? "selected" : ""}
              onClick={() => setFilter(t.id)}
            >
              {t.name}
            </button>
          ))}
        </div>
        <span>
          <Users size={15} />
          {profile?.capacity ?? "—"} personas de capacidad
        </span>
      </div>
      {loading ? (
        <Spinner />
      ) : error ? (
        <ErrorState message={error} retry={reload} />
      ) : !filtered.length ? (
        <div className="card restaurant-soft-empty">
          <CalendarDays size={38} />
          <h2>La próxima reunión empieza aquí.</h2>
          <p>
            Activa las reservas y comparte el enlace de tu restaurante para
            recibir solicitudes.
          </p>
        </div>
      ) : (
        <div className="reservation-grid">
          {filtered.map((r) => (
            <article className="card reservation-card" key={r.id}>
              <div>
                <span className={"restaurant-state " + r.status}>
                  {reservationLabels[r.status]}
                </span>
                <small>{r.code}</small>
              </div>
              <h3>{r.name}</h3>
              <p>
                <CalendarDays size={16} />
                {reservationTime(r.start_at, profile?.timezone)}
              </p>
              <p>
                <Users size={16} />
                {r.party_size} personas ·{" "}
                {Math.round(
                  (Date.parse(r.end_at) - Date.parse(r.start_at)) / 60000,
                )}{" "}
                minutos
              </p>
              <p>
                <Phone size={16} />
                {r.phone}
              </p>
              {r.notes && <blockquote>{r.notes}</blockquote>}
              <div className="reservation-actions">
                {r.status === "pending" && (
                  <button
                    className="button primary"
                    disabled={busy === r.id}
                    onClick={() => void status(r, "confirmed")}
                  >
                    Confirmar reserva
                  </button>
                )}
                {r.status === "confirmed" && (
                  <>
                    <button
                      className="button primary"
                      disabled={busy === r.id}
                      onClick={() => void status(r, "seated")}
                    >
                      Recibir en mesa
                    </button>
                    <button
                      className="text-button"
                      disabled={busy === r.id}
                      onClick={() => void status(r, "no-show")}
                    >
                      No asistió
                    </button>
                  </>
                )}
                {r.status === "seated" && (
                  <button
                    className="button primary"
                    onClick={() => void status(r, "completed")}
                  >
                    Finalizar visita
                  </button>
                )}
                {["pending", "confirmed"].includes(r.status) && (
                  <button
                    className="text-button danger"
                    disabled={busy === r.id}
                    onClick={() => void status(r, "cancelled")}
                  >
                    Cancelar
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
      {adding && profile && (
        <Modal
          title="Una nueva mesa para compartir."
          onClose={() => setAdding(false)}
        >
          <BookingForm
            profile={profile}
            endpoint="/reservations"
            onDone={() => {
              setAdding(false);
              refresh();
              notify("Reserva confirmada y capacidad actualizada.");
            }}
          />
        </Modal>
      )}
    </>
  );
}
export function Kitchen() {
  const { version, refresh, notify } = useApp(),
    { data, loading, error, reload } = useResource<KitchenOrder[]>(
      "/kitchen",
      version,
      5000,
    ),
    { data: profile } = useResource<RestaurantProfile>("/restaurant", version),
    { data: products } = useResource<Product[]>("/products", version);
  const [busy, setBusy] = useState(""),
    [adding, setAdding] = useState(false),
    [cart, setCart] = useState<Record<string, number>>({}),
    [print, setPrint] = useState<KitchenOrder | null>(null);
  async function advance(o: KitchenOrder, status: string) {
    setBusy(o.id);
    try {
      await put("/kitchen/" + o.id + "/status", { status });
      refresh();
      notify("Estado del pedido actualizado.");
    } catch (e) {
      notify((e as Error).message, true);
    } finally {
      setBusy("");
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="EL RITMO DE TU COCINA"
        title="Cada pedido, en su punto."
        subtitle="Los pedidos del menú llegan aquí con precios verificados y stock descontado."
        action={
          <button className="button primary" onClick={() => setAdding(true)}>
            <Plus size={16} /> Tomar pedido
          </button>
        }
      />
      {loading ? (
        <Spinner />
      ) : error ? (
        <ErrorState message={error} retry={reload} />
      ) : (
        <div className="kitchen-board">
          {[
            { id: "confirmed", title: "Recibidos", icon: ShoppingBag },
            { id: "preparing", title: "En cocina", icon: Flame },
            { id: "ready", title: "Listos", icon: CheckCircle2 },
          ].map((col) => (
            <section className="kitchen-column" key={col.id}>
              <header>
                <span>
                  <col.icon size={17} />
                  {col.title}
                </span>
                <b>
                  {data?.filter(
                    (o) =>
                      o.status === col.id ||
                      (col.id === "ready" && o.status === "shipped"),
                  ).length ?? 0}
                </b>
              </header>
              {(data ?? [])
                .filter(
                  (o) =>
                    o.status === col.id ||
                    (col.id === "ready" && o.status === "shipped"),
                )
                .map((o) => (
                  <article className="kitchen-ticket" key={o.id}>
                    <div>
                      <strong>{o.code}</strong>
                      <span>{relativeTime(o.created_at)}</span>
                    </div>
                    <h3>{o.customer}</h3>
                    {o.phone && (
                      <a
                        className="kitchen-customer-phone"
                        href={"tel:" + o.phone}
                      >
                        <Phone size={12} />
                        {o.phone}
                      </a>
                    )}
                    <span className="kitchen-service">
                      {serviceName[o.details.fulfillment]}
                      {o.details.table_label
                        ? " · Mesa " + o.details.table_label
                        : ""}
                    </span>
                    <ul>
                      {o.lines.map((l) => (
                        <li key={l.product_id}>
                          <b>{l.quantity}</b>
                          {l.name}
                        </li>
                      ))}
                    </ul>
                    {o.details.notes && (
                      <blockquote>
                        <strong>Notas de cocina</strong>
                        {o.details.notes}
                      </blockquote>
                    )}
                    {o.details.delivery_address && (
                      <p className="kitchen-address">
                        <MapPin size={13} />
                        {o.details.delivery_address} · {o.details.delivery_zone}
                      </p>
                    )}
                    <div className="kitchen-ticket-total">
                      <strong>{money(o.total)}</strong>
                      <small>
                        {o.paymentStatus === "verified"
                          ? "Pago verificado por el equipo"
                          : "Pago por verificar"}
                      </small>
                    </div>
                    <div className="kitchen-ticket-actions">
                      {o.paymentStatus !== "verified" && (
                        <button
                          className="text-button kitchen-payment"
                          onClick={async () => {
                            try {
                              await put("/kitchen/" + o.id + "/payment", {
                                status: "verified",
                              });
                              refresh();
                              notify(
                                "Pago marcado como verificado por el equipo.",
                              );
                            } catch (e) {
                              notify((e as Error).message, true);
                            }
                          }}
                        >
                          Marcar pago verificado
                        </button>
                      )}
                      <button
                        className="button primary"
                        disabled={busy === o.id}
                        onClick={() =>
                          void advance(
                            o,
                            o.status === "confirmed"
                              ? "preparing"
                              : o.status === "preparing"
                                ? "ready"
                                : o.status === "ready" &&
                                    o.details.fulfillment === "delivery"
                                  ? "shipped"
                                  : "delivered",
                          )
                        }
                      >
                        {o.status === "confirmed"
                          ? "Comenzar preparación"
                          : o.status === "preparing"
                            ? "Marcar listo"
                            : o.status === "ready" &&
                                o.details.fulfillment === "delivery"
                              ? "Enviar a domicilio"
                              : "Marcar entregado"}
                        <ArrowRight size={13} />
                      </button>
                      <div>
                        <button
                          className="icon-button"
                          aria-label={"Imprimir comanda " + o.code}
                          onClick={() => setPrint(o)}
                        >
                          <Printer size={16} />
                        </button>
                        <button
                          className="text-button danger"
                          disabled={busy === o.id}
                          onClick={() => void advance(o, "cancelled")}
                        >
                          Cancelar pedido
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              {!data?.some(
                (o) =>
                  o.status === col.id ||
                  (col.id === "ready" && o.status === "shipped"),
              ) && (
                <div className="kitchen-empty">
                  <col.icon size={25} />
                  <p>Todo al día por aquí.</p>
                </div>
              )}
            </section>
          ))}
        </div>
      )}
      {adding && profile && products && (
        <Modal
          title="Un nuevo pedido para cocina."
          onClose={() => setAdding(false)}
        >
          <div className="pos-product-picker">
            {products
              .filter((p) => p.stock > 0)
              .map((p) => (
                <button
                  key={p.id}
                  onClick={() =>
                    setCart((c) => ({
                      ...c,
                      [p.id]: Math.min((c[p.id] ?? 0) + 1, p.stock, 20),
                    }))
                  }
                >
                  <span>{p.name}</span>
                  <b>{money(p.price)}</b>
                  <Plus size={14} />
                </button>
              ))}
          </div>
          <OrderCheckout
            profile={profile}
            products={products}
            cart={cart}
            onCart={setCart}
            endpoint="/restaurant/orders"
            onRefresh={refresh}
            onDone={() => {
              setAdding(false);
              setCart({});
              refresh();
              notify("Pedido enviado a cocina.");
            }}
          />
        </Modal>
      )}
      {print && (
        <Modal title="Comanda para cocina" onClose={() => setPrint(null)}>
          <div className="print-ticket">
            <h2>{print.code}</h2>
            <p>
              {print.customer} · {serviceName[print.details.fulfillment]}{" "}
              {print.details.table_label}
            </p>
            {print.lines.map((l) => (
              <p key={l.product_id}>
                <strong>{l.quantity} × </strong>
                {l.name}
              </p>
            ))}
            {print.details.notes && (
              <blockquote>{print.details.notes}</blockquote>
            )}
            <strong>{money(print.total)}</strong>
            <p>Pago pendiente de verificar</p>
          </div>
          <button className="button primary" onClick={() => window.print()}>
            <Printer size={16} /> Imprimir comanda
          </button>
        </Modal>
      )}
    </>
  );
}
