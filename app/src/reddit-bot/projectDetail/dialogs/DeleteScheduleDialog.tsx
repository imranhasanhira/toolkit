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
  scheduleIdToDelete: string | null;
  onConfirm: (id: string) => void;
};

export function DeleteScheduleDialog({
  open,
  onOpenChange,
  scheduleIdToDelete,
  onConfirm,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Delete schedule</DialogTitle>
          <DialogDescription>
            This schedule will stop running. You can add a new one anytime from the Home tab. Delete
            this schedule?
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => scheduleIdToDelete && onConfirm(scheduleIdToDelete)}
          >
            Delete
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
