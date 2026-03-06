import React, { useState } from 'react';
import { createCharacter, deleteCharacter, updateCharacter, generateCharacterImage, enhanceCharacterDescriptionAI } from 'wasp/client/operations';
import { useAction } from 'wasp/client/operations';
import type { Character } from 'wasp/entities';
import { Button } from '../../client/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../client/components/ui/card';
import { Label } from '../../client/components/ui/label';
import { Input } from '../../client/components/ui/input';
import { Textarea } from '../../client/components/ui/textarea';
import { Loader2, Plus, Trash2, Edit2, Wand2, FileImage, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import { MediaDisplay } from './MediaDisplay';
import toast from 'react-hot-toast';

interface CharactersOverviewProps {
  projectId: string;
  characters: Character[];
  refetchCharacters: () => Promise<any>;
  editingCharacterId: string | null;
  setEditingCharacterId: (id: string | null) => void;
  editingCharacterName: string;
  setEditingCharacterName: (name: string) => void;
  editingCharacterDescription: string;
  setEditingCharacterDescription: (description: string) => void;
}

export function CharactersOverview({ 
  projectId, 
  characters, 
  refetchCharacters, 
  editingCharacterId, 
  setEditingCharacterId, 
  editingCharacterName, 
  setEditingCharacterName, 
  editingCharacterDescription, 
  setEditingCharacterDescription 
}: CharactersOverviewProps) {
  const [isAddingCharacter, setIsAddingCharacter] = useState(false);
  const [newCharacterName, setNewCharacterName] = useState('');
  const [newCharacterDescription, setNewCharacterDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [deletingCharacterId, setDeletingCharacterId] = useState<string | null>(null);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [lastAddedCharacterName, setLastAddedCharacterName] = useState<string>('');
  const [successMessageType, setSuccessMessageType] = useState<'add' | 'update'>('add');
  
  const createCharacterFn = createCharacter;
  const deleteCharacterFn = deleteCharacter;
  const updateCharacterFn = updateCharacter;
  const generateCharacterImageFn = useAction(generateCharacterImage);
  const enhanceCharacterDescriptionFn = useAction(enhanceCharacterDescriptionAI);
  
  // State for character image generation
  const [generatingImageForCharacterId, setGeneratingImageForCharacterId] = useState<string | null>(null);
  const [enhancingDescriptionForCharacterId, setEnhancingDescriptionForCharacterId] = useState<string | null>(null);
  const [expandedDescriptions, setExpandedDescriptions] = useState<Set<string>>(new Set());

  const handleAddCharacter = async () => {
    if (!newCharacterName.trim()) return;
    
    setIsSubmitting(true);
    
    try {
      // Get the next serial number for this project
      // Find the highest serial number and add 1, or start with 1 if no characters exist
      const nextSerial = characters.length > 0 
        ? Math.max(...characters.map(c => c.serial)) + 1 
        : 1;
      
      await createCharacterFn({
        projectId,
        name: newCharacterName.trim(),
        description: newCharacterDescription.trim() || undefined,
        serial: nextSerial
      });
      
      setNewCharacterName('');
      setNewCharacterDescription('');
      setIsAddingCharacter(false);
      
      // Manually refetch the characters to ensure immediate update
      await refetchCharacters();
      
      // Show success message
      setShowSuccessMessage(true);
      setLastAddedCharacterName(newCharacterName.trim());
      setSuccessMessageType('add');
      setTimeout(() => setShowSuccessMessage(false), 3000);
    } catch (error) {
      console.error('Error adding character:', error);
      toast.error('Failed to create character. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCharacter = async (characterId: string) => {
    if (!confirm('Are you sure you want to delete this character? This action cannot be undone.')) {
      return;
    }
    
    setDeletingCharacterId(characterId);
    
    try {
      await deleteCharacterFn({ id: characterId });
      // Manually refetch the characters to ensure immediate update
      await refetchCharacters();
    } catch (error) {
      console.error('Error deleting character:', error);
      toast.error('Failed to delete character. Please try again.');
    } finally {
      setDeletingCharacterId(null);
    }
  };

  const handleGenerateCharacterImage = async (characterId: string) => {
    setGeneratingImageForCharacterId(characterId);
    
    try {
      const result = await generateCharacterImageFn({ characterId });
      
      // Show success message
      toast.success(`Character image generation started! Status: ${result.status}`);
      
      // Refresh characters to show the new image UUID
      await refetchCharacters();
    } catch (error) {
      console.error('Error generating character image:', error);
      toast.error('Failed to generate character image. Please try again.');
    } finally {
      setGeneratingImageForCharacterId(null);
    }
  };

  const handleEnhanceCharacterDescription = async (characterId: string) => {
    setEnhancingDescriptionForCharacterId(characterId);
    
    try {
      const character = characters.find(c => c.id === characterId);
      if (!character || !character.description || character.description.trim().length === 0) {
        toast.error('Character must have a description to enhance');
        return;
      }
      
      const result = await enhanceCharacterDescriptionFn({
        projectId,
        characterId,
        prompt: 'Please enhance this character description with more visual details for better image generation'
      });
      
      // Update the character description with the enhanced version
      await updateCharacterFn({
        id: characterId,
        name: character.name,
        description: result.enhancedDescription
      });
      
      // Refresh characters to show the updated description
      await refetchCharacters();
      
      // Show success message
      toast.success('Character description enhanced successfully!');
    } catch (error) {
      console.error('Error enhancing character description:', error);
      toast.error('Failed to enhance character description. Please try again.');
    } finally {
      setEnhancingDescriptionForCharacterId(null);
    }
  };

  const handleEditCharacter = async () => {
    if (!editingCharacterId || !editingCharacterName.trim()) return;
    
    setIsUpdating(true);
    
    try {
      await updateCharacterFn({
        id: editingCharacterId,
        name: editingCharacterName.trim(),
        description: editingCharacterDescription.trim() || undefined
      });
      
      setEditingCharacterId(null);
      setEditingCharacterName('');
      setEditingCharacterDescription('');
      
      await refetchCharacters();
      
      setShowSuccessMessage(true);
      setLastAddedCharacterName(editingCharacterName.trim());
      setSuccessMessageType('update');
      setTimeout(() => setShowSuccessMessage(false), 3000);
    } catch (error) {
      console.error('Error updating character:', error);
      toast.error('Failed to update character. Please try again.');
    } finally {
      setIsUpdating(false);
    }
  };

  const startEditing = (character: Character) => {
    setEditingCharacterId(character.id);
    setEditingCharacterName(character.name);
    setEditingCharacterDescription(character.description || '');
  };

  const cancelEditing = () => {
    setEditingCharacterId(null);
    setEditingCharacterName('');
    setEditingCharacterDescription('');
  };

  const toggleDescriptionExpansion = (characterId: string) => {
    setExpandedDescriptions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(characterId)) {
        newSet.delete(characterId);
      } else {
        newSet.add(characterId);
      }
      return newSet;
    });
  };

  const truncateText = (text: string, maxLength: number = 100) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength).trim() + '...';
  };

  return (
    <div>
      <div className='flex justify-between items-center mb-4'>
        <h2 className='text-2xl font-bold'>Characters</h2>
        <Button onClick={() => setIsAddingCharacter(true)}>
          <Plus className='h-4 w-4 mr-2' />
          Add Character
        </Button>
      </div>

      {/* Add Character Form */}
      {isAddingCharacter && (
        <Card className='mb-6 p-4'>
          <div className='space-y-4'>
            <div>
              <Label htmlFor='characterName'>Character Name</Label>
              <Input
                id='characterName'
                value={newCharacterName}
                onChange={(e) => setNewCharacterName(e.target.value)}
                placeholder='Enter character name'
                className='mt-1'
              />
            </div>
            <div>
              <Label htmlFor='characterDescription'>Description (Optional)</Label>
              <Textarea
                id='characterDescription'
                value={newCharacterDescription}
                onChange={(e) => setNewCharacterDescription(e.target.value)}
                placeholder='Enter character description'
                className='mt-1'
              />
            </div>
            <div className='flex gap-2'>
              <Button onClick={handleAddCharacter} disabled={!newCharacterName.trim() || isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className='h-4 w-4 mr-2 animate-spin' />
                    Adding...
                  </>
                ) : (
                  'Add Character'
                )}
              </Button>
              <Button variant='outline' onClick={() => setIsAddingCharacter(false)} disabled={isSubmitting}>
                Cancel
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Success Message */}
      {showSuccessMessage && (
        <div className='mb-4 p-4 bg-green-50 border border-green-200 rounded-md'>
          <div className='flex items-center'>
            <div className='flex-shrink-0'>
              <svg className='h-5 w-5 text-green-400' viewBox='0 0 20 20' fill='currentColor'>
                <path fillRule='evenodd' d='M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z' clipRule='evenodd' />
              </svg>
            </div>
            <div className='ml-3'>
              <p className='text-sm font-medium text-green-800'>
                {successMessageType === 'add' ? `Character "${lastAddedCharacterName || 'Character'}" added successfully!` : `Character "${lastAddedCharacterName || 'Character'}" updated successfully!`}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Characters Grid */}
      <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
        {characters.map((character) => (
          <Card key={character.id}>
            {editingCharacterId === character.id ? (
              // Edit Form
              <CardContent className='pt-6'>
                <div className='space-y-4'>
                  <div>
                    <Label htmlFor={`edit-character-name-${character.id}`}>Name</Label>
                    <Input
                      id={`edit-character-name-${character.id}`}
                      value={editingCharacterName}
                      onChange={(e) => setEditingCharacterName(e.target.value)}
                      placeholder='Enter character name'
                      className='mt-1'
                    />
                  </div>
                  <div>
                    <Label htmlFor={`edit-character-description-${character.id}`}>Description (Optional)</Label>
                    <Textarea
                      id={`edit-character-description-${character.id}`}
                      value={editingCharacterDescription}
                      onChange={(e) => setEditingCharacterDescription(e.target.value)}
                      placeholder='Enter character description'
                      className='mt-1'
                    />
                  </div>
                  <div className='flex gap-2'>
                    <Button onClick={handleEditCharacter} disabled={!editingCharacterName.trim() || isUpdating}>
                      {isUpdating ? (
                        <>
                          <Loader2 className='h-4 w-4 mr-2 animate-spin' />
                          Updating...
                        </>
                      ) : (
                        'Update Character'
                      )}
                    </Button>
                    <Button variant='outline' onClick={cancelEditing} disabled={isUpdating}>
                      Cancel
                    </Button>
                  </div>
                </div>
              </CardContent>
            ) : (
              // Normal Display
              <>
                <CardHeader>
                  <CardTitle className='flex items-center justify-between'>
                    <span>{character.name}</span>
                    <div className='flex gap-2'>
                      <Button 
                        variant='ghost' 
                        size='sm'
                        onClick={() => startEditing(character)}
                      >
                        <Edit2 className='h-4 w-4' />
                      </Button>
                      <Button 
                        variant='ghost' 
                        size='sm' 
                        className='text-destructive'
                        onClick={() => handleDeleteCharacter(character.id)}
                        disabled={deletingCharacterId === character.id}
                      >
                        {deletingCharacterId === character.id ? (
                          <Loader2 className='h-4 w-4 animate-spin' />
                        ) : (
                          <Trash2 className='h-4 w-4' />
                        )}
                      </Button>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {/* Character Image */}
                  <div className='mb-4'>
                    <MediaDisplay
                      fileUuid={character.finalImageUuid}
                      alt={`${character.name} character image`}
                      className="w-full h-32 rounded-lg overflow-hidden object-cover"
                      fallbackIcon={<FileImage className="h-12 w-12 text-muted-foreground mx-auto" />}
                    />
                  </div>
                  
                  {character.description && (
                    <div className='mb-2'>
                      <p className='text-sm text-muted-foreground'>
                        {expandedDescriptions.has(character.id) 
                          ? character.description 
                          : truncateText(character.description)
                        }
                      </p>
                      {character.description.length > 100 && (
                        <button
                          onClick={() => toggleDescriptionExpansion(character.id)}
                          className='text-xs text-blue-600 hover:text-blue-800 mt-1 flex items-center gap-1'
                        >
                          {expandedDescriptions.has(character.id) ? (
                            <>
                              <ChevronUp className='h-3 w-3' />
                              See less
                            </>
                          ) : (
                            <>
                              <ChevronDown className='h-3 w-3' />
                              See more
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  )}
                  <div className='flex gap-2'>
                    <Button 
                      variant='outline' 
                      size='sm'
                      onClick={() => handleEnhanceCharacterDescription(character.id)}
                      disabled={enhancingDescriptionForCharacterId === character.id || !character.description || character.description.trim().length === 0}
                    >
                      {enhancingDescriptionForCharacterId === character.id ? (
                        <>
                          <Loader2 className='h-4 w-4 mr-2 animate-spin' />
                          Enhancing...
                        </>
                      ) : (
                        <>
                          <Sparkles className='h-4 w-4 mr-2' />
                          Enhance Description
                        </>
                      )}
                    </Button>
                    <Button 
                      variant='outline' 
                      size='sm'
                      onClick={() => handleGenerateCharacterImage(character.id)}
                      disabled={generatingImageForCharacterId === character.id}
                    >
                      {generatingImageForCharacterId === character.id ? (
                        <>
                          <Loader2 className='h-4 w-4 mr-2 animate-spin' />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Wand2 className='h-4 w-4 mr-2' />
                          Generate Image
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
