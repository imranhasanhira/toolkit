import { useState } from 'react';
import { Input } from '../client/components/ui/input';
import { Label } from '../client/components/ui/label';
import { Switch } from '../client/components/ui/switch';
import { Info } from 'lucide-react';
import DateRangeSelector, { type DateRangeValue } from './DateRangeSelector';

export type ExplorationFiltersValue = {
  selectedSubreddits: string[];
  selectedKeywords: string[];
  dateRange: DateRangeValue;
  maxPosts: string;
  maxLeads: string;
  strictKeywordSearch: boolean;
};

type Props = {
  subreddits: string[];
  keywords: string[];
  value: ExplorationFiltersValue;
  onChange: (v: ExplorationFiltersValue) => void;
  compact?: boolean;
  isSchedule?: boolean;
};

export default function ExplorationFiltersForm({ subreddits, keywords, value, onChange, compact, isSchedule }: Props) {
  const [showStrictDesc, setShowStrictDesc] = useState(false);

  const update = (patch: Partial<ExplorationFiltersValue>) => onChange({ ...value, ...patch });

  const toggleSubreddit = (s: string) => {
    const prev = value.selectedSubreddits;
    update({ selectedSubreddits: prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s] });
  };

  const toggleKeyword = (k: string) => {
    const prev = value.selectedKeywords;
    update({ selectedKeywords: prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k] });
  };

  const labelBase = compact ? 'text-sm' : 'text-base';
  const checkboxCls = compact
    ? 'flex items-center gap-1.5 rounded border px-2 py-1 text-xs cursor-pointer hover:bg-muted/50 has-[:checked]:bg-primary/10'
    : 'flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm cursor-pointer hover:bg-muted/50 has-[:checked]:bg-primary/10 has-[:checked]:border-primary';

  return (
    <div className="space-y-6">
      <div>
        <Label className={labelBase}>Subreddits</Label>
        <div className="mt-2 flex flex-wrap gap-2">
          {subreddits.length === 0 ? (
            <p className="text-sm text-muted-foreground">No subreddits in project. Edit project to add some.</p>
          ) : (
            subreddits.map((s) => (
              <label key={s} className={checkboxCls}>
                <input
                  type="checkbox"
                  checked={value.selectedSubreddits.includes(s)}
                  onChange={() => toggleSubreddit(s)}
                  className="rounded border-input"
                />
                {compact ? (
                  <span>r/{s}</span>
                ) : (
                  <a
                    href={s === 'all' ? 'https://reddit.com' : `https://reddit.com/r/${encodeURIComponent(s)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-primary hover:underline"
                  >
                    r/{s}
                  </a>
                )}
              </label>
            ))
          )}
        </div>
      </div>

      <div>
        <Label className={labelBase}>Keywords</Label>
        <div className="mt-2 flex flex-wrap gap-2">
          {keywords.length === 0 ? (
            <p className="text-sm text-muted-foreground">No keywords in project. Edit project to add some.</p>
          ) : (
            keywords.map((k) => (
              <label key={k} className={checkboxCls}>
                <input
                  type="checkbox"
                  checked={value.selectedKeywords.includes(k)}
                  onChange={() => toggleKeyword(k)}
                  className="rounded border-input"
                />
                {k}
              </label>
            ))
          )}
        </div>
      </div>

      <div>
        <Label className={labelBase}>Date range</Label>
        <div className="mt-2">
          <DateRangeSelector
            value={value.dateRange}
            onChange={(dr) => update({ dateRange: dr })}
            isSchedule={isSchedule}
            compact={compact}
          />
        </div>
      </div>

      <div className={`grid grid-cols-2 gap-4 items-end ${compact ? '' : 'max-w-sm'}`}>
        <div>
          <Label className={compact ? 'text-sm' : undefined}>Max posts to explore (optional)</Label>
          <Input
            type="number"
            value={value.maxPosts}
            onChange={(e) => update({ maxPosts: e.target.value })}
            placeholder="e.g. 500"
            className={compact ? 'mt-1 h-8 text-sm' : 'mt-1'}
          />
        </div>
        <div>
          <Label className={compact ? 'text-sm' : undefined}>Max leads to find (optional)</Label>
          <Input
            type="number"
            value={value.maxLeads}
            onChange={(e) => update({ maxLeads: e.target.value })}
            placeholder="e.g. 50"
            className={compact ? 'mt-1 h-8 text-sm' : 'mt-1'}
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Switch
          checked={value.strictKeywordSearch}
          onCheckedChange={(v) => update({ strictKeywordSearch: v })}
        />
        <Label className="text-sm">Strict keyword-based search</Label>
        <button
          type="button"
          onClick={() => setShowStrictDesc((v) => !v)}
          className="text-muted-foreground hover:text-foreground rounded p-0.5"
          aria-label="Toggle description"
        >
          <Info className="h-4 w-4" />
        </button>
      </div>
      {showStrictDesc && (
        <p className="text-muted-foreground text-xs">
          When on, Reddit API keyword search is used (one OR query per subreddit). When off, all subreddit posts are fetched and keywords matched locally.
        </p>
      )}
    </div>
  );
}
