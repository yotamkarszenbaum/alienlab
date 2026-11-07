// ---------------------------------------------------------------------------
// Cosmo's Brain — a transparent view of Kosmo's real knowledge model.
//
// Nothing here is decorative: every link is derived from the examples the
// child gave Kosmo (alienMind.ts) and his look-alike rule (kosmo.ts).
//   guess    — the meaning Kosmo uses now (the first shared feature by bias)
//   possible — other features still shared by all examples ("maybe only red ones?")
//   cut      — features the child's later examples / counter-examples removed
//   mixup    — never taught: the look-alike word he confuses it with
// ---------------------------------------------------------------------------
import type { ConceptKnowledge, Feature, SaveData, Understanding, WordDef } from './types';
import { activeGuess, candidateFeatures, examplesOf, guessLabelHe, negativesOf, salientFeatures, sameFeature, snapshot } from './alienMind';
import { adjectiveHe, describeItemHe, KIND_HE, parseItemId } from '../content/items';
import { WORDS_BY_ID } from '../content/words';
import { kosmoTaught } from './kosmo';

export type LinkState = 'guess' | 'possible' | 'cut';

export interface BrainLink {
  feature: Feature;
  state: LinkState;
}

export interface BrainView {
  wordId: string;
  understanding: Understanding;
  links: BrainLink[];
  /** Never taught: the look-alike he mixes it up with (if he does not know that one either). */
  mixupWith?: string;
  examples: number;
}

const MAX_LINKS = 6;

export function brainView(d: SaveData, wordId: string): BrainView {
  const w = WORDS_BY_ID[wordId];
  const k = d.alien.concepts[wordId];
  const ex = examplesOf(k);
  const understanding = snapshot(w.target, k).understanding;
  if (!ex.length) {
    const mix = w.kosmoMixesUp && !kosmoTaught(d, w.kosmoMixesUp) ? w.kosmoMixesUp : undefined;
    return { wordId, understanding, links: [], mixupWith: mix, examples: 0 };
  }
  return { wordId, understanding, links: linksOf(k!), examples: ex.length };
}

export function linksOf(k: ConceptKnowledge): BrainLink[] {
  const ex = examplesOf(k);
  const current = candidateFeatures(ex, negativesOf(k));
  const guess = activeGuess(current);
  const links: BrainLink[] = current.map((f) => ({ feature: f, state: guess && sameFeature(f, guess) ? 'guess' : 'possible' }));
  // Everything Kosmo once considered (the first example's features, and every wrong guess) but no longer does.
  const considered = [...(ex[0] ? salientFeatures(ex[0]) : []), ...k.misconceptions.map((m) => m.feature)];
  for (const f of considered) if (!current.some((c) => sameFeature(c, f)) && !links.some((l) => sameFeature(l.feature, f))) links.push({ feature: f, state: 'cut' });
  const order: Record<LinkState, number> = { guess: 0, possible: 1, cut: 2 };
  return links.sort((a, b) => order[a.state] - order[b.state]).slice(0, MAX_LINKS);
}

/** What one teaching moment changed in Kosmo's brain. */
export interface BrainChange {
  wordId: string;
  before: Feature | null;
  after: Feature | null;
  cut: Feature[];
  understandingBefore: Understanding;
  understandingAfter: Understanding;
}

export function brainChange(wordId: string, before: ConceptKnowledge | undefined, after: ConceptKnowledge | undefined): BrainChange | null {
  const w = WORDS_BY_ID[wordId];
  if (!w || !after) return null;
  const sb = snapshot(w.target, before);
  const sa = snapshot(w.target, after);
  const cut = sb.shared.filter((f) => !sa.shared.some((g) => sameFeature(f, g)));
  if (sameFeature(sb.guess, sa.guess) && !cut.length && sb.understanding === sa.understanding) return null;
  return { wordId, before: sb.guess, after: sa.guess, cut, understandingBefore: sb.understanding, understandingAfter: sa.understanding };
}

/** Short node label: "מכונית", "כחול", "גדול", "פתוח", "שניים", "מתחת". */
export function featureShortHe(f: Feature): string {
  switch (f.dim) {
    case 'kind':
      return KIND_HE[f.value as keyof typeof KIND_HE]?.noun ?? f.value;
    case 'count':
      return f.value === '2' ? 'שניים' : 'שלושה';
    case 'pos':
      return f.value === 'under' ? 'מתחת' : f.value === 'on' ? 'על' : 'בתוך';
    default:
      return adjectiveHe(f.dim, f.value);
  }
}

const KIND_ICON: Record<string, string> = { apple: '🍎', ball: '⚽', cat: '🐱', dog: '🐶', car: '🚗', hat: '🎩', cup: '☕', key: '🔑', door: '🚪', box: '📦', star: '⭐', table: '🪑' };
export const COLOR_HEX: Record<string, string> = {
  red: '#ef4444', blue: '#3b82f6', yellow: '#fbd02b', green: '#22c55e', orange: '#fb923c', purple: '#a855f7', brown: '#92400e', white: '#ffffff', gray: '#9ca3af', black: '#1f2937',
};

/** An emoji for a feature node (colours are drawn as a swatch instead). */
export function featureIcon(f: Feature): string {
  switch (f.dim) {
    case 'kind':
      return KIND_ICON[f.value] ?? '•';
    case 'size':
      return f.value === 'big' ? '🔼' : '🔽';
    case 'state':
      return f.value === 'open' ? '🔓' : '🔒';
    case 'count':
      return f.value === '2' ? '2️⃣' : '3️⃣';
    case 'pos':
      return f.value === 'under' ? '⬇️' : f.value === 'on' ? '⬆️' : '📥';
    default:
      return '';
  }
}

/** Recent changes in Kosmo's brain, newest first: what he thought, what he thinks now, and which picture did it. */
export function brainTimeline(d: SaveData, max = 6): { wordId: string; at: number; before: Feature | null; after: Feature | null; byHe: string; negative: boolean }[] {
  const out: { wordId: string; at: number; before: Feature | null; after: Feature | null; byHe: string; negative: boolean }[] = [];
  for (const [id, k] of Object.entries(d.alien.concepts)) {
    if (!WORDS_BY_ID[id]) continue;
    for (const c of k.corrections) {
      const negative = c.itemId.startsWith('not:');
      const it = parseItemId(negative ? c.itemId.slice(4) : c.itemId);
      out.push({ wordId: id, at: c.at, before: c.before, after: c.after, byHe: it ? describeItemHe(it) : '', negative });
    }
  }
  return out.sort((a, b) => b.at - a.at).slice(0, max);
}

// ------------------------------- diagnosis ---------------------------------

export interface DiagnoseOption {
  key: string;
  labelHe: string;
  correct: boolean;
}

/**
 * "What does Kosmo think WORD means?" — the child has to read Kosmo's mind from
 * his behaviour before fixing it. Right answer: his current guess. Tempting
 * wrong answers: the real meaning, and another feature of the examples.
 */
export function diagnoseOptions(word: WordDef, k: ConceptKnowledge | undefined): DiagnoseOption[] | null {
  const s = snapshot(word.target, k);
  if (!s.guess || sameFeature(s.guess, word.target)) return null;
  const opts: Feature[] = [s.guess, word.target];
  const ex = examplesOf(k);
  const extra = [...s.shared, ...(ex[0] ? salientFeatures(ex[0]) : [])].find((f) => !opts.some((o) => sameFeature(o, f)) && f.dim !== word.target.dim);
  if (extra) opts.push(extra);
  else opts.push(word.target.dim === 'size' ? { dim: 'color', value: 'blue' } : { dim: 'size', value: 'big' });
  const rot = (word.id.length + ex.length) % opts.length;
  const ordered = [...opts.slice(rot), ...opts.slice(0, rot)];
  return ordered.map((f) => ({ key: `${f.dim}:${f.value}`, labelHe: guessLabelHe(f), correct: sameFeature(f, s.guess) }));
}
