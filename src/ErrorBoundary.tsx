import { Component } from "react";
import type { ReactNode, ErrorInfo } from "react";
import { CircleAlert, RotateCcw } from "lucide-react";
import { Logo } from "./components";

export class ErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error, _info: ErrorInfo) {
    console.error("Cerca no pudo renderizar una pantalla:", error.name);
  }
  render() {
    if (this.state.failed)
      return (
        <main className="app-loading crash-screen">
          <Logo />
          <CircleAlert size={30} />
          <h1>Retomemos la conversación.</h1>
          <p>
            Una pantalla no pudo abrirse. Recarga la plataforma para volver a
            intentarlo.
          </p>
          <button className="button primary" onClick={() => location.reload()}>
            <RotateCcw size={16} /> Volver a abrir Cerca
          </button>
          <a
            className="text-button"
            href={
              location.protocol === "file:" ? "./Cerca.html" : "/Cerca.html"
            }
          >
            Abrir la demo independiente
          </a>
        </main>
      );
    return this.props.children;
  }
}
