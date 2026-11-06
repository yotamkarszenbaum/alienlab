// ---------------------------------------------------------------------------
// SaveData-level operations used by the screens. Pure functions:
// (data, event) -> new data. The UI only calls these.
// ---------------------------------------------------------------------------
import type { AttemptOutcome, ConceptKnowledge, SaveData, TaskType } from './types';
import type { SupportState } from './hints';
import { hintUsed } from './hints';
import type { ChoiceOption, QuestionInstance } from './tasks';
import { evaluatePerWord } from './tasks';
import {
  applyAttempt,
  applyDelayedReview,
  attemptId,
  emptyWordProgress,
  isDueForReview,
  markIntroduced,
  MAX_ATTEMPT_LOG,
  needsPractice,
  struggled,
} from './learning';
import { emptyConcept, understandingOf } from './alienMind';
import { WORDS, WORDS_BY_ID } from '../content/words';

export function introduceWord(d: SaveData, wordId: string, now: number): SaveData {
  const wp = d.learning[wordId] ?? emptyWordProgress();
  const concept = d.alien.concepts[wordId] ?? emptyConcept(wordId);
  return {
    ...d,
    learning: { ...d.learning, [wordId]: markIntroduced(wp, now) },
    alien: { ...d.alien, concepts: { ...d.alien.concepts, [wordId]: { ...concept, heard: true } } },
  };
}

export interface WordAttemptInput {
  wordId: string;
  taskId: string;
  taskType: TaskType | 'review';
  outcome: AttemptOutcome;
  attemptNumber: number;
  support: SupportState;
  completed: boolean;
  phase: 'learn' | 'review';
  context: 'intro' | 'new';
  now: number;
}

export function recordWordAttempt(d: SaveData, a: WordAttemptInput): SaveData {
  const used = hintUsed(a.support);
  const correct = a.outcome === 'correct';
  const rec = {
    id: attemptId(a.now),
    at: a.now,
    wordId: a.wordId,
    taskId: a.taskId,
    taskType: a.taskType,
    outcome: a.outcome,
    correct,
    attemptNumber: a.attemptNumber,
    hintUsed: used,
    hintTypes: [...a.support.used],
    independent: correct && a.attemptNumber === 1 && !used,
    completed: a.completed,
    phase: a.phase,
    context: a.context,
  };
  const wp = d.learning[a.wordId] ?? emptyWordProgress();
  return {
    ...d,
    learning: { ...d.learning, [a.wordId]: applyAttempt(markIntroduced(wp, a.now), rec) },
    attempts: [...d.attempts, rec].slice(-MAX_ATTEMPT_LOG),
  };
}

/**
 * Record a choice answer. On a wrong answer only the words that were actually
 * wrong are logged (e.g. RED but not APPLE when a green apple was chosen).
 */
export function recordChoice(
  d: SaveData,
  q: QuestionInstance,
  chosen: ChoiceOption,
  attemptNumber: number,
  support: SupportState,
  phase: 'learn' | 'review',
  now: number,
): SaveData {
  const perWord = evaluatePerWord(q, chosen);
  let out = d;
  for (const wid of q.wordIds) {
    if (!chosen.correct && perWord[wid]) continue;
    out = recordWordAttempt(out, {
      wordId: wid,
      taskId: q.taskId,
      taskType: phase === 'review' ? 'review' : q.taskType,
      outcome: chosen.correct || perWord[wid] ? 'correct' : 'wrong',
      attemptNumber,
      support,
      completed: chosen.correct,
      phase,
      context: q.context,
      now,
    });
  }
  return out;
}

/** After a review question is finished, store the delayed-review result for due words. */
export function recordDelayedReview(
  d: SaveData,
  wordId: string,
  firstTryCorrect: boolean,
  anyHint: boolean,
  wasDue: boolean,
  now: number,
): SaveData {
  if (!wasDue) return d;
  const wp = d.learning[wordId];
  if (!wp) return d;
  const result = firstTryCorrect ? (anyHint ? 'with_help' : 'independent') : 'wrong';
  return { ...d, learning: { ...d.learning, [wordId]: applyDelayedReview(wp, result, now) } };
}

export function setConcept(d: SaveData, k: ConceptKnowledge): SaveData {
  return { ...d, alien: { ...d.alien, concepts: { ...d.alien.concepts, [k.conceptId]: k } } };
}

/** Grant the concept's ability only if the alien truly understands it. */
export function syncAbility(d: SaveData, conceptId: string): { data: SaveData; gained: boolean } {
  const w = WORDS_BY_ID[conceptId];
  if (!w?.teach) return { data: d, gained: false };
  const understood = understandingOf(w.target, d.alien.concepts[conceptId]) === 'understood';
  const has = d.alien.abilities.includes(w.teach.ability.id);
  if (understood && !has) return { data: { ...d, alien: { ...d.alien, abilities: [...d.alien.abilities, w.teach.ability.id] } }, gained: true };
  return { data: d, gained: false };
}

// ------------------------------- reviews ----------------------------------

/** Words due for a delayed review, hardest first (struggled > needs help > others). */
export function dueWords(d: SaveData, now: number): string[] {
  const due = WORDS.filter((w) => isDueForReview(d.learning[w.id], now));
  const prio = (id: string) => {
    const wp = d.learning[id];
    if (struggled(wp)) return 0;
    if (needsPractice(wp)) return 1;
    return 2;
  };
  return due.map((w) => w.id).sort((a, b) => prio(a) - prio(b));
}

export function wordsNeedingPractice(d: SaveData): string[] {
  return WORDS.filter((w) => needsPractice(d.learning[w.id])).map((w) => w.id);
}

export function introducedWords(d: SaveData): string[] {
  return WORDS.filter((w) => d.learning[w.id]?.introduced).map((w) => w.id);
}
