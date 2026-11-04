import { randomBytes } from "node:crypto";
import twilio from "twilio";
import { uid, now, settingsFor, addMessage, activity } from "./db.mjs";
import {
  encrypt,
  decrypt,
  tokenHash,
  safeEqual,
  rateLimiter,
} from "./security.mjs";
import { answerMessage } from "./assistant.mjs";
const fail = (status, message) => Object.assign(new Error(message), { status });
const number = (value) =>
  String(value ?? "")
    .replace(/^whatsapp:/, "")
    .replace(/[ ()-]/g, "");
const validNumber = (value) => /^\+[1-9]\d{7,14}$/.test(value);
const cleanSpeech = (value) =>
  String(value ?? "")
    .replace(/[\p{Extended_Pictographic}\uFE0F]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
const say = (response, text) =>
  response.say({ language: "es-US", voice: "Polly.Lupe" }, cleanSpeech(text));

export function installVoice({ app, db, auth, key, baseUrl, demoEmail }) {
  const inflight = new Map();
  const limit = rateLimiter({ limit: 20, windowMs: 60000 });
  function channel(ws) {
    let row = db
      .prepare("SELECT * FROM voice_channels WHERE workspace_id=?")
      .get(ws);
    if (!row) {
      db.prepare("INSERT INTO voice_channels VALUES (?,?,0,?)").run(
        ws,
        randomBytes(24).toString("hex"),
        now(),
      );
      row = db
        .prepare("SELECT * FROM voice_channels WHERE workspace_id=?")
        .get(ws);
    }
    return row;
  }
  function publicWorkspace(token) {
    if (!/^[a-f0-9]{48}$/.test(token))
      throw fail(404, "Este enlace de llamadas no está disponible.");
    const row = db
      .prepare(
        "SELECT workspace_id FROM voice_channels WHERE public_token=? AND enabled=1",
      )
      .get(token);
    if (!row) throw fail(404, "Este enlace de llamadas no está disponible.");
    const s = settingsFor(db, row.workspace_id);
    if (!s.active || !s.voiceEnabled)
      throw fail(409, "El asistente de voz está en pausa.");
    return row.workspace_id;
  }
  function info(ws) {
    const c = channel(ws),
      i = db
        .prepare("SELECT * FROM voice_integrations WHERE workspace_id=?")
        .get(ws);
    return {
      publicEnabled: Boolean(c.enabled),
      publicUrl: `${baseUrl}/?voice=${c.public_token}`,
      configured: Boolean(i),
      accountSid: i?.account_sid ?? "",
      businessNumber: i?.business_number ?? "",
      forwardNumber: i?.forward_number ?? "",
      status: i?.status ?? "not-configured",
      lastWebhookAt: i?.last_webhook_at ?? null,
      incomingUrl: `${baseUrl}/api/webhooks/voice/twilio/${ws}/incoming`,
      statusUrl: `${baseUrl}/api/webhooks/voice/twilio/${ws}/status`,
    };
  }
  app.get("/api/voice/config", auth, (req, res) =>
    res.json(info(req.workspaceId)),
  );
  app.put("/api/voice/channel", auth, (req, res) => {
    if (typeof req.body.enabled !== "boolean")
      throw fail(400, "Elige si quieres publicar el enlace de voz.");
    channel(req.workspaceId);
    db.prepare(
      "UPDATE voice_channels SET enabled=?,updated_at=? WHERE workspace_id=?",
    ).run(req.body.enabled ? 1 : 0, now(), req.workspaceId);
    activity(
      db,
      req.workspaceId,
      "voice.channel.updated",
      req.body.enabled
        ? "Se activó el enlace público de voz."
        : "Se desactivó el enlace público de voz.",
      req.user.name,
    );
    res.json(info(req.workspaceId));
  });
  app.put("/api/voice/integration", auth, limit, (req, res) => {
    if (req.user.email === demoEmail)
      throw fail(403, "Crea tu propia cuenta para conectar llamadas reales.");
    const { accountSid, authToken } = req.body,
      businessNumber = number(req.body.businessNumber),
      forwardNumber = number(req.body.forwardNumber);
    if (
      !/^AC[a-f0-9]{32}$/i.test(accountSid ?? "") ||
      !/^[a-f0-9]{32}$/i.test(authToken ?? "")
    )
      throw fail(400, "Revisa el Account SID y el Auth Token de Twilio.");
    if (
      !validNumber(businessNumber) ||
      (forwardNumber && !validNumber(forwardNumber)) ||
      forwardNumber === businessNumber
    )
      throw fail(
        400,
        "Usa números válidos con código de país. El destino humano debe ser otro número.",
      );
    db.prepare(
      `INSERT INTO voice_integrations (workspace_id,encrypted_credentials,account_sid,business_number,forward_number,status,updated_at) VALUES (?,?,?,?,?,'configured',?) ON CONFLICT(workspace_id) DO UPDATE SET encrypted_credentials=excluded.encrypted_credentials,account_sid=excluded.account_sid,business_number=excluded.business_number,forward_number=excluded.forward_number,status='configured',last_webhook_at=NULL,updated_at=excluded.updated_at`,
    ).run(
      req.workspaceId,
      encrypt({ authToken }, key),
      accountSid,
      businessNumber,
      forwardNumber,
      now(),
    );
    activity(
      db,
      req.workspaceId,
      "voice.configured",
      "Se guardó la configuración cifrada del proveedor. La activación y una llamada real siguen pendientes.",
      req.user.name,
    );
    res.json(info(req.workspaceId));
  });
  app.delete("/api/voice/integration", auth, (req, res) => {
    db.prepare("DELETE FROM voice_integrations WHERE workspace_id=?").run(
      req.workspaceId,
    );
    db.prepare(
      "UPDATE voice_sessions SET ended_at=? WHERE workspace_id=? AND mode='twilio' AND ended_at IS NULL",
    ).run(now(), req.workspaceId);
    activity(
      db,
      req.workspaceId,
      "voice.disconnected",
      "Se eliminó la conexión del proveedor de llamadas.",
      req.user.name,
    );
    res.json(info(req.workspaceId));
  });
  app.get("/api/public/store/:token", limit, (req, res) => {
    const ws = publicWorkspace(req.params.token),
      s = settingsFor(db, ws);
    res.json({
      name: db.prepare("SELECT name FROM workspaces WHERE id=?").get(ws).name,
      assistantName: s.assistantName,
      voiceRate: s.voiceRate,
      welcome: s.welcome,
    });
  });
  function createSession(ws, mode, from = "", callSid = null) {
    const s = settingsFor(db, ws);
    if (!s.active || !s.voiceEnabled)
      throw fail(409, "El asistente de voz está en pausa.");
    const existing =
      mode === "twilio"
        ? db
            .prepare(
              "SELECT id FROM conversations WHERE workspace_id=? AND phone=? AND channel='voice-whatsapp'",
            )
            .get(ws, from)
        : null;
    const id = uid(),
      cid = existing?.id ?? uid(),
      token = randomBytes(32).toString("hex"),
      time = now(),
      expiresAt = new Date(Date.now() + 30 * 60000).toISOString();
    if (!existing)
      db.prepare(
        "INSERT INTO conversations VALUES (?,?,?,?,?,?,?,?,?,?,?)",
      ).run(
        cid,
        ws,
        mode === "owner"
          ? "Llamada de prueba"
          : mode === "public"
            ? "Cliente · llamada web"
            : "Cliente · llamada WhatsApp",
        from || `web:${id}`,
        mode === "owner"
          ? "voice-test"
          : mode === "public"
            ? "voice-web"
            : "voice-whatsapp",
        "open",
        0,
        0,
        "voz",
        time,
        time,
      );
    db.prepare("DELETE FROM conversation_memory WHERE conversation_id=?").run(
      cid,
    );
    db.prepare(
      "INSERT INTO voice_sessions (id,workspace_id,conversation_id,token_hash,mode,provider_call_id,created_at,expires_at) VALUES (?,?,?,?,?,?,?,?)",
    ).run(id, ws, cid, tokenHash(token), mode, callSid, time, expiresAt);
    const greeting = `Hola, soy ${s.assistantName}, la asistente virtual de ${db.prepare("SELECT name FROM workspaces WHERE id=?").get(ws).name}. Puedo ayudarte con nuestro menú, productos, precios y horarios. Esta conversación se guarda en texto para que el equipo pueda atenderte. ¿Qué te gustaría consultar?`;
    addMessage(db, cid, "assistant", greeting, {
      status: "received",
      source: "voice",
    });
    activity(
      db,
      ws,
      "voice.started",
      mode === "owner"
        ? "Se inició una llamada de prueba en la web."
        : mode === "public"
          ? "Un cliente inició una llamada desde la web."
          : "Se recibió una llamada mediante el proveedor.",
    );
    return { id, token, conversationId: cid, greeting, expiresAt };
  }
  app.post("/api/voice/sessions", auth, limit, (req, res) =>
    res.status(201).json(createSession(req.workspaceId, "owner")),
  );
  app.post("/api/public/voice/:token/sessions", limit, (req, res) =>
    res
      .status(201)
      .json(createSession(publicWorkspace(req.params.token), "public")),
  );
  function webSession(req) {
    const row = db
      .prepare(
        "SELECT * FROM voice_sessions WHERE id=? AND mode IN ('owner','public')",
      )
      .get(req.params.id);
    const token = String(req.get("Authorization") ?? "").replace(
      /^Bearer /,
      "",
    );
    if (
      !row ||
      !/^[a-f0-9]{64}$/.test(token) ||
      !safeEqual(row.token_hash, tokenHash(token))
    )
      throw fail(401, "La sesión de llamada no es válida.");
    if (row.ended_at || row.expires_at < now())
      throw fail(410, "La llamada terminó. Inicia otra para continuar.");
    if (
      row.mode === "public" &&
      !db
        .prepare("SELECT enabled FROM voice_channels WHERE workspace_id=?")
        .get(row.workspace_id)?.enabled
    )
      throw fail(410, "El enlace de llamadas fue desactivado.");
    return row;
  }
  async function turn(row, text) {
    if (row.turn_count >= 40)
      throw fail(
        410,
        "Alcanzaste el límite de esta llamada. Inicia una nueva para continuar.",
      );
    const settings = settingsFor(db, row.workspace_id),
      conversation = db
        .prepare("SELECT * FROM conversations WHERE id=?")
        .get(row.conversation_id);
    if (!settings.active || !settings.voiceEnabled)
      throw fail(409, "El asistente de voz está en pausa.");
    if (conversation.handoff)
      throw fail(409, "Tu solicitud ya está pendiente de atención del equipo.");
    addMessage(db, conversation.id, "user", text, { source: "voice" });
    const reply = await answerMessage({
      db,
      workspaceId: row.workspace_id,
      conversation,
      text,
      voice: true,
    });
    addMessage(db, conversation.id, "assistant", reply.text, {
      source: "voice",
      status: "received",
    });
    db.prepare(
      "UPDATE voice_sessions SET turn_count=turn_count+1 WHERE id=?",
    ).run(row.id);
    db.prepare("UPDATE conversations SET topic=? WHERE id=?").run(
      reply.category,
      conversation.id,
    );
    return reply;
  }
  app.post("/api/voice/sessions/:id/turn", limit, async (req, res) => {
    const row = webSession(req),
      text = req.body.text;
    if (typeof text !== "string" || !text.trim() || text.length > 1500)
      throw fail(400, "Escribe o di un mensaje de hasta 1500 caracteres.");
    if (inflight.has(row.id)) throw fail(409, "Espera la respuesta anterior.");
    const pending = turn(row, text.trim());
    inflight.set(row.id, pending);
    try {
      res.json(await pending);
    } finally {
      inflight.delete(row.id);
    }
  });
  app.post("/api/voice/sessions/:id/end", limit, (req, res) => {
    const row = webSession(req);
    db.prepare("UPDATE voice_sessions SET ended_at=? WHERE id=?").run(
      now(),
      row.id,
    );
    activity(
      db,
      row.workspace_id,
      "voice.ended",
      "Finalizó la llamada en la web.",
    );
    res.json({ ok: true });
  });
  app.get("/api/voice/history", auth, (req, res) =>
    res.json(
      db
        .prepare(
          "SELECT id,conversation_id,mode,created_at,expires_at,ended_at,turn_count FROM voice_sessions WHERE workspace_id=? ORDER BY created_at DESC LIMIT 50",
        )
        .all(req.workspaceId),
    ),
  );

  function verify(req) {
    const row = db
      .prepare("SELECT * FROM voice_integrations WHERE workspace_id=?")
      .get(req.params.workspaceId);
    if (!row) throw fail(404, "Canal de voz no configurado.");
    const signature = req.get("X-Twilio-Signature"),
      secret = decrypt(row.encrypted_credentials, key).authToken;
    if (
      !signature ||
      !twilio.validateRequest(
        secret,
        signature,
        baseUrl + req.originalUrl,
        req.body,
      ) ||
      req.body.AccountSid !== row.account_sid
    )
      throw fail(403, "Firma de llamada no válida.");
    if (!/^CA[a-f0-9]{32}$/i.test(req.body.CallSid ?? ""))
      throw fail(400, "Llamada no válida.");
    return row;
  }
  function xmlEnd(message) {
    const r = new twilio.twiml.VoiceResponse();
    say(r, message);
    r.hangup();
    return r.toString();
  }
  function nextXml(ws, sessionId, message) {
    const response = new twilio.twiml.VoiceResponse(),
      step = randomBytes(16).toString("hex");
    db.prepare("UPDATE voice_sessions SET state=? WHERE id=?").run(
      JSON.stringify({ step }),
      sessionId,
    );
    const action = `${baseUrl}/api/webhooks/voice/twilio/${ws}/turn?step=${step}`;
    const gather = response.gather({
      input: "speech dtmf",
      language: "es-CO",
      speechTimeout: "auto",
      timeout: 6,
      actionOnEmptyResult: true,
      method: "POST",
      action,
      numDigits: 1,
    });
    say(
      gather,
      message +
        " Puedes decir tu consulta o marcar cero para solicitar al equipo.",
    );
    response.redirect({ method: "POST" }, action);
    return response.toString();
  }
  async function once(sessionId, nonce, action) {
    const cached = db
      .prepare(
        "SELECT response_xml FROM voice_turns WHERE session_id=? AND nonce=?",
      )
      .get(sessionId, nonce);
    if (cached) return cached.response_xml;
    const k = sessionId + ":" + nonce;
    if (inflight.has(k)) return inflight.get(k);
    const pending = (async () => {
      const xml = await action();
      db.prepare("INSERT OR IGNORE INTO voice_turns VALUES (?,?,?,?)").run(
        sessionId,
        nonce,
        xml,
        now(),
      );
      return xml;
    })();
    inflight.set(k, pending);
    try {
      return await pending;
    } finally {
      inflight.delete(k);
    }
  }
  app.post(
    "/api/webhooks/voice/twilio/:workspaceId/incoming",
    async (req, res) => {
      const integration = verify(req),
        ws = integration.workspace_id;
      if (
        number(req.body.To) !== integration.business_number ||
        !validNumber(number(req.body.From))
      )
        throw fail(403, "El destino o remitente de la llamada no coincide.");
      let row = db
        .prepare("SELECT * FROM voice_sessions WHERE provider_call_id=?")
        .get(req.body.CallSid);
      if (row && row.workspace_id !== ws)
        throw fail(403, "Llamada no autorizada.");
      const settings = settingsFor(db, ws);
      if (!settings.active || !settings.voiceEnabled)
        return res
          .type("text/xml")
          .send(
            xmlEnd(
              "Nuestro asistente está en pausa. Por favor, escríbenos por WhatsApp.",
            ),
          );
      let greeting;
      if (!row) {
        const session = createSession(
          ws,
          "twilio",
          number(req.body.From),
          req.body.CallSid,
        );
        greeting = session.greeting;
        row = db
          .prepare("SELECT * FROM voice_sessions WHERE id=?")
          .get(session.id);
      }
      if (row.ended_at || row.expires_at < now())
        return res.type("text/xml").send(xmlEnd("Esta llamada ya terminó."));
      db.prepare(
        "UPDATE voice_integrations SET status='webhook-received',last_webhook_at=? WHERE workspace_id=?",
      ).run(now(), ws);
      const xml = await once(row.id, "incoming", () =>
        nextXml(
          ws,
          row.id,
          greeting ?? "Hola, ¿en qué puedo ayudarte con la tienda?",
        ),
      );
      res.type("text/xml").send(xml);
    },
  );
  app.post("/api/webhooks/voice/twilio/:workspaceId/turn", async (req, res) => {
    const integration = verify(req),
      row = db
        .prepare(
          "SELECT * FROM voice_sessions WHERE provider_call_id=? AND workspace_id=?",
        )
        .get(req.body.CallSid, integration.workspace_id),
      nonce = String(req.query.step ?? "");
    if (!row || !/^[a-f0-9]{32}$/.test(nonce))
      throw fail(403, "Turno no autorizado.");
    const cached = db
      .prepare(
        "SELECT response_xml FROM voice_turns WHERE session_id=? AND nonce=?",
      )
      .get(row.id, nonce);
    if (cached) return res.type("text/xml").send(cached.response_xml);
    if (row.ended_at || row.expires_at < now())
      return res
        .type("text/xml")
        .send(xmlEnd("La llamada terminó. Gracias por contactarnos."));
    if (JSON.parse(row.state).step !== nonce)
      throw fail(409, "Este turno de llamada ya no está vigente.");
    const xml = await once(row.id, nonce, async () => {
      const text =
        req.body.Digits === "0"
          ? "Hablar con una persona"
          : String(req.body.SpeechResult ?? "")
              .trim()
              .slice(0, 1500);
      if (!text) {
        const state = JSON.parse(
            db
              .prepare("SELECT state FROM voice_sessions WHERE id=?")
              .get(row.id).state,
          ),
          misses = (state.misses ?? 0) + 1;
        if (misses >= 3) {
          db.prepare("UPDATE voice_sessions SET ended_at=? WHERE id=?").run(
            now(),
            row.id,
          );
          return xmlEnd(
            "No pude escucharte. Puedes escribirnos por WhatsApp. Gracias por llamar.",
          );
        }
        const xml = nextXml(
          row.workspace_id,
          row.id,
          "No logré escucharte. ¿Puedes repetir tu consulta de la tienda?",
        );
        const updated = JSON.parse(
          db.prepare("SELECT state FROM voice_sessions WHERE id=?").get(row.id)
            .state,
        );
        db.prepare("UPDATE voice_sessions SET state=? WHERE id=?").run(
          JSON.stringify({ ...updated, misses }),
          row.id,
        );
        return xml;
      }
      let reply;
      try {
        reply = await turn(row, text);
      } catch (error) {
        if (error.status === 409 || error.status === 410)
          return xmlEnd(error.message);
        throw error;
      }
      if (reply.handoff) {
        db.prepare("UPDATE voice_sessions SET ended_at=? WHERE id=?").run(
          now(),
          row.id,
        );
        if (integration.forward_number) {
          const r = new twilio.twiml.VoiceResponse();
          say(
            r,
            "Voy a intentar comunicarte con el equipo. La conexión depende de su disponibilidad.",
          );
          r.dial(
            { timeout: 20, answerOnBridge: true },
            integration.forward_number,
          );
          say(
            r,
            "Si no logramos conectarte, escríbenos por WhatsApp para continuar.",
          );
          r.hangup();
          return r.toString();
        }
        return xmlEnd(reply.text);
      }
      return nextXml(row.workspace_id, row.id, reply.text);
    });
    res.type("text/xml").send(xml);
  });
  app.post("/api/webhooks/voice/twilio/:workspaceId/status", (req, res) => {
    const integration = verify(req);
    if (
      ["completed", "busy", "failed", "no-answer", "canceled"].includes(
        req.body.CallStatus,
      )
    ) {
      db.prepare(
        "UPDATE voice_sessions SET ended_at=COALESCE(ended_at,?) WHERE provider_call_id=? AND workspace_id=?",
      ).run(now(), req.body.CallSid, integration.workspace_id);
    }
    res.sendStatus(204);
  });
}
