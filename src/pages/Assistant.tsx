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
  AudioLines,
  PhoneCall,
  ClipboardCheck,
  Package,
  Settings2,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Download,
} from "lucide-react";
import { post, put, useResource, dateLabel } from "../api";
import { useApp } from "../context";
import { SaveButton, Toggle } from "../components";
import { KnowledgeEditor } from "../KnowledgeEditor";
import { VoiceConsole } from "../VoiceConsole";
import { VoiceSettings } from "../VoiceSettings";
import { evaluateStore } from "../../shared/evaluation";
import type { Product } from "../types";
import type { Settings } from "../types";

export function Assistant() {
  const { session, version, refresh, refreshSession, notify } = useApp();
  const { data: products } = useResource<Product[]>("/products", version);
  const { data: history } = useResource<
    {
      id: string;
      conversation_id: string;
      mode: string;
      created_at: string;
      ended_at: string | null;
      expires_at: string;
      turn_count: number;
    }[]
  >("/voice/history", version);
  const [studio, setStudio] = useState("chat");
  const [evaluation, setEvaluation] = useState<ReturnType<
    typeof evaluateStore
  > | null>(null);
  const menu = (products ?? []).filter(
    (p) => p.kind === "dish" || p.kind === "drink",
  );
  const missing = menu.filter((p) => !p.ingredients?.trim()).length;
  function evaluate() {
    if (products)
      setEvaluation(
        evaluateStore({
          settings: session.settings,
          storeName: session.workspace.name,
          products,
        }),
      );
  }
  function exportEvaluation() {
    if (!evaluation) return;
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(evaluation, null, 2)], {
        type: "application/json",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "evaluacion-asistente-cerca.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

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
    <div className="studio-page">
      <section className="studio-hero">
        <div className="studio-hero-copy">
          <span className="studio-eyebrow">
            <span /> CERCA INTELLIGENCE · TU ASISTENTE
          </span>
          <h1>
            Tu tienda tiene
            <br />
            una nueva voz<span>.</span>
          </h1>
          <p>
            Escucha, conversa y acompaña a tus clientes.
            <br />
            Con la información de tu negocio, en cada respuesta.
          </p>
          <div className="studio-hero-tags">
            <span>
              <ShieldCheck size={14} /> Solo tu tienda
            </span>
            <span>
              <AudioLines size={14} /> Voz en español
            </span>
            <span>
              <MessageCircle size={14} /> Todo en tu bandeja
            </span>
          </div>
        </div>
        <div className="studio-hero-art" aria-hidden="true">
          <div className="studio-art-ring ring-one" />
          <div className="studio-art-ring ring-two" />
          <div className="studio-art-orb">
            <AudioLines size={72} strokeWidth={1} />
          </div>
          <span className="studio-art-label">
            {session.settings.assistantName}
            <small>ASISTENTE DE {session.workspace.name.toUpperCase()}</small>
          </span>
          <span className="studio-art-spark spark-one">✦</span>
          <span className="studio-art-spark spark-two">✦</span>
        </div>
      </section>
      <div
        className="studio-navigation"
        aria-label="Herramientas del asistente"
      >
        {[
          { id: "chat", name: "Conversar", icon: MessageCircle },
          { id: "voice", name: "Voz y llamadas", icon: PhoneCall },
          { id: "config", name: "Configurar", icon: Settings2 },
          { id: "evaluation", name: "Evaluar", icon: ClipboardCheck },
        ].map((t) => (
          <button
            key={t.id}
            className={studio === t.id ? "selected" : ""}
            aria-pressed={studio === t.id}
            onClick={() => setStudio(t.id)}
          >
            <t.icon size={17} />
            <span>{t.name}</span>
            {studio === t.id && <i />}
          </button>
        ))}
      </div>
      {studio === "chat" && (
        <div className="studio-preview-grid">
          <div className="studio-knowledge">
            <span className="eyebrow">CONVERSACIONES CON CRITERIO</span>
            <h2>
              Tu mejor vendedor.
              <br />
              Siempre con los datos a mano.
            </h2>
            <p>
              Prueba el menú, una duda sobre ingredientes o un producto agotado.
              El asistente consulta lo que guardaste y te avisa cuando falta
              información.
            </p>
            <div className="studio-knowledge-stats">
              <div>
                <strong>{products?.length ?? "—"}</strong>
                <span>productos registrados</span>
              </div>
              <div>
                <strong>{menu.length}</strong>
                <span>platos y bebidas</span>
              </div>
              <div>
                <strong>{missing}</strong>
                <span>sin ingredientes</span>
              </div>
            </div>
            <div className="studio-principles">
              <div>
                <span>
                  <Package size={18} />
                </span>
                <p>
                  <strong>Precios y stock actualizados</strong>
                  <small>Un producto agotado se informa como agotado.</small>
                </p>
              </div>
              <div>
                <span>
                  <ShieldCheck size={18} />
                </span>
                <p>
                  <strong>Respuestas sobre tu negocio</strong>
                  <small>Sin inventar productos, ingredientes o pedidos.</small>
                </p>
              </div>
              <div>
                <span>
                  <Heart size={18} />
                </span>
                <p>
                  <strong>El equipo, siempre cerca</strong>
                  <small>
                    Las solicitudes de una persona quedan registradas.
                  </small>
                </p>
              </div>
            </div>
            <button
              className="button secondary"
              onClick={() => setStudio("voice")}
            >
              Probar una llamada <ArrowRight size={16} />
            </button>
            <button
              className="text-button knowledge-shortcut"
              onClick={() => {
                setStudio("config");
                setTab("knowledge");
              }}
            >
              Enseñarle sobre mi negocio <ArrowRight size={15} />
            </button>
            {session.demo && (
              <p className="studio-demo-note">
                Los productos y el menú de esta demo son ejemplos. Carga tus
                datos reales en tu propia cuenta.
              </p>
            )}
          </div>
          <Simulator />
        </div>
      )}
      {studio === "voice" && (
        <>
          <div className="studio-voice-grid">
            <VoiceConsole
              name={session.settings.assistantName}
              storeName={session.workspace.name}
              rate={session.settings.voiceRate}
              onUpdated={refresh}
            />
            <VoiceSettings />
          </div>
          <section className="card studio-history">
            <div className="voice-section-title">
              <span className="studio-icon">
                <PhoneCall size={19} />
              </span>
              <div>
                <h3>Historial de llamadas</h3>
                <p>Las transcripciones también están en Conversaciones.</p>
              </div>
            </div>
            {!history?.length ? (
              <p>
                Aún no hay llamadas. Inicia una prueba para ver el registro
                aquí.
              </p>
            ) : (
              <div className="voice-history-list">
                {history.slice(0, 8).map((h) => (
                  <div key={h.id}>
                    <span>
                      <strong>
                        {h.mode === "owner"
                          ? "Prueba web"
                          : h.mode === "public"
                            ? "Cliente web"
                            : "WhatsApp · proveedor"}
                      </strong>
                      <small>
                        {dateLabel(h.created_at)} · {h.turn_count} consultas
                      </small>
                    </span>
                    <span className="pill">
                      {h.ended_at || h.expires_at < new Date().toISOString()
                        ? "Finalizada"
                        : "Sesión abierta"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
      {studio === "evaluation" && (
        <section className="card studio-evaluation">
          <span className="studio-icon">
            <ClipboardCheck size={25} />
          </span>
          <div className="studio-evaluation-heading">
            <div>
              <span className="eyebrow">CALIDAD QUE PUEDES COMPROBAR</span>
              <h2>Pon a prueba sus respuestas.</h2>
              <p>
                Comprueba límites, datos del catálogo y privacidad con pruebas
                automáticas. Puedes ejecutarlas después de editar tu tienda.
              </p>
            </div>
            <button
              className="button primary"
              disabled={!products}
              onClick={evaluate}
            >
              <ClipboardCheck size={17} /> Ejecutar evaluación
            </button>
          </div>
          {evaluation ? (
            <>
              <div className="studio-score">
                <strong>
                  {evaluation.passed}
                  <span>/{evaluation.total}</span>
                </strong>
                <div>
                  <b>Pruebas superadas</b>
                  <p>
                    Evaluación local de reglas y datos. No es una certificación
                    ni una evaluación externa de un modelo de IA.
                  </p>
                </div>
                <button className="button secondary" onClick={exportEvaluation}>
                  <Download size={16} /> Informe JSON
                </button>
              </div>
              <div className="studio-test-list">
                {evaluation.tests.map((t) => (
                  <div key={t.name}>
                    {t.passed ? (
                      <CheckCircle2 size={20} />
                    ) : (
                      <AlertCircle size={20} />
                    )}
                    <p>
                      <strong>{t.name}</strong>
                      <small>{t.detail}</small>
                    </p>
                    <span>{t.passed ? "Correcto" : "Revisar"}</span>
                  </div>
                ))}
              </div>
              <div className="studio-recommendations">
                <h3>Próximas mejoras de tu tienda</h3>
                {evaluation.recommendations.map((r) => (
                  <p key={r}>
                    <ArrowRight size={14} />
                    {r}
                  </p>
                ))}
              </div>
            </>
          ) : (
            <div className="studio-empty-evaluation">
              <ShieldCheck size={34} />
              <p>
                Una prueba para cada regla importante.
                <br />
                Ejecuta la evaluación para ver los resultados.
              </p>
            </div>
          )}
        </section>
      )}
      {studio === "config" && (
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
                    { id: "knowledge", label: "Guía del negocio" },
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
                        onChange={(e) =>
                          change("assistantName", e.target.value)
                        }
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
                          onClick={() =>
                            change("tone", t.id as Settings["tone"])
                          }
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
                {tab === "knowledge" && (
                  <div className="editor-section">
                    <KnowledgeEditor
                      value={draft.knowledge ?? []}
                      onChange={(value) => change("knowledge", value)}
                    />
                    <div className="voice-setting-row">
                      <span>
                        <strong>
                          Recordar preferencias durante la conversación
                        </strong>
                        <small>
                          Relaciona productos, cantidades y presupuesto en cada
                          chat. Reiniciar la prueba limpia ese contexto.
                        </small>
                      </span>
                      <Toggle
                        checked={draft.rememberPreferences ?? true}
                        onChange={() =>
                          change(
                            "rememberPreferences",
                            !(draft.rememberPreferences ?? true),
                          )
                        }
                        label="Recordar contexto de conversación"
                      />
                    </div>
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
                <div className="studio-voice-preferences">
                  <div className="voice-setting-row">
                    <span>
                      <strong>Atención por voz</strong>
                      <small>
                        Activa las sesiones web y las respuestas a llamadas
                        entrantes.
                      </small>
                    </span>
                    <Toggle
                      label="Activar atención por voz"
                      checked={draft.voiceEnabled ?? true}
                      onChange={() =>
                        change("voiceEnabled", !(draft.voiceEnabled ?? true))
                      }
                    />
                  </div>
                  <label className="field-label">
                    Velocidad de voz
                    <select
                      value={draft.voiceRate ?? 1}
                      onChange={(e) =>
                        change("voiceRate", Number(e.target.value))
                      }
                    >
                      <option value={0.8}>Pausada</option>
                      <option value={1}>Natural</option>
                      <option value={1.2}>Ágil</option>
                    </select>
                  </label>
                </div>
                <div className="form-actions">
                  <span>
                    <ShieldCheck size={14} /> Los cambios se guardan en tu
                    tienda
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
      )}
    </div>
  );
}

type SimMessage = {
  role: "user" | "assistant" | "system";
  text: string;
  sources?: { id: string; title: string }[];
  suggestions?: string[];
  approach?: string;
};
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
      const reply = await post<{
        text: string | null;
        paused?: boolean;
        sources?: { id: string; title: string }[];
        suggestions?: string[];
        approach?: string;
      }>("/simulator", { text: value });
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
        setMessages((m) => [
          ...m,
          {
            role: "assistant",
            text: reply.text!,
            sources: reply.sources,
            suggestions: reply.suggestions,
            approach: reply.approach,
          },
        ]);
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
          <span className="status-dot" /> CHAT DE PRUEBA
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
            {m.sources?.length ? (
              <div
                className="assistant-sources"
                aria-label="Fuentes consultadas"
              >
                {m.sources.slice(0, 4).map((s) => (
                  <span key={s.id}>{s.title}</span>
                ))}
              </div>
            ) : null}
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
            "Somos dos y tenemos 50.000 de presupuesto, ¿qué recomiendas?",
            "¿Qué menú hay?",
            "¿Qué lleva la Pizza Margarita?",
            "¿Tienen sushi?",
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
      {messages.length >= 3 && messages.at(-1)?.suggestions?.length ? (
        <div className="advisor-followups">
          {messages
            .at(-1)!
            .suggestions!.slice(0, 3)
            .map((q) => (
              <button
                key={q}
                disabled={busy || paused}
                onClick={() => void send(q)}
              >
                {q}
              </button>
            ))}
        </div>
      ) : null}
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
