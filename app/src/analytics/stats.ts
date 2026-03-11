import { type DailyStats } from "wasp/entities";
import { type DailyStatsJob } from "wasp/server/jobs";
import { paymentProcessor } from "../payment/paymentProcessor";
import { SubscriptionStatus } from "../payment/plans";
// import { assertUnreachable } from "../shared/utils";

export type DailyStatsProps = {
  dailyStats?: DailyStats;
  weeklyStats?: DailyStats[];
  isLoading?: boolean;
};

export const calculateDailyStats: DailyStatsJob<never, void> = async (
  _args,
  context,
) => {
  const nowUTC = new Date(Date.now());
  nowUTC.setUTCHours(0, 0, 0, 0);

  const yesterdayUTC = new Date(nowUTC);
  yesterdayUTC.setUTCDate(yesterdayUTC.getUTCDate() - 1);

  try {
    const yesterdaysStats = await context.entities.DailyStats.findFirst({
      where: {
        date: {
          equals: yesterdayUTC,
        },
      },
    });

    const userCount = await context.entities.User.count({});
    // users can have paid but canceled subscriptions which terminate at the end of the period
    // we don't want to count those users as current paying users
    const paidUserCount = await context.entities.User.count({
      where: {
        subscriptionStatus: SubscriptionStatus.Active,
      },
    });

    let userDelta = userCount;
    let paidUserDelta = paidUserCount;
    if (yesterdaysStats) {
      userDelta -= yesterdaysStats.userCount;
      paidUserDelta -= yesterdaysStats.paidUserCount;
    }

    // Revenue calculation disabled
    let totalRevenue = 0;

    // switch (paymentProcessor.id) {
    //   case "stripe":
    //     totalRevenue = await fetchTotalStripeRevenue();
    //     break;
    //   case "lemonsqueezy":
    //     totalRevenue = await fetchTotalLemonSqueezyRevenue();
    //     break;
    //   case "polar":
    //     totalRevenue = await fetchTotalPolarRevenue();
    //     break;
    //   default:
    //     assertUnreachable(paymentProcessor.id);
    // }

    const totalViews = 0;
    const prevDayViewsChangePercent = "0";

    let dailyStats = await context.entities.DailyStats.findUnique({
      where: {
        date: nowUTC,
      },
    });

    if (!dailyStats) {
      console.log("No daily stat found for today, creating one...");
      dailyStats = await context.entities.DailyStats.create({
        data: {
          date: nowUTC,
          totalViews,
          prevDayViewsChangePercent,
          userCount,
          paidUserCount,
          userDelta,
          paidUserDelta,
          totalRevenue,
        },
      });
    } else {
      console.log("Daily stat found for today, updating it...");
      dailyStats = await context.entities.DailyStats.update({
        where: {
          id: dailyStats.id,
        },
        data: {
          totalViews,
          prevDayViewsChangePercent,
          userCount,
          paidUserCount,
          userDelta,
          paidUserDelta,
          totalRevenue,
        },
      });
    }
    // No external analytics sources configured.
  } catch (error: any) {
    console.error("Error calculating daily stats: ", error);
    await context.entities.Logs.create({
      data: {
        message: `Error calculating daily stats: ${error?.message}`,
        level: "job-error",
      },
    });
  }
};

// async function fetchTotalStripeRevenue() {
// ... removed implementation ...
//   return totalRevenue / 100;
// }

// async function fetchTotalLemonSqueezyRevenue() {
// ... removed implementation ...
// }

// async function fetchTotalPolarRevenue(): Promise<number> {
// ... removed implementation ...
// }
