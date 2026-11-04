import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import twilio from "twilio";
import { createApp } from "../server/app.mjs";
let service, server, base, owner, ws, other, config;
const publicBase = "https://tienda.example.test",
  sid = "AC" + "a".repeat(32),
  secret = "b".repeat(32),
  business = "+573002223334",
  from = "+573009998877";
async function req(path, { method = "GET", body, cookie, token } = {}) {
  let csrf = "";
  if (cookie && method !== "GET") {
    const r = await fetch(base + "/api/me", { headers: { Cookie: cookie } });
    csrf = (await r.json()).csrfToken;
  }
  const r = await fetch(base + "/api" + path, {
    method,
    headers: {
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(cookie ? { Cookie: cookie, "X-CSRF-Token": csrf } : {}),
      ...(token ? { Authorization: "Bearer " + token } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await r.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return {
    status: r.status,
    data,
    cookie: r.headers.get("set-cookie")?.split(";")[0],
  };
}
async function hook(url, data, valid = true) {
  const signature = twilio.getExpectedTwilioSignature(secret, url, data);
  const response = await fetch(
    base + new URL(url).pathname + new URL(url).search,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "X-Twilio-Signature": valid ? signature : "invalid",
      },
      body: new URLSearchParams(data),
    },
  );
  return { status: response.status, text: await response.text() };
}
const action = (xml) =>
  xml.match(/<Gather[^>]* action="([^"]+)"/)?.[1]?.replaceAll("&amp;", "&");
const callBody = (id = "1") => ({
  AccountSid: sid,
  CallSid: "CA" + id.repeat(32),
  To: "whatsapp:" + business,
  From: "whatsapp:" + from,
});
before(async () => {
  service = await createApp({
    databasePath: ":memory:",
    demoMode: false,
    registrationOpen: true,
    production: false,
    baseUrl: publicBase,
    openaiKey: "",
    startWorker: false,
  });
  server = service.app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  base = "http://127.0.0.1:" + server.address().port;
  const a = await req("/auth/register", {
    method: "POST",
    body: {
      name: "Laura",
      storeName: "Restaurante real",
      email: "voz@example.test",
      password: "ClaveSegura12345",
    },
  });
  assert.equal(a.status, 201);
  owner = a.cookie;
  ws = (await req("/me", { cookie: owner })).data.workspace.id;
  other = (
    await req("/auth/register", {
      method: "POST",
      body: {
        name: "Otra",
        storeName: "Otra tienda",
        email: "otra-voz@example.test",
        password: "ClaveSegura12345",
      },
    })
  ).cookie;
  await req("/products", {
    method: "POST",
    cookie: owner,
    body: {
      name: "Pizza Original",
      sku: "P-001",
      price: 35000,
      stock: 2,
      kind: "dish",
      ingredients: "Tomate, queso y trigo",
      allergens: "Leche y gluten",
    },
  });
});
after(async () => {
  await new Promise((r) => server.close(r));
  service.close();
});
test("el enlace de clientes empieza desactivado y solo el propietario lo habilita", async () => {
  const info = await req("/voice/config", { cookie: owner });
  assert.equal(info.data.publicEnabled, false);
  const token = new URL(info.data.publicUrl).searchParams.get("voice");
  assert.equal((await req("/public/store/" + token)).status, 404);
  assert.equal(
    (await req("/voice/channel", { method: "PUT", body: { enabled: true } }))
      .status,
    401,
  );
  assert.equal(
    (
      await req("/voice/channel", {
        method: "PUT",
        cookie: owner,
        body: { enabled: true },
      })
    ).status,
    200,
  );
  const pub = await req("/public/store/" + token);
  assert.equal(pub.data.name, "Restaurante real");
  assert.deepEqual(Object.keys(pub.data).sort(), [
    "assistantName",
    "name",
    "voiceRate",
    "welcome",
  ]);
});
test("una llamada web permite consultar datos actuales, exige su token y limita pedidos", async () => {
  const info = await req("/voice/config", { cookie: owner }),
    token = new URL(info.data.publicUrl).searchParams.get("voice");
  const result = await req("/public/voice/" + token + "/sessions", {
    method: "POST",
    body: {},
  });
  assert.equal(result.status, 201);
  const c = result.data;
  assert.match(c.greeting, /asistente virtual/);
  assert.equal(
    (
      await req("/voice/sessions/" + c.id + "/turn", {
        method: "POST",
        token: "c".repeat(64),
        body: { text: "menú" },
      })
    ).status,
    401,
  );
  let r = await req("/voice/sessions/" + c.id + "/turn", {
    method: "POST",
    token: c.token,
    body: { text: "¿Qué menú hay?" },
  });
  assert.match(r.data.text, /35.000/);
  assert.match(r.data.text, /Tomate/);
  service.db
    .prepare("UPDATE products SET price=37000,stock=0 WHERE workspace_id=?")
    .run(ws);
  r = await req("/voice/sessions/" + c.id + "/turn", {
    method: "POST",
    token: c.token,
    body: { text: "Precio P-001" },
  });
  assert.match(r.data.text, /37.000/);
  assert.match(r.data.text, /agotado/);
  r = await req("/voice/sessions/" + c.id + "/turn", {
    method: "POST",
    token: c.token,
    body: { text: "Revisa pedido LC-1000" },
  });
  assert.match(r.data.text, /WhatsApp/);
  assert.equal(
    (
      await req("/voice/sessions/" + c.id + "/end", {
        method: "POST",
        token: c.token,
        body: {},
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await req("/voice/sessions/" + c.id + "/turn", {
        method: "POST",
        token: c.token,
        body: { text: "hola" },
      })
    ).status,
    410,
  );
  assert.equal((await req("/voice/history", { cookie: other })).data.length, 0);
  assert.equal(
    (await req("/voice/history", { cookie: owner })).data[0].turn_count,
    3,
  );
  service.db
    .prepare("UPDATE products SET stock=2 WHERE workspace_id=?")
    .run(ws);
});
test("las notas internas se guardan sin enviarlas ni exponerlas al cliente de voz", async () => {
  const session = (
    await req("/voice/sessions", { method: "POST", cookie: owner, body: {} })
  ).data;
  const r = await req(
    "/conversations/" + session.conversationId + "/messages",
    {
      method: "POST",
      cookie: owner,
      body: { text: "Nota privada para el equipo" },
    },
  );
  assert.equal(r.status, 201);
  assert.equal(r.data.status, "note");
  const answer = await req("/voice/sessions/" + session.id + "/turn", {
    method: "POST",
    token: session.token,
    body: { text: "Qué menú hay" },
  });
  assert.equal(answer.status, 200);
  assert.doesNotMatch(answer.data.text, /Nota privada/);
  await req("/voice/sessions/" + session.id + "/end", {
    method: "POST",
    token: session.token,
    body: {},
  });
  const exported = (
    await req("/account/export", { method: "POST", cookie: owner, body: {} })
  ).data;
  assert.equal(exported.calls.length, 2);
  assert.ok(!JSON.stringify(exported.calls).includes(session.token));
});

test("el proveedor se guarda cifrado y no figura conectado sin un webhook firmado", async () => {
  const r = await req("/voice/integration", {
    method: "PUT",
    cookie: owner,
    body: { accountSid: sid, authToken: secret, businessNumber: business },
  });
  assert.equal(r.status, 200);
  config = r.data;
  assert.equal(config.status, "configured");
  assert.equal(config.lastWebhookAt, null);
  assert.ok(!JSON.stringify(config).includes(secret));
  assert.ok(
    !service.db
      .prepare("SELECT encrypted_credentials FROM voice_integrations")
      .get()
      .encrypted_credentials.includes(secret),
  );
  const bad = await hook(config.incomingUrl, callBody(), false);
  assert.equal(bad.status, 403);
  assert.equal(
    service.db
      .prepare("SELECT COUNT(*) n FROM voice_sessions WHERE mode='twilio'")
      .get().n,
    0,
  );
});
test("una llamada WhatsApp firmada recibe TwiML en español y los reintentos no duplican transcripciones", async () => {
  const body = callBody();
  let r = await hook(config.incomingUrl, body);
  assert.equal(r.status, 200);
  assert.match(r.text, /<Gather/);
  assert.match(r.text, /language="es-CO"/);
  assert.match(r.text, /asistente virtual/);
  assert.doesNotMatch(r.text, /<Record/);
  const first = r.text,
    conversation = service.db
      .prepare(
        "SELECT conversation_id FROM voice_sessions WHERE provider_call_id=?",
      )
      .get(body.CallSid);
  assert.equal((await hook(config.incomingUrl, body)).text, first);
  const next = action(first);
  assert.ok(next);
  r = await hook(next, {
    ...body,
    SpeechResult: "¿Qué ingredientes tiene la Pizza Original?",
  });
  assert.equal(r.status, 200);
  assert.match(r.text, /Tomate, queso y trigo/);
  const count = service.db
    .prepare("SELECT COUNT(*) n FROM messages WHERE conversation_id=?")
    .get(conversation.conversation_id).n;
  assert.equal(
    (
      await hook(next, {
        ...body,
        SpeechResult: "¿Qué ingredientes tiene la Pizza Original?",
      })
    ).text,
    r.text,
  );
  assert.equal(
    service.db
      .prepare("SELECT COUNT(*) n FROM messages WHERE conversation_id=?")
      .get(conversation.conversation_id).n,
    count,
  );
  assert.equal(
    (await req("/voice/config", { cookie: owner })).data.status,
    "webhook-received",
  );
  const completed = await hook(config.statusUrl, {
    ...body,
    CallStatus: "completed",
  });
  assert.equal(completed.status, 204);
  assert.ok(
    service.db
      .prepare("SELECT ended_at FROM voice_sessions WHERE provider_call_id=?")
      .get(body.CallSid).ended_at,
  );
});
test("tres silencios terminan la llamada y solicitar una persona registra la derivación", async () => {
  const body = callBody("2");
  let r = await hook(config.incomingUrl, body);
  for (let i = 0; i < 3; i++) {
    const next = action(r.text);
    assert.ok(next, JSON.stringify(r));
    r = await hook(next, body);
    assert.equal(r.status, 200, r.text);
  }
  assert.match(r.text, /<Hangup/);
  assert.match(r.text, /No pude escucharte/);
  const b = callBody("3");
  r = await hook(config.incomingUrl, b);
  r = await hook(action(r.text), { ...b, Digits: "0" });
  assert.match(r.text, /<Hangup/);
  const c = service.db
    .prepare(
      "SELECT c.handoff,c.status FROM conversations c JOIN voice_sessions v ON v.conversation_id=c.id WHERE v.provider_call_id=?",
    )
    .get(b.CallSid);
  assert.equal(c.handoff, 1);
  assert.equal(c.status, "pending");
});
test("la firma no permite cambiar cuenta o número de destino, ni cruzar tiendas", async () => {
  assert.equal(
    (
      await hook(config.incomingUrl, {
        ...callBody("4"),
        AccountSid: "AC" + "d".repeat(32),
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await hook(config.incomingUrl, {
        ...callBody("4"),
        To: "whatsapp:+573001111111",
      })
    ).status,
    403,
  );
  const otherConfig = (await req("/voice/config", { cookie: other })).data;
  assert.equal(
    (await hook(otherConfig.incomingUrl, callBody("4"))).status,
    404,
  );
});
test("pedir una persona intenta transferir al destino configurado sin iniciar llamadas desde el servidor", async () => {
  const forward = "+573003334444";
  await req("/voice/integration", {
    method: "PUT",
    cookie: owner,
    body: {
      accountSid: sid,
      authToken: secret,
      businessNumber: business,
      forwardNumber: forward,
    },
  });
  const body = { ...callBody("6"), From: "whatsapp:+573008887777" };
  const incoming = await hook(config.incomingUrl, body);
  assert.equal(incoming.status, 200);
  const response = await hook(action(incoming.text), { ...body, Digits: "0" });
  assert.equal(response.status, 200);
  assert.match(response.text, /<Dial/);
  assert.ok(response.text.includes(forward));
  assert.match(response.text, /intentar comunicarte/);
  assert.doesNotMatch(response.text, /ya est[aá]s conectado/);
});

test("desactivar el canal revoca las llamadas públicas y pausar la voz bloquea nuevas sesiones", async () => {
  const token = new URL(
    (await req("/voice/config", { cookie: owner })).data.publicUrl,
  ).searchParams.get("voice");
  const c = (
    await req("/public/voice/" + token + "/sessions", {
      method: "POST",
      body: {},
    })
  ).data;
  await req("/voice/channel", {
    method: "PUT",
    cookie: owner,
    body: { enabled: false },
  });
  assert.equal(
    (
      await req("/voice/sessions/" + c.id + "/turn", {
        method: "POST",
        token: c.token,
        body: { text: "hola" },
      })
    ).status,
    410,
  );
  await req("/settings", {
    method: "PUT",
    cookie: owner,
    body: { voiceEnabled: false },
  });
  assert.equal(
    (await req("/voice/sessions", { method: "POST", cookie: owner, body: {} }))
      .status,
    409,
  );
  const r = await hook(config.incomingUrl, callBody("5"));
  assert.match(r.text, /<Hangup/);
});
