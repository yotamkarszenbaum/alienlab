// ---------------------------------------------------------------------------
// Kosmo's knowledge of words — built ONLY by the child's teaching.
//
// One engine for every word (the same feature-intersection model as the
// "teach Kosmo" steps, see alienMind.ts). What Kosmo does with a word follows
// fixed rules, never chance:
//
//  1. TAUGHT   — the child showed / corrected / reminded him with pictures.
//                He acts on his current hypothesis (the shared features of
//                those pictures). One example can be misleading: shown one
//                blue car, he may think BLUE = car, until a second, different
//                example corrects him.
//  2. FADING   — he was taught, but the child's own review of the word is due
//                (spaced repetition). He is "not sure any more" and asks the
//                child to remind him instead of guessing.
//  3. MIXES UP — never taught, and the word has a look-alike he also does not
//                know (CAT↔DOG, RED↔BLUE, OPEN↔CLOSE, ON↔UNDER, TWO↔THREE…).
//                He consistently takes one for the other.
//  4. ASKS     — never taught, and no look-alike, or he already knows the
//                look-alike ("I know DOG — so this must be a new word").
//                He asks the child to show him.
// ---------------------------------------------------------------------------
import type { ExampleEffect } from './alienMind';
import { activeGuess, candidateFeatures, emptyConcept, examplesOf, hasFeature, negativesOf, snapshot, teachExample } from './alienMind';
import { isDueForReview } from './learning';
import { introduceWord, recordDelayedReview, recordWordAttempt, setConcept, syncAbility } from './session';
import { initialSupport, type SupportState } from './hints';
import { WORDS_BY_ID } from '../content/words';
import type { Feature, ItemSpec, KosmoSource, KosmoWord, MixupRoundDef, SaveData, Understanding } from './types';

/** Grammar pseudo-words Kosmo learns in sentences, and what he says until taught. */
export const GRAMMAR: Record<string, { token: string; mixToken: string; labelHe: string }> = {
  are: { token: 'ARE', mixToken: 'IS', labelHe: 'ARE — כשיש יותר מאחד' },
};

/** Examples Kosmo picks up outside the "teach Kosmo" steps — leaves room for those steps. */
export const MAX_OUTSIDE_EXAMPLES = 2;

export type KosmoBelief =
  | { kind: 'taught'; feature: Feature }
  | { kind: 'mixes'; feature: Feature; withWord: string }
  | { kind: 'fading' }
  | { kind: 'asks'; knowsLookAlike?: string };

export function kosmoTaught(d: SaveData, wordId: string): boolean {
  if (GRAMMAR[wordId]) return !!d.alien.lexicon[wordId]?.knows;
  return examplesOf(d.alien.concepts[wordId]).length > 0;
}

export function kosmoBelief(d: SaveData, wordId: string, now: number): KosmoBelief {
  const w = WORDS_BY_ID[wordId];
  const k = d.alien.concepts[wordId];
  const ex = examplesOf(k);
  if (ex.length) {
    if (isDueForReview(d.learning[wordId], now)) return { kind: 'fading' };
    const g = activeGuess(candidateFeatures(ex, negativesOf(k)));
    return g ? { kind: 'taught', feature: g } : { kind: 'asks' };
  }
  const mix = w?.kosmoMixesUp;
  if (mix) {
    if (kosmoTaught(d, mix)) return { kind: 'asks', knowsLookAlike: mix };
    return { kind: 'mixes', feature: WORDS_BY_ID[mix].target, withWord: mix };
  }
  return { kind: 'asks' };
}

export function kosmoUnderstanding(d: SaveData, wordId: string): Understanding {
  const w = WORDS_BY_ID[wordId];
  return w ? snapshot(w.target, d.alien.concepts[wordId]).understanding : 'unknown';
}

// ------------------------------- learning ---------------------------------

export interface KosmoLearnResult {
  data: SaveData;
  effect: ExampleEffect | 'grammar' | 'none';
  /** Kosmo's guess before / after (for his reaction line). */
  before: Feature | null;
  after: Feature | null;
  gainedAbility: boolean;
}

function touchLexicon(d: SaveData, wordId: string, source: KosmoSource, now: number, extra: Partial<KosmoWord> = {}): SaveData {
  const cur: KosmoWord = d.alien.lexicon[wordId] ?? { first: source, firstAt: now, lastAt: now, shown: 0, fixed: 0, reminded: 0, usedRight: 0 };
  const next: KosmoWord = {
    ...cur,
    lastAt: now,
    shown: cur.shown + (source === 'show' ? 1 : 0),
    fixed: cur.fixed + (source === 'fix' ? 1 : 0),
    reminded: cur.reminded + (source === 'remind' ? 1 : 0),
    ...extra,
  };
  return { ...d, alien: { ...d.alien, lexicon: { ...d.alien.lexicon, [wordId]: next } } };
}

/**
 * The child teaches Kosmo a word with a picture (shows it, corrects him, or
 * reminds him). Kosmo only keeps examples that change his mind — the same rule
 * as in the teach steps — so his knowledge stays small and explainable.
 */
export function kosmoLearns(d: SaveData, wordId: string, picture: ItemSpec | null, source: KosmoSource, now: number): KosmoLearnResult {
  if (GRAMMAR[wordId]) return { data: touchLexicon(d, wordId, source, now, { knows: true }), effect: 'grammar', before: null, after: null, gainedAbility: false };
  const w = WORDS_BY_ID[wordId];
  if (!w) return { data: d, effect: 'none', before: null, after: null, gainedAbility: false };
  let out = touchLexicon(d, wordId, source, now);
  const k = { ...(out.alien.concepts[wordId] ?? emptyConcept(wordId)), heard: true };
  const before = snapshot(w.target, k).guess;
  if (!picture || !hasFeature(picture, w.target)) return { data: out, effect: 'none', before, after: before, gainedAbility: false };
  if (k.examples.length >= MAX_OUTSIDE_EXAMPLES && source !== 'teach') return { data: out, effect: 'no_change', before, after: before, gainedAbility: false };
  const r = teachExample(k, w.target, picture, now);
  if (!['first', 'progress', 'new_guess', 'resolved'].includes(r.effect)) return { data: out, effect: r.effect, before, after: before, gainedAbility: false };
  out = setConcept(out, r.knowledge);
  const s = syncAbility(out, wordId);
  return { data: s.data, effect: r.effect, before, after: r.after.guess, gainedAbility: s.gained };
}

/** Kosmo used words right by himself — the child's teaching paid off. */
export function kosmoUsedRight(d: SaveData, wordIds: string[], now: number): SaveData {
  let out = d;
  for (const id of wordIds) {
    const cur = out.alien.lexicon[id];
    if (cur) out = { ...out, alien: { ...out.alien, lexicon: { ...out.alien.lexicon, [id]: { ...cur, usedRight: cur.usedRight + 1, lastAt: now } } } };
    else if (kosmoTaught(out, id)) out = touchLexicon(out, id, 'teach', now, { usedRight: 1 });
  }
  return out;
}

/** Words Kosmo has been taught (directly or in a teach step), newest first. */
export function kosmoDictionary(d: SaveData): { wordId: string; entry: KosmoWord | null; understanding: Understanding }[] {
  const ids = new Set<string>([...Object.keys(d.alien.lexicon), ...Object.keys(d.alien.concepts).filter((id) => kosmoTaught(d, id))]);
  return [...ids]
    .filter((id) => kosmoTaught(d, id))
    .map((id) => ({ wordId: id, entry: d.alien.lexicon[id] ?? null, understanding: GRAMMAR[id] ? ('understood' as Understanding) : kosmoUnderstanding(d, id) }))
    .sort((a, b) => (b.entry?.lastAt ?? 0) - (a.entry?.lastAt ?? 0));
}

// ------------------------------- missions ---------------------------------

export type MissionPlan =
  | { mode: 'tries'; pick: number; correct: boolean; mixedWith?: string }
  | { mode: 'asks'; reason: 'unknown' | 'lookalike' | 'fading' | 'unsure'; wordId?: string; lookAlike?: string };

/**
 * What Kosmo does with a mission request (e.g. "RED APPLE") among the pictures
 * on screen. He tries only when his beliefs single out exactly one picture.
 */
export function planMissionStep(d: SaveData, wordIds: string[], options: { item?: ItemSpec; correct: boolean }[], now: number): MissionPlan {
  const beliefs = wordIds.map((w) => ({ w, b: kosmoBelief(d, w, now) }));
  const fading = beliefs.find((x) => x.b.kind === 'fading');
  if (fading) return { mode: 'asks', reason: 'fading', wordId: fading.w };
  const asks = beliefs.find((x) => x.b.kind === 'asks');
  if (asks && asks.b.kind === 'asks') return { mode: 'asks', reason: asks.b.knowsLookAlike ? 'lookalike' : 'unknown', wordId: asks.w, lookAlike: asks.b.knowsLookAlike };
  const features = beliefs.map((x) => (x.b.kind === 'taught' || x.b.kind === 'mixes' ? x.b.feature : null));
  const fits = options.map((o, i) => ({ o, i })).filter(({ o }) => o.item && features.every((f) => f && hasFeature(o.item!, f)));
  if (fits.length !== 1) return { mode: 'asks', reason: 'unsure' };
  const mixed = beliefs.find((x) => x.b.kind === 'mixes');
  return { mode: 'tries', pick: fits[0].i, correct: fits[0].o.correct, mixedWith: mixed && mixed.b.kind === 'mixes' ? mixed.b.withWord : undefined };
}

// ------------------------------- mix-ups ----------------------------------

export type MixupMode = 'right' | 'wrong' | 'gap';

export interface MixupPlan {
  mode: MixupMode;
  /** What Kosmo says, word by word ('___' = he leaves a gap and asks). */
  kosmoTokens: string[];
  /** Why there is a gap. */
  reason?: 'unknown' | 'lookalike' | 'fading' | 'unsure';
  lookAlike?: string;
}

/** BALLS → APPLES, BOXES → KEYS… keep the plural of the right word on the mixed-up word. */
export function inflectLike(word: string, right: string, base: string): string {
  if (right === base) return word;
  const plural = /(S|X|SH|CH)$/.test(word) ? `${word}ES` : `${word}S`;
  return right === `${base}S` || right === `${base}ES` ? plural : word;
}

export function planMixup(d: SaveData, r: MixupRoundDef, now: number): MixupPlan {
  const right = r.tokens[r.focusAt];
  const say = (t: string) => r.tokens.map((x, i) => (i === r.focusAt ? t : x));
  const g = GRAMMAR[r.focus];
  if (g) return d.alien.lexicon[r.focus]?.knows ? { mode: 'right', kosmoTokens: r.tokens } : { mode: 'wrong', kosmoTokens: say(g.mixToken) };
  const base = WORDS_BY_ID[r.focus].english;
  const b = kosmoBelief(d, r.focus, now);
  if (b.kind === 'taught') return hasFeature(r.picture, b.feature) ? { mode: 'right', kosmoTokens: r.tokens } : { mode: 'gap', kosmoTokens: say('___'), reason: 'unsure' };
  if (b.kind === 'mixes') return { mode: 'wrong', kosmoTokens: say(inflectLike(WORDS_BY_ID[b.withWord].english, right, base)) };
  if (b.kind === 'fading') return { mode: 'gap', kosmoTokens: say('___'), reason: 'fading' };
  return { mode: 'gap', kosmoTokens: say('___'), reason: b.knowsLookAlike ? 'lookalike' : 'unknown', lookAlike: b.knowsLookAlike };
}

export interface MixupRoundResult {
  /** No mistake and no hint. */
  perfect: boolean;
  /** The child ended with the right answer by themselves (not by Kosmo correcting them). */
  caught: boolean;
  plan: MixupPlan;
}

/** Record one finished round: the child's learning data, then what Kosmo learned from the child. */
export function applyMixupRound(d: SaveData, round: MixupRoundDef, r: MixupRoundResult, s: SupportState, taskId: string, t: number): SaveData {
  const confirmOnly = r.plan.mode === 'right';
  const wasDue = new Set(round.wordIds.filter((w) => isDueForReview(d.learning[w], t)));
  let out = round.wordIds.reduce((acc, w) => {
    let x = introduceWord(acc, w, t);
    const base = { wordId: w, taskId, taskType: 'fix_kosmo' as const, phase: 'learn' as const, context: 'new' as const, now: t };
    // Confirming an answer Kosmo showed = success WITH support, never "independent".
    if (r.perfect && confirmOnly) return recordWordAttempt(x, { ...base, outcome: 'correct', attemptNumber: 1, support: { ...initialSupport, used: ['shown_by_kosmo'] }, completed: true });
    if (r.perfect) x = recordWordAttempt(x, { ...base, outcome: 'correct', attemptNumber: 1, support: initialSupport, completed: true });
    else {
      x = recordWordAttempt(x, { ...base, outcome: 'wrong', attemptNumber: 1, support: initialSupport, completed: false });
      if (r.caught) x = recordWordAttempt(x, { ...base, outcome: 'correct', attemptNumber: 2, support: s, completed: true });
    }
    // Kosmo forgot a word whose review was due: the child's answer is a delayed review.
    if (wasDue.has(w) && r.plan.mode === 'gap' && r.plan.reason === 'fading') x = recordDelayedReview(x, w, r.perfect, s.used.length > 0, true, t);
    return x;
  }, d);
  if (r.plan.mode === 'right') out = kosmoUsedRight(out, [round.focus], t);
  else {
    const source: KosmoSource = r.plan.mode === 'wrong' ? 'fix' : r.plan.reason === 'fading' ? 'remind' : 'show';
    out = kosmoLearns(out, round.focus, round.picture, source, t).data;
  }
  return out;
}

