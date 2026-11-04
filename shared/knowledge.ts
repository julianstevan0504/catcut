import type {
  Product,
  ReplyContext,
  Settings,
  KnowledgeDocument,
} from "../src/types.ts";
export const fold = (value: string) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
const noise = new Set(
  "a al algo algun alguna algunos algunas antes aqui asi buen buenas buenos como con cual cuales cuando cuanto cuantos cuesta cuestan dame de del decir dime donde el ella en esa ese eso esta estan este esto favor gracias gustaria ha hay hola hoy informacion ingrediente ingredientes la las le lleva llevan lo los mas me mi mis mostrar muestrame muy necesito nos o ofrecen para pedir por podria podrias precio precios producto productos que quiero quisiera saber se si sobre son su sus te tienen tiene tienes todo todos tu un una unas unos venden ver ya y disponible disponibles disponibilidad stock contiene contienen vale valor carta catalogo puedo puede puedes podemos es soy tambien aun interesa interesan seria sera podria podrian obtener consultar costo costos vez detalle detalles porfa porfavor negocio tienda local consulta consultame preguntarte preguntar duda dudas peculiar excepcional ambigua ayudame ayuda ayudar".split(
    " ",
  ),
);
const canonical: Record<string, string> = {
  domicilio: "envio",
  domicilios: "envio",
  mandan: "envio",
  despacho: "envio",
  despachan: "envio",
  delivery: "envio",
  entregan: "envio",
  entrega: "envio",
  entregas: "envio",
  perrito: "mascota",
  perrita: "mascota",
  perro: "mascota",
  perros: "mascota",
  gato: "mascota",
  gatos: "mascota",
  mascotas: "mascota",
  tarjetazo: "pago",
  abierto: "horario",
  abiertos: "horario",
  abren: "horario",
  cierran: "horario",
  atienden: "horario",
  atencion: "horario",
  abrir: "horario",
  cerrar: "horario",
  recogida: "recoger",
  retiro: "recoger",
  retirar: "recoger",
  recogemos: "recoger",
  conservar: "conservacion",
  guardar: "conservacion",
  guardarlo: "conservacion",
  guardarla: "conservacion",
  refrigerar: "conservacion",
  calentar: "recalentar",
  caliento: "recalentar",
  calentarlo: "recalentar",
  calentarla: "recalentar",
  hornearlo: "recalentar",
  refresco: "bebida",
  tomar: "bebida",
  tomamos: "bebida",
  beber: "bebida",
  gaseosa: "bebida",
  comer: "comida",
  almorzar: "comida",
  almuerzo: "comida",
  cenar: "comida",
  cena: "comida",
  vegetariana: "vegetariano",
  veganos: "vegano",
  vegetarianos: "vegetariano",
  barato: "economico",
  barata: "economico",
  baratos: "economico",
  baratas: "economico",
  economica: "economico",
  diferencias: "comparar",
  diferencia: "comparar",
  comparacion: "comparar",
  comparar: "comparar",
  recomiendas: "recomendar",
  recomendarias: "recomendar",
  sugieres: "recomendar",
  recomendacion: "recomendar",
};
const singular = (word: string) =>
  word.length > 5 && word.endsWith("es") && !word.endsWith("ces")
    ? word.slice(0, -2)
    : word.length > 4 && word.endsWith("s")
      ? word.slice(0, -1)
      : word;
export function tokens(value: string) {
  return fold(value)
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 1 && !noise.has(w))
    .map((w) => canonical[w] ?? singular(w));
}
function oneTypo(a: string, b: string) {
  if (
    a.length < 5 ||
    b.length < 5 ||
    /\d/.test(a + b) ||
    a[0] !== b[0] ||
    Math.abs(a.length - b.length) > 1
  )
    return false;
  let i = 0,
    j = 0,
    changes = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    if (++changes > 1) return false;
    if (a.length >= b.length) i++;
    if (b.length >= a.length) j++;
  }
  return changes + (i < a.length || j < b.length ? 1 : 0) <= 1;
}
export function tokenMatch(a: string, b: string) {
  return a === b || oneTypo(a, b);
}
export type KnowledgeHit = {
  id: string;
  title: string;
  text: string;
  kind: "document" | "faq" | "store" | "product";
  productId?: string;
  score: number;
};
export function validateKnowledge(value: unknown): KnowledgeDocument[] {
  if (!Array.isArray(value) || value.length > 60)
    throw Object.assign(
      new Error("Puedes cargar hasta 60 documentos de conocimiento."),
      { status: 400 },
    );
  const ids = new Set<string>();
  let total = 0;
  return value.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item))
      throw Object.assign(new Error("Revisa los documentos de conocimiento."), {
        status: 400,
      });
    const { id, title, content } = item as Record<string, unknown>;
    if (
      typeof id !== "string" ||
      !/^[a-zA-Z0-9_-]{1,80}$/.test(id) ||
      ids.has(id) ||
      typeof title !== "string" ||
      !title.trim() ||
      title.trim().length > 120 ||
      typeof content !== "string" ||
      !content.trim() ||
      content.trim().length > 12000
    )
      throw Object.assign(
        new Error(
          "Cada documento necesita un título de hasta 120 caracteres y texto de hasta 12.000 caracteres, con un identificador único.",
        ),
        { status: 400 },
      );
    total += content.length;
    if (total > 180000)
      throw Object.assign(
        new Error("La guía completa admite hasta 180.000 caracteres."),
        { status: 400 },
      );
    ids.add(id);
    return { id, title: title.trim(), content: content.trim() };
  });
}
export function storeDocuments(
  settings: Settings,
  storeName: string,
  products: Product[],
): KnowledgeHit[] {
  const rows: KnowledgeHit[] = [
    {
      id: "store:description",
      title: "Acerca de " + storeName,
      text: settings.description,
      kind: "store",
      score: 0,
    },
    ...(["hours", "shipping", "payments", "returns"] as const).map((key) => ({
      id: "store:" + key,
      title: {
        hours: "Horario, días y apertura",
        shipping: "Envíos, domicilios y entregas",
        payments: "Pagos y medios para pagar",
        returns: "Cambios, devoluciones y garantía",
      }[key],
      text: settings[key],
      kind: "store" as const,
      score: 0,
    })),
    ...settings.faqs.map((f) => ({
      id: "faq:" + f.id,
      title: f.question,
      text: f.answer,
      kind: "faq" as const,
      score: 0,
    })),
  ];
  for (const doc of settings.knowledge ?? []) {
    const paragraphs = doc.content.split(/\n\s*\n/).filter(Boolean);
    let part = "",
      index = 0;
    const add = () => {
      if (part)
        rows.push({
          id: `doc:${doc.id}:${index++}`,
          title: doc.title,
          text: part.trim(),
          kind: "document",
          score: 0,
        });
      part = "";
    };
    for (const paragraph of paragraphs) {
      if (part.length + paragraph.length > 1600) add();
      for (let i = 0; i < paragraph.length; i += 1600) {
        const slice = paragraph.slice(i, i + 1600);
        if (part.length + slice.length > 1800) add();
        part += (part ? "\n\n" : "") + slice;
      }
    }
    add();
  }
  for (const p of products)
    rows.push({
      id: "product:" + p.id,
      title: p.name + " " + p.sku + " " + p.category,
      text: [
        p.description,
        p.ingredients && "Ingredientes: " + p.ingredients,
        p.allergens && "Alérgenos: " + p.allergens,
      ]
        .filter(Boolean)
        .join("\n"),
      kind: "product",
      productId: p.id,
      score: 0,
    });
  return rows.filter((r) => r.text.trim());
}
export function searchKnowledge(
  {
    settings,
    storeName,
    products,
    text,
    context = {},
  }: {
    settings: Settings;
    storeName: string;
    products: Product[];
    text: string;
    context?: ReplyContext;
  },
  limit = 6,
): KnowledgeHit[] {
  const docs = storeDocuments(settings, storeName, products),
    query = [...new Set(tokens(text))];
  if (!query.length) return [];
  const terms = docs.map((d) => ({
    d,
    title: tokens(d.title),
    body: tokens(d.text),
  }));
  return terms
    .map(({ d, title, body }) => {
      let score = 0;
      for (const q of query) {
        const count = terms.filter(
          (x) => x.title.includes(q) || x.body.includes(q),
        ).length;
        const weight = Math.log(1 + (docs.length + 1) / (count + 1));
        const exactTitle = title.includes(q),
          exactBody = body.includes(q);
        score +=
          (exactTitle
            ? 4
            : exactBody
              ? 1.4
              : title.some((t) => oneTypo(q, t))
                ? 2
                : body.some((t) => oneTypo(q, t))
                  ? 0.65
                  : 0) * weight;
      }
      if (d.productId && context.productIds?.includes(d.productId) && score > 0)
        score += 0.3;
      return { ...d, score };
    })
    .filter((d) => d.score > 1.2)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
export function explicitProducts(products: Product[], text: string): Product[] {
  const q = fold(text),
    words = tokens(text);
  const full = products.filter((p) =>
    new RegExp(
      "(^|[^a-z0-9])" +
        fold(p.name).replace(/[.*+?^${}()|[\]\\]/g, "\\$&") +
        "(?=$|[^a-z0-9])",
    ).test(q),
  );
  if (full.length) return full;
  const exact = products.filter((p) =>
    new RegExp(
      "(^|[^a-z0-9])" +
        fold(p.sku).replace(/[.*+?^${}()|[\]\\]/g, "\\$&") +
        "(?=$|[^a-z0-9])",
    ).test(q),
  );
  if (exact.length) return exact;
  return products
    .map((p) => {
      const name = tokens(p.name).filter(
        (t) =>
          !new Set([
            "casa",
            "natural",
            "original",
            "especial",
            "clasico",
            "clasica",
            "dia",
          ]).has(t),
      );
      let score = 0;
      for (const t of name)
        if (words.some((w) => tokenMatch(w, t))) score += t.length > 3 ? 3 : 1;
      return { p, score };
    })
    .filter((x) => x.score >= 3)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.p)
    .slice(0, 6);
}
