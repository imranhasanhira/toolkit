import { useTranslation } from "react-i18next";
import { ResetPasswordForm } from "wasp/client/auth";
import { Link as WaspRouterLink, routes } from "wasp/client/router";
import { AuthPageLayout } from "../AuthPageLayout";

export function PasswordResetPage() {
  const { t } = useTranslation();
  return (
    <AuthPageLayout>
      <ResetPasswordForm />
      <br />
      <span className="text-sm font-medium text-gray-900">
        {t("auth.verifyEmailOk")}{" "}
        <WaspRouterLink to={routes.LoginRoute.to}>
          {t("auth.goToLogin")}
        </WaspRouterLink>
      </span>
    </AuthPageLayout>
  );
}
