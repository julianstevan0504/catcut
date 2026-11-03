import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createHmac } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../server/app.mjs';

let service, server, base, owner, other, ownerWorkspace, productId, otherProductId;
const calls = [];
const credentials = { phoneNumberId: '123456789012345', accessToken: 'test_only_not_a_real_access_token', appSecret: 'a'.repeat(32), verifyToken: 'test_only_verification_code' };
const product = { name: 'Mochila Cosmos', sku: 'MC-001', description: 'Mochila azul con bolsillo interior.', category: 'Accesorios', price: 89000, stock: 7, color: 'sage' };
const makeOrder = (overrides = {}) => ({ code: 'LC-2000', customer: 'Cliente autorizado', phone: '+573001112233', status: 'shipped', total: 89000, items: '1 × Mochila Cosmos', tracking_number: 'GUIA-AUTORIZADA', tracking_url: 'https://example.com/seguimiento/2000', ...overrides });

before(async () => {
  service = await createApp({ databasePath: ':memory:', demoMode: false, production: false, registrationOpen: true, openaiKey: '', startWorker: false,
    fetcher: async (url, init) => {
      calls.push({ url, init });
      if (init.method === 'POST') return Response.json({ messages: [{ id: `wamid.outgoing.${calls.length}` }] });
      return Response.json({ display_phone_number: '+57 300 000 0000', verified_name: 'Tienda de prueba' });
    },
  });
  server = createServer(service.app);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { await new Promise(resolve => server.close(resolve)); service.close(); });

async function request(path, { method = 'GET', body, cookie, headers = {} } = {}) {
  const response = await fetch(`${base}/api${path}`, { method, headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}), ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await response.text();
  let data; try { data = JSON.parse(text); } catch { data = text; }
  return { status: response.status, data, cookie: response.headers.get('set-cookie')?.split(';')[0], rawCookie: response.headers.get('set-cookie') };
}
function signedPayload(id, { from = '573001112233', text = '¿Tienen la Mochila Cosmos?', type = 'text', timestamp = Math.floor(Date.now() / 1000), phoneId = credentials.phoneNumberId, statuses } = {}) {
  return { object: 'whatsapp_business_account', entry: [{ changes: [{ value: { metadata: { phone_number_id: phoneId }, contacts: [{ wa_id: from, profile: { name: 'Cliente WhatsApp' } }], ...(statuses ? { statuses } : { messages: [{ id, from, type, timestamp: String(timestamp), ...(type === 'text' ? { text: { body: text } } : {}) }] }) } }] }] };
}
function webhook(payload, overrides = {}) {
  const signature = 'sha256=' + createHmac('sha256', credentials.appSecret).update(JSON.stringify(payload)).digest('hex');
  return request(`/webhooks/whatsapp/${ownerWorkspace}`, { method: 'POST', body: payload, headers: { 'x-hub-signature-256': signature, ...overrides } });
}

test('los datos privados requieren autenticación; la demo no está expuesta si se deshabilita', async () => {
  for (const path of ['/me', '/products', '/conversations', '/orders', '/activities', '/dashboard']) assert.equal((await request(path)).status, 401);
  assert.equal((await request('/auth/demo', { method: 'POST', body: {} })).status, 404);
});
test('registro crea una cuenta real, sesión segura y tienda vacía', async () => {
  const result = await request('/auth/register', { method: 'POST', body: { name: 'Ana', storeName: 'Tienda Prueba', email: 'ana@example.test', password: 'UnaClaveSegura123' } });
  assert.equal(result.status, 201); owner = result.cookie;
  assert.match(result.rawCookie, /HttpOnly/); assert.match(result.rawCookie, /SameSite=Lax/);
  const me = await request('/me', { cookie: owner }); ownerWorkspace = me.data.workspace.id;
  assert.equal(me.data.workspace.name, 'Tienda Prueba'); assert.equal(me.data.demo, false);
  assert.deepEqual((await request('/products', { cookie: owner })).data, []);
  const user = service.db.prepare('SELECT * FROM users').get();
  assert.notEqual(user.password_hash, 'UnaClaveSegura123');
  assert.notEqual(service.db.prepare('SELECT token_hash FROM sessions').get().token_hash, owner.split('=')[1]);
});
test('correo duplicado y contraseña corta son rechazados', async () => {
  const body = { name: 'Otra', storeName: 'Otra tienda', email: 'ana@example.test', password: 'UnaClaveSegura123' };
  assert.equal((await request('/auth/register', { method: 'POST', body })).status, 409);
  assert.equal((await request('/auth/register', { method: 'POST', body: { ...body, email: 'corta@example.test', password: '123' } })).status, 400);
});
test('inicio de sesión valida la contraseña y cerrar sesión revoca el acceso', async () => {
  assert.equal((await request('/auth/login', { method: 'POST', body: { email: 'ana@example.test', password: 'incorrecta' } })).status, 401);
  const login = await request('/auth/login', { method: 'POST', body: { email: 'ana@example.test', password: 'UnaClaveSegura123' } });
  assert.equal(login.status, 200);
  assert.equal((await request('/auth/logout', { method: 'POST', body: {}, cookie: login.cookie })).status, 200);
  assert.equal((await request('/me', { cookie: login.cookie })).status, 401);
});
test('el catálogo persiste productos y rechaza valores inválidos o SKU duplicado', async () => {
  const created = await request('/products', { method: 'POST', cookie: owner, body: product });
  assert.equal(created.status, 201); productId = created.data.id;
  assert.equal((await request('/products', { method: 'POST', cookie: owner, body: product })).status, 409);
  assert.equal((await request('/products', { method: 'POST', cookie: owner, body: { ...product, sku: 'INVALID', stock: -1 } })).status, 400);
  assert.equal((await request('/products', { cookie: owner })).data[0].stock, 7);
});
test('cada cuenta solo ve y modifica los datos de su propia tienda', async () => {
  const result = await request('/auth/register', { method: 'POST', body: { name: 'Luis', storeName: 'Otra Tienda', email: 'luis@example.test', password: 'OtraClaveSegura123' } });
  other = result.cookie;
  assert.deepEqual((await request('/products', { cookie: other })).data, []);
  assert.equal((await request(`/products/${productId}`, { method: 'PUT', cookie: other, body: { ...product, stock: 999 } })).status, 404);
  const p = await request('/products', { method: 'POST', cookie: other, body: { ...product, name: 'Producto secreto otra tienda' } }); otherProductId = p.data.id;
  assert.equal((await request(`/products/${otherProductId}`, { method: 'DELETE', cookie: owner, body: {} })).status, 404);
});
test('el simulador responde con stock real y refleja los cambios posteriores', async () => {
  let result = await request('/simulator', { method: 'POST', cookie: owner, body: { text: '¿Tienen la Mochila Cosmos?' } });
  assert.equal(result.status, 200); assert.match(result.data.text, /7 unidades disponibles/); assert.match(result.data.text, /89\.000/); assert.equal(result.data.source, 'local');
  assert.equal((await request(`/products/${productId}`, { method: 'PUT', cookie: owner, body: { ...product, stock: 0 } })).status, 200);
  result = await request('/simulator', { method: 'POST', cookie: owner, body: { text: '¿Tienen la Mochila Cosmos?' } });
  assert.match(result.data.text, /agotado/);
});
test('el seguimiento exige que el pedido pertenezca al número remitente', async () => {
  assert.equal((await request('/orders', { method: 'POST', cookie: owner, body: makeOrder() })).status, 201);
  assert.equal((await request('/orders', { method: 'POST', cookie: owner, body: makeOrder({ code: 'LC-2001', phone: '+573119998877', tracking_number: 'NO-REVELAR-ESTA-GUIA' }) })).status, 201);
  const good = await request('/simulator', { method: 'POST', cookie: owner, body: { text: '¿Cómo va mi pedido LC-2000?' } });
  assert.match(good.data.text, /GUIA-AUTORIZADA/); assert.match(good.data.text, /en camino/);
  const bad = await request('/simulator', { method: 'POST', cookie: owner, body: { text: '¿Cómo va mi pedido LC-2001?' } });
  assert.doesNotMatch(bad.data.text, /NO-REVELAR/); assert.match(bad.data.text, /No encontré/);
  const foreign = await request('/simulator', { method: 'POST', cookie: other, body: { text: '¿Cómo va mi pedido LC-2000?' } });
  assert.doesNotMatch(foreign.data.text, /GUIA-AUTORIZADA/);
});
test('los pedidos rechazan teléfonos sin país y enlaces de seguimiento inseguros', async () => {
  assert.equal((await request('/orders', { method: 'POST', cookie: owner, body: makeOrder({ code: 'LC-2002', phone: '3001112233' }) })).status, 400);
  assert.equal((await request('/orders', { method: 'POST', cookie: owner, body: makeOrder({ code: 'LC-2002', tracking_url: 'javascript:alert(1)' }) })).status, 400);
});
test('solicitar atención humana pausa el bot; reiniciar permite volver a probar', async () => {
  const handoff = await request('/simulator', { method: 'POST', cookie: owner, body: { text: 'Quiero hablar con una persona' } });
  assert.equal(handoff.data.category, 'humano');
  assert.equal((await request('/simulator', { method: 'POST', cookie: owner, body: { text: '¿Qué horario tienen?' } })).data.paused, true);
  assert.equal((await request('/simulator/reset', { method: 'POST', cookie: owner, body: {} })).status, 200);
  const next = await request('/simulator', { method: 'POST', cookie: owner, body: { text: '¿Qué horario tienen?' } });
  assert.match(next.data.text, /Lunes a viernes/);
  assert.equal((await request(`/conversations/${handoff.data.conversationId}/messages`, { cookie: other })).status, 404);
});
test('las políticas y la activación del asistente se guardan y aplican', async () => {
  await request('/settings', { method: 'PUT', cookie: owner, body: { hours: 'Lunes de 10 a 14, hora de Colombia.' } });
  assert.match((await request('/simulator', { method: 'POST', cookie: owner, body: { text: '¿Qué horario tienen?' } })).data.text, /Lunes de 10 a 14/);
  await request('/settings', { method: 'PUT', cookie: owner, body: { active: false } });
  assert.equal((await request('/simulator', { method: 'POST', cookie: owner, body: { text: 'Hola' } })).data.paused, true);
  await request('/settings', { method: 'PUT', cookie: owner, body: { active: true } });
});
test('las credenciales de WhatsApp se cifran y nunca vuelven al navegador', async () => {
  assert.equal((await request('/integrations/whatsapp', { method: 'PUT', cookie: owner, body: credentials })).status, 200);
  const saved = service.db.prepare('SELECT encrypted_credentials FROM integrations WHERE workspace_id = ?').get(ownerWorkspace);
  assert.ok(!saved.encrypted_credentials.includes(credentials.accessToken));
  const me = await request('/me', { cookie: owner });
  assert.equal(me.data.integration.status, 'configured'); assert.ok(!JSON.stringify(me.data).includes(credentials.appSecret));
  assert.equal((await request('/integrations/whatsapp/test', { method: 'POST', cookie: owner, body: {} })).data.status, 'verified');
});
test('el webhook verifica el código y rechaza una firma inválida', async () => {
  const challenge = await request(`/webhooks/whatsapp/${ownerWorkspace}?hub.mode=subscribe&hub.verify_token=${credentials.verifyToken}&hub.challenge=12345`);
  assert.equal(challenge.status, 200); assert.equal(challenge.data, 12345);
  assert.equal((await request(`/webhooks/whatsapp/${ownerWorkspace}?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=12345`)).status, 403);
  assert.equal((await webhook(signedPayload('wamid.invalid'), { 'x-hub-signature-256': 'sha256=invalid' })).status, 403);
  assert.equal(service.db.prepare("SELECT COUNT(*) AS n FROM messages WHERE external_id = 'wamid.invalid'").get().n, 0);
});
test('un webhook repetido solo crea un mensaje y un trabajo; la cola envía una respuesta', async () => {
  const payload = signedPayload('wamid.incoming.1');
  assert.equal((await webhook(payload)).status, 200); assert.equal((await webhook(payload)).status, 200);
  assert.equal(service.db.prepare("SELECT COUNT(*) AS n FROM messages WHERE external_id = 'wamid.incoming.1'").get().n, 1);
  assert.equal(service.db.prepare('SELECT COUNT(*) AS n FROM jobs').get().n, 1);
  await service.processJobs();
  assert.equal(service.db.prepare('SELECT status FROM jobs').get().status, 'done');
  const sent = calls.filter(c => c.init.method === 'POST');
  assert.equal(sent.length, 1);
  const body = JSON.parse(sent[0].init.body);
  assert.equal(body.to, '573001112233'); assert.match(body.text.body, /agotado/);
  assert.equal(service.db.prepare("SELECT status FROM messages WHERE role = 'assistant' AND external_id IS NOT NULL").get().status, 'sent');
});
test('los comprobantes de entrega y lectura actualizan el mensaje sin retroceder', async () => {
  const outgoing = service.db.prepare("SELECT external_id FROM messages WHERE role = 'assistant' AND external_id IS NOT NULL").get().external_id;
  await webhook(signedPayload('', { statuses: [{ id: outgoing, status: 'read' }] }));
  await webhook(signedPayload('', { statuses: [{ id: outgoing, status: 'delivered' }] }));
  assert.equal(service.db.prepare('SELECT status FROM messages WHERE external_id = ?').get(outgoing).status, 'read');
});
test('un mensaje de audio se deriva a una persona sin fingir transcribirlo', async () => {
  const result = await webhook(signedPayload('wamid.audio', { from: '573006666666', type: 'audio' }));
  assert.equal(result.status, 200);
  const c = service.db.prepare("SELECT * FROM conversations WHERE phone = '+573006666666'").get();
  assert.equal(c.handoff, 1); assert.equal(c.status, 'pending');
});
test('no se envían respuestas fuera de la ventana de WhatsApp de 24 horas', async () => {
  await webhook(signedPayload('wamid.old', { from: '573007777777', timestamp: Math.floor(Date.now() / 1000) - 90000 }));
  const c = service.db.prepare("SELECT * FROM conversations WHERE phone = '+573007777777'").get();
  await request(`/conversations/${c.id}`, { method: 'PATCH', cookie: owner, body: { handoff: true, status: 'pending' } });
  const countBefore = calls.filter(c => c.init.method === 'POST').length;
  const result = await request(`/conversations/${c.id}/messages`, { method: 'POST', cookie: owner, body: { text: 'Respuesta fuera de plazo' } });
  assert.equal(result.status, 409); assert.match(result.data.error, /24 horas/);
  assert.equal(calls.filter(c => c.init.method === 'POST').length, countBefore);
  assert.equal(service.db.prepare("SELECT status FROM messages WHERE text = 'Respuesta fuera de plazo'").get().status, 'failed');
});
test('una petición de escritura desde otro sitio es rechazada', async () => {
  const result = await request('/settings', { method: 'PUT', cookie: owner, body: { active: false }, headers: { Origin: 'https://sitio-ajeno.example' } });
  assert.equal(result.status, 403);
});
test('el registro de actividad contiene los cambios sin incluir credenciales', async () => {
  const rows = (await request('/activities', { cookie: owner })).data;
  assert.ok(rows.some(a => a.action === 'product.updated')); assert.ok(rows.some(a => a.action === 'message.received')); assert.ok(rows.some(a => a.action === 'assistant.replied'));
  const serialized = JSON.stringify(rows);
  assert.ok(!serialized.includes(credentials.accessToken)); assert.ok(!serialized.includes(credentials.appSecret));
  assert.ok(!(await request('/activities', { cookie: other })).data.some(a => a.action === 'integration.configured'));
});
test('la base de datos y las sesiones sobreviven a un reinicio del servicio', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'cerca-persistence-'));
  const opts = { databasePath: join(dir, 'test.sqlite'), demoMode: false, production: false, registrationOpen: true, startWorker: false, openaiKey: '' };
  let instance = await createApp(opts);
  let listener = instance.app.listen(0, '127.0.0.1'); await new Promise(resolve => listener.once('listening', resolve));
  const root = `http://127.0.0.1:${listener.address().port}`;
  const registered = await fetch(root + '/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Persistente', storeName: 'Tienda persistente', email: 'persistencia@example.test', password: 'UnaClavePersistente123' }) });
  const cookie = registered.headers.get('set-cookie').split(';')[0];
  await new Promise(resolve => listener.close(resolve)); instance.close();
  instance = await createApp(opts); listener = instance.app.listen(0, '127.0.0.1'); await new Promise(resolve => listener.once('listening', resolve));
  const response = await fetch(`http://127.0.0.1:${listener.address().port}/api/me`, { headers: { Cookie: cookie } });
  assert.equal(response.status, 200); assert.equal((await response.json()).workspace.name, 'Tienda persistente');
  await new Promise(resolve => listener.close(resolve)); instance.close(); await rm(dir, { recursive: true, force: true });
});
