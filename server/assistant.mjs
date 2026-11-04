import {
  handleRestaurantAction,
  restaurantSettings,
} from "./restaurant-actions.mjs";
import { activity, now, settingsFor } from "./db.mjs";
import { assistantReply, isInstructionAttack } from "../shared/advisor.ts";
import { profileFor } from "./restaurant-db.mjs";
import { reasonAboutStore } from "./reasoner.mjs";
import { normalize, outside } from "../shared/replies.ts";
export { normalize } from "../shared/replies.ts";
export const money = (value) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);

// The model can classify ambiguous store questions. It never writes the response,
// receives customer orders, changes inventory, or selects an unchecked product.
export async function answerMessage({
  db,
  workspaceId,
  conversation,
  text,
  apiKey,
  model = "gpt-4.1-mini",
  fetcher = fetch,
  voice = false,
  actionKey,
  baseUrl,
  signal,
}) {
  signal?.throwIfAborted();
  const action = handleRestaurantAction({
    db,
    key: actionKey,
    workspaceId,
    conversation,
    text,
    voice,
    baseUrl,
  });
  if (action) return action;
  const settings = restaurantSettings(db, workspaceId);
  const store = db
    .prepare("SELECT name FROM workspaces WHERE id = ?")
    .get(workspaceId);
  const products = db
    .prepare("SELECT * FROM products WHERE workspace_id = ?")
    .all(workspaceId);
  const context = JSON.parse(
    db
      .prepare(
        "SELECT state FROM conversation_memory WHERE conversation_id = ?",
      )
      .get(conversation.id)?.state ?? "{}",
  );
  const input = {
    settings,
    storeName: profileFor(db, workspaceId).displayName || store.name,
    products,
    orders: voice
      ? []
      : db
          .prepare("SELECT * FROM orders WHERE workspace_id = ? AND phone = ?")
          .all(workspaceId, conversation.phone),
    phone: conversation.phone,
    text,
    context,
    allowOrders: !voice,
    channel: voice ? "voice" : "text",
  };
  let reply = assistantReply(input);
  if (
    apiKey &&
    ([
      "comparacion",
      "recomendacion",
      "asesoria",
      "detalle",
      "conocimiento",
    ].includes(reply.category) ||
      (reply.policy === "outside" && !outside.test(normalize(text)))) &&
    !isInstructionAttack(text) &&
    !/empecemos de nuevo|reinicia|olvida (todo|lo anterior)/.test(
      normalize(text),
    )
  ) {
    try {
      reply = await reasonAboutStore({
        input,
        apiKey,
        model,
        fetcher,
        signal,
        freshInput: () => ({
          ...input,
          settings: restaurantSettings(db, workspaceId),
          products: db
            .prepare("SELECT * FROM products WHERE workspace_id=?")
            .all(workspaceId),
        }),
      });
    } catch {
      signal?.throwIfAborted();
      reply = assistantReply({
        ...input,
        settings: restaurantSettings(db, workspaceId),
        products: db
          .prepare("SELECT * FROM products WHERE workspace_id=?")
          .all(workspaceId),
      });
      activity(
        db,
        workspaceId,
        "assistant.fallback",
        "El asesor con IA no estuvo disponible. Se respondió con el contexto y las fuentes locales del negocio.",
      );
    }
  }
  signal?.throwIfAborted();
  db.prepare(
    "INSERT INTO conversation_memory (conversation_id,state) VALUES (?,?) ON CONFLICT(conversation_id) DO UPDATE SET state=excluded.state",
  ).run(conversation.id, JSON.stringify(reply.context));
  if (reply.handoff && !conversation.handoff) {
    db.prepare(
      "UPDATE conversations SET handoff=1,status='pending',topic='humano',updated_at=? WHERE id=? AND workspace_id=?",
    ).run(now(), conversation.id, workspaceId);
    activity(
      db,
      workspaceId,
      "conversation.handoff",
      `${conversation.name} solicitó atención de una persona.`,
      "Asistente",
    );
  }
  return reply;
}
