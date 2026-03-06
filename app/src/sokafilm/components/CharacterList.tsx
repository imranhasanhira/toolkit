import React, { useState } from 'react';
import { Button } from '../../client/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../client/components/ui/card';
import { Checkbox } from '../../client/components/ui/checkbox';
import { Label } from '../../client/components/ui/label';
import { Textarea } from '../../client/components/ui/textarea';
import { X, Plus, User, Pencil, Check, ChevronDown, ChevronUp, Loader2, ImageIcon, Sparkles } from 'lucide-react';
import type { Character } from 'wasp/entities';
import { MediaDisplay } from './MediaDisplay';
import { ConfirmationDialog } from '../../client/components/ui/confirmation-dialog';

// Extended character type that includes story-specific fields
export interface StoryCharacterData extends Character {
  storyCharacterId?: string;
  customDescription?: string | null;
  customImageUuid?: string | null;
}

interface CharacterListProps {
  title: string;
  currentCharacters: StoryCharacterData[];
  availableCharacters: Character[];
  onAddCharacters: (characterIds: string[]) => Promise<void>;
  onRemoveCharacter: (characterId: string) => Promise<void>;
  onUpdateCustomDescription?: (storyCharacterId: string, customDescription: string | null) => Promise<void>;
  onGenerateStoryCharacterImage?: (storyCharacterId: string) => Promise<void>;
  isLoading?: boolean;
  emptyMessage?: string;
}

export function CharacterList({
  title,
  currentCharacters,
  availableCharacters,
  onAddCharacters,
  onRemoveCharacter,
  onUpdateCustomDescription,
  onGenerateStoryCharacterImage,
  isLoading = false,
  emptyMessage = 'No characters assigned yet.'
}: CharacterListProps) {
  const [isCharacterDialogOpen, setIsCharacterDialogOpen] = useState(false);
  const [isManagingCharacters, setIsManagingCharacters] = useState(false);
  const [removeConfirmOpen, setRemoveConfirmOpen] = useState(false);
  const [characterToRemove, setCharacterToRemove] = useState<string | null>(null);
  const [expandedCharacterId, setExpandedCharacterId] = useState<string | null>(null);
  const [editingCustomDesc, setEditingCustomDesc] = useState<string | null>(null);
  const [customDescValue, setCustomDescValue] = useState('');
  const [isSavingCustomDesc, setIsSavingCustomDesc] = useState(false);
  const [generatingImageFor, setGeneratingImageFor] = useState<string | null>(null);

  const handleAddCharacters = async (characterIds: string[]) => {
    if (characterIds.length === 0) return;

    setIsManagingCharacters(true);
    try {
      await onAddCharacters(characterIds);
    } catch (error) {
      console.error('Error adding characters:', error);
    } finally {
      setIsManagingCharacters(false);
    }
  };

  const handleRemoveCharacter = (characterId: string) => {
    setCharacterToRemove(characterId);
    setRemoveConfirmOpen(true);
  };

  const confirmRemoveCharacter = async () => {
    if (!characterToRemove) return;
    try {
      await onRemoveCharacter(characterToRemove);
      setCharacterToRemove(null);
    } catch (error) {
      console.error('Error removing character:', error);
    }
  };

  return (
    <div className='mb-4'>
      <div className='flex items-center justify-between mb-2'>
        <h3 className='text-sm font-medium text-muted-foreground flex items-center gap-2'>
          {title} ({currentCharacters.length})
        </h3>
        <Button 
          onClick={() => setIsCharacterDialogOpen(true)} 
          variant='outline' 
          size='sm'
          disabled={isManagingCharacters || availableCharacters.length === 0}
        >
          <Plus className='h-4 w-4 mr-2' />
          Add Characters
        </Button>
      </div>
      
      {/* Current Characters */}
      {isLoading ? (
        <div className='text-sm text-muted-foreground'>Loading characters...</div>
      ) : currentCharacters.length === 0 ? (
        <div className='text-sm text-muted-foreground bg-gray-50 p-3 rounded'>
          {emptyMessage}
        </div>
      ) : (
        <div className='flex flex-col gap-1'>
          {currentCharacters.map((character) => {
            const isExpanded = expandedCharacterId === character.id;
            const isEditing = editingCustomDesc === character.id;
            const hasCustomDesc = !!character.customDescription;

            return (
              <div key={character.id} className='border rounded-lg overflow-hidden'>
                {/* Compact row */}
                <div className='flex items-center gap-2 px-3 py-1.5 bg-white hover:bg-gray-50'>
                  {/* Character Image: story image first, then base image fallback */}
                  <div className='flex-shrink-0'>
                    {(character.customImageUuid || character.finalImageUuid) ? (
                      <MediaDisplay 
                        fileUuid={character.customImageUuid || character.finalImageUuid!} 
                        className='h-6 w-6 rounded object-cover'
                      />
                    ) : (
                      <div className='h-6 w-6 rounded bg-blue-100 flex items-center justify-center'>
                        <User className='h-3.5 w-3.5 text-blue-600' />
                      </div>
                    )}
                  </div>
                  
                  <button 
                    className='flex-1 text-left flex items-center gap-1.5 min-w-0'
                    onClick={() => setExpandedCharacterId(isExpanded ? null : character.id)}
                  >
                    <span className='text-sm font-medium truncate'>{character.name}</span>
                    {hasCustomDesc && (
                      <span className='text-xs text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded flex-shrink-0'>customised</span>
                    )}
                    {isExpanded ? <ChevronUp className='h-3 w-3 text-muted-foreground flex-shrink-0' /> : <ChevronDown className='h-3 w-3 text-muted-foreground flex-shrink-0' />}
                  </button>
                  
                  <Button
                    variant='ghost'
                    size='sm'
                    onClick={() => handleRemoveCharacter(character.id)}
                    disabled={isManagingCharacters}
                    className='h-6 w-6 p-0 hover:bg-red-50 text-muted-foreground hover:text-red-600 flex-shrink-0'
                  >
                    <X className='h-3 w-3' />
                  </Button>
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className='px-3 py-2 border-t bg-gray-50 space-y-2'>
                    {/* Images row: base image + story image side by side */}
                    {character.storyCharacterId && (
                      <div className='flex gap-3'>
                        {/* Base character image */}
                        <div className='flex-1'>
                          <p className='text-xs font-medium text-muted-foreground mb-1'>Base Image</p>
                          <div className='w-full aspect-square max-w-[120px]'>
                            <MediaDisplay 
                              fileUuid={character.finalImageUuid} 
                              fileType='image'
                              className='w-full h-full rounded-lg object-cover'
                              fallbackText='No base image'
                            />
                          </div>
                        </div>

                        {/* Story character image */}
                        <div className='flex-1'>
                          <p className='text-xs font-medium text-purple-700 mb-1'>Story Image</p>
                          <div className='w-full aspect-square max-w-[120px]'>
                            {character.customImageUuid ? (
                              <MediaDisplay 
                                fileUuid={character.customImageUuid} 
                                fileType='image'
                                className='w-full h-full rounded-lg object-cover'
                              />
                            ) : (
                              <div className='w-full h-full rounded-lg bg-purple-50 border border-dashed border-purple-200 flex items-center justify-center'>
                                <ImageIcon className='h-6 w-6 text-purple-300' />
                              </div>
                            )}
                          </div>
                          {onGenerateStoryCharacterImage && (
                            <Button
                              variant='outline'
                              size='sm'
                              className='mt-1.5 h-6 text-xs px-2 w-full max-w-[120px]'
                              disabled={generatingImageFor === character.storyCharacterId || !hasCustomDesc}
                              title={!hasCustomDesc ? 'Add a story customisation first' : undefined}
                              onClick={async () => {
                                if (!hasCustomDesc) return;
                                setGeneratingImageFor(character.storyCharacterId!);
                                try {
                                  await onGenerateStoryCharacterImage(character.storyCharacterId!);
                                } finally {
                                  setGeneratingImageFor(null);
                                }
                              }}
                            >
                              {generatingImageFor === character.storyCharacterId ? (
                                <Loader2 className='h-3 w-3 animate-spin mr-1' />
                              ) : (
                                <Sparkles className='h-3 w-3 mr-1' />
                              )}
                              {character.customImageUuid ? 'Regenerate' : 'Generate'}
                            </Button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Base description from project character */}
                    {character.description && (
                      <div>
                        <p className='text-xs font-medium text-muted-foreground mb-0.5'>Base Description</p>
                        <p className='text-xs text-foreground'>{character.description}</p>
                      </div>
                    )}

                    {/* Story customisation */}
                    {character.storyCharacterId && onUpdateCustomDescription && (
                      <div>
                        <div className='flex items-center justify-between mb-0.5'>
                          <p className='text-xs font-medium text-purple-700'>Story Customisation</p>
                          {!isEditing && (
                            <Button
                              variant='ghost'
                              size='sm'
                              className='h-5 px-1.5 text-xs text-muted-foreground hover:text-foreground'
                              onClick={() => {
                                setEditingCustomDesc(character.id);
                                setCustomDescValue(character.customDescription || '');
                              }}
                            >
                              <Pencil className='h-3 w-3 mr-1' />
                              {hasCustomDesc ? 'Edit' : 'Add'}
                            </Button>
                          )}
                        </div>

                        {isEditing ? (
                          <div className='space-y-1.5'>
                            <Textarea
                              value={customDescValue}
                              onChange={(e) => setCustomDescValue(e.target.value)}
                              placeholder='Describe how this character differs in this story (e.g. older version, different costume, etc.)'
                              className='text-xs min-h-[60px] resize-none'
                              autoFocus
                            />
                            <div className='flex gap-1.5'>
                              <Button
                                size='sm'
                                className='h-6 text-xs px-2'
                                disabled={isSavingCustomDesc}
                                onClick={async () => {
                                  setIsSavingCustomDesc(true);
                                  try {
                                    await onUpdateCustomDescription(
                                      character.storyCharacterId!,
                                      customDescValue.trim() || null
                                    );
                                    setEditingCustomDesc(null);
                                  } catch (error) {
                                    console.error('Error saving customisation:', error);
                                  } finally {
                                    setIsSavingCustomDesc(false);
                                  }
                                }}
                              >
                                {isSavingCustomDesc ? <Loader2 className='h-3 w-3 animate-spin' /> : <Check className='h-3 w-3 mr-1' />}
                                Save
                              </Button>
                              <Button
                                variant='outline'
                                size='sm'
                                className='h-6 text-xs px-2'
                                disabled={isSavingCustomDesc}
                                onClick={() => setEditingCustomDesc(null)}
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : hasCustomDesc ? (
                          <p className='text-xs text-foreground bg-purple-50 p-1.5 rounded'>{character.customDescription}</p>
                        ) : (
                          <p className='text-xs text-muted-foreground italic'>No story-specific customisation yet.</p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Character Selection Dialog */}
      <CharacterSelectionDialog
        isOpen={isCharacterDialogOpen}
        onClose={() => setIsCharacterDialogOpen(false)}
        onConfirm={handleAddCharacters}
        availableCharacters={availableCharacters}
        selectedCharacterIds={[]}
        title={`Add Characters to ${title}`}
      />

      {/* Remove Character Confirmation Dialog */}
      <ConfirmationDialog
        open={removeConfirmOpen}
        onOpenChange={setRemoveConfirmOpen}
        title="Remove Character"
        description="Are you sure you want to remove this character?"
        confirmText="Remove"
        cancelText="Cancel"
        variant="destructive"
        onConfirm={confirmRemoveCharacter}
      />
    </div>
  );
}

// Character Selection Dialog Component
interface CharacterSelectionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (characterIds: string[]) => void;
  availableCharacters: Character[];
  selectedCharacterIds: string[];
  title?: string;
}

function CharacterSelectionDialog({
  isOpen,
  onClose,
  onConfirm,
  availableCharacters,
  selectedCharacterIds,
  title = 'Select Characters'
}: CharacterSelectionDialogProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>(selectedCharacterIds);

  const handleToggleCharacter = (characterId: string) => {
    setSelectedIds(prev => 
      prev.includes(characterId)
        ? prev.filter(id => id !== characterId)
        : [...prev, characterId]
    );
  };

  const handleConfirm = () => {
    onConfirm(selectedIds);
    onClose();
  };

  const handleClose = () => {
    setSelectedIds(selectedCharacterIds); // Reset to original selection
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <Card className="w-full max-w-md mx-4">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-lg font-semibold">{title}</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClose}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="max-h-64 overflow-y-auto space-y-3">
            {availableCharacters.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                No characters available to add.
              </p>
            ) : (
              availableCharacters.map((character) => (
                <div key={character.id} className="flex items-center space-x-3">
                  <Checkbox
                    id={character.id}
                    checked={selectedIds.includes(character.id)}
                    onCheckedChange={() => handleToggleCharacter(character.id)}
                  />
                  
                  {/* Character Image */}
                  <div className='flex-shrink-0'>
                    {character.finalImageUuid ? (
                      <MediaDisplay 
                        fileUuid={character.finalImageUuid} 
                        className='h-8 w-8 rounded object-cover'
                      />
                    ) : (
                      <div className='h-8 w-8 rounded bg-gray-200 flex items-center justify-center'>
                        <User className='h-4 w-4 text-gray-500' />
                      </div>
                    )}
                  </div>
                  
                  <Label
                    htmlFor={character.id}
                    className="flex-1 cursor-pointer hover:text-foreground"
                  >
                    <div className="font-medium">{character.name}</div>
                    {character.description && (
                      <div className="text-sm text-muted-foreground">
                        {character.description}
                      </div>
                    )}
                  </Label>
                </div>
              ))
            )}
          </div>
          
          <div className="flex justify-end space-x-2 pt-4 border-t">
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button onClick={handleConfirm} disabled={selectedIds.length === 0}>
              <Plus className="h-4 w-4 mr-2" />
              Add Selected ({selectedIds.length})
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
