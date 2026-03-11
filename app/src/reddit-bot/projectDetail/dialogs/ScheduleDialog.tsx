import { Button } from '../../../client/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../../client/components/ui/dialog';
import { Input } from '../../../client/components/ui/input';
import { Label } from '../../../client/components/ui/label';
import { Switch } from '../../../client/components/ui/switch';
import ExplorationFiltersForm, { type ExplorationFiltersValue } from '../../ExplorationFiltersForm';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingScheduleId: string | null;
  subreddits: string[];
  keywords: string[];
  scheduleEditFilters: ExplorationFiltersValue | null;
  setScheduleEditFilters: (v: ExplorationFiltersValue | null) => void;
  scheduleRunAt: string;
  setScheduleRunAt: (v: string) => void;
  scheduleEnabled: boolean;
  setScheduleEnabled: (v: boolean) => void;
  onUpdate: () => void;
  onAdd: () => void;
};

export function ScheduleDialog(props: Props) {
  const {
    open,
    onOpenChange,
    editingScheduleId,
    subreddits,
    keywords,
    scheduleEditFilters,
    setScheduleEditFilters,
    scheduleRunAt,
    setScheduleRunAt,
    scheduleEnabled,
    setScheduleEnabled,
    onUpdate,
    onAdd,
  } = props;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingScheduleId ? 'Edit schedule' : 'New schedule'}</DialogTitle>
          <DialogDescription>
            {editingScheduleId
              ? 'Update exploration filters, run time, and enabled state for this schedule.'
              : 'Schedule an exploration using the current Home tab filters. Choose a daily run time.'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {editingScheduleId && scheduleEditFilters && (
            <ExplorationFiltersForm
              subreddits={subreddits}
              keywords={keywords}
              value={scheduleEditFilters}
              onChange={setScheduleEditFilters}
              compact
              isSchedule
            />
          )}
          {!editingScheduleId && (
            <p className="text-muted-foreground text-sm">
              The schedule will use the exploration filters currently configured on the Home tab.
            </p>
          )}
          <div>
            <Label className="text-sm">Daily at (UTC)</Label>
            <Input
              type="time"
              value={scheduleRunAt}
              onChange={(e) => setScheduleRunAt(e.target.value)}
              className="mt-1 h-8"
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={scheduleEnabled} onCheckedChange={setScheduleEnabled} />
            <Label className="text-sm">Enabled</Label>
          </div>
          {editingScheduleId ? (
            <Button onClick={onUpdate} className="w-full">
              Update schedule
            </Button>
          ) : (
            <Button onClick={onAdd} className="w-full">
              Create schedule
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
