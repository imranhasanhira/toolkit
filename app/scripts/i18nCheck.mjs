#!/usr/bin/env node
/**
 * Validates EN ↔ BN key parity for every i18n namespace in the repo.
 *
 * Treats the following as namespaces:
 *   - src/i18n/locales/<ns>/{en,bn}.{ts,json}  (global namespaces — `common`, `landing`, …)
 *   - src/<subapp>/i18n/{en,bn}.json            (per-subapp namespaces — `carely`, …)
 *
 * Fails with a non-zero exit code and a key-level diff if any pair drifts.
 *
 * Usage:
 *   npm run i18n:check
 *
 * Wire this into pre-commit / CI to catch missing translations at review time
 * instead of at runtime.
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = path.resolve(process.cwd());
const SRC = path.join(ROOT, "src");
const LOCALES = ["en", "bn"];

function walk(dir, out) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "node_modules" || e.name === ".wasp") continue;
      if (e.name === "i18n") {
        out.push(full);
        continue;
      }
      walk(full, out);
    }
  }
}

function deriveNamespaces() {
  const dirs = [];
  walk(SRC, dirs);
  const nsMap = new Map(); // ns -> { en: absPath, bn: absPath }

  for (const i18nDir of dirs) {
    const entries = fs.readdirSync(i18nDir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(i18nDir, entry.name);
      if (entry.isDirectory() && entry.name === "locales") {
        // Case A: src/i18n/locales/<ns>/{en,bn}.{ts,json}
        const nsDirs = fs.readdirSync(full, { withFileTypes: true });
        for (const nsDir of nsDirs) {
          if (!nsDir.isDirectory()) continue;
          const ns = nsDir.name;
          const record = nsMap.get(ns) ?? {};
          for (const lng of LOCALES) {
            const tsPath = path.join(full, ns, `${lng}.ts`);
            const jsonPath = path.join(full, ns, `${lng}.json`);
            if (fs.existsSync(tsPath)) record[lng] = tsPath;
            else if (fs.existsSync(jsonPath)) record[lng] = jsonPath;
          }
          nsMap.set(ns, record);
        }
      } else if (entry.isFile() && entry.name.endsWith(".json")) {
        // Case B: src/<subapp>/i18n/{en,bn}.json
        const lng = path.basename(entry.name, ".json");
        if (!LOCALES.includes(lng)) continue;
        const ns = path.basename(path.dirname(i18nDir));
        const record = nsMap.get(ns) ?? {};
        record[lng] = full;
        nsMap.set(ns, record);
      }
    }
  }

  return nsMap;
}

async function loadResource(absPath) {
  if (absPath.endsWith(".json")) {
    return JSON.parse(fs.readFileSync(absPath, "utf8"));
  }
  if (absPath.endsWith(".ts")) {
    // Extract the exported object literal without booting a TS compiler. Good
    // enough for `common/{en,bn}.ts` which are plain object exports.
    const src = fs.readFileSync(absPath, "utf8");
    const stripped = src.replace(/\bas\s+const\b/g, "");
    const startMatch = stripped.match(/const\s+\w+\s*(?::\s*[^=]+)?=\s*\{/);
    if (!startMatch) {
      throw new Error(`Cannot find object literal in ${absPath}`);
    }
    const startIdx = startMatch.index + startMatch[0].length - 1; // at '{'
    let depth = 0;
    let endIdx = -1;
    let inStr = null; // '"', "'", or '`'
    let escape = false;
    for (let i = startIdx; i < stripped.length; i++) {
      const c = stripped[i];
      if (inStr) {
        if (escape) { escape = false; continue; }
        if (c === "\\") { escape = true; continue; }
        if (c === inStr) { inStr = null; }
        continue;
      }
      if (c === '"' || c === "'" || c === "`") { inStr = c; continue; }
      if (c === "{") depth++;
      else if (c === "}") {
        depth--;
        if (depth === 0) { endIdx = i; break; }
      }
    }
    if (endIdx === -1) throw new Error(`Unbalanced braces in ${absPath}`);
    const literal = stripped.slice(startIdx, endIdx + 1);
    // eslint-disable-next-line no-new-func
    return new Function(`return (${literal})`)();
  }
  throw new Error(`Unsupported locale file: ${absPath}`);
}

function flatKeys(obj, prefix = "", out = []) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      flatKeys(v, key, out);
    } else {
      out.push(key);
    }
  }
  return out;
}

async function main() {
  const nsMap = deriveNamespaces();
  const namespaces = [...nsMap.keys()].sort();
  let drift = 0;
  const rows = [];

  for (const ns of namespaces) {
    const rec = nsMap.get(ns);
    const missing = LOCALES.filter((lng) => !rec[lng]);
    if (missing.length) {
      drift += 1;
      rows.push(`  ✘ ${ns}: missing locale file(s) for ${missing.join(", ")}`);
      continue;
    }

    try {
      const en = await loadResource(rec.en);
      const bn = await loadResource(rec.bn);
      const enKeys = new Set(flatKeys(en));
      const bnKeys = new Set(flatKeys(bn));
      const onlyInEn = [...enKeys].filter((k) => !bnKeys.has(k));
      const onlyInBn = [...bnKeys].filter((k) => !enKeys.has(k));
      if (onlyInEn.length || onlyInBn.length) {
        drift += 1;
        rows.push(`  ✘ ${ns} (${enKeys.size} en / ${bnKeys.size} bn)`);
        if (onlyInEn.length) rows.push(`      missing in bn: ${onlyInEn.join(", ")}`);
        if (onlyInBn.length) rows.push(`      missing in en: ${onlyInBn.join(", ")}`);
      } else {
        rows.push(`  ✓ ${ns} (${enKeys.size} keys)`);
      }
    } catch (err) {
      drift += 1;
      rows.push(`  ✘ ${ns}: ${err.message}`);
    }
  }

  const header = drift === 0
    ? `i18n key parity OK across ${namespaces.length} namespaces`
    : `i18n key drift in ${drift} of ${namespaces.length} namespaces`;
  console.log(header);
  for (const row of rows) console.log(row);
  process.exit(drift === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
