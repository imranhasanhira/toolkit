import { routes } from "wasp/client/router";

import type { NavigationItem } from "./NavBar";
import type { AppKey } from "../../../shared/appKeys";

export interface NavItemWithApp extends NavigationItem {
  appKey: AppKey;
}

const baseNavigationItems: NavItemWithApp[] = [
  { name: "Online Judge", to: routes.ProblemListRoute.to, appKey: "online-judge" },
  { name: "SokaFilm", to: routes.SokaFilmRoute.to, appKey: "sokafilm" },
  { name: "Reddit Bot", to: routes.RedditBotRoute.to, appKey: "reddit-bot" },
  { name: "Carely", to: routes.CarelyRoute.to, appKey: "carely" },
];

export const marketingNavigationItems: NavItemWithApp[] = baseNavigationItems;
export const demoNavigationitems: NavItemWithApp[] = baseNavigationItems;
