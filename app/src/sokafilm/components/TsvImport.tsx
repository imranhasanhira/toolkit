import React, { useState, useCallback } from 'react';
import { Button } from '../../client/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../client/components/ui/card';
import { Input } from '../../client/components/ui/input';
import { Label } from '../../client/components/ui/label';
import { Textarea } from '../../client/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../client/components/ui/dialog';
import {
  Upload,
  FileText,
  AlertTriangle,
  CheckCircle2,
  UserPlus,
  User,
  Film,
  Clapperboard,
  Video,
  Loader2,
  X,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { parseTsvContent, matchCharactersWithExisting, ParsedTsvData, ParsedCharacter, ParsedScene } from '../utils/tsvParser';
import type { Character } from 'wasp/entities';

interface TsvImportProps {
  projectId: string;
  existingCharacters: Character[];
  onImport: (data: {
    storyTitle: string;
    storyDescription?: string;
    characters: ParsedCharacter[];
    scenes: ParsedScene[];
  }) => Promise<void>;
  onCancel: () => void;
}

export function TsvImport({ projectId, existingCharacters, onImport, onCancel }: TsvImportProps) {
  const [tsvContent, setTsvContent] = useState('');
  const [storyTitle, setStoryTitle] = useState('');
  const [storyDescription, setStoryDescription] = useState('');
  const [parsedData, setParsedData] = useState<ParsedTsvData | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [expandedScenes, setExpandedScenes] = useState<Set<number>>(new Set());

  const handleParse = useCallback(() => {
    if (!tsvContent.trim()) return;
    
    const result = parseTsvContent(tsvContent);
    
    // Match characters with existing ones
    result.characters = matchCharactersWithExisting(
      result.characters,
      existingCharacters.map(c => ({ id: c.id, name: c.name }))
    );

    setParsedData(result);
    setShowPreview(true);

    // Auto-expand all scenes
    const allSceneNumbers = new Set(result.scenes.map(s => s.sceneNumber));
    setExpandedScenes(allSceneNumbers);
  }, [tsvContent, existingCharacters]);

  const handleConfirmImport = async () => {
    if (!parsedData || !storyTitle.trim()) return;

    setIsImporting(true);
    try {
      await onImport({
        storyTitle: storyTitle.trim(),
        storyDescription: storyDescription.trim() || undefined,
        characters: parsedData.characters,
        scenes: parsedData.scenes,
      });
    } catch (error) {
      console.error('Import failed:', error);
    } finally {
      setIsImporting(false);
    }
  };

  const toggleScene = (sceneNumber: number) => {
    setExpandedScenes(prev => {
      const next = new Set(prev);
      if (next.has(sceneNumber)) {
        next.delete(sceneNumber);
      } else {
        next.add(sceneNumber);
      }
      return next;
    });
  };

  const totalShots = parsedData?.scenes.reduce((acc, s) => acc + s.shots.length, 0) || 0;
  const newCharacters = parsedData?.characters.filter(c => !c.isExisting) || [];
  const existingMatches = parsedData?.characters.filter(c => c.isExisting) || [];

  return (
    <>
      {/* Step 1: TSV Input */}
      {!showPreview && (
        <Card className="flex flex-col min-h-[420px]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-primary" />
              Import from TSV
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col flex-1 min-h-0 gap-4">
            <div>
              <Label htmlFor="storyTitle">Story Title *</Label>
              <Input
                id="storyTitle"
                value={storyTitle}
                onChange={e => setStoryTitle(e.target.value)}
                placeholder="Enter a title for the imported story"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="storyDesc">Story Description (optional)</Label>
              <Input
                id="storyDesc"
                value={storyDescription}
                onChange={e => setStoryDescription(e.target.value)}
                placeholder="Brief description of the story"
                className="mt-1"
              />
            </div>

            <div className="flex flex-col flex-1 min-h-[180px]">
              <Label htmlFor="tsvInput">Paste TSV Content *</Label>
              <p className="text-xs text-muted-foreground mt-1 mb-2">
                Format: ID, Name, Context, Image Prompt, Motion Prompt (tab-separated)
              </p>
              <Textarea
                id="tsvInput"
                value={tsvContent}
                onChange={e => setTsvContent(e.target.value)}
                placeholder={`ID\tName\tContext\tImage Prompt\tMotion Prompt\nCharacter-1\tSnowball\tKitten\tA fluffy white kitten...\t\nProp-1\tThe Cucumber\tVegetable\tA dark green cucumber...\t\nScene-1\tKitchen\tMaster Scene\tA modern kitchen...\t\nScene-1 Shot-1.1\tThe Setup\tSnowball, Cucumber\tA high-angle shot...\tThe camera is steady...`}
                className="mt-1 font-mono text-xs min-h-[140px] flex-1 resize-y w-full"
                rows={10}
              />
            </div>

            <div className="flex gap-2 flex-shrink-0 pt-2 border-t mt-auto">
              <Button
                onClick={handleParse}
                disabled={!tsvContent.trim() || !storyTitle.trim()}
              >
                <FileText className="h-4 w-4 mr-2" />
                Parse & Preview
              </Button>
              <Button variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Preview & Confirm Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Import Preview: {storyTitle}
            </DialogTitle>
            <DialogDescription>
              Review the parsed data below. New items will be created, existing characters will be reused.
            </DialogDescription>
          </DialogHeader>

          {parsedData && (
            <div className="space-y-6 py-2">
              {/* Errors */}
              {parsedData.errors.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <h4 className="flex items-center gap-2 text-sm font-medium text-amber-800 mb-2">
                    <AlertTriangle className="h-4 w-4" />
                    Warnings ({parsedData.errors.length})
                  </h4>
                  <ul className="text-xs text-amber-700 space-y-1">
                    {parsedData.errors.map((err, i) => (
                      <li key={i}>- {err}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-blue-50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-blue-700">{parsedData.characters.length}</div>
                  <div className="text-xs text-blue-600">Characters</div>
                </div>
                <div className="bg-purple-50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-purple-700">{parsedData.scenes.length}</div>
                  <div className="text-xs text-purple-600">Scenes</div>
                </div>
                <div className="bg-green-50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-green-700">{totalShots}</div>
                  <div className="text-xs text-green-600">Shots</div>
                </div>
                <div className="bg-orange-50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-orange-700">
                    {newCharacters.length}/{existingMatches.length}
                  </div>
                  <div className="text-xs text-orange-600">New / Existing</div>
                </div>
              </div>

              {/* Characters Section */}
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Characters ({parsedData.characters.length})
                </h3>
                <div className="space-y-1.5">
                  {parsedData.characters.map((char, i) => (
                    <div
                      key={i}
                      className={`flex items-center gap-3 p-2.5 rounded-lg border text-sm ${
                        char.isExisting
                          ? 'bg-green-50 border-green-200'
                          : 'bg-blue-50 border-blue-200'
                      }`}
                    >
                      <div className="flex-shrink-0">
                        {char.isExisting ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        ) : (
                          <UserPlus className="h-4 w-4 text-blue-600" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">{char.name}</span>
                          {char.context && (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-gray-200 text-gray-600">
                              {char.context}
                            </span>
                          )}
                          {char.isExisting ? (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-green-200 text-green-700">
                              Existing
                            </span>
                          ) : (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-blue-200 text-blue-700">
                              New
                            </span>
                          )}
                        </div>
                        {char.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                            {char.description}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Scenes Section */}
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                  <Film className="h-4 w-4" />
                  Scenes ({parsedData.scenes.length})
                </h3>
                <div className="space-y-2">
                  {parsedData.scenes.map((scene) => (
                    <div key={scene.sceneNumber} className="border rounded-lg overflow-hidden">
                      {/* Scene Header */}
                      <button
                        onClick={() => toggleScene(scene.sceneNumber)}
                        className="w-full flex items-center justify-between p-3 bg-purple-50 hover:bg-purple-100 transition-colors text-left"
                      >
                        <div className="flex items-center gap-2">
                          <Clapperboard className="h-4 w-4 text-purple-600" />
                          <span className="font-medium text-sm">
                            Scene {scene.sceneNumber}: {scene.name}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            ({scene.shots.length} shots)
                          </span>
                          {scene.context && (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-purple-200 text-purple-700">
                              {scene.context}
                            </span>
                          )}
                        </div>
                        {expandedScenes.has(scene.sceneNumber) ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                      </button>

                      {/* Scene Details */}
                      {expandedScenes.has(scene.sceneNumber) && (
                        <div className="p-3 space-y-2">
                          {scene.description && (
                            <div className="text-xs text-muted-foreground bg-gray-50 p-2 rounded">
                              <span className="font-medium">Scene Description:</span>{' '}
                              {scene.description.length > 200
                                ? scene.description.substring(0, 200) + '...'
                                : scene.description}
                            </div>
                          )}

                          {/* Shots */}
                          <div className="space-y-1.5">
                            {scene.shots.map((shot, idx) => (
                              <div
                                key={idx}
                                className="flex items-start gap-2 p-2 bg-gray-50 rounded border border-gray-100 text-xs"
                              >
                                <Video className="h-3.5 w-3.5 text-gray-500 mt-0.5 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium">
                                      Shot {shot.shotNumber}: {shot.name}
                                    </span>
                                  </div>
                                  {shot.characterNames.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-1">
                                      {shot.characterNames.map((cn, ci) => {
                                        const isKnown = parsedData.characters.some(
                                          c => c.name.toLowerCase() === cn.toLowerCase() ||
                                               c.name.toLowerCase().includes(cn.toLowerCase()) ||
                                               cn.toLowerCase().includes(c.name.toLowerCase().replace(/^the\s+/, ''))
                                        );
                                        return (
                                          <span
                                            key={ci}
                                            className={`px-1.5 py-0.5 rounded text-[10px] ${
                                              isKnown
                                                ? 'bg-green-100 text-green-700'
                                                : 'bg-red-100 text-red-700'
                                            }`}
                                          >
                                            {cn}
                                          </span>
                                        );
                                      })}
                                    </div>
                                  )}
                                  {shot.description && (
                                    <p className="text-muted-foreground mt-1 line-clamp-2">
                                      {shot.description}
                                    </p>
                                  )}
                                  {shot.motionDescription && (
                                    <p className="text-muted-foreground mt-1 line-clamp-2 italic">
                                      Motion: {shot.motionDescription}
                                    </p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPreview(false)} disabled={isImporting}>
              <X className="h-4 w-4 mr-2" />
              Back to Edit
            </Button>
            <Button
              onClick={handleConfirmImport}
              disabled={isImporting || !parsedData || (parsedData.characters.length === 0 && parsedData.scenes.length === 0)}
            >
              {isImporting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Confirm Import
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
