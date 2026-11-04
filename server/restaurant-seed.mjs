import { randomUUID } from "node:crypto";
import { restaurantMenuExamples } from "../shared/restaurant-examples.ts";
import { defaultRestaurant } from "../shared/restaurant.ts";
import { assistantReply } from "../shared/advisor.ts";
export function seedRestaurant(db, ws, settings) {
  const id = () => randomUUID(),
    time = () => new Date().toISOString();
  for (const p of restaurantMenuExamples)
    db.prepare(
      "INSERT INTO products (id,workspace_id,name,sku,description,category,price,stock,color,ingredients,allergens,kind) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
    ).run(
      id(),
      ws,
      p.name,
      p.sku,
      p.description,
      p.category,
      p.price,
      p.stock,
      p.color,
      p.ingredients,
      p.allergens,
      p.kind,
    );
  const p = {
    ...defaultRestaurant(ws),
    slug: "la-mesa-demo",
    publicEnabled: true,
    reservationsEnabled: true,
    address: "Restaurante de demostración · sin dirección real",
    cuisine: "Cocina de la casa",
  };
  db.prepare("INSERT INTO restaurant_profiles VALUES (?,?,?,?)").run(
    ws,
    p.slug,
    JSON.stringify(p),
    time(),
  );
  const contacts = [
    [
      "Valentina Rojas",
      "+573001112233",
      "stock",
      "¿Qué ingredientes tiene la Pizza Margarita?",
    ],
    [
      "Santiago López",
      "+573102224455",
      "pedido",
      "¿Cómo va mi pedido LC-1043?",
    ],
    ["Mariana Torres", "+573203334466", "horario", "¿En qué horario atienden?"],
    [
      "Daniela Pérez",
      "+573304445577",
      "humano",
      "Quiero hablar con una persona",
    ],
    ["Andrés Castro", "+573405556688", "stock", "¿Tienen Ensalada Verde?"],
    ["Camila Ruiz", "+573516667799", "general", "¿Cómo puedo pagar?"],
  ];
  for (const [code, customer, phone, status, total, items, tracking] of [
    [
      "LC-1042",
      "Valentina Rojas",
      "+573001112233",
      "shipped",
      28000,
      "1 × Pizza Margarita",
      "DEMO-1042",
    ],
    [
      "LC-1043",
      "Santiago López",
      "+573102224455",
      "preparing",
      24000,
      "1 × Hamburguesa de la Casa",
      "",
    ],
  ])
    db.prepare("INSERT INTO orders VALUES (?,?,?,?,?,?,?,?,?,?,?,?)").run(
      id(),
      ws,
      code,
      customer,
      phone,
      status,
      total,
      items,
      tracking,
      "",
      time(),
      time(),
    );
  for (const [name, phone, topic, text] of contacts) {
    const cid = id(),
      t = time();
    db.prepare("INSERT INTO conversations VALUES (?,?,?,?,?,?,?,?,?,?,?)").run(
      cid,
      ws,
      name,
      phone,
      "demo",
      topic === "humano" ? "pending" : "open",
      topic === "humano" ? 1 : 0,
      1,
      topic,
      t,
      t,
    );
    const result = assistantReply({
      settings,
      storeName: "La Mesa",
      products: db
        .prepare("SELECT * FROM products WHERE workspace_id=?")
        .all(ws),
      orders: db.prepare("SELECT * FROM orders WHERE workspace_id=?").all(ws),
      phone,
      text,
    });
    for (const [role, body] of [
      ["user", text],
      ["assistant", result.text],
    ])
      db.prepare("INSERT INTO messages VALUES (?,?,?,?,?,?,?,?)").run(
        id(),
        cid,
        role,
        body,
        "local",
        role === "user" ? "received" : "simulated",
        null,
        t,
      );
  }
}
