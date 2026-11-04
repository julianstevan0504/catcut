import { useRef, useState } from "react";
import { BookOpen, FileText, Plus, Trash2, Upload, Search } from "lucide-react";
import type { KnowledgeDocument } from "./types";
export function KnowledgeEditor({
  value,
  onChange,
}: {
  value: KnowledgeDocument[];
  onChange: (value: KnowledgeDocument[]) => void;
}) {
  const upload = useRef<HTMLInputElement>(null),
    [error, setError] = useState("");
  const change = (id: string, key: "title" | "content", text: string) =>
    onChange(value.map((d) => (d.id === id ? { ...d, [key]: text } : d)));
  async function read(file?: File) {
    if (!file) return;
    setError("");
    try {
      if (!/\.(txt|md)$/i.test(file.name) || file.size > 1000000)
        throw Error("Usa un archivo .txt o .md de hasta 1 MB.");
      const text = (await file.text()).replace(/^\uFEFF/, "").trim();
      if (!text || text.length > 12000)
        throw Error(
          "Cada documento debe tener entre 1 y 12.000 caracteres. Divide archivos largos en varios documentos.",
        );
      if (value.length >= 60) throw Error("Puedes cargar hasta 60 documentos.");
      onChange([
        ...value,
        {
          id: crypto.randomUUID(),
          title: file.name.replace(/\.(txt|md)$/i, "").slice(0, 120),
          content: text,
        },
      ]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      if (upload.current) upload.current.value = "";
    }
  }
  return (
    <div className="knowledge-editor">
      <div className="knowledge-intro">
        <span className="studio-icon">
          <BookOpen size={23} />
        </span>
        <div>
          <h3>Todo lo que sabe tu negocio.</h3>
          <p>
            Explica el local, servicios, cuidados, preparación, políticas y
            detalles especiales. El asistente busca relaciones entre estos
            textos, tu catálogo y la conversación.
          </p>
        </div>
      </div>
      <div className="knowledge-summary">
        <span>
          <FileText size={15} />
          {value.length}/60 documentos
        </span>
        <span>
          <Search size={15} /> Búsqueda por palabras y términos relacionados
        </span>
      </div>
      <p className="knowledge-public-note">
        Escribe información que puedas compartir con tus clientes. Guarda los
        cambios para que se apliquen al chat y a las llamadas.
      </p>
      {value.map((d, i) => (
        <article className="knowledge-document" key={d.id}>
          <div className="knowledge-document-top">
            <span>
              <FileText size={15} /> DOCUMENTO {i + 1}
            </span>
            <button
              type="button"
              className="icon-button danger"
              aria-label={`Eliminar documento ${i + 1}`}
              onClick={() => onChange(value.filter((x) => x.id !== d.id))}
            >
              <Trash2 size={16} />
            </button>
          </div>
          <label className="field-label">
            Título del documento {i + 1}
            <input
              required
              maxLength={120}
              value={d.title}
              placeholder="Ej. Terraza, mascotas y accesibilidad"
              onChange={(e) => change(d.id, "title", e.target.value)}
            />
          </label>
          <label className="field-label">
            Contenido del documento {i + 1}
            <textarea
              required
              rows={6}
              maxLength={12000}
              value={d.content}
              placeholder="Describe las condiciones y detalles reales con tus propias palabras. No necesitas escribir una pregunta exacta."
              onChange={(e) => change(d.id, "content", e.target.value)}
            />
          </label>
          <small>
            {d.content.length.toLocaleString("es-CO")} / 12.000 caracteres
          </small>
        </article>
      ))}
      {!value.length && (
        <div className="knowledge-empty">
          <BookOpen size={30} />
          <strong>Enséñale los detalles de tu tienda.</strong>
          <p>
            Por ejemplo: cómo llegar, qué se puede personalizar, cómo cuidar un
            producto o qué espacios tiene el local.
          </p>
        </div>
      )}
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
      <div className="knowledge-actions">
        <button
          type="button"
          className="button secondary"
          disabled={value.length >= 60}
          onClick={() =>
            onChange([
              ...value,
              { id: crypto.randomUUID(), title: "", content: "" },
            ])
          }
        >
          <Plus size={16} /> Añadir documento
        </button>
        <button
          type="button"
          className="button secondary"
          disabled={value.length >= 60}
          onClick={() => upload.current?.click()}
        >
          <Upload size={16} /> Importar texto
        </button>
        <input
          ref={upload}
          type="file"
          accept=".txt,.md,text/plain,text/markdown"
          aria-label="Importar documento del negocio"
          onChange={(e) => void read(e.target.files?.[0])}
          hidden
        />
      </div>
    </div>
  );
}
