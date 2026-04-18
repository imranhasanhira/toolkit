import fs from "node:fs";
import path from "node:path";
import type { Plugin, ViteDevServer } from "vite";

/**
 * Discovers and serves/emits i18n locale JSON files.
 *
 * Source layout (author in code):
 *   src/i18n/locales/<ns>/<lng>.json       # global namespaces (common, landing, …)
 *   src/<subapp>/i18n/<lng>.json           # per-subapp namespaces (carely, …)
 *
 * Wire layout (served to the client at runtime):
 *   /locales/<ns>/<lng>.json
 *
 * Why a plugin instead of `cp src → public`:
 *   - Dev: HMR middleware serves the latest JSON on every request without
 *     cluttering `public/` or requiring a watcher.
 *   - Build: emitted as build assets (unhashed fileName, like `public/`) so
 *     they land at `/locales/...` in the final Nginx-served bundle.
 */

interface LocaleFile {
  namespace: string;
  language: string;
  absPath: string;
  urlPath: string; // e.g. "locales/common/en.json"
}

function discoverLocales(projectRoot: string): LocaleFile[] {
  const out: LocaleFile[] = [];
  const srcDir = path.join(projectRoot, "src");
  if (!fs.existsSync(srcDir)) return out;

  const walk = (dir: string) => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name === ".wasp") continue;
        if (entry.name === "i18n") {
          collectFromI18nDir(full, out);
          continue;
        }
        walk(full);
      }
    }
  };

  walk(srcDir);
  return out;
}

function collectFromI18nDir(i18nDir: string, out: LocaleFile[]) {
  // Case A: src/<subapp>/i18n/<lng>.json
  // Case B: src/i18n/locales/<ns>/<lng>.json
  // Case B is nested via a `locales/` subfolder; Case A has JSON files directly.
  const entries = fs.readdirSync(i18nDir, { withFileTypes: true });

  for (const entry of entries) {
    const full = path.join(i18nDir, entry.name);
    if (entry.isFile() && entry.name.endsWith(".json")) {
      const lng = path.basename(entry.name, ".json");
      const ns = namespaceFromSubappDir(i18nDir);
      out.push({
        namespace: ns,
        language: lng,
        absPath: full,
        urlPath: `locales/${ns}/${lng}.json`,
      });
    } else if (entry.isDirectory() && entry.name === "locales") {
      // src/i18n/locales/<ns>/<lng>.json
      const nsDirs = fs.readdirSync(full, { withFileTypes: true });
      for (const nsDir of nsDirs) {
        if (!nsDir.isDirectory()) continue;
        const ns = nsDir.name;
        const files = fs.readdirSync(path.join(full, ns), {
          withFileTypes: true,
        });
        for (const f of files) {
          if (!f.isFile() || !f.name.endsWith(".json")) continue;
          const lng = path.basename(f.name, ".json");
          out.push({
            namespace: ns,
            language: lng,
            absPath: path.join(full, ns, f.name),
            urlPath: `locales/${ns}/${lng}.json`,
          });
        }
      }
    }
  }
}

/**
 * Derive namespace from a `src/<subapp>/i18n/` directory.
 * E.g. `/abs/path/to/src/reddit-bot/i18n` → `reddit-bot`.
 */
function namespaceFromSubappDir(i18nDir: string): string {
  return path.basename(path.dirname(i18nDir));
}

export default function i18nLocalesPlugin(options?: {
  projectRoot?: string;
}): Plugin {
  const projectRoot = options?.projectRoot ?? process.cwd();
  let locales: LocaleFile[] = [];

  const refresh = () => {
    locales = discoverLocales(projectRoot);
  };

  return {
    name: "toolkit:i18n-locales",

    buildStart() {
      refresh();
      // Emit as unhashed build assets so files land at /locales/<ns>/<lng>.json.
      for (const loc of locales) {
        try {
          const source = fs.readFileSync(loc.absPath, "utf-8");
          // Validate JSON at build time to fail early on malformed translations.
          JSON.parse(source);
          this.emitFile({
            type: "asset",
            fileName: loc.urlPath,
            source,
          });
        } catch (err) {
          this.error(
            `[i18n] Failed to emit ${loc.urlPath} from ${loc.absPath}: ${
              (err as Error).message
            }`,
          );
        }
      }
    },

    configureServer(server: ViteDevServer) {
      refresh();

      const dedupeKey = (l: LocaleFile) => `${l.namespace}::${l.language}`;
      const urlToAbs = new Map<string, string>();
      for (const l of locales) {
        urlToAbs.set("/" + l.urlPath, l.absPath);
      }

      // Keep the in-memory map in sync with filesystem changes during dev.
      const onChange = (file: string) => {
        if (!file.endsWith(".json")) return;
        if (!file.includes(`${path.sep}i18n${path.sep}`)) return;
        refresh();
        urlToAbs.clear();
        const seen = new Set<string>();
        for (const l of locales) {
          const key = dedupeKey(l);
          if (seen.has(key)) continue;
          seen.add(key);
          urlToAbs.set("/" + l.urlPath, l.absPath);
        }
      };
      server.watcher.on("add", onChange);
      server.watcher.on("change", onChange);
      server.watcher.on("unlink", onChange);

      server.middlewares.use((req, res, next) => {
        if (!req.url) return next();
        const url = req.url.split("?")[0];
        const abs = urlToAbs.get(url);
        if (!abs) return next();
        try {
          const body = fs.readFileSync(abs, "utf-8");
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          // Dev: never cache so translations are live-reloaded.
          res.setHeader("Cache-Control", "no-store");
          res.end(body);
        } catch (err) {
          res.statusCode = 500;
          res.end(`i18n load failed: ${(err as Error).message}`);
        }
      });
    },
  };
}
