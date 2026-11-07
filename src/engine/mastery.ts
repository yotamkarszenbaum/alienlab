// ---------------------------------------------------------------------------
// Vocabulary Mastery Map — five separate milestones per word, each lit ONLY by
// what the child actually did (never by finishing a task the word was in):
//   meaning  — got it right at least once (with or without help)
//   alone    — recognised it on the first try, no hint
//   recall   — produced it from memory: picture → word, fill-in, fixing or
//              teaching Kosmo in a sentence, or spelling it alone
//   context  — used it alone inside a sentence, a message or a mission
//   later    — remembered it alone in a delayed review (spaced repetition)
// ---------------------------------------------------------------------------
import type { SaveData, WordProgress } from './types';

export type Milestone = 'meaning' | 'alone' | 'recall' | 'context' | 'later';
export const MILESTONES: Milestone[] = ['meaning', 'alone', 'recall', 'context', 'later'];

export const MILESTONE_UI: Record<Milestone, { icon: string; kidHe: string; parentHe: string }> = {
  meaning: { icon: '👀', kidHe: 'מכיר', parentHe: 'הבנת משמעות: ענה נכון לפחות פעם אחת (גם בעזרה)' },
  alone: { icon: '⭐', kidHe: 'מזהה לבד', parentHe: 'זיהוי עצמאי: נכון בניסיון ראשון, בלי רמז' },
  recall: { icon: '🧠', kidHe: 'נזכר בעצמו', parentHe: 'שליפה: נזכר במילה באנגלית בלי שהוצגה (תמונה ← מילה, השלמה, תיקון או לימוד קוסמו במשפט, איות לבד)' },
  context: { icon: '🌍', kidHe: 'משתמש במשפט', parentHe: 'שימוש בהקשר: הצליח לבד כשהמילה הופיעה במשפט, בהודעה או במשימה' },
  later: { icon: '⏰', kidHe: 'זוכר אחרי זמן', parentHe: 'זכירה לאורך זמן: הצליח לבד בחזרה מאוחרת (אחרי שעות או ימים)' },
};

export function masteryOf(wp: WordProgress | undefined): Record<Milestone, boolean> {
  if (!wp || !wp.introduced) return { meaning: false, alone: false, recall: false, context: false, later: false };
  return {
    meaning: wp.independentCorrect + wp.hintedCorrect + (wp.spellIndependent ?? 0) + (wp.spellWithHelp ?? 0) > 0,
    alone: wp.independentCorrect > 0,
    recall: (wp.recallIndependent ?? 0) > 0 || (wp.spellIndependent ?? 0) > 0,
    context: (wp.contextUse ?? 0) > 0,
    later: wp.delayedReviews.some((r) => r.result === 'independent'),
  };
}

export function masterySummary(d: SaveData, wordIds: string[]): Record<Milestone, number> {
  const out = { meaning: 0, alone: 0, recall: 0, context: 0, later: 0 };
  for (const id of wordIds) {
    const m = masteryOf(d.learning[id]);
    for (const k of MILESTONES) if (m[k]) out[k]++;
  }
  return out;
}
