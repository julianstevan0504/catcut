import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { createApp } from "../server/app.mjs";
import { defaultSettings } from "../shared/defaults.ts";
import { hashPassword, tokenHash } from "../server/security.mjs";

test("una base de datos de la versión anterior conserva cuenta y sesión al migrar", async () => {
  const dir = await mkdtemp(join(tmpdir(), "cerca-migration-"));
  let instance, server;
  try {
    const path = join(dir, "legacy.sqlite"),
      old = new DatabaseSync(path),
      now = new Date().toISOString(),
      token = randomBytes(32).toString("hex");
    old.exec(
      "CREATE TABLE workspaces(id TEXT PRIMARY KEY,name TEXT NOT NULL,settings TEXT NOT NULL,created_at TEXT NOT NULL); CREATE TABLE users(id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL,name TEXT NOT NULL,email TEXT NOT NULL UNIQUE,password_hash TEXT NOT NULL,created_at TEXT NOT NULL); CREATE TABLE sessions(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL,expires_at TEXT NOT NULL);",
    );
    old
      .prepare("INSERT INTO workspaces VALUES (?,?,?,?)")
      .run(
        "legacy-ws",
        "Tienda conservada",
        JSON.stringify(defaultSettings),
        now,
      );
    old
      .prepare("INSERT INTO users VALUES (?,?,?,?,?,?)")
      .run(
        "legacy-user",
        "legacy-ws",
        "Propietaria",
        "legacy@example.test",
        await hashPassword("CuentaAntiguaSegura123"),
        now,
      );
    old
      .prepare("INSERT INTO sessions VALUES (?,?,?)")
      .run(
        tokenHash(token),
        "legacy-user",
        new Date(Date.now() + 3600000).toISOString(),
      );
    old.close();
    instance = await createApp({
      databasePath: path,
      production: false,
      demoMode: false,
      registrationOpen: false,
      openaiKey: "",
      startWorker: false,
    });
    server = instance.app.listen(0, "127.0.0.1");
    await new Promise((resolve) => server.once("listening", resolve));
    const response = await fetch(
      "http://127.0.0.1:" + server.address().port + "/api/me",
      { headers: { Cookie: "cerca_session=" + token } },
    );
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(data.workspace.name, "Tienda conservada");
    assert.equal(data.user.name, "Propietaria");
    assert.ok(data.csrfToken);
    assert.equal(
      instance.db.prepare("SELECT COUNT(*) AS n FROM users").get().n,
      1,
    );
    assert.ok(
      instance.db.prepare("SELECT id,last_seen_at FROM sessions").get().id,
    );
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    if (instance) instance.close();
    await rm(dir, { recursive: true, force: true });
  }
});
