import { ArrowDown, ArrowUp, ShoppingCart } from "lucide-react";
import { useMemo } from "react";
import { type DailyStatsProps } from "../../../analytics/stats";
import {
  Card,
  CardContent,
  CardHeader,
} from "../../../client/components/ui/card";
import { cn } from "../../../client/utils";

const TotalRevenueCard = ({
  dailyStats,
  weeklyStats,
  isLoading,
}: DailyStatsProps) => {
  const isDeltaPositive = useMemo(() => {
    if (!weeklyStats?.length || weeklyStats[0] == null) return false;
    const curr = weeklyStats[0].totalRevenue ?? 0;
    const prev = weeklyStats[1]?.totalRevenue ?? 0;
    return curr - prev > 0;
  }, [weeklyStats]);

  const deltaPercentage = useMemo(() => {
    if (!weeklyStats || weeklyStats.length < 2 || isLoading) return;
    const curr = weeklyStats[0]?.totalRevenue ?? 0;
    const prev = weeklyStats[1]?.totalRevenue ?? 0;
    if (prev === 0) return 0;

    const sorted = [...weeklyStats].sort((a, b) => b.id - a.id);
    const percentage = ((sorted[0].totalRevenue - sorted[1]?.totalRevenue) / (sorted[1]?.totalRevenue ?? 1)) * 100;
    return Math.floor(percentage);
  }, [weeklyStats]);

  return (
    <Card>
      <CardHeader>
        <div className="h-11.5 w-11.5 bg-muted flex items-center justify-center rounded-full">
          <ShoppingCart className="size-6" />
        </div>
      </CardHeader>

      <CardContent className="flex justify-between">
        <div>
          <h4 className="text-title-md text-foreground font-bold">
            ${dailyStats?.totalRevenue ?? 0}
          </h4>
          <span className="text-muted-foreground text-sm font-medium">
            Total Revenue
          </span>
        </div>

        <span
          className={cn("flex items-center gap-1 text-sm font-medium", {
            "text-success":
              isDeltaPositive && !isLoading && deltaPercentage !== 0,
            "text-destructive":
              !isDeltaPositive && !isLoading && deltaPercentage !== 0,
            "text-muted-foreground":
              isLoading || !deltaPercentage || deltaPercentage === 0,
          })}
        >
          {isLoading
            ? "..."
            : deltaPercentage && deltaPercentage !== 0
              ? `${deltaPercentage}%`
              : "-"}
          {!isLoading &&
            deltaPercentage &&
            deltaPercentage !== 0 &&
            (isDeltaPositive ? <ArrowUp /> : <ArrowDown />)}
        </span>
      </CardContent>
    </Card>
  );
};

export default TotalRevenueCard;
