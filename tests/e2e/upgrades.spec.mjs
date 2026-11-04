import { test, expect } from "@playwright/test";

test("la demo independiente funciona con la API bloqueada y conserva los cambios tras recargar", async ({
  page,
}) => {
  const apiCalls = [],
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/api/**", async (route) => {
    apiCalls.push(route.request().url());
    await route.abort();
  });
  await page.goto("/Cerca.html");
  await expect(
    page.getByRole("heading", { name: "Hoy se cocina algo bueno." }),
  ).toBeVisible();
  await expect(
    page.getByText("Demo interactiva · sin instalación", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/plataforma-v2-panel.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Menú y fotos", exact: true }).click();
  await page
    .getByRole("button", { name: "Agregar producto", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nombre del producto").fill("Producto sin servidor");
  await dialog.getByLabel("SKU", { exact: true }).fill("OFF-100");
  await dialog.getByLabel("Precio en pesos colombianos").fill("56000");
  await dialog.getByLabel("Unidades disponibles").fill("7");
  await dialog
    .getByRole("button", { name: "Agregar producto", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Producto sin servidor", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Producto sin servidor", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Asistente IA", exact: true }).click();
  await page
    .getByLabel("Mensaje para probar el asistente")
    .fill("¿Tienen el Producto sin servidor?");
  await page.getByRole("button", { name: "Enviar mensaje de prueba" }).click();
  await expect(page.locator(".sim-message.assistant").last()).toContainText(
    "7 unidades disponibles",
  );
  expect(apiCalls).toEqual([]);
  expect(errors).toEqual([]);
});

test("el catálogo se importa con revisión previa y la búsqueda global abre el producto correcto", async ({
  page,
}) => {
  await page.goto("/Cerca.html");
  await page.getByRole("button", { name: "Menú y fotos", exact: true }).click();
  await page.getByRole("button", { name: "Importar CSV", exact: true }).click();
  await page.getByLabel("Archivo CSV del catálogo").setInputFiles({
    name: "catalogo.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "nombre,sku,descripcion,categoria,precio,stock\nVela Cerezo,VC-202,Un aroma especial,Decoración,35000,12\nBolso Sol,BS-202,Bolso de prueba,Accesorios,95000,4",
    ),
  });
  await expect(
    page.getByText("2 productos válidos", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Importar 2 productos", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Vela Cerezo", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Control+k");
  await page
    .getByRole("dialog")
    .getByLabel("Buscar en toda la tienda")
    .fill("VC-202");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /Vela Cerezo/ })
    .click();
  await expect(
    page.getByRole("dialog").getByLabel("Nombre del producto"),
  ).toHaveValue("Vela Cerezo");
  await page.getByRole("button", { name: "Cerrar ventana" }).click();
  await page.getByRole("button", { name: "Activar modo oscuro" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.screenshot({
    path: "test-results/plataforma-v2-oscura.png",
    fullPage: true,
  });
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test("un CSV incorrecto no permite importar ni cambia el catálogo", async ({
  page,
}) => {
  await page.goto("/Cerca.html");
  await page.getByRole("button", { name: "Menú y fotos", exact: true }).click();
  await page.getByRole("button", { name: "Importar CSV", exact: true }).click();
  await page.getByLabel("Archivo CSV del catálogo").setInputFiles({
    name: "malo.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "nombre,sku,precio,stock\nVálido,A-01,10000,3\nInválido,B-01,abc,-1",
    ),
  });
  await expect(page.getByRole("alert")).toContainText("Fila 3");
  await expect(
    page.getByRole("button", { name: "Importar 1 productos" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Válido", exact: true }),
  ).toHaveCount(0);
});

test("la nueva vista móvil no tiene desbordamiento y se pueden exportar los datos de la demo", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/Cerca.html");
  await expect(
    page.getByRole("heading", { name: "Hoy se cocina algo bueno." }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/plataforma-v2-movil.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Abrir menú" }).click();
  await page
    .getByRole("button", { name: "Configuración", exact: true })
    .click();
  await page.getByRole("button", { name: /Datos y seguridad/ }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exportar mis datos" }).click();
  expect((await download).suggestedFilename()).toMatch(
    /^cerca-datos-.*\.json$/,
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("la demo informa si el navegador no permite guardar y conserva la prueba en la pestaña", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "cerca.demo.v2")
        throw new DOMException("Sin espacio", "QuotaExceededError");
      return original.call(this, key, value);
    };
  });
  await page.goto("/Cerca.html");
  await page.getByRole("button", { name: "Menú y fotos", exact: true }).click();
  await page
    .getByRole("button", { name: "Agregar producto", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nombre del producto").fill("Solo en esta pestaña");
  await dialog.getByLabel("SKU", { exact: true }).fill("MEM-001");
  await dialog
    .getByRole("button", { name: "Agregar producto", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Solo en esta pestaña", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("alert")).toContainText(
    "No se pudieron guardar los cambios",
  );
});
