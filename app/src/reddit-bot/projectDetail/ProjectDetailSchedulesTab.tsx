import { Button } from '../../client/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../client/components/ui/card';
import { Switch } from '../../client/components/ui/switch';
import { Pencil, Trash2 } from 'lucide-react';
import { formatJobConfigSummary } from './projectDetailConstants';

type Props = {
  schedules: any[];
  onEditSchedule: (scheduleId: string) => void;
  onDeleteSchedule: (scheduleId: string) => void;
  onToggleSchedule: (schedule: any, enabled: boolean) => void;
};

export function ProjectDetailSchedulesTab({
  schedules,
  onEditSchedule,
  onDeleteSchedule,
  onToggleSchedule,
}: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Scheduled jobs</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {schedules.map((s: any) => (
            <li key={s.id} className="flex flex-col gap-1.5 rounded border p-3">
              <div className="flex items-center justify-between">
                <div>
                  <span>Daily at {s.runAtTime ?? s.cronExpression ?? '—'}</span>
                  <span className="text-muted-foreground ml-2">
                    Next: {s.nextRunAt ? new Date(s.nextRunAt).toLocaleString() : '—'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={() => onEditSchedule(s.id)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Switch checked={s.enabled} onCheckedChange={(v) => onToggleSchedule(s, v)} />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={() => onDeleteSchedule(s.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <p className="text-muted-foreground text-sm">{formatJobConfigSummary(s.config)}</p>
            </li>
          ))}
        </ul>
        {schedules.length === 0 && (
          <p className="text-muted-foreground py-2">
            No schedules. Add one from the Home tab (Schedule button) to run explorations automatically.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
