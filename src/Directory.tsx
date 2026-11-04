import { useEffect, useState } from "react";
import {
  Search,
  MapPin,
  ArrowUpRight,
  ArrowRight,
  UtensilsCrossed,
  ChefHat,
  ShoppingBag,
  CalendarDays,
  SlidersHorizontal,
} from "lucide-react";
import { post, useResource, money } from "./api";
import { Logo, Spinner, ErrorState } from "./components";
import { standaloneMode } from "./standalone";
import { DishArt } from "./Restaurant";
export type PublicListing = {
  slug: string;
  name: string;
  cuisine: string;
  city: string;
  specialties: string;
  welcome: string;
  services: { delivery: boolean; pickup: boolean; dineIn: boolean };
  reservationsEnabled: boolean;
  acceptingOrders: boolean;
  coverImageUrl: string;
  logoImageUrl: string;
  primaryColor: string;
  publicUrl: string;
  items: number;
  fromPrice: number | null;
};
export function RestaurantDirectory({
  onAuthenticated,
}: { onAuthenticated?: () => Promise<void> } = {}) {
  const params = new URLSearchParams(location.search),
    [query, setQuery] = useState((params.get("q") ?? "").slice(0, 100)),
    [term, setTerm] = useState(query),
    [city, setCity] = useState((params.get("city") ?? "").slice(0, 100)),
    [service, setService] = useState(
      ["delivery", "pickup", "dineIn", "reservations"].includes(
        params.get("service") ?? "",
      )
        ? params.get("service")!
        : "all",
    ),
    [page, setPage] = useState(() => {
      const value = Number(params.get("page") ?? 1);
      return Number.isInteger(value) && value > 0 && value <= 1000 ? value : 1;
    });
  useEffect(() => {
    if (term === query) return;
    const timer = setTimeout(() => {
      setTerm(query);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [query, term]);
  useEffect(() => {
    const url = new URL(location.href);
    for (const [key, value] of Object.entries({
      q: term,
      city,
      service: service === "all" ? "" : service,
      page: page === 1 ? "" : String(page),
    })) {
      if (value) url.searchParams.set(key, value);
      else url.searchParams.delete(key);
    }
    try {
      history.replaceState(null, "", url);
    } catch {
      /* Local previews can restrict history. Filters remain usable. */
    }
  }, [term, city, service, page]);
  const path =
      "/public/restaurants?" +
      new URLSearchParams({
        q: term,
        city,
        service,
        page: String(page),
        limit: "12",
      }),
    { data, loading, error, reload } = useResource<{
      restaurants: PublicListing[];
      total: number;
      page: number;
      limit: number;
      cities: string[];
    }>(path);
  const flags = useResource<{ demoEnabled: boolean }>("/bootstrap");
  const base = standaloneMode ? location.pathname : "/";
  const [entryError, setEntryError] = useState("");
  async function demo() {
    setEntryError("");
    try {
      await post("/auth/demo");
      if (onAuthenticated) {
        await onAuthenticated();
        location.hash = "overview";
      } else location.assign(base + "?access=panel#overview");
    } catch (e) {
      setEntryError((e as Error).message);
    }
  }
  return (
    <main className="restaurant-directory">
      <header className="directory-header">
        <a
          href={base + "?explore=restaurants"}
          aria-label="Cerca Restaurantes, inicio"
        >
          <Logo />
        </a>
        <nav aria-label="Acceso de restaurantes">
          {flags.data?.demoEnabled && !standaloneMode && (
            <button className="text-button" onClick={() => void demo()}>
              Explorar la demo
            </button>
          )}
          <a href={base + "#login"}>
            {standaloneMode
              ? "Abrir panel de ejemplo"
              : "Ya tengo un restaurante"}{" "}
            <ArrowUpRight size={15} />
          </a>
          <a className="button primary" href={base + "#register"}>
            {standaloneMode
              ? "Explorar la plataforma"
              : "Registrar mi restaurante"}{" "}
            <ArrowRight size={15} />
          </a>
        </nav>
      </header>
      {entryError && (
        <p className="inline-error directory-entry-error" role="alert">
          {entryError}
        </p>
      )}
      {standaloneMode && (
        <div className="restaurant-demo-banner">
          Buscador de demostración. Solo muestra el restaurante guardado en este
          navegador. Para registrar negocios reales, usa el iniciador incluido.
        </div>
      )}
      <section className="directory-hero">
        <div className="directory-hero-copy">
          <span className="directory-eyebrow">
            <i /> BUENA COMIDA. BUENOS ENCUENTROS.
          </span>
          <h1>
            ¿Dónde comemos
            <br />
            <em>algo bueno?</em>
          </h1>
          <p>
            Encuentra tu restaurante, explora su carta y pide directamente a
            quienes preparan tu comida.
          </p>
          <form
            className="directory-search"
            onSubmit={(e) => {
              e.preventDefault();
              setTerm(query);
              setPage(1);
              document
                .getElementById("directory-results")
                ?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
          >
            <Search size={22} />
            <label className="visually-hidden" htmlFor="find-restaurant">
              Buscar un restaurante
            </label>
            <input
              id="find-restaurant"
              maxLength={100}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Prueba con el nombre, como Mateo Papa…"
            />
            <button type="submit" aria-label="Buscar restaurantes">
              <ArrowRight size={22} />
            </button>
          </form>
          <div className="directory-promises">
            <span>
              <UtensilsCrossed size={15} /> La carta de cada local
            </span>
            <span>
              <ShoppingBag size={15} /> Pedido directo al restaurante
            </span>
            <span>
              <CalendarDays size={15} /> Tu próxima mesa
            </span>
          </div>
        </div>
        <div className="directory-art" aria-hidden="true">
          <span className="directory-orbit one" />
          <span className="directory-orbit two" />
          <div className="directory-plate">
            <DishArt />
          </div>
          <span className="directory-art-tag">
            <ChefHat size={18} /> De su cocina, a tu mesa.
          </span>
          <span className="directory-tomato" />
          <span className="directory-leaf" />
          <span className="directory-spark">✳</span>
        </div>
      </section>
      <section className="directory-content" id="directory-results">
        <div className="directory-section-heading">
          <div>
            <span className="eyebrow">DESCUBRE TU PRÓXIMO FAVORITO</span>
            <h2>
              {term
                ? "Lo que buscas, más cerca."
                : "Cada restaurante, su sabor."}
            </h2>
          </div>
          <span>
            {loading
              ? "Buscando…"
              : `${data?.total ?? 0} ${(data?.total ?? 0) === 1 ? "restaurante" : "restaurantes"}`}
          </span>
        </div>
        <div className="directory-filters">
          <span>
            <SlidersHorizontal size={16} /> A tu gusto
          </span>
          <label>
            Ciudad
            <select
              value={city}
              onChange={(e) => {
                setCity(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Todas las ciudades</option>
              {data?.cities.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label>
            ¿Qué necesitas?
            <select
              value={service}
              onChange={(e) => {
                setService(e.target.value);
                setPage(1);
              }}
            >
              <option value="all">Todas las opciones</option>
              <option value="delivery">A domicilio</option>
              <option value="pickup">Para recoger</option>
              <option value="dineIn">Comer en el local</option>
              <option value="reservations">Reservar mesa</option>
            </select>
          </label>
          {(query || city || service !== "all") && (
            <button
              className="text-button"
              onClick={() => {
                setQuery("");
                setCity("");
                setService("all");
                setPage(1);
              }}
            >
              Limpiar filtros
            </button>
          )}
        </div>
        {error ? (
          <ErrorState message={error} retry={reload} />
        ) : loading ? (
          <Spinner label="Buscando restaurantes…" />
        ) : data?.restaurants.length ? (
          <div className="directory-grid">
            {data.restaurants.map((r) => (
              <article className="directory-card" key={r.slug}>
                <a className="directory-card-link" href={r.publicUrl}>
                  <div className="directory-card-cover">
                    {r.coverImageUrl ? (
                      <img
                        src={r.coverImageUrl}
                        alt={"El restaurante " + r.name}
                        loading="lazy"
                      />
                    ) : (
                      <div className="directory-card-art">
                        <DishArt />
                      </div>
                    )}
                    <span className={r.acceptingOrders ? "" : "paused"}>
                      {r.acceptingOrders
                        ? "Recibiendo pedidos"
                        : "Carta disponible"}
                    </span>
                    <i>
                      <ArrowUpRight size={20} />
                    </i>
                  </div>
                  <div className="directory-card-body">
                    <div className="directory-card-brand">
                      {r.logoImageUrl && <img src={r.logoImageUrl} alt="" />}
                      <div>
                        <small>{r.cuisine}</small>
                        <h3>{r.name}</h3>
                      </div>
                    </div>
                    {r.city && (
                      <span className="directory-city">
                        <MapPin size={13} />
                        {r.city}
                      </span>
                    )}
                    <p>{r.welcome}</p>
                    <div className="directory-service-tags">
                      {r.services.delivery && <span>Domicilio</span>}
                      {r.services.pickup && <span>Recogida</span>}
                      {r.reservationsEnabled && <span>Reservas</span>}
                    </div>
                    <div className="directory-card-bottom">
                      <span>
                        {r.fromPrice !== null ? (
                          <>
                            Opciones desde <strong>{money(r.fromPrice)}</strong>
                          </>
                        ) : (
                          "Explora su propuesta"
                        )}
                      </span>
                      <b>
                        Ver carta <ArrowRight size={14} />
                      </b>
                    </div>
                  </div>
                </a>
              </article>
            ))}
          </div>
        ) : (
          <div className="directory-empty">
            <Search size={36} />
            <h3>No encontramos ese restaurante.</h3>
            <p>
              Prueba otro nombre o cambia los filtros. Un negocio aparece aquí
              cuando su dueño publica la página.
            </p>
            <button
              className="button secondary"
              onClick={() => {
                setQuery("");
                setCity("");
                setService("all");
              }}
            >
              Ver todos los restaurantes
            </button>
          </div>
        )}
        {data && data.total > data.limit && (
          <nav
            className="directory-pagination"
            aria-label="Páginas de restaurantes"
          >
            <button
              className="button secondary"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Anterior
            </button>
            <span>
              Página {page} de {Math.ceil(data.total / data.limit)}
            </span>
            <button
              className="button secondary"
              disabled={page * data.limit >= data.total}
              onClick={() => setPage((p) => p + 1)}
            >
              Siguiente
            </button>
          </nav>
        )}
      </section>
      <section className="directory-owner-banner">
        <ChefHat size={42} />
        <div>
          <span className="eyebrow">TU RESTAURANTE TAMBIÉN TIENE UN LUGAR</span>
          <h2>Tu carta. Tu estilo. Tu propia página.</h2>
          <p>Diseña tu espacio público y recibe los pedidos en tu panel.</p>
        </div>
        <a className="button primary" href={base + "#register"}>
          Crear mi espacio <ArrowUpRight size={16} />
        </a>
      </section>
      <footer className="directory-footer">
        <Logo />
        <span>Restaurantes independientes. Conversaciones cercanas.</span>
        <a href={base + "#login"}>Acceso de propietarios</a>
        <a href={standaloneMode ? base + "?admin=1" : "/admin"}>
          Soy el dueño de la plataforma
        </a>
      </footer>
    </main>
  );
}
