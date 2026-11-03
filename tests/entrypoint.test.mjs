import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const startup = html.match(/<script>([\s\S]*?)<\/script>/)[1];
test("abrir el index del proyecto como archivo local conduce a la demo independiente", () => {
  const redirects = [];
  runInNewContext(startup, {
    location: {
      protocol: "file:",
      href: "file:///Downloads/Cerca-WhatsApp/proyecto/index.html",
      replace: (url) => redirects.push(String(url)),
    },
    document: { documentElement: { dataset: {} }, querySelector: () => null },
    URL,
    setTimeout: () => 0,
  });
  assert.deepEqual(redirects, [
    "file:///Downloads/Cerca-WhatsApp/proyecto/Cerca.html",
  ]);
});
test("la demo independiente no se redirige a sí misma y el inicio HTTP se conserva", () => {
  for (const [protocol, offline] of [
    ["file:", "true"],
    ["http:", undefined],
    ["https:", undefined],
  ]) {
    const redirects = [];
    runInNewContext(startup, {
      location: {
        protocol,
        href: "https://cerca.example/index.html",
        replace: (url) => redirects.push(url),
      },
      document: {
        documentElement: { dataset: { offline } },
        querySelector: () => null,
      },
      URL,
      setTimeout: () => 0,
    });
    assert.equal(redirects.length, 0);
  }
});
test("el index muestra una pantalla de recuperación antes de cargar React", () => {
  assert.match(html, /data-starting/);
  assert.match(html, /Abrir demo interactiva/);
  assert.match(html, /noscript/);
});
