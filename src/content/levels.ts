import type { Level } from '../engine/types';

// Difficulty levels by age range. The game never asks for an exact age.
export interface LevelDef {
  level: Level;
  titleHe: string;
  agesHe: string;
  descriptionHe: string;
  stars: number;
}

export const LEVELS: LevelDef[] = [
  { level: 1, titleHe: 'צוערי חלל', agesHe: 'מומלץ לגילי 6–7', descriptionHe: '12 מילים בסיסיות', stars: 1 },
  { level: 2, titleHe: 'חוקרי חלל', agesHe: 'מומלץ לגילי 8–9', descriptionHe: '15 מילים — עוד מילה בכל תחנה', stars: 2 },
  { level: 3, titleHe: 'מפקדי חלל', agesHe: 'מומלץ לגילי 10–12', descriptionHe: '18 מילים, וגם מרכיבים מילים מאותיות', stars: 3 },
];

export const LEVELS_BY_ID: Record<Level, LevelDef> = { 1: LEVELS[0], 2: LEVELS[1], 3: LEVELS[2] };

export function inLevel(minLevel: Level | undefined, level: Level | null | undefined): boolean {
  return (minLevel ?? 1) <= (level ?? 1);
}
