import { restaurantDemoRequest } from "./restaurant-standalone";
import type {
  Activity,
  Conversation,
  Message,
  Order,
  Product,
  Session,
  Settings,
  ReplyContext,
  VoiceSession,
} from "./types";
import { businessExamples } from "../shared/business-examples";
import { restaurantMenuExamples } from "../shared/restaurant-examples";
import { defaultSettings } from "../shared/defaults";
import { assistantReply } from "../shared/advisor";
import { validateKnowledge } from "../shared/knowledge";
import { normalize } from "../shared/replies";
import { validateImport, validateProduct } from "../shared/catalog";

declare const __CERCA_STANDALONE__: boolean;
export const standaloneMode =
  typeof __CERCA_STANDALONE__ !== "undefined" && __CERCA_STANDALONE__;
const storageKey = "cerca.demo.v2";
const id = () =>
  globalThis.crypto?.randomUUID?.() ??
  "demo-" +
    Array.from(globalThis.crypto.getRandomValues(new Uint8Array(16)), (x) =>
      x.toString(16).padStart(2, "0"),
    ).join("");
const stamp = () => new Date().toISOString();
export type DemoData = {
  images?: Record<string, string>;
  version: 2;
  name: string;
  settings: Settings;
  products: Product[];
  orders: Order[];
  conversations: Conversation[];
  messages: Record<string, Message[]>;
  activities: Activity[];
  contexts?: Record<string, ReplyContext>;
  voiceHistory?: {
    id: string;
    conversation_id: string;
    mode: string;
    created_at: string;
    expires_at: string;
    ended_at: string | null;
    turn_count: number;
  }[];
};
class LocalError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}
let memory: DemoData | null = null;
let persistent = true;
let signedOut = false;
function seed(): DemoData {
  const now = stamp();
  const d: DemoData = {
    version: 2,
    name: "La Mesa",
    settings: {
      ...structuredClone(defaultSettings),
      knowledge: structuredClone(businessExamples),
    },
    products: [],
    orders: [],
    conversations: [],
    messages: {},
    activities: [],
  };
  d.products = restaurantMenuExamples.map((p) => ({ ...p, id: id() }));
  const contacts = [
    [
      "Valentina Rojas",
      "+573001112233",
      "stock",
      "¡Hola! ¿Qué lleva la Pizza Margarita?",
    ],
    [
      "Santiago López",
      "+573102224455",
      "pedido",
      "¿Cómo va mi pedido LC-1043?",
    ],
    [
      "Mariana Torres",
      "+573203334466",
      "horario",
      "¿Qué horario tienen los sábados?",
    ],
    [
      "Daniela Pérez",
      "+573304445577",
      "humano",
      "Me gustaría hablar con una persona",
    ],
    [
      "Andrés Castro",
      "+573405556688",
      "stock",
      "¿Están disponibles los platos del menú?",
    ],
    ["Camila Ruiz", "+573516667799", "general", "¿Qué medios de pago manejan?"],
    [
      "Nicolás Gómez",
      "+573627778800",
      "general",
      "¡Muchas gracias por mi compra!",
    ],
  ];
  d.orders = [
    {
      id: id(),
      code: "LC-1042",
      customer: "Valentina Rojas",
      phone: "+573001112233",
      status: "shipped",
      total: 28000,
      items: "1 × Pizza Margarita",
      tracking_number: "DEMO-1042",
      tracking_url: "",
      created_at: now,
      updated_at: now,
    },
    {
      id: id(),
      code: "LC-1043",
      customer: "Santiago López",
      phone: "+573102224455",
      status: "preparing",
      total: 56000,
      items: "2 × Hamburguesa de la Casa, 1 × Limonada Natural",
      tracking_number: "",
      tracking_url: "",
      created_at: now,
      updated_at: now,
    },
  ];
  contacts.forEach(([name, phone, topic, text], index) => {
    const cid = id(),
      time = new Date(Date.now() - (index * 38 + 4) * 60000).toISOString();
    const c: Conversation = {
      id: cid,
      name,
      phone,
      topic,
      channel: "demo",
      status: index === 3 ? "pending" : index === 6 ? "resolved" : "open",
      handoff: index === 3 ? 1 : 0,
      unread: index < 2 ? 1 : 0,
      created_at: time,
      updated_at: time,
      last_message: "",
      last_role: "assistant",
    };
    const reply = assistantReply({
      text,
      settings: d.settings,
      storeName: d.name,
      products: d.products,
      orders: d.orders,
      phone,
    });
    d.conversations.push(c);
    d.messages[cid] = [
      {
        id: id(),
        role: "user",
        text,
        created_at: time,
        status: "received",
        source: "local",
      },
      {
        id: id(),
        role: "assistant",
        text: reply.text,
        created_at: time,
        status: "simulated",
        source: "local",
      },
    ];
    // Historical example messages produce an honest chart from the saved demo data.
    for (let day = 1; day <= 6; day++) {
      if (index > [2, 4, 3, 5, 4, 6][day - 1]) continue;
      const at = new Date(
        Date.now() - day * 86400000 - index * 60000,
      ).toISOString();
      d.messages[cid].unshift({
        id: id(),
        role: "user",
        text: "¡Hola! Quisiera consultar el catálogo.",
        created_at: at,
        status: "received",
        source: "local",
      });
    }
    c.last_message = reply.text;
  });
  d.activities.push({
    id: id(),
    action: "demo.created",
    description:
      "Demo interactiva iniciada. Los datos se guardan solo en este navegador y no se envían mensajes reales.",
    actor: "Sistema",
    created_at: now,
  });
  return d;
}
function load() {
  if (memory) return memory;
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      const parsed = JSON.parse(saved) as DemoData;
      if (
        parsed.version === 2 &&
        typeof parsed.name === "string" &&
        parsed.settings &&
        Array.isArray(parsed.products) &&
        Array.isArray(parsed.orders) &&
        Array.isArray(parsed.conversations) &&
        parsed.messages &&
        Array.isArray(parsed.activities)
      )
        memory = parsed;
    }
  } catch {
    persistent = false;
  }
  memory ??= seed();
  memory.settings = { ...defaultSettings, ...memory.settings };
  memory.contexts ??= {};
  memory.voiceHistory ??= [];
  return memory;
}
function save(d: DemoData) {
  const wasPersistent = persistent;
  try {
    localStorage.setItem(storageKey, JSON.stringify(d));
    persistent = true;
  } catch {
    persistent = false;
    if (wasPersistent)
      window.dispatchEvent(new Event("cerca:storage-unavailable"));
  }
  memory = d;
}
function event(d: DemoData, action: string, description: string) {
  d.activities.unshift({
    id: id(),
    action,
    description,
    actor: "Demo local",
    created_at: stamp(),
  });
  d.activities = d.activities.slice(0, 500);
}
function message(
  d: DemoData,
  c: Conversation,
  role: Message["role"],
  text: string,
) {
  const m = {
    id: id(),
    role,
    text,
    source: role === "agent" ? "agent" : "local",
    status: role === "user" ? "received" : "simulated",
    created_at: stamp(),
  };
  d.messages[c.id] ??= [];
  d.messages[c.id].push(m);
  c.last_message = text;
  c.last_role = role;
  c.updated_at = m.created_at;
  return m;
}
function requireText(value: unknown, max = 4000) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max)
    throw new LocalError("Completa el campo con un texto válido.");
  return value.trim();
}
function session(d: DemoData): Session {
  return {
    platformAdmin: true,
    user: { id: "offline-owner", name: "Andrea", email: "demo@cerca.local" },
    workspace: {
      id: "offline-workspace",
      name: d.name,
      created_at: d.activities.at(-1)?.created_at ?? stamp(),
    },
    settings: d.settings,
    integration: {
      configured: false,
      phoneNumberId: "",
      displayPhone: "",
      status: "disconnected",
      webhookUrl:
        "Requiere la versión con servidor y una dirección HTTPS pública",
    },
    ai: { configured: false, model: "Asistente local" },
    demo: true,
    offline: true,
    persistence: persistent ? "browser" : "memory",
  };
}

const demoVoiceSessions = new Map<string, VoiceSession>();
export async function standaloneRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const method = options.method ?? "GET";
  const url = new URL(path, "https://cerca.invalid");
  const route = url.pathname;
  let body: Record<string, unknown> = {};
  if (typeof options.body === "string") {
    try {
      body = JSON.parse(options.body);
    } catch {
      throw new LocalError("El formato de los datos no es válido.");
    }
  }
  let d = load();
  function done(value: unknown) {
    if (method !== "GET" && method !== "HEAD") save(d);
    return structuredClone(value) as T;
  }
  const restaurantResult = restaurantDemoRequest({
    route: path,
    method,
    body,
    data: d,
  });
  if (restaurantResult) return done(restaurantResult.value);
  if (route === "/bootstrap")
    return done({
      demoEnabled: true,
      registrationAllowed: false,
      offline: true,
      emailRecoveryEnabled: false,
    });
  if (route === "/auth/register" || route === "/auth/login")
    throw new LocalError(
      "Las cuentas reales se usan con el servidor. En este archivo puedes explorar la demo sin contraseña.",
    );
  if (route === "/auth/demo") {
    signedOut = false;
    return done({ ok: true });
  }
  if (signedOut) throw new LocalError("Abre la demo para continuar.", 401);
  if (route === "/auth/logout") {
    signedOut = true;
    return done({ ok: true });
  }
  if (route === "/me") return done(session(d));
  if (route === "/demo/reset") {
    d = seed();
    return done({ ok: true });
  }
  if (route === "/settings" && method === "PUT") {
    if (body.knowledge !== undefined)
      body.knowledge = validateKnowledge(body.knowledge);
    if (body.storeName !== undefined) d.name = requireText(body.storeName, 100);
    const allowed = [
      "assistantName",
      "active",
      "tone",
      "description",
      "hours",
      "shipping",
      "returns",
      "payments",
      "welcome",
      "faqs",
      "knowledge",
      "rememberPreferences",
      "voiceEnabled",
      "voiceRate",
    ] as const;
    for (const key of allowed)
      if (body[key] !== undefined)
        (d.settings as unknown as Record<string, unknown>)[key] = body[key];
    event(
      d,
      "settings.updated",
      "Se actualizó la configuración del asistente en este navegador.",
    );
    return done({ ok: true });
  }
  if (route === "/products/import" && method === "POST") {
    const parsed = validateImport(body);
    let created = 0,
      updated = 0;
    for (const p of parsed.products)
      if (!parsed.updateExisting && d.products.some((x) => x.sku === p.sku))
        throw new LocalError(
          `El SKU ${p.sku} ya existe. Activa la opción de actualizar si quieres reemplazar sus datos.`,
          409,
        );
    for (const p of parsed.products) {
      const existing = d.products.find((x) => x.sku === p.sku);
      if (existing) {
        Object.assign(existing, p);
        updated++;
      } else {
        d.products.push({ ...p, id: id() });
        created++;
      }
    }
    event(
      d,
      "product.imported",
      `Importación de catálogo: ${created} nuevos y ${updated} actualizados.`,
    );
    return done({ created, updated });
  }
  if (route === "/products") {
    if (method === "GET")
      return done([...d.products].sort((a, b) => a.name.localeCompare(b.name)));
    const p = validateProduct(body);
    if (d.products.some((x) => x.sku === p.sku))
      throw new LocalError("Ese SKU ya está registrado.", 409);
    const created = { ...p, id: id() };
    d.products.push(created);
    event(d, "product.created", `Se agregó ${p.name} al catálogo.`);
    return done(created);
  }
  const productId = route.match(/^\/products\/([^/]+)$/)?.[1];
  if (productId) {
    const p = d.products.find((x) => x.id === productId);
    if (!p) throw new LocalError("Producto no encontrado.", 404);
    if (method === "DELETE") {
      d.products = d.products.filter((x) => x.id !== productId);
      event(d, "product.deleted", `Se eliminó ${p.name}.`);
    } else {
      const value = validateProduct(body);
      if (d.products.some((x) => x.id !== p.id && x.sku === value.sku))
        throw new LocalError("Ese SKU ya existe.", 409);
      Object.assign(p, value);
      event(
        d,
        "product.updated",
        `Se actualizó ${p.name}: ${p.stock} unidades.`,
      );
    }
    return done({ ok: true });
  }
  if (route === "/orders" && method === "GET") return done(d.orders);
  if (route === "/orders" || /^\/orders\/[^/]+$/.test(route)) {
    const code = requireText(body.code, 30).toUpperCase(),
      phone = requireText(body.phone, 30).replace(/[\s()-]/g, "");
    if (!/^[A-Z]{1,8}-\d{2,20}$/.test(code) || !/^\+[1-9]\d{7,14}$/.test(phone))
      throw new LocalError(
        "Revisa el código del pedido y el teléfono con código de país.",
      );
    if (
      !["confirmed", "preparing", "shipped", "delivered", "cancelled"].includes(
        String(body.status),
      )
    )
      throw new LocalError("Estado de pedido no válido.");
    if (
      !Number.isSafeInteger(body.total) ||
      Number(body.total) < 0 ||
      Number(body.total) > 1000000000
    )
      throw new LocalError("Revisa el total del pedido.");
    const oid = route.split("/")[2];
    const existing = oid ? d.orders.find((x) => x.id === oid) : undefined;
    if (oid && !existing) throw new LocalError("Pedido no encontrado.", 404);
    if (d.orders.some((x) => x.code === code && x.id !== oid))
      throw new LocalError("El código de pedido ya existe.", 409);
    const tracking = String(body.tracking_url ?? "");
    if (tracking) {
      let u: URL;
      try {
        u = new URL(tracking);
      } catch {
        throw new LocalError("El seguimiento debe ser una URL HTTPS.");
      }
      if (u.protocol !== "https:" || u.username || u.password)
        throw new LocalError(
          "El seguimiento debe usar HTTPS y no contener credenciales.",
        );
    }
    const value: Order = {
      id: oid ?? id(),
      code,
      phone,
      customer: requireText(body.customer, 100),
      items: requireText(body.items, 1000),
      status: String(body.status),
      total: Number(body.total),
      tracking_number: String(body.tracking_number ?? "").slice(0, 100),
      tracking_url: tracking,
      created_at: existing?.created_at ?? stamp(),
      updated_at: stamp(),
    };
    if (existing) Object.assign(existing, value);
    else d.orders.unshift(value);
    event(
      d,
      existing ? "order.updated" : "order.created",
      `Se ${existing ? "actualizó" : "registró"} el pedido ${code}.`,
    );
    return done(value);
  }
  if (route === "/conversations")
    return done(
      [...d.conversations].sort((a, b) =>
        b.updated_at.localeCompare(a.updated_at),
      ),
    );
  const cid = route.match(/^\/conversations\/([^/]+)/)?.[1];
  if (cid) {
    const c = d.conversations.find((x) => x.id === cid);
    if (!c) throw new LocalError("Conversación no encontrada.", 404);
    if (route.endsWith("/messages")) {
      if (method === "GET") {
        c.unread = 0;
        save(d);
        return done(
          [...(d.messages[cid] ?? [])].sort((a, b) =>
            a.created_at.localeCompare(b.created_at),
          ),
        );
      }
      const result = message(d, c, "agent", requireText(body.text));
      if (c.channel.startsWith("voice-")) {
        result.status = "note";
        event(
          d,
          "voice.note.added",
          "El equipo agregó una nota interna a la llamada.",
        );
      } else
        event(d, "message.sent", `El equipo respondió a ${c.name} en la demo.`);
      return done(result);
    }
    if (body.status !== undefined) {
      if (!["open", "pending", "resolved"].includes(String(body.status)))
        throw new LocalError("Estado no válido.");
      c.status = body.status as Conversation["status"];
    }
    if (typeof body.handoff === "boolean") c.handoff = body.handoff ? 1 : 0;
    event(
      d,
      "conversation.updated",
      `Se actualizó la conversación de ${c.name}.`,
    );
    return done({ ok: true });
  }
  if (route === "/simulator/reset") {
    for (const c of d.conversations.filter((c) => c.channel === "sandbox"))
      delete d.contexts![c.id];
    for (const c of d.conversations.filter((x) => x.channel === "sandbox")) {
      c.handoff = 0;
      c.status = "open";
    }
    event(d, "assistant.reset", "Se inició una nueva prueba del asistente.");
    return done({ ok: true });
  }
  if (route === "/simulator") {
    const text = requireText(body.text, 2000);
    let c = d.conversations.find((x) => x.channel === "sandbox");
    if (!c) {
      c = {
        id: id(),
        name: "Cliente de prueba",
        phone: "+573001112233",
        channel: "sandbox",
        status: "open",
        handoff: 0,
        unread: 0,
        topic: "general",
        created_at: stamp(),
        updated_at: stamp(),
        last_message: "",
        last_role: "user",
      };
      d.conversations.unshift(c);
    }
    message(d, c, "user", text);
    if (c.handoff || !d.settings.active)
      return done({ paused: true, text: null, conversationId: c.id });
    const reply = assistantReply({
      settings: d.settings,
      storeName: d.name,
      products: d.products,
      orders: d.orders,
      phone: c.phone,
      context: d.contexts?.[c.id] ?? {},
      text,
    });
    if (reply.handoff) {
      c.handoff = 1;
      c.status = "pending";
    }
    d.contexts ??= {};
    d.contexts[c.id] = reply.context;
    c.topic = reply.category;
    message(d, c, "assistant", reply.text);
    event(
      d,
      "assistant.tested",
      "Se probó el asistente en el simulador. No se envió ningún mensaje a WhatsApp.",
    );
    return done({ ...reply, conversationId: c.id });
  }
  if (route === "/voice/config")
    return done({
      publicEnabled: false,
      publicUrl: "",
      configured: false,
      accountSid: "",
      businessNumber: "",
      forwardNumber: "",
      status: "not-configured",
      lastWebhookAt: null,
      incomingUrl: "",
      statusUrl: "",
    });
  if (route === "/voice/history")
    return done([...(d.voiceHistory ?? [])].reverse());
  if (route === "/voice/sessions" && method === "POST") {
    if (!d.settings.active || !d.settings.voiceEnabled)
      throw new LocalError("El asistente de voz está en pausa.");
    const cid = id(),
      sid = id(),
      token = id(),
      expiresAt = new Date(Date.now() + 30 * 60000).toISOString();
    const c: Conversation = {
      id: cid,
      name: "Llamada web de prueba",
      phone: "web:" + sid,
      channel: "voice-test",
      status: "open",
      handoff: 0,
      unread: 0,
      topic: "voz",
      created_at: stamp(),
      updated_at: stamp(),
      last_message: "",
      last_role: "assistant",
    };
    d.conversations.unshift(c);
    d.messages[cid] = [];
    const greeting = `Hola, soy ${d.settings.assistantName}, la asistente virtual de ${d.name}. Puedo ayudarte con nuestro menú, productos, precios y horarios. Esta conversación se guarda en texto en la demo. ¿Qué te gustaría consultar?`;
    message(d, c, "assistant", greeting);
    const session = {
      id: sid,
      token,
      conversationId: cid,
      greeting,
      expiresAt,
    };
    demoVoiceSessions.set(sid, session);
    d.voiceHistory ??= [];
    d.voiceHistory.push({
      id: sid,
      conversation_id: cid,
      mode: "owner",
      created_at: stamp(),
      expires_at: expiresAt,
      ended_at: null,
      turn_count: 0,
    });
    event(
      d,
      "voice.started",
      "Se inició una llamada de prueba en esta demo local.",
    );
    return done(session);
  }
  const voiceRoute = route.match(
    /^\/voice\/sessions\/([^/]+)\/(turn|end|interrupt)$/,
  );
  if (voiceRoute && method === "POST") {
    const session = demoVoiceSessions.get(voiceRoute[1]);
    const headers = new Headers(options.headers);
    if (!session || headers.get("Authorization") !== `Bearer ${session.token}`)
      throw new LocalError("Inicia una nueva llamada.", 401);
    const history = d.voiceHistory!.find((h) => h.id === session.id)!;
    if (history.ended_at || session.expiresAt < stamp())
      throw new LocalError("La llamada terminó. Inicia otra.", 410);
    if (voiceRoute[2] === "interrupt") {
      event(
        d,
        "voice.interrupted",
        "Interrumpiste una respuesta de voz para continuar.",
      );
      return done({ ok: true });
    }
    if (voiceRoute[2] === "end") {
      history.ended_at = stamp();
      event(d, "voice.ended", "Terminó una llamada de prueba.");
      return done({ ok: true });
    }
    if (history.turn_count >= 40)
      throw new LocalError("Alcanzaste el límite de esta llamada.", 410);
    if (!d.settings.active || !d.settings.voiceEnabled)
      throw new LocalError("El asistente de voz está en pausa.", 409);
    const c = d.conversations.find((c) => c.id === session.conversationId)!;
    if (c.handoff)
      throw new LocalError(
        "La solicitud está pendiente de atención del equipo.",
        409,
      );
    const text = requireText(body.text, 1500);
    message(d, c, "user", text);
    const reply = assistantReply({
      settings: d.settings,
      storeName: d.name,
      products: d.products,
      orders: [],
      phone: c.phone,
      text,
      context: d.contexts?.[c.id] ?? {},
      allowOrders: false,
      channel: "voice",
    });
    d.contexts ??= {};
    d.contexts[c.id] = reply.context;
    history.turn_count++;
    c.topic = reply.category;
    if (reply.handoff) {
      c.handoff = 1;
      c.status = "pending";
    }
    message(d, c, "assistant", reply.text);
    return done(reply);
  }
  if (route.startsWith("/voice/") || route.startsWith("/public/"))
    throw new LocalError(
      "Publica la aplicación con su servidor para habilitar clientes y proveedores reales.",
    );
  if (route === "/activities") return done(d.activities.slice(0, 200));
  if (route === "/search") {
    const q = normalize(url.searchParams.get("q") ?? "");
    if (q.length < 2)
      return done({ products: [], orders: [], conversations: [] });
    return done({
      products: d.products
        .filter((p) => normalize(`${p.name} ${p.sku}`).includes(q))
        .slice(0, 5),
      orders: d.orders
        .filter((o) =>
          normalize(`${o.code} ${o.customer} ${o.phone}`).includes(q),
        )
        .slice(0, 5),
      conversations: d.conversations
        .filter((c) => normalize(`${c.name} ${c.phone}`).includes(q))
        .slice(0, 5),
    });
  }
  if (route === "/account/sessions") return done([]);
  if (route === "/account/export") {
    event(
      d,
      "data.exported",
      "Se exportó una copia de los datos de esta demo.",
    );
    return done({
      version: 3,
      calls: d.voiceHistory ?? [],
      exportedAt: stamp(),
      workspace: { name: d.name, settings: d.settings },
      products: d.products,
      orders: d.orders,
      conversations: d.conversations,
      messages: d.messages,
      activities: d.activities,
    });
  }
  if (route.startsWith("/integrations") || route === "/account/password")
    throw new LocalError(
      "Esta función requiere la aplicación con servidor. No ingreses credenciales reales en la demo.",
    );
  if (route === "/dashboard") {
    const messages = Object.values(d.messages)
        .flat()
        .filter((m) => m.status !== "note"),
      bot = messages.filter((m) => m.role === "assistant").length,
      agent = messages.filter((m) => m.role === "agent").length;
    const graph = Array.from({ length: 7 }, (_, i) => {
      const date = new Date(Date.now() - (6 - i) * 86400000).toLocaleDateString(
        "en-CA",
        { timeZone: "America/Bogota" },
      );
      return {
        date,
        count: messages.filter(
          (m) =>
            m.role === "user" &&
            new Date(m.created_at).toLocaleDateString("en-CA", {
              timeZone: "America/Bogota",
            }) === date,
        ).length,
      };
    });
    return done({
      metrics: {
        conversations: d.conversations.length,
        automatic: bot + agent ? Math.round((bot / (bot + agent)) * 100) : 0,
        waiting: d.conversations.filter((c) => c.status === "pending").length,
        resolved: d.conversations.filter((c) => c.status === "resolved").length,
        messages: messages.length,
        products: d.products.length,
      },
      graph,
      recentConversations: [...d.conversations]
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
        .slice(0, 5),
      activities: d.activities.slice(0, 5),
      lowStock: d.products
        .filter((p) => p.stock <= 3)
        .sort((a, b) => a.stock - b.stock),
    });
  }
  throw new LocalError(
    "Esta función no está disponible en la demo independiente.",
    404,
  );
}

export function standaloneImage(id: string) {
  return load().images?.[id] ?? "";
}
