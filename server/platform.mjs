import { randomBytes } from "node:crypto";
import { uid, now, activity } from "./db.mjs";
import {
  hashPassword,
  verifyPassword,
  tokenHash,
  safeEqual,
  rateLimiter,
} from "./security.mjs";
import { isAdmin, platformSettings } from "./restaurant-db.mjs";
const fail = (status, message) => Object.assign(new Error(message), { status });
const txt = (x, name, max = 200) => {
  if (typeof x !== "string" || !x.trim() || x.trim().length > max)
    throw fail(400, "Revisa " + name + ".");
  return x.trim();
};
const normalizeCode = (code) =>
  String(code ?? "")
    .replace(/^CERCA[\s-]*/i, "")
    .replace(/[\s-]/g, "")
    .toUpperCase();
export function issueRecoveryCodes(db, userId) {
  db.prepare("DELETE FROM recovery_codes WHERE user_id=?").run(userId);
  const codes = Array.from({ length: 8 }, () =>
    randomBytes(16).toString("hex").toUpperCase().match(/.{4}/g).join("-"),
  );
  for (const code of codes)
    db.prepare("INSERT INTO recovery_codes VALUES (?,?,?,NULL,?)").run(
      uid(),
      userId,
      tokenHash(normalizeCode(code)),
      now(),
    );
  return codes.map((c) => "CERCA-" + c);
}
export function installPlatform({
  app,
  db,
  auth,
  baseUrl,
  registrationOpen,
  setupToken,
  mailKey,
  mailFrom,
  fetcher = fetch,
  demoEmail,
}) {
  let closed = false;
  const mailAbort = new AbortController();
  const recoveryLimit = rateLimiter({ limit: 8, windowMs: 15 * 60000 }),
    adminLimit = rateLimiter({ limit: 5, windowMs: 15 * 60000 });
  const admin = (req, res, next) =>
    auth(req, res, (error) =>
      error
        ? next(error)
        : isAdmin(db, req.user.id)
          ? next()
          : next(
              fail(
                403,
                "Este apartado solo está disponible para la administración de la plataforma.",
              ),
            ),
    );
  const setupAvailable = () =>
    typeof setupToken === "string" &&
    setupToken.length >= 32 &&
    db.prepare("SELECT COUNT(*) n FROM platform_admins").get().n === 0;
  db.exec(
    "CREATE TABLE IF NOT EXISTS platform_events(id TEXT PRIMARY KEY,actor_id TEXT NOT NULL,action TEXT NOT NULL,target TEXT NOT NULL,details TEXT NOT NULL,created_at TEXT NOT NULL)",
  );
  const event = (user, action, target, details) =>
    db
      .prepare("INSERT INTO platform_events VALUES (?,?,?,?,?,?)")
      .run(uid(), user, action, target, details, now());
  app.get("/api/account/recovery", auth, (req, res) =>
    res.json({
      remaining: db
        .prepare(
          "SELECT COUNT(*) n FROM recovery_codes WHERE user_id=? AND used_at IS NULL",
        )
        .get(req.user.id).n,
      emailEnabled: Boolean(mailKey && mailFrom),
      adminSetupAvailable: setupAvailable(),
      platformAdmin: isAdmin(db, req.user.id),
    }),
  );
  app.post(
    "/api/account/recovery-codes",
    auth,
    recoveryLimit,
    async (req, res) => {
      if (
        !(await verifyPassword(req.body.password ?? "", req.user.password_hash))
      )
        throw fail(400, "La contraseña actual no es correcta.");
      if (req.user.email === demoEmail)
        throw fail(
          403,
          "Los códigos de recuperación se generan en una cuenta real.",
        );
      const codes = issueRecoveryCodes(db, req.user.id);
      activity(
        db,
        req.workspaceId,
        "auth.recovery.rotated",
        "Se renovaron los códigos de recuperación. Los anteriores dejaron de funcionar.",
        req.user.name,
      );
      res.json({ codes });
    },
  );
  app.post("/api/auth/forgot-password", recoveryLimit, async (req, res) => {
    const email =
      typeof req.body.email === "string"
        ? req.body.email.trim().toLowerCase()
        : "";
    const generic = {
      message:
        "Si la cuenta existe y el correo de recuperación está habilitado, recibirás un enlace para restablecer tu contraseña. También puedes usar un código de recuperación guardado.",
    };
    const user =
      email.length <= 254
        ? db
            .prepare(
              "SELECT id,email,name,workspace_id FROM users WHERE email=? AND email<>?",
            )
            .get(email, demoEmail)
        : null;
    if (user && mailKey && mailFrom) {
      const token = randomBytes(32).toString("hex");
      db.prepare(
        "DELETE FROM password_resets WHERE user_id=? OR expires_at<?",
      ).run(user.id, now());
      db.prepare("INSERT INTO password_resets VALUES (?,?,?,NULL,?)").run(
        tokenHash(token),
        user.id,
        new Date(Date.now() + 30 * 60000).toISOString(),
        now(),
      );
      const link = baseUrl + "/?recover=" + token;
      void (async () => {
        try {
          const response = await fetcher("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: "Bearer " + mailKey,
              "Content-Type": "application/json",
            },
            signal: AbortSignal.any([
              AbortSignal.timeout(10000),
              mailAbort.signal,
            ]),
            body: JSON.stringify({
              from: mailFrom,
              to: [user.email],
              subject: "Recupera tu cuenta de Cerca Restaurantes",
              text: `Solicitaste restablecer tu contraseña. Abre este enlace en los próximos 30 minutos:\n${link}\n\nSolo se puede usar una vez. Si no lo solicitaste, puedes ignorar este mensaje.`,
            }),
          });
          if (closed) return;
          if (!response.ok) throw Error("mail");
          activity(
            db,
            user.workspace_id,
            "auth.recovery.requested",
            "Se solicitó un enlace de recuperación por correo.",
          );
        } catch {
          if (closed) return;
          db.prepare("DELETE FROM password_resets WHERE token_hash=?").run(
            tokenHash(token),
          );
          activity(
            db,
            user.workspace_id,
            "auth.recovery.delivery-failed",
            "No se pudo entregar el correo de recuperación. Revisa el proveedor de correo.",
          );
        }
      })();
    }
    await new Promise((resolve) => setTimeout(resolve, 120));
    res.json(generic);
  });
  app.post("/api/auth/reset-password", recoveryLimit, async (req, res) => {
    const password = req.body.password;
    if (
      req.body.confirmPassword !== undefined &&
      req.body.confirmPassword !== password
    )
      throw fail(400, "Las contraseñas no coinciden.");
    if (
      typeof password !== "string" ||
      password.length < 10 ||
      password.length > 128
    )
      throw fail(
        400,
        "La nueva contraseña debe tener entre 10 y 128 caracteres.",
      );
    const token = typeof req.body.token === "string" ? req.body.token : "",
      code = normalizeCode(req.body.recoveryCode),
      email = String(req.body.email ?? "")
        .trim()
        .toLowerCase();
    let proof, userId;
    if (token && /^[a-f0-9]{64}$/.test(token)) {
      proof = db
        .prepare(
          "SELECT user_id FROM password_resets WHERE token_hash=? AND used_at IS NULL AND expires_at>?",
        )
        .get(tokenHash(token), now());
    } else if (!token && /^[A-F0-9]{32}$/.test(code) && email.length <= 254) {
      proof = db
        .prepare(
          "SELECT c.user_id FROM recovery_codes c JOIN users u ON u.id=c.user_id WHERE c.code_hash=? AND c.used_at IS NULL AND u.email=?",
        )
        .get(tokenHash(code), email);
    }
    if (!proof)
      throw fail(
        400,
        "El enlace o código no es válido, ya fue utilizado o caducó.",
      );
    userId = proof.user_id;
    const hash = await hashPassword(password);
    db.exec("BEGIN IMMEDIATE");
    try {
      const changed = token
        ? db
            .prepare(
              "UPDATE password_resets SET used_at=? WHERE token_hash=? AND used_at IS NULL AND expires_at>?",
            )
            .run(now(), tokenHash(token), now())
        : db
            .prepare(
              "UPDATE recovery_codes SET used_at=? WHERE code_hash=? AND user_id=? AND used_at IS NULL",
            )
            .run(now(), tokenHash(code), userId);
      if (!changed.changes)
        throw fail(400, "El enlace o código ya no está disponible.");
      db.prepare("UPDATE users SET password_hash=? WHERE id=?").run(
        hash,
        userId,
      );
      db.prepare("DELETE FROM sessions WHERE user_id=?").run(userId);
      db.prepare("DELETE FROM password_resets WHERE user_id=?").run(userId);
      const u = db
        .prepare("SELECT workspace_id FROM users WHERE id=?")
        .get(userId);
      activity(
        db,
        u.workspace_id,
        "auth.password.recovered",
        "Se restableció la contraseña y se cerraron todas las sesiones.",
      );
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
    res.json({
      ok: true,
      message: "Contraseña actualizada. Inicia sesión con la nueva contraseña.",
    });
  });
  app.post("/api/platform/claim", auth, adminLimit, async (req, res) => {
    if (!setupAvailable())
      throw fail(403, "La activación de administración no está disponible.");
    if (
      !safeEqual(
        tokenHash(String(req.body.setupToken ?? "")),
        tokenHash(setupToken),
      ) ||
      !(await verifyPassword(req.body.password ?? "", req.user.password_hash))
    )
      throw fail(403, "La clave de activación o contraseña no es correcta.");
    // Recheck after password verification, which yields, to make the bootstrap one-use.
    if (!setupAvailable())
      throw fail(409, "La administración ya fue activada.");
    db.prepare("INSERT INTO platform_admins VALUES (?,?)").run(
      req.user.id,
      now(),
    );
    event(
      req.user.id,
      "platform.claimed",
      req.workspaceId,
      "Se activó la administración con clave de instalación y contraseña.",
    );
    res.json({ ok: true });
  });
  app.get("/api/platform/overview", admin, (_req, res) => {
    const restaurants = db
      .prepare(
        "SELECT w.id,w.name,w.created_at,json_extract(p.data,'$.displayName') public_name,p.slug public_slug,json_extract(p.data,'$.publicEnabled') public_enabled,COALESCE(s.status,'active') status,COALESCE(s.reason,'') reason,u.email owner_email,(SELECT COUNT(*) FROM orders o WHERE o.workspace_id=w.id) orders,(SELECT COUNT(*) FROM reservations r WHERE r.workspace_id=w.id) reservations,(SELECT COUNT(*) FROM media_images m WHERE m.workspace_id=w.id) images FROM workspaces w JOIN users u ON u.workspace_id=w.id LEFT JOIN business_states s ON s.workspace_id=w.id LEFT JOIN restaurant_profiles p ON p.workspace_id=w.id WHERE u.email<>? ORDER BY w.created_at DESC",
      )
      .all(demoEmail);
    res.json({
      metrics: {
        restaurants: restaurants.length,
        active: restaurants.filter((r) => r.status === "active").length,
        suspended: restaurants.filter((r) => r.status === "suspended").length,
        openTickets: db
          .prepare(
            "SELECT COUNT(*) n FROM support_tickets WHERE status<>'closed'",
          )
          .get().n,
        orders: db.prepare("SELECT COUNT(*) n FROM restaurant_orders").get().n,
        reservations: db.prepare("SELECT COUNT(*) n FROM reservations").get().n,
      },
      restaurants,
      settings: platformSettings(db, registrationOpen),
      events: db
        .prepare(
          "SELECT action,target,details,created_at FROM platform_events ORDER BY created_at DESC LIMIT 100",
        )
        .all(),
    });
  });
  app.put("/api/platform/settings", admin, (req, res) => {
    const previous = platformSettings(db, registrationOpen),
      body = req.body;
    if (typeof body.registrationOpen !== "boolean")
      throw fail(400, "Estado del registro no válido.");
    const next = {
      ...previous,
      registrationOpen: body.registrationOpen,
      brandName: txt(
        body.brandName ?? previous.brandName,
        "el nombre de plataforma",
        100,
      ),
      supportEmail: String(body.supportEmail ?? "").trim(),
    };
    if (
      next.supportEmail &&
      (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next.supportEmail) ||
        next.supportEmail.length > 254)
    )
      throw fail(400, "Correo de soporte no válido.");
    db.prepare(
      "INSERT INTO platform_settings VALUES (1,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,updated_at=excluded.updated_at",
    ).run(JSON.stringify(next), now());
    event(
      req.user.id,
      "platform.settings.updated",
      "platform",
      "Se actualizó el registro y la información pública de la plataforma.",
    );
    res.json({ ok: true });
  });
  app.put("/api/platform/restaurants/:id/state", admin, (req, res) => {
    const { status } = req.body;
    if (!["active", "suspended"].includes(status))
      throw fail(400, "Estado no válido.");
    const reason =
      status === "suspended" ? txt(req.body.reason, "el motivo", 500) : "";
    if (!db.prepare("SELECT id FROM workspaces WHERE id=?").get(req.params.id))
      throw fail(404, "Restaurante no encontrado.");
    db.prepare(
      "INSERT INTO business_states VALUES (?,?,?,?) ON CONFLICT(workspace_id) DO UPDATE SET status=excluded.status,reason=excluded.reason,updated_at=excluded.updated_at",
    ).run(req.params.id, status, reason, now());
    event(
      req.user.id,
      "restaurant." + status,
      req.params.id,
      reason || "Se reactivó el restaurante.",
    );
    activity(
      db,
      req.params.id,
      "restaurant.state.updated",
      status === "suspended"
        ? "La administración suspendió el restaurante: " + reason
        : "La administración reactivó el restaurante.",
      "Administración",
    );
    res.json({ ok: true });
  });
  const ticketScope = (req, adminView = false) => {
    const ticket = db
      .prepare(
        "SELECT * FROM support_tickets WHERE id=?" +
          (adminView ? "" : " AND workspace_id=?"),
      )
      .get(...(adminView ? [req.params.id] : [req.params.id, req.workspaceId]));
    if (!ticket) throw fail(404, "Solicitud de soporte no encontrada.");
    return ticket;
  };
  app.get("/api/support/tickets", auth, (req, res) =>
    res.json(
      db
        .prepare(
          "SELECT * FROM support_tickets WHERE workspace_id=? ORDER BY updated_at DESC",
        )
        .all(req.workspaceId),
    ),
  );
  app.post(
    "/api/support/tickets",
    auth,
    rateLimiter({ limit: 10, windowMs: 3600000 }),
    (req, res) => {
      const subject = txt(req.body.subject, "el asunto", 150),
        text = txt(req.body.text, "la consulta", 5000),
        category = req.body.category;
      if (
        ![
          "account",
          "orders",
          "reservations",
          "whatsapp",
          "billing",
          "other",
        ].includes(category)
      )
        throw fail(400, "Categoría no válida.");
      const id = uid(),
        time = now();
      db.prepare("INSERT INTO support_tickets VALUES (?,?,?,?,?,?,?)").run(
        id,
        req.workspaceId,
        subject,
        category,
        "open",
        time,
        time,
      );
      db.prepare("INSERT INTO support_messages VALUES (?,?,?,?,?,?)").run(
        uid(),
        id,
        "business",
        req.user.name,
        text,
        time,
      );
      activity(
        db,
        req.workspaceId,
        "support.created",
        "Se abrió una solicitud de soporte: " + subject,
        req.user.name,
      );
      res.status(201).json({ id });
    },
  );
  app.get("/api/support/tickets/:id", auth, (req, res) => {
    const ticket = ticketScope(req);
    res.json({
      ...ticket,
      messages: db
        .prepare(
          "SELECT author_role,author_name,text,created_at FROM support_messages WHERE ticket_id=? ORDER BY created_at,rowid",
        )
        .all(ticket.id),
    });
  });
  app.post("/api/support/tickets/:id/messages", auth, (req, res) => {
    const t = ticketScope(req),
      text = txt(req.body.text, "el mensaje", 5000);
    db.prepare("INSERT INTO support_messages VALUES (?,?,?,?,?,?)").run(
      uid(),
      t.id,
      "business",
      req.user.name,
      text,
      now(),
    );
    db.prepare(
      "UPDATE support_tickets SET status='open',updated_at=? WHERE id=?",
    ).run(now(), t.id);
    res.status(201).json({ ok: true });
  });
  app.get("/api/platform/support", admin, (_req, res) =>
    res.json(
      db
        .prepare(
          "SELECT t.*,w.name restaurant FROM support_tickets t JOIN workspaces w ON w.id=t.workspace_id ORDER BY t.updated_at DESC",
        )
        .all(),
    ),
  );
  app.get("/api/platform/support/:id", admin, (req, res) => {
    const t = ticketScope(req, true);
    res.json({
      ...t,
      messages: db
        .prepare(
          "SELECT author_role,author_name,text,created_at FROM support_messages WHERE ticket_id=? ORDER BY created_at,rowid",
        )
        .all(t.id),
    });
  });
  app.post("/api/platform/support/:id/messages", admin, (req, res) => {
    const t = ticketScope(req, true),
      text = txt(req.body.text, "el mensaje", 5000),
      status = req.body.status ?? "working";
    if (!["open", "working", "closed"].includes(status))
      throw fail(400, "Estado no válido.");
    db.prepare("INSERT INTO support_messages VALUES (?,?,?,?,?,?)").run(
      uid(),
      t.id,
      "platform",
      "Soporte de Cerca",
      text,
      now(),
    );
    db.prepare(
      "UPDATE support_tickets SET status=?,updated_at=? WHERE id=?",
    ).run(status, now(), t.id);
    event(
      req.user.id,
      "support.replied",
      t.workspace_id,
      "Se respondió una solicitud de soporte.",
    );
    res.status(201).json({ ok: true });
  });
  return {
    setupAvailable,
    emailRecoveryEnabled: Boolean(mailKey && mailFrom),
    close() {
      closed = true;
      mailAbort.abort();
    },
  };
}
