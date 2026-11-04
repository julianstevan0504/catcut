import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import sharp from "sharp";
import { createApp } from "../server/app.mjs";
import {
  defaultDesign,
  validateDesign,
  storefrontTheme,
  contrast,
  whatsappUrl,
  generatePage,
} from "../shared/storefront.ts";
async function fixture(t) {
  const dir = await mkdtemp(join(tmpdir(), "cerca-pages-")),
    service = await createApp({
      databasePath: ":memory:",
      mediaDirectory: dir,
      demoMode: false,
      registrationOpen: true,
      startWorker: false,
      openaiKey: "",
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
  async function req(path, { method = "GET", body, cookie } = {}) {
    const r = await fetch(base + "/api" + path, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(cookie
          ? { Cookie: cookie, "X-CSRF-Token": csrf.get(cookie) ?? "" }
          : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await r.json(),
      c = r.headers.get("set-cookie")?.split(";")[0];
    if (c && data.csrfToken) csrf.set(c, data.csrfToken);
    return { status: r.status, data, cookie: c };
  }
  async function register(email, name) {
    const r = await req("/auth/register", {
      method: "POST",
      body: { name, storeName: name, email, password: "PaginaSegura12345" },
    });
    assert.equal(r.status, 201);
    return { cookie: r.cookie, email };
  }
  const a = await register("a-page@example.test", "Espacio privado A"),
    b = await register("b-page@example.test", "Espacio privado B");
  async function product(owner = a) {
    return (
      await req("/products", {
        method: "POST",
        cookie: owner.cookie,
        body: {
          name: "Papas de la Casa",
          sku: "PAP-001",
          price: 14000,
          stock: 8,
          kind: "dish",
          ingredients: "Papa y sal",
          allergens: "Por confirmar con cocina",
        },
      })
    ).data;
  }
  async function draft(owner = a, patch = {}) {
    const v = (await req("/restaurant/page", { cookie: owner.cookie })).data;
    return req("/restaurant/page", {
      method: "PUT",
      cookie: owner.cookie,
      body: {
        revision: v.revision,
        draft: {
          ...v.draft,
          displayName: owner === a ? "Mateo Papa" : "Café Belén",
          city: "Bogotá",
          whatsappNumber: owner === a ? "+573001112233" : "+573004445566",
          ...patch,
        },
      },
    });
  }
  async function publish(owner = a, patch = {}) {
    const saved = await draft(owner, patch);
    assert.equal(saved.status, 200);
    const r = await req("/restaurant/page/publish", {
      method: "POST",
      cookie: owner.cookie,
      body: { revision: saved.data.revision },
    });
    assert.equal(r.status, 200);
    return r.data;
  }
  return { service, base, req, a, b, product, draft, publish };
}
test("el buscador público muestra solo restaurantes publicados y activos, sin datos privados", async (t) => {
  const c = await fixture(t);
  assert.equal((await c.req("/platform/overview")).status, 401);
  assert.equal(
    (
      await c.req("/platform/settings", {
        method: "PUT",
        body: { registrationOpen: true },
      })
    ).status,
    401,
  );
  await c.product(c.a);
  await c.product(c.b);
  assert.equal((await c.req("/public/restaurants")).data.total, 0);
  await c.publish(c.a, { slug: "mateo-papa", specialties: "Papas rellenas" });
  await c.publish(c.b, {
    slug: "cafe-belen",
    businessType: "cafeteria",
    cuisine: "Cafetería",
  });
  const all = await c.req("/public/restaurants");
  assert.equal(all.status, 200);
  assert.equal(all.data.total, 2);
  assert.doesNotMatch(
    JSON.stringify(all.data),
    /a-page@|b-page@|workspace_id|password|guest_token/,
  );
  const search = await c.req(
    "/public/restaurants?q=" + encodeURIComponent("MATEO PAPÁ"),
  );
  assert.equal(search.data.total, 1);
  assert.equal(search.data.restaurants[0].name, "Mateo Papa");
  assert.match(search.data.restaurants[0].publicUrl, /\/r\/mateo-papa$/);
  assert.equal((await c.req("/public/restaurants?q=cafe+belen")).data.total, 1);
  assert.equal((await c.req("/public/restaurants?q=%25")).data.total, 0);
  assert.equal(
    (await c.req("/public/restaurants?q=" + encodeURIComponent("' OR 1=1 --")))
      .data.total,
    0,
  );
  assert.equal(
    (await c.req("/public/restaurants?limit=1&page=2")).data.restaurants.length,
    1,
  );
  assert.equal(
    (await c.req("/public/restaurants?service=delivery")).data.total,
    0,
  );
  c.service.db
    .prepare("INSERT INTO business_states VALUES (?,?,?,?)")
    .run(
      c.service.db
        .prepare("SELECT id FROM workspaces WHERE name='Espacio privado B'")
        .get().id,
      "suspended",
      "Prueba",
      new Date().toISOString(),
    );
  assert.equal((await c.req("/public/restaurants")).data.total, 1);
  assert.equal((await c.req("/public/restaurants?limit=100000")).status, 400);
});
test("guardar el borrador no modifica la página publicada; publicar y retirar son acciones separadas", async (t) => {
  const c = await fixture(t);
  await c.product();
  const first = await c.publish(c.a, { slug: "mateo-papa" });
  const saved = await c.draft(c.a, {
    displayName: "Mateo Papa Nuevo",
    design: {
      ...first.draft.design,
      heroTitle: "Una portada nueva",
      primaryColor: "#663399",
      fontSize: 20,
      menuLayout: "list",
      sections: ["contact", "menu", "story"],
    },
  });
  assert.equal(saved.status, 200);
  const live = (await c.req("/public/restaurants/mateo-papa")).data;
  assert.equal(live.name, "Mateo Papa");
  assert.notEqual(live.profile.design.heroTitle, "Una portada nueva");
  await c.req("/restaurant/page/publish", {
    method: "POST",
    cookie: c.a.cookie,
    body: { revision: saved.data.revision },
  });
  const next = (await c.req("/public/restaurants/mateo-papa")).data;
  assert.equal(next.name, "Mateo Papa Nuevo");
  assert.equal(next.profile.design.fontSize, 20);
  assert.deepEqual(next.profile.design.sections, ["contact", "menu", "story"]);
  assert.equal(
    (
      await c.req("/restaurant/page/unpublish", {
        method: "POST",
        cookie: c.b.cookie,
        body: {},
      })
    ).status,
    200,
  );
  assert.equal((await c.req("/public/restaurants/mateo-papa")).status, 200);
  await c.req("/restaurant/page/unpublish", {
    method: "POST",
    cookie: c.a.cookie,
    body: {},
  });
  assert.equal((await c.req("/public/restaurants/mateo-papa")).status, 404);
  assert.equal((await c.req("/public/restaurants")).data.total, 0);
});
test("los borradores requieren sesión, rechazan campos peligrosos y detectan ediciones simultáneas", async (t) => {
  const c = await fixture(t);
  assert.equal((await c.req("/restaurant/page")).status, 401);
  const v = (await c.req("/restaurant/page", { cookie: c.a.cookie })).data;
  const body = {
    revision: v.revision,
    draft: {
      ...v.draft,
      displayName: "Mateo Papa",
      whatsappNumber: "+573001112233",
    },
  };
  const results = await Promise.all([
    c.req("/restaurant/page", { method: "PUT", cookie: c.a.cookie, body }),
    c.req("/restaurant/page", { method: "PUT", cookie: c.a.cookie, body }),
  ]);
  assert.deepEqual(results.map((x) => x.status).sort(), [200, 409]);
  assert.notEqual(
    (await c.req("/restaurant/page", { cookie: c.b.cookie })).data.draft
      .displayName,
    "Mateo Papa",
  );
  const fresh = (await c.req("/restaurant/page", { cookie: c.a.cookie })).data;
  for (const patch of [
    { workspace_id: "otro" },
    {
      design: {
        ...fresh.draft.design,
        primaryColor: "url(javascript:alert(1))",
      },
    },
    { design: { ...fresh.draft.design, css: "body{display:none}" } },
    { design: { ...fresh.draft.design, fontSize: 1 } },
    {
      design: { ...fresh.draft.design, sections: ["menu", "menu", "contact"] },
    },
    { whatsappNumber: "javascript:alert(1)" },
  ])
    assert.equal(
      (
        await c.req("/restaurant/page", {
          method: "PUT",
          cookie: c.a.cookie,
          body: {
            revision: fresh.revision,
            draft: { ...fresh.draft, ...patch },
          },
        })
      ).status,
      400,
    );
  assert.equal(
    (
      await c.req("/restaurant/page/publish", {
        method: "POST",
        cookie: c.a.cookie,
        body: { revision: fresh.revision },
      })
    ).status,
    400,
  );
  await c.product();
  assert.equal(
    (
      await c.req("/restaurant/page/publish", {
        method: "POST",
        cookie: c.a.cookie,
        body: { revision: 0 },
      })
    ).status,
    409,
  );
});
test("el pedido de Andrés llega al negocio correcto y su seguimiento refleja el estado de cocina", async (t) => {
  const c = await fixture(t);
  await c.product();
  const product = (await c.req("/products", { cookie: c.a.cookie })).data[0];
  const p = (await c.req("/restaurant", { cookie: c.a.cookie })).data;
  await c.req("/restaurant", {
    method: "PUT",
    cookie: c.a.cookie,
    body: {
      ...p,
      services: { dineIn: true, pickup: true, delivery: true },
      deliveryZones: [{ id: "centro", name: "Centro", fee: 5000 }],
    },
  });
  const page = await c.publish(c.a, { slug: "mateo-papa" });
  const order = await c.req("/public/restaurants/mateo-papa/orders", {
    method: "POST",
    body: {
      requestId: randomUUID(),
      items: [{ productId: product.id, quantity: 2 }],
      fulfillment: "delivery",
      deliveryZone: "centro",
      address: "Calle 10 número 20-30, apartamento 2",
      name: "Andrés",
      phone: "+573001112233",
      paymentMethod: "cash",
      confirm: true,
      expectedTotal: 33000,
    },
  });
  assert.equal(order.status, 201);
  const notices = (
    await c.req("/restaurant/notifications", { cookie: c.a.cookie })
  ).data;
  assert.equal(notices.unread, 1);
  assert.equal(notices.items[0].customer, "Andrés");
  assert.match(notices.items[0].delivery_address, /apartamento 2/);
  assert.match(notices.items[0].items, /Papas/);
  assert.equal(
    (await c.req("/restaurant/notifications", { cookie: c.b.cookie })).data
      .unread,
    0,
  );
  assert.equal(
    (
      await c.req("/restaurant/notifications/read", {
        method: "POST",
        cookie: c.b.cookie,
        body: { ids: [order.data.id] },
      })
    ).status,
    404,
  );
  assert.equal(
    (
      await c.req("/kitchen/" + order.data.id + "/status", {
        method: "PUT",
        cookie: c.a.cookie,
        body: { status: "preparing" },
      })
    ).status,
    200,
  );
  const tracking = (await c.req("/public/orders/" + order.data.guestToken))
    .data;
  assert.equal(tracking.status, "preparing");
  assert.equal(
    tracking.details.delivery_address,
    "Calle 10 número 20-30, apartamento 2",
  );
  await c.req("/restaurant/notifications/read", {
    method: "POST",
    cookie: c.a.cookie,
    body: { ids: [order.data.id] },
  });
  assert.equal(
    (await c.req("/restaurant/notifications", { cookie: c.a.cookie })).data
      .unread,
    0,
  );
  await c.req("/restaurant/page/unpublish", {
    method: "POST",
    cookie: c.a.cookie,
    body: {},
  });
  assert.equal(
    (await c.req("/public/orders/" + order.data.guestToken)).status,
    200,
  );
  assert.equal(page.profile.slug, "mateo-papa");
});
test("una foto solo usada en un borrador es privada y no se puede borrar mientras está adjunta", async (t) => {
  const c = await fixture(t);
  await c.product();
  await c.publish(c.a, { slug: "mateo-papa" });
  const buffer = await sharp({
    create: {
      width: 30,
      height: 30,
      channels: 3,
      background: { r: 180, g: 90, b: 50 },
    },
  })
    .png()
    .toBuffer();
  const upload = await c.req("/media/images", {
    method: "POST",
    cookie: c.a.cookie,
    body: { data: "data:image/png;base64," + buffer.toString("base64") },
  });
  assert.equal(upload.status, 201);
  const id = upload.data.imageId;
  const saved = await c.draft(c.a, { coverImageId: id });
  assert.equal(saved.status, 200);
  assert.equal((await fetch(c.base + "/media/" + id)).status, 404);
  assert.equal(
    (await fetch(c.base + "/media/" + id, { headers: { Cookie: c.a.cookie } }))
      .status,
    200,
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
  await c.req("/restaurant/page/publish", {
    method: "POST",
    cookie: c.a.cookie,
    body: { revision: saved.data.revision },
  });
  assert.equal((await fetch(c.base + "/media/" + id)).status, 200);
});
test("cada página pública entrega metadatos propios escapados y los borradores devuelven 404", async (t) => {
  const c = await fixture(t);
  await c.product();
  await c.publish(c.a, {
    slug: "mateo-papa",
    displayName: 'Mateo <script>alert("hola")</script>',
    welcome: 'Cocina & papas "de la casa"',
  });
  const r = await fetch(c.base + "/r/mateo-papa");
  assert.equal(r.status, 200);
  const html = await r.text();
  assert.match(html, /<title>Mateo &lt;script&gt;/);
  assert.match(html, /rel="canonical"/);
  assert.doesNotMatch(html, /<script>alert\("hola"\)<\/script>/);
  assert.equal((await fetch(c.base + "/r/no-publicado")).status, 404);
  await c.req("/restaurant/page/unpublish", {
    method: "POST",
    cookie: c.a.cookie,
    body: {},
  });
  assert.equal((await fetch(c.base + "/r/mateo-papa")).status, 404);
});
test("el diseño conserva contraste y solo admite opciones acotadas; los enlaces WhatsApp usan el número del negocio", () => {
  for (const backgroundColor of [
    "#ffffff",
    "#111111",
    "#fff0ba",
    "#335577",
    "#777777",
    "#767676",
    "#888888",
    "#6e7777",
    "#aaaaaa",
  ])
    for (const primaryColor of [
      "#ffffbb",
      "#111111",
      "#ff6677",
      "#1122ff",
      "#777777",
      "#888888",
    ]) {
      const d = validateDesign({
          ...defaultDesign(),
          backgroundColor,
          primaryColor,
          fontSize: 22,
        }),
        theme = storefrontTheme(d);
      assert.ok(contrast(theme["--menu-ink"], backgroundColor) >= 4.5);
      assert.ok(contrast(theme["--menu-accent"], backgroundColor) >= 4.5);
      assert.ok(contrast(theme["--menu-button-text"], primaryColor) >= 4.5);
      for (const text of ["--menu-ink", "--menu-muted", "--menu-accent"])
        for (const surface of [
          "--menu-bg",
          "--menu-wash",
          "--menu-pill",
          "--menu-card",
        ])
          assert.ok(
            contrast(theme[text], theme[surface]) >= 4.5,
            `${text} sobre ${surface}: ${primaryColor}/${backgroundColor}`,
          );
    }
  assert.match(
    whatsappUrl("+573001112233", "Mateo Papa"),
    /^https:\/\/wa\.me\/573001112233\?text=/,
  );
  assert.equal(whatsappUrl("javascript:alert(1)", "Mateo Papa"), "");
  assert.throws(
    () => validateDesign(JSON.parse('{"constructor":"invalid"}')),
    /permitido/,
  );
  const result = generatePage({
    displayName: "Mateo Papa",
    businessType: "pizzeria",
    city: "Bogotá",
    specialties: "Pizza de papa",
    description: "Una propuesta de prueba.",
    accent: "terracotta",
  });
  assert.match(result.design.heroTitle, /pizza/);
  assert.equal(result.design.about, "Una propuesta de prueba.");
  assert.ok(!("products" in result));
});
