// ---------------------------------------------------------------------------
// Task engine: turns content definitions into concrete question instances
// (options, correct answer, difficulty) and evaluates answers per word.
// ---------------------------------------------------------------------------
import type { ItemSpec, MissionStepDef, SentenceDef, TaskType, WordDef } from './types';
import { catalog, describeItemHe, itemId, sameItem } from '../content/items';
import { WORDS, WORDS_BY_ID } from '../content/words';
import { hasFeature, salientFeatures, seededShuffle } from './alienMind';

export type QuestionMode = 'word_to_picture' | 'picture_to_word' | 'sentence_to_picture' | 'mission';

export interface ChoiceOption {
  key: string;
  item?: ItemSpec;
  wordId?: string;
  correct: boolean;
  labelHe: string;
  similarity: number;
}

export interface QuestionInstance {
  key: string;
  taskId: string;
  mode: QuestionMode;
  taskType: TaskType;
  wordIds: string[];
  promptEn: string;
  promptHe: string;
  picture?: ItemSpec;
  showText: boolean;
  options: ChoiceOption[];
  context: 'intro' | 'new';
}

function similarity(a: ItemSpec, b: ItemSpec) {
  return salientFeatures(a).filter((f) => hasFeature(b, f)).length;
}

function pictureOption(i: ItemSpec, correct: boolean, ref: ItemSpec): ChoiceOption {
  return { key: itemId(i), item: i, correct, labelHe: describeItemHe(i), similarity: correct ? 99 : similarity(i, ref) };
}

const FALLBACK_POOL = catalog();

/** Choose the picture that matches the word. */
export function buildWordToPicture(
  word: WordDef,
  opts: { optionCount: number; audioOnly: boolean; variant: number; taskId: string; context?: 'intro' | 'new'; easy?: boolean },
): QuestionInstance {
  const pos = word.positiveExamples;
  const correct = pos[opts.variant % pos.length];
  let negatives = word.negativeExamples.filter((i) => !hasFeature(i, word.target));
  if (negatives.length < opts.optionCount - 1) {
    negatives = [...negatives, ...FALLBACK_POOL.filter((i) => !hasFeature(i, word.target) && !negatives.some((n) => sameItem(n, i)))];
  }
  // Hard = most similar distractors first (focus on the relevant feature); easy = least similar.
  const sorted = [...negatives].sort((a, b) => similarity(b, correct) - similarity(a, correct));
  const rotated = opts.easy ? [...sorted].reverse() : sorted;
  const distractors = rotated.slice(0, opts.optionCount - 1);
  const options = seededShuffle(
    [pictureOption(correct, true, correct), ...distractors.map((d) => pictureOption(d, false, correct))],
    opts.variant * 31 + word.id.length,
  );
  return {
    key: `${opts.taskId}:${opts.variant}:${opts.optionCount}`,
    taskId: opts.taskId,
    mode: 'word_to_picture',
    taskType: 'word_to_picture',
    wordIds: [word.id],
    promptEn: word.english,
    promptHe: word.hebrew,
    showText: !opts.audioOnly,
    options,
    context: opts.context ?? 'intro',
  };
}

/** Show a picture, choose the English word. Only already-introduced words can be options. */
export function buildPictureToWord(
  word: WordDef,
  introduced: string[],
  opts: { optionCount: number; variant: number; taskId: string; easy?: boolean },
): QuestionInstance {
  const picture = word.positiveExamples[opts.variant % word.positiveExamples.length];
  // A word is a fair distractor only if the picture does NOT show it (no two right answers).
  const candidates = WORDS.filter((w) => w.id !== word.id && introduced.includes(w.id) && !hasFeature(picture, w.target));
  const sameCat = candidates.filter((w) => w.category === word.category || w.unitId === word.unitId);
  const others = candidates.filter((w) => !sameCat.includes(w));
  const ordered = opts.easy ? [...others, ...sameCat] : [...sameCat, ...others];
  const distractors = ordered.slice(0, Math.max(1, opts.optionCount - 1));
  const options: ChoiceOption[] = seededShuffle(
    [
      { key: word.id, wordId: word.id, correct: true, labelHe: word.english, similarity: 99 },
      ...distractors.map((w) => ({
        key: w.id,
        wordId: w.id,
        correct: false,
        labelHe: w.english,
        similarity: w.category === word.category ? 2 : w.unitId === word.unitId ? 1 : 0,
      })),
    ],
    opts.variant * 17 + word.id.length,
  );
  return {
    key: `${opts.taskId}:${opts.variant}:${opts.optionCount}`,
    taskId: opts.taskId,
    mode: 'picture_to_word',
    taskType: 'picture_to_word',
    wordIds: [word.id],
    promptEn: word.english,
    promptHe: word.hebrew,
    picture,
    showText: true,
    options,
    context: 'intro',
  };
}

export function buildSentenceQuestion(s: SentenceDef, opts: { variant: number; taskId: string }): QuestionInstance {
  const options = seededShuffle(
    [pictureOption(s.answer, true, s.answer), ...s.distractors.map((d) => pictureOption(d, false, s.answer))],
    opts.variant * 13 + s.id.length,
  );
  return {
    key: `${opts.taskId}:${opts.variant}`,
    taskId: opts.taskId,
    mode: 'sentence_to_picture',
    taskType: 'word_to_picture',
    wordIds: s.wordIds,
    promptEn: s.english,
    promptHe: s.hebrew,
    showText: true,
    options,
    context: 'new',
  };
}

export function buildMissionQuestion(step: MissionStepDef, opts: { variant: number; taskId: string }): QuestionInstance {
  const options = seededShuffle(
    [pictureOption(step.answer, true, step.answer), ...step.distractors.map((d) => pictureOption(d, false, step.answer))],
    opts.variant * 7 + step.id.length,
  );
  return {
    key: `${opts.taskId}:${opts.variant}`,
    taskId: opts.taskId,
    mode: 'mission',
    taskType: 'mission',
    wordIds: step.wordIds,
    promptEn: step.promptEn,
    promptHe: step.promptHe,
    showText: true,
    options,
    context: 'new',
  };
}

/** "Kosmo says": the options are the items of a fixed scene (positions never move). */
export function buildSceneQuestion(word: WordDef, scene: ItemSpec[], opts: { taskId: string; audioOnly: boolean }): QuestionInstance {
  const correctItem = scene.find((i) => hasFeature(i, word.target)) ?? scene[0];
  return {
    key: `${opts.taskId}:scene`,
    taskId: opts.taskId,
    mode: 'word_to_picture',
    taskType: 'word_to_picture',
    wordIds: [word.id],
    promptEn: word.english,
    promptHe: word.hebrew,
    showText: !opts.audioOnly,
    options: scene.map((i) => pictureOption(i, hasFeature(i, word.target), correctItem)),
    context: 'new',
  };
}

/** Level-2 support: keep the correct answer and the easiest remaining distractor. */
export function reduceOptions(options: ChoiceOption[], eliminated: string[]): ChoiceOption[] {
  const correct = options.find((o) => o.correct)!;
  const remaining = options.filter((o) => !o.correct && !eliminated.includes(o.key));
  const pool = remaining.length ? remaining : options.filter((o) => !o.correct);
  const easiest = [...pool].sort((a, b) => a.similarity - b.similarity)[0];
  return options.filter((o) => o === correct || o === easiest);
}

/**
 * Per-word correctness for a chosen answer. For "RED APPLE", choosing a green
 * apple is wrong for RED but right for APPLE — each word is logged separately.
 */
export function evaluatePerWord(q: QuestionInstance, chosen: ChoiceOption): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const wid of q.wordIds) {
    const w = WORDS_BY_ID[wid];
    if (chosen.wordId) out[wid] = chosen.correct;
    else if (chosen.item && w) out[wid] = hasFeature(chosen.item, w.target);
    else out[wid] = chosen.correct;
  }
  return out;
}
