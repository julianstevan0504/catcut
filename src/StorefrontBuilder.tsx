import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import {
  ArrowRight,
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  Check,
  CheckCircle2,
  Globe,
  Paintbrush,
  LayoutTemplate,
  Eye,
  Save,
  ExternalLink,
  Smartphone,
  Monitor,
  Plus,
  Sparkles,
  BookOpen,
  ImagePlus,
  ShoppingBag,
  ShieldCheck,
} from "lucide-react";
import { useResource, put, post } from "./api";
import { useApp } from "./context";
import { PageHeading, Spinner, ErrorState } from "./components";
import { ImageUploader, imageSrc } from "./Images";
import { RestaurantStorefront } from "./Restaurant";
import type { StorefrontData } from "./Restaurant";
import type { RestaurantProfile } from "../shared/restaurant";
import {
  businessTypes,
  generatePage,
  presetColors,
  slugify,
} from "../shared/storefront";
import type {
  StorefrontDraft,
  StorefrontDesign,
  PageSection,
} from "../shared/storefront";
import type { Product } from "./types";
type PageState = {
  profile: RestaurantProfile;
  draft: StorefrontDraft;
  revision: number;
  updatedAt: string | null;
  publicUrl: string;
  directoryUrl: string;
  hasUnpublishedChanges: boolean;
  productCount: number;
};
const sectionNames: Record<PageSection, string> = {
  menu: "Carta y pedidos",
  story: "Historia del restaurante",
  contact: "Ubicación y contacto",
};
export function StorefrontBuilder() {
  const { session, version, refresh, notify, navigate } = useApp(),
    resource = useResource<PageState>("/restaurant/page", version),
    products = useResource<Product[]>("/products", version);
  const [state, setState] = useState<PageState | null>(null),
    [draft, setDraft] = useState<StorefrontDraft | null>(null),
    [dirty, setDirty] = useState(false),
    [busy, setBusy] = useState(false),
    [failure, setFailure] = useState(""),
    [tab, setTab] = useState("create"),
    [step, setStep] = useState(0),
    [device, setDevice] = useState("desktop"),
    [description, setDescription] = useState("");
  useEffect(() => {
    if (resource.data && !state) {
      setState(resource.data);
      setDraft(resource.data.draft);
      setDescription(resource.data.draft.design.about);
      setTab(resource.data.draft.design.generated ? "content" : "create");
    }
  }, [resource.data, state]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    addEventListener("beforeunload", warn);
    return () => removeEventListener("beforeunload", warn);
  }, [dirty]);
  useEffect(() => {
    const guard = (event: Event) => {
      if (!dirty || !draft || !state) return;
      const proceed = (event as CustomEvent<{ proceed: () => void }>).detail
        ?.proceed;
      if (typeof proceed !== "function") return;
      event.preventDefault();
      if (busy) return;
      setBusy(true);
      setFailure("");
      void put<PageState>("/restaurant/page", {
        draft,
        revision: state.revision,
      })
        .then((saved) => {
          setState(saved);
          setDraft(saved.draft);
          setDirty(false);
          refresh();
          proceed();
        })
        .catch((e) => setFailure((e as Error).message))
        .finally(() => setBusy(false));
    };
    addEventListener("cerca:before-navigation", guard);
    return () => removeEventListener("cerca:before-navigation", guard);
  }, [dirty, draft, state, busy]);
  if (resource.loading || !draft || !state)
    return resource.error ? (
      <ErrorState message={resource.error} retry={resource.reload} />
    ) : (
      <Spinner label="Abriendo tu taller de página pública…" />
    );
  const change = <K extends keyof StorefrontDraft>(
    key: K,
    value: StorefrontDraft[K],
  ) => {
    setDraft((d) => (d ? { ...d, [key]: value } : d));
    setDirty(true);
    setFailure("");
  };
  const design = <K extends keyof StorefrontDesign>(
    key: K,
    value: StorefrontDesign[K],
  ) => change("design", { ...draft.design, [key]: value });
  const adopt = (r: PageState) => {
    setState(r);
    setDraft(r.draft);
    setDirty(false);
    refresh();
  };
  async function save() {
    if (!draft || !state) return;
    const r = await put<PageState>("/restaurant/page", {
      draft,
      revision: state.revision,
    });
    adopt(r);
    return r;
  }
  async function action(kind: "save" | "publish" | "unpublish") {
    setBusy(true);
    setFailure("");
    try {
      if (kind === "unpublish") {
        adopt(await post<PageState>("/restaurant/page/unpublish"));
        notify(
          "Tu página dejó de estar disponible al público. Conservas tu panel y tus pedidos.",
        );
      } else {
        const saved = dirty ? await save() : state;
        if (kind === "publish" && saved) {
          adopt(
            await post<PageState>("/restaurant/page/publish", {
              revision: saved.revision,
            }),
          );
          notify(
            "Tu página está publicada y aparece en el buscador de restaurantes.",
          );
        } else
          notify(
            "Borrador guardado. Tus clientes siguen viendo la versión publicada.",
          );
      }
    } catch (e) {
      setFailure((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function generate(e: FormEvent) {
    e.preventDefault();
    if (step < 2) {
      setStep((s) => s + 1);
      return;
    }
    const result = generatePage({
      displayName: draft!.displayName || session.workspace.name,
      businessType: draft!.businessType,
      city: draft!.city,
      specialties: draft!.specialties,
      description,
      accent: "terracotta",
    });
    setDraft((d) =>
      d
        ? {
            ...d,
            displayName: d.displayName || session.workspace.name,
            cuisine: businessTypes[d.businessType],
            ...result,
          }
        : d,
    );
    setDirty(true);
    setTab("appearance");
    notify(
      "Tu página está preparada como borrador. Personalízala y publícala cuando quieras.",
    );
  }
  function move(section: PageSection, direction: number) {
    const order = [...draft!.design.sections],
      i = order.indexOf(section),
      j = i + direction;
    if (j < 0 || j >= order.length) return;
    [order[i], order[j]] = [order[j], order[i]];
    design("sections", order);
  }
  const preview: StorefrontData = {
    name: draft.displayName || session.workspace.name,
    profile: {
      ...state.profile,
      ...draft,
      coverImageUrl: draft.coverImageId ? imageSrc(draft.coverImageId) : "",
      logoImageUrl: draft.logoImageId ? imageSrc(draft.logoImageId) : "",
    },
    products: products.data ?? [],
    assistantName: session.settings.assistantName,
    voiceUrl: null,
  };
  return (
    <div className="storefront-builder">
      <PageHeading
        eyebrow="TU RESTAURANTE, ABIERTO AL MUNDO"
        title="Su sabor. Tu manera de contarlo."
        subtitle="Crea la página que ven tus clientes y administra todo desde tu espacio privado."
        action={
          <button
            className="button primary"
            disabled={busy || !state.productCount}
            onClick={() => void action("publish")}
          >
            <Globe size={16} />
            {state.profile.publicEnabled
              ? "Publicar cambios"
              : "Publicar mi página"}
          </button>
        }
      />
      <div className="builder-status-bar">
        <span className={state.profile.publicEnabled ? "published" : "draft"}>
          <i />
          {state.profile.publicEnabled
            ? "Página publicada"
            : "Página sin publicar"}
        </span>
        <span>
          {dirty
            ? "Cambios sin guardar"
            : state.hasUnpublishedChanges
              ? "Borrador guardado · pendiente de publicar"
              : "Todo guardado"}
        </span>
        <div>
          <button
            className="button secondary"
            disabled={busy || !dirty}
            onClick={() => void action("save")}
          >
            <Save size={15} />
            Guardar borrador
          </button>
          {state.profile.publicEnabled && (
            <a
              className="button secondary"
              href={state.publicUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Ver página publicada <ExternalLink size={14} />
            </a>
          )}
        </div>
      </div>
      {failure && (
        <p className="inline-error builder-error" role="alert">
          {failure}
        </p>
      )}
      <div className="builder-workspace">
        <aside className="builder-controls">
          <nav
            className="builder-tabs"
            aria-label="Herramientas de página pública"
          >
            {[
              { id: "create", name: "Preguntas", icon: Sparkles },
              { id: "content", name: "Contenido", icon: BookOpen },
              { id: "appearance", name: "Diseño", icon: Paintbrush },
              { id: "sections", name: "Posiciones", icon: LayoutTemplate },
              { id: "publish", name: "Publicar", icon: Globe },
            ].map((t) => (
              <button
                key={t.id}
                className={tab === t.id ? "selected" : ""}
                onClick={() => setTab(t.id)}
              >
                <t.icon size={17} />
                <span>{t.name}</span>
              </button>
            ))}
          </nav>
          <fieldset className="builder-fields" disabled={busy}>
            {tab === "create" && (
              <form onSubmit={generate} className="builder-questionnaire">
                <span className="eyebrow">UNAS PREGUNTAS PARA CONOCERTE</span>
                <h2>
                  {
                    [
                      "Empecemos por tu restaurante.",
                      "¿Qué lo hace especial?",
                      "La primera impresión cuenta.",
                    ][step]
                  }
                </h2>
                <div
                  className="builder-steps"
                  role="group"
                  aria-label={"Paso " + (step + 1) + " de 3"}
                >
                  {[0, 1, 2].map((i) => (
                    <span key={i} className={i <= step ? "active" : ""} />
                  ))}
                </div>
                {step === 0 && (
                  <>
                    <label className="field-label">
                      Nombre que verán los clientes
                      <input
                        value={draft.displayName}
                        required
                        maxLength={120}
                        onChange={(e) => change("displayName", e.target.value)}
                        placeholder="Ej. Mateo Papa"
                      />
                    </label>
                    <label className="field-label">
                      ¿Qué tipo de negocio tienes?
                      <select
                        value={draft.businessType}
                        onChange={(e) =>
                          change(
                            "businessType",
                            e.target.value as StorefrontDraft["businessType"],
                          )
                        }
                      >
                        {Object.entries(businessTypes).map(([id, name]) => (
                          <option key={id} value={id}>
                            {name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="field-label">
                      ¿En qué ciudad estás?
                      <input
                        value={draft.city}
                        maxLength={100}
                        onChange={(e) => change("city", e.target.value)}
                        placeholder="Ej. Bogotá"
                      />
                    </label>
                  </>
                )}
                {step === 1 && (
                  <>
                    <label className="field-label">
                      ¿Cuáles son tus especialidades?
                      <input
                        value={draft.specialties}
                        maxLength={200}
                        onChange={(e) => change("specialties", e.target.value)}
                        placeholder="Ej. Papas rellenas y hamburguesas"
                      />
                    </label>
                    <label className="field-label">
                      Cuéntanos sobre tu propuesta
                      <textarea
                        value={description}
                        maxLength={2000}
                        rows={5}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Tu historia, tu estilo y lo que quieres compartir con los clientes."
                      />
                    </label>
                    <p className="form-hint">
                      Usaremos lo que escribas para preparar los textos. Los
                      platos y precios se toman de tu menú; no se inventan
                      productos.
                    </p>
                  </>
                )}
                {step === 2 && (
                  <>
                    <label className="field-label">
                      WhatsApp de este restaurante
                      <input
                        value={draft.whatsappNumber}
                        maxLength={30}
                        type="tel"
                        onChange={(e) =>
                          change("whatsappNumber", e.target.value)
                        }
                        placeholder="+573001112233"
                      />
                    </label>
                    <label className="field-label">
                      Teléfono para llamadas
                      <input
                        value={draft.phone}
                        maxLength={30}
                        type="tel"
                        onChange={(e) => change("phone", e.target.value)}
                        placeholder="+573001112233"
                      />
                    </label>
                    <label className="field-label">
                      Dirección pública del local
                      <input
                        value={draft.address}
                        maxLength={300}
                        onChange={(e) => change("address", e.target.value)}
                      />
                    </label>
                    <label className="field-label">
                      Nombre de tu enlace público
                      <div className="builder-slug">
                        <span>/r/</span>
                        <input
                          value={draft.slug}
                          required
                          minLength={3}
                          maxLength={60}
                          pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                          onChange={(e) => change("slug", e.target.value)}
                        />
                      </div>
                    </label>
                    <button
                      type="button"
                      className="text-button"
                      onClick={() =>
                        change(
                          "slug",
                          slugify(
                            draft.displayName || session.workspace.name,
                          ) || draft.slug,
                        )
                      }
                    >
                      Usar el nombre de mi restaurante como enlace
                    </button>
                    <p className="form-hint">
                      El WhatsApp abre el chat de este negocio. Para llamar por
                      WhatsApp, el cliente usa el botón de llamada de ese chat.
                    </p>
                  </>
                )}
                <div className="builder-question-actions">
                  {step > 0 && (
                    <button
                      type="button"
                      className="button secondary"
                      onClick={() => setStep((s) => s - 1)}
                    >
                      <ArrowLeft size={15} />
                      Atrás
                    </button>
                  )}
                  <button className="button primary" type="submit">
                    {step === 2 ? "Generar mi página" : "Continuar"}
                    {step === 2 ? (
                      <Sparkles size={15} />
                    ) : (
                      <ArrowRight size={15} />
                    )}
                  </button>
                </div>
              </form>
            )}
            {tab === "content" && (
              <div className="builder-editor-fields">
                <span className="eyebrow">TU MARCA, CON TUS PALABRAS</span>
                <h2>Cuenta tu propuesta.</h2>
                <label className="field-label">
                  Nombre público
                  <input
                    value={draft.displayName}
                    maxLength={120}
                    onChange={(e) => change("displayName", e.target.value)}
                  />
                </label>
                <label className="field-label">
                  Título principal
                  <textarea
                    rows={2}
                    value={draft.design.heroTitle}
                    maxLength={140}
                    onChange={(e) => design("heroTitle", e.target.value)}
                  />
                </label>
                <label className="field-label">
                  Presentación del restaurante
                  <textarea
                    rows={4}
                    value={draft.welcome}
                    maxLength={500}
                    onChange={(e) => change("welcome", e.target.value)}
                  />
                </label>
                <label className="field-label">
                  Título de la carta
                  <input
                    value={draft.design.menuTitle}
                    maxLength={80}
                    onChange={(e) => design("menuTitle", e.target.value)}
                  />
                </label>
                <label className="field-label">
                  Título de la historia
                  <input
                    value={draft.design.aboutTitle}
                    maxLength={100}
                    onChange={(e) => design("aboutTitle", e.target.value)}
                  />
                </label>
                <label className="field-label">
                  Historia o descripción completa
                  <textarea
                    rows={5}
                    value={draft.design.about}
                    maxLength={2000}
                    onChange={(e) => design("about", e.target.value)}
                  />
                </label>
                <ImageUploader
                  label="Portada de tu página pública"
                  value={
                    draft.coverImageId
                      ? imageSrc(draft.coverImageId)
                      : undefined
                  }
                  onChange={(id) => change("coverImageId", id)}
                />
                <ImageUploader
                  label="Logo de tu página pública"
                  value={
                    draft.logoImageId ? imageSrc(draft.logoImageId) : undefined
                  }
                  onChange={(id) => change("logoImageId", id)}
                />
                <label className="field-label">
                  Ciudad
                  <input
                    value={draft.city}
                    maxLength={100}
                    onChange={(e) => change("city", e.target.value)}
                  />
                </label>
                <label className="field-label">
                  WhatsApp público
                  <input
                    type="tel"
                    value={draft.whatsappNumber}
                    maxLength={30}
                    onChange={(e) => change("whatsappNumber", e.target.value)}
                  />
                </label>
                <label className="field-label">
                  Teléfono público
                  <input
                    type="tel"
                    value={draft.phone}
                    maxLength={30}
                    onChange={(e) => change("phone", e.target.value)}
                  />
                </label>
                <label className="field-label">
                  Dirección del local
                  <input
                    value={draft.address}
                    maxLength={300}
                    onChange={(e) => change("address", e.target.value)}
                  />
                </label>
                <label className="field-label">
                  Enlace público
                  <input
                    value={draft.slug}
                    minLength={3}
                    maxLength={60}
                    onChange={(e) => change("slug", e.target.value)}
                  />
                </label>
                <button
                  className="button secondary"
                  onClick={() => navigate("products")}
                >
                  <ShoppingBag size={15} />
                  Editar platos, precios y fotos
                </button>
              </div>
            )}
            {tab === "appearance" && (
              <div className="builder-editor-fields">
                <span className="eyebrow">DALE TU PERSONALIDAD</span>
                <h2>Un diseño que sabe a ti.</h2>
                <fieldset className="builder-palette">
                  <legend>Paletas para empezar</legend>
                  {Object.entries(presetColors).map(([id, c]) => (
                    <button
                      type="button"
                      key={id}
                      aria-label={"Aplicar paleta " + id}
                      className="builder-swatch"
                      style={{ background: c.primary }}
                      onClick={() =>
                        change("design", {
                          ...draft.design,
                          primaryColor: c.primary,
                          backgroundColor: c.background,
                        })
                      }
                    >
                      {draft.design.primaryColor === c.primary && (
                        <Check size={16} />
                      )}
                    </button>
                  ))}
                </fieldset>
                <label className="builder-color-field">
                  Color principal
                  <input
                    type="color"
                    value={draft.design.primaryColor}
                    aria-label="Color principal de la página"
                    onChange={(e) => design("primaryColor", e.target.value)}
                  />
                  <code>{draft.design.primaryColor}</code>
                </label>
                <label className="builder-color-field">
                  Color de fondo
                  <input
                    type="color"
                    value={draft.design.backgroundColor}
                    aria-label="Color de fondo de la página"
                    onChange={(e) => design("backgroundColor", e.target.value)}
                  />
                  <code>{draft.design.backgroundColor}</code>
                </label>
                <p className="form-hint">
                  El color de los textos se ajusta para mantenerlos legibles.
                </p>
                <label className="field-label">
                  Tipografía
                  <select
                    value={draft.design.fontFamily}
                    onChange={(e) =>
                      design(
                        "fontFamily",
                        e.target.value as StorefrontDesign["fontFamily"],
                      )
                    }
                  >
                    <option value="sans">
                      Contemporánea · limpia y cercana
                    </option>
                    <option value="serif">
                      Editorial · clásica y gastronómica
                    </option>
                    <option value="rounded">Amable · suave y familiar</option>
                  </select>
                </label>
                <label className="field-label">
                  Tamaño de letra · {draft.design.fontSize} px
                  <input
                    type="range"
                    min={14}
                    max={22}
                    step={1}
                    value={draft.design.fontSize}
                    aria-label="Tamaño de letra de la página"
                    onChange={(e) => design("fontSize", Number(e.target.value))}
                  />
                </label>
                <label className="field-label">
                  Presentación de la portada
                  <select
                    value={draft.design.heroLayout}
                    onChange={(e) =>
                      design(
                        "heroLayout",
                        e.target.value as StorefrontDesign["heroLayout"],
                      )
                    }
                  >
                    <option value="split">
                      Texto a la izquierda, foto a la derecha
                    </option>
                    <option value="cover-left">
                      Foto a la izquierda, texto a la derecha
                    </option>
                    <option value="center">Presentación centrada</option>
                  </select>
                </label>
                <label className="field-label">
                  Distribución de la carta
                  <select
                    value={draft.design.menuLayout}
                    onChange={(e) =>
                      design(
                        "menuLayout",
                        e.target.value as StorefrontDesign["menuLayout"],
                      )
                    }
                  >
                    <option value="grid">Tarjetas con fotos</option>
                    <option value="list">Lista gastronómica</option>
                  </select>
                </label>
                <label className="field-label">
                  Alineación de la portada
                  <select
                    value={draft.design.alignment}
                    onChange={(e) =>
                      design(
                        "alignment",
                        e.target.value as StorefrontDesign["alignment"],
                      )
                    }
                  >
                    <option value="left">A la izquierda</option>
                    <option value="center">Centrada</option>
                  </select>
                </label>
                <label className="field-label">
                  Ancho de la página
                  <select
                    value={draft.design.contentWidth}
                    onChange={(e) =>
                      design(
                        "contentWidth",
                        e.target.value as StorefrontDesign["contentWidth"],
                      )
                    }
                  >
                    <option value="wide">Amplio</option>
                    <option value="cozy">Más recogido</option>
                  </select>
                </label>
              </div>
            )}
            {tab === "sections" && (
              <div className="builder-editor-fields">
                <span className="eyebrow">CADA COSA, EN SU LUGAR</span>
                <h2>Organiza tu página.</h2>
                <p className="form-hint">
                  Sube o baja las secciones. La portada siempre abre tu página.
                </p>
                <div className="builder-section-order">
                  {draft.design.sections.map((section, i) => (
                    <article key={section}>
                      <span>
                        <LayoutTemplate size={16} />
                        {sectionNames[section]}
                      </span>
                      <button
                        type="button"
                        className="icon-button"
                        disabled={i === 0}
                        aria-label={"Subir " + sectionNames[section]}
                        onClick={() => move(section, -1)}
                      >
                        <ArrowUp size={16} />
                      </button>
                      <button
                        type="button"
                        className="icon-button"
                        disabled={i === 2}
                        aria-label={"Bajar " + sectionNames[section]}
                        onClick={() => move(section, 1)}
                      >
                        <ArrowDown size={16} />
                      </button>
                    </article>
                  ))}
                </div>
                <label className="restaurant-confirm">
                  <input
                    type="checkbox"
                    checked={draft.design.showStory}
                    onChange={(e) => design("showStory", e.target.checked)}
                  />
                  Mostrar historia del restaurante
                </label>
                <label className="restaurant-confirm">
                  <input
                    type="checkbox"
                    checked={draft.design.showContact}
                    onChange={(e) => design("showContact", e.target.checked)}
                  />
                  Mostrar ubicación y contacto
                </label>
                <p className="form-hint">
                  Los precios, ingredientes y existencias se administran en Menú
                  y fotos.
                </p>
              </div>
            )}
            {tab === "publish" && (
              <div className="builder-editor-fields">
                <span className="eyebrow">
                  LISTO PARA RECIBIR A TUS CLIENTES
                </span>
                <h2>Tu página, a un paso.</h2>
                <div className="builder-checklist">
                  <p>
                    <CheckCircle2 size={18} />
                    {draft.displayName || session.workspace.name}
                  </p>
                  <p>
                    <ShoppingBag size={18} />
                    {state.productCount} productos en tu carta
                  </p>
                  <p>
                    <Globe size={18} />
                    Enlace: /r/{draft.slug}
                  </p>
                  <p>
                    <ShieldCheck size={18} />
                    Tu panel y tus conversaciones siguen siendo privados.
                  </p>
                </div>
                {!state.productCount && (
                  <p className="inline-notice">
                    Añade tu menú antes de publicar. Puedes hacerlo desde Menú y
                    fotos.
                  </p>
                )}
                <button
                  className="button primary full-width"
                  disabled={!state.productCount}
                  onClick={() => void action("publish")}
                >
                  <Globe size={16} />
                  {state.profile.publicEnabled
                    ? "Publicar cambios"
                    : "Publicar mi página"}
                </button>
                {state.profile.publicEnabled && (
                  <>
                    <a
                      href={state.publicUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="button secondary"
                    >
                      Abrir página publicada <ExternalLink size={15} />
                    </a>
                    <button
                      className="text-button danger"
                      onClick={() => void action("unpublish")}
                    >
                      Retirar mi página de Internet
                    </button>
                  </>
                )}
                <button
                  className="text-button"
                  onClick={() => navigate("restaurant")}
                >
                  Configurar domicilios, horarios y reservas{" "}
                  <ArrowRight size={14} />
                </button>
                <p className="form-hint">
                  La publicación usa el alojamiento de esta plataforma. Si la
                  ejecutas en tu computador, el enlace es local; al publicarla
                  con HTTPS cada restaurante tendrá su dirección pública.
                </p>
              </div>
            )}
          </fieldset>
        </aside>
        <section
          className="builder-preview-area"
          aria-label="Vista previa de tu página"
        >
          <header className="builder-preview-toolbar">
            <span>
              <Eye size={16} />
              Vista previa · no recibe pedidos
            </span>
            <div>
              <button
                className={device === "desktop" ? "selected" : ""}
                aria-label="Vista previa en computador"
                onClick={() => setDevice("desktop")}
              >
                <Monitor size={17} />
              </button>
              <button
                className={device === "mobile" ? "selected" : ""}
                aria-label="Vista previa en celular"
                onClick={() => setDevice("mobile")}
              >
                <Smartphone size={17} />
              </button>
            </div>
          </header>
          <div className={"builder-preview-frame " + device}>
            <div className="builder-preview-address">
              <span />
              <span />
              <span />
              <i>/r/{draft.slug}</i>
            </div>
            <div className="builder-preview-scroll">
              <RestaurantStorefront data={preview} slug={draft.slug} preview />
            </div>
          </div>
          {!products.data?.length && (
            <div className="builder-preview-empty">
              <ImagePlus size={18} />
              <p>Tu menú aparecerá aquí cuando agregues los primeros platos.</p>
              <button
                className="text-button"
                onClick={() => navigate("products")}
              >
                <Plus size={14} />
                Agregar mi menú
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
