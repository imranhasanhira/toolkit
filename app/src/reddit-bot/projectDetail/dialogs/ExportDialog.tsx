import { Button } from '../../../client/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../../client/components/ui/dialog';
import { Label } from '../../../client/components/ui/label';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exportOnlyUnexported: boolean;
  setExportOnlyUnexported: (v: boolean) => void;
  exportRelevantOnly: boolean;
  setExportRelevantOnly: (v: boolean) => void;
  exportCount?: number | null;
  onConfirm: () => void;
};

export function ExportDialog(props: Props) {
  const {
    open,
    onOpenChange,
    exportOnlyUnexported,
    setExportOnlyUnexported,
    exportRelevantOnly,
    setExportRelevantOnly,
    exportCount,
    onConfirm,
  } = props;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Export TSV</DialogTitle>
          <DialogDescription>
            Export posts as a tab-separated file. Other filters (subreddits, keywords, dates) always apply.
          </DialogDescription>
        </DialogHeader>
        {exportCount != null && (
          <p className="text-sm font-medium pt-1">
            {exportCount} post{exportCount === 1 ? '' : 's'} will be exported.
          </p>
        )}
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Scope</Label>
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="export-scope"
                  checked={exportRelevantOnly}
                  onChange={() => setExportRelevantOnly(true)}
                  className="rounded-full"
                />
                <span className="text-sm">Relevant only (default)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="export-scope"
                  checked={!exportRelevantOnly}
                  onChange={() => setExportRelevantOnly(false)}
                  className="rounded-full"
                />
                <span className="text-sm">All (current status filter applies)</span>
              </label>
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={exportOnlyUnexported}
              onChange={(e) => setExportOnlyUnexported(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm">Export only posts not yet exported (default)</span>
          </label>
          <p className="text-muted-foreground text-xs">Uncheck to include already exported posts.</p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={onConfirm}>Export</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
