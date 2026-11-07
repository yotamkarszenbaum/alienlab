import { describe, expect, it } from 'vitest';
import { newSave, normalize } from '../src/engine/storage';
import { applyMixupRound, inflectLike, kosmoBelief, kosmoDictionary, kosmoLearns, MAX_OUTSIDE_EXAMPLES, planMissionStep, planMixup } from '../src/engine/kosmo';
import { introduceWord, recordDelayedReview, recordWordAttempt } from '../src/engine/session';
import { initialSupport } from '../src/engine/hints';
import { buildMissionQuestion } from '../src/engine/tasks';
import { DAY } from '../src/engine/learning';
import { examplesOf } from '../src/engine/alienMind';
import { item, items, placed } from '../src/content/items';
import { MISSIONS_BY_ID } from '../src/content/units';
import type { MixupRoundDef, SaveData } from '../src/engine/types';

const T0 = 1_800_000_000_000;
const fresh = (): SaveData => newSave(T0);
const round = (r: Partial<MixupRoundDef> & Pick<MixupRoundDef, 'picture' | 'tokens' | 'focusAt' | 'focus'>): MixupRoundDef => ({
  id: 'r',
  choices: [r.tokens[r.focusAt]],
  hebrew: '',
  tipHe: '',
  wordIds: [],
  ...r,
});

describe('Kosmo knows only what the child taught him', () => {
  it('untaught word with an unknown look-alike → a consistent mix-up; once the look-alike is taught → he asks', () => {
    let d = fresh();
    expect(kosmoBelief(d, 'cat', T0)).toMatchObject({ kind: 'mixes', withWord: 'dog' });
    expect(kosmoBelief(d, 'cat', T0)).toEqual(kosmoBelief(d, 'cat', T0)); // no randomness
    d = kosmoLearns(d, 'dog', item('dog', 'brown'), 'show', T0).data;
    expect(kosmoBelief(d, 'cat', T0)).toEqual({ kind: 'asks', knowsLookAlike: 'dog' });
    expect(kosmoBelief(d, 'dog', T0)).toEqual({ kind: 'taught', feature: { dim: 'kind', value: 'dog' } });
  });

  it('no look-alike → he asks', () => {
    expect(kosmoBelief(fresh(), 'yellow', T0)).toEqual({ kind: 'asks' });
  });

  it('one example can mislead (BLUE = car) until a different example corrects him', () => {
    let d = kosmoLearns(fresh(), 'blue', item('car', 'blue'), 'show', T0).data;
    expect(kosmoBelief(d, 'blue', T0)).toEqual({ kind: 'taught', feature: { dim: 'kind', value: 'car' } });
    const hat = round({ picture: item('hat', 'blue'), tokens: ['MY', 'HAT', 'IS', 'BLUE'], focusAt: 3, focus: 'blue' });
    expect(planMixup(d, hat, T0)).toMatchObject({ mode: 'gap', reason: 'unsure' });
    const r = kosmoLearns(d, 'blue', item('hat', 'blue'), 'show', T0);
    expect(r.effect).toBe('resolved');
    expect(r.before).toEqual({ dim: 'kind', value: 'car' });
    d = r.data;
    const ball = round({ picture: item('ball', 'blue'), tokens: ['A', 'BLUE', 'BALL'], focusAt: 1, focus: 'blue' });
    expect(planMixup(d, ball, T0).mode).toBe('right');
  });

  it('only examples that change his mind are kept, and only a few outside the teach steps', () => {
    let d = fresh();
    d = kosmoLearns(d, 'red', item('ball', 'red'), 'show', T0).data;
    const dup = kosmoLearns(d, 'red', item('ball', 'red'), 'show', T0);
    expect(dup.effect).toBe('duplicate');
    d = kosmoLearns(d, 'red', item('apple', 'red'), 'fix', T0).data;
    d = kosmoLearns(d, 'red', item('car', 'red'), 'fix', T0).data;
    expect(examplesOf(d.alien.concepts.red).length).toBeLessThanOrEqual(MAX_OUTSIDE_EXAMPLES);
    // a picture that does not show the word teaches nothing
    expect(kosmoLearns(d, 'red', item('ball', 'blue'), 'show', T0).effect).toBe('none');
  });

  it('teaching through activities can also give Kosmo an ability (same rule as the teach step)', () => {
    let d = fresh();
    d = kosmoLearns(d, 'red', item('ball', 'red'), 'show', T0).data;
    const r = kosmoLearns(d, 'red', item('apple', 'red'), 'show', T0);
    expect(r.gainedAbility).toBe(true);
    expect(r.data.alien.abilities).toContain('sort-colors');
  });

  it('his dictionary lists what the child taught, how, and how often he used it right', () => {
    let d = kosmoLearns(fresh(), 'ball', item('ball', 'red'), 'fix', T0).data;
    const dict = kosmoDictionary(d);
    expect(dict.map((x) => x.wordId)).toEqual(['ball']);
    expect(dict[0].entry).toMatchObject({ first: 'fix', fixed: 1, usedRight: 0 });
  });
});

describe('Missions: Kosmo tries first, and the child\'s repair changes what he does next', () => {
  const supply = MISSIONS_BY_ID['m-supply'];
  const ballStep = supply.steps.find((s) => s.promptEn === 'BALL')!;

  it('untaught BALL: he takes the APPLE (his look-alike) — then, shown the ball, he gets it right by himself', () => {
    let d = fresh();
    const q = buildMissionQuestion(ballStep, { variant: 0, taskId: 't' });
    const p1 = planMissionStep(d, ballStep.wordIds, q.options, T0);
    expect(p1.mode).toBe('tries');
    if (p1.mode !== 'tries') return;
    expect(p1.correct).toBe(false);
    expect(q.options[p1.pick].item?.kind).toBe('apple');
    // repair: the child shows him the right picture
    d = kosmoLearns(d, 'ball', ballStep.answer, 'fix', T0).data;
    const q2 = buildMissionQuestion(ballStep, { variant: 3, taskId: 't' });
    const p2 = planMissionStep(d, ballStep.wordIds, q2.options, T0);
    expect(p2).toMatchObject({ mode: 'tries', correct: true });
  });

  it('when he knows the look-alike he asks instead of guessing; when unsure (two fits) he asks too', () => {
    let d = kosmoLearns(fresh(), 'ball', item('ball', 'blue'), 'show', T0).data;
    const appleStep = supply.steps.find((s) => s.promptEn === 'APPLE')!;
    const q = buildMissionQuestion(appleStep, { variant: 0, taskId: 't' });
    expect(planMissionStep(d, appleStep.wordIds, q.options, T0)).toMatchObject({ mode: 'asks', reason: 'lookalike', lookAlike: 'ball' });
    // RED taught only with a red ball → RED = ball; among two red/blue balls… two balls fit → unsure
    d = kosmoLearns(fresh(), 'red', item('ball', 'red'), 'show', T0).data;
    const opts = [{ item: item('ball', 'red'), correct: true }, { item: item('ball', 'blue'), correct: false }, { item: item('cup', 'red'), correct: false }];
    expect(planMissionStep(d, ['red'], opts, T0)).toMatchObject({ mode: 'asks', reason: 'unsure' });
  });
});

describe('Spaced repetition: Kosmo\'s memory fades with the child\'s review schedule', () => {
  function practised(d: SaveData, w: string, at: number) {
    d = introduceWord(d, w, at);
    return recordWordAttempt(d, { wordId: w, taskId: 't', taskType: 'word_to_picture', outcome: 'correct', attemptNumber: 1, support: initialSupport, completed: true, phase: 'learn', context: 'new', now: at });
  }

  it('a taught word becomes "fading" when its review is due, and comes back after the child reminds him', () => {
    let d = practised(fresh(), 'dog', T0);
    d = kosmoLearns(d, 'dog', item('dog', 'brown'), 'show', T0).data;
    expect(kosmoBelief(d, 'dog', T0 + 1000).kind).toBe('taught');
    const later = T0 + 2 * DAY;
    expect(kosmoBelief(d, 'dog', later)).toEqual({ kind: 'fading' });
    const q = buildMissionQuestion(MISSIONS_BY_ID['m-supply'].steps.find((s) => s.promptEn === 'DOG')!, { variant: 0, taskId: 't' });
    expect(planMissionStep(d, ['dog'], q.options, later)).toMatchObject({ mode: 'asks', reason: 'fading' });
    d = recordDelayedReview(d, 'dog', true, false, true, later);
    d = kosmoLearns(d, 'dog', item('dog', 'white'), 'remind', later).data;
    expect(kosmoBelief(d, 'dog', later + 1000).kind).toBe('taught');
    expect(d.learning.dog.delayedReviews).toEqual([{ at: later, result: 'independent' }]);
    expect(d.alien.lexicon.dog.reminded).toBe(1);
  });
});

describe('Mix-up rounds are driven by the same knowledge', () => {
  const dogRound = round({ id: 'x', picture: item('dog', 'brown', 'big'), tokens: ['I', 'SEE', 'A', 'BIG', 'DOG'], focusAt: 4, focus: 'dog', wordIds: ['dog'] });

  it('he says his look-alike, is corrected, and does not repeat the mistake', () => {
    let d = fresh();
    const p = planMixup(d, dogRound, T0);
    expect(p).toMatchObject({ mode: 'wrong', kosmoTokens: ['I', 'SEE', 'A', 'BIG', 'CAT'] });
    d = applyMixupRound(d, dogRound, { perfect: true, caught: true, plan: p }, initialSupport, 't', T0);
    expect(d.alien.lexicon.dog).toMatchObject({ first: 'fix', fixed: 1 });
    const again = round({ ...dogRound, picture: item('dog', 'white') });
    expect(planMixup(d, again, T0).mode).toBe('right');
  });

  it('plurals stay plural (TWO YELLOW STARS → KEYS)', () => {
    const r = round({ picture: items(2, 'key', 'yellow'), tokens: ['I', 'HAVE', 'TWO', 'YELLOW', 'KEYS'], focusAt: 4, focus: 'key' });
    expect(planMixup(fresh(), r, T0).kosmoTokens[4]).toBe('DOORS');
    const b = round({ picture: items(3, 'star', 'yellow'), tokens: ['THREE', 'STARS'], focusAt: 1, focus: 'star' });
    expect(planMixup(fresh(), b, T0).kosmoTokens[1]).toBe('CARS');
    expect(inflectLike('BOX', 'KEYS', 'KEY')).toBe('BOXES');
    expect(inflectLike('BOX', 'KEY', 'KEY')).toBe('BOX');
  });

  it('grammar: he says IS for many things until the child teaches ARE', () => {
    const r = round({ picture: items(3, 'cat', 'gray'), tokens: ['THERE', 'ARE', 'THREE', 'CATS'], focusAt: 1, focus: 'are' });
    let d = fresh();
    const p = planMixup(d, r, T0);
    expect(p.kosmoTokens[1]).toBe('IS');
    d = applyMixupRound(d, r, { perfect: true, caught: true, plan: p }, initialSupport, 't', T0);
    expect(planMixup(d, r, T0).mode).toBe('right');
  });

  it('confirming what Kosmo said counts as success WITH support, filling a gap alone counts as independent', () => {
    let d = kosmoLearns(fresh(), 'dog', item('dog', 'brown'), 'show', T0).data;
    const right = planMixup(d, dogRound, T0);
    expect(right.mode).toBe('right');
    d = applyMixupRound(d, dogRound, { perfect: true, caught: true, plan: right }, initialSupport, 'a', T0);
    const conf = d.attempts.find((a) => a.taskId === 'a')!;
    expect(conf.independent).toBe(false);
    expect(conf.hintTypes).toContain('shown_by_kosmo');
    expect(d.alien.lexicon.dog.usedRight).toBe(1);
    const gapRound = round({ id: 'g', picture: item('ball', 'yellow'), tokens: ['A', 'YELLOW', 'BALL'], focusAt: 1, focus: 'yellow', wordIds: ['yellow'] });
    const gap = planMixup(d, gapRound, T0);
    expect(gap.mode).toBe('gap');
    d = applyMixupRound(d, gapRound, { perfect: true, caught: true, plan: gap }, initialSupport, 'b', T0);
    expect(d.attempts.find((a) => a.taskId === 'b')!.independent).toBe(true);
    // with a hint: not independent, and both the mistake and the helped success are kept
    const pos = round({ id: 'h', picture: placed('ball', 'red', 'under'), tokens: ['THE', 'BALL', 'IS', 'UNDER', 'THE', 'TABLE'], focusAt: 3, focus: 'under', wordIds: ['under'] });
    const ph = planMixup(d, pos, T0);
    d = applyMixupRound(d, pos, { perfect: false, caught: true, plan: ph }, { ...initialSupport, wrong: 1, level: 1, used: ['verbal'] }, 'c', T0);
    const hs = d.attempts.filter((a) => a.taskId === 'c');
    expect(hs.map((a) => a.outcome)).toEqual(['wrong', 'correct']);
    expect(hs.some((a) => a.independent)).toBe(false);
  });
});

describe('Saved data', () => {
  it('older saves without Kosmo\'s dictionary still load; the dictionary is kept on reload', () => {
    const old = JSON.parse(JSON.stringify(fresh())) as Record<string, unknown>;
    delete (old.alien as Record<string, unknown>).lexicon;
    expect(normalize(old, T0).alien.lexicon).toEqual({});
    const d = kosmoLearns(fresh(), 'cat', item('cat', 'gray'), 'show', T0).data;
    const back = normalize(JSON.parse(JSON.stringify(d)), T0);
    expect(back.alien.lexicon.cat).toEqual(d.alien.lexicon.cat);
    expect(back.alien.concepts.cat.examples).toEqual(d.alien.concepts.cat.examples);
  });
});
