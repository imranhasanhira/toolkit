import i18n from "i18next";
import HttpBackend from "i18next-http-backend";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";

import commonEn from "./locales/common/en";
import commonBn from "./locales/common/bn";

export const SUPPORTED_LANGUAGES = ["en", "bn"] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

const STORAGE_KEY = "i18nextLng";

/**
 * Bumped on every frontend deploy via the Vite define'd `__BUILD_HASH__`.
 * Appended as `?v=<hash>` to locale requests so Android WebViews treat a new
 * deploy as a fresh URL (belt-and-suspenders with the nginx cache rules in
 * `app/deploy.sh`).
 */
const BUILD_HASH: string =
  (typeof __BUILD_HASH__ !== "undefined" && __BUILD_HASH__) || "dev";

i18n
  .use(HttpBackend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    // `common` is bundled statically so core UI never waits on a network
    // round-trip. All other namespaces lazy-load via HttpBackend.
    resources: {
      en: { common: commonEn },
      bn: { common: commonBn },
    },
    fallbackLng: "en",
    supportedLngs: [...SUPPORTED_LANGUAGES],
    nonExplicitSupportedLngs: true,
    defaultNS: "common",
    ns: ["common"],
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ["cookie", "localStorage", "navigator"],
      caches: ["cookie", "localStorage"],
      lookupCookie: STORAGE_KEY,
      lookupLocalStorage: STORAGE_KEY,
    },
    backend: {
      loadPath: "/locales/{{ns}}/{{lng}}.json",
      queryStringParams: { v: BUILD_HASH },
    },
    react: {
      useSuspense: false,
    },
    returnNull: false,
  })
  .catch(() => {
    // Swallow init errors so i18next never blocks the first paint. Missing
    // namespaces simply fall back to keys/English.
  });

const syncHtmlLang = (lang: string) => {
  if (typeof document !== "undefined") {
    document.documentElement.lang = lang;
  }
};

syncHtmlLang(i18n.resolvedLanguage || i18n.language || "en");
i18n.on("languageChanged", syncHtmlLang);

export default i18n;
