import { spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  chmodSync,
} from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(root);

if (Number(process.versions.node.split(".")[0]) < 24) {
  console.error(
    "Cerca necesita Node.js 24 o superior. Instálalo desde https://nodejs.org/ y vuelve a abrir el iniciador.",
  );
  process.exit(1);
}
if (!existsSync(join(root, "dist/index.html"))) {
  console.error(
    "Falta la aplicación compilada. Ejecuta npm ci y npm run build antes de volver a iniciar.",
  );
  process.exit(1);
}
if (
  !existsSync(join(root, "node_modules/express/package.json")) ||
  !existsSync(join(root, "node_modules/helmet/package.json")) ||
  !existsSync(join(root, "node_modules/dotenv/package.json")) ||
  !existsSync(join(root, "node_modules/sharp/package.json")) ||
  !existsSync(join(root, "node_modules/twilio/package.json"))
) {
  console.log(
    "Primera apertura: instalando las dependencias oficiales. Necesitas conexión a internet.",
  );
  const installed = spawnSync(
    process.platform === "win32" ? "npm.cmd" : "npm",
    ["ci", "--omit=dev", "--no-audit", "--no-fund"],
    {
      cwd: root,
      stdio: "inherit",
      shell: process.platform === "win32",
    },
  );
  if (installed.error || installed.status !== 0) {
    console.error(
      "No se pudieron instalar las dependencias. Comprueba la conexión y que npm esté disponible, y vuelve a intentarlo.",
    );
    process.exit(1);
  }
}

const port = Number(process.env.CERCA_LOCAL_PORT ?? 3000);
if (!Number.isInteger(port) || port < 1024 || port > 65535) {
  console.error("CERCA_LOCAL_PORT debe ser un número entre 1024 y 65535.");
  process.exit(1);
}
const localDatabase =
  process.env.CERCA_LOCAL_DATABASE ?? join(root, "data/cerca.sqlite");
const setupPath = join(dirname(localDatabase), "administracion-clave.txt");
let platformToken = process.env.PLATFORM_SETUP_TOKEN;
if (!platformToken) {
  mkdirSync(dirname(setupPath), { recursive: true, mode: 0o700 });
  if (!existsSync(setupPath))
    writeFileSync(setupPath, randomBytes(32).toString("hex"), {
      mode: 0o600,
      flag: "wx",
    });
  chmodSync(setupPath, 0o600);
  platformToken = readFileSync(setupPath, "utf8").trim();
}
const url = `http://localhost:${port}`;
const child = spawn(process.execPath, ["--use-env-proxy", "server/index.mjs"], {
  cwd: root,
  stdio: "inherit",
  env: {
    ...process.env,
    NODE_ENV: "development",
    HOST: "127.0.0.1",
    PORT: String(port),
    APP_URL: url,
    PLATFORM_SETUP_TOKEN: platformToken,
    DATABASE_PATH:
      process.env.CERCA_LOCAL_DATABASE ?? join(root, "data/cerca.sqlite"),
    DEMO_MODE: "true",
    REGISTRATION_OPEN: "true",
  },
});
let ended = false;
child.on("error", () => {
  ended = true;
  console.error("No se pudo iniciar el servidor.");
});
child.on("exit", (code) => {
  ended = true;
  if (code) process.exitCode = code;
});
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill(signal));

try {
  let ready = false;
  for (let i = 0; i < 80; i++) {
    if (ended)
      throw new Error(
        "El servidor no pudo iniciar. Si el puerto 3000 está ocupado, configura CERCA_LOCAL_PORT con otro puerto.",
      );
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/bootstrap`, {
        signal: AbortSignal.timeout(1000),
      });
      const data = await response.json();
      if (response.ok && data.demoEnabled === true) {
        ready = true;
        break;
      }
    } catch {
      /* Wait for this server to finish starting before opening the browser. */
    }
    await delay(250);
  }
  if (!ready)
    throw new Error(
      "El servidor no estuvo listo a tiempo. Revisa el mensaje que aparece arriba e inténtalo de nuevo.",
    );
  console.log(
    `\nCerca está lista. Abre ${url} y pulsa «Explorar la demo» o crea tu cuenta.`,
  );
  console.log(
    "La clave privada para activar Administración está en " +
      setupPath +
      ". No la compartas.",
  );
  console.log(
    "No cierres esta ventana mientras uses la plataforma. Pulsa Ctrl+C para detenerla.",
  );
  console.log(
    "Esta apertura es local: no publica tu tienda en internet ni conecta un WhatsApp real.\n",
  );
  if (!process.argv.includes("--no-browser")) {
    let browser;
    if (process.platform === "win32")
      browser = spawn("rundll32", ["url.dll,FileProtocolHandler", url], {
        detached: true,
        stdio: "ignore",
      });
    else
      browser = spawn(
        process.platform === "darwin" ? "open" : "xdg-open",
        [url],
        { detached: true, stdio: "ignore" },
      );
    browser.on("error", () =>
      console.log(
        `Si no se abrió el navegador, escribe ${url} en su barra de direcciones.`,
      ),
    );
    browser.unref();
  }
} catch (error) {
  console.error(error.message);
  child.kill();
  process.exitCode = 1;
}
if (!ended) await new Promise((resolve) => child.once("exit", resolve));
