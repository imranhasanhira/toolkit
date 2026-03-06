import { routes } from "wasp/client/router";

import type { NavigationItem } from "./NavBar";

export const marketingNavigationItems: NavigationItem[] = [
  { name: "Online Judge", to: routes.ProblemListRoute.to },
  { name: "SokaFilm", to: routes.SokaFilmRoute.to },
] as const;

export const demoNavigationitems: NavigationItem[] = [
  { name: "Online Judge", to: routes.ProblemListRoute.to },
  { name: "SokaFilm", to: routes.SokaFilmRoute.to },
] as const;
