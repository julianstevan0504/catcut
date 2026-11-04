import { test, expect } from "@playwright/test";

async function restaurant(page, overrides = {}) {
  const stamp = Date.now() + "-" + Math.random().toString(16).slice(2, 7);
  const name = "El Patio " + stamp;
  const registration = await page.request.post("/api/auth/register", {
    data: {
      name: "Camila",
      storeName: name,
      email: "review-" + stamp + "@example.test",
      password: "RestauranteSeguro12345",
    },
  });
  expect(registration.status()).toBe(201);
  const me = await (await page.request.get("/api/me")).json();
  const headers = { "X-CSRF-Token": me.csrfToken };
  const original = await (await page.request.get("/api/restaurant")).json();
  const profile = {
    ...original,
    slug: "patio-" + stamp,
    displayName: name,
    city: "Bogotá",
    whatsappNumber: "+573001112233",
    publicEnabled: true,
    reservationsEnabled: true,
    ...overrides,
  };
  expect(
    (
      await page.request.put("/api/restaurant", { headers, data: profile })
    ).status(),
  ).toBe(200);
  const response = await page.request.post("/api/products", {
    headers,
    data: {
      name: "Café de la casa",
      sku: "CAFE-01",
      price: 6000,
      stock: 3,
      kind: "drink",
      category: "Bebidas",
      description: "Café de origen.",
      ingredients: "Café y agua",
      allergens: "Sin información de trazas",
    },
  });
  expect(response.status()).toBe(201);
  const { id } = await response.json();
  const products = await (await page.request.get("/api/products")).json();
  return {
    profile,
    headers,
    product: products.find((product) => product.id === id),
    name,
  };
}

test("una consulta lenta no se solapa con otro sondeo del mismo recurso", async ({
  page,
}) => {
  await restaurant(page);
  await page.clock.install();
  let calls = 0,
    counting = false,
    blocking = false,
    release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  await page.route("**/api/restaurant/notifications", async (route) => {
    if (counting) calls++;
    if (blocking) await gate;
    await route.fulfill({ json: { items: [], unread: 0 } });
  });
  try {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "Hoy se cocina algo bueno." }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", {
        name: "Ver notificaciones de pedidos",
        exact: true,
      }),
    ).toBeVisible();
    await page
      .getByRole("button", {
        name: "Ver notificaciones de pedidos",
        exact: true,
      })
      .click();
    await expect(
      page.getByText("Los pedidos nuevos aparecerán aquí y en tu cocina."),
    ).toBeVisible();
    counting = true;
    blocking = true;
    await page.clock.runFor(5100);
    await expect.poll(() => calls).toBe(1);
    await page.clock.runFor(6000);
    expect(calls).toBe(1);
    const completed = page.waitForResponse((response) =>
      response.url().endsWith("/api/restaurant/notifications"),
    );
    blocking = false;
    release();
    await completed;
    await page.waitForTimeout(50);
    await page.clock.runFor(5100);
    await expect.poll(() => calls).toBe(2);
  } finally {
    release();
  }
});

test("un error de disponibilidad se puede reintentar y una reserva individual empieza con una persona", async ({
  page,
}) => {
  const c = await restaurant(page, { maxParty: 1 });
  let failed = true;
  await page.route("**/api/public/restaurants/*/availability?*", (route) =>
    route.fulfill(
      failed
        ? {
            status: 503,
            json: {
              error:
                "La consulta de disponibilidad no respondió. Inténtalo de nuevo.",
            },
          }
        : { json: { slots: [{ time: "12:30", remaining: 1 }] } },
    ),
  );
  await page.goto("/r/" + c.profile.slug);
  await page
    .getByRole("button", { name: "Reservar mesa", exact: true })
    .click();
  await expect(page.getByLabel("Número de personas")).toHaveValue("1");
  await expect(
    page.getByText("No pudimos consultar los horarios.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(/No hay horarios disponibles para este día/),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Solicitar reserva", exact: true }),
  ).toBeDisabled();
  await expect(page.getByLabel("Fecha de la reserva")).toHaveAttribute(
    "max",
    /^\d{4}-\d{2}-\d{2}$/,
  );
  failed = false;
  await page
    .getByRole("button", { name: "Volver a consultar horarios", exact: true })
    .click();
  await page.getByRole("button", { name: "12:30", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Solicitar reserva", exact: true }),
  ).toBeEnabled();
});

test("un resumen con error no inventa ceros y el menú móvil conserva el foco", async ({
  page,
}) => {
  await restaurant(page, { publicEnabled: false });
  await page.setViewportSize({ width: 390, height: 844 });
  let failed = true;
  await page.route("**/api/kitchen", (route) =>
    failed
      ? route.fulfill({
          status: 503,
          json: { error: "No se pudo consultar la cocina de prueba." },
        })
      : route.continue(),
  );
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText(
    "No se pudo consultar la cocina de prueba.",
  );
  await expect(page.locator(".restaurant-metric")).toHaveCount(0);
  failed = false;
  await page
    .getByRole("button", { name: "Volver a intentar", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Hoy se cocina algo bueno." }),
  ).toBeVisible();
  await expect(page.getByLabel("Estado de tu página pública")).toContainText(
    "Página sin publicar",
  );
  await page.getByRole("button", { name: "Abrir menú", exact: true }).click();
  const menu = page.getByRole("dialog", {
    name: "Menú del restaurante",
    exact: true,
  });
  await expect(menu).toBeVisible();
  await expect(page.locator("body")).toHaveCSS("overflow", "hidden");
  for (let i = 0; i < 24; i++) {
    await page.keyboard.press(i % 4 === 0 ? "Shift+Tab" : "Tab");
    expect(
      await page.evaluate(() =>
        Boolean(document.activeElement?.closest(".sidebar")),
      ),
    ).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Abrir menú", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  expect(
    await page.evaluate(() =>
      Boolean(document.activeElement?.closest(".sidebar")),
    ),
  ).toBe(false);
  await page
    .getByRole("button", { name: "Personalizar mi página", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Su sabor. Tu manera de contarlo." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Abrir menú", exact: true }).click();
  await page.getByRole("button", { name: /Una mano para empezar/ }).click();
  await expect(page.locator(".modal")).toBeVisible();
  await expect(menu).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(page.locator(".modal")).toHaveCount(0);
  await expect(page.locator("body")).not.toHaveCSS("overflow", "hidden");
  await page.getByRole("button", { name: "Abrir menú", exact: true }).click();
  await page
    .getByRole("button", { name: "Cerrar sesión", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Abrir menú", exact: true }),
  ).toHaveCount(0);
  await expect(page.locator("body")).not.toHaveCSS("overflow", "hidden");
  expect((await page.request.get("/api/me")).status()).toBe(401);
});

test("leer avisos no anuncia pedidos antiguos; se pueden apagar avisos y un navegador incompatible no rompe el panel", async ({
  page,
}) => {
  await restaurant(page);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    function UnsupportedNotification() {
      throw new TypeError(
        "Este navegador requiere ServiceWorkerRegistration.showNotification",
      );
    }
    UnsupportedNotification.permission = "granted";
    UnsupportedNotification.requestPermission = async () => "granted";
    Object.defineProperty(window, "Notification", {
      configurable: true,
      value: UnsupportedNotification,
    });
  });
  await page.clock.install();
  const now = Date.now();
  const order = (id, time) => ({
    id,
    code: id,
    customer: "Ana",
    items: "Un café",
    created_at: new Date(time).toISOString(),
    total: 6000,
    phone: "+573001112233",
    fulfillment: "pickup",
    delivery_address: "",
  });
  let feed = Array.from({ length: 30 }, (_, i) =>
    order("ORD-" + i, now - i * 1000),
  );
  const older = order("ORD-ANTIGUO", now - 60000);
  await page.route("**/api/restaurant/notifications", (route) =>
    route.fulfill({ json: { items: feed, unread: feed.length } }),
  );
  await page.route("**/api/restaurant/notifications/read", (route) => {
    feed = [older];
    return route.fulfill({ json: { ok: true } });
  });
  await page.goto("/");
  const bell = page.getByRole("button", {
    name: /Ver notificaciones de pedidos/,
  });
  await bell.click();
  await page
    .getByRole("button", {
      name: "Marcar estos avisos como leídos",
      exact: true,
    })
    .click();
  await expect(
    page.getByText("ORD-ANTIGUO · Ana", { exact: true }),
  ).toBeVisible();
  await page.waitForTimeout(100);
  await expect(page.getByText(/^Nuevo pedido /)).toHaveCount(0);
  await page
    .getByRole("button", {
      name: "Activar avisos en este dispositivo",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Desactivar avisos de este dispositivo",
      exact: true,
    }),
  ).toHaveAttribute("aria-pressed", "true");
  await page
    .getByRole("button", {
      name: "Desactivar avisos de este dispositivo",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Activar avisos en este dispositivo",
      exact: true,
    }),
  ).toHaveAttribute("aria-pressed", "false");
  await page
    .getByRole("button", {
      name: "Activar avisos en este dispositivo",
      exact: true,
    })
    .click();
  feed = [order("ORD-NUEVO", now + 20000), older];
  await page.clock.runFor(5100);
  await expect(page.getByText(/^Nuevo pedido ORD-NUEVO/)).toBeVisible();
  await expect(
    page.getByText(/Este navegador no admite estos avisos del dispositivo/),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Hoy se cocina algo bueno." }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("la búsqueda ignora tildes y el carrito ajusta el stock antes de reintentar un pedido", async ({
  page,
}) => {
  const c = await restaurant(page);
  await page.goto("/r/" + c.profile.slug);
  await page.getByLabel("Buscar en el menú").fill("cafe");
  await expect(
    page.getByRole("heading", { name: "Café de la casa", exact: true }),
  ).toBeVisible();
  const add = page.getByRole("button", {
    name: /^Agregar Café de la casa al pedido/,
  });
  await add.click();
  await add.click();
  await page.getByRole("button", { name: "Mi pedido 2", exact: true }).click();
  await page.getByLabel("Tu nombre", { exact: true }).fill("Andrés");
  await page.getByLabel("Tu teléfono", { exact: true }).fill("+573001112233");
  await page
    .getByLabel("Revisé los productos, cantidades y total de mi pedido.")
    .check();
  expect(
    (
      await page.request.put("/api/products/" + c.product.id, {
        headers: c.headers,
        data: { ...c.product, stock: 1 },
      })
    ).status(),
  ).toBe(200);
  await page.getByRole("button", { name: /Confirmar pedido ·/ }).click();
  await expect(
    page.getByText(/La carta cambió. Ajustamos tu pedido/),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Agregar una unidad de Café de la casa",
      exact: true,
    }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: /Confirmar pedido ·/ }),
  ).toContainText("6.000");
  await page.getByRole("button", { name: /Confirmar pedido ·/ }).click();
  await expect(
    page.getByRole("heading", {
      name: "Tu pedido está en el restaurante.",
      exact: true,
    }),
  ).toBeVisible();
  const product = await (await page.request.get("/api/products")).json();
  expect(product.find((item) => item.id === c.product.id).stock).toBe(0);
});

test("el buscador conserva nombre, ciudad y servicio al compartir, recargar y volver de un restaurante", async ({
  page,
}) => {
  const c = await restaurant(page);
  const query = new URLSearchParams({
    explore: "restaurants",
    q: c.name,
    city: "Bogotá",
    service: "pickup",
  });
  await page.goto("/?" + query);
  const check = async () => {
    await expect(
      page.getByLabel("Buscar un restaurante", { exact: true }),
    ).toHaveValue(c.name);
    await expect(
      page.getByRole("combobox", { name: "Ciudad", exact: true }),
    ).toHaveValue("Bogotá");
    await expect(
      page.getByRole("combobox", { name: "¿Qué necesitas?", exact: true }),
    ).toHaveValue("pickup");
    await expect(
      page.locator(".directory-card").filter({ hasText: c.name }),
    ).toBeVisible();
  };
  await check();
  await page.reload();
  await check();
  await page
    .locator(".directory-card")
    .filter({ hasText: c.name })
    .getByRole("link")
    .click();
  await expect(page.locator(".public-restaurant-brand strong")).toHaveText(
    c.name,
  );
  await page.goBack();
  await check();
});

test("los enlaces de regreso conservan la demo y la recuperación vuelve al ingreso real", async ({
  page,
}) => {
  await page.route("**/api/**", (route) => route.abort());
  await page.goto("/Cerca.html?restaurant=no-existe");
  await expect(
    page.getByRole("heading", { name: "El restaurante no está disponible." }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Ir a Cerca", exact: true }),
  ).toHaveAttribute("href", "/Cerca.html?explore=restaurants");
  await page.getByRole("link", { name: "Ir a Cerca", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "¿Dónde comemos algo bueno?" }),
  ).toBeVisible();
  await page.unroute("**/api/**");
  await page.goto("/?recover=code");
  await expect(
    page.getByRole("link", { name: "Volver al ingreso", exact: true }),
  ).toHaveAttribute("href", "/#login");
  await page
    .getByRole("link", { name: "Volver al ingreso", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Qué bueno tenerte de vuelta." }),
  ).toBeVisible();
});
