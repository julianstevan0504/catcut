import 'dotenv/config';
import { DatabaseSync, backup } from 'node:sqlite';
import { mkdirSync, chmodSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

const source = resolve(process.env.DATABASE_PATH ?? './data/cerca.sqlite');
const target = resolve(process.argv[2] ?? `./backups/cerca-${new Date().toISOString().replaceAll(':', '-')}.sqlite`);
if (source === target) throw new Error('La copia debe guardarse en una ruta distinta a la base de datos.');
mkdirSync(dirname(target), { recursive: true });
const db = new DatabaseSync(source, { readOnly: true });
try {
  await backup(db, target);
  chmodSync(target, 0o600);
  console.log(`Copia de seguridad creada: ${target}`);
} finally { db.close(); }
