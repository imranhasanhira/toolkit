import React, { useState } from 'react';
import { Button } from '../../client/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../client/components/ui/card';
import { Plus, Film, FileImage, ImageIcon, Video } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Shot } from 'wasp/entities';
import { getFileByUuid } from 'wasp/client/operations';
import { ShotDetails } from './ShotDetails';
import { ShotCreationForm } from './ShotCreationForm';
import { MediaDisplay } from './MediaDisplay';

export interface SceneContextForCopy {
  sceneTitle?: string;
  sceneDescription?: string;
  overviewImageUuid?: string | null;
  /** Story custom image by characterId; used with shot characters for copy */
  storyCharacterImageByCharacterId?: Record<string, string | null>;
  /** Fallback characters from scene if shot has none */
  sceneCharacters?: Array<{ characterId: string; character: { name: string; finalImageUuid?: string | null } }>;
}

interface SceneShotsProps {
  sceneId: string;
  shots: Shot[];
  aspectRatioId?: string | null;
  onShotsChange: () => void;
  sceneContext?: SceneContextForCopy;
}

export function SceneShots({ sceneId, shots, aspectRatioId, onShotsChange, sceneContext }: SceneShotsProps) {
  const [selectedShot, setSelectedShot] = useState<Shot | null>(null);
  const [isCreatingShot, setIsCreatingShot] = useState(false);
  const [insertionSequence, setInsertionSequence] = useState<number>(1);
  const [localShots, setLocalShots] = useState<Shot[]>(shots);

  // Add custom styles for horizontal scrolling
  React.useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      .shots-card {
        max-width: 100%;
        overflow: hidden;
      }
      .shots-container {
        max-width: 100%;
        overflow: hidden;
        position: relative;
      }
      .shots-scrollable {
        max-width: 100%;
        width: 100%;
        scrollbar-width: thin;
        scrollbar-color: #cbd5e1 #f1f5f9;
        scroll-behavior: smooth;
        /* Ensure content doesn't overflow the container */
        min-width: 0;
        flex-wrap: nowrap;
        /* Prevent horizontal page scroll */
        overflow-x: auto;
        overflow-y: hidden;
        /* Ensure the container doesn't expand beyond its parent */
        box-sizing: border-box;
      }
      /* Ensure the page doesn't scroll horizontally */
      .shots-component {
        max-width: 100%;
        overflow-x: hidden;
        width: 100%;
      }
      /* Additional constraints for the card */
      .shots-card .card-content {
        max-width: 100%;
        overflow: hidden;
      }
      .shots-scrollable::-webkit-scrollbar {
        height: 6px;
      }
      .shots-scrollable::-webkit-scrollbar-track {
        background: #f1f5f9;
        border-radius: 3px;
      }
      .shots-scrollable::-webkit-scrollbar-thumb {
        background: #cbd5e1;
        border-radius: 3px;
      }
      .shots-scrollable::-webkit-scrollbar-thumb:hover {
        background: #94a3b8;
      }
      @media (prefers-color-scheme: dark) {
        .shots-scrollable {
          scrollbar-color: #475569 #1e293b;
        }
        .shots-scrollable::-webkit-scrollbar-track {
          background: #1e293b;
        }
        .shots-scrollable::-webkit-scrollbar-thumb {
          background: #475569;
        }
        .shots-scrollable::-webkit-scrollbar-thumb:hover {
          background: #64748b;
        }
      }
    `;
    document.head.appendChild(style);

    return () => {
      document.head.removeChild(style);
    };
  }, []);

  // Always ensure shots are sorted by sequence for display
  const sortedShots = React.useMemo(() => {
    return [...localShots].sort((a, b) => a.sequence - b.sequence);
  }, [localShots]);

  // Update local shots when props change
  React.useEffect(() => {
    // Sort shots by sequence to ensure proper order
    const sortedShots = [...shots].sort((a, b) => a.sequence - b.sequence);
    setLocalShots(sortedShots);
  }, [shots]);

  const handleShotClick = (shot: Shot) => {
    setSelectedShot(shot);
    setIsCreatingShot(false);
  };

  const handleAddShotClick = (sequence?: number) => {
    setSelectedShot(null);
    setIsCreatingShot(true);
    // If sequence is provided, use it; otherwise default to end
    setInsertionSequence(sequence || sortedShots.length + 1);
  };

  const handleShotCreated = (newShot: Shot) => {
    setIsCreatingShot(false);
    setSelectedShot(newShot);
    // Add the new shot to local state immediately and sort
    setLocalShots(prevShots => {
      const updatedShots = [...prevShots, newShot];
      return updatedShots.sort((a, b) => a.sequence - b.sequence);
    });
    // Also trigger the parent refresh
    onShotsChange();
  };

  const handleShotUpdated = (updatedShot: Shot) => {
    // Update the shot in local state immediately and sort
    setLocalShots(prevShots => {
      const updatedShots = prevShots.map(shot =>
        shot.id === updatedShot.id ? updatedShot : shot
      );
      return updatedShots.sort((a, b) => a.sequence - b.sequence);
    });
    // Also update the selected shot if it's the one being updated
    if (selectedShot && selectedShot.id === updatedShot.id) {
      setSelectedShot(updatedShot);
    }
    // Also trigger the parent refresh
    onShotsChange();
  };

  const handleShotDeleted = (deletedShotId?: string) => {
    if (selectedShot) {
      // Remove the deleted shot from local state immediately and sort
      const shotIdToRemove = deletedShotId || selectedShot.id;
      setLocalShots(prevShots => {
        const updatedShots = prevShots.filter(shot => shot.id !== shotIdToRemove);
        return updatedShots.sort((a, b) => a.sequence - b.sequence);
      });
      setSelectedShot(null);
    }
    // Trigger the parent refresh to get updated sequences from database
    onShotsChange();
  };

  // Display image UUID for selected shot (for copy motion = shot base image)
  const getDisplayImageUuid = (shot: Shot): string | null => {
    if (aspectRatioId && (shot as any).shotImages) {
      const matchingImage = (shot as any).shotImages.find(
        (si: any) => si.aspectRatioId === aspectRatioId
      );
      if (matchingImage) return matchingImage.imageUuid;
    }
    return shot.thumbnailUuid;
  };

  const fetchImageBlob = async (uuid: string): Promise<Blob | null> => {
    try {
      const file = await getFileByUuid({ uuid }) as { fileUrl?: string } | null;
      if (!file?.fileUrl) return null;
      const url = file.fileUrl.startsWith('http') ? file.fileUrl : `${window.location.origin}${file.fileUrl}`;
      const res = await fetch(url);
      if (!res.ok) return null;
      return await res.blob();
    } catch {
      return null;
    }
  };

  const imageBlobToClipboardType = (blob: Blob): string => {
    if (blob.type && blob.type.startsWith('image/')) return blob.type;
    return 'image/png';
  };



  const handleCopyImagePrompt = async () => {
    if (!selectedShot || !sceneContext) return;

    // 1. Gather all blobs and text parts
    const textParts: string[] = [];
    const imageBlobs: Array<{ blob: Blob, type: string, label: string }> = [];

    try {
      // Scene Overview Image
      if (sceneContext.overviewImageUuid) {
        const blob = await fetchImageBlob(sceneContext.overviewImageUuid);
        if (blob && blob.size > 0) {
          imageBlobs.push({
            blob,
            type: imageBlobToClipboardType(blob),
            label: 'Scene image'
          });
        }
        textParts.push('[Scene image]');
      }

      // Character Images
      let shotChars = (selectedShot as any).shotCharacters as Array<{ characterId: string; character: { name: string; finalImageUuid?: string | null } }> | undefined;

      // Fallback: If shot has no explicit characters, use all characters in the scene
      if ((!shotChars || shotChars.length === 0) && sceneContext.sceneCharacters && sceneContext.sceneCharacters.length > 0) {
        shotChars = sceneContext.sceneCharacters;
      }

      if (shotChars?.length) {
        const storyMap = sceneContext.storyCharacterImageByCharacterId;
        for (const sc of shotChars) {
          const imageUuid = (storyMap && storyMap[sc.characterId] != null ? storyMap[sc.characterId] : null) ?? sc.character?.finalImageUuid ?? null;
          if (imageUuid) {
            const blob = await fetchImageBlob(imageUuid);
            if (blob && blob.size > 0) {
              imageBlobs.push({
                blob,
                type: imageBlobToClipboardType(blob),
                label: `Character: ${sc.character?.name ?? 'Unknown'}`
              });
            }
            textParts.push(`[Character: ${sc.character?.name ?? 'Unknown'}]`);
          }
        }
      }

      // Shot Description
      const shotDesc = selectedShot.description?.trim() || '';
      textParts.push('');
      textParts.push('--- Shot description ---');
      textParts.push(shotDesc || '(No description)');
      const fullText = textParts.join('\n');
      const textBlob = new Blob([fullText], { type: 'text/plain' });

      if (imageBlobs.length === 0 && !shotDesc) {
        toast.error('No images or description to copy');
        return;
      }

      // 2. Attempt Copy Strategy

      // Strategy A: Single Image + Text (Best support)
      // If we have exactly one image, we can combine it with the text into a single ClipboardItem.
      // This is the most robust way to copy "Image + Text" on Chrome/Edge.
      if (imageBlobs.length === 1) {
        const img = imageBlobs[0];
        try {
          const item = new ClipboardItem({
            [img.type]: img.blob,
            'text/plain': textBlob
          });
          await navigator.clipboard.write([item]);
          toast.success('Image and description copied!');
          return;
        } catch (e) {
          console.warn('Single image+text copy failed, falling back...', e);
        }
      }

      // Strategy B: Multiple Images (Browser support check)
      // If we have > 1 image, we try to create an array of ClipboardItems.
      // Note: Chrome often fails here if we try to write multiple items.
      if (imageBlobs.length > 1) {
        try {
          const items = imageBlobs.map(img => new ClipboardItem({ [img.type]: img.blob }));
          // Add text as a separate item (though typically browsers only accept 1 item total or 1 item with multiple representations)
          // Some browsers might accept a list of items.
          items.push(new ClipboardItem({ 'text/plain': textBlob }));

          await navigator.clipboard.write(items);
          toast.success(`Copied ${imageBlobs.length} images and description!`);
          return;
        } catch (e) {
          console.warn('Multiple image copy failed (expected on some browsers), falling back to primary image only...', e);
        }
      }

      // Strategy C: Fallback - Primary Image + Text
      // If Strategy B failed (or skipped), we take the FIRST image and bundle it with text.
      // We warn the user that only one image was copied.
      if (imageBlobs.length >= 1) {
        const primaryImg = imageBlobs[0];
        try {
          const item = new ClipboardItem({
            [primaryImg.type]: primaryImg.blob,
            'text/plain': textBlob
          });
          await navigator.clipboard.write([item]);

          if (imageBlobs.length > 1) {
            toast.success('Copied primary image and description (browser limit: multi-image copy not supported)');
          } else {
            // Should verify: we might have fallen back from Strategy A if that failed for some reason
            toast.success('Image and description copied');
          }
          return;
        } catch (e) {
          console.error('Fallback image+text copy failed', e);
        }
      }

      // Strategy D: Text Only
      // If all else fails (e.g. image format unsupported), just copy text.
      try {
        await navigator.clipboard.writeText(fullText);
        toast.success('Text copied (browser could not copy images)');
      } catch (e) {
        throw new Error('Clipboard access denied');
      }

    } catch (e) {
      console.error(e);
      toast.error('Failed to copy to clipboard.');
    }
  };

  const handleCopyMotionPrompt = async () => {
    if (!selectedShot) return;
    const displayUuid = getDisplayImageUuid(selectedShot);
    const motionText = (selectedShot as any).motionDescription?.trim() || '';
    const textParts = ['[Shot base image]', '', '--- Motion prompt ---', motionText || '(No motion description)'];
    const fullText = textParts.join('\n');
    const textBlob = new Blob([fullText], { type: 'text/plain' });

    try {
      // Try to get image if available
      let imageBlob: Blob | null = null;
      let imageType = 'image/png';

      if (displayUuid) {
        const blob = await fetchImageBlob(displayUuid);
        if (blob && blob.size > 0) {
          imageBlob = blob;
          imageType = imageBlobToClipboardType(blob);
        }
      }

      if (!imageBlob) {
        // Text only
        if (!motionText) {
          toast.error('No shot image or motion prompt to copy');
          return;
        }
        await navigator.clipboard.writeText(fullText);
        toast.success('Motion prompt text copied (no image available)');
        return;
      }

      // Try copying Image + Text in one ClipboardItem
      try {
        const item = new ClipboardItem({
          [imageType]: imageBlob,
          'text/plain': textBlob
        });
        await navigator.clipboard.write([item]);
        toast.success('Shot base image and motion prompt copied!');
      } catch (e) {
        console.warn('Combined copy failed, falling back to text only', e);
        await navigator.clipboard.writeText(fullText);
        toast.success('Motion prompt text copied (browser could not copy image)');
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to copy to clipboard.');
    }
  };

  return (
    <div className='mb-4 shots-component'>

      {/* Top Panel - Horizontal Scrollable Shot List */}
      <Card className='mb-4 w-full shots-card overflow-hidden'>
        <CardContent className='pt-4 shots-card-content card-content overflow-hidden'>
          <div className='shots-container relative w-full overflow-hidden'>
            <div className='shots-scrollable flex gap-2 pb-2 min-h-[88px] items-center w-full' style={{ maxWidth: '100%' }}>
              {/* Add Shot Button at the beginning */}
              <Button
                onClick={() => handleAddShotClick(1)}
                variant='outline'
                size='sm'
                className='flex-shrink-0 w-8 h-8 p-0 rounded-full'
              >
                <Plus className='h-4 w-4' />
              </Button>

              {/* Existing Shots */}
              {sortedShots.map((shot, index) => (
                <React.Fragment key={shot.id}>
                  <Button
                    onClick={() => handleShotClick(shot)}
                    variant={selectedShot?.id === shot.id ? 'default' : 'outline'}
                    size='sm'
                    className='flex-shrink-0 w-[120px] h-20 flex flex-col items-center justify-center gap-1 p-0 overflow-hidden relative border-2'
                  >
                    {/* Shot Thumbnail with Overlaid Text */}
                    <div className='absolute inset-0 w-full h-full'>
                      {(() => {
                        // Get aspect-ratio-specific image if available
                        let imageUuid = shot.thumbnailUuid;
                        if (aspectRatioId && (shot as any).shotImages) {
                          const match = (shot as any).shotImages.find(
                            (si: any) => si.aspectRatioId === aspectRatioId
                          );
                          if (match) imageUuid = match.imageUuid;
                        }
                        return imageUuid ? (
                          <MediaDisplay
                            fileUuid={imageUuid}
                            className='w-full h-full object-cover'
                          />
                        ) : (
                          <div className='w-full h-full bg-gray-100 flex items-center justify-center'>
                            <FileImage className='h-8 w-8 text-gray-400' />
                          </div>
                        );
                      })()}
                    </div>

                    {/* Overlaid Text Content */}
                    <div className='relative z-10 flex flex-col items-center justify-center text-center px-2 py-1 bg-black/60 backdrop-blur-sm rounded text-white shadow-lg'>
                      <span className='text-xs font-bold drop-shadow-md'>#{shot.sequence}</span>
                      <span className='text-xs leading-tight line-clamp-1 font-medium drop-shadow-md'>
                        {shot.title}
                      </span>
                    </div>
                  </Button>

                  {/* Add Shot Button between shots */}
                  {index < sortedShots.length - 1 && (
                    <Button
                      onClick={() => handleAddShotClick(shot.sequence + 1)}
                      variant='outline'
                      size='sm'
                      className='flex-shrink-0 w-8 h-8 p-0 rounded-full'
                    >
                      <Plus className='h-4 w-4' />
                    </Button>
                  )}
                </React.Fragment>
              ))}

              {/* Add Shot Button at the end if there are shots */}
              {sortedShots.length > 0 && (
                <Button
                  onClick={() => handleAddShotClick(sortedShots.length + 1)}
                  variant='outline'
                  size='sm'
                  className='flex-shrink-0 w-8 h-8 p-0 rounded-full'
                >
                  <Plus className='h-4 w-4' />
                </Button>
              )}
            </div>
            {/* Fade effect indicator for scrollable content */}
            <div className='absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-background to-transparent pointer-events-none'></div>
          </div>
        </CardContent>
      </Card>

      {/* Bottom Panel - Shot Details or Creation Form */}
      {selectedShot && (
        <Card>
          <CardHeader className='flex flex-row items-center gap-2'>
            <CardTitle className='text-lg'>Shot #{selectedShot.sequence}: {selectedShot.title}</CardTitle>
            <div className='flex gap-1 ml-1'>
              <button
                type='button'
                onClick={handleCopyImagePrompt}
                className='p-1.5 rounded hover:bg-gray-200 text-muted-foreground hover:text-foreground'
                title='Copy scene image, character images and shot description (as files for paste in ChatGPT/Gemini)'
                aria-label='Copy base image prompt (images + description)'
              >
                <ImageIcon className='h-4 w-4' />
              </button>
              <button
                type='button'
                onClick={handleCopyMotionPrompt}
                className='p-1.5 rounded hover:bg-gray-200 text-muted-foreground hover:text-foreground'
                title='Copy shot base image and motion prompt (as file + text for paste in ChatGPT/Gemini)'
                aria-label='Copy motion prompt (image + text)'
              >
                <Video className='h-4 w-4' />
              </button>
            </div>
          </CardHeader>
          <CardContent>
            <ShotDetails
              shot={selectedShot}
              aspectRatioId={aspectRatioId}
              onShotUpdated={handleShotUpdated}
              onShotDeleted={handleShotDeleted}
            />
          </CardContent>
        </Card>
      )}

      {isCreatingShot && (
        <Card>
          <CardHeader>
            <CardTitle className='text-lg'>Create New Shot</CardTitle>
          </CardHeader>
          <CardContent>
            <ShotCreationForm
              sceneId={sceneId}
              nextSequence={insertionSequence}
              onShotCreated={handleShotCreated}
              onCancel={() => setIsCreatingShot(false)}
            />
          </CardContent>
        </Card>
      )}

      {!selectedShot && !isCreatingShot && sortedShots.length === 0 && (
        <Card>
          <CardContent className='pt-6'>
            <p className='text-sm text-muted-foreground text-center'>
              No shots in this scene yet. Click the "Add Shot" button to create your first shot.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
