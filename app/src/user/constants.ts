import { LayoutDashboard, Settings, Shield } from "lucide-react";
import { routes } from "wasp/client/router";

/**
 * Menu items rendered in the user dropdown and mobile sheet.
 *
 * `labelKey` is an i18n key into the `common` namespace; callers resolve it
 * with `t(labelKey)` so the menu reacts to language changes.
 */
export const userMenuItems = [
  {
    labelKey: "userMenu.accountSettings",
    to: routes.AccountRoute.to,
    icon: Settings,
    isAuthRequired: false,
    isAdminOnly: false,
  },
  {
    labelKey: "userMenu.adminDashboard",
    to: routes.AdminRoute.to,
    icon: Shield,
    isAuthRequired: false,
    isAdminOnly: true,
  },
] as const;
