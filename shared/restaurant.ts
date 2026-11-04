import { defaultDesign, validateDesign, businessTypes } from "./storefront.ts";
import type { StorefrontDesign, BusinessType } from "./storefront.ts";
export type RestaurantProfile = {
  displayName: string;
  city: string;
  businessType: BusinessType;
  specialties: string;
  whatsappNumber: string;
  design: StorefrontDesign;
  slug: string;
  publicEnabled: boolean;
  acceptingOrders: boolean;
  cuisine: string;
  address: string;
  phone: string;
  welcome: string;
  accent: "jade" | "terracotta" | "violet";
  coverImageId: string;
  logoImageId: string;
  reservationsEnabled: boolean;
  timezone: string;
  capacity: number;
  maxParty: number;
  slotMinutes: number;
  visitMinutes: number;
  horizonDays: number;
  schedule: { day: number; open: string; close: string }[];
  closedDates: string[];
  services: { dineIn: boolean; pickup: boolean; delivery: boolean };
  deliveryZones: { id: string; name: string; fee: number }[];
  prepMinutes: number;
  minimumOrder: number;
};
export const defaultRestaurant = (id = "demo"): RestaurantProfile => ({
  displayName: "",
  city: "",
  businessType: "restaurante",
  specialties: "",
  whatsappNumber: "",
  design: defaultDesign(),
  slug:
    "restaurante-" +
    id
      .replace(/[^a-z0-9]/gi, "")
      .slice(0, 10)
      .toLowerCase(),
  publicEnabled: false,
  acceptingOrders: true,
  cuisine: "Cocina de la casa",
  address: "",
  phone: "",
  welcome: "Una mesa, una buena comida y una conversación cercana.",
  accent: "terracotta",
  coverImageId: "",
  logoImageId: "",
  reservationsEnabled: false,
  timezone: "America/Bogota",
  capacity: 24,
  maxParty: 8,
  slotMinutes: 30,
  visitMinutes: 90,
  horizonDays: 30,
  schedule: [0, 1, 2, 3, 4, 5, 6].map((day) => ({
    day,
    open: "12:00",
    close: "22:00",
  })),
  closedDates: [],
  services: { dineIn: true, pickup: true, delivery: false },
  deliveryZones: [],
  prepMinutes: 30,
  minimumOrder: 0,
});
const fail = (message: string) =>
  Object.assign(new Error(message), { status: 400 });
function str(x: unknown, label: string, max: number, empty = true) {
  if (typeof x !== "string" || x.trim().length > max || (!empty && !x.trim()))
    throw fail("Revisa " + label + ".");
  return x.trim();
}
function int(x: unknown, label: string, min: number, max: number) {
  if (!Number.isInteger(x) || Number(x) < min || Number(x) > max)
    throw fail(`${label}: usa un entero entre ${min} y ${max}.`);
  return Number(x);
}
export const minutes = (value: string) => {
  if (!/^\d{2}:\d{2}$/.test(value)) return NaN;
  const [h, m] = value.split(":").map(Number);
  return h <= 23 && m <= 59 ? h * 60 + m : NaN;
};
export function restaurantHours(p: RestaurantProfile) {
  const days = [
    "Domingo",
    "Lunes",
    "Martes",
    "Miércoles",
    "Jueves",
    "Viernes",
    "Sábado",
  ];
  return (
    [1, 2, 3, 4, 5, 6, 0]
      .map((day) => {
        const ranges = p.schedule
          .filter((s) => s.day === day)
          .sort((a, b) => a.open.localeCompare(b.open));
        return (
          days[day] +
          ": " +
          (ranges.length
            ? ranges.map((s) => s.open + "–" + s.close).join(" y ")
            : "cerrado")
        );
      })
      .join(". ") +
    ". Zona horaria: " +
    p.timezone +
    (p.closedDates.length
      ? ". Cierres especiales: " + p.closedDates.join(", ")
      : "")
  );
}
export function restaurantDelivery(p: RestaurantProfile) {
  return (
    (p.services.delivery
      ? "Domicilio disponible en: " +
        p.deliveryZones.map((z) => z.name + " (" + z.fee + " COP)").join("; ") +
        "."
      : "El domicilio no está habilitado.") +
    (p.services.pickup
      ? " Puedes recoger en el restaurante."
      : " La recogida no está habilitada.") +
    " Preparación estimada: " +
    p.prepMinutes +
    " minutos; puede variar. El pago se confirma con el equipo."
  );
}
export function validateRestaurant(
  value: unknown,
  current: RestaurantProfile,
): RestaurantProfile {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw fail("La configuración del restaurante no es válida.");
  const p = { ...current, ...value } as RestaurantProfile;
  for (const key of [
    "publicEnabled",
    "reservationsEnabled",
    "acceptingOrders",
  ] as const)
    if (typeof p[key] !== "boolean") throw fail("Estado no válido.");
  const slug = str(p.slug, "el enlace", 60, false);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length < 3)
    throw fail("Usa un enlace de 3 a 60 letras minúsculas, números y guiones.");
  let timezone;
  try {
    timezone = new Intl.DateTimeFormat("en", {
      timeZone: p.timezone,
    }).resolvedOptions().timeZone;
  } catch {
    throw fail("Zona horaria no válida.");
  }
  if (!["jade", "terracotta", "violet"].includes(p.accent))
    throw fail("Color no válido.");
  if (!Object.hasOwn(businessTypes, p.businessType))
    throw fail("Elige el tipo de negocio.");
  const whatsappNumber = str(
    p.whatsappNumber,
    "el WhatsApp del negocio",
    30,
  ).replace(/[\s()-]/g, "");
  if (whatsappNumber && !/^\+[1-9]\d{7,14}$/.test(whatsappNumber))
    throw fail(
      "El WhatsApp debe incluir el código de país, por ejemplo +573001112233.",
    );
  if (
    !p.services ||
    typeof p.services !== "object" ||
    ["dineIn", "pickup", "delivery"].some(
      (k) => typeof p.services[k as keyof typeof p.services] !== "boolean",
    )
  )
    throw fail("Revisa los tipos de atención.");
  if (!Array.isArray(p.schedule) || p.schedule.length > 14)
    throw fail("Configura hasta dos franjas por día.");
  const schedule = p.schedule.map((s) => {
    if (!s || typeof s !== "object") throw fail("Horario no válido.");
    const day = int(s.day, "Día", 0, 6),
      open = str(s.open, "la apertura", 5, false),
      close = str(s.close, "el cierre", 5, false);
    if (
      !Number.isFinite(minutes(open)) ||
      !Number.isFinite(minutes(close)) ||
      minutes(close) <= minutes(open)
    )
      throw fail(
        "Cada franja debe empezar y terminar el mismo día, con cierre posterior a la apertura.",
      );
    return { day, open, close };
  });
  for (let day = 0; day < 7; day++) {
    const rows = schedule
      .filter((s) => s.day === day)
      .sort((a, b) => minutes(a.open) - minutes(b.open));
    if (
      rows.length > 2 ||
      rows.some((r, i) => i > 0 && minutes(r.open) < minutes(rows[i - 1].close))
    )
      throw fail("Los horarios de un día no deben superponerse.");
  }
  if (
    !Array.isArray(p.closedDates) ||
    p.closedDates.length > 120 ||
    p.closedDates.some(
      (d) => typeof d !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(d),
    )
  )
    throw fail("Revisa los días de cierre.");
  if (!Array.isArray(p.deliveryZones) || p.deliveryZones.length > 30)
    throw fail("Configura hasta 30 zonas de entrega.");
  const ids = new Set<string>(),
    deliveryZones = p.deliveryZones.map((z) => {
      if (!z || typeof z !== "object") throw fail("Zona no válida.");
      const id = str(z.id, "el identificador de zona", 80, false);
      if (!/^[a-zA-Z0-9_-]+$/.test(id) || ids.has(id))
        throw fail("Las zonas deben tener identificadores distintos.");
      ids.add(id);
      return {
        id,
        name: str(z.name, "la zona", 100, false),
        fee: int(z.fee, "Costo de envío", 0, 100000000),
      };
    });
  if (p.services.delivery && !deliveryZones.length)
    throw fail("Agrega al menos una zona y tarifa para activar domicilios.");
  const capacity = int(p.capacity, "Capacidad", 1, 500),
    maxParty = int(p.maxParty, "Tamaño del grupo", 1, 50);
  if (maxParty > capacity)
    throw fail("El grupo máximo no puede superar la capacidad.");
  for (const id of [p.coverImageId, p.logoImageId])
    if (typeof id !== "string" || (id && !/^[a-f0-9-]{36}$/.test(id)))
      throw fail("Imagen no válida.");
  return {
    displayName: str(p.displayName, "el nombre público", 120),
    city: str(p.city, "la ciudad", 100),
    businessType: p.businessType,
    specialties: str(p.specialties, "las especialidades", 200),
    whatsappNumber,
    design: validateDesign(p.design, defaultDesign(p.accent)),
    slug,
    publicEnabled: p.publicEnabled,
    acceptingOrders: p.acceptingOrders,
    cuisine: str(p.cuisine, "el tipo de cocina", 100, false),
    address: str(p.address, "la dirección", 300),
    phone: str(p.phone, "el teléfono", 30),
    welcome: str(p.welcome, "la presentación", 500),
    accent: p.accent,
    coverImageId: p.coverImageId,
    logoImageId: p.logoImageId,
    reservationsEnabled: p.reservationsEnabled,
    timezone,
    capacity,
    maxParty,
    slotMinutes: int(p.slotMinutes, "Intervalo de reservas", 15, 120),
    visitMinutes: int(p.visitMinutes, "Duración de la visita", 30, 240),
    horizonDays: int(p.horizonDays, "Anticipación máxima", 1, 180),
    schedule,
    closedDates: [...new Set(p.closedDates)],
    services: {
      dineIn: p.services.dineIn,
      pickup: p.services.pickup,
      delivery: p.services.delivery,
    },
    deliveryZones,
    prepMinutes: int(p.prepMinutes, "Preparación estimada", 5, 240),
    minimumOrder: int(p.minimumOrder, "Pedido mínimo", 0, 1000000000),
  };
}
export function localParts(date: Date, zone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const o = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return {
    date: `${o.year}-${o.month}-${o.day}`,
    time: `${o.hour}:${o.minute}`,
  };
}
export function zonedInstant(date: string, time: string, zone: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(minutes(time)))
    throw fail("Fecha u hora no válida.");
  const target = Date.parse(`${date}T${time}:00Z`);
  if (!Number.isFinite(target)) throw fail("Fecha no válida.");
  let guess = target;
  for (let i = 0; i < 4; i++) {
    const p = localParts(new Date(guess), zone),
      represented = Date.parse(`${p.date}T${p.time}:00Z`);
    guess += target - represented;
  }
  const result = new Date(guess),
    p = localParts(result, zone);
  if (p.date !== date || p.time !== time)
    throw fail("Esa hora no existe en la zona horaria del restaurante.");
  return result;
}
export function dayOfWeek(date: string) {
  return new Date(date + "T12:00:00Z").getUTCDay();
}
export const restaurantStatusLabels: Record<string, string> = {
  confirmed: "Confirmado",
  preparing: "En cocina",
  ready: "Listo",
  shipped: "En camino",
  delivered: "Entregado",
  cancelled: "Cancelado",
};
