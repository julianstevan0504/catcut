import { useRef, useState } from "react";
import { ImagePlus, LoaderCircle, X, Trash2 } from "lucide-react";
import { standaloneMode, standaloneImage } from "./standalone";
export const imageSrc = (id: string) =>
  standaloneMode ? standaloneImage(id) : "/media/" + id;
import { api, post, useResource } from "./api";
import { Modal, Spinner, ErrorState } from "./components";
export function PhotoLibrary({ onClose }: { onClose: () => void }) {
  const { data, loading, error, reload } = useResource<{
    images: { id: string; url: string; used: boolean; bytes: number }[];
    bytes: number;
    limitBytes: number;
  }>("/media/images");
  const [busy, setBusy] = useState(""),
    [failure, setFailure] = useState("");
  async function remove(id: string) {
    setBusy(id);
    setFailure("");
    try {
      await api("/media/images/" + id, { method: "DELETE" });
      reload();
    } catch (e) {
      setFailure((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  return (
    <Modal
      title="Tus fotos, en orden."
      description="Las fotos que usa el menú o la portada están protegidas. Guarda los cambios del restaurante antes de eliminar una foto que acabas de quitar."
      onClose={onClose}
    >
      {loading ? (
        <Spinner />
      ) : error ? (
        <ErrorState message={error} retry={reload} />
      ) : (
        <>
          <p className="form-hint">
            {data?.images.length ?? 0}/200 fotos ·{" "}
            {((data?.bytes ?? 0) / 1048576).toFixed(2)} de 50 MB
          </p>
          {failure && (
            <p className="inline-error" role="alert">
              {failure}
            </p>
          )}
          <div className="photo-library">
            {data?.images.map((photo, i) => (
              <article key={photo.id}>
                <img src={photo.url} alt={"Foto del restaurante " + (i + 1)} />
                <div>
                  <small>
                    {photo.used ? "En uso" : "Sin usar"} ·{" "}
                    {Math.ceil(photo.bytes / 1024)} KB
                  </small>
                  <button
                    className="icon-button danger"
                    type="button"
                    aria-label={"Eliminar foto " + (i + 1)}
                    disabled={photo.used || busy === photo.id}
                    onClick={() => void remove(photo.id)}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </article>
            ))}
          </div>
          {!data?.images.length && (
            <p className="form-hint">
              Las fotos que subas a tus platos o a la portada aparecerán aquí.
            </p>
          )}
        </>
      )}
    </Modal>
  );
}
export function ImageUploader({
  value,
  onChange,
  label = "Foto del plato",
}: {
  value?: string;
  onChange: (id: string, url: string) => void;
  label?: string;
}) {
  const input = useRef<HTMLInputElement>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function upload(file?: File) {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      if (
        !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
        file.size > 8000000
      )
        throw Error("Elige una foto JPG, PNG o WebP de hasta 8 MB.");
      const image = await createImageBitmap(file);
      try {
        if (image.width * image.height > 20000000)
          throw Error(
            "La foto tiene demasiados píxeles. Usa una imagen de hasta 20 megapíxeles.",
          );
        const ratio = Math.min(1, 1600 / image.width, 1600 / image.height),
          canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.width * ratio));
        canvas.height = Math.max(1, Math.round(image.height * ratio));
        const context = canvas.getContext("2d");
        if (!context) throw Error("El navegador no pudo procesar la foto.");
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        let data = canvas.toDataURL("image/webp", 0.82);
        if (data.length > 1500000) data = canvas.toDataURL("image/webp", 0.6);
        if (data.length > 1500000)
          throw Error(
            "La foto sigue siendo muy pesada. Prueba una más pequeña.",
          );
        const result = await post<{ imageId: string; url: string }>(
          "/media/images",
          { data },
        );
        onChange(result.imageId, result.url);
      } finally {
        image.close();
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }
  return (
    <div className="image-uploader">
      <span className="field-label">{label}</span>
      {value ? (
        <div className="image-upload-preview">
          <img src={value} alt={label} />
          <button
            type="button"
            className="image-remove"
            aria-label={`Quitar ${label.toLowerCase()}`}
            onClick={() => onChange("", "")}
          >
            <X size={16} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="image-drop"
          disabled={busy}
          onClick={() => input.current?.click()}
        >
          {busy ? (
            <LoaderCircle className="spin" size={28} />
          ) : (
            <ImagePlus size={28} />
          )}
          <strong>
            {busy ? "Optimizando foto…" : "Añadir una buena foto"}
          </strong>
          <span>JPG, PNG o WebP · se optimiza para el menú</span>
        </button>
      )}
      {value && (
        <button
          type="button"
          className="text-button"
          disabled={busy}
          onClick={() => input.current?.click()}
        >
          {busy ? "Guardando…" : "Cambiar foto"}
        </button>
      )}
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        aria-label={label}
        hidden
        onChange={(e) => void upload(e.target.files?.[0])}
      />
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
