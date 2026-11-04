import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { existsSync } from "node:fs";
import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import lighthouse from "lighthouse";
import desktop from "lighthouse/core/config/desktop-config.js";
import { launch } from "chrome-launcher";
import { createApp } from "../server/app.mjs";
const root = resolve(import.meta.dirname, ".."),
  out = resolve(root, "auditoria");
await mkdir(out, { recursive: true });
await mkdir(resolve(out, "capturas"), { recursive: true });
const executable =
  process.env.CHROMIUM_PATH ??
  (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined);
const service = await createApp({
  databasePath: ":memory:",
  demoMode: true,
  production: false,
  registrationOpen: true,
  openaiKey: "",
  startWorker: false,
});
const server = service.app.listen(0, "127.0.0.1");
await new Promise((r) => server.once("listening", r));
const url = "http://127.0.0.1:" + server.address().port + "/Cerca.html";
let browser, chrome;
try {
  browser = await chromium.launch({
    executablePath: executable,
    args: ["--no-sandbox"],
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  let page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(url);
  await page
    .getByRole("heading", { name: "Hoy se cocina algo bueno." })
    .waitFor();
  const scans = [];
  const overflows = [];
  async function scan(name, screenshot = false) {
    await page.waitForTimeout(500);
    const a = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    if (
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth + 1,
      )
    )
      overflows.push(name);
    scans.push({
      page: name,
      engine: a.testEngine,
      violations: a.violations,
      passes: a.passes.map((p) => p.id),
    });
    if (screenshot)
      await page.screenshot({
        path: resolve(out, "capturas", name + ".png"),
        fullPage: true,
      });
    console.log(
      name,
      JSON.stringify(
        a.violations.map((v) => ({
          id: v.id,
          nodes: v.nodes.length,
          examples: v.nodes
            .slice(0, 3)
            .map((n) => ({ target: n.target, summary: n.failureSummary })),
        })),
      ),
    );
  }
  await scan("panel");
  for (const [name, label] of [
    ["cocina", "Cocina"],
    ["reservas", "Reservas"],
    ["restaurante-identidad", "Mi restaurante"],
    ["soporte", "Soporte técnico"],
    ["administracion", "Administración"],
  ]) {
    await page.getByRole("button", { name: label, exact: true }).click();
    await scan(name, true);
    if (label === "Mi restaurante") {
      await page
        .getByRole("button", { name: "Gestionar fotos y espacio", exact: true })
        .click();
      await scan("galeria-fotos");
      await page
        .getByRole("button", { name: "Cerrar ventana", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Atención y pedidos", exact: true })
        .click();
      await scan("restaurante-servicios");
      await page
        .getByRole("button", { name: "Horarios y reservas", exact: true })
        .click();
      await scan("restaurante-horarios");
    }
    if (label === "Soporte técnico") {
      await page
        .getByRole("button", { name: "Nueva solicitud", exact: true })
        .click();
      await scan("soporte-formulario");
      await page.getByLabel("Asunto de la consulta").fill("Ayuda con el menú");
      await page
        .getByLabel("¿Qué pasó y qué necesitas resolver?")
        .fill("Solicitud de demostración para revisar el menú.");
      await page
        .getByRole("button", { name: "Crear solicitud", exact: true })
        .click();
      await page
        .getByText("Ayuda con el menú", { exact: true })
        .first()
        .click();
      await scan("soporte-conversacion");
      await page
        .getByRole("button", { name: "Cerrar ventana", exact: true })
        .click();
    }
    if (label === "Administración") {
      for (const [part, tab] of [
        ["configuracion", "Configuración"],
        ["soporte", "Soporte técnico"],
        ["registro", "Registro"],
      ]) {
        await page
          .getByRole("main")
          .getByRole("button", { name: tab, exact: true })
          .click();
        await scan("administracion-" + part);
      }
    }
  }
  await page.getByRole("button", { name: "Asistente IA", exact: true }).click();
  await scan("asistente-chat", true);
  await page
    .getByRole("button", { name: "Voz y llamadas", exact: true })
    .click();
  await scan("asistente-voz", true);
  await page.getByRole("button", { name: "Configurar", exact: true }).click();
  await scan("asistente-configuracion");
  await page
    .getByRole("button", { name: "Sobre tu tienda", exact: true })
    .click();
  await scan("asistente-datos");
  await page
    .getByRole("button", { name: "Preguntas frecuentes", exact: true })
    .click();
  await scan("asistente-faq");
  await page
    .getByRole("button", { name: "Guía del negocio", exact: true })
    .click();
  await scan("asistente-guia", true);
  await page.getByRole("button", { name: "Evaluar", exact: true }).click();
  await page.getByRole("button", { name: "Ejecutar evaluación" }).click();
  await scan("asistente-evaluacion", true);
  for (const [name, label] of [
    ["productos", "Menú y fotos"],
    ["pedidos", "Historial de pedidos"],
    ["actividad", "Registro de actividad"],
    ["configuracion", "Configuración"],
  ]) {
    await page.getByRole("button", { name: label, exact: true }).click();
    await scan(name);
  }
  await page.getByRole("button", { name: "Asistente IA", exact: true }).click();
  await page
    .getByRole("button", { name: "Voz y llamadas", exact: true })
    .click();
  await page.setViewportSize({ width: 390, height: 844 });
  await scan("voz-movil", true);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > innerWidth + 1,
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.evaluate(() => {
    document.documentElement.dataset.theme = "dark";
  });
  await scan("voz-oscuro", true);
  for (const [name, label] of [
    ["cocina-oscuro", "Cocina"],
    ["soporte-oscuro", "Soporte técnico"],
    ["administracion-oscuro", "Administración"],
    ["restaurante-oscuro", "Mi restaurante"],
  ]) {
    await page.getByRole("button", { name: label, exact: true }).click();
    await scan(name);
  }
  await page.evaluate(() => (document.documentElement.dataset.theme = "light"));
  await page.goto(url + "?restaurant=la-mesa-demo");
  await page.locator(".public-menu-content").waitFor();
  await scan("menu-publico", true);
  await page
    .getByRole("button", { name: "Reservar mesa", exact: true })
    .click();
  await scan("reserva-publica", true);
  await page
    .getByRole("button", { name: "Cerrar ventana", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Agregar Pizza Margarita al pedido",
      exact: true,
    })
    .click();
  await page.getByRole("button", { name: /Mi pedido/ }).click();
  await scan("pedido-publico", true);
  await page.setViewportSize({ width: 390, height: 844 });
  await scan("pedido-publico-movil", true);
  await page
    .getByRole("button", { name: "Cerrar ventana", exact: true })
    .click();
  await scan("menu-publico-movil", true);
  await page.setViewportSize({ width: 1440, height: 1000 });
  const nativeBase = url.replace("/Cerca.html", "");
  for (const accent of ["jade", "violet"]) {
    await page.evaluate((accent) => {
      const data = JSON.parse(localStorage.getItem("cerca.demo.v2"));
      data.restaurant.accent = accent;
      localStorage.setItem("cerca.demo.v2", JSON.stringify(data));
    }, accent);
    await page.reload();
    await page.locator(".public-menu-content").waitFor();
    await scan("menu-publico-" + accent, true);
  }
  const native = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  page = await native.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(nativeBase + "/");
  await page
    .getByRole("heading", { name: "Qué bueno tenerte de vuelta." })
    .waitFor();
  await scan("ingreso");
  await page.goto(nativeBase + "/#register");
  await page.getByLabel("Tu nombre", { exact: true }).waitFor();
  await scan("registro");
  await page.goto(nativeBase + "/?recover=start");
  await page.getByRole("heading", { name: "Recupera tu cuenta." }).waitFor();
  await scan("recuperar-cuenta", true);
  const account = await page.request.post(nativeBase + "/api/auth/register", {
    data: {
      name: "Auditora",
      storeName: "Cocina de auditoría",
      email: "auditora@example.test",
      password: "SoloPruebaLocal12345",
    },
  });
  if (account.status() !== 201)
    throw Error("No se creó la cuenta de prueba local.");
  const me = await (await page.request.get(nativeBase + "/api/me")).json();
  await page.request.put(nativeBase + "/api/voice/channel", {
    headers: { "X-CSRF-Token": me.csrfToken },
    data: { enabled: true },
  });
  const config = await (
    await page.request.get(nativeBase + "/api/voice/config")
  ).json();
  await native.clearCookies();
  await page.goto(
    nativeBase +
      "/?voice=" +
      new URL(config.publicUrl).searchParams.get("voice"),
  );
  await page.locator(".voice-console").waitFor();
  await scan("llamada-publica");
  await writeFile(
    resolve(out, "despues-axe.json"),
    JSON.stringify(
      {
        tool: "axe-core",
        version: createRequire(import.meta.url)("axe-core/package.json")
          .version,
        generatedAt: new Date().toISOString(),
        url: "Demo portátil servida localmente",
        scans,
        errors,
        mobileOverflow: overflow || overflows.length > 0,
        overflowViews: overflows,
      },
      null,
      2,
    ),
  );
  await browser.close();
  browser = null;
  chrome = await launch({
    chromePath: executable,
    chromeFlags: ["--headless=new", "--no-sandbox", "--disable-dev-shm-usage"],
  });
  const result = await lighthouse(
    url,
    {
      port: chrome.port,
      output: "json",
      logLevel: "error",
      onlyCategories: ["performance", "accessibility", "best-practices", "seo"],
    },
    desktop,
  );
  await writeFile(
    resolve(out, "despues-lighthouse.json"),
    JSON.stringify(result.lhr, null, 2),
  );
  console.log(
    "Lighthouse",
    Object.fromEntries(
      Object.entries(result.lhr.categories).map(([k, c]) => [
        k,
        Math.round(c.score * 100),
      ]),
    ),
  );
  console.log("JavaScript errors", errors, "Overflow views", overflows);
  if (
    errors.length ||
    overflows.length ||
    scans.some((s) => s.violations.length)
  )
    process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  if (chrome) await chrome.kill();
  await new Promise((r) => server.close(r));
  service.close();
}
