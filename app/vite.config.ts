import path from "path";
import { fileURLToPath } from "url";
import { wasp } from "wasp/client/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const shimPath = path.resolve(__dirname, "src/client/useSyncExternalStoreShim.ts");

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
  ],
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
