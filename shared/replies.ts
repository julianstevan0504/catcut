import type { Settings, Product, Order } from "../src/types.ts";
export const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
const money = (value: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);
export function searchProducts(products: Product[], query: string) {
  const terms = normalize(query)
    .split(/[^a-z0-9]+/)
    .filter((x) => x.length > 2);
  if (!terms.length) return products.slice(0, 8);
  return products
    .map((p) => ({
      ...p,
      score: terms.filter((t) =>
        normalize(`${p.name} ${p.sku} ${p.description} ${p.category}`).includes(
          t,
        ),
      ).length,
    }))
    .filter((p) => p.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map(({ score: _score, ...p }) => p);
}
export function localReply({
  settings,
  storeName,
  products,
  orders,
  phone,
  text,
}: {
  settings: Settings;
  storeName: string;
  products: Product[];
  orders: Order[];
  phone: string;
  text: string;
}) {
  const q = normalize(text);
  let reply = "",
    category = "general",
    handoff = false;
  const code = text.match(/#?([a-z]{1,8}-\d{2,})/i)?.[1];
  const knownSku =
    code && products.some((p) => p.sku.toUpperCase() === code.toUpperCase());
  if (
    /\b(humano|humana|asesor|asesora|persona|reclamo|reclamacion|vendedor|vendedora)\b/.test(
      q,
    )
  ) {
    reply =
      "¡Claro! Le aviso al equipo para que una persona continúe contigo 💚 Te responderá en el horario de atención. Cuéntame aquí lo que necesitas y lo verá en esta conversación.";
    category = "humano";
    handoff = true;
  } else if (/horario|hora|atienden|abren|cierran|sabado|domingo/.test(q)) {
    reply = `¡Claro! El equipo atiende: ${settings.hours} Yo puedo ayudarte con consultas automáticas a cualquier hora 🌿`;
    category = "horario";
  } else if (
    /pedido|rastreo|seguimiento|guia|orden|tracking/.test(q) ||
    (code && !knownSku)
  ) {
    category = "pedido";
    const order = code
      ? orders.find(
          (o) =>
            o.code.toUpperCase() === code.toUpperCase() && o.phone === phone,
        )
      : null;
    const labels: Record<string, string> = {
      confirmed: "confirmado",
      preparing: "en preparación",
      shipped: "en camino",
      delivered: "entregado",
      cancelled: "cancelado",
    };
    reply = !code
      ? "¡Con gusto reviso! 📦 Escríbeme el código de tu pedido, por ejemplo LC-1042, desde el mismo número con el que compraste."
      : order
        ? `Tu pedido ${order.code} está ${labels[order.status]} 📦${order.tracking_number ? ` Su número de guía es ${order.tracking_number}.` : ""}${order.tracking_url ? ` Puedes seguirlo aquí: ${order.tracking_url}` : ""} ¿Te ayudo con algo más?`
        : "No encontré ese pedido asociado al número desde el que me escribes. Verifica el código y que estés usando el número de la compra. Si necesitas ayuda, dime «hablar con una persona».";
  } else if (
    /envio|enviar|entrega|demora|bogota|medellin|cali|barranquilla/.test(q)
  )
    reply = `¡Sí! ${settings.shipping} 📦`;
  else if (/cambio|devol|garantia/.test(q))
    reply = `${settings.returns} Si quieres ayuda con tu caso, dime «hablar con una persona» 💚`;
  else if (/pago|pagar|nequi|tarjeta|transferencia/.test(q))
    reply = `¡Claro! ${settings.payments}`;
  else if (/gracias|hermoso|recibi|perfecto/.test(q) && q.length < 100)
    reply =
      "¡Con mucho gusto! Gracias por elegirnos 💚 Aquí estaré si necesitas algo más.";
  else {
    const matches = searchProducts(products, text);
    const faq = settings.faqs.find((f) =>
      normalize(f.question)
        .split(/\W+/)
        .filter((w) => w.length > 4)
        .some((w) => q.includes(w)),
    );
    if (
      matches.length &&
      !/^\s*(hola|buenos dias|buenas tardes|buenas noches)[!.,\s]*$/.test(q)
    ) {
      category = "stock";
      reply =
        "¡Te cuento! 🌿\n" +
        matches
          .slice(0, 3)
          .map((p) =>
            p.stock > 0
              ? `${p.name}: ${money(p.price)} COP, ${p.stock} ${p.stock === 1 ? "unidad disponible" : "unidades disponibles"}. ${p.description}`
              : `${p.name}: por ahora está agotado. Su precio registrado es ${money(p.price)} COP.`,
          )
          .join("\n\n") +
        "\n\n¿Te ayudo con algún detalle?";
    } else if (faq) reply = faq.answer;
    else if (/hola|buenos|buenas|^hey|^que tal/.test(q))
      reply = settings.welcome;
    else if (/producto|catalogo|stock|disponib|precio/.test(q)) {
      reply =
        "¡Con gusto! Dime el nombre del producto que te interesa para consultar su precio y disponibilidad 🌿";
      category = "stock";
    } else
      reply = `Puedo ayudarte con horarios, productos, envíos y seguimiento de pedidos de ${storeName} 🌿 Para una consulta especial, dime «hablar con una persona» y te comunico con el equipo.`;
  }
  return { text: reply, category, source: "local", handoff };
}
