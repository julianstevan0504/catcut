import { defaultRestaurant } from "../shared/restaurant.ts";
const now = () => new Date().toISOString();
export function restaurantSchema(db) {
  db.exec(`
 CREATE TABLE IF NOT EXISTS restaurant_profiles(workspace_id TEXT PRIMARY KEY REFERENCES workspaces(id),slug TEXT NOT NULL UNIQUE,data TEXT NOT NULL,updated_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS business_states(workspace_id TEXT PRIMARY KEY REFERENCES workspaces(id),status TEXT NOT NULL DEFAULT 'active',reason TEXT NOT NULL DEFAULT '',updated_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS conversation_actions(conversation_id TEXT PRIMARY KEY REFERENCES conversations(id) ON DELETE CASCADE,draft TEXT NOT NULL,updated_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS platform_admins(user_id TEXT PRIMARY KEY REFERENCES users(id),created_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS platform_settings(id INTEGER PRIMARY KEY CHECK(id=1),data TEXT NOT NULL,updated_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS recovery_codes(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),code_hash TEXT NOT NULL UNIQUE,used_at TEXT,created_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS password_resets(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),expires_at TEXT NOT NULL,used_at TEXT,created_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS support_tickets(id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL REFERENCES workspaces(id),subject TEXT NOT NULL,category TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'open',created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS support_messages(id TEXT PRIMARY KEY,ticket_id TEXT NOT NULL REFERENCES support_tickets(id),author_role TEXT NOT NULL,author_name TEXT NOT NULL,text TEXT NOT NULL,created_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS media_images(id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL REFERENCES workspaces(id),mime TEXT NOT NULL,bytes INTEGER NOT NULL,width INTEGER NOT NULL,height INTEGER NOT NULL,created_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS reservations(id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL REFERENCES workspaces(id),code TEXT NOT NULL UNIQUE,name TEXT NOT NULL,phone TEXT NOT NULL,party_size INTEGER NOT NULL,start_at TEXT NOT NULL,end_at TEXT NOT NULL,status TEXT NOT NULL,notes TEXT NOT NULL,source TEXT NOT NULL,request_id TEXT NOT NULL,guest_token_hash TEXT NOT NULL UNIQUE,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,UNIQUE(workspace_id,request_id));
 CREATE INDEX IF NOT EXISTS reservations_schedule ON reservations(workspace_id,start_at,end_at,status);
 CREATE TABLE IF NOT EXISTS restaurant_orders(order_id TEXT PRIMARY KEY REFERENCES orders(id),workspace_id TEXT NOT NULL REFERENCES workspaces(id),fulfillment TEXT NOT NULL,delivery_address TEXT NOT NULL,delivery_zone TEXT NOT NULL,delivery_fee INTEGER NOT NULL,table_label TEXT NOT NULL,notes TEXT NOT NULL,payment_method TEXT NOT NULL,request_id TEXT NOT NULL,guest_token_hash TEXT NOT NULL UNIQUE,stock_restored INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL,UNIQUE(workspace_id,request_id));
 CREATE TABLE IF NOT EXISTS order_lines(id TEXT PRIMARY KEY,order_id TEXT NOT NULL REFERENCES orders(id),product_id TEXT NOT NULL,name TEXT NOT NULL,unit_price INTEGER NOT NULL,quantity INTEGER NOT NULL);
 `);
  const columns = new Set(
    db
      .prepare("PRAGMA table_info(products)")
      .all()
      .map((c) => c.name),
  );
  if (!columns.has("image_id"))
    db.exec(
      "ALTER TABLE products ADD COLUMN image_id TEXT NOT NULL DEFAULT ''",
    );
  const orderColumns = new Set(
    db
      .prepare("PRAGMA table_info(restaurant_orders)")
      .all()
      .map((c) => c.name),
  );
  if (!orderColumns.has("payment_status"))
    db.exec(
      "ALTER TABLE restaurant_orders ADD COLUMN payment_status TEXT NOT NULL DEFAULT 'pending'",
    );
}
export function isAdmin(db, id) {
  return Boolean(
    db.prepare("SELECT user_id FROM platform_admins WHERE user_id=?").get(id),
  );
}
export function activeBusiness(db, ws) {
  return (
    db
      .prepare("SELECT status FROM business_states WHERE workspace_id=?")
      .get(ws)?.status !== "suspended"
  );
}
export function profileFor(db, ws) {
  const row = db
    .prepare("SELECT data FROM restaurant_profiles WHERE workspace_id=?")
    .get(ws);
  if (row) return { ...defaultRestaurant(ws), ...JSON.parse(row.data) };
  const p = defaultRestaurant(ws);
  db.prepare("INSERT INTO restaurant_profiles VALUES (?,?,?,?)").run(
    ws,
    p.slug,
    JSON.stringify(p),
    now(),
  );
  return p;
}
export function platformSettings(db, fallback = true) {
  const row = db.prepare("SELECT data FROM platform_settings WHERE id=1").get();
  return {
    registrationOpen: fallback,
    brandName: "Cerca Restaurantes",
    supportEmail: "",
    ...(row ? JSON.parse(row.data) : {}),
  };
}
