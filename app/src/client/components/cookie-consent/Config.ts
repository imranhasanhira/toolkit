import type { CookieConsentConfig } from "vanilla-cookieconsent";
import i18n from "../../../i18n";

declare global {
  interface Window {
    dataLayer: any;
  }
}

const getConfig = () => {
  // See https://cookieconsent.orestbida.com/reference/configuration-reference.html for configuration options.
  const t = (key: string, lng: string) =>
    i18n.t(key, { lng, ns: "common", defaultValue: key }) as string;
  const buildModal = (lng: string) => ({
    consentModal: {
      title: t("cookieConsent.title", lng),
      description: t("cookieConsent.description", lng),
      acceptAllBtn: t("cookieConsent.acceptAll", lng),
      acceptNecessaryBtn: t("cookieConsent.rejectAll", lng),
      footer: `
            <a href="<your-url-here>" target="_blank">${t("cookieConsent.privacyPolicy", lng)}</a>
            <a href="<your-url-here>" target="_blank">${t("cookieConsent.termsAndConditions", lng)}</a>
                    `,
    },
    preferencesModal: { sections: [] },
  });
  const config: CookieConsentConfig = {
    // Default configuration for the modal.
    root: "body",
    autoShow: true,
    disablePageInteraction: false,
    hideFromBots: import.meta.env.PROD ? true : false, // Set this to false for dev/headless tests otherwise the modal will not be visible.
    mode: "opt-in",
    revision: 0,

    // Default configuration for the cookie.
    cookie: {
      name: "cc_cookie",
      domain: location.hostname,
      path: "/",
      sameSite: "Lax",
      expiresAfterDays: 365,
    },

    guiOptions: {
      consentModal: {
        layout: "box",
        position: "bottom right",
        equalWeightButtons: true,
        flipButtons: false,
      },
    },

    categories: {
      necessary: {
        enabled: true, // this category is enabled by default
        readOnly: true, // this category cannot be disabled
      },
      analytics: {
        autoClear: {
          cookies: [
            {
              name: /^_ga/, // regex: match all cookies starting with '_ga'
            },
            {
              name: "_gid", // string: exact cookie name
            },
          ],
        },

        // https://cookieconsent.orestbida.com/reference/configuration-reference.html#category-services
        services: {
          ga: {
            label: "Google Analytics",
            onAccept: () => {
              try {
                const GA_ANALYTICS_ID = import.meta.env
                  .REACT_APP_GOOGLE_ANALYTICS_ID;
                if (!GA_ANALYTICS_ID.length) {
                  throw new Error("Google Analytics ID is missing");
                }
                window.dataLayer = window.dataLayer || [];
                function gtag(..._args: unknown[]) {
                  (window.dataLayer as Array<any>).push(arguments);
                }
                gtag("js", new Date());
                gtag("config", GA_ANALYTICS_ID);

                // Adding the script tag dynamically to the DOM.
                const script = document.createElement("script");
                script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ANALYTICS_ID}`;
                script.async = true;
                document.body.appendChild(script);
              } catch (error) {
                console.error(error);
              }
            },
            onReject: () => {},
          },
        },
      },
    },

    language: {
      // Map to the currently active i18next language so the banner speaks the
      // same language as the rest of the UI. `i18n.changeLanguage(...)` →
      // Banner.tsx re-runs `CookieConsent.run(getConfig())` to re-render.
      default: (i18n.resolvedLanguage as "en" | "bn") || "en",
      translations: {
        en: buildModal("en"),
        bn: buildModal("bn"),
      },
    },
  };

  return config;
};

export default getConfig;
