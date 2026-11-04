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
    .getByRole("heading", { name: "Tu tienda, en buenas manos." })
    .waitFor();
  const scans = [];
  async function scan(name, screenshot = false) {
    await page.waitForTimeout(500);
    const a = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
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
  await page.getByRole("button", { name: "Evaluar", exact: true }).click();
  await page.getByRole("button", { name: "Ejecutar evaluación" }).click();
  await scan("asistente-evaluacion", true);
  for (const [name, label] of [
    ["productos", "Productos"],
    ["pedidos", "Pedidos"],
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
  const nativeBase = url.replace("/Cerca.html", "");
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
        mobileOverflow: overflow,
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
  console.log("JavaScript errors", errors, "Mobile overflow", overflow);
} finally {
  if (browser) await browser.close();
  if (chrome) await chrome.kill();
  await new Promise((r) => server.close(r));
  service.close();
}
