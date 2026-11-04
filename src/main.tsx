import { StrictMode, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
const AccountRecovery = lazy(() =>
  import("./PublicRecovery").then((m) => ({ default: m.AccountRecovery })),
);
const PublicRestaurant = lazy(() =>
  import("./Restaurant").then((m) => ({ default: m.PublicRestaurant })),
);
const GuestTracking = lazy(() =>
  import("./Restaurant").then((m) => ({ default: m.GuestTracking })),
);
const PublicVoice = lazy(() =>
  import("./VoiceConsole").then((m) => ({ default: m.PublicVoice })),
);
const RestaurantDirectory = lazy(() =>
  import("./Directory").then((m) => ({ default: m.RestaurantDirectory })),
);

import { ErrorBoundary } from "./ErrorBoundary";
import "./styles.css";
import "./refinements.css";
import "./restaurant.css";
import "./storefront.css";
document.documentElement.dataset.product = "restaurants";

const query = new URLSearchParams(location.search);
const voiceToken = query.get("voice"),
  restaurant =
    query.get("restaurant") ||
    (location.pathname.match(/^\/r\/([a-z0-9-]+)\/?$/)?.[1] ?? null),
  recovery = query.get("recover"),
  order = query.get("order"),
  reservation = query.get("reservation");

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
        {recovery ? (
          <AccountRecovery token={recovery} />
        ) : query.get("explore") === "restaurants" ? (
          <RestaurantDirectory />
        ) : restaurant ? (
          <PublicRestaurant slug={restaurant} />
        ) : order ? (
          <GuestTracking token={order} type="order" />
        ) : reservation ? (
          <GuestTracking token={reservation} type="reservation" />
        ) : voiceToken ? (
          <PublicVoice token={voiceToken} />
        ) : (
          <App />
        )}
      </Suspense>
    </ErrorBoundary>
  </StrictMode>,
);
