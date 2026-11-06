// ---------------------------------------------------------------------------
// Rule-based support ladder (no AI, no diagnosis — only task performance).
//
// level 0  no support
// level 1  "verbal": friendly message + word repeated with audio + Hebrew
// level 2  "reduce" (fewer options) / "highlight" (point at the relevant feature)
// level 3  "demo": guided demonstration, then an easier variant of the task
//
// A wrong answer raises the level automatically (1st wrong -> 1, 2nd -> 2,
// 3rd -> 3). The help button raises it one step at a time, so it shows a hint
// first and only reaches the full demonstration if the child keeps asking.
// ---------------------------------------------------------------------------
import type { HintType } from './types';

export type SupportLevel = 0 | 1 | 2 | 3;

export interface SupportState {
  wrong: number;
  helpPresses: number;
  level: SupportLevel;
  used: HintType[];
}

export const initialSupport: SupportState = { wrong: 0, helpPresses: 0, level: 0, used: [] };

export type SupportFlavor = 'choice' | 'teach';

export function hintTypeFor(level: SupportLevel, flavor: SupportFlavor): HintType | null {
  if (level === 0) return null;
  if (level === 1) return 'verbal';
  if (level === 2) return flavor === 'choice' ? 'reduce' : 'highlight';
  return 'demo';
}

function withLevel(s: SupportState, level: SupportLevel, flavor: SupportFlavor): SupportState {
  const t = hintTypeFor(level, flavor);
  const used = t && !s.used.includes(t) ? [...s.used, t] : s.used;
  return { ...s, level, used };
}

export function onWrong(s: SupportState, flavor: SupportFlavor = 'choice'): SupportState {
  const wrong = s.wrong + 1;
  const level = Math.max(s.level, Math.min(3, wrong)) as SupportLevel;
  return withLevel({ ...s, wrong }, level, flavor);
}

export function onHelp(s: SupportState, flavor: SupportFlavor = 'choice'): SupportState {
  const helpPresses = s.helpPresses + 1;
  const level = Math.min(3, s.level + 1) as SupportLevel;
  return withLevel({ ...s, helpPresses }, level, flavor);
}

/** Let the child step back down to a lighter hint (switching support levels). */
export function onLessHelp(s: SupportState): SupportState {
  if (s.level <= 1) return s;
  return { ...s, level: (s.level - 1) as SupportLevel };
}

export function hintUsed(s: SupportState): boolean {
  return s.used.length > 0;
}

/** Number of answer options for a word, based on the child's independent successes. */
export function optionCountFor(independentCorrect: number, base = 2, max = 4): number {
  return Math.min(max, base + Math.min(2, independentCorrect));
}

/** Repeated independent success -> the word is only heard, not shown (if audio works). */
export function audioOnlyFor(independentCorrect: number, audioWorks: boolean): boolean {
  return audioWorks && independentCorrect >= 2;
}
