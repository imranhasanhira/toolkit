import { useState, useEffect } from 'react';
import { Input } from '../client/components/ui/input';
import { Label } from '../client/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../client/components/ui/select';
import { AlertCircle } from 'lucide-react';

const PRESETS: { value: string; label: string; start: string; end: string }[] = [
  { value: 'last-1h', label: 'Last hour', start: '-1h', end: 'now' },
  { value: 'last-6h', label: 'Last 6h', start: '-6h', end: 'now' },
  { value: 'last-24h', label: 'Last 24h', start: '-24h', end: 'now' },
  { value: 'yesterday', label: 'Day before yesterday', start: '-2d', end: '-1d' },
  { value: 'last-7d', label: 'Last 7 days', start: '-7d', end: 'now' },
  { value: 'custom-fixed', label: 'Custom (fixed dates)', start: '', end: '' },
  { value: 'custom-relative', label: 'Custom (relative)', start: '', end: '' },
];

const RELATIVE_UNITS = [
  { value: 'h' as const, label: 'hour(s)' },
  { value: 'd' as const, label: 'day(s)' },
  { value: 'w' as const, label: 'week(s)' },
];

function relativeToStartEnd(
  from: number,
  fromUnit: 'h' | 'd' | 'w',
  to: number,
  toUnit: 'h' | 'd' | 'w',
  toIsNow: boolean
): { start: string; end: string } {
  const normalize = (v: number, u: 'h' | 'd' | 'w') => {
    if (u === 'w') return { val: v * 7, unit: 'd' as const };
    return { val: v, unit: u };
  };
  const s = normalize(from, fromUnit);
  const start = `-${s.val}${s.unit}`;
  if (toIsNow) return { start, end: 'now' };
  const e = normalize(to, toUnit);
  return { start, end: `-${e.val}${e.unit}` };
}

export type DateRangeValue = {
  start: string;
  end: string;
  bufferMinutes?: number;
};

type Props = {
  value: DateRangeValue;
  onChange: (v: DateRangeValue) => void;
  isSchedule?: boolean;
  compact?: boolean;
};

function detectPreset(start: string, end: string): string | null {
  return PRESETS.find((p) => p.start && p.start === start && p.end === end)?.value ?? null;
}

function isFixedDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}/.test(s);
}

function isRelativeDate(s: string): boolean {
  return /^-\d+[hdw]?$/.test(s) || s === 'now';
}

export default function DateRangeSelector({ value, onChange, isSchedule, compact }: Props) {
  const [mode, setMode] = useState<string>(() => {
    const preset = detectPreset(value.start, value.end);
    if (preset) return preset;
    if (isFixedDate(value.start)) return 'custom-fixed';
    return 'custom-relative';
  });

  const [fixedFrom, setFixedFrom] = useState(() =>
    isFixedDate(value.start) ? value.start.slice(0, 10) : ''
  );
  const [fixedTo, setFixedTo] = useState(() =>
    isFixedDate(value.end) ? value.end.slice(0, 10) : ''
  );

  const parseRelNum = (s: string): { num: number; unit: 'h' | 'd' | 'w' } => {
    const m = s.match(/^-?(\d+)([hdw])$/);
    if (m) return { num: parseInt(m[1], 10), unit: m[2] as 'h' | 'd' | 'w' };
    return { num: 24, unit: 'h' };
  };

  const initFrom = parseRelNum(value.start);
  const initTo = value.end === 'now' ? { num: 0, unit: 'd' as const } : parseRelNum(value.end);

  const [relFromNum, setRelFromNum] = useState(initFrom.num);
  const [relFromUnit, setRelFromUnit] = useState<'h' | 'd' | 'w'>(initFrom.unit);
  const [relToNum, setRelToNum] = useState(initTo.num);
  const [relToUnit, setRelToUnit] = useState<'h' | 'd' | 'w'>(initTo.unit);
  const [relToIsNow, setRelToIsNow] = useState(value.end === 'now');

  const [bufferEnabled, setBufEnabled] = useState(value.bufferMinutes != null ? value.bufferMinutes > 0 : true);

  const [scheduleFixedAck, setScheduleFixedAck] = useState(false);

  const emit = (start: string, end: string, buf?: boolean) => {
    const b = buf ?? bufferEnabled;
    onChange({ start, end, bufferMinutes: b ? 1 : 0 });
  };

  const handleModeChange = (v: string) => {
    setMode(v);
    setScheduleFixedAck(false);
    const preset = PRESETS.find((p) => p.value === v);
    if (preset && preset.start) {
      emit(preset.start, preset.end);
    }
  };

  const handleBufferChange = (checked: boolean) => {
    setBufEnabled(checked);
    emit(value.start, value.end, checked);
  };

  useEffect(() => {
    if (mode === 'custom-fixed' && fixedFrom && fixedTo) {
      emit(`${fixedFrom}T00:00:00Z`, `${fixedTo}T23:59:59Z`);
    }
  }, [fixedFrom, fixedTo]);

  useEffect(() => {
    if (mode !== 'custom-relative') return;
    const r = relativeToStartEnd(relFromNum, relFromUnit, relToNum, relToUnit, relToIsNow);
    emit(r.start, r.end);
  }, [relFromNum, relFromUnit, relToNum, relToUnit, relToIsNow]);

  const fixedValidationError =
    mode === 'custom-fixed' && fixedFrom && fixedTo && fixedTo < fixedFrom
      ? 'End date must not be before start date'
      : null;

  const relativeValidationError = (() => {
    if (mode !== 'custom-relative' || relToIsNow) return null;
    const normalize = (v: number, u: 'h' | 'd' | 'w') => {
      if (u === 'w') return v * 7 * 24;
      if (u === 'd') return v * 24;
      return v;
    };
    const fromH = normalize(relFromNum, relFromUnit);
    const toH = normalize(relToNum, relToUnit);
    if (fromH <= toH) return '"From" must be further back than "To"';
    return null;
  })();

  const validationError = fixedValidationError || relativeValidationError;

  const farBackWarning = (() => {
    if (mode !== 'custom-fixed' || !fixedFrom) return null;
    const daysAgo = Math.floor((Date.now() - new Date(fixedFrom).getTime()) / 86400000);
    if (daysAgo > 14) {
      return `This range starts ${daysAgo} days ago. Reddit API pages backward from newest posts — scanning far-back ranges is expensive in API calls and credits.`;
    }
    return null;
  })();

  const isFixed = mode === 'custom-fixed';

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={mode} onValueChange={handleModeChange}>
          <SelectTrigger className={compact ? 'w-40 h-8 text-xs' : 'w-48'}>
            <SelectValue placeholder="Date range" />
          </SelectTrigger>
          <SelectContent>
            {PRESETS.map((p) => (
              <SelectItem key={p.value} value={p.value}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {mode === 'custom-fixed' && (
          <div className="flex flex-wrap items-center gap-1.5">
            <Input
              type="date"
              value={fixedFrom}
              onChange={(e) => setFixedFrom(e.target.value)}
              className={compact ? 'h-8 w-36 text-xs' : 'h-9 w-40'}
            />
            <span className="text-muted-foreground text-xs">→</span>
            <Input
              type="date"
              value={fixedTo}
              onChange={(e) => setFixedTo(e.target.value)}
              className={compact ? 'h-8 w-36 text-xs' : 'h-9 w-40'}
            />
          </div>
        )}

        {mode === 'custom-relative' && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-muted-foreground text-xs">From</span>
            <Input
              type="number"
              min={1}
              value={relFromNum}
              onChange={(e) => setRelFromNum(Math.max(1, parseInt(e.target.value, 10) || 1))}
              className={compact ? 'h-8 w-16 text-xs' : 'h-9 w-20'}
            />
            <Select value={relFromUnit} onValueChange={(v: 'h' | 'd' | 'w') => setRelFromUnit(v)}>
              <SelectTrigger className={compact ? 'h-8 w-20 text-xs' : 'h-9 w-24'}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RELATIVE_UNITS.map((u) => (
                  <SelectItem key={u.value} value={u.value}>
                    {u.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-muted-foreground text-xs">ago to</span>
            {relToIsNow ? (
              <button
                type="button"
                onClick={() => { setRelToIsNow(false); setRelToNum(1); setRelToUnit('d'); }}
                className="text-primary text-xs underline"
              >
                Now
              </button>
            ) : (
              <>
                <Input
                  type="number"
                  min={0}
                  value={relToNum}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10) || 0;
                    if (v === 0) setRelToIsNow(true);
                    else setRelToNum(v);
                  }}
                  className={compact ? 'h-8 w-16 text-xs' : 'h-9 w-20'}
                />
                <Select value={relToUnit} onValueChange={(v: 'h' | 'd' | 'w') => setRelToUnit(v)}>
                  <SelectTrigger className={compact ? 'h-8 w-20 text-xs' : 'h-9 w-24'}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RELATIVE_UNITS.map((u) => (
                      <SelectItem key={u.value} value={u.value}>
                        {u.label}
                      </SelectItem>
                    ))}
                    <SelectItem value="now">Now</SelectItem>
                  </SelectContent>
                </Select>
                <span className="text-muted-foreground text-xs">ago</span>
              </>
            )}
          </div>
        )}
      </div>

      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={bufferEnabled}
          onChange={(e) => handleBufferChange(e.target.checked)}
          className="rounded border-input"
        />
        <span className="text-muted-foreground text-xs">Add 1-minute buffer (covers schedule delays)</span>
      </label>

      {validationError && (
        <p className="flex items-center gap-1 text-destructive text-xs">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {validationError}
        </p>
      )}

      {farBackWarning && (
        <p className="flex items-center gap-1 text-amber-600 dark:text-amber-400 text-xs">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {farBackWarning}
        </p>
      )}

      {isSchedule && isFixed && (
        <div className="rounded border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 p-2 text-xs text-amber-800 dark:text-amber-300 space-y-1.5">
          <p>
            <strong>Warning:</strong> Fixed date ranges repeat the exact same window on every scheduled run.
            Use a relative range (e.g., Last 24h) for recurring schedules unless you specifically intend to re-scan the same period.
          </p>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={scheduleFixedAck}
              onChange={(e) => setScheduleFixedAck(e.target.checked)}
              className="rounded border-input"
            />
            <span>I understand and want to use a fixed date range</span>
          </label>
        </div>
      )}
    </div>
  );
}

export function useDateRangeValidation(value: DateRangeValue, isSchedule?: boolean): { isValid: boolean } {
  if (isFixedDate(value.start) && isFixedDate(value.end)) {
    if (value.end.slice(0, 10) < value.start.slice(0, 10)) return { isValid: false };
  }
  return { isValid: true };
}

export { PRESETS as DATE_RANGE_PRESETS };
