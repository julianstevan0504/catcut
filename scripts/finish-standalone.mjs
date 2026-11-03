import { readFile, writeFile, mkdir } from "node:fs/promises";
const html = await readFile(".standalone-build/index.html", "utf8");
if (
  !html.includes('data-offline="true"') ||
  /<script[^>]+src=/.test(html) ||
  /<link[^>]+rel="stylesheet"[^>]+href=/.test(html)
)
  throw new Error(
    "La demo debe ser un HTML independiente, sin scripts ni estilos externos.",
  );
await writeFile("Cerca.html", html);
await mkdir("dist", { recursive: true });
await writeFile("dist/Cerca.html", html);
console.log(
  "Demo interactiva independiente: Cerca.html (lista para doble clic).",
);
