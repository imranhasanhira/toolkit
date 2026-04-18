import { useTranslation } from "react-i18next";
import { VerifyEmailForm } from "wasp/client/auth";
import { Link as WaspRouterLink, routes } from "wasp/client/router";
import { AuthPageLayout } from "../AuthPageLayout";

export function EmailVerificationPage() {
  const { t } = useTranslation();
  return (
    <AuthPageLayout>
      <VerifyEmailForm />
      <br />
      <span className="text-sm font-medium text-gray-900">
        {t("auth.verifyEmailOk")}{" "}
        <WaspRouterLink to={routes.LoginRoute.to} className="underline">
          {t("auth.goToLogin")}
        </WaspRouterLink>
      </span>
    </AuthPageLayout>
  );
}
