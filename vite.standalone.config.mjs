import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

export default defineConfig({
  base: "./",
  publicDir: false,
  plugins: [
    react(),
    {
      name: "cerca-standalone-mark",
      transformIndexHtml: (html) =>
        html.replace(
          '<html lang="es">',
          '<html lang="es" data-offline="true">',
        ),
    },
    viteSingleFile(),
  ],
  define: { __CERCA_STANDALONE__: "true" },
  build: {
    outDir: ".standalone-build",
    emptyOutDir: true,
    assetsInlineLimit: 1000000,
    sourcemap: false,
  },
});
