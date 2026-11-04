import type {
  Settings,
  Product,
  Order,
  ReplyContext,
  StoreReply,
} from "../src/types.ts";
export const normalize = (value: string) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
const money = (value: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);
const stop = new Set(
  "a al algo algun alguna algunos algunas antes aqui asi buen buenas buenos como con cual cuales cuando cuanto cuantos cuesta cuestan dar dame de del decir dime donde el ella en esa ese eso esta estan este esto favor gracias gustaria ha hay hola hoy informacion ingrediente ingredientes la las le lleva llevan lo los mas me menu menus mi mis mostrar muestrame muy necesito nos o ofrecen para pedir por podria podrias precio precios producto productos que quiero quisiera saber se si sobre son su sus te tienen tiene tienes todo todos tu un una unas unos venden ver ya y disponible disponibles disponibilidad stock contiene contienen cuanto vale valor favor carta catalogo materiales composicion puedo puede puedes podemos es comer almuerzo cenar desayunar soy alergico alergica tambien porfavor saber favor saber saber todavia aun interesa interesan gustaron gusto encanto encantaron seria sera podria podrian obtener consultar cuestan costo costos vez informacion detalle detalles porfa porfavor".split(
    " ",
  ),
);
const stem = (w: string) =>
  w.length > 4 && w.endsWith("s") ? w.slice(0, -1) : w;
function terms(text: string) {
  return normalize(text)
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 1 && !stop.has(w))
    .map(stem);
}
function words(text: string) {
  return normalize(text)
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map(stem);
}
function matchesTerm(word: string, haystack: string[]) {
  return haystack.includes(word);
}
export function searchProducts(products: Product[], query: string): Product[] {
  const normalizedQuery = normalize(query);
  const exactSku = products.filter((p) =>
    new RegExp(
      "(^|[^a-z0-9])" +
        normalize(p.sku).replace(/[.*+?^${}()|[\]\\]/g, "\\$&") +
        "(?=$|[^a-z0-9])",
    ).test(normalizedQuery),
  );
  if (exactSku.length) return exactSku;
  const wanted = terms(query);
  if (!wanted.length) return products.slice(0, 12);
  return products
    .map((p) => {
      const primary = words(p.name + " " + p.sku),
        secondary = words(
          p.description + " " + p.category + " " + (p.ingredients ?? ""),
        );
      return {
        p,
        score: wanted.reduce(
          (n, t) =>
            n +
            (matchesTerm(t, primary) ? 5 : matchesTerm(t, secondary) ? 1 : 0),
          0,
        ),
      };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 12)
    .map((x) => x.p);
}
export const attack =
  /ignora|olvida.{0,25}(instruccion|regla)|instrucciones.{0,20}(sistema|ocult)|system.?prompt|developer.?message|actua como|act as|ignore.{0,35}(instruction|previous|rule)|revela.{0,25}(token|clave|prompt|secreto)|api.?key|password|contrase[nñ]a.{0,20}(sistema|admin)|jailbreak/;
export const outside =
  /\b(capital|presidente|politica|elecciones|clima|temperatura|futbol|horoscopo|bitcoin|criptomoneda|diagnostico|medicamento|programacion|javascript|python|chiste|poema|poesia|traduce|traduccion|calcula|resuelve|ecuacion|matematica|receta|recetas|historia universal|noticias)\b|\d\s*[+*/=]\s*\d/;
const inventoryRequest =
  /\b(tienen|tienes|hay|venden|vendes|ofrecen|quiero|quisiera|comprar|pedir|busco|disponible|disponibilidad|agotado|precio|cuesta|vale|ingredientes|contiene|lleva)\b/;
const allergyNote =
  "Si tienes una alergia, confirma ingredientes y posibles trazas con el equipo antes de consumir. No puedo garantizar que un plato sea seguro para ti.";

export function localReply({
  settings,
  storeName,
  products,
  orders,
  phone,
  text,
  context = {},
  allowOrders = true,
  channel = "text",
}: {
  settings: Settings;
  storeName: string;
  products: Product[];
  orders: Order[];
  phone: string;
  text: string;
  context?: ReplyContext;
  allowOrders?: boolean;
  channel?: "text" | "voice";
}): StoreReply {
  const q = normalize(text).trim(),
    wanted = terms(text);
  const result = (
    reply: string,
    category = "general",
    policy: StoreReply["policy"] = "grounded",
    selected: Product[] = [],
    handoff = false,
    extra: ReplyContext = {},
  ): StoreReply => ({
    text: reply,
    category,
    source: "local",
    handoff,
    productIds: selected.map((p) => p.id),
    context: {
      ...context,
      ...(selected.length ? { productIds: selected.map((p) => p.id) } : {}),
      ...extra,
    },
    policy,
  });
  const scope = `Soy ${settings.assistantName}, la asistente virtual de ${storeName}. Solo puedo ayudarte con información de este negocio: catálogo, menú, precios, ingredientes, disponibilidad, horarios y pedidos.`;
  if (attack.test(q)) return result(scope, "fuera-de-tienda", "outside");
  if (
    /\b(humano|humana|asesor|asesora|persona|reclamo|reclamacion|vendedor|vendedora)\b/.test(
      q,
    )
  )
    return result(
      channel === "voice"
        ? "Claro. Dejo tu solicitud para que el equipo te atienda. También puedes escribirnos por WhatsApp."
        : "¡Claro! Le aviso al equipo para que una persona continúe contigo 💚 Te responderá en el horario de atención.",
      "humano",
      "grounded",
      [],
      true,
    );
  const code = text.match(/#?([a-z]{1,8}-\d{2,})/i)?.[1];
  const knownSku =
    code && products.some((p) => p.sku.toUpperCase() === code.toUpperCase());
  if (
    /\b(pedido|rastreo|seguimiento|guia|orden|tracking)\b/.test(q) ||
    (code && !knownSku)
  ) {
    if (!allowOrders)
      return result(
        "Para revisar un pedido y proteger tus datos, escríbenos por WhatsApp desde el número de la compra e indica su código. Por voz puedo ayudarte con el menú, precios y productos.",
        "pedido",
        "grounded",
      );
    if (!code)
      return result(
        "¡Con gusto reviso! 📦 Escríbeme el código de tu pedido, por ejemplo LC-1042, desde el mismo número con el que compraste.",
        "pedido",
      );
    const order = orders.find(
      (o) => o.code.toUpperCase() === code.toUpperCase() && o.phone === phone,
    );
    if (!order)
      return result(
        "No encontré ese pedido asociado al número desde el que me escribes. Verifica el código y que estés usando el número de la compra. Si necesitas ayuda, dime «hablar con una persona».",
        "pedido",
        "not-found",
      );
    const labels: Record<string, string> = {
      confirmed: "confirmado",
      preparing: "en preparación",
      shipped: "en camino",
      delivered: "entregado",
      cancelled: "cancelado",
    };
    return result(
      `Tu pedido ${order.code} está ${labels[order.status]} 📦${order.tracking_number ? ` Su número de guía es ${order.tracking_number}.` : ""}${order.tracking_url ? ` Puedes seguirlo aquí: ${order.tracking_url}` : ""}`,
      "pedido",
    );
  }
  if (outside.test(q)) return result(scope, "fuera-de-tienda", "outside");
  if (
    /\b(horario|atienden|abren|cierran|sabado|domingo)\b|hora.{0,15}(abren|cierran|atienden|abre|cierra)/.test(
      q,
    )
  )
    return result(
      `El horario de atención del equipo es: ${settings.hours}`,
      "horario",
    );
  if (
    /\b(envio|envios|enviar|entrega|entregas|domicilio|domicilios|demora|bogota|medellin|cali|barranquilla)\b/.test(
      q,
    )
  )
    return result(settings.shipping, "envio");
  if (/\b(cambio|cambios|devolucion|devoluciones|garantia)\b/.test(q))
    return result(settings.returns, "cambios");
  if (/\b(pago|pagos|pagar|nequi|tarjeta|transferencia)\b/.test(q))
    return result(settings.payments, "pagos");
  const isMenu =
    /\b(menu|carta|platos|bebidas|comida|comidas|comer|almuerzo|cenar|desayunar)\b/.test(
      q,
    );
  const isCatalog =
    /\b(catalogo|productos)\b|que (tienen|hay|venden)|que me (ofrecen|ofreces)/.test(
      q,
    );
  const ingredients =
    /ingrediente|contiene|composicion|material|\b(lleva|llevan)\b/.test(q);
  const allergy = /alerg|gluten|celiac|intoleran|trazas/.test(q);
  const genericTokens = new Set([
    "plato",
    "bebida",
    "comida",
    "restaurante",
    "alergeno",
    "alergico",
    "alergica",
    "soy",
    "sin",
    "tiene",
    "opcion",
    "opcione",
    "version",
    "versione",
    "es",
    "hay",
    "mismo",
  ]);
  const target = wanted.filter((t) => !genericTokens.has(t));
  let selected = searchProducts(products, text);
  if (!target.length) selected = [];
  else
    selected = selected.filter((p) =>
      target.some((t) =>
        matchesTerm(
          t,
          words(
            p.name +
              " " +
              p.sku +
              " " +
              p.description +
              " " +
              (p.ingredients ?? ""),
          ),
        ),
      ),
    );
  const following =
    (ingredients ||
      allergy ||
      /cuanto|cuesta|precio|ese|esa|este|esta|disponible|vale/.test(q)) &&
    !target.length;
  if (following && context.productIds?.length === 1)
    selected = products.filter((p) => p.id === context.productIds![0]);
  if (
    /^(mas|ver mas|mas menu|seguir|siguiente|continua)[.!?\s]*$/.test(q) &&
    context.menuOffset
  ) {
    return menuList(
      products.filter(
        (p) => (p.kind === "dish" || p.kind === "drink") && p.stock > 0,
      ),
      context.menuOffset,
    );
  }
  function item(p: Product, full: boolean) {
    const availability =
      p.stock > 0
        ? `${p.stock} ${p.stock === 1 ? "unidad disponible" : "unidades disponibles"}`
        : "agotado: no hay unidades disponibles";
    let line = `${p.name}: ${money(p.price)} COP · ${availability}.`;
    if (
      p.kind === "dish" ||
      p.kind === "drink" ||
      ingredients ||
      allergy ||
      full
    ) {
      if (p.ingredients?.trim())
        line += ` Ingredientes registrados: ${p.ingredients.trim()}`;
      else if (p.kind === "dish" || p.kind === "drink" || ingredients)
        line +=
          " No tengo ingredientes registrados para este producto; debo confirmarlos con el equipo.";
      if (
        (allergy || p.kind === "dish" || p.kind === "drink") &&
        p.allergens?.trim()
      )
        line += ` Alérgenos registrados: ${p.allergens.trim()}`;
      else if (allergy)
        line += " No tengo información de alérgenos confirmada.";
    } else if (p.description) line += ` ${p.description}`;
    return line;
  }
  function menuList(items: Product[], offset = 0): StoreReply {
    if (!items.length)
      return result(
        "No hay platos o bebidas disponibles en el menú registrado. El equipo puede confirmar las próximas opciones.",
        "menu",
        "not-found",
      );
    const rows: string[] = [];
    const chosen: Product[] = [];
    let length = 0;
    for (const p of items.slice(offset)) {
      const row = item(p, true);
      if (length + row.length > 3150 && rows.length) break;
      rows.push(row);
      chosen.push(p);
      length += row.length;
      if (channel === "voice" && chosen.length >= 3) break;
    }
    const remaining = items.length - offset - chosen.length;
    return result(
      "Esto es lo que está disponible en nuestro menú:\n\n" +
        rows.join("\n\n") +
        (remaining > 0
          ? `\n\nHay ${remaining} opciones más. Di «ver más» para continuar.`
          : ""),
      "menu",
      "grounded",
      chosen,
      false,
      { menuOffset: remaining > 0 ? offset + chosen.length : 0 },
    );
  }
  if (isMenu && !target.length)
    return menuList(
      products.filter(
        (p) => (p.kind === "dish" || p.kind === "drink") && p.stock > 0,
      ),
    );
  if (isCatalog && !target.length) {
    const available = products.filter((p) => p.stock > 0);
    if (!available.length)
      return result(
        "En este momento no hay productos con disponibilidad en el catálogo registrado.",
        "stock",
        "not-found",
      );
    const entries = available.slice(0, channel === "voice" ? 4 : 12);
    return result(
      "Tenemos estas opciones disponibles:\n" +
        entries.map((p) => `${p.name}: ${money(p.price)} COP.`).join("\n") +
        "\nDime cuál te interesa para consultar sus detalles.",
      "stock",
      "grounded",
      entries,
    );
  }
  if (selected.length && target.length) {
    // Do not turn a request for a variant into a claim that a different product exists.
    const unrecognized = target.filter(
      (t) =>
        !selected.some((p) =>
          matchesTerm(
            t,
            words(
              p.name +
                " " +
                p.sku +
                " " +
                p.description +
                " " +
                (p.ingredients ?? "") +
                " " +
                p.category,
            ),
          ),
        ),
    );
    const variantQuery = selected.reduce(
      (value, p) => value.replace(normalize(p.name), ""),
      q,
    );
    const variant =
      /\b(sin|extra|vegana|vegano|vegetariano|vegetariana|quitar|quiten|cambiar|agregar)\b/.test(
        variantQuery,
      );
    if (!allergy && (unrecognized.length || variant)) {
      return result(
        "No tengo esa opción o modificación registrada en el catálogo. No puedo confirmar que la tengamos. Puedo mostrarte las opciones disponibles o pasarte con el equipo.",
        "stock",
        "not-found",
      );
    }
  }
  if (selected.length) {
    const chosen = selected.slice(0, channel === "voice" ? 2 : 3);
    const noIngredients =
      ingredients && chosen.every((p) => !p.ingredients?.trim());
    let reply =
      (settings.tone === "profesional" ? "Con gusto." : "¡Te cuento! 🌿") +
      "\n" +
      chosen.map((p) => item(p, ingredients)).join("\n\n");
    if (allergy) reply += "\n\n" + allergyNote;
    return result(
      reply,
      "stock",
      noIngredients ? "missing-data" : "grounded",
      chosen,
    );
  }
  if ((ingredients || allergy) && !target.length)
    return result(
      "¿De qué producto o plato quieres conocer los ingredientes o alérgenos? Dime su nombre para consultar únicamente lo registrado.",
      "ingredientes",
      "missing-data",
    );
  if (
    /^\s*(hola|buenos dias|buenas tardes|buenas noches|hey|que tal|quien eres)[!.,?¿\s]*$/.test(
      q,
    )
  )
    return result(settings.welcome, "saludo");
  if (/^(muchas )?gracias[!.,\s]*$|^perfecto[!.,\s]*$/.test(q))
    return result(
      "¡Con gusto! Estoy aquí para ayudarte con nuestra tienda.",
      "saludo",
    );
  const faq = settings.faqs.find((f) => {
    const words = terms(f.question);
    return (
      words.length > 0 &&
      words.filter((w) => wanted.includes(w)).length >=
        Math.min(2, words.length)
    );
  });
  if (faq) return result(faq.answer, "faq");
  if (inventoryRequest.test(q) || isMenu)
    return result(
      `No tenemos ese producto registrado en el catálogo de ${storeName}. Puedo mostrarte lo que sí está disponible.`,
      "stock",
      "not-found",
    );
  return result(scope, "fuera-de-tienda", "outside");
}
