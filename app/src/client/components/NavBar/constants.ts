import { routes } from "wasp/client/router";

import type { NavigationItem } from "./NavBar";

export const marketingNavigationItems: NavigationItem[] = [
  { name: "Features", to: "/#features" },
  { name: "Pricing", to: routes.PricingPageRoute.to },
  { name: "Online Judge", to: routes.ProblemListRoute.to },
] as const;

export const demoNavigationitems: NavigationItem[] = [
  { name: "Online Judge", to: routes.ProblemListRoute.to },
] as const;
