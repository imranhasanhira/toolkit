import React, { useState } from 'react';
import { Button } from '../../client/components/ui/button';
import { Input } from '../../client/components/ui/input';
import { Plus, MessageSquare, Trash2, Volume2, Edit, Clock } from 'lucide-react';
import type { Character, Dialog } from 'wasp/entities';
import { createDialog, deleteDialog, getDialogsByScene, updateDialog } from 'wasp/client/operations';
import { useQuery, useAction } from 'wasp/client/operations';
import { MediaDisplay } from './MediaDisplay';
import { ConfirmationDialog } from '../../client/components/ui/confirmation-dialog';
import toast from 'react-hot-toast';

interface SceneDetailsDialoguesProps {
  sceneId: string;
  currentCharacters: Character[];
}

export function SceneDetailsDialogues({ 
  sceneId, 
  currentCharacters
}: SceneDetailsDialoguesProps) {
  const [isAddingDialog, setIsAddingDialog] = useState(false);
  const [newDialogText, setNewDialogText] = useState('');
  const [selectedCharacterId, setSelectedCharacterId] = useState<string>('');
  const [newDialogStartTime, setNewDialogStartTime] = useState<string>('00:00.000');
  const [editingDialogId, setEditingDialogId] = useState<string | null>(null);
  const [editingDialogText, setEditingDialogText] = useState('');
  const [editingDialogStartTime, setEditingDialogStartTime] = useState<string>('00:00.000');
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [dialogToDelete, setDialogToDelete] = useState<string | null>(null);

  const createDialogFn = useAction(createDialog);
  const deleteDialogFn = useAction(deleteDialog);
  const updateDialogFn = useAction(updateDialog);

  // Fetch dialogs for the current scene
  const { data: sceneDialogs = [], refetch: refetchDialogs } = useQuery(getDialogsByScene, { sceneId });

  const handleAddDialog = async () => {
    if (!newDialogText.trim() || !selectedCharacterId || !newDialogStartTime.trim()) return;

    try {
      // Convert mm:ss.xxx format to milliseconds
      const startTimeMs = BigInt(parseTimeToMilliseconds(newDialogStartTime));

      await createDialogFn({
        sceneId,
        characterId: selectedCharacterId,
        text: newDialogText.trim(),
        startEpochMilliseconds: startTimeMs
      });
      
      setNewDialogText('');
      setSelectedCharacterId('');
      setNewDialogStartTime('00:00.000');
      setIsAddingDialog(false);
      refetchDialogs();
    } catch (error) {
      console.error('Error adding dialog to scene:', error);
      toast.error('Failed to add dialog to scene. Please try again.');
    }
  };

  const handleEditDialog = (dialog: Dialog) => {
    setEditingDialogId(dialog.id);
    setEditingDialogText(dialog.text);
    // Convert milliseconds back to mm:ss.xxx format
    setEditingDialogStartTime(formatMillisecondsToTime(Number(dialog.startEpochMilliseconds)));
  };

  const handleSaveEdit = async () => {
    if (!editingDialogId || !editingDialogText.trim() || !editingDialogStartTime.trim()) return;

    try {
      // Convert mm:ss.xxx format to milliseconds
      const startTimeMs = BigInt(parseTimeToMilliseconds(editingDialogStartTime));

      await updateDialogFn({
        id: editingDialogId,
        text: editingDialogText.trim(),
        startEpochMilliseconds: startTimeMs
      });
      
      setEditingDialogId(null);
      setEditingDialogText('');
      setEditingDialogStartTime('00:00.000');
      refetchDialogs();
    } catch (error) {
      console.error('Error updating dialog:', error);
      toast.error('Failed to update dialog. Please try again.');
    }
  };

  const handleCancelEdit = () => {
    setEditingDialogId(null);
    setEditingDialogText('');
    setEditingDialogStartTime('00:00.000');
  };

  const handleDeleteDialog = (dialogId: string) => {
    setDialogToDelete(dialogId);
    setDeleteConfirmOpen(true);
  };

  const confirmDeleteDialog = async () => {
    if (!dialogToDelete) return;
    try {
      await deleteDialogFn({ id: dialogToDelete });
      refetchDialogs();
      setDialogToDelete(null);
    } catch (error) {
      console.error('Error deleting dialog:', error);
      toast.error('Failed to delete dialog. Please try again.');
    }
  };

  const formatStartTime = (startEpochMilliseconds: bigint) => {
    return formatMillisecondsToTime(Number(startEpochMilliseconds));
  };

  // Convert mm:ss.xxx format to milliseconds
  const parseTimeToMilliseconds = (timeString: string): number => {
    const match = timeString.match(/^(\d{1,2}):(\d{2})\.(\d{3})$/);
    if (!match) {
      throw new Error('Invalid time format. Use mm:ss.xxx');
    }
    
    const minutes = parseInt(match[1], 10);
    const seconds = parseInt(match[2], 10);
    const milliseconds = parseInt(match[3], 10);
    
    return (minutes * 60 + seconds) * 1000 + milliseconds;
  };

  // Convert milliseconds to mm:ss.xxx format
  const formatMillisecondsToTime = (milliseconds: number): string => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const ms = milliseconds % 1000;
    
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
  };

  return (
    <div className='mb-4'>
      <h3 className='text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2'>
        <MessageSquare className='h-4 w-4' />
        Dialogs in Scene ({sceneDialogs.length})
      </h3>
      
      {/* Current Dialogs */}
      {sceneDialogs.length > 0 ? (
        <div className='flex flex-col gap-2 mb-3'>
          {sceneDialogs.map((dialog) => (
            <div
              key={dialog.id}
              className='flex items-center justify-between bg-gray-50 p-3 rounded-md text-sm'
            >
              {editingDialogId === dialog.id ? (
                // Edit mode
                <div className='flex-1 space-y-3'>
                  <div className='flex gap-2 items-center'>
                    <Input
                      value={editingDialogText}
                      onChange={(e) => setEditingDialogText(e.target.value)}
                      className='flex-1'
                      placeholder='Enter dialog text...'
                    />
                  </div>
                  <div className='flex gap-2 items-center'>
                    <Clock className='h-4 w-4 text-muted-foreground' />
                    <Input
                      type="text"
                      value={editingDialogStartTime}
                      onChange={(e) => setEditingDialogStartTime(e.target.value)}
                      className='flex-1'
                      placeholder='mm:ss.xxx'
                    />
                  </div>
                  <div className='flex gap-2'>
                    <Button onClick={handleSaveEdit} size='sm'>
                      Save
                    </Button>
                    <Button onClick={handleCancelEdit} variant='outline' size='sm'>Cancel</Button>
                  </div>
                </div>
              ) : (
                // Display mode
                <div className='flex-1'>
                  <div className='flex items-center gap-2 mb-2'>
                    <div className='flex items-center gap-1 text-xs text-muted-foreground'>
                      <Clock className='h-3 w-3' />
                      {formatStartTime(dialog.startEpochMilliseconds)}
                    </div>
                    <div className='font-medium text-blue-600'>
                      {currentCharacters.find(c => c.id === dialog.characterId)?.name || 'Unknown Character'}
                    </div>
                    <div className='flex-1'>
                      <MediaDisplay 
                        fileUuid={dialog.soundUuid} 
                        fileType="audio" 
                        className="w-32 h-8" 
                        fallbackText="No media"
                      />
                    </div>
                  </div>
                  <div className='text-gray-700 text-sm mb-2'>{dialog.text}</div>
                </div>
              )}
              
              {editingDialogId !== dialog.id && (
                <div className='flex gap-2 items-center'>
                  <Button
                    onClick={() => {/* TODO: Implement generate audio */}}
                    variant='outline'
                    size='sm'
                    className='text-xs'
                    title='Generate audio for this dialogue'
                  >
                    <Volume2 className='h-3 w-3 mr-1' />
                    Generate Audio
                  </Button>
                  <button
                    onClick={() => handleEditDialog(dialog)}
                    className='text-blue-600 hover:text-blue-800'
                    title='Edit dialog'
                  >
                    <Edit className='h-4 w-4' />
                  </button>
                  <button
                    onClick={() => handleDeleteDialog(dialog.id)}
                    className='text-red-600 hover:text-red-800'
                    title='Delete dialog'
                  >
                    <Trash2 className='h-4 w-4' />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className='text-sm text-muted-foreground mb-3'>No dialogs in this scene yet.</p>
      )}

      {/* Add Dialog */}
      {!isAddingDialog ? (
        <Button
          onClick={() => setIsAddingDialog(true)}
          variant='outline'
          size='sm'
          disabled={currentCharacters.length === 0}
        >
          <Plus className='h-4 w-4 mr-2' />
          Add Dialog
        </Button>
      ) : (
        <div className='space-y-3'>
          <div className='flex gap-2 items-center'>
            <select
              value={selectedCharacterId}
              onChange={(e) => setSelectedCharacterId(e.target.value)}
              className='flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm'
            >
              <option value=''>Select a character...</option>
              {currentCharacters.map((character) => (
                <option key={character.id} value={character.id}>
                  {character.name}
                </option>
              ))}
            </select>
          </div>
          <div className='flex gap-2 items-center'>
            <Input
              value={newDialogText}
              onChange={(e) => setNewDialogText(e.target.value)}
              placeholder='Enter dialog text...'
              className='flex-1'
            />
          </div>
          <div className='flex gap-2 items-center'>
            <Clock className='h-4 w-4 text-muted-foreground' />
            <Input
              type="text"
              value={newDialogStartTime}
              onChange={(e) => setNewDialogStartTime(e.target.value)}
              className='flex-1'
              placeholder='mm:ss.xxx'
            />
          </div>
          <div className='flex gap-2 items-center'>
            <Button
              onClick={handleAddDialog}
              size='sm'
              disabled={!newDialogText.trim() || !selectedCharacterId || !newDialogStartTime.trim()}
            >
              Add
            </Button>
            <Button
              onClick={() => {
                setIsAddingDialog(false);
                setNewDialogText('');
                setSelectedCharacterId('');
                setNewDialogStartTime('00:00.000');
              }}
              variant='outline'
              size='sm'
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
      
      {currentCharacters.length === 0 && (
        <p className='text-xs text-amber-600 mt-2'>
          💡 Add characters to this scene first to create dialogs.
        </p>
      )}

      {/* Delete Dialog Confirmation */}
      <ConfirmationDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="Delete Dialog"
        description="Are you sure you want to delete this dialog?"
        confirmText="Delete"
        cancelText="Cancel"
        variant="destructive"
        onConfirm={confirmDeleteDialog}
      />
    </div>
  );
}
