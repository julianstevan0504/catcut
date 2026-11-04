import { createHmac, randomBytes, randomInt } from "node:crypto";
import { join, dirname } from "node:path";
import { mkdir, writeFile, readFile, unlink } from "node:fs/promises";
import sharp from "sharp";
import { presetColors } from "../shared/storefront.ts";
import { installStorefronts } from "./storefronts.mjs";
import { uid, now, settingsFor, activity } from "./db.mjs";
import { rateLimiter, tokenHash } from "./security.mjs";
import { profileFor, activeBusiness } from "./restaurant-db.mjs";
import {
  validateRestaurant,
  minutes,
  dayOfWeek,
  zonedInstant,
  localParts,
  restaurantHours,
  restaurantDelivery,
} from "../shared/restaurant.ts";
const fail = (status, message) => Object.assign(new Error(message), { status });
const field = (v, name, max = 200) => {
  if (typeof v !== "string" || !v.trim() || v.trim().length > max)
    throw fail(400, "Revisa " + name + ".");
  return v.trim();
};
const phone = (v) => {
  const p = field(v, "el teléfono", 30).replace(/[\s()-]/g, "");
  if (!/^\+[1-9]\d{7,14}$/.test(p))
    throw fail(
      400,
      "Usa un teléfono con código de país, por ejemplo +573001112233.",
    );
  return p;
};
const requestId = (v) => {
  if (
    typeof v !== "string" ||
    !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(
      v,
    )
  )
    throw fail(400, "Revisa el identificador de la solicitud.");
  return v;
};
const guestToken = (key, ws, id, kind) =>
  createHmac("sha256", key)
    .update("cerca.restaurant.guest:" + kind + ":" + ws + ":" + id)
    .digest("hex");
export function reservationSlots(db, ws, date, partySize) {
  const p = profileFor(db, ws);
  if (!activeBusiness(db, ws) || !p.reservationsEnabled) return [];
  if (!Number.isInteger(partySize) || partySize < 1 || partySize > p.maxParty)
    throw fail(400, `Puedes reservar entre 1 y ${p.maxParty} personas.`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw fail(400, "Fecha no válida.");
  const today = localParts(new Date(), p.timezone).date,
    max = localParts(
      new Date(Date.now() + p.horizonDays * 86400000),
      p.timezone,
    ).date;
  if (date < today || date > max || p.closedDates.includes(date)) return [];
  const rows = [];
  for (const range of p.schedule.filter((s) => s.day === dayOfWeek(date))) {
    for (
      let start = minutes(range.open);
      start + p.visitMinutes <= minutes(range.close);
      start += p.slotMinutes
    ) {
      const time =
        String(Math.floor(start / 60)).padStart(2, "0") +
        ":" +
        String(start % 60).padStart(2, "0");
      let instant;
      try {
        instant = zonedInstant(date, time, p.timezone);
      } catch {
        continue;
      }
      if (instant.getTime() < Date.now() + 15 * 60000) continue;
      const end = new Date(
          instant.getTime() + p.visitMinutes * 60000,
        ).toISOString(),
        begin = instant.toISOString();
      // Evaluate every boundary during the visit, not the sum of nonoverlapping bookings.
      const overlapping = db
        .prepare(
          "SELECT start_at,end_at,party_size FROM reservations WHERE workspace_id=? AND status IN ('pending','confirmed','seated') AND start_at<? AND end_at>?",
        )
        .all(ws, end, begin);
      const points = [
        begin,
        ...overlapping
          .map((r) => r.start_at)
          .filter((s) => s > begin && s < end),
      ];
      const used = Math.max(
        0,
        ...points.map((point) =>
          overlapping
            .filter((r) => r.start_at <= point && r.end_at > point)
            .reduce((n, r) => n + r.party_size, 0),
        ),
      );
      if (used + partySize <= p.capacity)
        rows.push({
          time,
          startAt: begin,
          endAt: end,
          remaining: p.capacity - used,
        });
    }
  }
  return rows;
}
export function createReservation(
  db,
  key,
  ws,
  body,
  { source = "web", actor = "Cliente", owner = false } = {},
) {
  const p = profileFor(db, ws);
  if (!activeBusiness(db, ws) || !p.reservationsEnabled)
    throw fail(409, "Las reservas no están disponibles en este restaurante.");
  const idempotency = requestId(body.requestId),
    token = guestToken(key, ws, idempotency, "reservation");
  const existing = db
    .prepare("SELECT * FROM reservations WHERE workspace_id=? AND request_id=?")
    .get(ws, idempotency);
  if (existing) return { ...existing, guestToken: token, replayed: true };
  const name = field(body.name, "el nombre", 100),
    contact = phone(body.phone),
    party = Number(body.partySize),
    date = field(body.date, "la fecha", 10),
    time = field(body.time, "la hora", 5),
    notes = String(body.notes ?? "").trim();
  if (notes.length > 1000)
    throw fail(400, "Las notas no deben superar 1.000 caracteres.");
  if (body.confirm !== true)
    throw fail(400, "Confirma los datos de tu reserva para registrarla.");
  db.exec("BEGIN IMMEDIATE");
  try {
    if (
      !owner &&
      db
        .prepare(
          "SELECT COUNT(*) n FROM reservations WHERE workspace_id=? AND phone=? AND start_at>? AND status IN ('pending','confirmed','seated')",
        )
        .get(ws, contact, now()).n >= 3
    )
      throw fail(
        429,
        "Ya tienes varias reservas activas. Contacta con el restaurante para agregar otra.",
      );
    const slot = reservationSlots(db, ws, date, party).find(
      (s) => s.time === time,
    );
    if (!slot)
      throw fail(
        409,
        "Ese horario ya no tiene capacidad para tu grupo. Elige otro horario disponible.",
      );
    let code;
    do {
      code = "R-" + randomInt(10000000, 100000000);
    } while (db.prepare("SELECT id FROM reservations WHERE code=?").get(code));
    const id = uid(),
      status = owner ? "confirmed" : "pending";
    db.prepare(
      "INSERT INTO reservations VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
    ).run(
      id,
      ws,
      code,
      name,
      contact,
      party,
      slot.startAt,
      slot.endAt,
      status,
      notes,
      source,
      idempotency,
      tokenHash(token),
      now(),
      now(),
    );
    activity(
      db,
      ws,
      "reservation.created",
      `Reserva ${code} para ${party} personas, ${date} ${time}.`,
      actor,
    );
    db.exec("COMMIT");
    return {
      ...db.prepare("SELECT * FROM reservations WHERE id=?").get(id),
      guestToken: token,
    };
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
export function createRestaurantOrder(
  db,
  key,
  ws,
  body,
  { source = "web", actor = "Cliente" } = {},
) {
  const profile = profileFor(db, ws);
  if (!activeBusiness(db, ws))
    throw fail(409, "El restaurante no está disponible.");
  const rid = requestId(body.requestId),
    token = guestToken(key, ws, rid, "order");
  const old = db
    .prepare(
      "SELECT order_id FROM restaurant_orders WHERE workspace_id=? AND request_id=?",
    )
    .get(ws, rid);
  if (old)
    return {
      ...orderView(db, old.order_id, ws),
      guestToken: token,
      replayed: true,
    };
  if (!profile.acceptingOrders && source !== "panel")
    throw fail(
      409,
      "La cocina pausó la recepción de pedidos. Puedes consultar el menú y contactar al equipo.",
    );
  const fulfillment = body.fulfillment,
    customer =
      fulfillment === "dineIn" && !body.name
        ? "Mesa " + field(body.table, "la mesa", 30)
        : field(body.name, "el nombre", 100),
    contact = fulfillment === "dineIn" && !body.phone ? "" : phone(body.phone);
  if (
    !["dineIn", "pickup", "delivery"].includes(fulfillment) ||
    !profile.services[fulfillment]
  )
    throw fail(400, "Ese tipo de atención no está habilitado.");
  if (body.confirm !== true)
    throw fail(400, "Revisa y confirma tu pedido antes de enviarlo.");
  if (
    !Array.isArray(body.items) ||
    !body.items.length ||
    body.items.length > 30
  )
    throw fail(400, "Elige entre 1 y 30 productos distintos.");
  const ids = new Set(),
    items = body.items.map((item) => {
      if (
        !item ||
        typeof item.productId !== "string" ||
        ids.has(item.productId) ||
        !Number.isInteger(item.quantity) ||
        item.quantity < 1 ||
        item.quantity > 20
      )
        throw fail(400, "Revisa los productos y cantidades.");
      ids.add(item.productId);
      return { productId: item.productId, quantity: item.quantity };
    });
  const zone =
    fulfillment === "delivery"
      ? profile.deliveryZones.find((z) => z.id === body.deliveryZone)
      : null;
  if (fulfillment === "delivery" && !zone)
    throw fail(400, "Selecciona una zona de domicilio disponible.");
  const address =
      fulfillment === "delivery"
        ? field(body.address, "la dirección de entrega", 300)
        : "",
    table = fulfillment === "dineIn" ? field(body.table, "la mesa", 30) : "",
    notes = String(body.notes ?? "").trim();
  if (notes.length > 1000) throw fail(400, "Las notas son demasiado largas.");
  const payment = body.paymentMethod ?? "pay-at-restaurant";
  if (!["cash", "transfer", "pay-at-restaurant"].includes(payment))
    throw fail(400, "Medio de pago no disponible.");
  db.exec("BEGIN IMMEDIATE");
  try {
    const lines = items.map((item) => {
        const p = db
          .prepare("SELECT * FROM products WHERE id=? AND workspace_id=?")
          .get(item.productId, ws);
        if (!p || p.stock < item.quantity)
          throw fail(
            409,
            "Uno de los platos ya no tiene la cantidad solicitada. Revisa el menú.",
          );
        return { ...item, product: p };
      }),
      subtotal = lines.reduce((n, x) => n + x.product.price * x.quantity, 0),
      fee = zone?.fee ?? 0,
      total = subtotal + fee;
    if (
      body.expectedTotal !== undefined &&
      (!Number.isSafeInteger(body.expectedTotal) ||
        body.expectedTotal !== total)
    )
      throw fail(
        409,
        "Los precios o tarifas cambiaron. Actualiza el menú y confirma el nuevo total.",
      );
    if (subtotal < profile.minimumOrder)
      throw fail(
        400,
        `El pedido mínimo de productos es ${profile.minimumOrder} COP.`,
      );
    if (!Number.isSafeInteger(total) || total > 1000000000)
      throw fail(400, "El importe del pedido supera el límite.");
    let code;
    do {
      code = "P-" + randomInt(10000000, 100000000);
    } while (
      db
        .prepare("SELECT id FROM orders WHERE code=? AND workspace_id=?")
        .get(code, ws)
    );
    const id = uid(),
      time = now();
    db.prepare("INSERT INTO orders VALUES (?,?,?,?,?,?,?,?,?,?,?,?)").run(
      id,
      ws,
      code,
      customer,
      contact,
      "confirmed",
      total,
      lines.map((x) => `${x.quantity} × ${x.product.name}`).join(", "),
      "",
      "",
      time,
      time,
    );
    db.prepare(
      "INSERT INTO restaurant_orders (order_id,workspace_id,fulfillment,delivery_address,delivery_zone,delivery_fee,table_label,notes,payment_method,request_id,guest_token_hash,stock_restored,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
    ).run(
      id,
      ws,
      fulfillment,
      address,
      zone?.name ?? "",
      fee,
      table,
      notes,
      payment,
      rid,
      tokenHash(token),
      0,
      time,
    );
    for (const line of lines) {
      db.prepare("INSERT INTO order_lines VALUES (?,?,?,?,?,?)").run(
        uid(),
        id,
        line.productId,
        line.product.name,
        line.product.price,
        line.quantity,
      );
      const changed = db
        .prepare(
          "UPDATE products SET stock=stock-? WHERE id=? AND workspace_id=? AND stock>=?",
        )
        .run(line.quantity, line.productId, ws, line.quantity);
      if (changed.changes !== 1)
        throw fail(409, "El stock cambió. Revisa tu pedido.");
    }
    activity(
      db,
      ws,
      "restaurant.order.created",
      `Pedido ${code} registrado para ${fulfillment === "delivery" ? "domicilio" : fulfillment === "pickup" ? "recoger" : "mesa"}. Pago pendiente de verificación.`,
      actor,
    );
    db.exec("COMMIT");
    return { ...orderView(db, id, ws), guestToken: token };
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
export function orderView(db, id, ws) {
  const order = db
    .prepare("SELECT * FROM orders WHERE id=? AND workspace_id=?")
    .get(id, ws);
  if (!order) return null;
  const details = db
    .prepare(
      "SELECT fulfillment,delivery_address,delivery_zone,delivery_fee,table_label,notes,payment_method,payment_status FROM restaurant_orders WHERE order_id=? AND workspace_id=?",
    )
    .get(id, ws);
  const lines = db
    .prepare(
      "SELECT product_id,name,unit_price,quantity FROM order_lines WHERE order_id=?",
    )
    .all(id);
  return {
    ...order,
    details,
    lines,
    paymentStatus: details?.payment_status ?? "pending",
  };
}
export function installRestaurants({
  app,
  db,
  auth,
  key,
  baseUrl,
  databasePath,
  mediaDirectory,
  demoEmail,
}) {
  const publicLimit = rateLimiter({ limit: 80, windowMs: 60000 }),
    createLimit = rateLimiter({ limit: 10, windowMs: 60000 }),
    uploadLimit = rateLimiter({ limit: 20, windowMs: 60000 });
  const mediaDir =
    mediaDirectory ??
    join(
      databasePath === ":memory:"
        ? "/tmp/cerca-memory-media"
        : dirname(databasePath),
      "media",
    );
  let imageJobs = 0;
  const uploading = new Set();
  function publicStore(slug) {
    const row = db
      .prepare("SELECT workspace_id FROM restaurant_profiles WHERE slug=?")
      .get(slug);
    if (
      !row ||
      !activeBusiness(db, row.workspace_id) ||
      !profileFor(db, row.workspace_id).publicEnabled
    )
      throw fail(404, "El restaurante no está disponible.");
    return row.workspace_id;
  }
  const imageUrl = (id) => (id ? "/media/" + id : "");
  function ownedImages(ws, ids) {
    for (const id of ids.filter(Boolean))
      if (
        !db
          .prepare("SELECT id FROM media_images WHERE id=? AND workspace_id=?")
          .get(id, ws)
      )
        throw fail(400, "Una imagen no pertenece a tu restaurante.");
  }
  const storefronts = installStorefronts({
    app,
    db,
    auth,
    baseUrl,
    ownedImages,
    imageUrl,
    publicLimit,
  });
  app.get("/api/restaurant", auth, (req, res) =>
    res.json({
      ...profileFor(db, req.workspaceId),
      publicUrl: baseUrl + "/r/" + profileFor(db, req.workspaceId).slug,
    }),
  );
  app.put("/api/restaurant", auth, (req, res) => {
    const previous = profileFor(db, req.workspaceId);
    if (
      req.body.accent &&
      req.body.accent !== previous.accent &&
      JSON.stringify(req.body.design) === JSON.stringify(previous.design)
    ) {
      const colors = presetColors[req.body.accent];
      if (colors)
        req.body.design = {
          ...previous.design,
          primaryColor: colors.primary,
          backgroundColor: colors.background,
        };
    }
    const p = validateRestaurant(req.body, previous);
    ownedImages(req.workspaceId, [p.coverImageId, p.logoImageId]);
    db.prepare(
      "UPDATE restaurant_profiles SET slug=?,data=?,updated_at=? WHERE workspace_id=?",
    ).run(p.slug, JSON.stringify(p), now(), req.workspaceId);
    const settings = settingsFor(db, req.workspaceId);
    db.prepare("UPDATE workspaces SET settings=? WHERE id=?").run(
      JSON.stringify({
        ...settings,
        hours: restaurantHours(p),
        shipping: restaurantDelivery(p),
        timezone: p.timezone,
      }),
      req.workspaceId,
    );
    activity(
      db,
      req.workspaceId,
      "restaurant.updated",
      "Se actualizaron el menú público, horarios y condiciones de atención.",
      req.user.name,
    );
    res.json({ ok: true });
  });
  app.get("/api/public/restaurants/:slug", publicLimit, (req, res) => {
    const ws = publicStore(req.params.slug),
      p = profileFor(db, ws),
      voice = db
        .prepare(
          "SELECT public_token,enabled FROM voice_channels WHERE workspace_id=?",
        )
        .get(ws),
      s = settingsFor(db, ws);
    res.json({
      name:
        p.displayName ||
        db.prepare("SELECT name FROM workspaces WHERE id=?").get(ws).name,
      profile: {
        ...p,
        coverImageUrl: imageUrl(p.coverImageId),
        logoImageUrl: imageUrl(p.logoImageId),
      },
      products: db
        .prepare(
          "SELECT id,name,sku,description,category,price,stock,kind,ingredients,allergens,image_id FROM products WHERE workspace_id=? ORDER BY category,name",
        )
        .all(ws)
        .map((x) => ({ ...x, image_url: imageUrl(x.image_id) })),
      assistantName: s.assistantName,
      voiceUrl:
        voice?.enabled && s.active && s.voiceEnabled
          ? baseUrl + "/?voice=" + voice.public_token
          : null,
    });
  });
  app.get(
    "/api/public/restaurants/:slug/availability",
    publicLimit,
    (req, res) => {
      const ws = publicStore(req.params.slug);
      res.json({
        timezone: profileFor(db, ws).timezone,
        slots: reservationSlots(
          db,
          ws,
          String(req.query.date ?? ""),
          Number(req.query.partySize ?? 2),
        ),
      });
    },
  );
  app.post(
    "/api/public/restaurants/:slug/reservations",
    createLimit,
    (req, res) => {
      if (req.body.website)
        throw fail(400, "No se pudo completar la solicitud.");
      const ws = publicStore(req.params.slug),
        result = createReservation(db, key, ws, req.body);
      res.status(result.replayed ? 200 : 201).json({
        ...result,
        viewUrl: baseUrl + "/?reservation=" + result.guestToken,
      });
    },
  );
  app.post("/api/public/restaurants/:slug/orders", createLimit, (req, res) => {
    if (req.body.website) throw fail(400, "No se pudo completar la solicitud.");
    const ws = publicStore(req.params.slug),
      result = createRestaurantOrder(db, key, ws, req.body);
    res
      .status(result.replayed ? 200 : 201)
      .json({ ...result, viewUrl: baseUrl + "/?order=" + result.guestToken });
  });
  app.get("/api/public/reservations/:token", publicLimit, (req, res) => {
    if (!/^[a-f0-9]{64}$/.test(req.params.token))
      throw fail(404, "Reserva no encontrada.");
    const r = db
      .prepare("SELECT * FROM reservations WHERE guest_token_hash=?")
      .get(tokenHash(req.params.token));
    if (!r || !activeBusiness(db, r.workspace_id))
      throw fail(404, "Reserva no disponible.");
    res.json({
      code: r.code,
      name: r.name,
      partySize: r.party_size,
      startAt: r.start_at,
      endAt: r.end_at,
      status: r.status,
      notes: r.notes,
      restaurant: db
        .prepare("SELECT name FROM workspaces WHERE id=?")
        .get(r.workspace_id).name,
      timezone: profileFor(db, r.workspace_id).timezone,
    });
  });
  app.post(
    "/api/public/reservations/:token/cancel",
    createLimit,
    (req, res) => {
      if (!/^[a-f0-9]{64}$/.test(req.params.token))
        throw fail(404, "Reserva no encontrada.");
      const r = db
        .prepare("SELECT * FROM reservations WHERE guest_token_hash=?")
        .get(tokenHash(req.params.token));
      if (!r || !activeBusiness(db, r.workspace_id))
        throw fail(404, "Reserva no disponible.");
      if (r.start_at < now() || !["pending", "confirmed"].includes(r.status))
        throw fail(
          409,
          "Contacta con el restaurante para modificar esta reserva.",
        );
      db.prepare(
        "UPDATE reservations SET status='cancelled',updated_at=? WHERE id=?",
      ).run(now(), r.id);
      activity(
        db,
        r.workspace_id,
        "reservation.cancelled",
        "El cliente canceló la reserva " + r.code,
      );
      res.json({ ok: true });
    },
  );
  app.get("/api/public/orders/:token", publicLimit, (req, res) => {
    if (!/^[a-f0-9]{64}$/.test(req.params.token))
      throw fail(404, "Pedido no encontrado.");
    const row = db
      .prepare(
        "SELECT order_id,workspace_id FROM restaurant_orders WHERE guest_token_hash=?",
      )
      .get(tokenHash(req.params.token));
    if (!row || !activeBusiness(db, row.workspace_id))
      throw fail(404, "Pedido no disponible.");
    const r = orderView(db, row.order_id, row.workspace_id);
    res.json({
      code: r.code,
      status: r.status,
      customer: r.customer,
      total: r.total,
      lines: r.lines,
      details: r.details,
      paymentStatus: r.paymentStatus,
      restaurant: db
        .prepare("SELECT name FROM workspaces WHERE id=?")
        .get(row.workspace_id).name,
      prepMinutes: profileFor(db, row.workspace_id).prepMinutes,
    });
  });
  app.get("/api/reservations", auth, (req, res) =>
    res.json(
      db
        .prepare(
          "SELECT id,code,name,phone,party_size,start_at,end_at,status,notes,source,created_at FROM reservations WHERE workspace_id=? ORDER BY start_at DESC LIMIT 500",
        )
        .all(req.workspaceId),
    ),
  );
  app.get("/api/reservations/availability", auth, (req, res) =>
    res.json({
      slots: reservationSlots(
        db,
        req.workspaceId,
        String(req.query.date ?? ""),
        Number(req.query.partySize ?? 2),
      ),
    }),
  );
  app.post("/api/reservations", auth, (req, res) => {
    const r = createReservation(db, key, req.workspaceId, req.body, {
      source: "panel",
      actor: req.user.name,
      owner: true,
    });
    res
      .status(r.replayed ? 200 : 201)
      .json({ ...r, viewUrl: baseUrl + "/?reservation=" + r.guestToken });
  });
  app.put("/api/reservations/:id", auth, (req, res) => {
    const row = db
      .prepare("SELECT * FROM reservations WHERE id=? AND workspace_id=?")
      .get(req.params.id, req.workspaceId);
    if (!row) throw fail(404, "Reserva no encontrada.");
    const status = req.body.status,
      allowed = {
        pending: ["confirmed", "cancelled"],
        confirmed: ["seated", "cancelled", "no-show"],
        seated: ["completed"],
        completed: [],
        cancelled: [],
        "no-show": [],
      };
    if (!allowed[row.status]?.includes(status))
      throw fail(409, "Ese cambio de estado no está disponible.");
    db.prepare(
      "UPDATE reservations SET status=?,updated_at=? WHERE id=? AND workspace_id=?",
    ).run(status, now(), row.id, req.workspaceId);
    activity(
      db,
      req.workspaceId,
      "reservation.updated",
      `Reserva ${row.code}: ${status}.`,
      req.user.name,
    );
    res.json({ ok: true });
  });
  app.post("/api/restaurant/orders", auth, (req, res) => {
    const r = createRestaurantOrder(db, key, req.workspaceId, req.body, {
      source: "panel",
      actor: req.user.name,
    });
    res
      .status(r.replayed ? 200 : 201)
      .json({ ...r, viewUrl: baseUrl + "/?order=" + r.guestToken });
  });
  app.put("/api/kitchen/:id/payment", auth, (req, res) => {
    if (!["pending", "verified"].includes(req.body.status))
      throw fail(400, "Estado de pago no válido.");
    const changed = db
      .prepare(
        "UPDATE restaurant_orders SET payment_status=? WHERE order_id=? AND workspace_id=?",
      )
      .run(req.body.status, req.params.id, req.workspaceId);
    if (!changed.changes) throw fail(404, "Pedido no encontrado.");
    activity(
      db,
      req.workspaceId,
      "restaurant.payment.checked",
      req.body.status === "verified"
        ? "El equipo marcó un pago como verificado manualmente."
        : "El equipo marcó un pago como pendiente de revisar.",
      req.user.name,
    );
    res.json({ ok: true });
  });
  app.get("/api/kitchen", auth, (req, res) => {
    const rows = db
      .prepare(
        "SELECT o.id FROM orders o JOIN restaurant_orders r ON r.order_id=o.id WHERE o.workspace_id=? AND o.status NOT IN ('delivered','cancelled') ORDER BY o.created_at",
      )
      .all(req.workspaceId);
    res.json(rows.map((r) => orderView(db, r.id, req.workspaceId)));
  });
  app.put("/api/kitchen/:id/status", auth, (req, res) => {
    const o = orderView(db, req.params.id, req.workspaceId);
    if (!o?.details) throw fail(404, "Pedido del restaurante no encontrado.");
    const next = req.body.status,
      allowed = {
        confirmed: ["preparing", "cancelled"],
        preparing: ["ready", "cancelled"],
        ready:
          o.details.fulfillment === "delivery"
            ? ["shipped", "cancelled"]
            : ["delivered", "cancelled"],
        shipped: ["delivered", "cancelled"],
        delivered: [],
        cancelled: [],
      };
    if (!allowed[o.status]?.includes(next))
      throw fail(409, "El pedido cambió o esa transición no está disponible.");
    db.exec("BEGIN IMMEDIATE");
    try {
      const updated = db
        .prepare(
          "UPDATE orders SET status=?,updated_at=? WHERE id=? AND workspace_id=? AND status=?",
        )
        .run(next, now(), o.id, req.workspaceId, o.status);
      if (!updated.changes)
        throw fail(409, "Otra persona ya actualizó este pedido.");
      if (next === "cancelled") {
        const restored = db
          .prepare(
            "UPDATE restaurant_orders SET stock_restored=1 WHERE order_id=? AND stock_restored=0",
          )
          .run(o.id);
        if (restored.changes)
          for (const line of o.lines)
            db.prepare(
              "UPDATE products SET stock=stock+? WHERE id=? AND workspace_id=?",
            ).run(line.quantity, line.product_id, req.workspaceId);
      }
      activity(
        db,
        req.workspaceId,
        "restaurant.order.updated",
        `Pedido ${o.code}: ${next}.`,
        req.user.name,
      );
      db.exec("COMMIT");
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
    res.json({ ok: true });
  });
  app.get("/api/media/images", auth, (req, res) => {
    const p = profileFor(db, req.workspaceId);
    const draft = JSON.parse(
      storefronts.draftFor(req.workspaceId)?.data ?? "{}",
    );
    const used = new Set([
      draft.coverImageId,
      draft.logoImageId,
      p.coverImageId,
      p.logoImageId,
      ...db
        .prepare("SELECT image_id FROM products WHERE workspace_id=?")
        .all(req.workspaceId)
        .map((x) => x.image_id),
    ]);
    const images = db
      .prepare(
        "SELECT id,bytes,width,height,created_at FROM media_images WHERE workspace_id=? ORDER BY created_at DESC",
      )
      .all(req.workspaceId);
    res.json({
      images: images.map((x) => ({
        ...x,
        url: imageUrl(x.id),
        used: used.has(x.id),
      })),
      bytes: images.reduce((n, x) => n + x.bytes, 0),
      limitBytes: 50 * 1024 * 1024,
    });
  });
  app.post("/api/media/images", auth, uploadLimit, async (req, res) => {
    if (imageJobs >= 2 || uploading.has(req.workspaceId))
      throw fail(
        429,
        "Hay una foto en proceso. Espera un momento y vuelve a intentar.",
      );
    imageJobs++;
    uploading.add(req.workspaceId);
    try {
      const data = field(req.body.data, "la foto", 1600000),
        match = data.match(
          /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/,
        );
      if (!match) throw fail(400, "Usa una foto JPG, PNG o WebP.");
      const raw = Buffer.from(match[2], "base64");
      if (raw.length > 1200000 || raw.length < 20)
        throw fail(
          400,
          "La foto debe pesar hasta 1,2 MB después de optimizarse.",
        );
      if (
        db
          .prepare("SELECT COUNT(*) n FROM media_images WHERE workspace_id=?")
          .get(req.workspaceId).n >= 200
      )
        throw fail(
          400,
          "Llegaste al límite de 200 imágenes. Elimina imágenes que ya no uses.",
        );
      let result;
      try {
        const meta = await sharp(raw, {
          limitInputPixels: 12000000,
          animated: false,
        }).metadata();
        if (
          !["jpeg", "png", "webp"].includes(meta.format) ||
          !meta.width ||
          !meta.height
        )
          throw Error();
        result = await sharp(raw, { limitInputPixels: 12000000 })
          .rotate()
          .resize(1600, 1600, { fit: "inside", withoutEnlargement: true })
          .webp({ quality: 82 })
          .toBuffer({ resolveWithObject: true });
      } catch {
        throw fail(
          400,
          "No se pudo leer la foto. Prueba otra imagen JPG, PNG o WebP.",
        );
      }
      const used = db
        .prepare(
          "SELECT COALESCE(SUM(bytes),0) bytes FROM media_images WHERE workspace_id=?",
        )
        .get(req.workspaceId).bytes;
      if (used + result.data.length > 50 * 1024 * 1024)
        throw fail(
          400,
          "Este restaurante llegó a 50 MB de fotos. Elimina imágenes que ya no uses.",
        );
      const id = uid();
      await mkdir(mediaDir, { recursive: true, mode: 0o700 });
      await writeFile(join(mediaDir, id + ".webp"), result.data, {
        mode: 0o600,
        flag: "wx",
      });
      try {
        db.prepare("INSERT INTO media_images VALUES (?,?,?,?,?,?,?)").run(
          id,
          req.workspaceId,
          "image/webp",
          result.data.length,
          result.info.width,
          result.info.height,
          now(),
        );
      } catch (e) {
        await unlink(join(mediaDir, id + ".webp")).catch(() => {});
        throw e;
      }
      activity(
        db,
        req.workspaceId,
        "menu.photo.uploaded",
        "Se agregó una foto optimizada al menú.",
        req.user.name,
      );
      res
        .status(201)
        .json({ imageId: id, url: imageUrl(id), bytes: result.data.length });
    } finally {
      imageJobs--;
      uploading.delete(req.workspaceId);
    }
  });
  app.get("/media/:id", async (req, res, next) => {
    if (!/^[a-f0-9-]{36}$/.test(req.params.id)) return res.sendStatus(404);
    const image = db
      .prepare("SELECT * FROM media_images WHERE id=?")
      .get(req.params.id);
    if (!image || !activeBusiness(db, image.workspace_id))
      return res.sendStatus(404);
    const serve = async () => {
      try {
        const data = await readFile(join(mediaDir, image.id + ".webp"));
        res
          .set({
            "Content-Type": "image/webp",
            "X-Content-Type-Options": "nosniff",
            "Cache-Control": "private, max-age=3600",
          })
          .send(data);
      } catch {
        res.sendStatus(404);
      }
    };
    const published = profileFor(db, image.workspace_id);
    const onPublicPage =
      [published.coverImageId, published.logoImageId].includes(image.id) ||
      Boolean(
        db
          .prepare(
            "SELECT id FROM products WHERE workspace_id=? AND image_id=? LIMIT 1",
          )
          .get(image.workspace_id, image.id),
      );
    if (published.publicEnabled && onPublicPage) return serve();
    if (!req.headers.cookie) return res.sendStatus(404);
    auth(req, res, (error) => {
      if (error) return next(error);
      if (req.workspaceId !== image.workspace_id) return res.sendStatus(404);
      void serve();
    });
  });
  app.delete("/api/media/images/:id", auth, async (req, res) => {
    const row = db
      .prepare("SELECT id FROM media_images WHERE id=? AND workspace_id=?")
      .get(req.params.id, req.workspaceId);
    if (!row) throw fail(404, "Foto no encontrada.");
    const profile = profileFor(db, req.workspaceId);
    const draft = JSON.parse(
      storefronts.draftFor(req.workspaceId)?.data ?? "{}",
    );
    if (
      db
        .prepare("SELECT id FROM products WHERE image_id=? AND workspace_id=?")
        .get(row.id, req.workspaceId) ||
      [
        profile.coverImageId,
        profile.logoImageId,
        draft.coverImageId,
        draft.logoImageId,
      ].includes(row.id)
    )
      throw fail(
        409,
        "Quita la foto del menú o de la portada antes de eliminarla.",
      );
    db.prepare("DELETE FROM media_images WHERE id=? AND workspace_id=?").run(
      row.id,
      req.workspaceId,
    );
    await unlink(join(mediaDir, row.id + ".webp")).catch(() => {});
    res.json({ ok: true });
  });
  return { ownedImages, mediaDir };
}
