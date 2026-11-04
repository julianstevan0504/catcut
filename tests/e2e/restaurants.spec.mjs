import { test, expect } from "@playwright/test";
import sharp from "sharp";
const password = "RestauranteSeguro12345";
test("el dueño activa su panel privado y atiende una solicitud de soporte", async ({
  page,
}) => {
  const c = await owner(page);
  const ticket = await page.request.post("/api/support/tickets", {
    headers: c.headers,
    data: {
      subject: "Consulta de prueba para administración",
      category: "orders",
      text: "Necesito ayuda con una comanda.",
    },
  });
  expect(ticket.status()).toBe(201);
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Administración", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Configuración", exact: true })
    .click();
  await page.getByRole("button", { name: /Datos y seguridad/ }).click();
  await page
    .getByText("Activar administración de la plataforma", { exact: true })
    .click();
  await page
    .getByLabel("Clave de activación de la plataforma")
    .fill("test_only_platform_activation_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
  await page.getByLabel("Tu contraseña actual", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Activar administración", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Administración", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Muchos restaurantes. Un buen sistema.",
    }),
  ).toBeVisible();
  await expect(
    page.getByText("Negocios registrados", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("main")
    .getByRole("button", { name: "Soporte técnico", exact: true })
    .click();
  await page
    .getByText("Consulta de prueba para administración", { exact: true })
    .click();
  await page
    .getByLabel("Respuesta de soporte")
    .fill("Revisamos tu comanda de prueba. Puedes continuar.");
  await page
    .getByRole("button", { name: "Enviar mensaje", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    "Revisamos tu comanda de prueba.",
  );
});
async function owner(page) {
  const email = `restaurante-${Date.now()}-${Math.random().toString(16).slice(2)}@example.test`;
  const r = await page.request.post("/api/auth/register", {
    data: { name: "Mariana", storeName: "La Mesa de Mariana", email, password },
  });
  expect(r.status()).toBe(201);
  const account = await r.json();
  const me = await (await page.request.get("/api/me")).json();
  const headers = { "X-CSRF-Token": me.csrfToken };
  const p = await (await page.request.get("/api/restaurant")).json();
  const profile = {
    ...p,
    slug: `mesa-${Date.now()}`,
    publicEnabled: true,
    reservationsEnabled: true,
  };
  expect(
    (
      await page.request.put("/api/restaurant", { headers, data: profile })
    ).ok(),
  ).toBe(true);
  const product = await page.request.post("/api/products", {
    headers,
    data: {
      name: "Arepa de la Huerta",
      sku: "AREPA-001",
      price: 12000,
      stock: 6,
      kind: "dish",
      category: "Platos",
      description: "Una arepa recién hecha.",
      ingredients: "Maíz y aguacate",
      allergens: "Posibles trazas de leche",
    },
  });
  expect(product.status()).toBe(201);
  return { email, profile, headers, codes: account.recoveryCodes };
}
test("un restaurante carga fotos, recibe un pedido público y lo prepara con seguimiento", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const c = await owner(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Menú y fotos", exact: true }).click();
  await page
    .locator(".product-card")
    .filter({ hasText: "Arepa de la Huerta" })
    .getByRole("button", { name: "Editar producto", exact: true })
    .click();
  const photo = await sharp({
    create: {
      width: 120,
      height: 80,
      channels: 3,
      background: { r: 182, g: 113, b: 61 },
    },
  })
    .png()
    .toBuffer();
  await page
    .getByLabel("Foto del plato", { exact: true })
    .setInputFiles({ name: "arepa.png", mimeType: "image/png", buffer: photo });
  await expect(
    page.getByRole("dialog").getByAltText("Foto del plato"),
  ).toBeVisible();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Guardar producto", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Mi restaurante", exact: true })
    .click();
  const qrDownload = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Descargar QR del menú", exact: true })
    .click();
  const qr = await qrDownload;
  expect(qr.suggestedFilename()).toBe("menu-" + c.profile.slug + "-qr.png");
  expect((await sharp(await qr.path()).metadata()).width).toBe(1024);
  await page
    .getByRole("button", { name: "Gestionar fotos y espacio", exact: true })
    .click();
  await expect(
    page
      .getByRole("dialog")
      .getByRole("button", { name: "Eliminar foto 1", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Cerrar ventana", exact: true })
    .click();
  await page.goto("/?restaurant=" + c.profile.slug);
  await expect(
    page.getByRole("img", { name: "Arepa de la Huerta", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Agregar Arepa de la Huerta al pedido" })
    .click();
  await page.getByRole("button", { name: /Mi pedido/ }).click();
  const form = page.getByRole("dialog");
  await form.getByLabel("Tu nombre", { exact: true }).fill("Cliente de prueba");
  await form.getByLabel("Tu teléfono", { exact: true }).fill("+573001112233");
  await form.getByRole("checkbox").check();
  await form.getByRole("button", { name: /Confirmar pedido/ }).click();
  await expect(
    page.getByRole("heading", { name: "Tu pedido está en el restaurante." }),
  ).toBeVisible();
  const follow = await page
    .getByRole("link", { name: /Ver seguimiento/ })
    .getAttribute("href");
  await page.getByRole("link", { name: /Ver seguimiento/ }).click();
  await expect(page.locator(".guest-tracking-card")).toContainText(
    "Arepa de la Huerta",
  );
  await expect(page.locator(".guest-tracking-card")).toContainText("12.000");
  await page.goto("/");
  await page.getByRole("button", { name: "Cocina", exact: true }).click();
  await page
    .getByRole("button", { name: "Marcar pago verificado", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Comenzar preparación", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Marcar listo", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Marcar listo", exact: true }).click();
  await page.goto(follow);
  await expect(
    page.locator(".guest-tracking-card .restaurant-state"),
  ).toHaveText("Listo");
  await expect(page.locator(".guest-tracking-card")).toContainText(
    "pago como verificado",
  );
  expect(errors).toEqual([]);
});
test("reservar desde el celular, confirmar en el panel y cancelar desde el enlace privado", async ({
  page,
}) => {
  const c = await owner(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?restaurant=" + c.profile.slug);
  await page
    .getByRole("button", { name: "Reservar mesa", exact: true })
    .click();
  const form = page.getByRole("dialog");
  const next = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  await form.getByLabel("Fecha de la reserva").fill(next);
  await form.getByRole("button", { name: "12:00", exact: true }).click();
  await form.getByLabel("Nombre de la reserva").fill("Lucía");
  await form.getByLabel("Teléfono de contacto").fill("+573004445566");
  await form.getByRole("checkbox").check();
  await form
    .getByRole("button", { name: "Solicitar reserva", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Tu solicitud de reserva fue recibida.",
    }),
  ).toBeVisible();
  const follow = await page
    .getByRole("link", { name: /Ver seguimiento/ })
    .getAttribute("href");
  await page.goto("/");
  await page.getByRole("button", { name: "Abrir menú" }).click();
  await page.getByRole("button", { name: "Reservas", exact: true }).click();
  await page
    .getByRole("button", { name: "Confirmar reserva", exact: true })
    .click();
  await page.goto(follow);
  await expect(
    page.locator(".guest-tracking-card .restaurant-state"),
  ).toHaveText("Confirmada");
  await page.route("**/api/public/reservations/*/cancel", (route) =>
    route.fulfill({
      status: 409,
      contentType: "application/json",
      body: JSON.stringify({
        error: "La reserva cambió. Consulta al equipo antes de cancelarla.",
      }),
    }),
  );
  await page.getByRole("button", { name: "Cancelar esta reserva" }).click();
  await expect(page.getByRole("alert")).toContainText("La reserva cambió");
  await page.unroute("**/api/public/reservations/*/cancel");
  await page.getByRole("button", { name: "Cancelar esta reserva" }).click();
  await expect(
    page.locator(".guest-tracking-card .restaurant-state"),
  ).toHaveText("Cancelada");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("el negocio abre soporte y recupera su cuenta con el código guardado", async ({
  page,
}) => {
  const c = await owner(page);
  await page.goto("/");
  await page
    .getByRole("button", { name: "Soporte técnico", exact: true })
    .click();
  await page.getByRole("button", { name: "Nueva solicitud" }).click();
  await page.getByLabel("Asunto de la consulta").fill("Ayuda con el menú");
  await page
    .getByLabel("¿Qué pasó y qué necesitas resolver?")
    .fill("Quiero revisar la configuración de mi menú.");
  await page
    .getByRole("button", { name: "Crear solicitud", exact: true })
    .click();
  await expect(
    page.getByText("Ayuda con el menú", { exact: true }).first(),
  ).toBeVisible();
  await page.context().clearCookies();
  await page.goto("/?recover=start");
  await page.getByLabel("Correo de tu cuenta").fill(c.email);
  await page.getByLabel("Código de recuperación").fill(c.codes[0]);
  await page
    .getByLabel("Nueva contraseña", { exact: true })
    .fill("NuevaClaveRestaurante12345");
  await page
    .getByLabel("Confirmar nueva contraseña")
    .fill("NuevaClaveRestaurante12345");
  await page
    .getByRole("button", { name: "Restablecer contraseña", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Vuelve a tu restaurante." }),
  ).toBeVisible();
  const login = await page.request.post("/api/auth/login", {
    data: { email: c.email, password: "NuevaClaveRestaurante12345" },
  });
  expect(login.status()).toBe(200);
});
