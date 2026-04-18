import { Link as WaspRouterLink, routes } from "wasp/client/router";
import { useTranslation } from "react-i18next";
interface BreadcrumbProps {
  pageName: string;
}
const Breadcrumb = ({ pageName }: BreadcrumbProps) => {
  const { t } = useTranslation("admin");
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <h2 className="text-title-md2 text-foreground font-semibold">
        {pageName}
      </h2>

      <nav>
        <ul className="flex items-center gap-1">
          <li>
            <WaspRouterLink to={routes.AdminRoute.to}>{t("breadcrumb.dashboard")}</WaspRouterLink>
          </li>
          <li>/</li>
          <li className="font-medium">{pageName}</li>
        </ul>
      </nav>
    </div>
  );
};

export default Breadcrumb;
