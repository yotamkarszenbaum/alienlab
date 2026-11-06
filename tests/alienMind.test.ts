import { describe, expect, it } from 'vitest';
import {
  alienChoose,
  buildRepairOptions,
  buildTestScene,
  emptyConcept,
  hasFeature,
  isHelpful,
  sharedFeatures,
  snapshot,
  teachExample,
  teachNegative,
  understandingOf,
} from '../src/engine/alienMind';
import { item, itemId, items, parseItemId, placed, describeItemHe } from '../src/content/items';
import { getWord } from '../src/content/words';

const RED = getWord('red');
const BIG = getWord('big');
const DOG = getWord('dog');
const OPEN = getWord('open');

describe('alien mind — RED walkthrough from the spec', () => {
  it('one red apple -> misconception "RED = apple" -> picks a green apple', () => {
    let k = emptyConcept('red');
    const r1 = teachExample(k, RED.target, item('apple', 'red'), 1);
    k = r1.knowledge;
    expect(r1.effect).toBe('first');
    expect(r1.after.understanding).toBe('misconception');
    expect(r1.after.guess).toEqual({ dim: 'kind', value: 'apple' });
    expect(k.misconceptions).toHaveLength(1);

    const scene = buildTestScene(RED.target, k, RED.teach!.testPool, 0);
    expect(scene).toHaveLength(3);
    const choice = alienChoose(scene, RED.target, k);
    expect(choice).not.toBeNull();
    const chosen = scene[choice!];
    expect(chosen.kind).toBe('apple');
    expect(chosen.color).not.toBe('red'); // e.g. a green apple — wrong, but explainable
    // the scene contains exactly one correct red non-apple
    expect(scene.filter((i) => hasFeature(i, RED.target))).toHaveLength(1);

    // decision is deterministic (no randomness)
    expect(alienChoose(scene, RED.target, k)).toBe(choice);
  });

  it('another red apple does not help; a red ball fixes the misconception', () => {
    let k = teachExample(emptyConcept('red'), RED.target, item('apple', 'red'), 1).knowledge;
    // same-kind example: alien learns nothing new
    const same = teachExample(k, RED.target, item('apple', 'red'), 2);
    expect(same.effect).toBe('duplicate');
    // a non-red item is rejected and NOT learned
    const wrong = teachExample(k, RED.target, item('ball', 'blue'), 3);
    expect(wrong.effect).toBe('invalid');
    expect(wrong.knowledge.examples).toHaveLength(1);
    expect(wrong.knowledge.rejected).toContain(itemId(item('ball', 'blue')));

    const fix = teachExample(k, RED.target, item('ball', 'red'), 4);
    expect(fix.effect).toBe('resolved');
    k = fix.knowledge;
    expect(understandingOf(RED.target, k)).toBe('understood');
    expect(k.corrections).toHaveLength(1);
    expect(k.corrections[0].before).toEqual({ dim: 'kind', value: 'apple' });
    expect(k.corrections[0].after).toEqual({ dim: 'color', value: 'red' });

    const scene = buildTestScene(RED.target, k, RED.teach!.testPool, 1);
    const chosen = scene[alienChoose(scene, RED.target, k)!];
    expect(chosen.color).toBe('red');
    expect(chosen.kind).not.toBe('apple');
    expect(chosen.kind).not.toBe('ball');
  });

  it('repair options include a helpful, an unhelpful and a non-example', () => {
    const k = teachExample(emptyConcept('red'), RED.target, item('apple', 'red'), 1).knowledge;
    const opts = buildRepairOptions(RED.target, k, [...RED.teach!.testPool, ...RED.teach!.pool], 0);
    expect(opts.length).toBeGreaterThanOrEqual(3);
    expect(opts.some((o) => isHelpful(o.effect))).toBe(true);
    expect(opts.some((o) => o.effect === 'invalid')).toBe(true);
  });
});

describe('alien mind — other concept types', () => {
  it('DOG: one brown dog = partial understanding, still picks a dog of another colour', () => {
    const r = teachExample(emptyConcept('dog'), DOG.target, item('dog', 'brown'), 1);
    expect(r.after.understanding).toBe('partial');
    const scene = buildTestScene(DOG.target, r.knowledge, DOG.teach!.testPool, 0);
    const chosen = scene[alienChoose(scene, DOG.target, r.knowledge)!];
    expect(chosen.kind).toBe('dog');
    expect(chosen.color).not.toBe('brown');
    // child confirms -> alien now understands any dog
    const r2 = teachExample(r.knowledge, DOG.target, chosen, 2);
    expect(r2.after.understanding).toBe('understood');
  });

  it('BIG: big blue ball -> "BIG = ball"; big blue cup -> new wrong guess "BIG = blue"; big yellow star -> understood', () => {
    let k = teachExample(emptyConcept('big'), BIG.target, item('ball', 'blue', 'big'), 1).knowledge;
    expect(snapshot(BIG.target, k).guess).toEqual({ dim: 'kind', value: 'ball' });
    const scene = buildTestScene(BIG.target, k, BIG.teach!.testPool, 0);
    const chosen = scene[alienChoose(scene, BIG.target, k)!];
    expect(chosen.kind).toBe('ball');
    expect(chosen.size).toBe('small');

    const r2 = teachExample(k, BIG.target, item('cup', 'blue', 'big'), 2);
    expect(r2.effect).toBe('new_guess');
    expect(r2.after.guess).toEqual({ dim: 'color', value: 'blue' });
    k = r2.knowledge;
    const r3 = teachExample(k, BIG.target, item('star', 'yellow', 'big'), 3);
    expect(r3.effect).toBe('resolved');
    expect(r3.knowledge.misconceptions.map((m) => m.feature.value)).toEqual(['ball', 'blue']);
  });

  it('OPEN: open door -> "OPEN = door" -> open box resolves', () => {
    const k = teachExample(emptyConcept('open'), OPEN.target, item('door', 'brown', 'normal', 'open'), 1).knowledge;
    expect(snapshot(OPEN.target, k).understanding).toBe('misconception');
    const scene = buildTestScene(OPEN.target, k, OPEN.teach!.testPool, 0);
    const chosen = scene[alienChoose(scene, OPEN.target, k)!];
    expect(chosen.kind).toBe('door');
    expect(chosen.state).toBe('closed');
    const r = teachExample(k, OPEN.target, item('box', 'red', 'normal', 'open'), 2);
    expect(r.after.understanding).toBe('understood');
  });

  it('every generated scene has exactly one item matching the alien guess', () => {
    for (const w of [RED, BIG, DOG, OPEN, getWord('green'), getWord('close'), getWord('under')]) {
      for (const ex of w.teach!.pool.filter((i) => hasFeature(i, w.target))) {
        const k = teachExample(emptyConcept(w.id), w.target, ex, 1).knowledge;
        const g = sharedFeatures([ex])[0];
        for (let v = 0; v < 5; v++) {
          const scene = buildTestScene(w.target, k, w.teach!.testPool, v);
          expect(scene.length).toBe(3);
          expect(scene.filter((i) => hasFeature(i, g)).length).toBe(1);
        }
      }
    }
  });
});

describe('alien mind — counter-examples (level 3)', () => {
  it('red apple + "a green apple is NOT red" -> understood', () => {
    const k = teachExample(emptyConcept('red'), RED.target, item('apple', 'red'), 1).knowledge;
    const r = teachNegative(k, RED.target, item('apple', 'green'), 2);
    expect(r.effect).toBe('resolved');
    expect(r.after.guess).toEqual({ dim: 'color', value: 'red' });
    expect(r.knowledge.negatives).toEqual(['apple.green.normal.none']);
    expect(r.knowledge.examples).toHaveLength(1);
  });
  it('a red item cannot be a counter-example for RED', () => {
    const k = teachExample(emptyConcept('red'), RED.target, item('apple', 'red'), 1).knowledge;
    const r = teachNegative(k, RED.target, item('ball', 'red'), 2);
    expect(r.effect).toBe('invalid');
    expect(r.knowledge.negatives).toHaveLength(0);
  });
  it('an unrelated counter-example teaches nothing new', () => {
    const k = teachExample(emptyConcept('red'), RED.target, item('apple', 'red'), 1).knowledge;
    const r = teachNegative(k, RED.target, item('ball', 'blue'), 2);
    expect(r.effect).toBe('no_change');
    expect(understandingOf(RED.target, r.knowledge)).toBe('misconception');
  });
  it('counter-example before any example is stored, alien still has no guess', () => {
    const r = teachNegative(emptyConcept('red'), RED.target, item('ball', 'blue'), 1);
    expect(r.effect).toBe('first');
    expect(r.after.guess).toBeNull();
  });
  it('the alien test reflects counter-examples (deterministic)', () => {
    let k = teachExample(emptyConcept('big'), BIG.target, item('ball', 'blue', 'big'), 1).knowledge;
    k = teachNegative(k, BIG.target, item('ball', 'blue', 'small'), 2).knowledge; // removes kind AND colour
    expect(understandingOf(BIG.target, k)).toBe('understood');
    const scene = buildTestScene(BIG.target, k, BIG.teach!.testPool, 0);
    expect(scene.some((i) => i.kind === 'ball' && i.color === 'blue' && i.size === 'small')).toBe(false); // never re-shown
    expect(scene[alienChoose(scene, BIG.target, k)!].size).toBe('big');
  });
});

describe('numbers and positions (level 3)', () => {
  it('ids round-trip and old ids still parse', () => {
    const a = items(3, 'cat', 'gray', { rel: { pos: 'on', ref: 'table' } });
    expect(parseItemId(itemId(a))).toEqual(a);
    expect(itemId(placed('ball', 'red', 'under'))).toBe('ball.red.normal.none.under-table');
    expect(parseItemId('apple.red.normal.none')).toEqual(item('apple', 'red'));
    expect(describeItemHe(a)).toBe('שלושה חתולים אפורים על השולחן');
    expect(describeItemHe(placed('key', 'yellow', 'in'))).toBe('מפתח צהוב בתוך הקופסה');
  });
  it('UNDER: one red ball under the table -> "UNDER = ball"; a cat under the table fixes it', () => {
    const UNDER = getWord('under');
    let k = teachExample(emptyConcept('under'), UNDER.target, placed('ball', 'red', 'under'), 1).knowledge;
    expect(understandingOf(UNDER.target, k)).toBe('misconception');
    const scene = buildTestScene(UNDER.target, k, UNDER.teach!.testPool, 0);
    const chosen = scene[alienChoose(scene, UNDER.target, k)!];
    expect(chosen.kind).toBe('ball');
    expect(chosen.rel?.pos).not.toBe('under');
    const r = teachExample(k, UNDER.target, placed('cat', 'gray', 'under'), 2);
    expect(r.effect).toBe('resolved');
    k = r.knowledge;
    const scene2 = buildTestScene(UNDER.target, k, UNDER.teach!.testPool, 1);
    expect(scene2[alienChoose(scene2, UNDER.target, k)!].rel?.pos).toBe('under');
  });
  it('TWO is a count feature: two red balls are not "three"', () => {
    const TWO = getWord('two');
    expect(hasFeature(items(2, 'ball', 'red'), TWO.target)).toBe(true);
    expect(hasFeature(items(3, 'ball', 'red'), TWO.target)).toBe(false);
    expect(hasFeature(item('ball', 'red'), TWO.target)).toBe(false);
  });
});
