import { routes } from "wasp/client/router";

import type { NavigationItem } from "./NavBar";
import type { AppKey } from "../../../shared/appKeys";

export interface NavItemWithApp extends NavigationItem {
  appKey: AppKey;
}

// `i18nKey` resolves against the `common` namespace (always bundled) so nav
// labels translate instantly without waiting on a lazy-loaded namespace.
// `name` stays as the English fallback used if the key is ever missing.
const baseNavigationItems: NavItemWithApp[] = [
  { name: "Online Judge", i18nKey: "apps.onlineJudge", to: routes.ProblemListRoute.to, appKey: "online-judge" },
  { name: "SokaFilm", i18nKey: "apps.sokafilm", to: routes.SokaFilmRoute.to, appKey: "sokafilm" },
  { name: "Reddit Bot", i18nKey: "apps.redditBot", to: routes.RedditBotRoute.to, appKey: "reddit-bot" },
  { name: "Carely", i18nKey: "apps.carely", to: routes.CarelyRoute.to, appKey: "carely" },
];

export const marketingNavigationItems: NavItemWithApp[] = baseNavigationItems;
export const demoNavigationitems: NavItemWithApp[] = baseNavigationItems;
