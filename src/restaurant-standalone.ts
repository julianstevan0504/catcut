import type { DemoData } from "./standalone";
import {
  defaultDesign,
  pageFromProfile,
  presetColors,
  foldSearch,
} from "../shared/storefront";
import type { StorefrontDraft } from "../shared/storefront";
import type { RestaurantProfile } from "../shared/restaurant";
import {
  defaultRestaurant,
  validateRestaurant,
  localParts,
  minutes,
  dayOfWeek,
  zonedInstant,
  restaurantHours,
  restaurantDelivery,
} from "../shared/restaurant";
import type { KitchenOrder, Reservation } from "./Restaurant";
type SupportTicket = {
  id: string;
  subject: string;
  category: string;
  status: string;
  updated_at: string;
  created_at: string;
  messages: {
    author_role: string;
    author_name: string;
    text: string;
    created_at: string;
  }[];
};
type Extras = {
  restaurant?: RestaurantProfile;
  pageDraft?: { draft: StorefrontDraft; revision: number; updatedAt: string };
  notificationReadIds?: string[];
  reservations?: (Reservation & { token: string; requestId: string })[];
  kitchen?: (KitchenOrder & {
    token: string;
    requestId: string;
    restored?: boolean;
  })[];
  support?: SupportTicket[];
  images?: Record<string, string>;
  businessState?: string;
};
const uid = () => crypto.randomUUID(),
  stamp = () => new Date().toISOString(),
  token = () =>
    Array.from(crypto.getRandomValues(new Uint8Array(32)), (n) =>
      n.toString(16).padStart(2, "0"),
    ).join("");
const error = (message: string, status = 400) =>
  Object.assign(new Error(message), { status });
const link = (key: string, value: string) => {
  const u = new URL(location.href);
  u.search = "";
  u.hash = "";
  u.searchParams.set(key, value);
  return u.href;
};
export function restaurantDemoRequest({
  route,
  method,
  body,
  data,
}: {
  route: string;
  method: string;
  body: Record<string, unknown>;
  data: DemoData;
}): { value: unknown } | null {
  const d = data as DemoData & Extras;
  d.restaurant ??= {
    ...defaultRestaurant("la-mesa-demo"),
    slug: "la-mesa-demo",
    publicEnabled: true,
    reservationsEnabled: true,
    address: "Local de demostración · sin dirección real",
    phone: "",
    cuisine: "Cocina de la casa",
    welcome:
      "Buena comida, buenas conversaciones. Un restaurante de ejemplo para explorar Cerca.",
  };
  d.restaurant = {
    ...defaultRestaurant("la-mesa-demo"),
    ...d.restaurant,
    design: { ...defaultDesign(d.restaurant.accent), ...d.restaurant.design },
  };
  d.restaurant.acceptingOrders ??= true;
  d.notificationReadIds ??= [];
  d.reservations ??= [];
  d.kitchen ??= [];
  d.support ??= [];
  d.images ??= {};
  const done = (value: unknown) => ({ value }),
    p = d.restaurant;
  const event = (action: string, description: string) =>
    d.activities.unshift({
      id: uid(),
      action,
      description,
      actor: "Demo local",
      created_at: stamp(),
    });
  function slots(date: string, party: number) {
    if (!p.reservationsEnabled) return [];
    const today = localParts(new Date(), p.timezone).date;
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      date < today ||
      p.closedDates.includes(date) ||
      party < 1 ||
      party > p.maxParty
    )
      return [];
    const out = [];
    for (const r of p.schedule.filter((x) => x.day === dayOfWeek(date)))
      for (
        let t = minutes(r.open);
        t + p.visitMinutes <= minutes(r.close);
        t += p.slotMinutes
      ) {
        const time =
          String(Math.floor(t / 60)).padStart(2, "0") +
          ":" +
          String(t % 60).padStart(2, "0");
        const start = zonedInstant(date, time, p.timezone),
          end = new Date(start.getTime() + p.visitMinutes * 60000);
        if (start.getTime() < Date.now() + 900000) continue;
        const rows = d.reservations!.filter(
            (x) =>
              ["pending", "confirmed", "seated"].includes(x.status) &&
              x.start_at < end.toISOString() &&
              x.end_at > start.toISOString(),
          ),
          points = [
            start.toISOString(),
            ...rows
              .map((x) => x.start_at)
              .filter((x) => x > start.toISOString()),
          ],
          used = Math.max(
            0,
            ...points.map((t) =>
              rows
                .filter((r) => r.start_at <= t && r.end_at > t)
                .reduce((n, r) => n + r.party_size, 0),
            ),
          );
        if (used + party <= p.capacity)
          out.push({
            time,
            startAt: start.toISOString(),
            endAt: end.toISOString(),
            remaining: p.capacity - used,
          });
      }
    return out;
  }
  function reserve(owner = false) {
    const old = d.reservations!.find((x) => x.requestId === body.requestId);
    if (old) return done({ ...old, viewUrl: link("reservation", old.token) });
    const party = Number(body.partySize),
      slot = slots(String(body.date), party).find((x) => x.time === body.time);
    if (!slot || !body.name || !body.phone || body.confirm !== true)
      throw error(
        "Elige un horario disponible y completa los datos de la reserva.",
      );
    const value = {
      id: uid(),
      code: "R-" + Math.floor(10000000 + Math.random() * 90000000),
      name: String(body.name),
      phone: String(body.phone),
      party_size: party,
      start_at: slot.startAt,
      end_at: slot.endAt,
      status: owner ? "confirmed" : "pending",
      notes: String(body.notes ?? ""),
      source: owner ? "panel" : "web",
      token: token(),
      requestId: String(body.requestId),
    };
    d.reservations!.push(value);
    event("reservation.created", "Se registró una reserva de demostración.");
    return done({ ...value, viewUrl: link("reservation", value.token) });
  }
  function order() {
    const old = d.kitchen!.find((x) => x.requestId === body.requestId);
    if (old) return done({ ...old, viewUrl: link("order", old.token) });
    if (!p.acceptingOrders && path !== "/restaurant/orders")
      throw error("La cocina pausó la recepción de pedidos.", 409);
    if (
      !Array.isArray(body.items) ||
      !body.items.length ||
      body.confirm !== true
    )
      throw error("Revisa y confirma el pedido.");
    const lines = body.items.map((item) => {
      const q = item as { productId: string; quantity: number },
        product = d.products.find((p) => p.id === q.productId);
      if (
        !product ||
        !Number.isInteger(q.quantity) ||
        q.quantity < 1 ||
        product.stock < q.quantity
      )
        throw error("Uno de los platos ya no tiene esa disponibilidad.", 409);
      return {
        product_id: product.id,
        name: product.name,
        unit_price: product.price,
        quantity: q.quantity,
      };
    });
    const fulfillment = String(body.fulfillment) as
      "dineIn" | "pickup" | "delivery";
    if (!p.services[fulfillment])
      throw error("Ese servicio no está disponible.");
    const zone =
      fulfillment === "delivery"
        ? p.deliveryZones.find((z) => z.id === body.deliveryZone)
        : null;
    if (fulfillment === "delivery" && !zone)
      throw error("Selecciona una zona de domicilio.");
    const total =
      lines.reduce((n, x) => n + x.unit_price * x.quantity, 0) +
      (zone?.fee ?? 0);
    if (body.expectedTotal !== undefined && total !== body.expectedTotal)
      throw error("Los precios cambiaron. Revisa el total.", 409);
    for (const line of lines)
      d.products.find((p) => p.id === line.product_id)!.stock -= line.quantity;
    const id = uid(),
      code = "P-" + Math.floor(10000000 + Math.random() * 90000000),
      time = stamp();
    const value = {
      id,
      code,
      customer: String(
        body.name ||
          (fulfillment === "dineIn"
            ? "Mesa " + body.table
            : "Cliente de ejemplo"),
      ),
      phone: String(body.phone ?? ""),
      status: "confirmed",
      total,
      created_at: time,
      lines,
      details: {
        fulfillment,
        delivery_address: String(body.address ?? ""),
        delivery_zone: zone?.name ?? "",
        delivery_fee: zone?.fee ?? 0,
        table_label: String(body.table ?? ""),
        notes: String(body.notes ?? ""),
        payment_method: String(body.paymentMethod ?? "pay-at-restaurant"),
      },
      paymentStatus: "pending",
      token: token(),
      requestId: String(body.requestId),
    };
    d.kitchen!.unshift(value);
    d.orders.unshift({
      id,
      code,
      customer: value.customer,
      phone: value.phone,
      status: "confirmed",
      total,
      items: lines.map((l) => `${l.quantity} × ${l.name}`).join(", "),
      tracking_number: "",
      tracking_url: "",
      created_at: time,
      updated_at: time,
    });
    event(
      "restaurant.order.created",
      "Se registró un pedido de demostración y se ajustó el stock local.",
    );
    return done({ ...value, viewUrl: link("order", value.token) });
  }
  const url = new URL(route, "https://local.invalid");
  const path = url.pathname;
  const pageView = () => ({
    profile: d.restaurant!,
    draft: {
      ...pageFromProfile(d.restaurant!),
      ...d.pageDraft?.draft,
      displayName:
        d.pageDraft?.draft.displayName || d.restaurant!.displayName || d.name,
    },
    revision: d.pageDraft?.revision ?? 0,
    updatedAt: d.pageDraft?.updatedAt ?? null,
    publicUrl: link("restaurant", d.restaurant!.slug),
    directoryUrl: link("explore", "restaurants"),
    hasUnpublishedChanges:
      !!d.pageDraft &&
      JSON.stringify(d.pageDraft.draft) !==
        JSON.stringify(pageFromProfile(d.restaurant!)),
    productCount: d.products.length,
  });
  if (path === "/restaurant/page") {
    if (method === "PUT") {
      if (body.revision !== (d.pageDraft?.revision ?? 0))
        throw error("El borrador cambió. Recarga antes de guardar.", 409);
      const validated = validateRestaurant(
        { ...p, ...(body.draft as object) },
        p,
      );
      d.pageDraft = {
        draft: pageFromProfile(validated),
        revision: (d.pageDraft?.revision ?? 0) + 1,
        updatedAt: stamp(),
      };
      event(
        "storefront.draft.saved",
        "Se guardó un borrador de la página pública de demostración.",
      );
    }
    return done(pageView());
  }
  if (path === "/restaurant/page/publish" && method === "POST") {
    if (body.revision !== (d.pageDraft?.revision ?? 0))
      throw error("El borrador cambió. Recarga antes de publicar.", 409);
    if (!d.products.length)
      throw error("Agrega al menos un plato antes de publicar.");
    if (!(d.pageDraft?.draft.whatsappNumber || p.whatsappNumber))
      throw error("Agrega el WhatsApp del restaurante antes de publicar.");
    d.restaurant = validateRestaurant(
      { ...p, ...d.pageDraft?.draft, publicEnabled: true },
      p,
    );
    event("storefront.published", "Se publicó la página de demostración.");
    return done(pageView());
  }
  if (path === "/restaurant/page/unpublish" && method === "POST") {
    d.restaurant!.publicEnabled = false;
    return done(pageView());
  }
  if (path === "/public/restaurants") {
    const query = foldSearch(url.searchParams.get("q")),
      city = foldSearch(url.searchParams.get("city")),
      service = url.searchParams.get("service") ?? "all",
      page = Number(url.searchParams.get("page") ?? 1),
      limit = Number(url.searchParams.get("limit") ?? 12);
    const name = p.displayName || d.name,
      match =
        p.publicEnabled &&
        d.businessState !== "suspended" &&
        foldSearch([name, p.cuisine, p.city, p.specialties].join(" ")).includes(
          query,
        ) &&
        (!city || city === foldSearch(p.city)) &&
        (service === "all" ||
          (service === "reservations"
            ? p.reservationsEnabled
            : p.services[service as keyof typeof p.services]));
    const prices = d.products.filter((x) => x.stock > 0).map((x) => x.price);
    return done({
      restaurants:
        match && page === 1
          ? [
              {
                slug: p.slug,
                name,
                cuisine: p.cuisine,
                city: p.city,
                specialties: p.specialties,
                welcome: p.welcome,
                services: p.services,
                reservationsEnabled: p.reservationsEnabled,
                acceptingOrders: p.acceptingOrders,
                coverImageUrl: d.images[p.coverImageId] ?? "",
                logoImageUrl: d.images[p.logoImageId] ?? "",
                primaryColor: p.design.primaryColor,
                publicUrl: link("restaurant", p.slug),
                items: d.products.length,
                fromPrice: prices.length ? Math.min(...prices) : null,
              },
            ]
          : [],
      total: match ? 1 : 0,
      page,
      limit,
      cities: p.publicEnabled && p.city ? [p.city] : [],
    });
  }
  if (path === "/restaurant/notifications") {
    const all = d.kitchen.filter((x) => !d.notificationReadIds!.includes(x.id));
    return done({
      items: all.slice(0, 30).map((x) => ({
        ...x,
        fulfillment: x.details.fulfillment,
        delivery_address: x.details.delivery_address,
      })),
      unread: all.length,
    });
  }
  if (path === "/restaurant/notifications/read" && method === "POST") {
    d.notificationReadIds = [
      ...new Set([...d.notificationReadIds, ...(body.ids as string[])]),
    ];
    return done({ ok: true });
  }
  if (path === "/restaurant") {
    if (method === "PUT") {
      if (
        body.accent &&
        body.accent !== p.accent &&
        JSON.stringify(body.design) === JSON.stringify(p.design)
      ) {
        const colors = presetColors[body.accent as keyof typeof presetColors];
        body.design = {
          ...p.design,
          primaryColor: colors.primary,
          backgroundColor: colors.background,
        };
      }
      d.restaurant = validateRestaurant(body, p);
      d.settings.hours = restaurantHours(d.restaurant);
      d.settings.shipping = restaurantDelivery(d.restaurant);
      d.settings.timezone = d.restaurant.timezone;
      event(
        "restaurant.updated",
        "Se actualizó el restaurante de demostración.",
      );
      return done({ ok: true });
    }
    return done({
      ...p,
      coverImageUrl: d.images[p.coverImageId] ?? "",
      logoImageUrl: d.images[p.logoImageId] ?? "",
      publicUrl: link("restaurant", p.slug),
    });
  }
  if (path === "/account/recovery")
    return done({
      remaining: 0,
      emailEnabled: false,
      adminSetupAvailable: false,
      platformAdmin: true,
    });
  if (path === "/media/images" && method === "GET") {
    const used = new Set([
      p.coverImageId,
      p.logoImageId,
      d.pageDraft?.draft.coverImageId,
      d.pageDraft?.draft.logoImageId,
      ...d.products.map((x) => x.image_id),
    ]);
    const images = Object.entries(d.images).map(([id, url]) => ({
      id,
      url,
      used: used.has(id),
      bytes: Math.ceil(url.length * 0.75),
    }));
    return done({
      images,
      bytes: images.reduce((n, x) => n + x.bytes, 0),
      limitBytes: 50 * 1024 * 1024,
    });
  }
  if (path.startsWith("/media/images/") && method === "DELETE") {
    const id = path.split("/")[3];
    if (!d.images[id]) throw error("Foto no encontrada.", 404);
    if (
      [
        p.coverImageId,
        p.logoImageId,
        ...d.products.map((x) => x.image_id),
      ].includes(id)
    )
      throw error("Esta foto todavía está en uso.", 409);
    delete d.images[id];
    return done({ ok: true });
  }
  if (path === "/media/images" && method === "POST") {
    const image = String(body.data ?? "");
    if (
      !/^data:image\/(jpeg|png|webp);base64,/.test(image) ||
      image.length > 1600000
    )
      throw error("Usa una foto JPG, PNG o WebP.");
    const id = uid();
    d.images[id] = image;
    return done({ imageId: id, url: image, bytes: image.length });
  }
  if (path === "/public/restaurants/" + p.slug) {
    if (!p.publicEnabled || d.businessState === "suspended")
      throw error("El menú de demostración no está publicado.", 404);
    return done({
      name: p.displayName || d.name,
      profile: {
        ...p,
        coverImageUrl: d.images[p.coverImageId] ?? "",
        logoImageUrl: d.images[p.logoImageId] ?? "",
      },
      products: d.products.map((x) => ({
        ...x,
        image_url: x.image_id ? d.images![x.image_id] : x.image_url,
      })),
      assistantName: d.settings.assistantName,
      voiceUrl: null,
      offline: true,
    });
  }
  if (
    path === "/public/restaurants/" + p.slug + "/availability" ||
    path === "/reservations/availability"
  )
    return done({
      timezone: p.timezone,
      slots: slots(
        url.searchParams.get("date") ?? "",
        Number(url.searchParams.get("partySize") ?? 2),
      ),
    });
  if (path === "/reservations") {
    return method === "POST" ? reserve(true) : done(d.reservations);
  }
  if (
    path === "/public/restaurants/" + p.slug + "/reservations" &&
    method === "POST"
  )
    return reserve();
  if (
    (path === "/public/restaurants/" + p.slug + "/orders" ||
      path === "/restaurant/orders") &&
    method === "POST"
  )
    return order();
  if (path.startsWith("/public/reservations/")) {
    const t = path.split("/")[3],
      r = d.reservations.find((x) => x.token === t);
    if (!r) throw error("Reserva de demostración no encontrada.", 404);
    if (path.endsWith("/cancel")) {
      r.status = "cancelled";
      return done({ ok: true });
    }
    return done({
      code: r.code,
      name: r.name,
      partySize: r.party_size,
      startAt: r.start_at,
      endAt: r.end_at,
      status: r.status,
      notes: r.notes,
      restaurant: p.displayName || d.name,
      timezone: p.timezone,
    });
  }
  if (path.startsWith("/public/orders/")) {
    const o = d.kitchen.find((x) => x.token === path.split("/")[3]);
    if (!o) throw error("Pedido no encontrado.", 404);
    return done({
      ...o,
      restaurant: p.displayName || d.name,
      prepMinutes: p.prepMinutes,
    });
  }
  const reservation = path.match(/^\/reservations\/([^/]+)$/);
  if (reservation && method === "PUT") {
    const r = d.reservations.find((x) => x.id === reservation[1]);
    if (!r) throw error("Reserva no encontrada.", 404);
    r.status = String(body.status);
    event("reservation.updated", "Se actualizó una reserva de demostración.");
    return done({ ok: true });
  }
  if (path === "/kitchen")
    return done(
      d.kitchen.filter((x) => !["cancelled", "delivered"].includes(x.status)),
    );
  if (/^\/kitchen\/[^/]+\/payment$/.test(path) && method === "PUT") {
    const o = d.kitchen.find((x) => x.id === path.split("/")[2]);
    if (!o) throw error("Pedido no encontrado.", 404);
    o.paymentStatus = String(body.status);
    return done({ ok: true });
  }
  const kitchen = path.match(/^\/kitchen\/([^/]+)\/status$/);
  if (kitchen && method === "PUT") {
    const o = d.kitchen.find((x) => x.id === kitchen[1]);
    if (!o) throw error("Pedido no encontrado.", 404);
    o.status = String(body.status);
    const record = d.orders.find((x) => x.id === o.id);
    if (record) record.status = o.status as typeof record.status;
    if (o.status === "cancelled" && !o.restored) {
      for (const line of o.lines) {
        const p = d.products.find((p) => p.id === line.product_id);
        if (p) p.stock += line.quantity;
      }
      o.restored = true;
    }
    event(
      "restaurant.order.updated",
      "Se actualizó un pedido de demostración.",
    );
    return done({ ok: true });
  }
  if (path === "/support/tickets") {
    if (method === "POST") {
      const id = uid(),
        time = stamp();
      d.support.push({
        id,
        subject: String(body.subject),
        category: String(body.category),
        status: "open",
        created_at: time,
        updated_at: time,
        messages: [
          {
            author_role: "business",
            author_name: "Andrea",
            text: String(body.text),
            created_at: time,
          },
        ],
      });
      event("support.created", "Se creó una consulta de demostración.");
      return done({ id });
    }
    return done(d.support);
  }
  if (path === "/platform/support")
    return done(d.support.map((t) => ({ ...t, restaurant: d.name })));
  const support = path.match(
    /^\/(support\/tickets|platform\/support)\/([^/]+)(\/messages)?$/,
  );
  if (support) {
    const t = d.support.find((x) => x.id === support[2]);
    if (!t) throw error("Solicitud no encontrada.", 404);
    if (method === "POST") {
      t.messages.push({
        author_role: support[1].startsWith("platform")
          ? "platform"
          : "business",
        author_name: "Demo local",
        text: String(body.text),
        created_at: stamp(),
      });
      t.status = support[1].startsWith("platform")
        ? String(body.status ?? "working")
        : "open";
      t.updated_at = stamp();
      return done({ ok: true });
    }
    return done(t);
  }
  if (path === "/platform/overview")
    return done({
      metrics: {
        restaurants: 1,
        active: d.businessState === "suspended" ? 0 : 1,
        suspended: d.businessState === "suspended" ? 1 : 0,
        openTickets: d.support.filter((x) => x.status !== "closed").length,
        orders: d.kitchen.length,
        reservations: d.reservations.length,
      },
      restaurants: [
        {
          id: "offline-workspace",
          name: d.name,
          owner_email: "demo@cerca.local",
          public_name: p.displayName || d.name,
          public_slug: p.slug,
          public_enabled: p.publicEnabled ? 1 : 0,
          status: d.businessState ?? "active",
          reason: "",
          orders: d.kitchen.length,
          reservations: d.reservations.length,
          images: Object.keys(d.images).length,
          created_at: stamp(),
        },
      ],
      settings: {
        registrationOpen: false,
        brandName: "Cerca Restaurantes · demo",
        supportEmail: "",
      },
      events: d.activities.slice(0, 20).map((a) => ({
        action: a.action,
        target: "offline-workspace",
        details: a.description,
        created_at: a.created_at,
      })),
    });
  if (path === "/platform/settings" && method === "PUT") {
    event(
      "platform.settings.updated",
      "Se probaron ajustes de plataforma en la demo.",
    );
    return done({ ok: true });
  }
  if (path.startsWith("/platform/restaurants/") && method === "PUT") {
    d.businessState = String(body.status);
    return done({ ok: true });
  }
  if (
    path.startsWith("/auth/forgot-password") ||
    path.startsWith("/auth/reset-password")
  )
    throw error(
      "La recuperación de cuentas reales requiere iniciar el servidor de la aplicación.",
    );
  return null;
}
