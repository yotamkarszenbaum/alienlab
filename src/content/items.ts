import type { ColorName, ItemSpec, ItemState, Kind, Pos, Size } from '../engine/types';

/** Create an item spec with sensible defaults. */
export function item(kind: Kind, color: ColorName, size: Size = 'normal', state: ItemState = 'none'): ItemSpec {
  const st: ItemState = STATEFUL_KINDS.includes(kind) ? (state === 'none' ? 'closed' : state) : 'none';
  return { kind, color, size, state: st };
}

/** Two or three copies of an item (TWO / THREE). */
export function items(n: 2 | 3, kind: Kind, color: ColorName, extra: Partial<ItemSpec> = {}): ItemSpec {
  return { ...item(kind, color), ...extra, count: n };
}

/** An item IN / ON / UNDER a reference object (a table or a box). */
export function placed(kind: Kind, color: ColorName, pos: Pos, ref: Kind = pos === 'in' ? 'box' : 'table', extra: Partial<ItemSpec> = {}): ItemSpec {
  return { ...item(kind, color), ...extra, rel: { pos, ref } };
}

export const STATEFUL_KINDS: Kind[] = ['door', 'box'];

/** Stable id. Extra parts are only added when used, so ids saved by older versions stay valid. */
export function itemId(i: ItemSpec): string {
  let id = `${i.kind}.${i.color}.${i.size}.${i.state}`;
  if (i.count && i.count > 1) id += `.x${i.count}`;
  if (i.rel) id += `.${i.rel.pos}-${i.rel.ref}`;
  return id;
}

export function parseItemId(id: string): ItemSpec | null {
  const [kind, color, size, state, ...rest] = id.split('.');
  if (!kind || !color || !size || !state) return null;
  if (!(kind in KIND_HE) || !(color in COLOR_HE)) return null;
  const out: ItemSpec = { kind: kind as Kind, color: color as ColorName, size: size as Size, state: state as ItemState };
  for (const r of rest) {
    if (r === 'x2' || r === 'x3') out.count = Number(r.slice(1)) as 2 | 3;
    const m = /^(in|on|under)-(\w+)$/.exec(r);
    if (m && m[2] in KIND_HE) out.rel = { pos: m[1] as Pos, ref: m[2] as Kind };
  }
  return out;
}

export function sameItem(a: ItemSpec, b: ItemSpec): boolean {
  return itemId(a) === itemId(b);
}

// Hebrew labels (accessibility labels, parents area, alien speech)
export const KIND_HE: Record<Kind, { noun: string; plural: string; gender: 'm' | 'f'; definite: string }> = {
  apple: { noun: 'תפוח', plural: 'תפוחים', gender: 'm', definite: 'התפוח' },
  ball: { noun: 'כדור', plural: 'כדורים', gender: 'm', definite: 'הכדור' },
  cat: { noun: 'חתול', plural: 'חתולים', gender: 'm', definite: 'החתול' },
  dog: { noun: 'כלב', plural: 'כלבים', gender: 'm', definite: 'הכלב' },
  car: { noun: 'מכונית', plural: 'מכוניות', gender: 'f', definite: 'המכונית' },
  star: { noun: 'כוכב', plural: 'כוכבים', gender: 'm', definite: 'הכוכב' },
  cup: { noun: 'כוס', plural: 'כוסות', gender: 'f', definite: 'הכוס' },
  box: { noun: 'קופסה', plural: 'קופסאות', gender: 'f', definite: 'הקופסה' },
  door: { noun: 'דלת', plural: 'דלתות', gender: 'f', definite: 'הדלת' },
  key: { noun: 'מפתח', plural: 'מפתחות', gender: 'm', definite: 'המפתח' },
  hat: { noun: 'כובע', plural: 'כובעים', gender: 'm', definite: 'הכובע' },
  table: { noun: 'שולחן', plural: 'שולחנות', gender: 'm', definite: 'השולחן' },
};

type Forms = { m: string; f: string; mp: string; fp: string };

export const COLOR_HE: Record<ColorName, Forms> = {
  red: { m: 'אדום', f: 'אדומה', mp: 'אדומים', fp: 'אדומות' },
  blue: { m: 'כחול', f: 'כחולה', mp: 'כחולים', fp: 'כחולות' },
  yellow: { m: 'צהוב', f: 'צהובה', mp: 'צהובים', fp: 'צהובות' },
  green: { m: 'ירוק', f: 'ירוקה', mp: 'ירוקים', fp: 'ירוקות' },
  orange: { m: 'כתום', f: 'כתומה', mp: 'כתומים', fp: 'כתומות' },
  purple: { m: 'סגול', f: 'סגולה', mp: 'סגולים', fp: 'סגולות' },
  brown: { m: 'חום', f: 'חומה', mp: 'חומים', fp: 'חומות' },
  white: { m: 'לבן', f: 'לבנה', mp: 'לבנים', fp: 'לבנות' },
  gray: { m: 'אפור', f: 'אפורה', mp: 'אפורים', fp: 'אפורות' },
  black: { m: 'שחור', f: 'שחורה', mp: 'שחורים', fp: 'שחורות' },
};

const SIZE_HE: Record<Size, Forms | null> = {
  small: { m: 'קטן', f: 'קטנה', mp: 'קטנים', fp: 'קטנות' },
  normal: null,
  big: { m: 'גדול', f: 'גדולה', mp: 'גדולים', fp: 'גדולות' },
};

const STATE_HE: Record<ItemState, Forms | null> = {
  none: null,
  open: { m: 'פתוח', f: 'פתוחה', mp: 'פתוחים', fp: 'פתוחות' },
  closed: { m: 'סגור', f: 'סגורה', mp: 'סגורים', fp: 'סגורות' },
};

const NUMBER_HE: Record<2 | 3, { m: string; f: string }> = { 2: { m: 'שני', f: 'שתי' }, 3: { m: 'שלושה', f: 'שלוש' } };

/** "מתחת לשולחן", "על השולחן", "בתוך הקופסה". */
export function placeHe(pos: Pos, ref: Kind): string {
  const def = KIND_HE[ref].definite;
  if (pos === 'under') return `מתחת ל${def.slice(1)}`;
  if (pos === 'on') return `על ${def}`;
  return `בתוך ${def}`;
}

/** e.g. "כדור כחול גדול", "דלת פתוחה", "שני חתולים אפורים על השולחן". */
export function describeItemHe(i: ItemSpec): string {
  const k = KIND_HE[i.kind];
  const g = k.gender;
  const plural = !!i.count && i.count > 1;
  const form = (f: Forms) => (plural ? (g === 'm' ? f.mp : f.fp) : f[g]);
  const parts: string[] = [];
  if (plural) parts.push(NUMBER_HE[i.count as 2 | 3][g], k.plural);
  else parts.push(k.noun);
  parts.push(form(COLOR_HE[i.color]));
  const s = SIZE_HE[i.size];
  if (s) parts.push(form(s));
  const st = STATE_HE[i.state];
  if (st) parts.push(form(st));
  if (i.rel) parts.push(placeHe(i.rel.pos, i.rel.ref));
  return parts.join(' ');
}

export function adjectiveHe(dim: 'color' | 'size' | 'state' | 'count' | 'pos', value: string, gender: 'm' | 'f' = 'm'): string {
  if (dim === 'color') return COLOR_HE[value as ColorName]?.[gender] ?? value;
  if (dim === 'size') return SIZE_HE[value as Size]?.[gender] ?? value;
  if (dim === 'state') return STATE_HE[value as ItemState]?.[gender] ?? value;
  if (dim === 'count') return value === '2' ? 'שניים' : value === '3' ? 'שלושה' : value;
  return value === 'under' ? 'מתחת' : value === 'on' ? 'על' : value === 'in' ? 'בתוך' : value;
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
  hat: ['red', 'blue', 'yellow', 'green', 'purple'],
  table: ['brown', 'white'],
};

/** Kinds that are never part of the default catalogue (furniture used as a reference). */
const NOT_IN_DEFAULT: Kind[] = ['table'];

export function catalog(opts: { sizes?: Size[]; kinds?: Kind[]; states?: ItemState[] } = {}): ItemSpec[] {
  const sizes = opts.sizes ?? ['normal'];
  const kinds = opts.kinds ?? (Object.keys(KIND_COLORS) as Kind[]).filter((k) => !NOT_IN_DEFAULT.includes(k));
  const out: ItemSpec[] = [];
  for (const k of kinds) {
    const states: ItemState[] = STATEFUL_KINDS.includes(k) ? (opts.states ?? ['closed', 'open']) : ['none'];
    for (const c of KIND_COLORS[k]) for (const s of sizes) for (const st of states) out.push({ kind: k, color: c, size: s, state: st });
  }
  return out;
}

/** Items placed IN / ON / UNDER (for teaching and testing position words). */
export function placedCatalog(kinds: Kind[], poses: Pos[]): ItemSpec[] {
  const out: ItemSpec[] = [];
  for (const k of kinds) for (const c of KIND_COLORS[k].slice(0, 3)) for (const p of poses) out.push(placed(k, c, p));
  return out;
}

export function kindColors(kind: Kind): ColorName[] {
  return KIND_COLORS[kind];
}
