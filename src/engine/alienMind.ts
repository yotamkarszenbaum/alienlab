// ---------------------------------------------------------------------------
// The alien's knowledge engine.
//
// How the alien learns (rule based, no randomness):
//  1. Every picture is described by salient features: kind, colour, and —
//     only when they stand out — size (big/small) and state (open/closed).
//  2. The alien's hypothesis for a word = the features shared by ALL the
//     examples the child showed it (set intersection).
//  3. If several features are still possible, the alien guesses with a fixed
//     bias: kind > colour > size > state ("shape bias", like young children).
//  4. In a test the alien picks the item that matches its current guess.
//     So with one red apple, it thinks RED = apple and picks a green apple.
//  5. A corrective example only helps if it removes the wrong feature from
//     the shared set (e.g. a red BALL removes "apple").
//  6. Counter-examples (level 3): an item marked "this is NOT RED" removes
//     every feature it has from the candidates (a GREEN apple removes "apple").
// ---------------------------------------------------------------------------
import type { AlienKnowledge, ConceptKnowledge, Dim, Feature, ItemSpec, Understanding } from './types';
import { adjectiveHe, describeItemHe, itemId, KIND_HE, parseItemId, sameItem } from '../content/items';

export const BIAS: Dim[] = ['kind', 'color', 'size', 'state'];

export const UNDERSTANDING_HE: Record<Understanding, string> = {
  unknown: 'עוד לא שמע את המילה',
  heard: 'שמע את המילה',
  misconception: 'חושב משהו לא נכון',
  partial: 'מבין חלקית',
  understood: 'מבין!',
};

export function salientFeatures(i: ItemSpec): Feature[] {
  const f: Feature[] = [
    { dim: 'kind', value: i.kind },
    { dim: 'color', value: i.color },
  ];
  if (i.size !== 'normal') f.push({ dim: 'size', value: i.size });
  if (i.state !== 'none') f.push({ dim: 'state', value: i.state });
  return f;
}

export function hasFeature(i: ItemSpec, f: Feature): boolean {
  return (i as unknown as Record<string, string>)[f.dim] === f.value;
}

export function sameFeature(a: Feature | null | undefined, b: Feature | null | undefined): boolean {
  return !!a && !!b && a.dim === b.dim && a.value === b.value;
}

function byBias(a: Feature, b: Feature) {
  return BIAS.indexOf(a.dim) - BIAS.indexOf(b.dim);
}

/** Features shared by every example, ordered by the alien's bias. */
export function sharedFeatures(examples: ItemSpec[]): Feature[] {
  if (!examples.length) return [];
  let shared = salientFeatures(examples[0]);
  for (const ex of examples.slice(1)) shared = shared.filter((f) => hasFeature(ex, f));
  return shared.sort(byBias);
}

export function activeGuess(shared: Feature[]): Feature | null {
  return shared[0] ?? null;
}

export function emptyConcept(conceptId: string): ConceptKnowledge {
  return { conceptId, heard: false, examples: [], rejected: [], negatives: [], misconceptions: [], corrections: [], tests: [] };
}

export function emptyAlien(): AlienKnowledge {
  return { concepts: {}, abilities: [] };
}

export function examplesOf(k: ConceptKnowledge | undefined): ItemSpec[] {
  if (!k) return [];
  return k.examples.map(parseItemId).filter((x): x is ItemSpec => !!x);
}

export interface MindSnapshot {
  shared: Feature[];
  guess: Feature | null;
  understanding: Understanding;
}

export function negativesOf(k: ConceptKnowledge | undefined): ItemSpec[] {
  if (!k?.negatives) return [];
  return k.negatives.map(parseItemId).filter((x): x is ItemSpec => !!x);
}

/** Candidate meanings: shared by all examples, and not present in any counter-example. */
export function candidateFeatures(examples: ItemSpec[], negatives: ItemSpec[]): Feature[] {
  return sharedFeatures(examples).filter((f) => !negatives.some((n) => hasFeature(n, f)));
}

export function snapshot(target: Feature, k: ConceptKnowledge | undefined): MindSnapshot {
  const shared = candidateFeatures(examplesOf(k), negativesOf(k));
  const guess = activeGuess(shared);
  return { shared, guess, understanding: understandingFrom(target, shared, guess, !!k?.heard) };
}

function understandingFrom(target: Feature, shared: Feature[], guess: Feature | null, heard: boolean): Understanding {
  if (!guess) return heard ? 'heard' : 'unknown';
  if (sameFeature(guess, target)) return shared.length === 1 ? 'understood' : 'partial';
  return 'misconception';
}

export function understandingOf(target: Feature, k: ConceptKnowledge | undefined): Understanding {
  return snapshot(target, k).understanding;
}

export type ExampleEffect = 'invalid' | 'duplicate' | 'first' | 'no_change' | 'progress' | 'new_guess' | 'resolved';

export interface ExampleResult {
  knowledge: ConceptKnowledge;
  effect: ExampleEffect;
  before: MindSnapshot;
  after: MindSnapshot;
}

function sameSet(a: Feature[], b: Feature[]) {
  return a.length === b.length && a.every((f) => b.some((g) => sameFeature(f, g)));
}

/**
 * The child shows the alien an example. Returns the new knowledge and how it
 * changed the alien's mind. Non-examples are NOT learned (stored as rejected).
 */
export function teachExample(k: ConceptKnowledge, target: Feature, ex: ItemSpec, now: number): ExampleResult {
  const before = snapshot(target, k);
  const id = itemId(ex);
  if (!hasFeature(ex, target)) {
    const knowledge = k.rejected.includes(id) ? k : { ...k, rejected: [...k.rejected, id] };
    return { knowledge, effect: 'invalid', before, after: before };
  }
  if (k.examples.includes(id)) return { knowledge: k, effect: 'duplicate', before, after: before };

  let knowledge: ConceptKnowledge = { ...k, heard: true, examples: [...k.examples, id] };
  const after = snapshot(target, knowledge);

  let effect: ExampleEffect;
  if (!before.guess) effect = after.understanding === 'understood' ? 'resolved' : 'first';
  else if (sameSet(before.shared, after.shared)) effect = 'no_change';
  else if (after.understanding === 'understood') effect = 'resolved';
  else if (!sameFeature(before.guess, after.guess)) effect = 'new_guess';
  else effect = 'progress';

  if (after.understanding === 'misconception' && after.guess) {
    const last = knowledge.misconceptions[knowledge.misconceptions.length - 1];
    if (!last || !sameFeature(last.feature, after.guess)) {
      knowledge = { ...knowledge, misconceptions: [...knowledge.misconceptions, { feature: after.guess, at: now }] };
    }
  }
  if (before.guess && !sameFeature(before.guess, after.guess)) {
    knowledge = {
      ...knowledge,
      corrections: [...knowledge.corrections, { itemId: id, at: now, before: before.guess, after: after.guess }],
    };
  }
  if (after.understanding === 'understood' && !knowledge.understoodAt) knowledge = { ...knowledge, understoodAt: now };
  return { knowledge, effect, before, after };
}

/**
 * The child shows a counter-example ("this is NOT RED"). Items that DO show
 * the concept are refused. Effects mirror teachExample.
 */
export function teachNegative(k: ConceptKnowledge, target: Feature, ex: ItemSpec, now: number): ExampleResult {
  const before = snapshot(target, k);
  const id = itemId(ex);
  if (hasFeature(ex, target)) return { knowledge: k, effect: 'invalid', before, after: before };
  const negs = k.negatives ?? [];
  if (negs.includes(id)) return { knowledge: k, effect: 'duplicate', before, after: before };
  let knowledge: ConceptKnowledge = { ...k, heard: true, negatives: [...negs, id] };
  const after = snapshot(target, knowledge);
  let effect: ExampleEffect;
  if (!before.guess) effect = 'first';
  else if (sameSet(before.shared, after.shared)) effect = 'no_change';
  else if (after.understanding === 'understood') effect = 'resolved';
  else if (!sameFeature(before.guess, after.guess)) effect = 'new_guess';
  else effect = 'progress';
  if (after.understanding === 'misconception' && after.guess) {
    const last = knowledge.misconceptions[knowledge.misconceptions.length - 1];
    if (!last || !sameFeature(last.feature, after.guess)) knowledge = { ...knowledge, misconceptions: [...knowledge.misconceptions, { feature: after.guess, at: now }] };
  }
  if (before.guess && !sameFeature(before.guess, after.guess)) {
    knowledge = { ...knowledge, corrections: [...knowledge.corrections, { itemId: `not:${id}`, at: now, before: before.guess, after: after.guess }] };
  }
  if (after.understanding === 'understood' && !knowledge.understoodAt) knowledge = { ...knowledge, understoodAt: now };
  return { knowledge, effect, before, after };
}

/** Deterministic, seedable shuffle (only used for screen positions, never for the alien's decisions). */
export function seededShuffle<T>(arr: T[], seed: number): T[] {
  const a = [...arr];
  let s = (seed * 9301 + 49297) % 233280 || 1;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280;
    const j = Math.floor((s / 233280) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickRotating(pool: ItemSpec[], pred: (i: ItemSpec) => boolean, variant: number, avoid: (ItemSpec | null)[]) {
  const c = pool.filter((i) => pred(i) && !avoid.some((a) => a && sameItem(a, i)));
  return c.length ? c[variant % c.length] : null;
}

/**
 * Build a test scene that reveals what the alien really thinks:
 * - misconception: [decoy that fits the wrong guess, correct item, neutral]
 * - partial / understood: [new correct item, trap that shares other features, neutral]
 * Exactly one item in the scene matches the alien's current guess.
 */
export function buildTestScene(target: Feature, k: ConceptKnowledge, pool: ItemSpec[], variant: number): ItemSpec[] {
  const exs = examplesOf(k);
  const { shared, guess } = snapshot(target, k);
  const fresh = pool.filter((i) => !k.examples.includes(itemId(i)) && !(k.negatives ?? []).includes(itemId(i)));
  let scene: (ItemSpec | null)[];

  if (guess && !sameFeature(guess, target)) {
    const decoy = pickRotating(fresh, (i) => hasFeature(i, guess) && !hasFeature(i, target), variant, []);
    const correct = pickRotating(fresh, (i) => hasFeature(i, target) && !hasFeature(i, guess), variant, [decoy]);
    const neutral = pickRotating(fresh, (i) => !hasFeature(i, target) && !hasFeature(i, guess), variant, [decoy, correct]);
    scene = [decoy, correct, neutral];
  } else {
    const others = shared.filter((f) => !sameFeature(f, target));
    const correct =
      pickRotating(fresh, (i) => hasFeature(i, target) && others.every((f) => !hasFeature(i, f)), variant, []) ??
      pickRotating(fresh, (i) => hasFeature(i, target), variant, []);
    const exampleFeatures = exs.flatMap(salientFeatures).filter((f) => f.dim !== target.dim);
    const trapFeatures = (others.length ? others : exampleFeatures).sort(byBias);
    const trap = pickRotating(
      fresh,
      (i) => !hasFeature(i, target) && trapFeatures.some((f) => hasFeature(i, f)),
      variant,
      [correct],
    );
    const neutral = pickRotating(
      fresh,
      (i) => !hasFeature(i, target) && !trapFeatures.some((f) => hasFeature(i, f)),
      variant,
      [correct, trap],
    );
    scene = [correct, trap, neutral];
  }
  const clean = scene.filter((x): x is ItemSpec => !!x);
  return seededShuffle(clean, variant + 3);
}

/** The alien's decision: the first (only) item that matches its current guess. */
export function alienChoose(scene: ItemSpec[], target: Feature, k: ConceptKnowledge): number | null {
  const { guess } = snapshot(target, k);
  if (!guess) return null;
  const idx = scene.findIndex((i) => hasFeature(i, guess));
  return idx >= 0 ? idx : null;
}

export function recordTest(
  k: ConceptKnowledge,
  scene: ItemSpec[],
  choice: number | null,
  target: Feature,
  now: number,
): ConceptKnowledge {
  const chosen = choice === null ? null : scene[choice];
  return {
    ...k,
    tests: [
      ...k.tests,
      { at: now, scene: scene.map(itemId), choice: chosen ? itemId(chosen) : null, alienCorrect: !!chosen && hasFeature(chosen, target) },
    ],
  };
}

export interface RepairOption {
  item: ItemSpec;
  effect: ExampleEffect;
}

/** Options for the repair screen: one helpful, one "more of the same", one non-example. */
export function buildRepairOptions(target: Feature, k: ConceptKnowledge, pool: ItemSpec[], variant: number): RepairOption[] {
  const fresh = pool.filter((i) => !k.examples.includes(itemId(i)));
  const evaluated = fresh.map((i) => ({ item: i, effect: teachExample(k, target, i, 0).effect }));
  const { guess } = snapshot(target, k);
  const rot = <T,>(arr: T[]) => (arr.length ? arr[variant % arr.length] : null);

  const resolving = evaluated.filter((o) => o.effect === 'resolved');
  const helpful = rot(resolving.length ? resolving : evaluated.filter((o) => o.effect === 'new_guess'));
  const weak = rot(evaluated.filter((o) => o.effect === 'no_change' || o.effect === 'progress'));
  const invalidTempting = evaluated.filter((o) => o.effect === 'invalid' && guess && hasFeature(o.item, guess));
  const invalid = rot(invalidTempting.length ? invalidTempting : evaluated.filter((o) => o.effect === 'invalid'));

  const out = [helpful, weak, invalid].filter((x): x is RepairOption => !!x);
  if (out.length < 3) {
    const extra = evaluated.find((o) => o.effect === 'resolved' && !out.some((x) => sameItem(x.item, o.item)));
    if (extra) out.push(extra);
  }
  return seededShuffle(out, variant + 7);
}

export function isHelpful(effect: ExampleEffect) {
  return effect === 'resolved' || effect === 'new_guess';
}

// ------------------------------ Language ----------------------------------

/** How the alien's guess is described in Hebrew, e.g. "תפוח", "הצבע הכחול". */
export function guessLabelHe(f: Feature): string {
  switch (f.dim) {
    case 'kind':
      return KIND_HE[f.value as keyof typeof KIND_HE]?.noun ?? f.value;
    case 'color':
      return `הצבע ה${adjectiveHe('color', f.value)}`;
    case 'size':
      return `משהו ${adjectiveHe('size', f.value)}`;
    case 'state':
      return `משהו ${adjectiveHe('state', f.value)}`;
  }
}

/** "משהו אדום" / "כלב". */
export function targetPhraseHe(f: Feature): string {
  if (f.dim === 'kind') return KIND_HE[f.value as keyof typeof KIND_HE]?.noun ?? f.value;
  return `משהו ${adjectiveHe(f.dim, f.value)}`;
}

/** "שהוא לא תפוח" / "שהוא לא כחול". */
export function notGuessPhraseHe(f: Feature): string {
  if (f.dim === 'kind') return `שהוא לא ${KIND_HE[f.value as keyof typeof KIND_HE]?.noun ?? f.value}`;
  return `שהוא לא ${adjectiveHe(f.dim, f.value)}`;
}

export function describeExampleHe(i: ItemSpec) {
  return describeItemHe(i);
}
