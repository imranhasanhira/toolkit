import { useTranslation } from "react-i18next";
import { useAuth } from "wasp/client/auth";
import { Link as WaspRouterLink, routes } from "wasp/client/router";

export function NotFoundPage() {
  const { data: user } = useAuth();
  const { t } = useTranslation();

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="mb-4 text-6xl font-bold">{t("notFound.heading")}</h1>
        <p className="text-bodydark mb-8 text-lg">
          {t("notFound.description")}
        </p>
        <WaspRouterLink
          to={user ? routes.AccountRoute.to : routes.LandingPageRoute.to}
          className="text-accent-foreground bg-accent hover:bg-accent/90 inline-block rounded-lg px-8 py-3 font-semibold transition duration-300"
        >
          {t("notFound.goBackHome")}
        </WaspRouterLink>
      </div>
    </div>
  );
}
