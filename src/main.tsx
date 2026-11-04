import { StrictMode, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
const PublicVoice = lazy(() =>
  import("./VoiceConsole").then((m) => ({ default: m.PublicVoice })),
);

import { ErrorBoundary } from "./ErrorBoundary";
import "./styles.css";
import "./refinements.css";

const voiceToken = new URLSearchParams(location.search).get("voice");

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <Suspense
        fallback={
          <div className="app-loading" role="status">
            Cargando plataforma…
          </div>
        }
      >
        {voiceToken ? <PublicVoice token={voiceToken} /> : <App />}
      </Suspense>
    </ErrorBoundary>
  </StrictMode>,
);
