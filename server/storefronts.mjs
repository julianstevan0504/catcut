import { profileFor } from "./restaurant-db.mjs";
import { validateRestaurant } from "../shared/restaurant.ts";
import {
  pageFields,
  pageFromProfile,
  foldSearch,
} from "../shared/storefront.ts";
import { activity, now } from "./db.mjs";
const fail = (status, message) => Object.assign(new Error(message), { status });
export function installStorefronts({
  app,
  db,
  auth,
  baseUrl,
  ownedImages,
  imageUrl,
  publicLimit,
}) {
  db.function("cerca_public_search", { deterministic: true }, foldSearch);
  const link = (slug) => baseUrl + "/r/" + slug;
  const workspaceName = (ws) =>
    db.prepare("SELECT name FROM workspaces WHERE id=?").get(ws).name;
  const record = (ws) =>
    db
      .prepare("SELECT * FROM restaurant_page_drafts WHERE workspace_id=?")
      .get(ws);
  function current(ws) {
    const profile = profileFor(db, ws),
      saved = record(ws);
    return {
      profile,
      draft: saved ? JSON.parse(saved.data) : pageFromProfile(profile),
      revision: saved?.revision ?? 0,
      updatedAt: saved?.updated_at ?? null,
    };
  }
  function view(ws) {
    const c = current(ws);
    return {
      ...c,
      draft: {
        ...c.draft,
        displayName: c.draft.displayName || workspaceName(ws),
      },
      publicUrl: link(c.profile.slug),
      directoryUrl: baseUrl + "/?explore=restaurants",
      hasUnpublishedChanges:
        JSON.stringify(c.draft) !== JSON.stringify(pageFromProfile(c.profile)),
      productCount: db
        .prepare("SELECT COUNT(*) n FROM products WHERE workspace_id=?")
        .get(ws).n,
    };
  }
  app.get("/api/restaurant/page", auth, (req, res) =>
    res.json(view(req.workspaceId)),
  );
  app.put("/api/restaurant/page", auth, (req, res) => {
    const input = req.body.draft,
      expected = req.body.revision;
    if (
      !input ||
      typeof input !== "object" ||
      Array.isArray(input) ||
      Object.keys(input).some((k) => !pageFields.includes(k)) ||
      !Number.isInteger(expected) ||
      expected < 0
    )
      throw fail(400, "Revisa el borrador de tu página.");
    const c = current(req.workspaceId),
      validated = validateRestaurant({ ...c.profile, ...input }, c.profile),
      draft = pageFromProfile(validated);
    ownedImages(req.workspaceId, [draft.coverImageId, draft.logoImageId]);
    db.exec("BEGIN IMMEDIATE");
    try {
      const latest = record(req.workspaceId);
      if ((latest?.revision ?? 0) !== expected)
        throw fail(
          409,
          "El borrador cambió en otro dispositivo. Recarga antes de guardar para conservar esos cambios.",
        );
      db.prepare(
        "INSERT INTO restaurant_page_drafts VALUES (?,?,?,?) ON CONFLICT(workspace_id) DO UPDATE SET data=excluded.data,revision=excluded.revision,updated_at=excluded.updated_at",
      ).run(req.workspaceId, JSON.stringify(draft), expected + 1, now());
      activity(
        db,
        req.workspaceId,
        "storefront.draft.saved",
        "Se guardó un borrador de la página pública. La publicación actual sigue igual.",
        req.user.name,
      );
      db.exec("COMMIT");
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
    res.json(view(req.workspaceId));
  });
  app.post("/api/restaurant/page/publish", auth, (req, res) => {
    if (!Number.isInteger(req.body.revision))
      throw fail(400, "Guarda el borrador antes de publicar.");
    const c = current(req.workspaceId);
    if (c.revision !== req.body.revision)
      throw fail(
        409,
        "El borrador cambió. Recarga y revisa la versión antes de publicar.",
      );
    if (
      !db
        .prepare("SELECT id FROM products WHERE workspace_id=? LIMIT 1")
        .get(req.workspaceId)
    )
      throw fail(
        400,
        "Agrega al menos un plato o producto antes de publicar tu página.",
      );
    const p = validateRestaurant(
      { ...c.profile, ...c.draft, publicEnabled: true },
      c.profile,
    );
    if (!p.whatsappNumber)
      throw fail(
        400,
        "Agrega el WhatsApp de este restaurante en Contenido antes de publicar su página.",
      );
    ownedImages(req.workspaceId, [p.coverImageId, p.logoImageId]);
    db.exec("BEGIN IMMEDIATE");
    try {
      db.prepare(
        "UPDATE restaurant_profiles SET slug=?,data=?,updated_at=? WHERE workspace_id=?",
      ).run(p.slug, JSON.stringify(p), now(), req.workspaceId);
      activity(
        db,
        req.workspaceId,
        "storefront.published",
        "Se publicó la página del restaurante y su ficha en el buscador.",
        req.user.name,
      );
      db.exec("COMMIT");
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
    res.json(view(req.workspaceId));
  });
  app.post("/api/restaurant/page/unpublish", auth, (req, res) => {
    const p = profileFor(db, req.workspaceId);
    p.publicEnabled = false;
    db.prepare(
      "UPDATE restaurant_profiles SET data=?,updated_at=? WHERE workspace_id=?",
    ).run(JSON.stringify(p), now(), req.workspaceId);
    activity(
      db,
      req.workspaceId,
      "storefront.unpublished",
      "Se retiró la página del buscador y del acceso público. Los pedidos anteriores se conservan.",
      req.user.name,
    );
    res.json(view(req.workspaceId));
  });
  app.get("/api/public/restaurants", publicLimit, (req, res) => {
    const text = typeof req.query.q === "string" ? req.query.q : "",
      city = typeof req.query.city === "string" ? req.query.city : "";
    if (text.length > 100 || city.length > 100)
      throw fail(400, "Usa una búsqueda más corta.");
    const page = Number(req.query.page ?? 1),
      limit = Number(req.query.limit ?? 12),
      service = String(req.query.service ?? "all");
    if (
      !Number.isInteger(page) ||
      page < 1 ||
      page > 1000 ||
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 24 ||
      !["all", "delivery", "pickup", "dineIn", "reservations"].includes(service)
    )
      throw fail(400, "Revisa los filtros de búsqueda.");
    const term =
      "%" + foldSearch(text).replace(/[\\%_]/g, (c) => "\\" + c) + "%";
    const clauses = [
        "json_extract(p.data,'$.publicEnabled')=1",
        "COALESCE(b.status,'active')='active'",
        "cerca_public_search(w.name||' '||COALESCE(json_extract(p.data,'$.displayName'),'')||' '||COALESCE(json_extract(p.data,'$.cuisine'),'')||' '||COALESCE(json_extract(p.data,'$.city'),'')||' '||COALESCE(json_extract(p.data,'$.specialties'),'')) LIKE ? ESCAPE '\\'",
      ],
      params = [term];
    if (city) {
      clauses.push("cerca_public_search(json_extract(p.data,'$.city'))=?");
      params.push(foldSearch(city));
    }
    if (service !== "all")
      clauses.push(
        service === "reservations"
          ? "json_extract(p.data,'$.reservationsEnabled')=1"
          : "json_extract(p.data,'$.services." + service + "')=1",
      );
    const from =
      " FROM restaurant_profiles p JOIN workspaces w ON w.id=p.workspace_id LEFT JOIN business_states b ON b.workspace_id=p.workspace_id WHERE " +
      clauses.join(" AND ");
    const total = db.prepare("SELECT COUNT(*) n" + from).get(...params).n;
    const rows = db
      .prepare(
        "SELECT p.workspace_id,w.name" +
          from +
          " ORDER BY cerca_public_search(COALESCE(NULLIF(json_extract(p.data,'$.displayName'),''),w.name)),p.slug LIMIT ? OFFSET ?",
      )
      .all(...params, limit, (page - 1) * limit);
    const restaurants = rows.map((row) => {
      const p = profileFor(db, row.workspace_id),
        menu = db
          .prepare(
            "SELECT COUNT(*) items,MIN(CASE WHEN stock>0 THEN price END) fromPrice FROM products WHERE workspace_id=?",
          )
          .get(row.workspace_id);
      return {
        slug: p.slug,
        name: p.displayName || row.name,
        cuisine: p.cuisine,
        city: p.city,
        specialties: p.specialties,
        welcome: p.welcome,
        services: p.services,
        reservationsEnabled: p.reservationsEnabled,
        acceptingOrders: p.acceptingOrders,
        coverImageUrl: imageUrl(p.coverImageId),
        logoImageUrl: imageUrl(p.logoImageId),
        primaryColor: p.design.primaryColor,
        publicUrl: link(p.slug),
        ...menu,
      };
    });
    const cities = db
      .prepare(
        "SELECT DISTINCT json_extract(p.data,'$.city') city FROM restaurant_profiles p LEFT JOIN business_states b ON b.workspace_id=p.workspace_id WHERE json_extract(p.data,'$.publicEnabled')=1 AND COALESCE(b.status,'active')='active' AND COALESCE(json_extract(p.data,'$.city'),'')<>'' ORDER BY city LIMIT 100",
      )
      .all()
      .map((x) => x.city);
    res
      .set("Cache-Control", "no-store")
      .json({ restaurants, total, page, limit, cities });
  });
  app.get("/api/restaurant/notifications", auth, (req, res) => {
    const rows = db
      .prepare(
        "SELECT o.id,o.code,o.customer,o.phone,o.items,o.total,o.created_at,r.fulfillment,r.delivery_address FROM orders o JOIN restaurant_orders r ON r.order_id=o.id LEFT JOIN restaurant_notification_reads n ON n.order_id=o.id AND n.workspace_id=o.workspace_id WHERE o.workspace_id=? AND n.order_id IS NULL ORDER BY o.created_at DESC LIMIT 30",
      )
      .all(req.workspaceId);
    const unread = db
      .prepare(
        "SELECT COUNT(*) n FROM restaurant_orders r LEFT JOIN restaurant_notification_reads n ON n.order_id=r.order_id AND n.workspace_id=r.workspace_id WHERE r.workspace_id=? AND n.order_id IS NULL",
      )
      .get(req.workspaceId).n;
    res.json({ items: rows, unread });
  });
  app.post("/api/restaurant/notifications/read", auth, (req, res) => {
    const ids = req.body.ids;
    if (
      !Array.isArray(ids) ||
      ids.length > 30 ||
      ids.some((id) => typeof id !== "string")
    )
      throw fail(400, "Revisa los avisos seleccionados.");
    const insert = db.prepare(
      "INSERT OR IGNORE INTO restaurant_notification_reads VALUES (?,?,?)",
    );
    for (const id of ids) {
      if (
        !db
          .prepare(
            "SELECT order_id FROM restaurant_orders WHERE order_id=? AND workspace_id=?",
          )
          .get(id, req.workspaceId)
      )
        throw fail(404, "Aviso no encontrado.");
    }
    db.exec("BEGIN");
    try {
      for (const id of ids) insert.run(req.workspaceId, id, now());
      db.exec("COMMIT");
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
    res.json({ ok: true });
  });
  return { draftFor: record };
}
