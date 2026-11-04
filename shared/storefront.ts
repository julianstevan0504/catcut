export const businessTypes = {
  restaurante: "Restaurante",
  pizzeria: "Pizzería",
  hamburgueseria: "Hamburguesería",
  cafeteria: "Cafetería",
  casera: "Comida casera",
  panaderia: "Panadería",
  heladeria: "Heladería",
  otro: "Otra propuesta gastronómica",
};
export type BusinessType = keyof typeof businessTypes;
import type { RestaurantProfile } from "./restaurant.ts";
export const pageFields = [
  "slug",
  "displayName",
  "city",
  "businessType",
  "specialties",
  "whatsappNumber",
  "design",
  "welcome",
  "cuisine",
  "address",
  "phone",
  "coverImageId",
  "logoImageId",
] as const;
export type StorefrontDraft = Pick<
  RestaurantProfile,
  (typeof pageFields)[number]
>;
export function pageFromProfile(p: RestaurantProfile): StorefrontDraft {
  return Object.fromEntries(
    pageFields.map((k) => [k, p[k]]),
  ) as StorefrontDraft;
}
export type PageSection = "menu" | "story" | "contact";
export type StorefrontDesign = {
  generated: boolean;
  primaryColor: string;
  backgroundColor: string;
  fontFamily: "sans" | "serif" | "rounded";
  fontSize: number;
  heroLayout: "split" | "center" | "cover-left";
  menuLayout: "grid" | "list";
  alignment: "left" | "center";
  contentWidth: "wide" | "cozy";
  heroTitle: string;
  menuTitle: string;
  aboutTitle: string;
  about: string;
  showStory: boolean;
  showContact: boolean;
  sections: PageSection[];
};
export const presetColors = {
  terracotta: { primary: "#a3452c", background: "#fff9f0" },
  jade: { primary: "#2e6148", background: "#f8fbf3" },
  violet: { primary: "#74517e", background: "#fcf8ff" },
};
export function defaultDesign(
  accent: keyof typeof presetColors = "terracotta",
): StorefrontDesign {
  const colors = presetColors[accent] ?? presetColors.terracotta;
  return {
    generated: false,
    primaryColor: colors.primary,
    backgroundColor: colors.background,
    fontFamily: "sans",
    fontSize: 16,
    heroLayout: "split",
    menuLayout: "grid",
    alignment: "left",
    contentWidth: "wide",
    heroTitle: "Tu próxima\nbuena comida.",
    menuTitle: "Nuestra carta.",
    aboutTitle: "Una mesa con historia.",
    about: "",
    showStory: true,
    showContact: true,
    sections: ["menu", "story", "contact"],
  };
}
const invalid = (message: string) =>
  Object.assign(new Error(message), { status: 400 });
export function validateDesign(
  value: unknown,
  fallback = defaultDesign(),
): StorefrontDesign {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw invalid("Revisa el diseño de tu página.");
  const d = { ...fallback, ...value } as StorefrontDesign;
  for (const key of Object.keys(value))
    if (!Object.hasOwn(fallback, key))
      throw invalid("Ese ajuste de diseño no está permitido.");
  for (const key of ["primaryColor", "backgroundColor"] as const)
    if (typeof d[key] !== "string" || !/^#[0-9a-f]{6}$/i.test(d[key]))
      throw invalid("Elige colores válidos con el selector.");
  const choices: Record<string, string[]> = {
    fontFamily: ["sans", "serif", "rounded"],
    heroLayout: ["split", "center", "cover-left"],
    menuLayout: ["grid", "list"],
    alignment: ["left", "center"],
    contentWidth: ["wide", "cozy"],
  };
  for (const [key, allowed] of Object.entries(choices))
    if (!allowed.includes(String(d[key as keyof StorefrontDesign])))
      throw invalid("Una opción del diseño no está permitida.");
  if (!Number.isInteger(d.fontSize) || d.fontSize < 14 || d.fontSize > 22)
    throw invalid("Usa un tamaño de letra entre 14 y 22.");
  for (const [key, max] of [
    ["heroTitle", 140],
    ["menuTitle", 80],
    ["aboutTitle", 100],
    ["about", 2000],
  ] as const)
    if (
      typeof d[key] !== "string" ||
      d[key].length > max ||
      (key !== "about" && !d[key].trim())
    )
      throw invalid("Revisa los textos de la página pública.");
  for (const key of ["generated", "showStory", "showContact"] as const)
    if (typeof d[key] !== "boolean")
      throw invalid("Revisa las secciones visibles de la página.");
  if (
    !Array.isArray(d.sections) ||
    d.sections.length !== 3 ||
    new Set(d.sections).size !== 3 ||
    !["menu", "story", "contact"].every((k) =>
      d.sections.includes(k as PageSection),
    )
  )
    throw invalid(
      "Cada sección debe aparecer una sola vez en el orden de la página.",
    );
  return {
    ...d,
    primaryColor: d.primaryColor.toLowerCase(),
    backgroundColor: d.backgroundColor.toLowerCase(),
    sections: [...d.sections],
  };
}
export function foldSearch(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}
export function slugify(value: string) {
  return foldSearch(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60)
    .replace(/-$/g, "");
}
export function whatsappUrl(number: string, name: string) {
  const phone = number.replace(/[\s()-]/g, "");
  return /^\+[1-9]\d{7,14}$/.test(phone)
    ? "https://wa.me/" +
        phone.slice(1) +
        "?text=" +
        encodeURIComponent("Hola, quisiera consultar sobre " + name + ".")
    : "";
}
const rgb = (color: string) =>
  [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16));
const luminance = (c: string) =>
  rgb(c)
    .map((v) => {
      v /= 255;
      return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    })
    .reduce((n, v, i) => n + v * [0.2126, 0.7152, 0.0722][i], 0);
export const contrast = (a: string, b: string) => {
  const x = luminance(a),
    y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};
const mix = (a: string, b: string, t: number) =>
  "#" +
  rgb(a)
    .map((v, i) =>
      Math.round(v * (1 - t) + rgb(b)[i] * t)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("");
export function storefrontTheme(d: StorefrontDesign): Record<string, string> {
  const bg = d.backgroundColor,
    ink = contrast("#30231d", bg) >= 4.5 ? "#30231d" : "#fff8ef";
  let accent = d.primaryColor;
  for (let i = 0; contrast(accent, bg) < 4.5 && i < 20; i++)
    accent = mix(accent, ink, 0.14);
  const muted = mix(ink, bg, 0.26),
    buttonText =
      contrast("#ffffff", d.primaryColor) >= 4.5 ? "#ffffff" : "#211914";
  return {
    "--menu-primary": d.primaryColor,
    "--menu-accent": accent,
    "--menu-strong": ink,
    "--menu-ink": ink,
    "--menu-muted": muted,
    "--menu-wash": mix(bg, d.primaryColor, 0.065),
    "--menu-line": mix(bg, ink, 0.18),
    "--menu-pill": mix(bg, d.primaryColor, 0.12),
    "--menu-bg": bg,
    "--menu-card": mix(bg, ink, 0.015),
    "--menu-button-text": buttonText,
    "--store-font-size": d.fontSize + "px",
    "--store-font":
      d.fontFamily === "serif"
        ? 'Georgia, "Times New Roman", serif'
        : d.fontFamily === "rounded"
          ? '"Trebuchet MS", system-ui, sans-serif'
          : '"DM Sans Variable", system-ui, sans-serif',
    "--store-width": d.contentWidth === "cozy" ? "1000px" : "1200px",
  };
}
export function generatePage(input: {
  displayName: string;
  businessType: BusinessType;
  city: string;
  specialties: string;
  description: string;
  accent: keyof typeof presetColors;
}) {
  const title: Record<BusinessType, string> = {
    restaurante: "Tu próxima\nbuena mesa.",
    pizzeria: "Una buena pizza\nempieza aquí.",
    hamburgueseria: "Hoy nos vemos\nentre hamburguesas.",
    cafeteria: "Tu próxima pausa\nsabe a café.",
    casera: "Sabores de casa.\nMomentos para compartir.",
    panaderia: "Una pausa\ncon sabor a pan.",
    heladeria: "Un momento\npara algo dulce.",
    otro: "Tu próximo\nfavorito está aquí.",
  };
  const description =
    input.description.trim() ||
    `${input.displayName}, ${businessTypes[input.businessType].toLowerCase()}${input.city ? " en " + input.city : ""}. ${input.specialties ? "Conoce nuestra propuesta de " + input.specialties + "." : "Descubre nuestra carta y elige tu próximo favorito."}`;
  return {
    welcome: description.slice(0, 500),
    design: {
      ...defaultDesign(input.accent),
      generated: true,
      heroTitle: title[input.businessType],
      about: description,
      aboutTitle: "Conoce " + input.displayName,
      fontFamily:
        input.businessType === "cafeteria" || input.businessType === "panaderia"
          ? ("serif" as const)
          : ("sans" as const),
    },
  };
}
