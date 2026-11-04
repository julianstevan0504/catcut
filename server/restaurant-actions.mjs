import { randomUUID } from "node:crypto";
import { now, settingsFor } from "./db.mjs";
import { profileFor, activeBusiness } from "./restaurant-db.mjs";
import {
  createReservation,
  createRestaurantOrder,
  reservationSlots,
} from "./restaurants.mjs";
import { fold, explicitProducts } from "../shared/knowledge.ts";
import { quantityFor, money } from "../shared/advisor.ts";
import { localParts } from "../shared/restaurant.ts";
export function restaurantSettings(db, ws) {
  const settings = settingsFor(db, ws),
    row = db
      .prepare("SELECT data FROM restaurant_profiles WHERE workspace_id=?")
      .get(ws);
  if (!row) return settings;
  const p = profileFor(db, ws);
  return {
    ...settings,
    knowledge: [
      ...(settings.knowledge ?? []),
      {
        id: "automatic-restaurant-location",
        title: "Ubicación y contacto del restaurante",
        content:
          (p.address
            ? "Dirección: " + p.address + ". "
            : "La dirección no está configurada. ") +
          (p.phone
            ? "Teléfono: " + p.phone + "."
            : "El teléfono de contacto no está configurado."),
      },
      {
        id: "automatic-restaurant-services",
        title: "Atención, recogida, mesa y domicilio",
        content: `Recepción de pedidos online: ${p.acceptingOrders ? "habilitada" : "pausada por la cocina"}. Atención en mesa: ${p.services.dineIn ? "habilitada" : "no habilitada"}. Recogida en el local: ${p.services.pickup ? "habilitada" : "no habilitada"}. Domicilio: ${p.services.delivery ? "habilitado en estas zonas: " + p.deliveryZones.map((z) => z.name + " por " + money(z.fee) + " COP").join("; ") : "no habilitado"}. Preparación estimada: ${p.prepMinutes} minutos; puede variar. El pago se verifica con el equipo, no se cobra automáticamente.`,
      },
      {
        id: "automatic-restaurant-booking",
        title: "Reservas del restaurante",
        content: p.reservationsEnabled
          ? `Se reciben solicitudes de reserva para hasta ${p.maxParty} personas por grupo, con ${p.visitMinutes} minutos de visita. Se revisa la capacidad antes de registrarlas. Las solicitudes quedan pendientes de confirmación del equipo.`
          : "Las reservas todavía no están habilitadas.",
      },
    ],
  };
}
const numbers = {
  un: 1,
  una: 1,
  uno: 1,
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  seis: 6,
  siete: 7,
  ocho: 8,
  nueve: 9,
  diez: 10,
  once: 11,
  doce: 12,
};
const addDay = (date, n) => {
  const d = new Date(date + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
export function handleRestaurantAction({
  db,
  key,
  workspaceId,
  conversation,
  text,
  voice = false,
  baseUrl = "",
}) {
  if (!key || !activeBusiness(db, workspaceId)) return null;
  let saved = db
      .prepare("SELECT * FROM conversation_actions WHERE conversation_id=?")
      .get(conversation.id),
    draft =
      saved && Date.now() - Date.parse(saved.updated_at) < 30 * 60000
        ? JSON.parse(saved.draft)
        : null;
  const q = fold(text),
    p = profileFor(db, workspaceId),
    products = db
      .prepare("SELECT * FROM products WHERE workspace_id=?")
      .all(workspaceId);
  const startsReservation =
    /\b(reservar|reservame|reservarme|reserva|reservacion|mesa para|tienen mesa|hay mesa)\b/.test(
      q,
    ) && !/horario|politica|como funciona|como puedo|que necesito/.test(q);
  const startsOrder =
    /\b(hacer un pedido|hacer mi pedido|quiero pedir|quiero ordenar|quiero encargar|pedir para|pide para|confirmar pedido)\b/.test(
      q,
    );
  if (!startsReservation && !startsOrder && !draft) return null;
  if (
    draft &&
    !startsReservation &&
    !startsOrder &&
    /menu|carta|recom|ingrediente|precio|horario|pagar|diferencia|compar/.test(
      q,
    )
  )
    return null;
  if (
    draft?.created &&
    !startsReservation &&
    !startsOrder &&
    !/confirm|cancel|reserva|pedido/.test(q)
  )
    return null;
  const type = startsReservation
    ? "reservation"
    : startsOrder
      ? "order"
      : draft?.type;
  if (!type) return null;
  const result = (message, policy = "grounded") => ({
    text: message,
    category: type === "reservation" ? "reserva" : "pedido",
    source: "local",
    handoff: false,
    productIds: [],
    context: {},
    policy,
    sources: [
      {
        id: "restaurant:operations",
        title: "Disponibilidad y operaciones del restaurante",
      },
    ],
    approach:
      "Revisé disponibilidad y solicité confirmación antes de registrar cambios.",
  });
  if (type === "reservation" && !p.reservationsEnabled)
    return result(
      "Todavía no recibimos reservas por este canal. El equipo puede confirmar cómo atenderte.",
      "missing-data",
    );
  if (
    type === "order" &&
    !p.acceptingOrders &&
    !draft?.created &&
    !/\bcancel/.test(q)
  )
    return result(
      "La cocina tiene pausada la recepción de pedidos. Puedo ayudarte a consultar el menú o contactar con el equipo.",
      "missing-data",
    );
  if (/\b(cancelar|cancela|olvida|ya no quiero)\b/.test(q)) {
    db.prepare("DELETE FROM conversation_actions WHERE conversation_id=?").run(
      conversation.id,
    );
    return result(
      draft?.created
        ? type === "reservation"
          ? "Puedes cancelar la reserva desde el enlace privado de seguimiento o contactar con el equipo para revisar tu solicitud."
          : "Para cancelar un pedido ya registrado, contacta con el equipo del restaurante para que revise su preparación. No he cancelado tu pedido."
        : "De acuerdo, descarté el borrador. No se registró ninguna reserva ni pedido.",
    );
  }
  if (
    !draft ||
    draft.type !== type ||
    (draft.created && startsReservation && !/confirm/.test(q))
  )
    draft = {
      type,
      requestId: randomUUID(),
      name: !/^Cliente|Llamada/i.test(conversation.name)
        ? conversation.name
        : "",
      phone: /^\+\d+$/.test(conversation.phone) ? conversation.phone : "",
      items: [],
    };
  const name = text.match(
    /(?:mi nombre es|me llamo|a nombre de|nombre\s*:)\s*([a-záéíóúñü ]{2,80})/i,
  )?.[1];
  if (name)
    draft.name = name
      .split(/\s+y\s+(?:mi|para|somos)|\s+para\s+|\s+telefono|\s+numero|,/i)[0]
      .trim()
      .slice(0, 100);
  const contact = text.match(/\+[1-9][\d\s()-]{7,20}\d/)?.[0];
  if (contact) draft.phone = contact.replace(/[\s()-]/g, "");
  const confirm =
    /^(si[, ]*)?(confirmo|confirmar|confirma)( (la|el|mi))?( reserva| pedido)?[.!\s]*$/.test(
      q.trim(),
    );
  if (draft.created && confirm)
    return result(
      `Tu ${type === "reservation" ? "solicitud de reserva" : "pedido"} ${draft.created.code} ya está registrado. ${type === "reservation" ? "El equipo debe confirmar la reserva." : "El pago queda pendiente de verificación."}`,
    );
  const persist = () =>
    db
      .prepare(
        "INSERT INTO conversation_actions VALUES (?,?,?) ON CONFLICT(conversation_id) DO UPDATE SET draft=excluded.draft,updated_at=excluded.updated_at",
      )
      .run(conversation.id, JSON.stringify(draft), now());
  if (type === "reservation") {
    const today = localParts(new Date(), p.timezone).date;
    const date = q.match(/\b\d{4}-\d{2}-\d{2}\b/)?.[0];
    if (date) draft.date = date;
    else if (/pasado manana/.test(q)) draft.date = addDay(today, 2);
    else if (/manana/.test(q) && !/de la manana/.test(q))
      draft.date = addDay(today, 1);
    else if (/\bhoy\b/.test(q)) draft.date = today;
    const day = [
      "domingo",
      "lunes",
      "martes",
      "miercoles",
      "jueves",
      "viernes",
      "sabado",
    ].findIndex((d) => new RegExp("\\b" + d + "\\b").test(q));
    if (day >= 0 && !date && !/hoy|manana/.test(q)) {
      const current = new Date(today + "T12:00:00Z").getUTCDay();
      draft.date = addDay(today, (day - current + 7) % 7);
    }
    const party =
      q.match(
        /(?:somos|seremos|para)\s+(\d{1,2}|un[ao]?|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\b/,
      ) ?? q.match(/\b(\d{1,2}|dos|tres|cuatro|cinco)\s+personas/);
    if (party) draft.partySize = numbers[party[1]] ?? Number(party[1]);
    const clock = q.match(/\b(\d{1,2}):([0-5]\d)\b/),
      hour = q.match(
        /a las?\s+(\d{1,2}|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce)(?:\s+(?:de la\s+)?(noche|tarde|manana|pm|am))?/,
      );
    if (clock) draft.time = clock[1].padStart(2, "0") + ":" + clock[2];
    else if (hour) {
      let h = numbers[hour[1]] ?? Number(hour[1]);
      if (["noche", "tarde", "pm"].includes(hour[2]) && h < 12) h += 12;
      if (["manana", "am"].includes(hour[2]) && h === 12) h = 0;
      draft.time = String(h).padStart(2, "0") + ":00";
      draft.ambiguous = !hour[2] && h < 12;
    }
    persist();
    if (!draft.date)
      return result(
        "Claro, te ayudo a buscar mesa. ¿Para qué día la necesitas? Puedes decir hoy, mañana o una fecha como 2026-11-15.",
        "missing-data",
      );
    if (!draft.partySize)
      return result("¿Cuántas personas vendrían a la reserva?", "missing-data");
    let available;
    try {
      available = reservationSlots(
        db,
        workspaceId,
        draft.date,
        draft.partySize,
      );
    } catch (e) {
      return result(e.message, "missing-data");
    }
    if (draft.ambiguous && draft.time) {
      const h = Number(draft.time.slice(0, 2)),
        alternatives = [
          draft.time,
          String(h + 12).padStart(2, "0") + ":00",
        ].filter((t) => available.some((s) => s.time === t));
      if (alternatives.length === 1) {
        draft.time = alternatives[0];
        draft.ambiguous = false;
      } else if (alternatives.length > 1)
        return result(
          `Tengo disponibilidad a las ${alternatives.join(" y ")}. ¿Cuál horario prefieres?`,
          "missing-data",
        );
    }
    if (!available.length)
      return result(
        `No hay capacidad disponible para ${draft.partySize} personas el ${draft.date}. ¿Probamos otra fecha o un grupo distinto?`,
        "not-found",
      );
    if (!draft.time || !available.some((s) => s.time === draft.time)) {
      draft.time = "";
      draft.ready = false;
      persist();
      return result(
        `Para ${draft.partySize} personas el ${draft.date} puedo ofrecerte: ${available
          .slice(0, voice ? 4 : 8)
          .map((s) => s.time)
          .join(", ")} (${p.timezone}). ¿Qué hora te conviene?`,
        "missing-data",
      );
    }
    if (!draft.name)
      return result(
        "Tengo el día y horario. ¿A nombre de quién dejamos la solicitud?",
        "missing-data",
      );
    if (!draft.phone)
      return result(
        "¿Cuál es el teléfono de contacto con código de país? Por ejemplo +573001112233. Se usará para esta reserva.",
        "missing-data",
      );
    if (confirm && draft.ready) {
      try {
        const r = createReservation(
          db,
          key,
          workspaceId,
          { ...draft, confirm: true },
          { source: voice ? "voice" : "whatsapp", actor: "Asistente" },
        );
        draft.created = { id: r.id, code: r.code };
        persist();
        return result(
          `Registré la solicitud ${r.code} a nombre de ${r.name}, para ${r.party_size} personas el ${draft.date} a las ${draft.time}. Está pendiente de confirmación del restaurante. ${voice ? "El equipo la verá en su panel." : baseUrl ? "Seguimiento privado: " + baseUrl + "/?reservation=" + r.guestToken : ""}`,
        );
      } catch (e) {
        draft.ready = false;
        persist();
        return result(
          e.status && e.status < 500
            ? e.message + " Puedo ayudarte a elegir otra opción."
            : "No pude registrar la reserva. El equipo puede revisarlo contigo.",
          "missing-data",
        );
      }
    }
    draft.ready = true;
    persist();
    return result(
      `Revisemos: reserva para ${draft.partySize} personas el ${draft.date} a las ${draft.time} (${p.timezone}), a nombre de ${draft.name}. La solicitud quedará pendiente de confirmación del equipo. Si está bien, di «confirmar reserva». Puedes cambiar cualquier dato antes.`,
    );
  }
  const mentioned = explicitProducts(products, text);
  if (mentioned.length) {
    draft.items = mentioned.map((product) => ({
      productId: product.id,
      quantity: quantityFor(text, product, 1),
    }));
    draft.ready = false;
  }
  if (/\b(recoger|recogida|llevar|recojo)\b/.test(q))
    draft.fulfillment = "pickup";
  else if (/\b(domicilio|delivery|a mi casa|enviar a)\b/.test(q))
    draft.fulfillment = "delivery";
  else if (/\b(en mesa|comer aqui|mesa \d)/.test(q))
    draft.fulfillment = "dineIn";
  const table = q.match(/mesa\s+(\d{1,3}|[a-z]-?\d{1,3})/);
  if (table) draft.table = table[1];
  const zone = p.deliveryZones.find((z) => fold(text).includes(fold(z.name)));
  if (zone) draft.deliveryZone = zone.id;
  const address = text.match(
    /(?:direcci[oó]n(?: es)?|enviar a)\s*:?\s*(.{5,300})/i,
  )?.[1];
  if (address) draft.address = address;
  persist();
  if (!draft.items.length)
    return result(
      "Claro. Dime qué platos o bebidas quieres y cuántas unidades de cada uno. Puedo ayudarte a elegir antes de registrar el pedido.",
      "missing-data",
    );
  if (!draft.fulfillment)
    return result(
      "¿Lo quieres para recoger, a domicilio o para comer en una mesa del restaurante?",
      "missing-data",
    );
  if (!p.services[draft.fulfillment])
    return result(
      "Ese tipo de atención no está habilitado. Podemos revisar otra forma de recibirlo.",
      "missing-data",
    );
  if (draft.fulfillment === "delivery" && !draft.deliveryZone)
    return result(
      "¿En qué zona necesitas el domicilio? Tenemos: " +
        p.deliveryZones
          .map((z) => z.name + " por " + money(z.fee) + " COP")
          .join(", ") +
        ".",
      "missing-data",
    );
  if (draft.fulfillment === "delivery" && !draft.address)
    return result(
      "¿Cuál es la dirección de entrega? Puedes decir «dirección:» y la dirección completa.",
      "missing-data",
    );
  if (draft.fulfillment === "dineIn" && !draft.table)
    return result("¿En qué mesa estás?", "missing-data");
  if (!draft.name && draft.fulfillment !== "dineIn")
    return result("¿Cuál es tu nombre para el pedido?", "missing-data");
  if (!draft.phone && draft.fulfillment !== "dineIn")
    return result(
      "¿Cuál es el teléfono de contacto con código de país para este pedido?",
      "missing-data",
    );
  const lines = draft.items.map((item) => ({
    item,
    p: products.find((p) => p.id === item.productId),
  }));
  if (lines.some((x) => !x.p || x.p.stock < x.item.quantity))
    return result(
      "Algún plato ya no tiene esa cantidad disponible. Revisemos los productos antes de confirmar.",
      "not-found",
    );
  const fee =
      draft.fulfillment === "delivery"
        ? (p.deliveryZones.find((z) => z.id === draft.deliveryZone)?.fee ?? 0)
        : 0,
    total = lines.reduce((n, x) => n + x.p.price * x.item.quantity, 0) + fee;
  if (confirm && draft.ready) {
    if (draft.total !== total) {
      draft.ready = false;
      persist();
      return result(
        "Cambió el precio del pedido. El nuevo total es " +
          money(total) +
          " COP. Revisa los productos antes de confirmarlo otra vez.",
        "missing-data",
      );
    }
    try {
      const r = createRestaurantOrder(
        db,
        key,
        workspaceId,
        {
          ...draft,
          confirm: true,
          expectedTotal: total,
          paymentMethod: "pay-at-restaurant",
        },
        { source: voice ? "voice" : "whatsapp", actor: "Asistente" },
      );
      draft.created = { id: r.id, code: r.code };
      persist();
      return result(
        `Tu pedido ${r.code} quedó registrado por ${money(r.total)} COP. El pago se confirma con el equipo. ${voice ? "Ya está en el panel de cocina." : baseUrl ? "Seguimiento privado: " + baseUrl + "/?order=" + r.guestToken : ""}`,
      );
    } catch (e) {
      return result(
        e.status && e.status < 500
          ? e.message
          : "No pude registrar el pedido. El equipo puede revisarlo.",
        "missing-data",
      );
    }
  }
  draft.ready = true;
  draft.total = total;
  persist();
  return result(
    "Antes de enviarlo a cocina: " +
      lines.map((x) => x.item.quantity + " × " + x.p.name).join(", ") +
      ". " +
      (fee ? "Domicilio: " + money(fee) + " COP. " : "") +
      "Total: " +
      money(total) +
      " COP. Pago pendiente de verificación con el equipo. Si todo está bien, di «confirmar pedido». Puedes cambiarlo antes.",
  );
}
