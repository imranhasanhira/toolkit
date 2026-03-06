import React, { useState } from 'react';
import { Button } from '../../client/components/ui/button';
import { Input } from '../../client/components/ui/input';
import { Label } from '../../client/components/ui/label';
import { Textarea } from '../../client/components/ui/textarea';
import { Save, X, Loader2 } from 'lucide-react';
import { createShot } from 'wasp/client/operations';
import type { Shot } from 'wasp/entities';
import toast from 'react-hot-toast';

interface ShotCreationFormProps {
  sceneId: string;
  nextSequence: number;
  onShotCreated: (newShot: Shot) => void;
  onCancel: () => void;
}

export function ShotCreationForm({ 
  sceneId, 
  nextSequence, 
  onShotCreated, 
  onCancel 
}: ShotCreationFormProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim()) return;

    setIsCreating(true);
    try {
      const newShot = await createShot({
        sceneId,
        title: title.trim(),
        description: description.trim() || undefined,
        sequence: nextSequence
      });
      
      setTitle('');
      setDescription('');
      onShotCreated(newShot);
    } catch (error) {
      console.error('Error creating shot:', error);
      toast.error('Failed to create shot. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className='space-y-4'>
      <div className='grid grid-cols-2 gap-4'>
        <div>
          <Label htmlFor='shot-title'>Title *</Label>
          <Input
            id='shot-title'
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder='Enter shot title'
            className='mt-1'
            required
          />
        </div>
        <div>
          <Label htmlFor='shot-sequence'>Sequence</Label>
          <Input
            id='shot-sequence'
            value={nextSequence}
            disabled
            className='mt-1 bg-gray-50'
          />
        </div>
      </div>
      
      <div>
        <Label htmlFor='shot-description'>Description (Optional)</Label>
        <Textarea
          id='shot-description'
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder='Enter shot description'
          className='mt-1'
          rows={3}
        />
      </div>

      <div className='flex gap-2'>
        <Button type='submit' disabled={!title.trim() || isCreating}>
          {isCreating ? (
            <>
              <Loader2 className='h-4 w-4 mr-2 animate-spin' />
              Creating...
            </>
          ) : (
            <>
              <Save className='h-4 w-4 mr-2' />
              Create Shot
            </>
          )}
        </Button>
        <Button type='button' variant='outline' onClick={onCancel} disabled={isCreating}>
          <X className='h-4 w-4 mr-2' />
          Cancel
        </Button>
      </div>
    </form>
  );
}
