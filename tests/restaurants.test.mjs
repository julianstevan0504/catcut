import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { createApp } from "../server/app.mjs";
import { createWorkspace } from "../server/db.mjs";
import { localParts, zonedInstant } from "../shared/restaurant.ts";
const setup = "test_only_platform_activation_" + "a".repeat(32),
  password = "RestauranteSeguro12345";
test("pausar la cocina conserva el menú y las reservas sin admitir nuevos pedidos públicos o del asistente", async (t) => {
  const c = await fixture(t),
    p = await c.configure(c.a, { acceptingOrders: false }),
    id = await c.createProduct();
  assert.equal((await c.req("/public/restaurants/" + p.slug)).status, 200);
  assert.equal(
    (
      await c.req("/public/restaurants/" + p.slug + "/orders", {
        method: "POST",
        body: order(id),
      })
    ).status,
    409,
  );
  const answer = await c.req("/simulator", {
    method: "POST",
    cookie: c.a.cookie,
    body: { text: "Quiero pedir una pizza para recoger" },
  });
  assert.match(answer.data.text, /pausada/);
  assert.equal(
    c.db.prepare("SELECT COUNT(*) n FROM restaurant_orders").get().n,
    0,
  );
  assert.equal(
    (
      await c.req("/public/restaurants/" + p.slug + "/reservations", {
        method: "POST",
        body: booking(),
      })
    ).status,
    201,
  );
});
test("interrumpir una consulta de voz cancela la IA pendiente y permite la siguiente pregunta", async (t) => {
  let entered;
  const started = new Promise((resolve) => {
    entered = resolve;
  });
  const c = await fixture(t, {
    openaiKey: "test_only",
    fetcher: async (_url, init) => {
      entered();
      return await new Promise((_resolve, reject) => {
        if (init.signal.aborted) return reject(init.signal.reason);
        init.signal.addEventListener(
          "abort",
          () => reject(init.signal.reason),
          { once: true },
        );
      });
    },
  });
  await c.createProduct(c.a, {
    name: "Pizza de Prueba",
    sku: "PIZ-001",
    price: 28000,
    stock: 5,
  });
  const call = (
    await c.req("/voice/sessions", {
      method: "POST",
      cookie: c.a.cookie,
      body: {},
    })
  ).data;
  const pending = c.req("/voice/sessions/" + call.id + "/turn", {
    method: "POST",
    token: call.token,
    body: { text: "Compara la Pizza de Prueba con otras opciones" },
  });
  await started;
  assert.equal(
    (
      await c.req("/voice/sessions/" + call.id + "/interrupt", {
        method: "POST",
        token: call.token,
        body: {},
      })
    ).status,
    200,
  );
  assert.equal((await pending).status, 409);
  const next = await c.req("/voice/sessions/" + call.id + "/turn", {
    method: "POST",
    token: call.token,
    body: { text: "¿Qué precio tiene PIZ-001?" },
  });
  assert.equal(next.status, 200);
  assert.match(next.data.text, /28.000/);
  assert.equal(
    c.db
      .prepare("SELECT turn_count FROM voice_sessions WHERE id=?")
      .get(call.id).turn_count,
    1,
  );
});
async function fixture(t, options = {}) {
  const dir = await mkdtemp(join(tmpdir(), "cerca-restaurant-test-")),
    service = await createApp({
      databasePath: ":memory:",
      production: false,
      demoMode: false,
      registrationOpen: true,
      startWorker: false,
      openaiKey: "",
      platformSetupToken: setup,
      mediaDirectory: dir,
      ...options,
    }),
    server = service.app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  const base = "http://127.0.0.1:" + server.address().port,
    csrf = new Map();
  t.after(async () => {
    await new Promise((r) => server.close(r));
    service.close();
    await rm(dir, { recursive: true, force: true });
  });
  async function req(
    path,
    { method = "GET", body, cookie, token, headers = {} } = {},
  ) {
    const r = await fetch(base + "/api" + path, {
      method,
      headers: {
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(cookie
          ? {
              Cookie: cookie,
              ...(csrf.get(cookie) ? { "X-CSRF-Token": csrf.get(cookie) } : {}),
            }
          : {}),
        ...(token ? { Authorization: "Bearer " + token } : {}),
        ...headers,
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
    const c = r.headers.get("set-cookie")?.split(";")[0];
    if (c && data.csrfToken) csrf.set(c, data.csrfToken);
    return { status: r.status, data, cookie: c, headers: r.headers };
  }
  async function register(email, name) {
    const r = await req("/auth/register", {
      method: "POST",
      body: {
        name,
        storeName: name,
        email,
        password,
        platformAdmin: true,
        workspace_id: "forged",
      },
    });
    assert.equal(r.status, 201);
    const me = (await req("/me", { cookie: r.cookie })).data;
    return {
      cookie: r.cookie,
      id: me.user.id,
      ws: me.workspace.id,
      codes: r.data.recoveryCodes,
      email,
    };
  }
  const a = await register("a@example.test", "Restaurante A"),
    b = await register("b@example.test", "Restaurante B");
  async function configure(owner = a, extra = {}) {
    const p = (await req("/restaurant", { cookie: owner.cookie })).data;
    const r = await req("/restaurant", {
      method: "PUT",
      cookie: owner.cookie,
      body: {
        ...p,
        publicEnabled: true,
        reservationsEnabled: true,
        address: "Dirección de prueba",
        ...extra,
      },
    });
    assert.equal(r.status, 200, JSON.stringify(r.data));
    return {
      ...p,
      ...extra,
      publicEnabled: true,
      reservationsEnabled: true,
      address: "Dirección de prueba",
    };
  }
  const createProduct = async (owner = a, extra = {}) => {
    const r = await req("/products", {
      method: "POST",
      cookie: owner.cookie,
      body: {
        name: "Sopa de la Casa",
        sku: "SOPA-100",
        price: 12000,
        stock: 4,
        kind: "dish",
        ingredients: "Papa, agua y sal",
        allergens: "Trazas a confirmar",
        ...extra,
      },
    });
    assert.equal(r.status, 201, JSON.stringify(r.data));
    return r.data.id;
  };
  return { ...service, server, base, dir, req, a, b, configure, createProduct };
}
const tomorrow = () => {
  const date = localParts(new Date(), "America/Bogota").date,
    d = new Date(date + "T12:00Z");
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};
const booking = (extra = {}) => ({
  name: "Cliente de prueba",
  phone: "+573001112233",
  partySize: 3,
  date: tomorrow(),
  time: "12:00",
  requestId: randomUUID(),
  confirm: true,
  ...extra,
});
const order = (id, extra = {}) => ({
  name: "Cliente",
  phone: "+573001112233",
  items: [{ productId: id, quantity: 2 }],
  fulfillment: "pickup",
  requestId: randomUUID(),
  confirm: true,
  ...extra,
});
test("cada restaurante conserva su configuración y no puede elegirse otro tenant desde el navegador", async (t) => {
  const c = await fixture(t);
  await c.configure(c.a, { cuisine: "Cocina A" });
  await c.configure(c.b, { cuisine: "Cocina B" });
  const a = (await c.req("/restaurant", { cookie: c.a.cookie })).data,
    b = (
      await c.req("/restaurant", {
        cookie: c.b.cookie,
        headers: { "X-Tenant-ID": c.a.ws },
      })
    ).data;
  assert.equal(a.cuisine, "Cocina A");
  assert.equal(b.cuisine, "Cocina B");
  assert.notEqual(a.slug, b.slug);
  const forged = (await c.req("/me", { cookie: c.b.cookie })).data;
  assert.equal(forged.platformAdmin, false);
  assert.equal(
    (await c.req("/platform/overview", { cookie: c.b.cookie })).status,
    403,
  );
});
test("reservas concurrentes no exceden capacidad y reintentar no duplica la reserva", async (t) => {
  const c = await fixture(t),
    p = await c.configure(c.a, { capacity: 4, maxParty: 4 });
  const first = booking(),
    second = booking({ phone: "+573002223344" }),
    path = "/public/restaurants/" + p.slug + "/reservations";
  const results = await Promise.all([
    c.req(path, { method: "POST", body: first }),
    c.req(path, { method: "POST", body: second }),
  ]);
  assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
  const success = results.find((r) => r.status === 201),
    successBody = results[0].status === 201 ? first : second;
  assert.equal(
    c.db.prepare("SELECT SUM(party_size) n FROM reservations").get().n,
    3,
  );
  const replay = await c.req(path, { method: "POST", body: successBody });
  assert.equal(replay.status, 200);
  assert.equal(replay.data.code, success.data.code);
  assert.equal(c.db.prepare("SELECT COUNT(*) n FROM reservations").get().n, 1);
  assert.equal(
    (
      await c.req("/reservations/" + success.data.id, {
        method: "PUT",
        cookie: c.b.cookie,
        body: { status: "confirmed" },
      })
    ).status,
    404,
  );
  const cancel = await c.req(
    "/public/reservations/" + success.data.guestToken + "/cancel",
    { method: "POST", body: {} },
  );
  assert.equal(cancel.status, 200);
  const next = await c.req(path, { method: "POST", body: booking() });
  assert.equal(next.status, 201);
});
test("horarios cerrados, grupos excesivos y horas inexistentes se rechazan", async (t) => {
  const c = await fixture(t),
    date = tomorrow(),
    p = await c.configure(c.a, { closedDates: [date] });
  const slots = await c.req(
    "/public/restaurants/" +
      p.slug +
      "/availability?date=" +
      date +
      "&partySize=2",
  );
  assert.deepEqual(slots.data.slots, []);
  assert.equal(
    (
      await c.req("/public/restaurants/" + p.slug + "/reservations", {
        method: "POST",
        body: booking({ partySize: 99 }),
      })
    ).status,
    400,
  );
  assert.throws(
    () => zonedInstant("2027-03-14", "02:30", "America/New_York"),
    /no existe/,
  );
  assert.equal(
    zonedInstant("2027-01-10", "20:00", "America/Bogota").toISOString(),
    "2027-01-11T01:00:00.000Z",
  );
});
test("el servidor calcula el pedido con precios reales, descuenta stock atómicamente y deduplica", async (t) => {
  const c = await fixture(t),
    p = await c.configure(),
    id = await c.createProduct(c.a, { stock: 2 });
  const first = order(id, { total: 1, price: 1, discount: 99999 }),
    second = order(id, { phone: "+573004445566" }),
    path = "/public/restaurants/" + p.slug + "/orders";
  const results = await Promise.all([
    c.req(path, { method: "POST", body: first }),
    c.req(path, { method: "POST", body: second }),
  ]);
  assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
  const good = results.find((r) => r.status === 201),
    body = results[0].status === 201 ? first : second;
  assert.equal(good.data.total, 24000);
  assert.equal(
    c.db.prepare("SELECT stock FROM products WHERE id=?").get(id).stock,
    0,
  );
  const again = await c.req(path, { method: "POST", body });
  assert.equal(again.status, 200);
  assert.equal(again.data.code, good.data.code);
  assert.equal(
    c.db.prepare("SELECT COUNT(*) n FROM restaurant_orders").get().n,
    1,
  );
  const publicView = await c.req("/public/orders/" + good.data.guestToken);
  assert.equal(publicView.status, 200);
  assert.equal(publicView.data.total, 24000);
  assert.ok(!JSON.stringify(publicView.data).includes(c.a.email));
  assert.equal((await c.req("/public/orders/" + "c".repeat(64))).status, 404);
});
test("cancelar restaura el stock una vez y los estados o pagos no se pueden modificar desde otro restaurante", async (t) => {
  const c = await fixture(t),
    p = await c.configure(),
    id = await c.createProduct();
  const r = await c.req("/public/restaurants/" + p.slug + "/orders", {
    method: "POST",
    body: order(id),
  });
  assert.equal(r.status, 201);
  assert.equal(
    (
      await c.req("/kitchen/" + r.data.id + "/status", {
        method: "PUT",
        cookie: c.b.cookie,
        body: { status: "cancelled" },
      })
    ).status,
    404,
  );
  assert.equal(
    (
      await c.req("/orders/" + r.data.id, {
        method: "PUT",
        cookie: c.a.cookie,
        body: {},
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await c.req("/kitchen/" + r.data.id + "/payment", {
        method: "PUT",
        cookie: c.b.cookie,
        body: { status: "verified" },
      })
    ).status,
    404,
  );
  assert.equal(
    (
      await c.req("/kitchen/" + r.data.id + "/payment", {
        method: "PUT",
        cookie: c.a.cookie,
        body: { status: "verified" },
      })
    ).status,
    200,
  );
  assert.equal(
    (await c.req("/public/orders/" + r.data.guestToken)).data.paymentStatus,
    "verified",
  );
  assert.equal(
    (
      await c.req("/kitchen/" + r.data.id + "/status", {
        method: "PUT",
        cookie: c.a.cookie,
        body: { status: "cancelled" },
      })
    ).status,
    200,
  );
  assert.equal(
    c.db.prepare("SELECT stock FROM products WHERE id=?").get(id).stock,
    4,
  );
  assert.equal(
    (
      await c.req("/kitchen/" + r.data.id + "/status", {
        method: "PUT",
        cookie: c.a.cookie,
        body: { status: "cancelled" },
      })
    ).status,
    409,
  );
  assert.equal(
    c.db.prepare("SELECT stock FROM products WHERE id=?").get(id).stock,
    4,
  );
});
test("domicilio suma su tarifa guardada y exige confirmar cambios de precio", async (t) => {
  const c = await fixture(t),
    p = await c.configure(c.a, {
      services: { dineIn: true, pickup: true, delivery: true },
      deliveryZones: [{ id: "norte", name: "Norte", fee: 5000 }],
    }),
    id = await c.createProduct();
  const wrong = await c.req("/public/restaurants/" + p.slug + "/orders", {
    method: "POST",
    body: order(id, {
      fulfillment: "delivery",
      address: "Dirección cliente de prueba",
      deliveryZone: "norte",
      expectedTotal: 1,
    }),
  });
  assert.equal(wrong.status, 409);
  assert.equal(
    c.db.prepare("SELECT stock FROM products WHERE id=?").get(id).stock,
    4,
  );
  const good = await c.req("/public/restaurants/" + p.slug + "/orders", {
    method: "POST",
    body: order(id, {
      fulfillment: "delivery",
      address: "Dirección cliente de prueba",
      deliveryZone: "norte",
      expectedTotal: 29000,
    }),
  });
  assert.equal(good.status, 201);
  assert.equal(good.data.total, 29000);
  assert.equal(good.data.details.delivery_fee, 5000);
});
test("las fotos se decodifican, pierden metadatos y conservan permisos por restaurante", async (t) => {
  const c = await fixture(t);
  const raw = await sharp({
      create: {
        width: 100,
        height: 80,
        channels: 3,
        background: { r: 100, g: 150, b: 70 },
      },
    })
      .jpeg()
      .withMetadata()
      .toBuffer(),
    data = "data:image/jpeg;base64," + raw.toString("base64");
  const uploaded = await c.req("/media/images", {
    method: "POST",
    cookie: c.a.cookie,
    body: { data },
  });
  assert.equal(uploaded.status, 201);
  const id = uploaded.data.imageId;
  assert.equal(
    (await c.req("/media/images", { cookie: c.a.cookie })).data.images[0].id,
    id,
  );
  assert.equal(
    (await c.req("/media/images", { cookie: c.b.cookie })).data.images.length,
    0,
  );
  assert.equal(
    (
      await c.req("/media/images/" + id, {
        method: "DELETE",
        cookie: c.b.cookie,
        body: {},
      })
    ).status,
    404,
  );
  const file = await readFile(join(c.dir, id + ".webp")),
    meta = await sharp(file).metadata();
  assert.equal(meta.format, "webp");
  assert.equal(meta.exif, undefined);
  const foreign = await c.req("/products", {
    method: "POST",
    cookie: c.b.cookie,
    body: {
      name: "Foto ajena",
      sku: "F-001",
      price: 10,
      stock: 1,
      image_id: id,
    },
  });
  assert.equal(foreign.status, 400);
  const pB = (await c.req("/restaurant", { cookie: c.b.cookie })).data;
  assert.equal(
    (
      await c.req("/restaurant", {
        method: "PUT",
        cookie: c.b.cookie,
        body: { ...pB, coverImageId: id },
      })
    ).status,
    400,
  );
  const privateRead = await fetch(c.base + "/media/" + id, {
    headers: { Cookie: c.b.cookie },
  });
  assert.equal(privateRead.status, 404);
  const p = await c.configure(c.a, { coverImageId: id });
  assert.equal(
    (await c.req("/media/images", { cookie: c.a.cookie })).data.images[0].used,
    true,
  );
  assert.equal(
    (
      await c.req("/media/images/" + id, {
        method: "DELETE",
        cookie: c.a.cookie,
        body: {},
      })
    ).status,
    409,
  );
  const publicRead = await fetch(c.base + "/media/" + id);
  assert.equal(publicRead.status, 200);
  assert.match(publicRead.headers.get("Content-Type"), /image\/webp/);
  const bad = await c.req("/media/images", {
    method: "POST",
    cookie: c.a.cookie,
    body: {
      data:
        "data:image/png;base64," +
        Buffer.from(
          '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
        ).toString("base64"),
    },
  });
  assert.equal(bad.status, 400);
  assert.equal(
    (await c.req("/public/restaurants/" + p.slug)).data.profile.coverImageId,
    id,
  );
});
test("recuperar con un código exige el correo correcto, consume el código y revoca las sesiones", async (t) => {
  const c = await fixture(t);
  assert.equal(c.a.codes.length, 8);
  const wrong = await c.req("/auth/reset-password", {
    method: "POST",
    body: {
      email: c.b.email,
      recoveryCode: c.a.codes[0],
      password: "NuevaContraseña12345",
    },
  });
  assert.equal(wrong.status, 400);
  const good = await c.req("/auth/reset-password", {
    method: "POST",
    body: {
      email: c.a.email,
      recoveryCode: c.a.codes[0],
      password: "NuevaContraseña12345",
    },
  });
  assert.equal(good.status, 200);
  assert.equal((await c.req("/products", { cookie: c.a.cookie })).status, 401);
  assert.equal(
    (
      await c.req("/auth/reset-password", {
        method: "POST",
        body: {
          email: c.a.email,
          recoveryCode: c.a.codes[0],
          password: "OtraContraseña12345",
        },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await c.req("/auth/login", {
        method: "POST",
        body: { email: c.a.email, password },
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await c.req("/auth/login", {
        method: "POST",
        body: { email: c.a.email, password: "NuevaContraseña12345" },
      })
    ).status,
    200,
  );
  assert.ok(
    !JSON.stringify(
      c.db.prepare("SELECT * FROM recovery_codes").all(),
    ).includes(c.a.codes[1]),
  );
});
test("recuperación por correo devuelve el mismo mensaje, usa token de una vez y lo entrega solo al proveedor", async (t) => {
  const mails = [];
  const c = await fixture(t, {
    mailKey: "test_only_resend_key",
    mailFrom: "Cerca <no-reply@example.test>",
    fetcher: async (url, init) => {
      assert.equal(url, "https://api.resend.com/emails");
      mails.push(JSON.parse(init.body));
      return Response.json({ id: "mail-test" });
    },
  });
  const exists = await c.req("/auth/forgot-password", {
      method: "POST",
      body: { email: c.a.email },
    }),
    missing = await c.req("/auth/forgot-password", {
      method: "POST",
      body: { email: "nobody@example.test" },
    });
  assert.deepEqual(exists.data, missing.data);
  assert.equal(mails.length, 1);
  assert.deepEqual(mails[0].to, [c.a.email]);
  const token = mails[0].text.match(/recover=([a-f0-9]{64})/)[1];
  assert.ok(!JSON.stringify(exists.data).includes(token));
  assert.equal(
    (
      await c.req("/auth/reset-password", {
        method: "POST",
        body: { token, password: "NuevaClaveCorreo12345" },
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await c.req("/auth/reset-password", {
        method: "POST",
        body: { token, password: "OtraClaveCorreo12345" },
      })
    ).status,
    400,
  );
});
test("la administración requiere clave privada y contraseña, cuenta muchos negocios y cierra el registro sin perder los existentes", async (t) => {
  const c = await fixture(t);
  assert.equal(
    (
      await c.req("/platform/claim", {
        method: "POST",
        cookie: c.a.cookie,
        body: { setupToken: "wrong", password },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await c.req("/platform/claim", {
        method: "POST",
        cookie: c.a.cookie,
        body: { setupToken: setup, password },
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await c.req("/platform/claim", {
        method: "POST",
        cookie: c.b.cookie,
        body: { setupToken: setup, password },
      })
    ).status,
    403,
  );
  const hash = c.db
    .prepare("SELECT password_hash FROM users WHERE id=?")
    .get(c.a.id).password_hash;
  for (let i = 0; i < 100; i++) {
    const ws = createWorkspace(c.db, "Restaurante de carga " + i);
    c.db
      .prepare("INSERT INTO users VALUES (?,?,?,?,?,?)")
      .run(
        randomUUID(),
        ws,
        "Carga",
        "load-" + i + "@example.test",
        hash,
        new Date().toISOString(),
      );
  }
  const overview = await c.req("/platform/overview", { cookie: c.a.cookie });
  assert.equal(overview.status, 200);
  assert.equal(overview.data.metrics.restaurants, 102);
  assert.equal(
    (
      await c.req("/platform/settings", {
        method: "PUT",
        cookie: c.a.cookie,
        body: {
          brandName: "Plataforma de prueba",
          supportEmail: "",
          registrationOpen: false,
        },
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await c.req("/auth/register", {
        method: "POST",
        body: {
          email: "new@example.test",
          name: "Otro",
          storeName: "Otro restaurante",
          password,
        },
      })
    ).status,
    403,
  );
  assert.equal((await c.req("/products", { cookie: c.b.cookie })).status, 200);
});
test("soporte es privado y suspender un negocio detiene su menú público sin bloquear su contacto con soporte", async (t) => {
  const c = await fixture(t),
    p = await c.configure(c.b);
  const ticket = await c.req("/support/tickets", {
    method: "POST",
    cookie: c.b.cookie,
    body: {
      subject: "Prueba de soporte",
      category: "orders",
      text: "El pedido de ejemplo requiere revisión.",
    },
  });
  assert.equal(ticket.status, 201);
  assert.equal(
    (await c.req("/support/tickets/" + ticket.data.id, { cookie: c.a.cookie }))
      .status,
    404,
  );
  await c.req("/platform/claim", {
    method: "POST",
    cookie: c.a.cookie,
    body: { setupToken: setup, password },
  });
  assert.equal(
    (
      await c.req("/platform/support/" + ticket.data.id + "/messages", {
        method: "POST",
        cookie: c.a.cookie,
        body: { text: "Revisión técnica registrada.", status: "working" },
      })
    ).status,
    201,
  );
  assert.equal(
    (await c.req("/support/tickets/" + ticket.data.id, { cookie: c.b.cookie }))
      .data.messages.length,
    2,
  );
  assert.equal(
    (
      await c.req("/platform/restaurants/" + c.b.ws + "/state", {
        method: "PUT",
        cookie: c.a.cookie,
        body: { status: "suspended", reason: "Revisión de prueba" },
      })
    ).status,
    200,
  );
  assert.equal((await c.req("/products", { cookie: c.b.cookie })).status, 403);
  assert.equal((await c.req("/public/restaurants/" + p.slug)).status, 404);
  assert.equal(
    (await c.req("/support/tickets", { cookie: c.b.cookie })).status,
    200,
  );
  assert.equal((await c.req("/products", { cookie: c.a.cookie })).status, 200);
});
test("el asistente registra reservas y pedidos solo después de una confirmación explícita y deduplica", async (t) => {
  const c = await fixture(t);
  await c.configure();
  await c.createProduct(c.a, {
    name: "Pizza de Prueba",
    sku: "PIZ-001",
    price: 28000,
    stock: 5,
  });
  const first = await c.req("/simulator", {
    method: "POST",
    cookie: c.a.cookie,
    body: {
      text: "Reserva para mañana a las 20:00 para dos personas a nombre de Ana",
    },
  });
  assert.equal(first.status, 200);
  assert.match(first.data.text, /confirmar reserva/);
  assert.equal(c.db.prepare("SELECT COUNT(*) n FROM reservations").get().n, 0);
  await c.req("/simulator", {
    method: "POST",
    cookie: c.a.cookie,
    body: { text: "¿Qué ingredientes lleva la Pizza de Prueba?" },
  });
  assert.equal(c.db.prepare("SELECT COUNT(*) n FROM reservations").get().n, 0);
  const confirm = await c.req("/simulator", {
    method: "POST",
    cookie: c.a.cookie,
    body: { text: "confirmar reserva" },
  });
  assert.match(confirm.data.text, /Registré la solicitud/);
  assert.equal(c.db.prepare("SELECT COUNT(*) n FROM reservations").get().n, 1);
  await c.req("/simulator", {
    method: "POST",
    cookie: c.a.cookie,
    body: { text: "confirmar reserva" },
  });
  assert.equal(c.db.prepare("SELECT COUNT(*) n FROM reservations").get().n, 1);
  const quote = await c.req("/simulator", {
    method: "POST",
    cookie: c.a.cookie,
    body: { text: "Quiero pedir dos pizzas para recoger a nombre de Ana" },
  });
  assert.match(quote.data.text, /confirmar pedido/);
  assert.equal(
    c.db.prepare("SELECT COUNT(*) n FROM restaurant_orders").get().n,
    0,
  );
  const placed = await c.req("/simulator", {
    method: "POST",
    cookie: c.a.cookie,
    body: { text: "confirmar pedido" },
  });
  assert.match(placed.data.text, /quedó registrado/);
  const cancellation = await c.req("/simulator", {
    method: "POST",
    cookie: c.a.cookie,
    body: { text: "cancelar pedido" },
  });
  assert.match(cancellation.data.text, /contacta con el equipo/);
  assert.doesNotMatch(cancellation.data.text, /cancelar la reserva desde/);
  assert.equal(
    c.db.prepare("SELECT COUNT(*) n FROM restaurant_orders").get().n,
    1,
  );
});
