// ---------------------------------------------------------------------------
// Teach & Unlock — Kosmo's workshop.
//
// Knowledge is the resource: the child can give Kosmo instructions ONLY with
// words the child has taught him (other words are locked). An instruction must
// fit exactly one thing in the workshop ("BALL" is not enough when there are
// two balls — "RED BALL" is). Kosmo then acts on what he knows (engine/kosmo.ts);
// every part he builds by himself completes the spaceship.
// ---------------------------------------------------------------------------
import type { Dim, ItemSpec, SaveData } from './types';
import { hasFeature } from './alienMind';
import { kosmoDictionary, kosmoTaught } from './kosmo';
import { item } from '../content/items';
import { WORDS, WORDS_BY_ID } from '../content/words';
import { inLevel } from '../content/levels';
import { levelOfGame } from './gameProgress';

export const WORKSHOP_GOAL = 8;
/** Words Kosmo must know before the workshop opens. */
export const WORKSHOP_MIN_WORDS = 3;

export const WORKSHOP_SCENES: ItemSpec[][] = [
  [item('ball', 'red'), item('ball', 'blue'), item('apple', 'red'), item('apple', 'green'), item('dog', 'brown', 'big'), item('cat', 'orange')],
  [item('car', 'red'), item('car', 'blue', 'small'), item('hat', 'yellow'), item('ball', 'yellow', 'big'), item('star', 'yellow'), item('cup', 'green')],
  [item('box', 'blue', 'normal', 'closed'), item('box', 'red', 'normal', 'open'), item('key', 'yellow'), item('dog', 'white', 'small'), item('cat', 'gray', 'big'), item('door', 'brown', 'normal', 'open')],
  [item('apple', 'yellow'), item('star', 'blue'), item('car', 'green'), item('hat', 'blue', 'big'), item('ball', 'green', 'small'), item('cup', 'red')],
];

/** English word order of an instruction: size, state, colour, thing ("BIG RED BALL"). */
const ORDER: Dim[] = ['size', 'state', 'color', 'kind'];
export const COMMAND_DIMS = ORDER;

export function workshopOpen(d: SaveData): boolean {
  return kosmoDictionary(d).filter((x) => WORDS_BY_ID[x.wordId]).length >= WORKSHOP_MIN_WORDS;
}

export function workshopScene(d: SaveData): ItemSpec[] {
  return WORKSHOP_SCENES[d.game.workshopParts.length % WORKSHOP_SCENES.length];
}

export interface WorkshopChip {
  wordId: string;
  dim: Dim;
  /** Kosmo was taught this word — usable in instructions. */
  unlocked: boolean;
}

/** Words that describe something in this scene, unlocked only if the child taught them to Kosmo. */
export function workshopChips(d: SaveData, scene: ItemSpec[]): WorkshopChip[] {
  const level = levelOfGame(d.game);
  return WORDS.filter((w) => inLevel(w.minLevel, level) && ORDER.includes(w.target.dim) && scene.some((i) => hasFeature(i, w.target)))
    .map((w) => ({ wordId: w.id, dim: w.target.dim, unlocked: kosmoTaught(d, w.id) }))
    .sort((a, b) => ORDER.indexOf(a.dim) - ORDER.indexOf(b.dim) || Number(b.unlocked) - Number(a.unlocked));
}

export function orderCommand(wordIds: string[]): string[] {
  return [...wordIds].sort((a, b) => ORDER.indexOf(WORDS_BY_ID[a].target.dim) - ORDER.indexOf(WORDS_BY_ID[b].target.dim));
}

export function commandText(wordIds: string[]): string {
  return orderCommand(wordIds)
    .map((w) => WORDS_BY_ID[w].english)
    .join(' ');
}

/** Indices of the things an instruction fits. */
export function commandMatches(scene: ItemSpec[], wordIds: string[]): number[] {
  if (!wordIds.length) return [];
  return scene.map((i, idx) => ({ i, idx })).filter(({ i }) => wordIds.every((w) => hasFeature(i, WORDS_BY_ID[w].target))).map(({ idx }) => idx);
}

export function commandKey(wordIds: string[]): string {
  return orderCommand(wordIds).join('+');
}
