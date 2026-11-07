import { describe, expect, it } from 'vitest';
import { newSave, normalize } from '../src/engine/storage';
import { kosmoLearns } from '../src/engine/kosmo';
import { brainChange, brainTimeline, brainView, diagnoseOptions, linksOf } from '../src/engine/brain';
import { commandKey, commandMatches, commandText, workshopChips, workshopOpen, WORKSHOP_SCENES } from '../src/engine/workshop';
import { buildPictureToWord, contextPicture, pictureShows } from '../src/engine/tasks';
import { masteryOf } from '../src/engine/mastery';
import { introduceWord, recordDelayedReview, recordWordAttempt } from '../src/engine/session';
import { initialSupport } from '../src/engine/hints';
import { item } from '../src/content/items';
import { sameItem } from '../src/content/items';
import { WORDS, WORDS_BY_ID } from '../src/content/words';
import type { SaveData, TaskType } from '../src/engine/types';

const T0 = 1_800_000_000_000;
const fresh = (): SaveData => newSave(T0);

describe("1. Cosmo's Brain — the map is the real model", () => {
  it('one red apple: RED is linked to "apple" (what he thinks) and maybe "red"; a red car cuts "apple"', () => {
    let d = kosmoLearns(fresh(), 'red', item('apple', 'red'), 'teach', T0).data;
    const v1 = brainView(d, 'red');
    expect(v1.understanding).toBe('misconception');
    expect(v1.links).toEqual([
      { feature: { dim: 'kind', value: 'apple' }, state: 'guess' },
      { feature: { dim: 'color', value: 'red' }, state: 'possible' },
    ]);
    const before = d.alien.concepts.red;
    d = kosmoLearns(d, 'red', item('car', 'red'), 'fix', T0 + 1).data;
    const v2 = brainView(d, 'red');
    expect(v2.understanding).toBe('understood');
    expect(v2.links).toContainEqual({ feature: { dim: 'color', value: 'red' }, state: 'guess' });
    expect(v2.links).toContainEqual({ feature: { dim: 'kind', value: 'apple' }, state: 'cut' });
    // the change card for this teaching moment
    expect(brainChange('red', before, d.alien.concepts.red)).toMatchObject({ before: { dim: 'kind', value: 'apple' }, after: { dim: 'color', value: 'red' }, understandingAfter: 'understood' });
    // and the timeline remembers which picture did it
    expect(brainTimeline(d)[0]).toMatchObject({ wordId: 'red', before: { dim: 'kind', value: 'apple' }, after: { dim: 'color', value: 'red' } });
  });

  it('a word never taught shows the look-alike he mixes it up with, until he knows that one', () => {
    let d = fresh();
    expect(brainView(d, 'cat')).toMatchObject({ links: [], mixupWith: 'dog' });
    d = kosmoLearns(d, 'dog', item('dog', 'brown'), 'show', T0).data;
    expect(brainView(d, 'cat').mixupWith).toBeUndefined();
  });

  it('counter-examples cut links too', () => {
    const d = kosmoLearns(fresh(), 'red', item('apple', 'red'), 'teach', T0).data;
    const k = { ...d.alien.concepts.red, negatives: ['apple.green.normal.none'] };
    expect(linksOf(k)).toContainEqual({ feature: { dim: 'kind', value: 'apple' }, state: 'cut' });
  });
});

describe("2. Cosmo's Mistakes — the child diagnoses before repairing", () => {
  it('the right answer is what Kosmo really thinks; the real meaning is a tempting wrong answer', () => {
    const d = kosmoLearns(fresh(), 'red', item('apple', 'red'), 'teach', T0).data;
    const opts = diagnoseOptions(WORDS_BY_ID.red, d.alien.concepts.red)!;
    expect(opts).toHaveLength(3);
    expect(opts.filter((o) => o.correct).map((o) => o.labelHe)).toEqual(['תפוח']);
    expect(opts.some((o) => !o.correct && o.labelHe === 'הצבע האדום')).toBe(true);
    expect(new Set(opts.map((o) => o.key)).size).toBe(3);
  });

  it('nothing to diagnose when he understands, or has no idea yet', () => {
    let d = kosmoLearns(fresh(), 'red', item('apple', 'red'), 'teach', T0).data;
    d = kosmoLearns(d, 'red', item('car', 'red'), 'teach', T0).data;
    expect(diagnoseOptions(WORDS_BY_ID.red, d.alien.concepts.red)).toBeNull();
    expect(diagnoseOptions(WORDS_BY_ID.red, undefined)).toBeNull();
  });
});

describe('3. Teach & Unlock — the workshop uses only what the child taught', () => {
  it('opens after 3 taught words; chips are locked until taught', () => {
    let d = fresh();
    expect(workshopOpen(d)).toBe(false);
    for (const [w, i] of [['ball', item('ball', 'blue')], ['red', item('ball', 'red')], ['apple', item('apple', 'green')]] as const) d = kosmoLearns(d, w, i, 'show', T0).data;
    expect(workshopOpen(d)).toBe(true);
    const chips = workshopChips(d, WORKSHOP_SCENES[0]);
    expect(chips.find((c) => c.wordId === 'ball')?.unlocked).toBe(true);
    expect(chips.find((c) => c.wordId === 'dog')?.unlocked).toBe(false);
    // only words that describe something in the scene appear
    expect(chips.some((c) => c.wordId === 'key')).toBe(false);
  });

  it('an instruction must fit exactly one thing ("BALL" fits two, "RED BALL" fits one); word order is English', () => {
    const s = WORKSHOP_SCENES[0];
    expect(commandMatches(s, ['ball'])).toHaveLength(2);
    expect(commandMatches(s, ['ball', 'red'])).toHaveLength(1);
    expect(commandText(['ball', 'red', 'big'])).toBe('BIG RED BALL');
    expect(commandKey(['ball', 'red'])).toBe(commandKey(['red', 'ball']));
  });

  it('every scene allows several precise instructions', () => {
    const singles = (s: (typeof WORKSHOP_SCENES)[number]) =>
      WORDS.filter((w) => ['kind', 'color', 'size', 'state'].includes(w.target.dim)).flatMap((a) =>
        WORDS.filter((b) => b.id > a.id && b.target.dim !== a.target.dim).filter((b) => commandMatches(s, [a.id, b.id]).length === 1),
      );
    for (const s of WORKSHOP_SCENES) expect(singles(s).length).toBeGreaterThanOrEqual(4);
  });
});

describe('4. Memory missions — new contexts, recall the word', () => {
  it('the picture is never one the word was learned with, and it really shows the word', () => {
    for (const w of WORDS)
      for (let seed = 0; seed < 6; seed++) {
        const p = contextPicture(w, seed);
        expect(pictureShows(p, w), `${w.id}/${seed}`).toBe(true);
        if (WORDS_BY_ID[w.id].positiveExamples.length < 30) expect(w.positiveExamples.some((e) => sameItem(e, p)), `${w.id}/${seed} is new`).toBe(false);
      }
  });

  it('picture → word with exactly one right word among the options', () => {
    const introduced = WORDS.map((w) => w.id);
    for (const w of WORDS) {
      const q = buildPictureToWord(w, introduced, { optionCount: 4, variant: 1, taskId: 't', picture: contextPicture(w, 2) });
      expect(q.mode).toBe('picture_to_word');
      expect(q.options.filter((o) => o.correct).map((o) => o.wordId)).toEqual([w.id]);
      for (const o of q.options.filter((o) => !o.correct)) expect(pictureShows(q.picture!, WORDS_BY_ID[o.wordId!]), `${w.id}: ${o.wordId} would also fit`).toBe(false);
    }
  });
});

describe('5. Mastery map — five milestones from real actions only', () => {
  const attempt = (d: SaveData, w: string, taskType: TaskType, ok: boolean, hint = false) =>
    recordWordAttempt(d, { wordId: w, taskId: 't', taskType, outcome: ok ? 'correct' : 'wrong', attemptNumber: 1, support: hint ? { ...initialSupport, used: ['verbal'] } : initialSupport, completed: ok, phase: 'learn', context: 'new', now: T0 });

  it('each milestone needs its own kind of evidence', () => {
    let d = introduceWord(fresh(), 'ball', T0);
    expect(masteryOf(d.learning.ball)).toEqual({ meaning: false, alone: false, recall: false, context: false, later: false });
    d = attempt(d, 'ball', 'word_to_picture', true, true); // with a hint
    expect(masteryOf(d.learning.ball)).toMatchObject({ meaning: true, alone: false });
    d = attempt(d, 'ball', 'word_to_picture', true);
    expect(masteryOf(d.learning.ball)).toMatchObject({ alone: true, recall: false, context: false });
    d = attempt(d, 'ball', 'picture_to_word', true);
    expect(masteryOf(d.learning.ball).recall).toBe(true);
    d = attempt(d, 'ball', 'mission', true);
    expect(masteryOf(d.learning.ball).context).toBe(true);
    expect(masteryOf(d.learning.ball).later).toBe(false);
    d = recordDelayedReview(d, 'ball', true, false, true, T0 + 2 * 86400000);
    expect(masteryOf(d.learning.ball).later).toBe(true);
  });

  it('confirming what Kosmo showed lights nothing beyond "meaning"', () => {
    let d = introduceWord(fresh(), 'cat', T0);
    d = recordWordAttempt(d, { wordId: 'cat', taskId: 't', taskType: 'check_alien', outcome: 'correct', attemptNumber: 1, support: { ...initialSupport, used: ['shown_by_kosmo'] }, completed: true, phase: 'learn', context: 'new', now: T0 });
    expect(masteryOf(d.learning.cat)).toEqual({ meaning: true, alone: false, recall: false, context: false, later: false });
  });

  it('older saves: recall / context are rebuilt from the attempt log', () => {
    let d = introduceWord(fresh(), 'dog', T0);
    d = attempt(d, 'dog', 'picture_to_word', true);
    d = attempt(d, 'dog', 'fill_blank', true);
    const raw = JSON.parse(JSON.stringify(d));
    delete raw.learning.dog.recallIndependent;
    delete raw.learning.dog.contextUse;
    const back = normalize(raw, T0);
    expect(back.learning.dog.recallIndependent).toBe(2);
    expect(back.learning.dog.contextUse).toBe(1);
    expect(back.game.workshopParts).toEqual([]);
  });
});
