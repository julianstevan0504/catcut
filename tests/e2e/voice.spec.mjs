import { test, expect } from "@playwright/test";
async function mockVoice(page, delay = 30) {
  await page.addInitScript((delay) => {
    const state = {
      starts: 0,
      cancels: 0,
      utterances: [],
      stops: 0,
      speaks: [],
      current: null,
      late: null,
    };
    window.__voiceTest = state;
    class Recognition {
      lang = "";
      continuous = false;
      interimResults = false;
      onstart = null;
      onresult = null;
      onend = null;
      onerror = null;
      start() {
        state.starts++;
        state.current = this;
        setTimeout(() => this.onstart?.(), 0);
      }
      abort() {
        state.stops++;
        if (state.current === this) state.current = null;
      }
    }
    Object.defineProperty(window, "SpeechRecognition", {
      value: Recognition,
      configurable: true,
    });
    Object.defineProperty(window, "SpeechSynthesisUtterance", {
      value: class {
        constructor(text) {
          this.text = text;
        }
      },
      configurable: true,
    });
    let timer;
    Object.defineProperty(window, "speechSynthesis", {
      value: {
        getVoices: () => [],
        cancel: () => {
          state.cancels++;
          clearTimeout(timer);
        },
        speak: (u) => {
          state.speaks.push(u.text);
          state.utterances.push(u);
          timer = setTimeout(() => u.onend?.(), delay);
        },
      },
      configurable: true,
    });
    state.say = (text) => {
      const r = state.current;
      if (!r) throw Error("No micrófono activo");
      state.late = r.onresult;
      r.onresult?.({ results: [[{ transcript: text }]] });
    };
  }, delay);
}
async function openVoice(page, offline = true, delay = 30) {
  await mockVoice(page, delay);
  await page.goto(offline ? "/Cerca.html" : "/");
  if (!offline)
    await page.getByRole("button", { name: "Explorar la demo" }).click();
  await page.getByRole("button", { name: "Asistente IA", exact: true }).click();
  await page
    .getByRole("button", { name: "Voz y llamadas", exact: true })
    .click();
}

test("voz en demo sin API: escucha, responde con datos, conserva transcripción y detiene el micrófono", async ({
  page,
}) => {
  const requests = [];
  await page.route("**/api/**", (route) => {
    requests.push(route.request().url());
    return route.abort();
  });
  await openVoice(page);
  await page
    .getByRole("button", { name: "Hablar con el asistente", exact: true })
    .click();
  await expect(page.getByText("Te escucho", { exact: true })).toBeVisible();
  await page.evaluate(() =>
    window.__voiceTest.say("¿Qué lleva la Pizza Margarita?"),
  );
  await expect(page.locator(".voice-line.assistant").last()).toContainText(
    "albahaca",
  );
  await expect(page.getByText("Te escucho", { exact: true })).toBeVisible();
  await page.evaluate(() => window.__voiceTest.say("¿Cuánto cuesta?"));
  await expect(page.locator(".voice-line.assistant").last()).toContainText(
    "28.000",
  );
  await expect(page.getByText("Te escucho", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Silenciar micrófono", exact: true })
    .click();
  expect(await page.evaluate(() => window.__voiceTest.current)).toBeNull();
  await page
    .getByLabel("Mensaje durante la llamada")
    .fill("¿Cuál es la capital de Francia?");
  await page
    .getByRole("button", { name: "Enviar mensaje en la llamada" })
    .click();
  await expect(page.locator(".voice-line.assistant").last()).toContainText(
    "Solo puedo ayudarte",
  );
  await page.getByRole("button", { name: "Terminar llamada" }).click();
  const count = await page.locator(".voice-line").count();
  await page.evaluate(() =>
    window.__voiceTest.late?.({
      results: [[{ transcript: "¿Tienen sushi?" }]],
    }),
  );
  await expect(
    page.getByText("Gracias por conversar", { exact: true }),
  ).toBeVisible();
  expect(await page.locator(".voice-line").count()).toBe(count);
  expect(await page.evaluate(() => window.__voiceTest.current)).toBeNull();
  await expect(page.locator(".voice-history-list")).toContainText("Finalizada");
  await page.getByRole("button", { name: /^Conversaciones/ }).click();
  await page.getByRole("button", { name: /Llamada web de prueba/ }).click();
  await expect(page.locator(".chat-messages")).toContainText("albahaca");
  expect(requests).toEqual([]);
});
test("se puede interrumpir la voz; el eco y los eventos de respuestas viejas no generan consultas", async ({
  page,
}) => {
  await openVoice(page, true, 10000);
  await page.getByLabel("Interrumpir por voz con auriculares").check();
  await page
    .getByRole("button", { name: "Hablar con el asistente", exact: true })
    .click();
  await expect(
    page.getByText("Tu asistente está hablando", { exact: true }),
  ).toBeVisible();
  const initial = await page.locator(".voice-line").count();
  await page.evaluate(() =>
    window.__voiceTest.say(window.__voiceTest.speaks.at(-1)),
  );
  await expect(page.locator(".voice-line")).toHaveCount(initial);
  await expect(
    page.getByText("Tu asistente está hablando", { exact: true }),
  ).toBeVisible();
  await page.evaluate(() => window.__voiceTest.say("Espera por favor"));
  await expect(page.getByText("Te escucho", { exact: true })).toBeVisible();
  await expect(page.locator(".voice-line")).toHaveCount(initial);
  await page.evaluate(() =>
    window.__voiceTest.say("¿Cuánto cuesta la Pizza Margarita?"),
  );
  await expect(page.locator(".voice-line.assistant").last()).toContainText(
    "28.000",
  );
  await expect(
    page.getByText("Tu asistente está hablando", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Interrumpir y hablar", exact: true })
    .click();
  await expect(page.getByText("Te escucho", { exact: true })).toBeVisible();
  await page.evaluate(() => window.__voiceTest.utterances[0].onend?.());
  await expect(page.getByText("Te escucho", { exact: true })).toBeVisible();
  await page.evaluate(() => window.__voiceTest.say("¿Qué ingredientes tiene?"));
  await expect(page.locator(".voice-line.assistant").last()).toContainText(
    "albahaca",
  );
  await page.getByRole("button", { name: "Terminar llamada" }).click();
  expect(await page.evaluate(() => window.__voiceTest.current)).toBeNull();
});
test("Sofía mantiene el micrófono apagado mientras habla y no convierte su propia voz en otro turno", async ({
  page,
}) => {
  await openVoice(page, true, 30000);
  await page
    .getByRole("button", { name: "Hablar con el asistente", exact: true })
    .click();
  await expect(
    page.getByText("Tu asistente está hablando", { exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => window.__voiceTest.current)).toBeNull();
  expect(await page.evaluate(() => window.__voiceTest.starts)).toBe(0);
  await page
    .getByRole("button", { name: "Interrumpir y hablar", exact: true })
    .click();
  await expect(page.getByText("Te escucho", { exact: true })).toBeVisible();
  await page.evaluate(() =>
    window.__voiceTest.say("¿Qué lleva la Pizza Margarita?"),
  );
  await expect(page.locator(".voice-line.assistant").last()).toContainText(
    "albahaca",
  );
  await expect(
    page.getByText("Tu asistente está hablando", { exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => window.__voiceTest.current)).toBeNull();
  const count = await page.locator(".voice-line").count();
  await page.evaluate(() =>
    window.__voiceTest.late?.({
      results: [[{ transcript: "Pizza Margarita" }]],
    }),
  );
  await expect(page.locator(".voice-line")).toHaveCount(count);
  await page.evaluate(() => window.__voiceTest.utterances.at(-1).onend?.());
  await expect(page.getByText("Te escucho", { exact: true })).toBeVisible();
  await page.evaluate(() => window.__voiceTest.say("¿Cuánto cuesta?"));
  await expect(page.locator(".voice-line.assistant").last()).toContainText(
    "28.000",
  );
  await page.getByRole("button", { name: "Terminar llamada" }).click();
  expect(await page.evaluate(() => window.__voiceTest.current)).toBeNull();
});
test("un cliente sin iniciar sesión puede llamar desde un enlace público sin ver el panel", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await mockVoice(page);
  const registration = await page.request.post("/api/auth/register", {
    data: {
      name: "Cocina",
      storeName: "Cocina de prueba",
      email: `public-${Date.now()}@example.test`,
      password: "ClaveSegura12345",
    },
  });
  expect(registration.status()).toBe(201);
  const me = await (await page.request.get("/api/me")).json();
  const csrf = { "X-CSRF-Token": me.csrfToken };
  await page.request.post("/api/products", {
    headers: csrf,
    data: {
      name: "Sopa de la Casa",
      sku: "SOPA-001",
      price: 15000,
      stock: 4,
      kind: "dish",
      ingredients: "Agua, papa y zanahoria",
      allergens: "Trazas por confirmar",
    },
  });
  await page.request.put("/api/voice/channel", {
    headers: csrf,
    data: { enabled: true },
  });
  const cfg = await (await page.request.get("/api/voice/config")).json();
  await page.context().clearCookies();
  await page.goto(cfg.publicUrl);
  await expect(page.locator(".public-voice-page")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Menú y fotos", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Hablar con el asistente", exact: true })
    .click();
  await expect(page.getByText("Te escucho", { exact: true })).toBeVisible();
  await page.evaluate(() => window.__voiceTest.say("¿Qué menú hay?"));
  await expect(page.locator(".voice-line.assistant").last()).toContainText(
    "Sopa de la Casa",
  );
  await expect(page.locator(".voice-line.assistant").last()).toContainText(
    "15.000",
  );
  await page.getByRole("button", { name: "Terminar llamada" }).click();
  expect(errors).toEqual([]);
});
test("la falta de permiso del micrófono permite continuar escribiendo y escuchar la respuesta", async ({
  page,
}) => {
  await openVoice(page);
  await page
    .getByRole("button", { name: "Hablar con el asistente", exact: true })
    .click();
  await expect(page.getByText("Te escucho", { exact: true })).toBeVisible();
  await page.evaluate(() =>
    window.__voiceTest.current.onerror?.({ error: "not-allowed" }),
  );
  await expect(page.getByRole("alert")).toContainText("no tiene permiso");
  await page.getByLabel("Mensaje durante la llamada").fill("¿Tienen sushi?");
  await page
    .getByRole("button", { name: "Enviar mensaje en la llamada" })
    .click();
  await expect(page.locator(".voice-line.assistant").last()).toContainText(
    "No tenemos ese producto",
  );
  await page.getByRole("button", { name: "Terminar llamada" }).click();
});
test("evaluación y menú editable muestran ingredientes reales y advierten cuando faltan", async ({
  page,
}) => {
  await page.goto("/Cerca.html");
  await page.getByRole("button", { name: "Menú y fotos", exact: true }).click();
  await page
    .getByRole("button", { name: "Agregar producto", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nombre del producto").fill("Arepa del Día");
  await dialog.getByLabel("SKU", { exact: true }).fill("AREPA-900");
  await dialog.getByLabel("Tipo de ficha").selectOption("dish");
  await dialog.getByLabel("Precio en pesos colombianos").fill("6000");
  await dialog.getByLabel("Unidades disponibles").fill("5");
  await dialog.getByLabel("Ingredientes confirmados").fill("Maíz y agua");
  await dialog
    .getByLabel("Alérgenos y posibles trazas")
    .fill("Posibles trazas de leche");
  await dialog
    .getByRole("button", { name: "Agregar producto", exact: true })
    .click();
  await page.getByRole("button", { name: "Asistente IA", exact: true }).click();
  await page
    .getByLabel("Mensaje para probar el asistente")
    .fill("¿Qué lleva la Arepa del Día?");
  await page.getByRole("button", { name: "Enviar mensaje de prueba" }).click();
  await expect(page.locator(".sim-message.assistant").last()).toContainText(
    "Maíz y agua",
  );
  await page.getByRole("button", { name: "Evaluar", exact: true }).click();
  await page.getByRole("button", { name: "Ejecutar evaluación" }).click();
  await expect(page.locator(".studio-score")).toContainText("8/8");
  await expect(page.locator(".studio-test-list")).toContainText(
    "Mantiene el tema de la tienda",
  );
});
