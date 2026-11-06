// ---------------------------------------------------------------------------
// Learning progress per word. Every number shown to the child or parent is
// computed from the stored attempt counters — nothing is invented.
// ---------------------------------------------------------------------------
import type { AttemptRecord, DelayedReview, LearningLevel, WordProgress } from './types';

export const HOUR = 60 * 60 * 1000;
export const DAY = 24 * HOUR;

/** Minimum gap since the last practice for a review to count as "delayed". */
export const MIN_DELAY_FOR_REVIEW = 4 * HOUR;

export function emptyWordProgress(): WordProgress {
  return {
    introduced: false,
    attempts: 0,
    independentCorrect: 0,
    hintedCorrect: 0,
    wrong: 0,
    notHelpful: 0,
    contextIndependent: 0,
    delayedReviews: [],
    recent: [],
  };
}

export function markIntroduced(wp: WordProgress, now: number): WordProgress {
  if (wp.introduced) return wp;
  return { ...wp, introduced: true, introducedAt: now };
}

export function levelOf(wp: WordProgress | undefined): LearningLevel {
  if (!wp || !wp.introduced) return 'not_introduced';
  if (wp.delayedReviews.some((r) => r.result === 'independent')) return 'reviewed_later';
  if (wp.contextIndependent > 0) return 'applied_in_context';
  if (wp.independentCorrect > 0) return 'recognized_independently';
  if (wp.hintedCorrect > 0) return 'recognized_with_help';
  if (wp.attempts > 0) return 'practicing';
  return 'introduced';
}

export const LEVEL_HE: Record<LearningLevel, string> = {
  not_introduced: 'עדיין לא הוצגה',
  introduced: 'הוצגה',
  practicing: 'בתרגול',
  recognized_with_help: 'זוהתה בעזרת רמז',
  recognized_independently: 'זוהתה ללא רמז',
  applied_in_context: 'זוהתה בהקשר חדש',
  reviewed_later: 'נבדקה בחזרה מאוחרת',
};

export const LEVEL_ORDER: LearningLevel[] = [
  'not_introduced',
  'introduced',
  'practicing',
  'recognized_with_help',
  'recognized_independently',
  'applied_in_context',
  'reviewed_later',
];

/** Words that still need practice: struggled, only succeeded with help, or failed a late review. */
export function needsPractice(wp: WordProgress | undefined): boolean {
  if (!wp || !wp.introduced || wp.attempts === 0) return false;
  const lastReview = wp.delayedReviews[wp.delayedReviews.length - 1];
  if (lastReview && lastReview.result !== 'independent') return true;
  if (wp.independentCorrect === 0) return true;
  const recentWrong = wp.recent.slice(-3).filter((r) => r === 'w').length;
  return recentWrong >= 2;
}

export function struggled(wp: WordProgress): boolean {
  const recent = wp.recent.slice(-4);
  return recent.filter((r) => r === 'w').length >= 2;
}

/**
 * Simple review schedule:
 *  - struggled words come back sooner (4h)
 *  - words recognised only with help come back for independent practice (8h)
 *  - independently recognised words are re-checked the next day (24h)
 *  - after a successful delayed review: 3 days
 */
export function scheduleNextReview(wp: WordProgress, now: number): number {
  const lastReview = wp.delayedReviews[wp.delayedReviews.length - 1];
  if (lastReview && lastReview.at === now) {
    if (lastReview.result === 'independent') return now + 3 * DAY;
    if (lastReview.result === 'with_help') return now + 8 * HOUR;
    return now + 4 * HOUR;
  }
  if (struggled(wp)) return now + 4 * HOUR;
  if (wp.independentCorrect === 0) return now + 8 * HOUR;
  return now + DAY;
}

export function isDueForReview(wp: WordProgress | undefined, now: number): boolean {
  if (!wp || !wp.introduced || wp.attempts === 0 || !wp.nextReviewAt || !wp.lastPracticedAt) return false;
  return wp.nextReviewAt <= now && now - wp.lastPracticedAt >= MIN_DELAY_FOR_REVIEW;
}

/** Apply one attempt to the word's counters. */
export function applyAttempt(wp: WordProgress, a: AttemptRecord): WordProgress {
  const next: WordProgress = { ...wp, attempts: wp.attempts + 1, lastPracticedAt: a.at };
  let mark: 'i' | 'h' | 'w' | null = null;
  if (a.outcome === 'wrong') {
    next.wrong = wp.wrong + 1;
    mark = 'w';
  } else if (a.outcome === 'not_helpful') {
    next.notHelpful = wp.notHelpful + 1;
  } else if (a.independent) {
    next.independentCorrect = wp.independentCorrect + 1;
    if (a.context === 'new') next.contextIndependent = wp.contextIndependent + 1;
    mark = 'i';
  } else {
    next.hintedCorrect = wp.hintedCorrect + 1;
    mark = 'h';
  }
  if (mark) next.recent = [...wp.recent, mark].slice(-6);
  next.nextReviewAt = scheduleNextReview(next, a.at);
  return next;
}

export function applyDelayedReview(wp: WordProgress, result: DelayedReview['result'], now: number): WordProgress {
  const next = { ...wp, delayedReviews: [...wp.delayedReviews, { at: now, result }] };
  next.nextReviewAt = scheduleNextReview(next, now);
  return next;
}

let counter = 0;
export function attemptId(now: number) {
  counter = (counter + 1) % 100000;
  return `${now.toString(36)}-${counter.toString(36)}`;
}

export const MAX_ATTEMPT_LOG = 800;
