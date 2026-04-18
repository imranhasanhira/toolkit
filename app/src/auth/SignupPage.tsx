import { useTranslation } from "react-i18next";
import { SignupForm } from "wasp/client/auth";
import { Link as WaspRouterLink, routes } from "wasp/client/router";
import { AuthPageLayout } from "./AuthPageLayout";

export function Signup() {
  const { t } = useTranslation();
  return (
    <AuthPageLayout>
      <SignupForm />
      <br />
      <span className="text-sm font-medium text-gray-900">
        {t("auth.haveAccountPrompt")} (
        <WaspRouterLink to={routes.LoginRoute.to} className="underline">
          {t("auth.goToLogin")}
        </WaspRouterLink>
        ).
      </span>
      <br />
    </AuthPageLayout>
  );
}
