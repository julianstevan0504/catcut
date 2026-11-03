import express from 'express';
import helmet from 'helmet';
import { randomBytes, createHmac } from 'node:crypto';
import { resolve, dirname, join } from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createDatabase, createWorkspace, uid, now, activity, settingsFor, addMessage } from './db.mjs';
import { hashPassword, verifyPassword, tokenHash, safeEqual, encrypt, decrypt, encryptionKey, rateLimiter } from './security.mjs';
import { answerMessage } from './assistant.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DEMO_EMAIL = 'demo@cerca.local';
const fail = (status, message) => Object.assign(new Error(message), { status });
function field(value, name, { min = 1, max = 200 } = {}) {
  if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max) throw fail(400, `Revisa el campo «${name}» (entre ${min} y ${max} caracteres).`);
  return value.trim();
}
function integer(value, name, max = 1000000000) {
  if (!Number.isSafeInteger(value) || value < 0 || value > max) throw fail(400, `El campo «${name}» debe ser un entero entre 0 y ${max}.`);
  return value;
}
function phone(value) {
  const clean = field(value, 'teléfono', { max: 30 }).replace(/[\s()-]/g, '');
  if (!/^\+[1-9]\d{7,14}$/.test(clean)) throw fail(400, 'Usa un teléfono con código de país, por ejemplo +573001112233.');
  return clean;
}
const parseCookie = req => {
  const raw = req.headers.cookie?.split(';').map(x => x.trim()).find(x => x.startsWith('cerca_session='))?.slice(14);
  return raw && /^[a-f0-9]{64}$/.test(raw) ? raw : null;
};

export async function createApp(options = {}) {
  const production = options.production ?? process.env.NODE_ENV === 'production';
  const demoMode = options.demoMode ?? (process.env.DEMO_MODE ? process.env.DEMO_MODE === 'true' : !production);
  const registrationOpen = options.registrationOpen ?? (process.env.REGISTRATION_OPEN ? process.env.REGISTRATION_OPEN === 'true' : !production);
  const databasePath = options.databasePath ?? resolve(process.env.DATABASE_PATH ?? join(root, 'data/cerca.sqlite'));
  const baseUrl = (options.baseUrl ?? process.env.APP_URL ?? process.env.RENDER_EXTERNAL_URL ?? 'http://localhost:5173').replace(/\/$/, '');
  if (production && !baseUrl.startsWith('https://')) throw new Error('APP_URL debe ser una URL HTTPS en producción.');
  const allowedOrigin = new URL(baseUrl).origin;
  const key = options.key ?? encryptionKey({ value: process.env.APP_ENCRYPTION_KEY, file: databasePath === ':memory:' ? ':memory:' : join(dirname(databasePath), '.encryption-key'), production });
  const db = createDatabase(databasePath);
  const fetcher = options.fetcher ?? fetch;
  const openaiKey = options.openaiKey ?? process.env.OPENAI_API_KEY;
  const model = options.model ?? process.env.OPENAI_MODEL ?? 'gpt-4.1-mini';
  const graphVersion = process.env.META_GRAPH_VERSION ?? 'v23.0';
  if (!/^v\d+\.\d+$/.test(graphVersion)) throw new Error('META_GRAPH_VERSION no es válido.');
  const dummyHash = await hashPassword(randomBytes(32).toString('hex'));
  if (demoMode && !db.prepare('SELECT id FROM users WHERE email = ?').get(DEMO_EMAIL)) {
    const workspaceId = createWorkspace(db, 'Luna Store', { sample: true });
    db.prepare('INSERT INTO users VALUES (?, ?, ?, ?, ?, ?)').run(uid(), workspaceId, 'Andrea', DEMO_EMAIL, dummyHash, now());
  }
  const app = express();
  app.disable('x-powered-by');
  if (production) app.set('trust proxy', 1);
  app.use(helmet({ contentSecurityPolicy: { directives: { 'img-src': ["'self'", 'data:'], 'connect-src': ["'self'"] } } }));
  app.use(express.json({ limit: '256kb', verify: (req, _res, buf) => { req.rawBody = buf; } }));
  app.use((req, _res, next) => { req.body ??= {}; next(); });
  app.use('/api', (_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  app.use((req, _res, next) => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && !req.path.startsWith('/api/webhooks/')) {
      const origin = req.headers.origin;
      let sameHostDevelopment = false;
      try { sameHostDevelopment = !production && new URL(origin).host === req.get('host'); } catch { /* An absent/invalid Origin is handled below. */ }
      if (origin && origin !== allowedOrigin && !sameHostDevelopment) return next(fail(403, 'El origen de la solicitud no está permitido.'));
      if (!req.is('application/json')) return next(fail(415, 'Envía la solicitud en formato JSON.'));
    }
    next();
  });
  const authLimit = rateLimiter({ limit: 25, windowMs: 15 * 60000 });
  app.use('/api/auth', authLimit);
  const ownerCount = () => db.prepare('SELECT COUNT(*) AS n FROM users WHERE email <> ?').get(DEMO_EMAIL).n;

  function session(res, userId) {
    const token = randomBytes(32).toString('hex');
    db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(now());
    db.prepare('INSERT INTO sessions VALUES (?, ?, ?)').run(tokenHash(token), userId, new Date(Date.now() + 7 * 86400000).toISOString());
    res.cookie('cerca_session', token, { httpOnly: true, secure: production, sameSite: 'lax', maxAge: 7 * 86400000, path: '/' });
  }
  function auth(req, _res, next) {
    const token = parseCookie(req);
    const user = token ? db.prepare(`SELECT u.* FROM users u JOIN sessions s ON s.user_id = u.id WHERE s.token_hash = ? AND s.expires_at > ?`).get(tokenHash(token), now()) : null;
    if (!user || (!demoMode && user.email === DEMO_EMAIL)) return next(fail(401, 'Inicia sesión para continuar.'));
    req.user = user; req.workspaceId = user.workspace_id;
    next();
  }
  function ownedConversation(req) {
    const row = db.prepare('SELECT * FROM conversations WHERE id = ? AND workspace_id = ?').get(req.params.id, req.workspaceId);
    if (!row) throw fail(404, 'No se encontró la conversación.');
    return row;
  }
  function integrationInfo(workspaceId) {
    const row = db.prepare('SELECT phone_number_id, status, display_phone, updated_at FROM integrations WHERE workspace_id = ?').get(workspaceId);
    return { configured: !!row, phoneNumberId: row?.phone_number_id ?? '', displayPhone: row?.display_phone ?? '', status: row?.status ?? 'disconnected', webhookUrl: `${baseUrl}/api/webhooks/whatsapp/${workspaceId}` };
  }
  const conversationSelect = `SELECT c.*, (SELECT text FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC, rowid DESC LIMIT 1) AS last_message,
    (SELECT role FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC, rowid DESC LIMIT 1) AS last_role FROM conversations c`;
  function sendMe(req, res) {
    const workspace = db.prepare('SELECT id, name, created_at FROM workspaces WHERE id = ?').get(req.workspaceId);
    res.json({ user: { id: req.user.id, name: req.user.name, email: req.user.email }, workspace, settings: settingsFor(db, req.workspaceId),
      integration: integrationInfo(req.workspaceId), ai: { configured: !!openaiKey, model: openaiKey ? model : 'Asistente local' }, demo: req.user.email === DEMO_EMAIL });
  }

  app.get('/api/health', (_req, res) => { db.prepare('SELECT 1').get(); res.json({ ok: true }); });
  app.get('/api/bootstrap', (_req, res) => res.json({ demoEnabled: demoMode, registrationAllowed: registrationOpen || ownerCount() === 0 }));
  app.post('/api/auth/register', async (req, res) => {
    if (!registrationOpen && ownerCount() > 0) throw fail(403, 'El registro está cerrado. Contacta con la persona que administra esta instalación.');
    const name = field(req.body.name, 'nombre', { max: 80 });
    const storeName = field(req.body.storeName, 'nombre de la tienda', { max: 100 });
    const email = field(req.body.email, 'correo', { max: 254 }).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email === DEMO_EMAIL) throw fail(400, 'Escribe un correo electrónico válido.');
    const password = field(req.body.password, 'contraseña', { min: 10, max: 128 });
    if (db.prepare('SELECT id FROM users WHERE email = ?').get(email)) throw fail(409, 'No pudimos crear la cuenta con ese correo. Intenta iniciar sesión.');
    const hash = await hashPassword(password);
    // Hashing yields to the event loop: recheck under the transaction to prevent
    // simultaneous requests from bypassing closed, first-owner registration.
    db.exec('BEGIN IMMEDIATE');
    let userId;
    try {
      if (!registrationOpen && ownerCount() > 0) throw fail(403, 'El registro está cerrado.');
      const workspaceId = createWorkspace(db, storeName, { sample: req.body.sample === true });
      userId = uid();
      db.prepare('INSERT INTO users VALUES (?, ?, ?, ?, ?, ?)').run(userId, workspaceId, name, email, hash, now());
      activity(db, workspaceId, 'auth.register', `${name} creó su cuenta.`, name);
      db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); throw error; }
    session(res, userId); res.status(201).json({ ok: true });
  });
  app.post('/api/auth/login', async (req, res) => {
    const email = field(req.body.email, 'correo', { max: 254 }).toLowerCase();
    const password = field(req.body.password, 'contraseña', { max: 128 });
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    const valid = await verifyPassword(password, user?.password_hash ?? dummyHash);
    if (!valid || !user || user.email === DEMO_EMAIL) throw fail(401, 'El correo o la contraseña no son correctos.');
    session(res, user.id); activity(db, user.workspace_id, 'auth.login', `${user.name} inició sesión.`, user.name); res.json({ ok: true });
  });
  app.post('/api/auth/demo', (_req, res) => {
    if (!demoMode) throw fail(404, 'La demo no está habilitada.');
    const user = db.prepare('SELECT id FROM users WHERE email = ?').get(DEMO_EMAIL);
    session(res, user.id); res.json({ ok: true });
  });
  app.post('/api/auth/logout', auth, (req, res) => {
    db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash(parseCookie(req)));
    activity(db, req.workspaceId, 'auth.logout', `${req.user.name} cerró sesión.`, req.user.name);
    res.clearCookie('cerca_session', { httpOnly: true, sameSite: 'lax', secure: production, path: '/' }); res.json({ ok: true });
  });
  app.get('/api/me', auth, sendMe);
  app.put('/api/account/password', auth, async (req, res) => {
    if (req.user.email === DEMO_EMAIL) throw fail(403, 'La contraseña de la demo no se puede cambiar.');
    const current = field(req.body.currentPassword, 'contraseña actual', { max: 128 });
    const next = field(req.body.newPassword, 'contraseña nueva', { min: 10, max: 128 });
    if (!await verifyPassword(current, req.user.password_hash)) throw fail(400, 'La contraseña actual no es correcta.');
    const hash = await hashPassword(next);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, req.user.id);
    db.prepare('DELETE FROM sessions WHERE user_id = ? AND token_hash <> ?').run(req.user.id, tokenHash(parseCookie(req)));
    activity(db, req.workspaceId, 'auth.password_changed', 'Se cambió la contraseña y se cerraron las otras sesiones.', req.user.name);
    res.json({ ok: true });
  });

  app.get('/api/dashboard', auth, (req, res) => {
    const ws = req.workspaceId;
    const conversations = db.prepare('SELECT status, handoff FROM conversations WHERE workspace_id = ?').all(ws);
    const counts = db.prepare(`SELECT m.role, COUNT(*) AS count FROM messages m JOIN conversations c ON c.id = m.conversation_id WHERE c.workspace_id = ? GROUP BY m.role`).all(ws);
    const bot = counts.find(c => c.role === 'assistant')?.count ?? 0;
    const agents = counts.find(c => c.role === 'agent')?.count ?? 0;
    const graph = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(Date.now() - i * 86400000).toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
      const start = new Date(`${date}T00:00:00-05:00`).toISOString();
      const end = new Date(new Date(start).getTime() + 86400000).toISOString();
      const row = db.prepare(`SELECT COUNT(*) AS count FROM messages m JOIN conversations c ON c.id = m.conversation_id WHERE c.workspace_id = ? AND m.role = 'user' AND m.created_at >= ? AND m.created_at < ?`).get(ws, start, end);
      graph.push({ date, count: row.count });
    }
    res.json({ metrics: { conversations: conversations.length, automatic: bot + agents ? Math.round(bot / (bot + agents) * 100) : 0,
      waiting: conversations.filter(c => c.status === 'pending').length, resolved: conversations.filter(c => c.status === 'resolved').length,
      messages: counts.reduce((sum, r) => sum + r.count, 0), products: db.prepare('SELECT COUNT(*) AS n FROM products WHERE workspace_id = ?').get(ws).n },
      graph, recentConversations: db.prepare(`${conversationSelect} WHERE c.workspace_id = ? ORDER BY c.updated_at DESC LIMIT 5`).all(ws),
      activities: db.prepare('SELECT * FROM activities WHERE workspace_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 5').all(ws),
      lowStock: db.prepare('SELECT id, name, stock FROM products WHERE workspace_id = ? AND stock <= 3 ORDER BY stock').all(ws),
    });
  });

  app.get('/api/conversations', auth, (req, res) => res.json(db.prepare(`${conversationSelect} WHERE c.workspace_id = ? ORDER BY c.updated_at DESC`).all(req.workspaceId)));
  app.get('/api/conversations/:id/messages', auth, (req, res) => {
    const conversation = ownedConversation(req);
    db.prepare('UPDATE conversations SET unread = 0 WHERE id = ?').run(conversation.id);
    res.json(db.prepare('SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at, rowid').all(conversation.id));
  });
  app.patch('/api/conversations/:id', auth, (req, res) => {
    const conversation = ownedConversation(req);
    const status = req.body.status ?? conversation.status;
    const handoff = req.body.handoff ?? !!conversation.handoff;
    if (!['open', 'pending', 'resolved'].includes(status) || typeof handoff !== 'boolean') throw fail(400, 'Estado de conversación no válido.');
    db.prepare('UPDATE conversations SET status = ?, handoff = ?, updated_at = ? WHERE id = ?').run(status, handoff ? 1 : 0, now(), conversation.id);
    activity(db, req.workspaceId, 'conversation.updated', `Conversación de ${conversation.name}: ${status === 'resolved' ? 'resuelta' : handoff ? 'atención humana' : 'asistente activado'}.`, req.user.name);
    res.json({ ok: true });
  });

  async function graphRequest(path, credentials, init = {}) {
    const response = await fetcher(`https://graph.facebook.com/${graphVersion}/${path}`, {
      ...init, headers: { Authorization: `Bearer ${credentials.accessToken}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(20000),
    });
    const data = await response.json();
    if (!response.ok) throw fail(502, `WhatsApp rechazó la solicitud${data.error?.code ? ` (código ${Number(data.error.code)})` : ''}. Revisa el token, los permisos y el número en Meta.`);
    return data;
  }
  async function deliver(workspaceId, conversation, message) {
    if (conversation.channel !== 'whatsapp') {
      db.prepare("UPDATE messages SET status = 'simulated' WHERE id = ?").run(message.id); return;
    }
    const lastUser = db.prepare("SELECT created_at FROM messages WHERE conversation_id = ? AND role = 'user' ORDER BY created_at DESC LIMIT 1").get(conversation.id);
    if (!lastUser || Date.now() - new Date(lastUser.created_at).getTime() > 24 * 3600000) throw fail(409, 'La ventana de atención de WhatsApp de 24 horas está cerrada. Espera un nuevo mensaje del cliente; esta versión no envía plantillas.');
    const integration = db.prepare('SELECT * FROM integrations WHERE workspace_id = ?').get(workspaceId);
    if (!integration) throw fail(409, 'Primero conecta WhatsApp Business en Configuración.');
    const credentials = decrypt(integration.encrypted_credentials, key);
    const result = await graphRequest(`${integration.phone_number_id}/messages`, credentials, {
      method: 'POST', body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', to: conversation.phone.replace('+', ''), type: 'text', text: { preview_url: false, body: message.text } }),
    });
    if (!result.messages?.[0]?.id) throw fail(502, 'WhatsApp no confirmó el envío.');
    db.prepare("UPDATE messages SET status = 'sent', external_id = ? WHERE id = ?").run(result.messages[0].id, message.id);
  }
  app.post('/api/conversations/:id/messages', auth, async (req, res) => {
    const conversation = ownedConversation(req), text = field(req.body.text, 'mensaje', { max: 4000 });
    if (conversation.channel === 'whatsapp' && !conversation.handoff) throw fail(409, 'Toma el control de la conversación antes de responder para pausar el asistente.');
    const message = addMessage(db, conversation.id, 'agent', text, { source: 'agent', status: 'pending' });
    try {
      await deliver(req.workspaceId, conversation, message);
      activity(db, req.workspaceId, 'message.sent', `${req.user.name} respondió a ${conversation.name}${conversation.channel === 'demo' ? ' en la demo' : ''}.`, req.user.name);
      res.status(201).json(db.prepare('SELECT * FROM messages WHERE id = ?').get(message.id));
    } catch (error) {
      db.prepare("UPDATE messages SET status = 'failed' WHERE id = ?").run(message.id);
      activity(db, req.workspaceId, 'message.failed', `No se pudo enviar el mensaje a ${conversation.name}.`, req.user.name); throw error;
    }
  });

  app.post('/api/simulator', auth, rateLimiter({ limit: 30, windowMs: 60000 }), async (req, res) => {
    const text = field(req.body.text, 'mensaje', { max: 2000 });
    const contactPhone = '+573001112233';
    let conversation = db.prepare("SELECT * FROM conversations WHERE workspace_id = ? AND phone = ? AND channel = 'sandbox'").get(req.workspaceId, contactPhone);
    if (!conversation) {
      const id = uid();
      db.prepare('INSERT INTO conversations VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(id, req.workspaceId, 'Cliente de prueba', contactPhone, 'sandbox', 'open', 0, 0, 'general', now(), now());
      conversation = db.prepare('SELECT * FROM conversations WHERE id = ?').get(id);
    }
    addMessage(db, conversation.id, 'user', text);
    if (conversation.handoff || !settingsFor(db, req.workspaceId).active) return res.json({ conversationId: conversation.id, text: null, paused: true });
    const reply = await answerMessage({ db, workspaceId: req.workspaceId, conversation, text, apiKey: openaiKey, model, fetcher });
    addMessage(db, conversation.id, 'assistant', reply.text, { source: reply.source, status: 'simulated' });
    db.prepare('UPDATE conversations SET topic = ? WHERE id = ?').run(reply.category, conversation.id);
    activity(db, req.workspaceId, 'assistant.tested', 'Se probó el asistente en el simulador. No se envió ningún mensaje a WhatsApp.', req.user.name);
    res.json({ ...reply, conversationId: conversation.id });
  });
  app.post('/api/simulator/reset', auth, (req, res) => {
    db.prepare("UPDATE conversations SET handoff = 0, status = 'open' WHERE workspace_id = ? AND channel = 'sandbox'").run(req.workspaceId);
    res.json({ ok: true });
  });

  app.get('/api/products', auth, (req, res) => res.json(db.prepare('SELECT * FROM products WHERE workspace_id = ? ORDER BY name').all(req.workspaceId)));
  function productFields(body) {
    return [field(body.name, 'nombre', { max: 100 }), field(body.sku, 'SKU', { max: 40 }).toUpperCase(), field(body.description ?? '', 'descripción', { min: 0, max: 1000 }),
      field(body.category ?? 'General', 'categoría', { max: 80 }), integer(body.price, 'precio'), integer(body.stock, 'stock', 1000000), ['sage', 'sand', 'peach', 'lavender'].includes(body.color) ? body.color : 'sage'];
  }
  app.post('/api/products', auth, (req, res) => {
    const fields = productFields(req.body), id = uid();
    db.prepare('INSERT INTO products VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(id, req.workspaceId, ...fields);
    activity(db, req.workspaceId, 'product.created', `Se agregó ${fields[0]} al catálogo.`, req.user.name);
    res.status(201).json({ id });
  });
  app.put('/api/products/:id', auth, (req, res) => {
    const fields = productFields(req.body);
    const result = db.prepare('UPDATE products SET name = ?, sku = ?, description = ?, category = ?, price = ?, stock = ?, color = ? WHERE id = ? AND workspace_id = ?').run(...fields, req.params.id, req.workspaceId);
    if (!result.changes) throw fail(404, 'Producto no encontrado.');
    activity(db, req.workspaceId, 'product.updated', `Se actualizó ${fields[0]}: ${fields[5]} unidades disponibles.`, req.user.name); res.json({ ok: true });
  });
  app.delete('/api/products/:id', auth, (req, res) => {
    const product = db.prepare('SELECT name FROM products WHERE id = ? AND workspace_id = ?').get(req.params.id, req.workspaceId);
    if (!product) throw fail(404, 'Producto no encontrado.');
    db.prepare('DELETE FROM products WHERE id = ? AND workspace_id = ?').run(req.params.id, req.workspaceId);
    activity(db, req.workspaceId, 'product.deleted', `Se eliminó ${product.name} del catálogo.`, req.user.name); res.json({ ok: true });
  });
  app.get('/api/orders', auth, (req, res) => res.json(db.prepare('SELECT * FROM orders WHERE workspace_id = ? ORDER BY created_at DESC, rowid DESC').all(req.workspaceId)));
  function orderFields(body) {
    const status = body.status ?? 'confirmed';
    if (!['confirmed', 'preparing', 'shipped', 'delivered', 'cancelled'].includes(status)) throw fail(400, 'Estado de pedido no válido.');
    const trackingUrl = field(body.tracking_url ?? '', 'enlace de seguimiento', { min: 0, max: 1000 });
    if (trackingUrl) {
      let url;
      try { url = new URL(trackingUrl); } catch { throw fail(400, 'El enlace de seguimiento debe ser una URL HTTPS válida.'); }
      if (url.protocol !== 'https:' || url.username || url.password) throw fail(400, 'El enlace de seguimiento debe usar HTTPS y no contener credenciales.');
    }
    const code = field(body.code, 'código', { max: 30 }).toUpperCase().replace(/^#/, '');
    if (!/^[A-Z]{1,8}-\d{2,20}$/.test(code)) throw fail(400, 'Usa un código como LC-1042 (letras, guion y números).');
    return [code, field(body.customer, 'cliente', { max: 100 }), phone(body.phone), status, integer(body.total, 'total'),
      field(body.items, 'productos', { max: 1000 }), field(body.tracking_number ?? '', 'guía', { min: 0, max: 100 }), trackingUrl];
  }
  app.post('/api/orders', auth, (req, res) => {
    const fields = orderFields(req.body), id = uid();
    db.prepare('INSERT INTO orders VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(id, req.workspaceId, ...fields, now(), now());
    activity(db, req.workspaceId, 'order.created', `Se registró el pedido ${fields[0]}.`, req.user.name); res.status(201).json({ id });
  });
  app.put('/api/orders/:id', auth, (req, res) => {
    const fields = orderFields(req.body);
    const result = db.prepare('UPDATE orders SET code = ?, customer = ?, phone = ?, status = ?, total = ?, items = ?, tracking_number = ?, tracking_url = ?, updated_at = ? WHERE id = ? AND workspace_id = ?').run(...fields, now(), req.params.id, req.workspaceId);
    if (!result.changes) throw fail(404, 'Pedido no encontrado.');
    activity(db, req.workspaceId, 'order.updated', `Se actualizó el pedido ${fields[0]}.`, req.user.name); res.json({ ok: true });
  });
  app.get('/api/activities', auth, (req, res) => res.json(db.prepare('SELECT * FROM activities WHERE workspace_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 200').all(req.workspaceId)));

  app.put('/api/settings', auth, (req, res) => {
    const current = settingsFor(db, req.workspaceId), body = req.body;
    const next = { ...current };
    for (const [key, max] of Object.entries({ assistantName: 60, description: 2000, hours: 1500, shipping: 2000, returns: 2000, payments: 2000, welcome: 1000 })) {
      if (body[key] !== undefined) next[key] = field(body[key], key, { max });
    }
    if (body.active !== undefined) { if (typeof body.active !== 'boolean') throw fail(400, 'Estado no válido.'); next.active = body.active; }
    if (body.tone !== undefined) { if (!['cercano', 'profesional', 'entusiasta'].includes(body.tone)) throw fail(400, 'Tono no válido.'); next.tone = body.tone; }
    if (body.faqs !== undefined) {
      if (!Array.isArray(body.faqs) || body.faqs.length > 40) throw fail(400, 'Puedes guardar hasta 40 preguntas frecuentes.');
      next.faqs = body.faqs.map(f => ({ id: typeof f.id === 'string' ? f.id.slice(0, 80) : uid(), question: field(f.question, 'pregunta', { max: 300 }), answer: field(f.answer, 'respuesta', { max: 2000 }) }));
    }
    const name = body.storeName === undefined ? db.prepare('SELECT name FROM workspaces WHERE id = ?').get(req.workspaceId).name : field(body.storeName, 'nombre de tienda', { max: 100 });
    db.prepare('UPDATE workspaces SET name = ?, settings = ? WHERE id = ?').run(name, JSON.stringify(next), req.workspaceId);
    activity(db, req.workspaceId, 'settings.updated', body.active !== undefined ? `El asistente se ${next.active ? 'activó' : 'pausó'}.` : 'Se actualizó la configuración de la tienda y el asistente.', req.user.name);
    res.json({ ok: true });
  });
  app.put('/api/integrations/whatsapp', auth, rateLimiter({ limit: 10, windowMs: 60000 }), (req, res) => {
    if (req.user.email === DEMO_EMAIL) throw fail(403, 'Crea tu propia cuenta para conectar un número real. La demo es compartida.');
    const phoneNumberId = field(req.body.phoneNumberId, 'ID del número', { max: 40 });
    if (!/^\d{5,30}$/.test(phoneNumberId)) throw fail(400, 'El ID del número de Meta debe contener solo números.');
    const accessToken = field(req.body.accessToken, 'token de acceso', { min: 20, max: 8192 });
    const appSecret = field(req.body.appSecret, 'secreto de la aplicación', { min: 32, max: 32 });
    const verifyToken = field(req.body.verifyToken, 'código de verificación', { min: 16, max: 128 });
    if (/[\r\n]/.test(accessToken) || !/^[a-f\d]{32}$/i.test(appSecret) || !/^[a-zA-Z0-9_-]+$/.test(verifyToken)) throw fail(400, 'Revisa el formato de las credenciales de Meta.');
    const credentials = encrypt({ accessToken, appSecret, verifyToken }, key);
    db.prepare(`INSERT INTO integrations (workspace_id, phone_number_id, encrypted_credentials, status, updated_at) VALUES (?, ?, ?, 'configured', ?)
      ON CONFLICT(workspace_id) DO UPDATE SET phone_number_id = excluded.phone_number_id, encrypted_credentials = excluded.encrypted_credentials, status = 'configured', updated_at = excluded.updated_at`).run(req.workspaceId, phoneNumberId, credentials, now());
    activity(db, req.workspaceId, 'integration.configured', 'Se guardaron las credenciales cifradas de WhatsApp Business. Falta comprobar la conexión y suscribir el webhook.', req.user.name);
    res.json(integrationInfo(req.workspaceId));
  });
  app.post('/api/integrations/whatsapp/test', auth, async (req, res) => {
    const integration = db.prepare('SELECT * FROM integrations WHERE workspace_id = ?').get(req.workspaceId);
    if (!integration) throw fail(409, 'Guarda primero las credenciales de WhatsApp.');
    const credentials = decrypt(integration.encrypted_credentials, key);
    const data = await graphRequest(`${integration.phone_number_id}?fields=display_phone_number,verified_name`, credentials);
    db.prepare("UPDATE integrations SET status = 'verified', display_phone = ?, updated_at = ? WHERE workspace_id = ?").run(data.display_phone_number ?? '', now(), req.workspaceId);
    activity(db, req.workspaceId, 'integration.verified', 'Meta confirmó el acceso al número de WhatsApp Business. Verifica también la suscripción del webhook.', req.user.name);
    res.json(integrationInfo(req.workspaceId));
  });

  app.get('/api/webhooks/whatsapp/:workspaceId', (req, res) => {
    const integration = db.prepare('SELECT * FROM integrations WHERE workspace_id = ?').get(req.params.workspaceId);
    if (!integration) return res.sendStatus(404);
    const credentials = decrypt(integration.encrypted_credentials, key);
    if (req.query['hub.mode'] !== 'subscribe' || !safeEqual(req.query['hub.verify_token'], credentials.verifyToken) || typeof req.query['hub.challenge'] !== 'string') return res.sendStatus(403);
    activity(db, req.params.workspaceId, 'webhook.verified', 'Meta verificó la URL del webhook.', 'Meta');
    res.type('text/plain').send(req.query['hub.challenge']);
  });
  app.post('/api/webhooks/whatsapp/:workspaceId', (req, res) => {
    const workspaceId = req.params.workspaceId;
    const integration = db.prepare('SELECT * FROM integrations WHERE workspace_id = ?').get(workspaceId);
    if (!integration) return res.sendStatus(404);
    const credentials = decrypt(integration.encrypted_credentials, key);
    const signature = `sha256=${createHmac('sha256', credentials.appSecret).update(req.rawBody ?? Buffer.alloc(0)).digest('hex')}`;
    if (!safeEqual(req.headers['x-hub-signature-256'], signature)) return res.sendStatus(403);
    if (req.body.object !== 'whatsapp_business_account') return res.sendStatus(400);
    db.exec('BEGIN IMMEDIATE');
    try {
      for (const entry of Array.isArray(req.body.entry) ? req.body.entry : []) {
        for (const change of Array.isArray(entry.changes) ? entry.changes : []) {
          const value = change.value ?? {};
          if (String(value.metadata?.phone_number_id) !== integration.phone_number_id) continue;
          for (const status of Array.isArray(value.statuses) ? value.statuses : []) {
            const ranks = { pending: 0, sent: 1, delivered: 2, read: 3, failed: 4 };
            if (!(status.status in ranks) || typeof status.id !== 'string') continue;
            const message = db.prepare('SELECT m.* FROM messages m JOIN conversations c ON c.id = m.conversation_id WHERE m.external_id = ? AND c.workspace_id = ?').get(status.id, workspaceId);
            if (message && ranks[status.status] >= (ranks[message.status] ?? 0)) db.prepare('UPDATE messages SET status = ? WHERE id = ?').run(status.status, message.id);
          }
          for (const incoming of Array.isArray(value.messages) ? value.messages : []) {
            if (typeof incoming.id !== 'string' || !/^\d{8,15}$/.test(incoming.from ?? '')) continue;
            if (db.prepare('SELECT id FROM messages WHERE external_id = ?').get(incoming.id)) continue;
            const contactPhone = `+${incoming.from}`;
            const name = String(value.contacts?.find(c => c.wa_id === incoming.from)?.profile?.name ?? contactPhone).slice(0, 100);
            let conversation = db.prepare("SELECT * FROM conversations WHERE workspace_id = ? AND phone = ? AND channel = 'whatsapp'").get(workspaceId, contactPhone);
            if (!conversation) {
              const id = uid();
              db.prepare('INSERT INTO conversations VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(id, workspaceId, name, contactPhone, 'whatsapp', 'open', 0, 0, 'general', now(), now());
              conversation = db.prepare('SELECT * FROM conversations WHERE id = ?').get(id);
            }
            const text = incoming.type === 'text' ? String(incoming.text?.body ?? '').slice(0, 4000) : `[Mensaje de tipo ${String(incoming.type).slice(0, 30)}: requiere atención humana]`;
            const timestamp = Number(incoming.timestamp) * 1000;
            const time = Number.isFinite(timestamp) && timestamp > 0 ? new Date(Math.min(timestamp, Date.now())).toISOString() : now();
            const message = addMessage(db, conversation.id, 'user', text, { externalId: incoming.id, source: 'whatsapp', time });
            if (conversation.status === 'resolved') db.prepare("UPDATE conversations SET status = 'open' WHERE id = ?").run(conversation.id);
            if (incoming.type !== 'text') {
              db.prepare("UPDATE conversations SET handoff = 1, status = 'pending' WHERE id = ?").run(conversation.id);
              activity(db, workspaceId, 'conversation.handoff', `${name} envió contenido no textual. Se requiere atención humana.`, 'WhatsApp');
            } else {
              db.prepare('INSERT INTO jobs (id, workspace_id, conversation_id, message_id, next_attempt_at, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(uid(), workspaceId, conversation.id, message.id, now(), now());
            }
            activity(db, workspaceId, 'message.received', `Se recibió un mensaje de ${name}.`, 'WhatsApp');
          }
        }
      }
      db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); throw error; }
    res.json({ ok: true });
  });

  let busy = false;
  async function processJobs() {
    if (busy) return;
    busy = true;
    try {
      const jobs = db.prepare("SELECT * FROM jobs WHERE status = 'pending' AND next_attempt_at <= ? ORDER BY created_at LIMIT 5").all(now());
      for (const job of jobs) {
        db.prepare("UPDATE jobs SET status = 'processing', attempts = attempts + 1 WHERE id = ?").run(job.id);
        try {
          const conversation = db.prepare('SELECT * FROM conversations WHERE id = ?').get(job.conversation_id);
          let reply = job.response_message_id ? db.prepare('SELECT * FROM messages WHERE id = ?').get(job.response_message_id) : null;
          if (!reply && (conversation.handoff || !settingsFor(db, job.workspace_id).active)) {
            db.prepare("UPDATE jobs SET status = 'skipped' WHERE id = ?").run(job.id); continue;
          }
          if (!reply) {
            const incoming = db.prepare('SELECT text FROM messages WHERE id = ?').get(job.message_id);
            const result = await answerMessage({ db, workspaceId: job.workspace_id, conversation, text: incoming.text, apiKey: openaiKey, model, fetcher });
            // A person may have paused the bot while its AI request was running.
            const latest = db.prepare('SELECT handoff FROM conversations WHERE id = ?').get(conversation.id);
            if ((!settingsFor(db, job.workspace_id).active || latest.handoff) && result.category !== 'humano') {
              db.prepare("UPDATE jobs SET status = 'skipped' WHERE id = ?").run(job.id); continue;
            }
            reply = addMessage(db, conversation.id, 'assistant', result.text, { source: result.source, status: 'pending' });
            db.prepare('UPDATE jobs SET response_message_id = ? WHERE id = ?').run(reply.id, job.id);
            db.prepare('UPDATE conversations SET topic = ? WHERE id = ?').run(result.category, conversation.id);
          }
          await deliver(job.workspace_id, conversation, reply);
          db.prepare("UPDATE jobs SET status = 'done' WHERE id = ?").run(job.id);
          activity(db, job.workspace_id, 'assistant.replied', `El asistente respondió a ${conversation.name}.`, 'Asistente');
        } catch {
          const retry = job.attempts < 2;
          db.prepare('UPDATE jobs SET status = ?, next_attempt_at = ? WHERE id = ?').run(retry ? 'pending' : 'failed', new Date(Date.now() + 30000 * 2 ** job.attempts).toISOString(), job.id);
          const latest = db.prepare('SELECT response_message_id FROM jobs WHERE id = ?').get(job.id);
          if (latest.response_message_id) db.prepare("UPDATE messages SET status = 'failed' WHERE id = ?").run(latest.response_message_id);
          if (!retry) {
            db.prepare("UPDATE conversations SET handoff = 1, status = 'pending' WHERE id = ?").run(job.conversation_id);
            activity(db, job.workspace_id, 'assistant.failed', 'No se pudo enviar una respuesta tras tres intentos. La conversación requiere atención humana.', 'Sistema');
          }
        }
      }
    } finally { busy = false; }
  }
  let timer;
  if (options.startWorker !== false) { timer = setInterval(() => processJobs().catch(() => console.error('El trabajador de mensajes encontró un error.')), 2000); timer.unref(); }

  app.use('/api', (_req, res) => res.status(404).json({ error: 'Ruta no encontrada.' }));
  const dist = join(root, 'dist');
  if (existsSync(dist)) {
    app.use(express.static(dist, { maxAge: '1h', index: false }));
    app.use((req, res, next) => req.method === 'GET' && req.accepts('html') ? res.sendFile(join(dist, 'index.html')) : next());
  }
  app.use((error, _req, res, _next) => {
    if (error.code?.startsWith('SQLITE_CONSTRAINT') || [1555, 2067].includes(error.errcode)) return res.status(409).json({ error: 'Ya existe un registro con ese correo, SKU, código o número de WhatsApp.' });
    const status = error.type === 'entity.parse.failed' ? 400 : error.status ?? 500;
    if (status >= 500) console.error(`Error de servidor (${status}): ${error.name ?? 'Error'}`);
    res.status(status).json({ error: error.type === 'entity.parse.failed' ? 'El JSON no es válido.' : status === 500 ? 'No se pudo completar la operación. Inténtalo de nuevo.' : error.message });
  });
  return { app, db, processJobs, close: () => { clearInterval(timer); db.close(); } };
}
