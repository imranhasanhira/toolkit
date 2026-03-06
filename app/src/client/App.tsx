import { useEffect, useMemo } from "react";
import { Outlet, useLocation } from "react-router";
import { routes } from "wasp/client/router";
import { Toaster } from "../client/components/ui/toaster";
import { Toaster as HotToaster } from "react-hot-toast";
import "./Main.css";
import NavBar from "./components/NavBar/NavBar";
import {
  demoNavigationitems,
  marketingNavigationItems,
} from "./components/NavBar/constants";
import CookieConsentBanner from "./components/cookie-consent/Banner";
import LandingPage from "../landing-page/LandingPage";

/**
 * use this component to wrap all child components
 * this is useful for templates, themes, and context
 */
export default function App() {
  const location = useLocation();
  const isMarketingPage = useMemo(() => {
    return (
      location.pathname === "/" || location.pathname.startsWith("/pricing")
    );
  }, [location]);

  const navigationItems = isMarketingPage
    ? marketingNavigationItems
    : demoNavigationitems;

  const shouldDisplayAppNavBar = useMemo(() => {
    return (
      location.pathname !== routes.LoginRoute.build() &&
      location.pathname !== routes.SignupRoute.build()
    );
  }, [location]);

  const isAdminDashboard = useMemo(() => {
    return location.pathname.startsWith("/admin");
  }, [location]);

  useEffect(() => {
    if (location.hash) {
      const id = location.hash.replace("#", "");
      const element = document.getElementById(id);
      if (element) {
        element.scrollIntoView();
      }
    }
  }, [location]);

  return (
    <>
      <div className="bg-background text-foreground min-h-screen">
        {isAdminDashboard ? (
          <Outlet />
        ) : (
          <>
            {shouldDisplayAppNavBar && (
              <NavBar navigationItems={navigationItems} />
            )}
            <div className="mx-auto max-w-(--breakpoint-2xl)">
              {location.pathname === "/" ? (
                <LandingPage />
              ) : (
                <Outlet />
              )}
            </div>
          </>
        )}
      </div>
      <Toaster position="bottom-right" />
      <HotToaster position="top-right" toastOptions={{ duration: 4000 }} />
      <CookieConsentBanner />
    </>
  );
}
