import { routes } from "wasp/client/router";

import type { NavigationItem } from "./NavBar";
import type { AppKey } from "../../../shared/appKeys";

export interface NavItemWithApp extends NavigationItem {
  appKey: AppKey;
}

export const marketingNavigationItems: NavItemWithApp[] = [
  { name: "Online Judge", to: routes.ProblemListRoute.to, appKey: "online-judge" },
  { name: "SokaFilm", to: routes.SokaFilmRoute.to, appKey: "sokafilm" },
];

export const demoNavigationitems: NavItemWithApp[] = [
  { name: "Online Judge", to: routes.ProblemListRoute.to, appKey: "online-judge" },
  { name: "SokaFilm", to: routes.SokaFilmRoute.to, appKey: "sokafilm" },
];
