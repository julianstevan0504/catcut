import { useState, useEffect } from "react";
import type { FormEvent } from "react";
import {
  ArrowUpRight,
  Bot,
  Check,
  ChevronRight,
  Heart,
  LoaderCircle,
  MessageCircle,
  Plus,
  RotateCcw,
  Send,
  ShieldCheck,
  Smile,
  Sparkles,
  Trash2,
  WandSparkles,
} from "lucide-react";
import { post, put } from "../api";
import { useApp } from "../context";
import { PageHeading, SaveButton, Toggle } from "../components";
import type { Settings } from "../types";

export function Assistant() {
  const { session, refreshSession, notify } = useApp();
  const [draft, setDraft] = useState<Settings>(() =>
    structuredClone(session.settings),
  );
  const [tab, setTab] = useState("personality"),
    [busy, setBusy] = useState(false);
  function change<K extends keyof Settings>(key: K, value: Settings[K]) {
    setDraft((d) => ({
      ...d,
      [key]: value,
      ...(key === "assistantName" && typeof value === "string"
        ? {
            welcome: d.welcome.replace(
              `Soy ${d.assistantName}`,
              `Soy ${value}`,
            ),
          }
        : {}),
    }));
  }
  useEffect(() => {
    setDraft((d) => ({ ...d, active: session.settings.active }));
  }, [session.settings.active]);
  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await put("/settings", draft);
      await refreshSession();
      notify("Tu asistente ya tiene tus nuevos ajustes.");
    } catch (e) {
      notify((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="UN ASISTENTE. MUCHA PERSONALIDAD."
        title="Una voz que se siente tuya."
        subtitle="Cuéntale sobre tu tienda y dale ese toque que hace único a tu negocio."
      />
      <div className="assistant-editor-layout">
        <section>
          <div className="card assistant-activation">
            <span className="activation-icon">
              <Sparkles size={23} />
            </span>
            <div>
              <h3>
                Tu asistente,{" "}
                {draft.active ? "listo para conversar" : "en pausa"}
              </h3>
              <p>
                {draft.active
                  ? "Responde consultas y deja las decisiones importantes en tus manos."
                  : "Los mensajes seguirán llegando. Las respuestas automáticas están pausadas."}
              </p>
            </div>
            <Toggle
              checked={draft.active}
              onChange={() => change("active", !draft.active)}
              label="Activar asistente"
            />
          </div>
          <form onSubmit={(e) => void save(e)}>
            <div className="card assistant-form-card">
              <div className="tabs editor-tabs">
                {[
                  { id: "personality", label: "Personalidad" },
                  { id: "store", label: "Sobre tu tienda" },
                  { id: "faqs", label: "Preguntas frecuentes" },
                ].map((t) => (
                  <button
                    type="button"
                    key={t.id}
                    className={tab === t.id ? "active" : ""}
                    onClick={() => setTab(t.id)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              {tab === "personality" && (
                <div className="form-section">
                  <div className="form-section-heading">
                    <span className="section-icon">
                      <Bot size={20} />
                    </span>
                    <div>
                      <h3>Que tenga su propio estilo.</h3>
                      <p>
                        El nombre y el tono que tus clientes van a recordar.
                      </p>
                    </div>
                  </div>
                  <label className="field-label">
                    Nombre de tu asistente
                    <input
                      value={draft.assistantName}
                      onChange={(e) => change("assistantName", e.target.value)}
                      maxLength={60}
                      required
                    />
                    <small>
                      Se presenta como asistente virtual, con transparencia.
                    </small>
                  </label>
                  <label className="field-label">
                    ¿Cómo quieres que converse?
                  </label>
                  <div className="tone-options">
                    {[
                      {
                        id: "cercano",
                        label: "Cercano",
                        description: "Amable y natural",
                        icon: Heart,
                      },
                      {
                        id: "profesional",
                        label: "Profesional",
                        description: "Claro y respetuoso",
                        icon: MessageCircle,
                      },
                      {
                        id: "entusiasta",
                        label: "Entusiasta",
                        description: "Alegre y expresivo",
                        icon: Smile,
                      },
                    ].map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        className={`tone-option ${draft.tone === t.id ? "selected" : ""}`}
                        onClick={() => change("tone", t.id as Settings["tone"])}
                      >
                        <t.icon size={20} />
                        <strong>{t.label}</strong>
                        <small>{t.description}</small>
                        {draft.tone === t.id && (
                          <span className="tone-check">
                            <Check size={11} />
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                  <label className="field-label">
                    Mensaje de bienvenida
                    <textarea
                      rows={4}
                      value={draft.welcome}
                      onChange={(e) => change("welcome", e.target.value)}
                      maxLength={1000}
                      required
                    />
                    <small>
                      Un primer «hola» cálido puede hacer la diferencia.
                    </small>
                  </label>
                  <div className="info-note">
                    <WandSparkles size={18} />
                    <p>
                      {session.ai.configured
                        ? `La IA adapta las respuestas a tu tono usando ${session.ai.model}.`
                        : "Estás usando el asistente local: responde con tus datos y textos configurados. Para adaptar libremente el tono, activa la API de IA en el servidor."}
                    </p>
                  </div>
                </div>
              )}
              {tab === "store" && (
                <div className="form-section">
                  <div className="form-section-heading">
                    <span className="section-icon">
                      <Heart size={20} />
                    </span>
                    <div>
                      <h3>Nadie conoce tu tienda como tú.</h3>
                      <p>Esta es la información que usará para responder.</p>
                    </div>
                  </div>
                  {(
                    [
                      {
                        key: "description",
                        label: "Cuéntanos sobre tu tienda",
                        rows: 3,
                      },
                      {
                        key: "hours",
                        label: "Horario de atención humana",
                        rows: 3,
                      },
                      {
                        key: "shipping",
                        label: "Envíos y tiempos de entrega",
                        rows: 3,
                      },
                      {
                        key: "returns",
                        label: "Cambios y devoluciones",
                        rows: 3,
                      },
                      { key: "payments", label: "Medios de pago", rows: 3 },
                    ] as const
                  ).map((f) => (
                    <label className="field-label" key={f.key}>
                      {f.label}
                      <textarea
                        rows={f.rows}
                        value={draft[f.key]}
                        onChange={(e) => change(f.key, e.target.value)}
                        required
                        maxLength={f.key === "hours" ? 1500 : 2000}
                      />
                    </label>
                  ))}
                </div>
              )}
              {tab === "faqs" && (
                <div className="form-section">
                  <div className="form-section-heading">
                    <span className="section-icon">
                      <MessageCircle size={20} />
                    </span>
                    <div>
                      <h3>Las preguntas de siempre, resueltas.</h3>
                      <p>Agrega lo que tus clientes suelen preguntarte.</p>
                    </div>
                  </div>
                  {draft.faqs.map((faq, i) => (
                    <div className="faq-editor" key={faq.id}>
                      <div className="faq-number">
                        PREGUNTA {i + 1}
                        <button
                          type="button"
                          className="icon-button danger"
                          aria-label={`Eliminar pregunta ${i + 1}`}
                          onClick={() =>
                            change(
                              "faqs",
                              draft.faqs.filter((f) => f.id !== faq.id),
                            )
                          }
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                      <label className="field-label">
                        Pregunta
                        <input
                          value={faq.question}
                          maxLength={300}
                          required
                          onChange={(e) =>
                            change(
                              "faqs",
                              draft.faqs.map((f) =>
                                f.id === faq.id
                                  ? { ...f, question: e.target.value }
                                  : f,
                              ),
                            )
                          }
                        />
                      </label>
                      <label className="field-label">
                        Respuesta
                        <textarea
                          rows={3}
                          maxLength={2000}
                          required
                          value={faq.answer}
                          onChange={(e) =>
                            change(
                              "faqs",
                              draft.faqs.map((f) =>
                                f.id === faq.id
                                  ? { ...f, answer: e.target.value }
                                  : f,
                              ),
                            )
                          }
                        />
                      </label>
                    </div>
                  ))}
                  <button
                    type="button"
                    className="button secondary full-width dashed"
                    disabled={draft.faqs.length >= 40}
                    onClick={() =>
                      change("faqs", [
                        ...draft.faqs,
                        { id: crypto.randomUUID(), question: "", answer: "" },
                      ])
                    }
                  >
                    <Plus size={16} /> Agregar una pregunta
                  </button>
                </div>
              )}
              <div className="form-actions">
                <span>
                  <ShieldCheck size={14} /> Los cambios se guardan en tu tienda
                </span>
                <SaveButton busy={busy} />
              </div>
            </div>
          </form>
        </section>
        <section className="simulator-column">
          <Simulator />
          <div className="simulator-tip">
            <Sparkles size={18} />
            <div>
              <strong>Ponte en los zapatos de tu cliente.</strong>
              <p>
                Prueba una pregunta real. Los cambios de configuración se
                aplican después de guardarlos.
              </p>
            </div>
          </div>
          <div className="assistant-rule">
            <ShieldCheck size={17} />
            <p>
              El asistente no inventa stock ni estados de pedido. Si algo
              necesita una persona, te avisa.
            </p>
          </div>
        </section>
      </div>
    </>
  );
}

type SimMessage = { role: "user" | "assistant" | "system"; text: string };
function Simulator() {
  const { session, refresh, notify } = useApp();
  const [messages, setMessages] = useState<SimMessage[]>([
    { role: "assistant", text: session.settings.welcome },
  ]);
  const [text, setText] = useState(""),
    [busy, setBusy] = useState(false),
    [paused, setPaused] = useState(false);
  async function send(value: string) {
    if (!value.trim() || busy) return;
    setMessages((m) => [...m, { role: "user", text: value }]);
    setText("");
    setBusy(true);
    try {
      const reply = await post<{ text: string | null; paused?: boolean }>(
        "/simulator",
        { text: value },
      );
      if (reply.paused) {
        setPaused(true);
        setMessages((m) => [
          ...m,
          {
            role: "system",
            text: "El asistente está pausado o derivó este chat al equipo. Reinicia la prueba y comprueba que el asistente esté activo.",
          },
        ]);
      } else if (reply.text)
        setMessages((m) => [...m, { role: "assistant", text: reply.text! }]);
      refresh();
    } catch (e) {
      notify((e as Error).message, true);
      setMessages((m) => [
        ...m,
        {
          role: "system",
          text: "No se pudo generar la respuesta. Intenta de nuevo.",
        },
      ]);
    } finally {
      setBusy(false);
    }
  }
  async function reset() {
    try {
      await post("/simulator/reset");
      setMessages([{ role: "assistant", text: session.settings.welcome }]);
      setPaused(false);
      setText("");
      refresh();
    } catch (e) {
      notify((e as Error).message, true);
    }
  }
  return (
    <div className="card simulator">
      <div className="simulator-top">
        <span>
          <span className="status-dot" /> SIMULADOR EN VIVO
        </span>
        <button
          className="icon-button"
          title="Reiniciar prueba"
          aria-label="Reiniciar prueba"
          onClick={() => void reset()}
          disabled={busy}
        >
          <RotateCcw size={16} />
        </button>
      </div>
      <div className="simulator-header">
        <span className="bot-avatar">
          <Bot size={23} />
        </span>
        <div>
          <strong>{session.settings.assistantName}</strong>
          <small>Asistente de {session.workspace.name}</small>
        </div>
        <span className="pill">IA</span>
      </div>
      <div className="simulator-messages">
        <div className="chat-date">Tu espacio para probar</div>
        {messages.map((m, i) => (
          <div className={`sim-message ${m.role}`} key={i}>
            {m.text}
          </div>
        ))}
        {busy && (
          <div className="sim-message assistant typing">
            <i />
            <i />
            <i />
          </div>
        )}
      </div>
      {messages.length < 3 && (
        <div className="simulator-suggestions">
          {[
            "¿Cuál es su horario?",
            "¿Tienen el Bolso Alba?",
            "¿Cómo va mi pedido LC-1042?",
          ].map((q) => (
            <button
              key={q}
              disabled={busy || paused}
              onClick={() => void send(q)}
            >
              {q}
              <ChevronRight size={13} />
            </button>
          ))}
        </div>
      )}
      <form
        className="simulator-composer"
        onSubmit={(e) => {
          e.preventDefault();
          void send(text);
        }}
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Pregunta como un cliente..."
          aria-label="Mensaje para probar el asistente"
          maxLength={2000}
          disabled={paused}
        />
        <button
          className="send-button"
          aria-label="Enviar mensaje de prueba"
          disabled={!text.trim() || busy || paused}
        >
          {busy ? (
            <LoaderCircle size={16} className="spin" />
          ) : (
            <Send size={16} />
          )}
        </button>
      </form>
      <div className="simulator-footer">
        <ShieldCheck size={12} /> Prueba segura. No envía mensajes reales.
      </div>
      {paused && (
        <button
          className="text-button simulator-reset"
          onClick={() => void reset()}
        >
          Reiniciar prueba <ArrowUpRight size={14} />
        </button>
      )}
    </div>
  );
}
