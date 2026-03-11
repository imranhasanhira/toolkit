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
import { Textarea } from '../../../client/components/ui/textarea';
import { Loader2 } from 'lucide-react';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editName: string;
  setEditName: (v: string) => void;
  editDescription: string;
  setEditDescription: (v: string) => void;
  editProductDescription: string;
  setEditProductDescription: (v: string) => void;
  editSubredditsStr: string;
  setEditSubredditsStr: (v: string) => void;
  editKeywordsStr: string;
  setEditKeywordsStr: (v: string) => void;
  savingEdit: boolean;
  onSave: () => void;
};

export function EditProjectDialog({
  open,
  onOpenChange,
  editName,
  setEditName,
  editDescription,
  setEditDescription,
  editProductDescription,
  setEditProductDescription,
  editSubredditsStr,
  setEditSubredditsStr,
  editKeywordsStr,
  setEditKeywordsStr,
  savingEdit,
  onSave,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit project</DialogTitle>
          <DialogDescription className="sr-only">
            Edit project name, description, and settings.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div>
            <Label htmlFor="edit-name">Project name</Label>
            <Input
              id="edit-name"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="e.g. SaaS leads"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="edit-description">Description (optional)</Label>
            <Textarea
              id="edit-description"
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              placeholder="Short description"
              className="mt-1 min-h-[80px]"
              rows={3}
            />
          </div>
          <div>
            <Label htmlFor="edit-productDescription">Product description (for matching leads)</Label>
            <Textarea
              id="edit-productDescription"
              value={editProductDescription}
              onChange={(e) => setEditProductDescription(e.target.value)}
              placeholder="What your product does / who it's for"
              className="mt-1 min-h-[80px]"
              rows={3}
            />
          </div>
          <div>
            <Label htmlFor="edit-subreddits">Subreddits (comma or space separated)</Label>
            <Input
              id="edit-subreddits"
              value={editSubredditsStr}
              onChange={(e) => setEditSubredditsStr(e.target.value)}
              placeholder="e.g. webdev, startups, SaaS"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="edit-keywords">Keywords (comma or space separated)</Label>
            <Input
              id="edit-keywords"
              value={editKeywordsStr}
              onChange={(e) => setEditKeywordsStr(e.target.value)}
              placeholder="e.g. pricing, churn, onboarding"
              className="mt-1"
            />
          </div>
          <Button onClick={onSave} disabled={!editName.trim() || savingEdit} className="w-full">
            {savingEdit ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Save changes'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
