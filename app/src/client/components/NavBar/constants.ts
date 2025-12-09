import { routes } from "wasp/client/router";

import type { NavigationItem } from "./NavBar";

export const marketingNavigationItems: NavigationItem[] = [
  { name: "Features", to: "/#features" },
  { name: "Pricing", to: routes.PricingPageRoute.to },
] as const;

export const demoNavigationitems: NavigationItem[] = [] as const;
