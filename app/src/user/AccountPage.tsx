// import { getCustomerPortalUrl, useQuery } from "wasp/client/operations";
// import { Link as WaspRouterLink, routes } from "wasp/client/router";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import type { User } from "wasp/entities";
import { getMyAppPermissions, useQuery } from "wasp/client/operations";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../client/components/ui/card";
import { Separator } from "../client/components/ui/separator";
import {
  PaymentPlanId,
  SubscriptionStatus,
  parsePaymentPlanId,
  prettyPaymentPlanName,
} from "../payment/plans";
import { APP_DISPLAY_NAMES } from "../shared/appKeys";

export default function AccountPage({ user }: { user: User }) {
  const { t } = useTranslation();
  return (
    <div className="mt-10 px-6">
      <Card className="mb-4 lg:m-8">
        <CardHeader>
          <CardTitle className="text-foreground text-base font-semibold leading-6">
            {t("account.title")}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="space-y-0">
            {!!user.email && (
              <div className="px-6 py-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 sm:gap-4">
                  <div className="text-muted-foreground text-sm font-medium">
                    {t("account.email")}
                  </div>
                  <div className="text-foreground mt-1 text-sm sm:col-span-2 sm:mt-0">
                    {user.email}
                  </div>
                </div>
              </div>
            )}
            {!!user.username && (
              <>
                <Separator />
                <div className="px-6 py-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 sm:gap-4">
                    <div className="text-muted-foreground text-sm font-medium">
                      {t("account.username")}
                    </div>
                    <div className="text-foreground mt-1 text-sm sm:col-span-2 sm:mt-0">
                      {user.username}
                    </div>
                  </div>
                </div>
              </>
            )}
            <Separator />
            <div className="px-6 py-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 sm:gap-4">
                <div className="text-muted-foreground text-sm font-medium">
                  {t("account.yourPlan")}
                </div>
                <UserCurrentSubscriptionPlan
                  subscriptionPlan={user.subscriptionPlan}
                  subscriptionStatus={user.subscriptionStatus}
                  datePaid={user.datePaid}
                />
              </div>
            </div>
            <Separator />
            <div className="px-6 py-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 sm:gap-4">
                <div className="text-muted-foreground text-sm font-medium">
                  {t("account.credits")}
                </div>
                <div className="text-foreground mt-1 text-sm sm:col-span-1 sm:mt-0">
                  {t("account.credits", { count: user.credits })}
                </div>
                <div className="ml-auto mt-4 sm:mt-0">
                  {/* <BuyMoreButton subscriptionStatus={user.subscriptionStatus} /> */}
                </div>
              </div>
            </div>
            <Separator />
            <div className="px-6 py-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 sm:gap-4">
                <div className="text-muted-foreground text-sm font-medium">
                  {t("account.about")}
                </div>
                <div className="text-foreground mt-1 text-sm sm:col-span-2 sm:mt-0">
                  {t("account.aboutValue")}
                </div>
              </div>
            </div>
            <Separator />
            <div className="px-6 py-4">
              <YourAppAccess />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function YourAppAccess() {
  const { t } = useTranslation();
  const { data: allowedAppKeys = [], isLoading } = useQuery(getMyAppPermissions);
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-3 sm:gap-4">
        <div className="text-muted-foreground text-sm font-medium">
          {t("account.appAccess")}
        </div>
        <div className="text-muted-foreground mt-1 text-sm sm:col-span-2 sm:mt-0">
          {t("status.loading")}
        </div>
      </div>
    );
  }
  const names = allowedAppKeys.map((key) => APP_DISPLAY_NAMES[key]).filter(Boolean);
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 sm:gap-4">
      <div className="text-muted-foreground text-sm font-medium">
        {t("account.appAccess")}
      </div>
      <div className="text-foreground mt-1 text-sm sm:col-span-2 sm:mt-0">
        {names.length > 0 ? names.join(", ") : t("account.none")}
      </div>
    </div>
  );
}

function UserCurrentSubscriptionPlan({
  subscriptionPlan,
  subscriptionStatus,
  datePaid,
}: Pick<User, "subscriptionPlan" | "subscriptionStatus" | "datePaid">) {
  const { t } = useTranslation();
  let subscriptionPlanMessage = t("account.freePlan");
  if (
    subscriptionPlan !== null &&
    subscriptionStatus !== null &&
    datePaid !== null
  ) {
    subscriptionPlanMessage = formatSubscriptionStatusMessage(
      parsePaymentPlanId(subscriptionPlan),
      datePaid,
      subscriptionStatus as SubscriptionStatus,
      t,
    );
  }

  return (
    <>
      <div className="text-foreground mt-1 text-sm sm:col-span-1 sm:mt-0">
        {subscriptionPlanMessage}
      </div>
      <div className="ml-auto mt-4 sm:mt-0">
        {/* <CustomerPortalButton /> */}
      </div>
    </>
  );
}

function formatSubscriptionStatusMessage(
  subscriptionPlan: PaymentPlanId,
  datePaid: Date,
  subscriptionStatus: SubscriptionStatus,
  t: TFunction,
): string {
  const paymentPlanName = prettyPaymentPlanName(subscriptionPlan);
  const statusToMessage: Record<SubscriptionStatus, string> = {
    active: paymentPlanName,
    past_due: t("account.subscription.pastDue", { plan: paymentPlanName }),
    cancel_at_period_end: t("account.subscription.cancelAtPeriodEnd", {
      plan: paymentPlanName,
      endDate: prettyPrintEndOfBillingPeriod(datePaid),
    }),
    deleted: t("account.subscription.deleted"),
  };

  if (!statusToMessage[subscriptionStatus]) {
    throw new Error(`Invalid subscription status: ${subscriptionStatus}`);
  }

  return statusToMessage[subscriptionStatus];
}

function prettyPrintEndOfBillingPeriod(date: Date) {
  const oneMonthFromNow = new Date(date);
  oneMonthFromNow.setMonth(oneMonthFromNow.getMonth() + 1);
  return oneMonthFromNow.toLocaleDateString();
}

// function CustomerPortalButton() {
//   const { data: customerPortalUrl, isLoading: isCustomerPortalUrlLoading } =
//     useQuery(getCustomerPortalUrl);

//   if (!customerPortalUrl) {
//     return null;
//   }

//   return (
//     <a href={customerPortalUrl} target="_blank" rel="noopener noreferrer">
//       <Button disabled={isCustomerPortalUrlLoading} variant="link">
//         Manage Payment Details
//       </Button>
//     </a>
//   );
// }

// function BuyMoreButton({
//   subscriptionStatus,
// }: Pick<User, "subscriptionStatus">) {
//   if (
//     subscriptionStatus === SubscriptionStatus.Active ||
//     subscriptionStatus === SubscriptionStatus.CancelAtPeriodEnd
//   ) {
//     return null;
//   }

//   return (
//     <WaspRouterLink
//       to={routes.PricingPageRoute.to}
//       className="text-primary hover:text-primary/80 text-sm font-medium transition-colors duration-200"
//     >
//       <Button variant="link">Buy More Credits</Button>
//     </WaspRouterLink>
//   );
// }
