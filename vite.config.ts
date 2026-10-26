import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

/**
 * The site is published to GitHub Pages under `/crypto-radar/`.
 * Override with VITE_BASE_PATH when hosting under a different path.
 */
const base = process.env.VITE_BASE_PATH ?? "/crypto-radar/";

export default defineConfig({
  base,
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    port: 5173,
    host: true,
  },
  preview: {
    port: 4173,
    host: true,
  },
  build: {
    target: "es2022",
    sourcemap: false,
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks: {
          charts: ["lightweight-charts"],
          table: ["@tanstack/react-virtual"],
        },
      },
    },
  },
});
