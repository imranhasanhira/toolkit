/**
 * TSV Import Parser for SokaFilm
 * 
 * Expected TSV format:
 * ID | Name | Context | Image Prompt | Motion Prompt
 * 
 * Row types:
 * - Character-N  → Project character (name, context=short label, image prompt=description)
 * - Prop-N       → Prop character (same as character, props are characters)
 * - Scene-N      → Scene (name, context=type, image prompt=blind scene description)
 * - Scene-N Shot-N.N → Shot (name, context=character names CSV, image prompt, motion prompt)
 */

export interface ParsedCharacter {
  tsvId: string;          // e.g. "Character-1" or "Prop-1"
  name: string;
  context: string;        // Short label from Context column (e.g. "Kitten", "Vegetable")
  description: string;    // Full description from Image Prompt column (used for image generation)
  isExisting?: boolean;   // Will be set during preview matching
  existingCharacterId?: string;
}

export interface ParsedScene {
  tsvId: string;          // e.g. "Scene-1"
  sceneNumber: number;
  name: string;
  context: string;        // e.g. "Master Scene"
  description: string;    // Blind scene description (no characters) from Image Prompt column
  shots: ParsedShot[];
}

export interface ParsedShot {
  tsvId: string;          // e.g. "Scene-1 Shot-1.1"
  sceneNumber: number;
  shotNumber: string;     // e.g. "1.1"
  name: string;
  characterNames: string[]; // Parsed from Context column (comma-separated)
  description: string;    // Image prompt from Image Prompt column
  motionDescription: string; // Motion description from Motion Prompt column
}

export interface ParsedTsvData {
  characters: ParsedCharacter[];
  scenes: ParsedScene[];
  errors: string[];
}

export function parseTsvContent(tsvContent: string): ParsedTsvData {
  const errors: string[] = [];
  const characters: ParsedCharacter[] = [];
  const scenesMap = new Map<number, ParsedScene>();

  // Split into lines and filter empty ones
  const lines = tsvContent.split('\n').filter(line => line.trim().length > 0);
  
  if (lines.length === 0) {
    errors.push('TSV content is empty');
    return { characters, scenes: [], errors };
  }

  // Check if first line is a header
  const firstLine = lines[0].toLowerCase();
  const startIndex = (firstLine.includes('id') && firstLine.includes('name')) ? 1 : 0;

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i];
    const columns = line.split('\t');
    
    // Need at least ID and Name
    if (columns.length < 2) {
      continue; // Skip malformed lines
    }

    const id = columns[0]?.trim();
    const name = columns[1]?.trim();
    const context = columns[2]?.trim() || '';
    const imagePrompt = columns[3]?.trim() || '';
    const motionPrompt = columns[4]?.trim() || '';

    if (!id || !name) {
      continue; // Skip empty rows
    }

    // Parse Character rows
    const characterMatch = id.match(/^Character-(\d+)$/i);
    if (characterMatch) {
      characters.push({
        tsvId: id,
        name,
        context,
        description: imagePrompt, // Image Prompt column is the description
      });
      continue;
    }

    // Parse Prop rows (props are characters)
    const propMatch = id.match(/^Prop-(\d+)$/i);
    if (propMatch) {
      characters.push({
        tsvId: id,
        name,
        context,
        description: imagePrompt, // Image Prompt column is the description
      });
      continue;
    }

    // Parse Shot rows (must come before Scene check since "Scene-1 Shot-1.1" contains "Scene-1")
    const shotMatch = id.match(/^Scene-(\d+)\s+Shot-(\d+\.\d+)$/i);
    if (shotMatch) {
      const sceneNumber = parseInt(shotMatch[1]);
      const shotNumber = shotMatch[2];

      // Parse character names from context (comma-separated)
      const characterNames = context
        ? context.split(',').map(n => n.trim()).filter(n => n.length > 0)
        : [];

      const shot: ParsedShot = {
        tsvId: id,
        sceneNumber,
        shotNumber,
        name,
        characterNames,
        description: imagePrompt,
        motionDescription: motionPrompt,
      };

      // Add to scene
      if (!scenesMap.has(sceneNumber)) {
        errors.push(`Shot "${id}" references Scene-${sceneNumber} which hasn't been defined yet (line ${i + 1})`);
      } else {
        scenesMap.get(sceneNumber)!.shots.push(shot);
      }
      continue;
    }

    // Parse Scene rows
    const sceneMatch = id.match(/^Scene-(\d+)$/i);
    if (sceneMatch) {
      const sceneNumber = parseInt(sceneMatch[1]);
      
      if (scenesMap.has(sceneNumber)) {
        errors.push(`Duplicate scene: Scene-${sceneNumber} (line ${i + 1})`);
        continue;
      }

      scenesMap.set(sceneNumber, {
        tsvId: id,
        sceneNumber,
        name,
        context,
        description: imagePrompt, // Blind scene description
        shots: [],
      });
      continue;
    }

    // Unknown row format
    errors.push(`Unknown row format: "${id}" (line ${i + 1})`);
  }

  // Sort scenes by number
  const scenes = Array.from(scenesMap.values()).sort((a, b) => a.sceneNumber - b.sceneNumber);
  
  // Sort shots within each scene
  for (const scene of scenes) {
    scene.shots.sort((a, b) => {
      const [aMajor, aMinor] = a.shotNumber.split('.').map(Number);
      const [bMajor, bMinor] = b.shotNumber.split('.').map(Number);
      return aMajor !== bMajor ? aMajor - bMajor : aMinor - bMinor;
    });
  }

  // Validate character references in shots
  const allCharacterNames = new Set(characters.map(c => c.name));
  for (const scene of scenes) {
    for (const shot of scene.shots) {
      for (const charName of shot.characterNames) {
        if (!allCharacterNames.has(charName)) {
          const found = characters.find(c => 
            c.name.toLowerCase().includes(charName.toLowerCase()) ||
            charName.toLowerCase().includes(c.name.toLowerCase().replace(/^the\s+/i, ''))
          );
          if (!found) {
            errors.push(`Shot "${shot.tsvId}" references unknown character "${charName}"`);
          }
        }
      }
    }
  }

  return { characters, scenes, errors };
}

/**
 * Match parsed characters with existing project characters
 */
export function matchCharactersWithExisting(
  parsed: ParsedCharacter[],
  existing: { id: string; name: string }[]
): ParsedCharacter[] {
  return parsed.map(pc => {
    const match = existing.find(ec => 
      ec.name.toLowerCase() === pc.name.toLowerCase()
    );
    return {
      ...pc,
      isExisting: !!match,
      existingCharacterId: match?.id,
    };
  });
}
