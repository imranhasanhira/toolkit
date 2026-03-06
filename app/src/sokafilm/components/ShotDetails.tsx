import React, { useState } from 'react';
import { Button } from '../../client/components/ui/button';
import { Card, CardContent } from '../../client/components/ui/card';
import { Input } from '../../client/components/ui/input';
import { Label } from '../../client/components/ui/label';
import { Textarea } from '../../client/components/ui/textarea';
import { Edit2, Save, X, Trash2, Loader2, FileImage, ImageIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Shot } from 'wasp/entities';
import { updateShot, deleteShot, generateShotThumbnail } from 'wasp/client/operations';
import { MediaDisplay } from './MediaDisplay';
import { ConfirmationDialog } from '../../client/components/ui/confirmation-dialog';

interface ShotDetailsProps {
  shot: Shot;
  aspectRatioId?: string | null;
  onShotUpdated: (updatedShot: Shot) => void;
  onShotDeleted: (deletedShotId: string) => void;
}

export function ShotDetails({ shot, aspectRatioId, onShotUpdated, onShotDeleted }: ShotDetailsProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(shot.title || '');
  const [editDescription, setEditDescription] = useState(shot.description || '');
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [isGeneratingThumbnail, setIsGeneratingThumbnail] = useState(false);

  // Get the image UUID for the current aspect ratio, or fallback to thumbnailUuid
  const getDisplayImageUuid = (): string | null => {
    if (aspectRatioId && (shot as any).shotImages) {
      const matchingImage = (shot as any).shotImages.find(
        (si: any) => si.aspectRatioId === aspectRatioId
      );
      if (matchingImage) return matchingImage.imageUuid;
    }
    return shot.thumbnailUuid;
  };

  const displayImageUuid = getDisplayImageUuid();
  const hasAspectRatioImage = aspectRatioId && (shot as any).shotImages?.some(
    (si: any) => si.aspectRatioId === aspectRatioId
  );

  const handleSave = async () => {
    if (!editTitle.trim()) return;

    setIsUpdating(true);
    try {
      const updatedShot = await updateShot({
        id: shot.id,
        title: editTitle.trim(),
        description: editDescription.trim() || undefined
      });
      setIsEditing(false);
      onShotUpdated(updatedShot);
    } catch (error) {
      console.error('Error updating shot:', error);
      toast.error('Failed to update shot. Please try again.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditTitle(shot.title || '');
    setEditDescription(shot.description || '');
  };

  const handleDelete = () => {
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteShot({ id: shot.id });
      onShotDeleted(shot.id);
    } catch (error) {
      console.error('Error deleting shot:', error);
      toast.error('Failed to delete shot. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleGenerateThumbnail = async () => {
    setIsGeneratingThumbnail(true);
    try {
      const result = await generateShotThumbnail({
        shotId: shot.id,
        aspectRatioId: aspectRatioId || undefined,
      } as any);
      
      // The shot will be updated with the new thumbnailUuid by the backend
      // Create an updated shot object with the new thumbnailUuid
      const updatedShot = { ...shot, thumbnailUuid: result.fileUuid };
      onShotUpdated(updatedShot);
    } catch (error) {
      console.error('Error generating thumbnail:', error);
      let errorMessage = 'Failed to generate thumbnail. Please try again.';
      if (error && typeof error === 'object' && 'message' in error) {
        errorMessage = (error as { message: string }).message;
      }
      toast.error(errorMessage);
    } finally {
      setIsGeneratingThumbnail(false);
    }
  };

  if (isEditing) {
    return (
      <div className='space-y-4'>
        {/* Shot Thumbnail in Edit Mode */}
        <div className='flex items-center gap-4'>
          <div className='flex-shrink-0'>
            {shot.thumbnailUuid ? (
              <MediaDisplay 
                fileUuid={shot.thumbnailUuid} 
                className='h-20 w-20 rounded object-cover'
              />
            ) : (
              <div className='h-20 w-20 rounded bg-gray-100 flex items-center justify-center'>
                <FileImage className='h-10 w-10 text-gray-400' />
              </div>
            )}
          </div>
          
          <div className='flex-1'>
            <div className='grid grid-cols-2 gap-4'>
              <div>
                <Label htmlFor='edit-shot-title'>Title</Label>
                <Input
                  id='edit-shot-title'
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder='Enter shot title'
                  className='mt-1'
                />
              </div>
              <div>
                <Label htmlFor='edit-shot-sequence'>Sequence</Label>
                <Input
                  id='edit-shot-sequence'
                  value={shot.sequence}
                  disabled
                  className='mt-1 bg-gray-50'
                />
              </div>
            </div>
          </div>
        </div>
        
        <div>
          <Label htmlFor='edit-shot-description'>Description (Optional)</Label>
          <Textarea
            id='edit-shot-description'
            value={editDescription}
            onChange={(e) => setEditDescription(e.target.value)}
            placeholder='Enter shot description'
            className='mt-1'
            rows={3}
          />
        </div>

        <div className='flex gap-2'>
          <Button onClick={handleSave} disabled={!editTitle.trim() || isUpdating}>
            {isUpdating ? (
              <>
                <Loader2 className='h-4 w-4 mr-2 animate-spin' />
                Saving...
              </>
            ) : (
              <>
                <Save className='h-4 w-4 mr-2' />
                Save Changes
              </>
            )}
          </Button>
          <Button variant='outline' onClick={handleCancel} disabled={isUpdating}>
            <X className='h-4 w-4 mr-2' />
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className='space-y-4'>
      {/* Shot Thumbnail */}
      <div className='flex items-center gap-4'>
        <div className='flex-shrink-0'>
          {displayImageUuid ? (
            <MediaDisplay 
              fileUuid={displayImageUuid} 
              className='h-20 w-20 rounded object-cover'
            />
          ) : (
            <div className='h-20 w-20 rounded bg-gray-100 flex items-center justify-center'>
              <FileImage className='h-10 w-10 text-gray-400' />
            </div>
          )}
        </div>
        
        <div className='flex-1'>
          <div className='grid grid-cols-2 gap-4'>
            <div>
              <Label className='text-sm font-medium text-muted-foreground'>Title</Label>
              <p className='text-sm mt-1'>{shot.title}</p>
            </div>
            <div>
              <Label className='text-sm font-medium text-muted-foreground'>Sequence</Label>
              <p className='text-sm mt-1'>#{shot.sequence}</p>
            </div>
          </div>
        </div>
      </div>

      {shot.description && (
        <div>
          <Label className='text-sm font-medium text-muted-foreground'>Description</Label>
          <p className='text-sm mt-1 bg-gray-50 p-3 rounded whitespace-pre-wrap'>
            {shot.description}
          </p>
        </div>
      )}

      <div className='flex gap-2 flex-wrap'>
        <Button onClick={() => setIsEditing(true)} variant='outline' size='sm'>
          <Edit2 className='h-4 w-4 mr-2' />
          Edit Shot
        </Button>
        
        <Button 
          onClick={handleGenerateThumbnail}
          variant='outline' 
          size='sm'
          disabled={isGeneratingThumbnail}
          className='text-blue-600 hover:text-blue-700 hover:bg-blue-50'
        >
          {isGeneratingThumbnail ? (
            <>
              <Loader2 className='h-4 w-4 mr-2 animate-spin' />
              Generating...
            </>
          ) : (
            <>
              <ImageIcon className='h-4 w-4 mr-2' />
              {displayImageUuid ? 'Regenerate Thumbnail' : 'Generate Thumbnail'}
            </>
          )}
        </Button>
        
        <Button 
          onClick={handleDelete} 
          variant='outline' 
          size='sm'
          disabled={isDeleting}
          className='text-red-600 hover:text-red-700 hover:bg-red-50'
        >
          {isDeleting ? (
            <>
              <Loader2 className='h-4 w-4 mr-2 animate-spin' />
              Deleting...
            </>
          ) : (
            <>
              <Trash2 className='h-4 w-4 mr-2' />
              Delete Shot
            </>
          )}
        </Button>
      </div>

      {/* Delete Confirmation Dialog */}
      <ConfirmationDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="Delete Shot"
        description="Are you sure you want to delete this shot? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        variant="destructive"
        onConfirm={confirmDelete}
      />
    </div>
  );
}
