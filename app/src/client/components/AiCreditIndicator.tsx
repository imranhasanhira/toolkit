import { useQuery } from 'wasp/client/operations';
import { getOpenRouterAiCredit } from 'wasp/client/operations';
import { Coins } from 'lucide-react';

export default function AiCreditIndicator() {
  const { data } = useQuery(getOpenRouterAiCredit, undefined, {
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  if (!data?.available) return null;

  const { usage, limit, limitRemaining } = data;
  const hasLimit = limit != null && limit > 0;
  const pct = hasLimit ? ((limitRemaining ?? 0) / limit) * 100 : 100;
  const color =
    pct > 50
      ? 'text-green-600 dark:text-green-400'
      : pct > 10
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-red-600 dark:text-red-400';

  const label = hasLimit
    ? `$${usage.toFixed(2)} / $${limit.toFixed(2)}`
    : `$${usage.toFixed(2)} used`;

  const tooltip = hasLimit
    ? `AI Credit: $${usage.toFixed(2)} used, $${(limitRemaining ?? 0).toFixed(2)} remaining`
    : `AI Credit: $${usage.toFixed(2)} used (no limit)`;

  return (
    <li
      className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium tabular-nums ${color}`}
      title={tooltip}
    >
      <Coins className="h-3.5 w-3.5" />
      <span>{label}</span>
    </li>
  );
}
