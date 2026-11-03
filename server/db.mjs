import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';

export const uid = () => randomUUID();
export const now = () => new Date().toISOString();
export const defaultSettings = {
  assistantName: 'Sofía', active: true, tone: 'cercano',
  description: 'Una tienda independiente de moda y accesorios en Colombia.',
  timezone: 'America/Bogota',
  hours: 'Lunes a viernes de 9:00 a. m. a 6:00 p. m. y sábados de 9:00 a. m. a 1:00 p. m. (hora de Colombia). Domingos y festivos no hay atención humana.',
  shipping: 'Hacemos envíos a toda Colombia. El tiempo estimado es de 2 a 5 días hábiles. El costo se confirma con la dirección antes de la compra.',
  returns: 'Puedes solicitar un cambio dentro de los 15 días siguientes a la entrega, con el producto sin usar y sus etiquetas. Escríbenos para revisar tu caso.',
  payments: 'Aceptamos transferencia bancaria, Nequi y tarjetas mediante un enlace de pago que te envía una persona del equipo. Nunca pedimos contraseñas ni códigos de seguridad.',
  welcome: '¡Hola! Soy Sofía, la asistente virtual de la tienda 🌿 ¿Te ayudo con un producto o con tu pedido?',
  faqs: [
    { id: 'faq-size', question: '¿Cómo puedo saber mi talla?', answer: 'Dime qué prenda te gusta y te pongo en contacto con el equipo para confirmar sus medidas y ayudarte a elegir tu talla.' },
    { id: 'faq-pickup', question: '¿Puedo recoger mi pedido?', answer: 'Por ahora vendemos online y hacemos envíos. Si necesitas una entrega especial, te comunico con una persona del equipo.' },
  ],
};

export function createDatabase(path) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS workspaces (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, settings TEXT NOT NULL, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id),
      name TEXT NOT NULL, email TEXT NOT NULL UNIQUE COLLATE NOCASE, password_hash TEXT NOT NULL, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id),
      name TEXT NOT NULL, phone TEXT NOT NULL, channel TEXT NOT NULL DEFAULT 'demo',
      status TEXT NOT NULL DEFAULT 'open', handoff INTEGER NOT NULL DEFAULT 0,
      unread INTEGER NOT NULL DEFAULT 0, topic TEXT NOT NULL DEFAULT 'general',
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
      UNIQUE(workspace_id, phone, channel)
    );
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      role TEXT NOT NULL, text TEXT NOT NULL, source TEXT NOT NULL DEFAULT 'local',
      status TEXT NOT NULL DEFAULT 'received', external_id TEXT UNIQUE, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id),
      name TEXT NOT NULL, sku TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL DEFAULT 'General', price INTEGER NOT NULL, stock INTEGER NOT NULL,
      color TEXT NOT NULL DEFAULT 'sage', UNIQUE(workspace_id, sku)
    );
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id), code TEXT NOT NULL,
      customer TEXT NOT NULL, phone TEXT NOT NULL, status TEXT NOT NULL, total INTEGER NOT NULL,
      items TEXT NOT NULL, tracking_number TEXT NOT NULL DEFAULT '', tracking_url TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(workspace_id, code)
    );
    CREATE TABLE IF NOT EXISTS activities (
      id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id),
      action TEXT NOT NULL, description TEXT NOT NULL, actor TEXT NOT NULL, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS integrations (
      workspace_id TEXT PRIMARY KEY REFERENCES workspaces(id), phone_number_id TEXT NOT NULL UNIQUE,
      encrypted_credentials TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'configured',
      display_phone TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id),
      conversation_id TEXT NOT NULL REFERENCES conversations(id),
      message_id TEXT NOT NULL UNIQUE REFERENCES messages(id), status TEXT NOT NULL DEFAULT 'pending',
      response_message_id TEXT REFERENCES messages(id), attempts INTEGER NOT NULL DEFAULT 0,
      next_attempt_at TEXT NOT NULL, created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS conversations_workspace ON conversations(workspace_id, updated_at);
    CREATE INDEX IF NOT EXISTS messages_conversation ON messages(conversation_id, created_at);
    CREATE INDEX IF NOT EXISTS activities_workspace ON activities(workspace_id, created_at);
    CREATE INDEX IF NOT EXISTS jobs_status ON jobs(status, next_attempt_at);
  `);
  // An interrupted worker can safely resume jobs. The Graph API does not provide an
  // idempotency key for sends: see README for the rare send/commit crash window.
  db.prepare("UPDATE jobs SET status = 'pending' WHERE status = 'processing'").run();
  return db;
}

export function activity(db, workspaceId, action, description, actor = 'Sistema') {
  db.prepare('INSERT INTO activities VALUES (?, ?, ?, ?, ?, ?)').run(uid(), workspaceId, action, description, actor, now());
}

export function settingsFor(db, workspaceId) {
  const row = db.prepare('SELECT settings FROM workspaces WHERE id = ?').get(workspaceId);
  return row ? JSON.parse(row.settings) : null;
}

export function addMessage(db, conversationId, role, text, options = {}) {
  const id = uid(), time = options.time ?? now();
  db.prepare('INSERT INTO messages VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
    id, conversationId, role, text, options.source ?? 'local', options.status ?? (role === 'user' ? 'received' : 'simulated'), options.externalId ?? null, time,
  );
  db.prepare(`UPDATE conversations SET updated_at = ?, unread = unread + ? WHERE id = ?`).run(time, role === 'user' ? 1 : 0, conversationId);
  return db.prepare('SELECT * FROM messages WHERE id = ?').get(id);
}

export function createWorkspace(db, name, { sample = false } = {}) {
  const id = uid();
  const settings = { ...defaultSettings, welcome: defaultSettings.welcome.replace('de la tienda', `de ${name}`) };
  db.prepare('INSERT INTO workspaces VALUES (?, ?, ?, ?)').run(id, name, JSON.stringify(settings), now());
  activity(db, id, 'workspace.created', `Se creó la tienda ${name}.`);
  if (sample) seedStore(db, id);
  return id;
}

function seedStore(db, workspaceId) {
  const products = [
    ['Camiseta Essential', 'CE-001', 'Camiseta de algodón, corte relajado. Tallas S, M y L en color blanco.', 'Ropa', 69900, 24, 'sand'],
    ['Bolso Alba', 'BA-002', 'Bolso tejido color natural, con cierre y correa ajustable.', 'Accesorios', 129900, 8, 'peach'],
    ['Tenis Urban', 'TU-003', 'Tenis blancos de uso diario. Tallas 36 a 40. Confirma tu talla con el equipo.', 'Calzado', 189900, 0, 'sage'],
    ['Pantalón Lino', 'PL-004', 'Pantalón fresco de lino color arena. Tallas S, M y L.', 'Ropa', 149900, 12, 'sand'],
    ['Gorra Studio', 'GS-005', 'Gorra verde oliva, ajustable, de algodón.', 'Accesorios', 49900, 17, 'sage'],
    ['Collar Aurora', 'CA-006', 'Collar dorado en acero inoxidable, largo ajustable.', 'Accesorios', 59900, 3, 'lavender'],
  ];
  for (const product of products) db.prepare('INSERT INTO products VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(uid(), workspaceId, ...product);
  const contacts = [
    ['Valentina Rojas', '+573001112233', 'stock', [
      ['user', '¡Hola! Me encantó el Bolso Alba 😍 ¿Todavía está disponible?'],
      ['assistant', '¡Hola, Valentina! Sí, tenemos 8 unidades del Bolso Alba 🌿 Cuesta $129.900 COP y tiene correa ajustable. ¿Te gustaría saber cómo hacer tu pedido?'],
      ['user', '¡Súper! ¿Y cuánto se demora el envío a Bogotá?'],
      ['assistant', '¡Qué buena elección! Hacemos envíos a Bogotá y a toda Colombia. El tiempo estimado es de 2 a 5 días hábiles. El costo lo confirma el equipo con tu dirección antes de la compra 💚'],
    ]],
    ['Santiago López', '+573102224455', 'pedido', [
      ['user', 'Hola, ¿cómo va mi pedido LC-1043?'],
      ['assistant', '¡Hola, Santiago! Tu pedido LC-1043 está en preparación 📦 El equipo te avisará cuando salga de camino.'],
    ]],
    ['Mariana Torres', '+573203334466', 'horario', [
      ['user', '¿A qué hora atienden los sábados?'],
      ['assistant', '¡Hola, Mariana! Los sábados el equipo te atiende de 9:00 a. m. a 1:00 p. m., hora de Colombia. Yo estoy por aquí para resolver tus dudas a cualquier hora 🌿'],
    ]],
    ['Daniela Pérez', '+573304445577', 'humano', [
      ['user', 'Necesito hacer un cambio de talla. ¿Puedo hablar con alguien?'],
      ['assistant', '¡Claro, Daniela! Le aviso al equipo para que te ayude con el cambio. Una persona continuará esta conversación en su horario de atención 💚'],
    ]],
    ['Andrés Castro', '+573405556688', 'stock', [
      ['user', '¿Tienen los Tenis Urban disponibles?'],
      ['assistant', '¡Hola, Andrés! Por ahora los Tenis Urban están agotados. Si quieres, te comunico con el equipo para consultar cuándo regresan o ver otra opción 🌿'],
    ]],
    ['Camila Ruiz', '+573516667799', 'general', [
      ['user', '¿Qué medios de pago manejan?'],
      ['assistant', '¡Hola, Camila! Puedes pagar por transferencia, Nequi o tarjeta con un enlace que te envía el equipo. ¿Ya tienes un producto en mente?'],
    ]],
    ['Nicolás Gómez', '+573627778800', 'pedido', [
      ['user', 'Ya recibí mi pedido. ¡Todo hermoso!'],
      ['assistant', '¡Qué alegría, Nicolás! Gracias por contarnos y por elegirnos 💚 Que disfrutes mucho tu compra.'],
    ]],
  ];
  contacts.forEach(([name, phone, topic, messages], i) => {
    const id = uid(), stamp = new Date(Date.now() - (i * 36 + 2) * 60000).toISOString();
    db.prepare('INSERT INTO conversations VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
      id, workspaceId, name, phone, 'demo', i === 3 ? 'pending' : i === 6 ? 'resolved' : 'open', i === 3 ? 1 : 0, i < 2 ? 1 : 0, topic, stamp, stamp,
    );
    messages.forEach(([role, text], j) => addMessage(db, id, role, text, { time: new Date(new Date(stamp).getTime() + j * 15000).toISOString() }));
    db.prepare('UPDATE conversations SET unread = ? WHERE id = ?').run(i < 2 ? 1 : 0, id);
  });
  const orders = [
    ['LC-1042', 'Valentina Rojas', '+573001112233', 'shipped', 129900, '1 × Bolso Alba', 'DEMO-1042'],
    ['LC-1043', 'Santiago López', '+573102224455', 'preparing', 219800, '1 × Camiseta Essential, 1 × Pantalón Lino', ''],
    ['LC-1044', 'Mariana Torres', '+573203334466', 'confirmed', 49900, '1 × Gorra Studio', ''],
    ['LC-1041', 'Nicolás Gómez', '+573627778800', 'delivered', 59900, '1 × Collar Aurora', 'DEMO-1041'],
  ];
  for (const [code, customer, phone, status, total, items, tracking] of orders) {
    db.prepare('INSERT INTO orders VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(uid(), workspaceId, code, customer, phone, status, total, items, tracking, '', now(), now());
  }
  activity(db, workspaceId, 'demo.created', 'Se cargaron conversaciones, productos y pedidos de ejemplo. No se enviaron mensajes reales.');
}
