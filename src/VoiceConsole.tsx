import { useEffect, useRef, useState } from "react";
import {
  AudioLines,
  Phone,
  PhoneOff,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Send,
  ShieldCheck,
  ArrowLeft,
  LoaderCircle,
  Hand,
} from "lucide-react";
import { isSpeechEcho, interruptionOnly } from "../shared/speech";
import { api, post } from "./api";
import type { StoreReply, VoiceSession } from "./types";
import "./studio.css";
import { Logo } from "./components";
type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  abort: () => void;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onresult:
    | ((e: {
        results: ArrayLike<
          ArrayLike<{ transcript: string }> & { isFinal?: boolean }
        >;
        resultIndex?: number;
      }) => void)
    | null;
};
type SpeechWindow = Window & {
  SpeechRecognition?: new () => Recognition;
  webkitSpeechRecognition?: new () => Recognition;
};
type Phase =
  | "idle"
  | "starting"
  | "permission"
  | "listening"
  | "thinking"
  | "speaking"
  | "ready"
  | "ended";
const labels: Record<Phase, string> = {
  idle: "Una conversación empieza contigo",
  starting: "Preparando la conversación…",
  permission: "Esperando permiso del micrófono…",
  listening: "Te escucho",
  thinking: "Consultando la información de la tienda…",
  speaking: "Tu asistente está hablando",
  ready: "Tu turno · puedes escribir o hablar",
  ended: "Gracias por conversar",
};
const spoken = (text: string) =>
  text
    .replace(/[\p{Extended_Pictographic}\uFE0F]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
export function VoiceConsole({
  name,
  storeName,
  rate = 1,
  publicToken,
  onUpdated,
}: {
  name: string;
  storeName: string;
  rate?: number;
  publicToken?: string;
  onUpdated?: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("idle"),
    [lines, setLines] = useState<
      { role: "user" | "assistant"; text: string; interrupted?: boolean }[]
    >([]),
    [error, setError] = useState(""),
    [text, setText] = useState(""),
    [muted, setMuted] = useState(false),
    [speaker, setSpeaker] = useState(true),
    [elapsed, setElapsed] = useState(0),
    [activeUI, setActiveUI] = useState(false);
  const active = useRef(false),
    generation = useRef(0),
    call = useRef<VoiceSession | null>(null),
    recognizer = useRef<Recognition | null>(null),
    mute = useRef(false),
    audio = useRef(true),
    pending = useRef(false),
    retry = useRef<ReturnType<typeof setTimeout> | undefined>(undefined),
    speechTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined),
    controller = useRef<AbortController | null>(null),
    transcript = useRef<HTMLDivElement>(null),
    lastSend = useRef(""),
    startedAt = useRef(0),
    silences = useRef(0),
    speaking = useRef(false),
    speakingText = useRef(""),
    speechEpoch = useRef(0),
    turnEpoch = useRef(0),
    queue = useRef<string | null>(null),
    phaseRef = useRef<Phase>("idle");
  const phaseNow = (value: Phase) => {
    phaseRef.current = value;
    setPhase(value);
  };
  const Rec =
    (window as SpeechWindow).SpeechRecognition ??
    (window as SpeechWindow).webkitSpeechRecognition;
  const supported =
    Boolean(Rec) && (window.isSecureContext || location.protocol === "file:");
  const speechSupported = "speechSynthesis" in window;
  function stopListening() {
    const r = recognizer.current;
    recognizer.current = null;
    if (r) {
      r.onend = null;
      r.onresult = null;
      r.onerror = null;
      r.abort();
    }
    clearTimeout(retry.current);
  }
  const valid = (g: number) => active.current && g === generation.current;
  async function sessionRequest<T>(
    suffix: string,
    body: unknown,
    signal?: AbortSignal,
  ) {
    const c = call.current;
    if (!c) throw new Error("Inicia una llamada para continuar.");
    return api<T>(`/voice/sessions/${c.id}/${suffix}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${c.token}` },
      body: JSON.stringify(body),
      signal,
      keepalive: suffix === "end",
    });
  }
  function listen(g: number, overlay = false) {
    if (!valid(g) || mute.current || (pending.current && !overlay)) {
      if (valid(g) && !pending.current) phaseNow("ready");
      return;
    }
    if (recognizer.current) {
      if (!speaking.current && !pending.current) phaseNow("listening");
      return;
    }
    clearTimeout(retry.current);
    if (!supported || !Rec) {
      if (!speaking.current && !pending.current) phaseNow("ready");
      return;
    }
    const r = new Rec();
    recognizer.current = r;
    r.lang = "es-CO";
    r.continuous = false;
    r.interimResults = true;
    if (!overlay) phaseNow("permission");
    let gotResult = false;
    r.onstart = () => {
      if (valid(g)) {
        if (!speaking.current && !pending.current) phaseNow("listening");
        setError("");
      }
    };
    r.onresult = (e) => {
      if (!valid(g) || mute.current || recognizer.current !== r) return;
      for (let i = e.resultIndex ?? 0; i < e.results.length; i++) {
        const result = e.results[i],
          t = String(result?.[0]?.transcript ?? "").trim();
        if (!t) continue;
        const final = result.isFinal !== false;
        if (speaking.current && isSpeechEcho(t, speakingText.current)) continue;
        if (speaking.current) interrupt(true);
        if (!final) continue;
        gotResult = true;
        silences.current = 0;
        if (interruptionOnly(t, name)) {
          gotResult = false;
          phaseNow("listening");
          return;
        }
        void send(t, g);
        return;
      }
    };
    r.onerror = (e) => {
      if (!valid(g) || recognizer.current !== r) return;
      recognizer.current = null;
      r.onend = null;
      if (e.error === "aborted") return;
      if (!speaking.current && !pending.current) phaseNow("ready");
      if (e.error === "no-speech" && (speaking.current || pending.current)) {
        retry.current = setTimeout(() => listen(g, true), 600);
        return;
      }
      if (e.error === "no-speech") {
        setError(
          "No escuché una consulta. Pulsa el micrófono para volver a intentar o escribe abajo.",
        );
      } else {
        mute.current = true;
        setMuted(true);
        setError(
          e.error === "not-allowed" || e.error === "service-not-allowed"
            ? "El micrófono no tiene permiso. Actívalo en el navegador o continúa por texto."
            : e.error === "audio-capture"
              ? "No se encontró un micrófono. Puedes continuar escribiendo."
              : "El reconocimiento de voz no está disponible. Puedes escribir y escuchar las respuestas.",
        );
      }
    };
    r.onend = () => {
      if (!valid(g) || recognizer.current !== r) return;
      recognizer.current = null;
      if (speaking.current || pending.current) {
        retry.current = setTimeout(() => listen(g, true), 500);
        return;
      }
      if (!gotResult && !pending.current) {
        phaseNow("ready");
        if (++silences.current < 2)
          retry.current = setTimeout(() => listen(g), 700);
      }
    };
    try {
      r.start();
    } catch {
      recognizer.current = null;
      if (!speaking.current && !pending.current) phaseNow("ready");
      setError(
        "No se pudo abrir el micrófono. Continúa por texto o vuelve a intentarlo.",
      );
    }
  }
  function interrupt(keepRecognition = false) {
    if (!active.current) return;
    const wasSpeaking = speaking.current;
    if (pending.current) {
      turnEpoch.current++;
      void sessionRequest("interrupt", {}).catch(() => {});
    }
    speechEpoch.current++;
    speaking.current = false;
    clearTimeout(speechTimer.current);
    if (speechSupported) window.speechSynthesis.cancel();
    if (wasSpeaking) {
      setLines((lines) => {
        const next = [...lines];
        for (let i = next.length - 1; i >= 0; i--)
          if (next[i].role === "assistant") {
            next[i] = { ...next[i], interrupted: true };
            break;
          }
        return next;
      });
      void sessionRequest("interrupt", {}).catch(() => {});
    }
    if (!keepRecognition) {
      stopListening();
      mute.current = !supported;
      setMuted(!supported);
      silences.current = 0;
      listen(generation.current, true);
    }
    phaseNow(recognizer.current ? "listening" : "ready");
  }
  function speak(text: string, g: number) {
    if (!valid(g)) return;
    clearTimeout(speechTimer.current);
    const epoch = ++speechEpoch.current;
    if (!audio.current || !speechSupported) {
      speaking.current = false;
      listen(g);
      return;
    }
    speaking.current = true;
    speakingText.current = spoken(text);
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(speakingText.current);
    u.lang = "es-CO";
    u.rate = rate;
    const voices = window.speechSynthesis.getVoices();
    u.voice =
      voices.find((v) => v.lang === "es-CO") ??
      voices.find((v) => v.lang.startsWith("es")) ??
      null;
    let finished = false;
    const finish = () => {
      if (finished || !valid(g) || epoch !== speechEpoch.current) return;
      finished = true;
      speaking.current = false;
      clearTimeout(speechTimer.current);
      listen(g);
    };
    u.onend = finish;
    u.onerror = (e) => {
      if (e.error === "interrupted" || e.error === "canceled") return;
      finish();
    };
    phaseNow("speaking");
    speechTimer.current = setTimeout(
      () => {
        if (!valid(g) || epoch !== speechEpoch.current) return;
        window.speechSynthesis.cancel();
        finish();
      },
      Math.min(120000, Math.max(15000, text.length * 115)),
    );
    window.speechSynthesis.speak(u);
    listen(g, true);
  }
  async function send(value: string, g = generation.current) {
    if (!value.trim() || !valid(g)) return;
    if (pending.current) {
      queue.current = value.trim();
      setText("");
      interrupt(true);
      return;
    }
    if (speaking.current) interrupt(true);
    const key = value.trim();
    if (lastSend.current === key && phaseRef.current === "thinking") return;
    lastSend.current = key;
    pending.current = true;
    stopListening();
    if (speechSupported) window.speechSynthesis.cancel();
    clearTimeout(speechTimer.current);
    phaseNow("thinking");
    listen(g, true);
    setText("");
    setError("");
    setLines((l) => [...l, { role: "user", text: key }]);
    const requestEpoch = ++turnEpoch.current;
    const abort = new AbortController();
    controller.current = abort;
    try {
      const reply = await sessionRequest<StoreReply>(
        "turn",
        { text: key },
        abort.signal,
      );
      if (!valid(g)) return;
      if (queue.current || requestEpoch !== turnEpoch.current) return;
      setLines((l) => [...l, { role: "assistant", text: reply.text }]);
      onUpdated?.();
      pending.current = false;
      if (reply.handoff) {
        mute.current = true;
        setMuted(true);
      }
      speak(reply.text, g);
    } catch (e) {
      if (valid(g) && requestEpoch === turnEpoch.current) {
        setError((e as Error).message);
        phaseNow("ready");
      }
    } finally {
      if (valid(g)) {
        pending.current = false;
        const next = queue.current;
        queue.current = null;
        if (next) void send(next, g);
      }
    }
  }
  async function start() {
    if (active.current || phase === "starting") return;
    const g = ++generation.current;
    setError("");
    phaseNow("starting");
    setLines([]);
    setElapsed(0);
    try {
      const c = await post<VoiceSession>(
        publicToken
          ? `/public/voice/${publicToken}/sessions`
          : "/voice/sessions",
      );
      if (g !== generation.current) {
        void api(`/voice/sessions/${c.id}/end`, {
          method: "POST",
          headers: { Authorization: `Bearer ${c.token}` },
          body: "{}",
          keepalive: true,
        }).catch(() => {});
        return;
      }
      call.current = c;
      active.current = true;
      pending.current = false;
      setActiveUI(true);
      mute.current = !supported;
      setMuted(!supported);
      startedAt.current = Date.now();
      silences.current = 0;
      setLines([{ role: "assistant", text: c.greeting }]);
      onUpdated?.();
      speak(c.greeting, g);
    } catch (e) {
      if (g === generation.current) {
        setError((e as Error).message);
        phaseNow("idle");
      }
    }
  }
  function end(update = true) {
    const c = call.current;
    active.current = false;
    speaking.current = false;
    speechEpoch.current++;
    queue.current = null;
    generation.current++;
    stopListening();
    clearTimeout(speechTimer.current);
    controller.current?.abort();
    if (speechSupported) window.speechSynthesis.cancel();
    call.current = null;
    pending.current = false;
    if (c)
      void api(`/voice/sessions/${c.id}/end`, {
        method: "POST",
        headers: { Authorization: `Bearer ${c.token}` },
        body: "{}",
        keepalive: true,
      }).catch(() => {});
    if (update) {
      setActiveUI(false);
      phaseNow("ended");
      onUpdated?.();
    }
  }
  useEffect(() => () => end(false), []); // All live resources live in refs and are invalidated on unmount.
  useEffect(() => {
    if (!activeUI) return;
    const timer = setInterval(() => {
      const seconds = Math.floor((Date.now() - startedAt.current) / 1000);
      setElapsed(seconds);
      if (seconds >= 1800) {
        end();
        setError(
          "La llamada alcanzó el límite de 30 minutos. Puedes iniciar otra.",
        );
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [activeUI]);
  useEffect(() => {
    transcript.current?.scrollTo({
      top: transcript.current.scrollHeight,
      behavior: "smooth",
    });
  }, [lines, phase]);
  function toggleMic() {
    const next = !mute.current;
    mute.current = next;
    setMuted(next);
    if (next) {
      stopListening();
      if (phase === "listening" || phase === "permission") phaseNow("ready");
    } else listen(generation.current, true);
  }
  function toggleSpeaker() {
    const next = !audio.current;
    audio.current = next;
    setSpeaker(next);
    if (!next && speechSupported) {
      speechEpoch.current++;
      speaking.current = false;
      window.speechSynthesis.cancel();
      clearTimeout(speechTimer.current);
      if (phaseRef.current === "speaking") listen(generation.current);
    }
  }
  return (
    <section
      className={`voice-console voice-${phase}`}
      aria-label="Consola de llamada"
    >
      <div className="voice-console-heading">
        <span>
          <AudioLines size={16} /> CONVERSACIÓN POR VOZ
        </span>
        <span className="voice-duration">
          {activeUI
            ? `${Math.floor(elapsed / 60)
                .toString()
                .padStart(
                  2,
                  "0",
                )}:${(elapsed % 60).toString().padStart(2, "0")}`
            : "ESPAÑOL · CO"}
        </span>
      </div>
      <div className="voice-stage">
        <div className="voice-orb-wrap" aria-hidden="true">
          <div className="voice-orbit" />
          <div className="voice-orb">
            <AudioLines size={42} strokeWidth={1.2} />
          </div>
          <div className="voice-wave">
            {Array.from({ length: 17 }, (_, i) => (
              <i key={i} style={{ "--bar": i } as React.CSSProperties} />
            ))}
          </div>
        </div>
        <span className="voice-store">{storeName}</span>
        <h2>Hola, soy {name}.</h2>
        <p className="voice-phase" role="status">
          {labels[phase]}
        </p>
        {!activeUI ? (
          <button
            className="button voice-start"
            onClick={() => void start()}
            disabled={phase === "starting"}
          >
            {phase === "starting" ? (
              <LoaderCircle size={18} className="spin" />
            ) : (
              <Phone size={18} />
            )}{" "}
            {phase === "ended"
              ? "Iniciar otra llamada"
              : "Hablar con el asistente"}
          </button>
        ) : (
          <div className="voice-controls">
            <button
              className={muted ? "muted" : ""}
              onClick={toggleMic}
              disabled={!supported}
              aria-label={muted ? "Activar micrófono" : "Silenciar micrófono"}
              aria-pressed={muted}
            >
              {muted ? <MicOff /> : <Mic />}
              <span>{muted ? "Silenciado" : "Micrófono"}</span>
            </button>
            <button
              className="hangup"
              onClick={() => end()}
              aria-label="Terminar llamada"
            >
              <PhoneOff />
              <span>Terminar</span>
            </button>
            <button
              onClick={toggleSpeaker}
              aria-label={
                speaker ? "Silenciar asistente" : "Activar voz del asistente"
              }
              aria-pressed={!speaker}
            >
              {speaker ? <Volume2 /> : <VolumeX />}
              <span>Altavoz</span>
            </button>
          </div>
        )}
        {activeUI && (phase === "speaking" || phase === "thinking") && (
          <button
            type="button"
            className="button voice-interrupt"
            onClick={() => interrupt()}
          >
            <Hand size={16} /> Interrumpir y hablar
          </button>
        )}
        {activeUI && (
          <p className="voice-barge-hint">
            Puedes hablar para interrumpirme o pulsar «Interrumpir y hablar».
          </p>
        )}
        <p className="voice-consent">
          Al iniciar, se guarda la transcripción en la tienda. Tu navegador
          puede procesar la voz mediante su propio servicio. Cerca no guarda
          grabaciones de audio.
        </p>
      </div>
      {(!supported || !speechSupported) && (
        <p className="voice-notice">
          {!supported
            ? "Este navegador no permite dictado aquí. Prueba Chrome o Edge en HTTPS o localhost. "
            : ""}
          {!speechSupported
            ? "La lectura en voz alta no está disponible. "
            : ""}
          Puedes usar la conversación por texto.
        </p>
      )}
      {error && (
        <p className="voice-error" role="alert">
          {error}
        </p>
      )}
      <div
        className="voice-transcript"
        ref={transcript}
        role="log"
        aria-label="Transcripción de la llamada"
        aria-live="polite"
      >
        {!lines.length ? (
          <div className="voice-transcript-empty">
            <ShieldCheck size={19} />
            <p>
              Respuestas sobre esta tienda,
              <br />
              basadas en su catálogo y configuración.
            </p>
          </div>
        ) : (
          lines.map((l, i) => (
            <div className={`voice-line ${l.role}`} key={i}>
              <strong>{l.role === "user" ? "Tú" : name}</strong>
              <p>{l.text}</p>
              {l.interrupted && (
                <small className="voice-interrupted">Interrumpida por ti</small>
              )}
            </div>
          ))
        )}
      </div>
      <form
        className="voice-text-form"
        onSubmit={(e) => {
          e.preventDefault();
          void send(text);
        }}
      >
        <input
          aria-label="Mensaje durante la llamada"
          placeholder={
            activeUI
              ? "También puedes escribir aquí…"
              : "Inicia la llamada para conversar…"
          }
          maxLength={1500}
          disabled={!activeUI}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button
          aria-label="Enviar mensaje en la llamada"
          disabled={!activeUI || !text.trim()}
        >
          <Send size={17} />
        </button>
      </form>
    </section>
  );
}
export function PublicVoice({ token }: { token: string }) {
  const [store, setStore] = useState<{
      name: string;
      assistantName: string;
      voiceRate: number;
    } | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    const abort = new AbortController();
    api<{ name: string; assistantName: string; voiceRate: number }>(
      `/public/store/${token}`,
      { signal: abort.signal },
    )
      .then(setStore)
      .catch((e) => {
        if (!abort.signal.aborted) setError(e.message);
      });
    return () => abort.abort();
  }, [token]);
  return (
    <main className="public-voice-page">
      <header>
        <Logo />
        <span>Tu tienda, más cerca.</span>
      </header>
      {error ? (
        <div className="card public-voice-error">
          <h1>Llamada no disponible</h1>
          <p>{error}</p>
          <a href="/" className="button secondary">
            <ArrowLeft size={16} /> Volver
          </a>
        </div>
      ) : store ? (
        <VoiceConsole
          name={store.assistantName}
          storeName={store.name}
          rate={store.voiceRate}
          publicToken={token}
        />
      ) : (
        <p role="status">Preparando el asistente…</p>
      )}
      <footer>Atención con un asistente virtual · Cerca</footer>
    </main>
  );
}
