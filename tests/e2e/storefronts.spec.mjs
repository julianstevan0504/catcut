import { test, expect } from "@playwright/test";
async function owner(
  page,
  { published = false, delivery = false, name = "Mateo Papa" } = {},
) {
  const stamp = Date.now() + "-" + Math.random().toString(16).slice(2, 7),
    email = "public-page-" + stamp + "@example.test",
    password = "PaginaPublica12345";
  const registration = await page.request.post("/api/auth/register", {
    data: { name: "Propietario", storeName: name, email, password },
  });
  expect(registration.status()).toBe(201);
  const me = await (await page.request.get("/api/me")).json(),
    headers = { "X-CSRF-Token": me.csrfToken };
  const p = await (await page.request.get("/api/restaurant")).json(),
    profile = {
      ...p,
      slug: "mateo-papa-" + stamp,
      displayName: name,
      city: "Bogotá",
      whatsappNumber: "+573001112233",
      phone: "+573004445566",
      publicEnabled: published,
      services: { dineIn: true, pickup: true, delivery },
      deliveryZones: delivery
        ? [{ id: "centro", name: "Centro", fee: 5000 }]
        : [],
    };
  expect(
    (
      await page.request.put("/api/restaurant", { headers, data: profile })
    ).ok(),
  ).toBe(true);
  expect(
    (
      await page.request.post("/api/products", {
        headers,
        data: {
          name: "Papas de la Casa",
          sku: "PAP-001",
          price: 14000,
          stock: 8,
          kind: "dish",
          ingredients: "Papa y sal",
          allergens: "Por confirmar con cocina",
          category: "Papas",
        },
      })
    ).status(),
  ).toBe(201);
  return { email, password, profile, headers };
}
test("el dueño genera, personaliza y publica su página; el cliente la encuentra y ve sus contactos", async ({
  page,
}) => {
  test.setTimeout(60000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const c = await owner(page);
  await page.goto("/");
  await page
    .getByRole("button", { name: "Mi página pública", exact: true })
    .click();
  await page.getByLabel("Nombre que verán los clientes").fill("Mateo Papa");
  await page
    .getByLabel("¿Qué tipo de negocio tienes?")
    .selectOption("hamburgueseria");
  await page.getByLabel("¿En qué ciudad estás?").fill("Bogotá");
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page
    .getByLabel("¿Cuáles son tus especialidades?")
    .fill("Papas y hamburguesas");
  await page
    .getByLabel("Cuéntanos sobre tu propuesta")
    .fill("Un restaurante de barrio para compartir una buena comida.");
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page
    .getByRole("button", { name: "Generar mi página", exact: true })
    .click();
  await page.getByLabel("Color principal de la página").fill("#653824");
  await page.getByLabel("Color de fondo de la página").fill("#fff6e4");
  await page.getByLabel("Tipografía").selectOption("serif");
  await page.getByLabel("Tamaño de letra de la página").focus();
  await page.getByLabel("Tamaño de letra de la página").press("ArrowRight");
  await page.getByLabel("Tamaño de letra de la página").press("ArrowRight");
  await page.getByLabel("Distribución de la carta").selectOption("list");
  await page.getByRole("button", { name: "Menú y fotos", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Agregar producto", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Mi página pública", exact: true })
    .click();
  await page.getByRole("button", { name: "Posiciones", exact: true }).click();
  await page
    .getByRole("button", {
      name: "Subir Historia del restaurante",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "Guardar borrador", exact: true })
    .click();
  await expect(
    page.getByText("Borrador guardado · pendiente de publicar", {
      exact: true,
    }),
  ).toBeVisible();
  const hidden = await (
    await page.request.get("/api/public/restaurants?q=Mateo+Papa")
  ).json();
  expect(hidden.restaurants.some((x) => x.slug === c.profile.slug)).toBe(false);
  await page
    .getByRole("button", { name: "Publicar mi página", exact: true })
    .first()
    .click();
  await expect(
    page.getByText("Página publicada", { exact: true }),
  ).toBeVisible();
  await page.goto("/?explore=restaurants");
  await page
    .getByLabel("Buscar un restaurante", { exact: true })
    .fill("Mateo Papa");
  const card = page
    .locator(".directory-card")
    .filter({ hasText: "Mateo Papa" })
    .first();
  await expect(card).toBeVisible();
  await card.getByRole("link").click();
  await expect(page.locator(".public-restaurant-brand strong")).toHaveText(
    "Mateo Papa",
  );
  await expect(
    page.locator(".public-menu-header").getByRole("link", { name: /WhatsApp/ }),
  ).toHaveAttribute("href", /^https:\/\/wa\.me\/573001112233\?text=/);
  await expect(
    page
      .locator(".public-menu-header")
      .getByRole("link", { name: "Llamar al restaurante", exact: true }),
  ).toHaveAttribute("href", "tel:+573004445566");
  await page
    .getByRole("button", { name: "Llamar por WhatsApp", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    "pulsa el icono de teléfono",
  );
  await expect(
    page
      .getByRole("dialog")
      .getByRole("link", { name: /Abrir WhatsApp para llamar/ }),
  ).toHaveAttribute("href", /^https:\/\/wa\.me\/573001112233/);
  await page
    .getByRole("button", { name: "Cerrar ventana", exact: true })
    .click();
  expect(
    await page
      .locator(".custom-storefront")
      .evaluate((e) =>
        getComputedStyle(e).getPropertyValue("--store-font-size").trim(),
      ),
  ).toBe("18px");
  await expect(page.locator(".public-restaurant")).toHaveClass(/menu-list/);
  expect(
    await page
      .locator(".public-storefront-sections")
      .evaluate(
        (e) => getComputedStyle(e.querySelector(".storefront-story")).order,
      ),
  ).toBe("0");
  await page.screenshot({
    path: "test-results/v5-public-page.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "test-results/v5-public-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});
test("Andrés pide a domicilio, el dueño recibe el aviso y el cliente ve que su pedido está en cocina", async ({
  page,
  browser,
}) => {
  const c = await owner(page, {
    published: true,
    delivery: true,
    name: "Mateo Papa Pedidos",
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Cocina", exact: true }).click();
  await page
    .getByRole("button", { name: /Ver notificaciones de pedidos/ })
    .waitFor();
  const guestContext = await browser.newContext({
      baseURL: "http://127.0.0.1:5173",
    }),
    guest = await guestContext.newPage();
  try {
    await guest.goto("/r/" + c.profile.slug);
    await guest
      .getByRole("button", {
        name: "Agregar Papas de la Casa al pedido",
        exact: true,
      })
      .click();
    await guest.getByRole("button", { name: /Mi pedido/ }).click();
    const form = guest.getByRole("dialog");
    await form.getByLabel("¿Cómo quieres tu pedido?").selectOption("delivery");
    await form.getByLabel("Tu nombre", { exact: true }).fill("Andrés");
    await form.getByLabel("Tu teléfono", { exact: true }).fill("+573001112233");
    await form
      .getByLabel("Dirección de entrega")
      .fill("Calle 10 número 20-30, apartamento 2");
    await form.getByRole("checkbox").check();
    await form.getByRole("button", { name: /Confirmar pedido/ }).click();
    await guest.getByRole("link", { name: /Ver seguimiento/ }).click();
    await expect(
      guest.locator(".guest-tracking-card .restaurant-state"),
    ).toHaveText("Confirmado");
    await expect(
      page.getByRole("button", {
        name: /Ver notificaciones de pedidos, 1 sin leer/,
      }),
    ).toBeVisible({ timeout: 15000 });
    await page
      .getByRole("button", { name: /Ver notificaciones de pedidos/ })
      .click();
    const notices = page.getByRole("region", { name: "Avisos de pedidos" });
    await expect(notices).toContainText("Andrés");
    await expect(notices).toContainText("apartamento 2");
    await notices.getByRole("button", { name: /Andrés/ }).click();
    await expect(page.locator(".kitchen-ticket")).toContainText("Andrés");
    await expect(page.locator(".kitchen-ticket")).toContainText(
      "apartamento 2",
    );
    await page
      .getByRole("button", { name: "Comenzar preparación", exact: true })
      .click();
    await expect(
      guest.locator(".guest-tracking-card .restaurant-state"),
    ).toHaveText("En cocina", { timeout: 12000 });
    await expect(guest.getByRole("status")).toContainText("ya está en cocina");
    await expect(guest.locator('[aria-current="step"]')).toContainText(
      "En cocina",
    );
  } finally {
    await guestContext.close();
  }
});
test("el acceso del dueño está visible y /admin no concede permisos por visitar la dirección", async ({
  page,
}) => {
  await page.goto("/?explore=restaurants");
  await page
    .getByRole("link", { name: "Soy el dueño de la plataforma", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Acceso del dueño de la plataforma." }),
  ).toBeVisible();
  expect((await page.request.get("/api/platform/overview")).status()).toBe(401);
  const c = await owner(page, { name: "Cuenta sin privilegios" });
  await page.goto("/admin");
  await expect(
    page.getByRole("heading", { name: "Tu centro de administración." }),
  ).toBeVisible();
  await expect(
    page.getByText("proyecto/data/administracion-clave.txt", { exact: true }),
  ).toBeVisible();
  expect((await page.request.get("/api/platform/overview")).status()).toBe(403);
  expect(c.email).toContain("@example.test");
});
test("la demo conserva el diseño público sin necesitar una API", async ({
  page,
}) => {
  const calls = [];
  await page.route("**/api/**", (route) => {
    calls.push(route.request().url());
    return route.abort();
  });
  await page.goto("/Cerca.html");
  await page
    .getByRole("button", { name: "Mi página pública", exact: true })
    .click();
  await page.getByRole("button", { name: "Diseño", exact: true }).click();
  await page.getByLabel("Color principal de la página").fill("#653824");
  await page
    .getByRole("button", { name: "Guardar borrador", exact: true })
    .click();
  await page.reload();
  await page.getByRole("button", { name: "Diseño", exact: true }).click();
  await expect(page.getByLabel("Color principal de la página")).toHaveValue(
    "#653824",
  );
  expect(calls).toEqual([]);
});
