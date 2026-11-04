import "dotenv/config";
import { DatabaseSync, backup } from "node:sqlite";
import { mkdirSync, chmodSync, existsSync, copyFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";

const source = resolve(process.env.DATABASE_PATH ?? "./data/cerca.sqlite");
const target = resolve(
  process.argv[2] ??
    `./backups/cerca-${new Date().toISOString().replaceAll(":", "-")}.sqlite`,
);
if (source === target)
  throw new Error(
    "La copia debe guardarse en una ruta distinta a la base de datos.",
  );
mkdirSync(dirname(target), { recursive: true });
const db = new DatabaseSync(source, { readOnly: true });
try {
  await backup(db, target);
  chmodSync(target, 0o600);
  const snapshot = new DatabaseSync(target, { readOnly: true });
  try {
    const mediaSource = join(dirname(source), "media"),
      mediaTarget = target + ".media";
    const tables = new Set(
      snapshot
        .prepare("SELECT name FROM sqlite_master WHERE type='table'")
        .all()
        .map((x) => x.name),
    );
    if (tables.has("media_images")) {
      const images = snapshot.prepare("SELECT id FROM media_images").all();
      if (images.length) {
        mkdirSync(mediaTarget, { recursive: true, mode: 0o700 });
        for (const image of images) {
          if (!/^[a-f0-9-]{36}$/.test(image.id))
            throw Error("Identificador de imagen no válido.");
          const from = join(mediaSource, image.id + ".webp"),
            to = join(mediaTarget, image.id + ".webp");
          if (!existsSync(from))
            throw Error(
              "Falta una foto del restaurante; revisa el almacenamiento antes de completar la copia.",
            );
          copyFileSync(from, to);
          chmodSync(to, 0o600);
        }
      }
    }
  } finally {
    snapshot.close();
  }
  console.log(
    `Copia de seguridad creada: ${target}. Si hay fotos, están en la carpeta .media junto a esta copia. Conserva también APP_ENCRYPTION_KEY y las credenciales de instalación.`,
  );
} finally {
  db.close();
}
