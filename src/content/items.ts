import type { ColorName, ItemSpec, ItemState, Kind, Size } from '../engine/types';

/** Create an item spec with sensible defaults. */
export function item(kind: Kind, color: ColorName, size: Size = 'normal', state: ItemState = 'none'): ItemSpec {
  const st: ItemState = STATEFUL_KINDS.includes(kind) ? (state === 'none' ? 'closed' : state) : 'none';
  return { kind, color, size, state: st };
}

export const STATEFUL_KINDS: Kind[] = ['door', 'box'];

export function itemId(i: ItemSpec): string {
  return `${i.kind}.${i.color}.${i.size}.${i.state}`;
}

export function parseItemId(id: string): ItemSpec | null {
  const [kind, color, size, state] = id.split('.');
  if (!kind || !color || !size || !state) return null;
  if (!(kind in KIND_HE) || !(color in COLOR_HE)) return null;
  return { kind: kind as Kind, color: color as ColorName, size: size as Size, state: state as ItemState };
}

export function sameItem(a: ItemSpec, b: ItemSpec): boolean {
  return itemId(a) === itemId(b);
}

// Hebrew labels (used for accessibility labels, parents area, alien speech)
export const KIND_HE: Record<Kind, { noun: string; gender: 'm' | 'f' }> = {
  apple: { noun: 'תפוח', gender: 'm' },
  ball: { noun: 'כדור', gender: 'm' },
  cat: { noun: 'חתול', gender: 'm' },
  dog: { noun: 'כלב', gender: 'm' },
  car: { noun: 'מכונית', gender: 'f' },
  star: { noun: 'כוכב', gender: 'm' },
  cup: { noun: 'כוס', gender: 'f' },
  box: { noun: 'קופסה', gender: 'f' },
  door: { noun: 'דלת', gender: 'f' },
  key: { noun: 'מפתח', gender: 'm' },
};

export const COLOR_HE: Record<ColorName, { m: string; f: string }> = {
  red: { m: 'אדום', f: 'אדומה' },
  blue: { m: 'כחול', f: 'כחולה' },
  yellow: { m: 'צהוב', f: 'צהובה' },
  green: { m: 'ירוק', f: 'ירוקה' },
  orange: { m: 'כתום', f: 'כתומה' },
  purple: { m: 'סגול', f: 'סגולה' },
  brown: { m: 'חום', f: 'חומה' },
  white: { m: 'לבן', f: 'לבנה' },
  gray: { m: 'אפור', f: 'אפורה' },
  black: { m: 'שחור', f: 'שחורה' },
};

const SIZE_HE: Record<Size, { m: string; f: string } | null> = {
  small: { m: 'קטן', f: 'קטנה' },
  normal: null,
  big: { m: 'גדול', f: 'גדולה' },
};

const STATE_HE: Record<ItemState, { m: string; f: string } | null> = {
  none: null,
  open: { m: 'פתוח', f: 'פתוחה' },
  closed: { m: 'סגור', f: 'סגורה' },
};

/** e.g. "כדור כחול גדול", "דלת פתוחה". */
export function describeItemHe(i: ItemSpec): string {
  const k = KIND_HE[i.kind];
  const g = k.gender;
  const parts = [k.noun];
  // keys are always golden – say "זהב" rather than "צהוב" would confuse; keep colour words consistent
  parts.push(COLOR_HE[i.color][g]);
  const s = SIZE_HE[i.size];
  if (s) parts.push(s[g]);
  const st = STATE_HE[i.state];
  if (st) parts.push(st[g]);
  return parts.join(' ');
}

export function adjectiveHe(dim: 'color' | 'size' | 'state', value: string, gender: 'm' | 'f' = 'm'): string {
  if (dim === 'color') return COLOR_HE[value as ColorName]?.[gender] ?? value;
  if (dim === 'size') return SIZE_HE[value as Size]?.[gender] ?? value;
  return STATE_HE[value as ItemState]?.[gender] ?? value;
}

/**
 * Every renderable item combination that the generators may use.
 * Colours are limited per kind so pictures stay plausible for children.
 */
const KIND_COLORS: Record<Kind, ColorName[]> = {
  apple: ['red', 'green', 'yellow'],
  ball: ['red', 'blue', 'yellow', 'green', 'purple', 'orange'],
  cat: ['orange', 'gray', 'white', 'black'],
  dog: ['brown', 'white', 'gray', 'black'],
  car: ['red', 'blue', 'yellow', 'green'],
  star: ['yellow', 'purple', 'orange'],
  cup: ['red', 'blue', 'yellow', 'green', 'purple'],
  box: ['brown', 'red', 'blue', 'green'],
  door: ['brown', 'blue', 'green', 'purple'],
  key: ['yellow', 'gray'],
};

export function catalog(opts: { sizes?: Size[]; kinds?: Kind[]; states?: ItemState[] } = {}): ItemSpec[] {
  const sizes = opts.sizes ?? ['normal'];
  const kinds = opts.kinds ?? (Object.keys(KIND_COLORS) as Kind[]);
  const out: ItemSpec[] = [];
  for (const k of kinds) {
    const states: ItemState[] = STATEFUL_KINDS.includes(k) ? (opts.states ?? ['closed', 'open']) : ['none'];
    for (const c of KIND_COLORS[k]) for (const s of sizes) for (const st of states) out.push({ kind: k, color: c, size: s, state: st });
  }
  return out;
}

export function kindColors(kind: Kind): ColorName[] {
  return KIND_COLORS[kind];
}
