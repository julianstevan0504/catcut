import test from "node:test";
import assert from "node:assert/strict";
import { createDatabase, createWorkspace } from "../server/db.mjs";
import { answerMessage } from "../server/assistant.mjs";

function fixture() {
  const db = createDatabase(":memory:");
  const workspaceId = createWorkspace(db, "Tienda prueba IA", { sample: true });
  const conversation = db
    .prepare(
      "SELECT * FROM conversations WHERE workspace_id = ? AND phone = '+573001112233'",
    )
    .get(workspaceId);
  return {
    db,
    workspaceId,
    conversation,
    apiKey: "test_only_not_a_real_key",
    model: "mock-model",
  };
}

test("la herramienta de IA no revela otro pedido aunque el modelo lo solicite", async () => {
  const ctx = fixture();
  let round = 0;
  try {
    const reply = await answerMessage({
      ...ctx,
      text: "Revisa el pedido LC-1043",
      fetcher: async (_url, init) => {
        const body = JSON.parse(init.body);
        assert.equal(body.store, false);
        if (round++ === 0)
          return Response.json({
            output: [
              {
                type: "function_call",
                id: "test-fc",
                call_id: "test-call",
                name: "get_order_status",
                arguments: JSON.stringify({ code: "LC-1043" }),
              },
            ],
          });
        const output = JSON.parse(
          body.input.find((i) => i.type === "function_call_output").output,
        );
        assert.equal(output.found, false);
        assert.ok(!JSON.stringify(output).includes("Santiago"));
        assert.ok(!JSON.stringify(output).includes("Pantalón"));
        return Response.json({
          output: [
            {
              type: "message",
              content: [
                {
                  type: "output_text",
                  text: "No encuentro ese pedido vinculado a tu número. ¿Revisamos el código?",
                },
              ],
            },
          ],
        });
      },
    });
    assert.equal(round, 2);
    assert.equal(reply.source, "openai");
    assert.match(reply.text, /vinculado a tu número/);
  } finally {
    ctx.db.close();
  }
});

test("la IA consulta el stock actualizado en su herramienta", async () => {
  const ctx = fixture();
  ctx.db
    .prepare(
      "UPDATE products SET stock = 4 WHERE workspace_id = ? AND name = 'Bolso Alba'",
    )
    .run(ctx.workspaceId);
  let round = 0;
  try {
    const reply = await answerMessage({
      ...ctx,
      text: "¿Tienen el Bolso Alba?",
      fetcher: async (_url, init) => {
        const body = JSON.parse(init.body);
        if (round++ === 0)
          return Response.json({
            output: [
              {
                type: "function_call",
                id: "test-fc",
                call_id: "test-call",
                name: "search_products",
                arguments: JSON.stringify({ query: "Bolso Alba" }),
              },
            ],
          });
        const products = JSON.parse(
          body.input.find((i) => i.type === "function_call_output").output,
        );
        assert.equal(products.find((p) => p.name === "Bolso Alba").stock, 4);
        return Response.json({
          output: [
            {
              type: "message",
              content: [
                {
                  type: "output_text",
                  text: "¡Sí! Tenemos 4 unidades del Bolso Alba 🌿",
                },
              ],
            },
          ],
        });
      },
    });
    assert.match(reply.text, /4 unidades/);
    assert.equal(reply.category, "stock");
  } finally {
    ctx.db.close();
  }
});

test("un fallo del proveedor usa datos locales y deja constancia del modo de respaldo", async () => {
  const ctx = fixture();
  try {
    const reply = await answerMessage({
      ...ctx,
      text: "¿Cuál es su horario?",
      fetcher: async () => {
        throw new Error("Proveedor de prueba no disponible");
      },
    });
    assert.equal(reply.source, "local");
    assert.match(reply.text, /Lunes a viernes/);
    assert.equal(
      ctx.db
        .prepare(
          "SELECT COUNT(*) AS n FROM activities WHERE action = 'assistant.fallback'",
        )
        .get().n,
      1,
    );
  } finally {
    ctx.db.close();
  }
});

test("un SKU del catálogo se consulta como producto y no como código de pedido", async () => {
  const ctx = fixture();
  try {
    const reply = await answerMessage({
      ...ctx,
      apiKey: "",
      text: "¿Tienen el BA-002?",
    });
    assert.equal(reply.category, "stock");
    assert.match(reply.text, /Bolso Alba/);
    assert.match(reply.text, /8 unidades/);
  } finally {
    ctx.db.close();
  }
});
