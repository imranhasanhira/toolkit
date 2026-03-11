import { Button } from '../../../client/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../../client/components/ui/dialog';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onViewJobs: () => void;
  onRunAnyway: () => void;
};

export function ExploreWithRunningJobDialog({
  open,
  onOpenChange,
  onViewJobs,
  onRunAnyway,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Already a running job</DialogTitle>
          <DialogDescription asChild>
            <span>
              There is already an exploration job running.{' '}
              <Button
                variant="link"
                className="h-auto p-0 text-primary underline"
                onClick={onViewJobs}
              >
                View jobs
              </Button>{' '}
              Do you still want to start a new one?
            </span>
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onRunAnyway}>Run anyway</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
