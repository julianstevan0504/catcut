import {
  randomBytes,
  scrypt as scryptCb,
  timingSafeEqual,
  createHash,
  createCipheriv,
  createDecipheriv,
} from "node:crypto";
import { promisify } from "node:util";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const scrypt = promisify(scryptCb);
export async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const key = await scrypt(password, salt, 64);
  return `${salt}:${key.toString("hex")}`;
}
export async function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const key = await scrypt(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return key.length === expected.length && timingSafeEqual(key, expected);
}
export const tokenHash = (token) =>
  createHash("sha256").update(token).digest("hex");
export const safeEqual = (a, b) => {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const x = Buffer.from(a),
    y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

export function encryptionKey({ value, file, production }) {
  if (value) {
    if (value.length < 32)
      throw new Error("APP_ENCRYPTION_KEY debe tener al menos 32 caracteres.");
    return createHash("sha256").update(value).digest();
  }
  if (production)
    throw new Error(
      "Configura APP_ENCRYPTION_KEY antes de iniciar en producción.",
    );
  if (file === ":memory:") return randomBytes(32);
  if (existsSync(file)) {
    const value = readFileSync(file, "utf8").trim();
    if (!/^[a-f0-9]{64}$/i.test(value))
      throw new Error(
        "La clave local de cifrado no es válida. Restaura su copia de seguridad; no se sobrescribirá.",
      );
    return Buffer.from(value, "hex");
  }
  mkdirSync(dirname(file), { recursive: true });
  const key = randomBytes(32);
  writeFileSync(file, key.toString("hex"), { mode: 0o600, flag: "wx" });
  return key;
}

export function encrypt(data, key) {
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(data), "utf8"),
    cipher.final(),
  ]);
  return [iv, cipher.getAuthTag(), ciphertext]
    .map((x) => x.toString("base64"))
    .join(".");
}
export function decrypt(data, key) {
  const [iv, tag, ciphertext] = data
    .split(".")
    .map((x) => Buffer.from(x, "base64"));
  const cipher = createDecipheriv("aes-256-gcm", key, iv);
  cipher.setAuthTag(tag);
  return JSON.parse(
    Buffer.concat([cipher.update(ciphertext), cipher.final()]).toString("utf8"),
  );
}

export function rateLimiter({ limit, windowMs, keyFor = (req) => req.ip }) {
  const attempts = new Map();
  let count = 0;
  return (req, res, next) => {
    const time = Date.now();
    if (++count % 100 === 0)
      for (const [key, entry] of attempts)
        if (entry.until < time) attempts.delete(key);
    const key = keyFor(req);
    let entry = attempts.get(key);
    if (!entry || entry.until < time) {
      entry = { count: 0, until: time + windowMs };
      attempts.set(key, entry);
    }
    if (++entry.count > limit) {
      res.set("Retry-After", String(Math.ceil((entry.until - time) / 1000)));
      return res.status(429).json({
        error: "Demasiados intentos. Espera unos minutos y vuelve a probar.",
      });
    }
    next();
  };
}
