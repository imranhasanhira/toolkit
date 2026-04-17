import { useEffect, useMemo, useRef } from "react";
import { Navigate, Outlet, useLocation, useNavigate } from "react-router";
import { useAuth } from "wasp/client/auth";
import { getMyAppPermissions, useQuery } from "wasp/client/operations";
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
 * React Router's browser history stores `idx` on `window.history.state` (see
 * `createBrowserHistory` in @remix-run/router). `idx > 0` means the SPA has at
 * least one prior entry to pop — even when Android WebView's `canGoBack` stays
 * false for client-side `pushState` navigations.
 */
function reactRouterHistoryCanGoBack(): boolean {
  if (typeof window === "undefined") return false;
  const st = window.history.state;
  if (!st || typeof st !== "object") return false;
  const idx = (st as { idx?: unknown }).idx;
  return typeof idx === "number" && idx > 0;
}

/**
 * use this component to wrap all child components
 * this is useful for templates, themes, and context
 */
export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const { data: user } = useAuth();
  const prevUserRef = useRef(user);
  const { data: allowedAppKeys = [], isLoading: permissionsLoading } = useQuery(
    getMyAppPermissions,
    undefined,
    { enabled: !!user }
  );

  const isMarketingPage = useMemo(() => {
    return (
      location.pathname === "/" || location.pathname.startsWith("/pricing")
    );
  }, [location]);

  const baseNavItems = isMarketingPage
    ? marketingNavigationItems
    : demoNavigationitems;
  const navigationItems = useMemo(() => {
    if (!user) return [];
    return baseNavItems.filter((item) => allowedAppKeys.includes(item.appKey));
  }, [user, allowedAppKeys, baseNavItems]);

  const shouldDisplayAppNavBar = useMemo(() => {
    return (
      location.pathname !== routes.LoginRoute.build() &&
      location.pathname !== routes.SignupRoute.build()
    );
  }, [location]);

  const isAdminDashboard = useMemo(() => {
    return location.pathname.startsWith("/admin");
  }, [location.pathname]);

  const isAuthPage = useMemo(() => {
    const path = location.pathname;
    return (
      path === routes.LoginRoute.to ||
      path === routes.SignupRoute.to ||
      path === routes.RequestPasswordResetRoute.to ||
      path === routes.PasswordResetRoute.to ||
      path === routes.EmailVerificationRoute.to
    );
  }, [location.pathname]);

  // If the user tries to access a protected area while logged out,
  // redirect to login and preserve the intended destination.
  const shouldRedirectToLogin = useMemo(() => {
    if (user) return false;
    if (isAdminDashboard) return true;
    if (isMarketingPage) return false; // allow "/" marketing page
    if (isAuthPage) return false;
    // Everything else is treated as "app area" (auth required).
    return true;
  }, [user, isAdminDashboard, isMarketingPage, isAuthPage]);

  // When an unauthenticated user is redirected to login, persist the intended
  // destination so we can return them there after a successful login.
  // We use sessionStorage because Wasp's LoginForm hardcodes navigate('/'),
  // which navigates away from the login page before any effect there can fire.
  useEffect(() => {
    if (shouldRedirectToLogin) {
      const dest = location.pathname + location.search + location.hash;
      sessionStorage.setItem("redirectAfterLogin", dest);
    }
  }, [shouldRedirectToLogin, location]);

  // Detect the moment the user transitions from logged-out → logged-in and
  // consume the stored destination.
  useEffect(() => {
    const wasLoggedOut = !prevUserRef.current;
    prevUserRef.current = user;
    if (wasLoggedOut && user) {
      const dest = sessionStorage.getItem("redirectAfterLogin");
      if (dest) {
        sessionStorage.removeItem("redirectAfterLogin");
        navigate(dest, { replace: true });
      }
    }
  }, [user, navigate]);

  useEffect(() => {
    if (location.hash) {
      const id = location.hash.replace("#", "");
      const element = document.getElementById(id);
      if (element) {
        element.scrollIntoView();
      }
    }
  }, [location]);

  const isNativeAndroid = useMemo(() => {
    const w = window as any;
    const capacitor = w?.Capacitor;
    if (!capacitor) return false;
    if (typeof capacitor.getPlatform === "function") return capacitor.getPlatform() === "android";
    return false;
  }, []);

  // Track an in-app navigation stack only on native Android. This is a fallback for cases
  // where WebView history is empty due to replace redirects / cold starts.
  useEffect(() => {
    if (!isNativeAndroid) return;
    const path = location.pathname + location.search + location.hash;
    if (isAuthPage) return;

    const key = "navStack";
    const raw = sessionStorage.getItem(key);
    const stack: string[] = (() => {
      try {
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed)
          ? parsed.filter((x) => typeof x === "string")
          : [];
      } catch {
        return [];
      }
    })();

    const last = stack[stack.length - 1];
    if (last !== path) {
      stack.push(path);
      if (stack.length > 50) stack.splice(0, stack.length - 50);
      sessionStorage.setItem(key, JSON.stringify(stack));
    }
  }, [isNativeAndroid, isAuthPage, location.pathname, location.search, location.hash]);

  // Capacitor Android hardware back button support (hosted mode):
  // Prefer WebView + React Router history; fall back to `navStack` when both
  // are exhausted (e.g. cold start + replace-only redirects).
  useEffect(() => {
    if (!isNativeAndroid) return;
    const w = window as any;
    const AppPlugin = w?.Capacitor?.Plugins?.App;
    if (!AppPlugin) return;

    let remove: (() => void) | undefined;
    (async () => {
      try {
        const handle = await AppPlugin.addListener(
          "backButton",
          (ev: { canGoBack?: boolean }) => {
            if (ev?.canGoBack || reactRouterHistoryCanGoBack()) {
              navigate(-1);
              return;
            }

            const key = "navStack";
            const raw = sessionStorage.getItem(key);
            const stack: string[] = (() => {
              try {
                const parsed = raw ? JSON.parse(raw) : [];
                return Array.isArray(parsed)
                  ? parsed.filter((x) => typeof x === "string")
                  : [];
              } catch {
                return [];
              }
            })();

            const current = location.pathname + location.search + location.hash;
            while (stack.length && stack[stack.length - 1] === current) stack.pop();
            const prev = stack[stack.length - 1];
            sessionStorage.setItem(key, JSON.stringify(stack));

            if (prev && prev.startsWith("/")) {
              navigate(prev, { replace: true });
              return;
            }

            if (typeof AppPlugin.exitApp === "function") AppPlugin.exitApp();
          },
        );
        remove = () => handle?.remove?.();
      } catch {
        // ignore
      }
    })();

    return () => remove?.();
  }, [isNativeAndroid, navigate, location.pathname, location.search, location.hash]);

  return (
    <>
      <div className="bg-background text-foreground min-h-screen">
        {isAdminDashboard ? (
          shouldRedirectToLogin ? (
            <Navigate
              to={`${routes.LoginRoute.to}?next=${encodeURIComponent(
                location.pathname + location.search + location.hash
              )}`}
              replace
            />
          ) : (
            <Outlet />
          )
        ) : (
          <>
            {shouldDisplayAppNavBar && (
              <NavBar navigationItems={navigationItems} />
            )}
            <div className="mx-auto max-w-(--breakpoint-2xl)">
              {shouldRedirectToLogin ? (
                <Navigate
                  to={`${routes.LoginRoute.to}?next=${encodeURIComponent(
                    location.pathname + location.search + location.hash
                  )}`}
                  replace
                />
              ) : location.pathname === "/" ? (
                <LandingPage />
              ) : user && !permissionsLoading && location.pathname.startsWith("/sokafilm") && !allowedAppKeys.includes("sokafilm") ? (
                <Navigate to={routes.AccountRoute.to} replace />
              ) : user && !permissionsLoading && location.pathname.startsWith("/online-judge") && !allowedAppKeys.includes("online-judge") ? (
                <Navigate to={routes.AccountRoute.to} replace />
              ) : user && !permissionsLoading && location.pathname.startsWith("/reddit-bot") && !allowedAppKeys.includes("reddit-bot") ? (
                <Navigate to={routes.AccountRoute.to} replace />
              ) : user && !permissionsLoading && location.pathname.startsWith("/carely") && !allowedAppKeys.includes("carely") ? (
                <Navigate to={routes.AccountRoute.to} replace />
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
