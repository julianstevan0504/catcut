import { readFile, readdir, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { zipSync, strToU8, unzipSync } from "fflate";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(root);
if (!existsSync("Cerca.html") || !existsSync("dist/Cerca.html"))
  throw new Error("Ejecuta npm run build antes de crear el paquete.");
const files = {};
const prefix = "Cerca-WhatsApp/";
const put = (name, data, executable = false) => {
  files[prefix + name] = [
    typeof data === "string" ? strToU8(data) : new Uint8Array(data),
    { level: 9, os: 3, attrs: (executable ? 0o100755 : 0o100644) << 16 },
  ];
};
async function addFile(source, destination = "proyecto/" + source) {
  put(destination, await readFile(source));
}
async function addDirectory(source) {
  for (const entry of await readdir(source, { withFileTypes: true })) {
    if (entry.isSymbolicLink())
      throw new Error(
        `No se incluye el enlace simbólico ${source}/${entry.name}.`,
      );
    if (
      entry.name === ".env" ||
      (entry.name.startsWith(".env.") && entry.name !== ".env.example") ||
      entry.name.endsWith(".log")
    )
      continue;
    const path = source + "/" + entry.name;
    if (entry.isDirectory()) await addDirectory(path);
    else if (entry.isFile()) await addFile(path);
  }
}
for (const source of [
  "README.md",
  "CHANGELOG.md",
  "package.json",
  "package-lock.json",
  "index.html",
  "Cerca.html",
  "tsconfig.json",
  "vite.config.mjs",
  "vite.standalone.config.mjs",
  "playwright.config.mjs",
  "Dockerfile",
  "render.yaml",
  ".env.example",
  ".gitignore",
  ".dockerignore",
])
  await addFile(source);
for (const source of [
  "src",
  "server",
  "shared",
  "public",
  "scripts",
  "tests",
  "dist",
  ".github",
  "auditoria",
])
  await addDirectory(source);
const standalone = await readFile("Cerca.html");
put("index.html", standalone);
put("Cerca.html", standalone);
const screenshots = [
  ["plataforma-v2-panel.png", "panel.png"],
  ["inbox-desktop.png", "conversaciones.png"],
  ["plataforma-v2-movil.png", "celular.png"],
  ["plataforma-v2-oscura.png", "modo-oscuro.png"],
];
for (const [source, name] of screenshots)
  if (existsSync("test-results/" + source))
    put("capturas/" + name, await readFile("test-results/" + source));
put(
  "LEEME_PRIMERO.txt",
  `CERCA 3.0 — TU ASISTENTE PARA WHATSAPP

PARA VER Y PROBAR LA PLATAFORMA SIN INSTALAR NADA:
1. Descomprime todo el ZIP en una carpeta.
2. Haz doble clic en index.html, en la carpeta principal.
3. La demo interactiva abre directamente. Puedes cambiar productos, importar CSV,
   gestionar pedidos, editar platos e ingredientes, conversar y probar la consola de voz.
4. En Asistente IA elige Conversar, Voz y llamadas, Configurar o Evaluar.
   Para usar el micrófono, prueba Chrome o Edge y acepta el permiso.
   Si al abrir el archivo no funciona el dictado, usa el iniciador local o continúa por texto.

La demo conserva las pruebas en el almacenamiento de este navegador, cuando está disponible.
No usa contraseñas reales ni envía mensajes de WhatsApp. No ingreses datos sensibles.
En Configuración > Datos y seguridad puedes exportar tus pruebas y reiniciar la demo.

PARA USAR EL SERVIDOR, CREAR CUENTAS REALES Y CONECTAR WHATSAPP:
- Instala Node.js 24 o superior desde https://nodejs.org/
- Windows: abre INICIAR_WINDOWS.bat.
- Mac: abre INICIAR_MAC.command.
- Linux: ejecuta INICIAR_LINUX.sh.
- La primera vez se descargan dependencias desde npm: necesitas internet.
- Mantén abierta la ventana del iniciador. La dirección local se muestra allí.
- El iniciador abre el navegador después de verificar que el servidor esté listo.

Si el iniciador no abre, entra a la carpeta proyecto en una terminal y ejecuta:
    node scripts/start-local.mjs

La web no está publicada automáticamente. WhatsApp real requiere un alojamiento HTTPS
y las credenciales de tu negocio en Meta. Las llamadas por WhatsApp requieren activar WhatsApp Business Calling en Twilio.
El proveedor puede cobrar; debes configurar tus credenciales y probar una llamada real.
La clasificación opcional con OpenAI necesita una clave; los datos siempre salen del catálogo.
Lee proyecto/README.md para configuración, publicación, pruebas y copias de seguridad.

QUÉ INCLUYE:
Código completo, compilación, demo independiente, pruebas, informes de auditoría, capturas, configuración
para Docker y Render e iniciadores. No se incluyen datos privados, credenciales reales,
archivos .env, bases de datos personales ni node_modules.
`,
);
const bat = `@echo off\nchcp 65001 >nul\nsetlocal\ncd /d "%~dp0"\nwhere node >nul 2>nul\nif errorlevel 1 (\n  echo Instala Node.js 24 o superior desde https://nodejs.org/\n  pause\n  exit /b 1\n)\nnode "proyecto\\scripts\\start-local.mjs"\nif errorlevel 1 (\n  echo Revisa el mensaje anterior para completar el inicio.\n  pause\n  exit /b 1\n)\n`;
put("INICIAR_WINDOWS.bat", bat.replaceAll("\n", "\r\n"));
const shell = `#!/bin/sh\nset -eu\ncd "$(CDPATH= cd -P "$(dirname "$0")" && pwd)/proyecto"\nif ! command -v node >/dev/null 2>&1; then\n  echo "Instala Node.js 24 o superior desde https://nodejs.org/"\n  exit 1\nfi\nexec node scripts/start-local.mjs\n`;
put("INICIAR_MAC.command", shell, true);
put("INICIAR_LINUX.sh", shell, true);
put(
  "ABRIR_PRIMERO.html",
  `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Cerca 3.0 — Empezar</title><style>body{margin:0;background:#f3f7ee;color:#304c35;font:16px/1.8 system-ui,sans-serif}main{max-width:730px;margin:7vh auto;padding:34px}h1{font-size:46px;line-height:1.2;letter-spacing:-2px}p{color:#52664c}a.button{display:inline-block;padding:13px 22px;background:#2d5739;border-radius:9px;color:white;text-decoration:none;font-weight:600}article{padding:25px;border:1px solid #dfe8d5;border-radius:15px;background:#fff;margin-top:28px}h2{font-size:22px;margin-top:0}.label{font-size:12px;letter-spacing:2px;color:#566d47}code{font-size:14px}small{color:#546d48}@media(max-width:600px){main{padding:24px;margin:20px auto}h1{font-size:37px}}</style></head><body><main><span class="label">CERCA 3.0 · TU TIENDA, SIEMPRE CERCA</span><h1>Ahora sí, abre y conversa.</h1><p>El ZIP incluye una demo interactiva que funciona con doble clic, sin instalar Node.js ni iniciar un servidor.</p><a class="button" href="index.html">Abrir mi plataforma →</a><article><h2>Para explorar el diseño y las funciones</h2><p>Abre <strong>index.html</strong>. Puedes editar productos, importar CSV, gestionar pedidos, probar el asistente y exportar datos. Tus pruebas se guardan en este navegador cuando está permitido.</p><small>Es una demo local. No envía mensajes reales ni crea cuentas en un servidor. Evita ingresar datos sensibles.</small></article><article><h2>Para trabajar con tu negocio real</h2><p>Instala Node.js 24 o superior y ejecuta el iniciador de Windows, Mac o Linux. El iniciador abre el navegador cuando el servidor está listo.</p><p>Las llamadas de voz se prueban en Asistente IA. El menú editable permite cargar ingredientes y alérgenos. La conexión de mensajes necesita Meta; las llamadas de WhatsApp necesitan Twilio Business Calling habilitado y un alojamiento HTTPS. Lee <strong>LEEME_PRIMERO.txt</strong> y <strong>proyecto/README.md</strong>.</p></article><p><a href="LEEME_PRIMERO.txt">Ver las instrucciones completas</a></p></main></body></html>`,
);
const archive = zipSync(files, { level: 9 });
const unpacked = unzipSync(archive);
if (
  !unpacked[prefix + "index.html"] ||
  !unpacked[prefix + "proyecto/shared/replies.ts"]
)
  throw new Error("La entrega está incompleta.");
for (const path of Object.keys(unpacked))
  if (
    path
      .split("/")
      .some((p) => [".git", "node_modules", "data", ".env"].includes(p))
  )
    throw new Error("La entrega contiene un archivo que debe excluirse.");
await mkdir("descargas", { recursive: true });
await writeFile("descargas/Cerca-WhatsApp.zip", archive);
const sha256 = createHash("sha256").update(archive).digest("hex");
const manifest = {
  version: "3.0.0",
  file: "Cerca-WhatsApp.zip",
  bytes: archive.length,
  files: Object.keys(files).length,
  sha256,
};
await writeFile(
  "descargas/manifest.json",
  JSON.stringify(manifest, null, 2) + "\n",
);
await writeFile(
  "descargas/README.md",
  `# Cerca 3.0 · Descargar la plataforma\n\n**[Descargar ZIP actualizado](https://github.com/julianstevan0504/catcut/raw/refs/heads/entrega-cerca-whatsapp/descargas/Cerca-WhatsApp.zip)**\n\nDescomprime el ZIP y abre **index.html** en la carpeta principal. La demo es interactiva y no requiere instalación. Para cuentas reales y WhatsApp, usa el iniciador y sigue la guía incluida.\n\nIncluye código completo, versión compilada, demo independiente, pruebas, capturas y configuración de alojamiento. Se excluyen credenciales, bases privadas y dependencias instaladas.\n\nVersión: 3.0.0. Archivos: ${manifest.files}. Tamaño: ${manifest.bytes} bytes.\n\nSHA-256: \`${sha256}\`.\n`,
);
console.log(JSON.stringify(manifest, null, 2));
