import { useTranslation } from "react-i18next";
import { LoginForm } from "wasp/client/auth";
import { Link as WaspRouterLink, routes } from "wasp/client/router";
import { AuthPageLayout } from "./AuthPageLayout";

export default function Login() {
  const { t } = useTranslation();
  return (
    <AuthPageLayout>
      <LoginForm />
      <br />
      <span className="text-sm font-medium text-gray-900 dark:text-gray-900">
        {t("auth.noAccountPrompt")}{" "}
        <WaspRouterLink to={routes.SignupRoute.to} className="underline">
          {t("auth.goToSignup")}
        </WaspRouterLink>
        .
      </span>
      <br />
      <span className="text-sm font-medium text-gray-900">
        {t("auth.forgotPassword")}{" "}
        <WaspRouterLink
          to={routes.RequestPasswordResetRoute.to}
          className="underline"
        >
          {t("auth.resetIt")}
        </WaspRouterLink>
        .
      </span>
    </AuthPageLayout>
  );
}
