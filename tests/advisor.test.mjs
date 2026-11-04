import test from "node:test";
import assert from "node:assert/strict";
import { createDatabase, createWorkspace, settingsFor } from "../server/db.mjs";
import { assistantReply } from "../shared/advisor.ts";
import { answerMessage } from "../server/assistant.mjs";
import { searchKnowledge } from "../shared/knowledge.ts";
import { isSpeechEcho, interruptionOnly } from "../shared/speech.ts";
function fixture() {
  const db = createDatabase(":memory:"),
    ws = createWorkspace(db, "La Mesa", { sample: true, restaurant: true });
  const input = {
    settings: settingsFor(db, ws),
    storeName: "La Mesa",
    products: db.prepare("SELECT * FROM products WHERE workspace_id=?").all(ws),
    orders: [],
    phone: "+573001112233",
  };
  return {
    db,
    ws,
    input,
    conversation: db
      .prepare(
        "SELECT * FROM conversations WHERE workspace_id=? AND phone='+573001112233'",
      )
      .get(ws),
  };
}
const result = (steps) =>
  Response.json({
    output: [
      {
        type: "message",
        content: [{ type: "output_text", text: JSON.stringify({ steps }) }],
      },
    ],
  });
const step = (intent, extra = {}) => ({
  intent,
  productIds: [],
  sourceIds: [],
  quantities: [],
  kind: "all",
  clarification: null,
  ...extra,
});
test("relaciona presupuesto, personas, comparación y una pregunta de seguimiento", () => {
  const c = fixture();
  try {
    let r = assistantReply({
      ...c.input,
      text: "Somos dos y tenemos un presupuesto de 50 mil para cenar, ¿qué recomiendas?",
    });
    assert.equal(r.category, "recomendacion");
    assert.equal(r.context.budget, 50000);
    assert.equal(r.context.quantity, 2);
    assert.ok(r.productIds.length > 0);
    for (const id of r.productIds) {
      const p = c.input.products.find((p) => p.id === id);
      assert.ok(p.price * 2 <= 50000);
      assert.ok(p.stock >= 2);
    }
    r = assistantReply({
      ...c.input,
      text: "Compara Pizza Margarita y Hamburguesa de la Casa",
    });
    assert.equal(r.productIds.length, 2);
    assert.match(r.text, /4.000/);
    const follow = assistantReply({
      ...c.input,
      context: r.context,
      text: "¿Cuál de esas es la más barata?",
    });
    assert.match(follow.text, /Hamburguesa de la Casa/);
    assert.doesNotMatch(follow.text, /Torta|Café/);
  } finally {
    c.db.close();
  }
});
test("busca términos relacionados en la guía y distingue un dato ausente de uno de otro tema", () => {
  const c = fixture();
  try {
    const r = assistantReply({
      ...c.input,
      text: "¿Podría entrar con mi perrita?",
    });
    assert.equal(r.category, "conocimiento");
    assert.match(r.text, /correa/);
    const heat = assistantReply({
      ...c.input,
      text: "¿Cómo recaliento la Pizza Margarita?",
    });
    assert.match(heat.text, /180/);
    assert.match(heat.text, /5 minutos/);
    const nutrition = assistantReply({
      ...c.input,
      text: "¿Cuántas calorías tiene la Pizza Margarita?",
    });
    assert.equal(nutrition.policy, "missing-data");
    assert.doesNotMatch(nutrition.text, /180|5 minutos/);
    assert.match(nutrition.text, /no tengo ese detalle confirmado/i);
  } finally {
    c.db.close();
  }
});
test("suma cantidades con los precios de catálogo y no inventa combos ni cargos", () => {
  const c = fixture();
  try {
    const r = assistantReply({
      ...c.input,
      text: "¿Cuánto sería dos pizzas y una limonada?",
    });
    assert.equal(r.category, "calculo");
    assert.match(r.text, /64.000/);
    assert.match(r.text, /2 × Pizza Margarita/);
    assert.match(r.text, /1 × Limonada Natural/);
    assert.match(r.text, /cargos.*confirman/);
  } finally {
    c.db.close();
  }
});
test("combina preguntas de horarios y pagos sin quedarse en la primera categoría", () => {
  const c = fixture();
  try {
    const r = assistantReply({
      ...c.input,
      text: "¿Cuándo abren y cómo puedo pagar?",
    });
    assert.match(r.text, /Lunes a viernes/);
    assert.match(r.text, /medios de pago/);
    assert.equal(r.sources.length, 2);
  } finally {
    c.db.close();
  }
});
test("no confunde una persona comensal con una petición de atención humana", () => {
  const c = fixture();
  try {
    const r = assistantReply({
      ...c.input,
      text: "Somos una persona y tengo 30 mil, recomiéndame algo para comer",
    });
    assert.equal(r.handoff, false);
    assert.equal(r.category, "recomendacion");
    const human = assistantReply({
      ...c.input,
      text: "Quiero hablar con una persona",
    });
    assert.equal(human.handoff, true);
  } finally {
    c.db.close();
  }
});
test("la IA puede buscar de nuevo en el negocio y utiliza solo fuentes recibidas", async () => {
  const c = fixture();
  let round = 0;
  try {
    const r = await answerMessage({
      db: c.db,
      workspaceId: c.ws,
      conversation: c.conversation,
      text: "¿Puede entrar mi pomerania?",
      apiKey: "test_only",
      model: "mock",
      fetcher: async (_, init) => {
        const body = JSON.parse(init.body);
        assert.equal(body.store, false);
        assert.equal(body.tools[0].name, "search_store");
        assert.doesNotMatch(
          JSON.stringify(body.input),
          /DEMO-1042|Valentina|Santiago/,
        );
        if (round++ === 0)
          return Response.json({
            output: [
              {
                type: "function_call",
                name: "search_store",
                call_id: "call-pets",
                arguments: JSON.stringify({ query: "mascotas perros terraza" }),
              },
            ],
          });
        const tool = body.input.find((x) => x.type === "function_call_output"),
          sources = JSON.parse(tool.output).knowledge;
        const source = sources.find((x) => /Mascotas/.test(x.title));
        assert.ok(source);
        return result([step("knowledge", { sourceIds: [source.id] })]);
      },
    });
    assert.equal(round, 2);
    assert.equal(r.source, "openai");
    assert.match(r.text, /correa/);
  } finally {
    c.db.close();
  }
});
test("la IA no puede introducir productos, precios, cantidades ni fuentes inventados", async () => {
  const c = fixture();
  try {
    const pizza = c.input.products.find((p) => p.sku === "MENU-001");
    for (const steps of [
      [step("products", { productIds: ["inventado"] })],
      [
        step("basket", {
          productIds: [pizza.id],
          quantities: [{ productId: pizza.id, quantity: 20 }],
        }),
      ],
      [step("knowledge", { sourceIds: ["documento-ajeno"] })],
    ]) {
      const r = await answerMessage({
        db: c.db,
        workspaceId: c.ws,
        conversation: c.conversation,
        text: "Compárame la pizza y la hamburguesa",
        apiKey: "test_only",
        fetcher: async () => result(steps),
      });
      assert.equal(r.source, "local");
      assert.equal(r.category, "comparacion");
      assert.doesNotMatch(r.text, /20 ×|inventado/);
    }
  } finally {
    c.db.close();
  }
});
test("relee los precios y el stock después de que el modelo haya respondido", async () => {
  const c = fixture();
  try {
    const pizza = c.input.products.find((p) => p.sku === "MENU-001"),
      burger = c.input.products.find((p) => p.sku === "MENU-002");
    const r = await answerMessage({
      db: c.db,
      workspaceId: c.ws,
      conversation: c.conversation,
      text: "Compara Pizza Margarita y Hamburguesa de la Casa",
      apiKey: "test_only",
      fetcher: async () => {
        c.db
          .prepare("UPDATE products SET price=31000,stock=0 WHERE id=?")
          .run(pizza.id);
        return result([step("compare", { productIds: [pizza.id, burger.id] })]);
      },
    });
    assert.equal(r.source, "openai");
    assert.match(r.text, /31.000/);
    assert.match(r.text, /agotado/);
    assert.doesNotMatch(r.text, /28.000/);
  } finally {
    c.db.close();
  }
});
test("un documento de otro restaurante no entra en la búsqueda ni en la respuesta", async () => {
  const c = fixture();
  try {
    const other = createWorkspace(c.db, "Otro restaurante");
    c.db
      .prepare("UPDATE workspaces SET settings=? WHERE id=?")
      .run(
        JSON.stringify({
          ...c.input.settings,
          knowledge: [
            {
              id: "private",
              title: "Frase privada",
              content: "Secreto específico del restaurante ajeno.",
            },
          ],
        }),
        other,
      );
    const hits = searchKnowledge({
      ...c.input,
      text: "Frase privada secreto restaurante ajeno",
    });
    assert.ok(
      !hits.some((h) => h.text.includes("específico del restaurante ajeno")),
    );
  } finally {
    c.db.close();
  }
});
test("el filtro de eco reconoce una reproducción pero permite una nueva pregunta y una interrupción corta", () => {
  const text =
    "Hola soy Sofía la asistente virtual de La Mesa, puedo ayudarte a elegir platos o reservar una mesa.";
  assert.equal(
    isSpeechEcho("soy Sofía la asistente virtual de La Mesa", text),
    true,
  );
  assert.equal(isSpeechEcho("Espera, quiero otra cosa", text), false);
  assert.equal(isSpeechEcho("¿Cuánto cuesta la pizza?", text), false);
  assert.equal(interruptionOnly("Espera por favor", "Sofía"), true);
  assert.equal(interruptionOnly("Oye Sofía", "Sofía"), true);
  assert.equal(interruptionOnly("¿Qué lleva la pizza?", "Sofía"), false);
});
