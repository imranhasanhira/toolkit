import crypto from "node:crypto";
import path from "path";
import { fileURLToPath } from "url";
import { wasp } from "wasp/client/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import i18nLocalesPlugin from "./src/i18n/vitePlugin";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const shimPath = path.resolve(__dirname, "src/client/useSyncExternalStoreShim.ts");

// Short per-build identifier used to cache-bust /locales/* fetches from the
// Android WebView. Regenerated on every `vite build` so a frontend rollout
// appends a new `?v=<hash>` that WebViews treat as a fresh URL.
const BUILD_HASH =
  process.env.WASP_BUILD_HASH ||
  crypto.randomBytes(6).toString("hex");

// Resolve use-sync-external-store/shim to React's useSyncExternalStore (CJS shim fails as ESM in browser).
function useSyncExternalStoreShimPlugin() {
  return {
    name: "use-sync-external-store-shim",
    enforce: "pre",
    resolveId(id: string) {
      if (
        id === "use-sync-external-store/shim" ||
        id === "use-sync-external-store/shim/index.js"
      ) {
        return shimPath;
      }
    },
  };
}

export default defineConfig({
  plugins: [
    useSyncExternalStoreShimPlugin(),
    wasp(),
    tailwindcss(),
    i18nLocalesPlugin({ projectRoot: __dirname }),
  ],
  define: {
    __BUILD_HASH__: JSON.stringify(BUILD_HASH),
  },
  resolve: {
    dedupe: ["react", "react-dom", "react-router", "@tanstack/react-query"],
  },
  optimizeDeps: {
    include: ['vanilla-cookieconsent'],
    exclude: ['@tanstack/react-query'],
  },
  server: {
    open: true,
  },
});
