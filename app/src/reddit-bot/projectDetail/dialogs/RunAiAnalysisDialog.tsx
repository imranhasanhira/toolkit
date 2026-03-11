import { Button } from '../../../client/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../../client/components/ui/dialog';
import { Switch } from '../../../client/components/ui/switch';
import { Loader2 } from 'lucide-react';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  runAiForceIncludeProcessed: boolean;
  setRunAiForceIncludeProcessed: (v: boolean) => void;
  prospectiveCount: number | null | undefined;
  runningOnSelected?: boolean;
  running: boolean;
  startDisabled: boolean;
  onStart: () => void | Promise<void>;
};

export function RunAiAnalysisDialog({
  open,
  onOpenChange,
  runAiForceIncludeProcessed,
  setRunAiForceIncludeProcessed,
  prospectiveCount,
  runningOnSelected = false,
  running,
  startDisabled,
  onStart,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Run AI analysis</DialogTitle>
          <DialogDescription>
            {runningOnSelected
              ? 'Process the selected posts with AI to evaluate relevancy and extract pain points.'
              : 'Process posts with AI to evaluate relevancy and extract pain points. By default only posts not yet analyzed (or pending) are included.'}
          </DialogDescription>
        </DialogHeader>
        <p className="text-sm font-medium pt-2">
          {prospectiveCount != null
            ? `${prospectiveCount} ${runningOnSelected ? 'selected ' : ''}post${prospectiveCount === 1 ? '' : 's'} will be analyzed`
            : runningOnSelected
              ? null
              : 'Counting posts…'}
        </p>
        <div className="space-y-4 pt-2">
          {!runningOnSelected && (
            <label className="flex items-center gap-2 cursor-pointer">
              <Switch
                checked={runAiForceIncludeProcessed}
                onCheckedChange={setRunAiForceIncludeProcessed}
              />
              <span className="text-sm">Also process posts already completed or failed (re-run AI)</span>
            </label>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button disabled={startDisabled || running} onClick={onStart}>
              {running ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Start
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
