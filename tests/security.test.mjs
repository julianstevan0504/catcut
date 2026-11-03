import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { createApp } from "../server/app.mjs";

let service, listener, base, a, b;
const p = {
  name: "Producto privado",
  sku: "SEG-001",
  description: "Registro de prueba",
  category: "General",
  price: 10000,
  stock: 10,
  color: "sage",
};
async function call(
  path,
  { method = "GET", body, user = a, headers = {}, noCsrf = false } = {},
) {
  const response = await fetch(base + "/api" + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(user?.cookie ? { Cookie: user.cookie } : {}),
      ...(!noCsrf && user?.csrf ? { "X-CSRF-Token": user.csrf } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json();
  return {
    status: response.status,
    data,
    cookie: response.headers.get("set-cookie")?.split(";")[0],
    csrf: data.csrfToken,
  };
}
before(async () => {
  service = await createApp({
    databasePath: ":memory:",
    demoMode: false,
    registrationOpen: true,
    production: false,
    openaiKey: "",
    startWorker: false,
  });
  listener = service.app.listen(0, "127.0.0.1");
  await new Promise((resolve) => listener.once("listening", resolve));
  base = "http://127.0.0.1:" + listener.address().port;
  a = await call("/auth/register", {
    method: "POST",
    body: {
      name: "Cuenta A",
      storeName: "Tienda A",
      email: "seguridad-a@example.test",
      password: "SeguraCuentaA123",
    },
    user: null,
  });
  b = await call("/auth/register", {
    method: "POST",
    body: {
      name: "Cuenta B",
      storeName: "Tienda B",
      email: "seguridad-b@example.test",
      password: "SeguraCuentaB123",
    },
    user: null,
  });
  await call("/products", { method: "POST", body: p });
  await call("/products", {
    method: "POST",
    body: { ...p, stock: 90 },
    user: b,
  });
});
after(async () => {
  await new Promise((resolve) => listener.close(resolve));
  service.close();
});

test("las escrituras exigen un token CSRF de la sesión, aunque exista una cookie válida", async () => {
  assert.equal(
    (
      await call("/settings", {
        method: "PUT",
        body: { active: false },
        noCsrf: true,
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await call("/settings", {
        method: "PUT",
        body: { active: false },
        headers: { "X-CSRF-Token": b.csrf },
      })
    ).status,
    403,
  );
  assert.equal((await call("/me")).data.settings.active, true);
  assert.equal(
    (await call("/settings", { method: "PUT", body: { active: false } }))
      .status,
    200,
  );
  await call("/settings", { method: "PUT", body: { active: true } });
});
test("una importación fallida revierte todas sus filas; una actualización solo afecta a la tienda propietaria", async () => {
  const result = await call("/products/import", {
    method: "POST",
    body: { products: [{ ...p, sku: "ROLL-01" }, p] },
  });
  assert.equal(result.status, 409);
  assert.ok(!(await call("/products")).data.some((p) => p.sku === "ROLL-01"));
  const update = await call("/products/import", {
    method: "POST",
    body: { products: [{ ...p, stock: 4 }], updateExisting: true },
  });
  assert.equal(update.status, 201);
  assert.equal(update.data.updated, 1);
  assert.equal((await call("/products")).data[0].stock, 4);
  assert.equal((await call("/products", { user: b })).data[0].stock, 90);
});
test("las importaciones rechazan filas no válidas sin guardar las anteriores", async () => {
  const result = await call("/products/import", {
    method: "POST",
    body: {
      products: [
        { ...p, sku: "NEW-01" },
        { ...p, sku: "BAD-01", stock: -1 },
      ],
    },
  });
  assert.equal(result.status, 400);
  assert.ok(!(await call("/products")).data.some((p) => p.sku === "NEW-01"));
});
test("la búsqueda global no revela productos ni pedidos de otra tienda", async () => {
  await call("/products", {
    method: "POST",
    body: { ...p, name: "Solo visible para B", sku: "SECRETO-B" },
    user: b,
  });
  assert.equal((await call("/search?q=SECRETO-B")).data.products.length, 0);
  assert.equal(
    (await call("/search?q=SECRETO-B", { user: b })).data.products.length,
    1,
  );
  assert.equal(
    (await call("/search?q=" + encodeURIComponent("%' OR 1=1 --"))).data
      .products.length,
    0,
  );
});
test("el propietario puede revocar otra sesión sin afectar a cuentas ajenas ni exponer tokens", async () => {
  const login = await call("/auth/login", {
    method: "POST",
    body: { email: "seguridad-a@example.test", password: "SeguraCuentaA123" },
    user: null,
  });
  const list = (await call("/account/sessions")).data;
  assert.equal(list.length, 2);
  assert.equal(list.filter((s) => s.current).length, 1);
  assert.ok(!JSON.stringify(list).includes("token_hash"));
  const target = list.find((s) => !s.current);
  assert.equal(
    (
      await call("/account/sessions/" + target.id, {
        method: "DELETE",
        body: {},
        user: b,
      })
    ).status,
    404,
  );
  assert.equal(
    (
      await call("/account/sessions/" + target.id, {
        method: "DELETE",
        body: {},
      })
    ).status,
    200,
  );
  assert.equal((await call("/me", { user: login })).status, 401);
  assert.equal((await call("/me")).status, 200);
});
test("una sesión que lleva 24 horas inactiva deja de autorizar el acceso", async () => {
  const login = await call("/auth/login", {
    method: "POST",
    body: { email: "seguridad-a@example.test", password: "SeguraCuentaA123" },
    user: null,
  });
  const current = (await call("/account/sessions", { user: login })).data.find(
    (s) => s.current,
  );
  service.db
    .prepare("UPDATE sessions SET last_seen_at = ? WHERE id = ?")
    .run(new Date(Date.now() - 86400001).toISOString(), current.id);
  assert.equal((await call("/me", { user: login })).status, 401);
});
test("las contraseñas conservan sus espacios en lugar de modificarse silenciosamente", async () => {
  const registered = await call("/auth/register", {
    method: "POST",
    body: {
      name: "Espacios",
      storeName: "Tienda espacios",
      email: "espacios@example.test",
      password: " ClaveConEspacios123 ",
    },
    user: null,
  });
  assert.equal(registered.status, 201);
  assert.equal(
    (
      await call("/auth/login", {
        method: "POST",
        body: {
          email: "espacios@example.test",
          password: "ClaveConEspacios123",
        },
        user: null,
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await call("/auth/login", {
        method: "POST",
        body: {
          email: "espacios@example.test",
          password: " ClaveConEspacios123 ",
        },
        user: null,
      })
    ).status,
    200,
  );
});
test("la exportación no incluye claves, sesiones ni contraseñas", async () => {
  await call("/integrations/whatsapp", {
    method: "PUT",
    body: {
      phoneNumberId: "111222333444555",
      accessToken: "test_only_private_access_token",
      appSecret: "b".repeat(32),
      verifyToken: "test_only_verification_token",
    },
  });
  const result = await call("/account/export", { method: "POST", body: {} });
  assert.equal(result.status, 200);
  assert.equal(result.data.workspace.name, "Tienda A");
  const text = JSON.stringify(result.data);
  for (const key of [
    "password_hash",
    "encrypted_credentials",
    "token_hash",
    "test_only_private_access_token",
    "test_only_verification_token",
    "SECRETO-B",
  ])
    assert.ok(!text.includes(key));
});
test("cada respuesta HTML usa un nonce CSP distinto y las etiquetas de script tienen ese nonce", async () => {
  const first = await fetch(base + "/"),
    second = await fetch(base + "/");
  assert.equal(first.status, 200);
  const csp = first.headers.get("content-security-policy");
  const nonce = csp.match(/'nonce-([^']+)'/)[1];
  assert.ok(!second.headers.get("content-security-policy").includes(nonce));
  assert.ok(!csp.includes("script-src 'unsafe-inline'"));
  const html = await first.text();
  for (const script of html.matchAll(/<script\b[^>]*>/g))
    assert.ok(script[0].includes(`nonce="${nonce}"`));
  assert.equal(first.headers.get("cache-control"), "no-store");
  assert.ok(!csp.includes("upgrade-insecure-requests"));
});
test("la producción usa cookie __Host con Secure y permite una sola primera cuenta cuando se cierra el registro", async () => {
  const instance = await createApp({
    databasePath: ":memory:",
    key: randomBytes(32),
    baseUrl: "https://cerca.example",
    production: true,
    demoMode: false,
    registrationOpen: false,
    openaiKey: "",
    startWorker: false,
  });
  const server = instance.app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  try {
    const url =
      "http://127.0.0.1:" + server.address().port + "/api/auth/register";
    const result = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://cerca.example",
      },
      body: JSON.stringify({
        name: "Propietaria",
        storeName: "Producción",
        email: "owner-prod@example.test",
        password: "CuentaProduccion123",
      }),
    });
    assert.equal(result.status, 201);
    const cookie = result.headers.get("set-cookie");
    assert.match(cookie, /^__Host-cerca_session=/);
    assert.match(cookie, /Secure/);
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /Path=\//);
    assert.ok(!cookie.includes("Domain="));
    assert.equal(
      (
        await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        })
      ).status,
      403,
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
    instance.close();
  }
});

test("una pregunta frecuente nula se rechaza como dato inválido sin interrumpir el servidor", async () => {
  assert.equal(
    (await call("/settings", { method: "PUT", body: { faqs: [null] } })).status,
    400,
  );
  assert.equal((await call("/me")).status, 200);
});
