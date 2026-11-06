import type { ColorName, ItemSpec } from '../engine/types';
import { describeItemHe } from '../content/items';

// Original 2D illustrations drawn in SVG (no external image files).
// viewBox 0 0 120 120, ground line at y=112 so sizes compare naturally.

const OUT = '#2b2350';
type Tone = { base: string; dark: string; light: string };

export const PALETTE: Record<ColorName, Tone> = {
  red: { base: '#ef4444', dark: '#b91c1c', light: '#fca5a5' },
  blue: { base: '#3b82f6', dark: '#1d4ed8', light: '#9cc5ff' },
  yellow: { base: '#fbd02b', dark: '#c99a06', light: '#fff1a6' },
  green: { base: '#4cb944', dark: '#2f7d2a', light: '#a9e8a2' },
  orange: { base: '#fb923c', dark: '#c2410c', light: '#fed7aa' },
  purple: { base: '#a560f5', dark: '#7322c9', light: '#dcc0ff' },
  brown: { base: '#a8693a', dark: '#6b4226', light: '#dcae7f' },
  white: { base: '#f7f5f2', dark: '#a8a29e', light: '#ffffff' },
  gray: { base: '#a3acb9', dark: '#5b6472', light: '#e3e7ec' },
  black: { base: '#3f4654', dark: '#161b26', light: '#78808f' },
};

// Big must read as clearly bigger than small (≈2.5× tall) even in separate cards.
const SCALE = { small: 0.42, normal: 0.78, big: 1.04 } as const;

function Apple({ t }: { t: Tone }) {
  return (
    <g>
      <path d="M60 37 C 60 28, 62 22, 67 15" stroke="#6b4226" strokeWidth="5" strokeLinecap="round" fill="none" />
      <path
        d="M60 38 C 47 27, 20 31, 20 61 C 20 90, 41 110, 55 106 C 58 105, 62 105, 65 106 C 79 110, 100 90, 100 61 C 100 31, 73 27, 60 38 Z"
        fill={t.base}
        stroke={OUT}
        strokeWidth="3.5"
        strokeLinejoin="round"
      />
      <path d="M35 52 C 32 62, 34 74, 40 82" stroke={t.light} strokeWidth="7" strokeLinecap="round" fill="none" opacity="0.85" />
      <path d="M66 24 C 74 13, 89 13, 93 20 C 87 29, 74 31, 66 24 Z" fill="#4cb944" stroke={OUT} strokeWidth="3" strokeLinejoin="round" />
    </g>
  );
}

function Ball({ t }: { t: Tone }) {
  return (
    <g>
      <circle cx="60" cy="68" r="42" fill={t.base} stroke={OUT} strokeWidth="3.5" />
      <path d="M22 54 Q60 78 98 54" stroke={t.light} strokeWidth="9" fill="none" strokeLinecap="round" />
      <path d="M26 92 Q60 72 94 92" stroke={t.dark} strokeWidth="6" fill="none" strokeLinecap="round" opacity="0.55" />
      <ellipse cx="44" cy="44" rx="10" ry="6" fill="#fff" opacity="0.65" transform="rotate(-30 44 44)" />
    </g>
  );
}

function Cat({ t }: { t: Tone }) {
  return (
    <g>
      <path d="M84 98 C 106 98, 108 72, 96 64" stroke={OUT} strokeWidth="13" fill="none" strokeLinecap="round" />
      <path d="M84 98 C 106 98, 108 72, 96 64" stroke={t.base} strokeWidth="7" fill="none" strokeLinecap="round" />
      <ellipse cx="60" cy="90" rx="29" ry="22" fill={t.base} stroke={OUT} strokeWidth="3.5" />
      <ellipse cx="60" cy="96" rx="15" ry="13" fill={t.light} />
      <path d="M38 44 L 33 14 L 56 30 Z" fill={t.base} stroke={OUT} strokeWidth="3.5" strokeLinejoin="round" />
      <path d="M82 44 L 87 14 L 64 30 Z" fill={t.base} stroke={OUT} strokeWidth="3.5" strokeLinejoin="round" />
      <path d="M39 36 L 37 22 L 48 30 Z" fill="#ffb3c7" />
      <path d="M81 36 L 83 22 L 72 30 Z" fill="#ffb3c7" />
      <circle cx="60" cy="52" r="26" fill={t.base} stroke={OUT} strokeWidth="3.5" />
      <path d="M54 30 L 56 38 M60 28 L 60 37 M66 30 L 64 38" stroke={t.dark} strokeWidth="3" strokeLinecap="round" opacity="0.7" />
      <ellipse cx="50" cy="50" rx="4" ry="5.5" fill={OUT} />
      <ellipse cx="70" cy="50" rx="4" ry="5.5" fill={OUT} />
      <circle cx="51.5" cy="48" r="1.5" fill="#fff" />
      <circle cx="71.5" cy="48" r="1.5" fill="#fff" />
      <path d="M56 58 L 64 58 L 60 62 Z" fill="#ff8fab" stroke={OUT} strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M60 62 Q 56 67 52 64 M60 62 Q 64 67 68 64" stroke={OUT} strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M44 58 L 30 55 M44 62 L 30 64 M76 58 L 90 55 M76 62 L 90 64" stroke={OUT} strokeWidth="1.6" strokeLinecap="round" />
      <ellipse cx="48" cy="108" rx="8" ry="5" fill={t.base} stroke={OUT} strokeWidth="3" />
      <ellipse cx="72" cy="108" rx="8" ry="5" fill={t.base} stroke={OUT} strokeWidth="3" />
    </g>
  );
}

function Dog({ t }: { t: Tone }) {
  return (
    <g>
      <path d="M84 92 C 98 88, 100 76, 98 70" stroke={OUT} strokeWidth="12" fill="none" strokeLinecap="round" />
      <path d="M84 92 C 98 88, 100 76, 98 70" stroke={t.base} strokeWidth="6" fill="none" strokeLinecap="round" />
      <ellipse cx="60" cy="90" rx="27" ry="21" fill={t.base} stroke={OUT} strokeWidth="3.5" />
      <ellipse cx="60" cy="95" rx="14" ry="12" fill={t.light} />
      <ellipse cx="60" cy="54" rx="26" ry="24" fill={t.base} stroke={OUT} strokeWidth="3.5" />
      <path d="M38 36 C 24 38, 22 66, 31 74 C 39 72, 43 56, 42 42 Z" fill={t.dark} stroke={OUT} strokeWidth="3" strokeLinejoin="round" />
      <path d="M82 36 C 96 38, 98 66, 89 74 C 81 72, 77 56, 78 42 Z" fill={t.dark} stroke={OUT} strokeWidth="3" strokeLinejoin="round" />
      <ellipse cx="60" cy="66" rx="14" ry="10" fill={t.light} stroke={OUT} strokeWidth="2.5" />
      <ellipse cx="60" cy="60" rx="6" ry="4.2" fill={OUT} />
      <path d="M60 64 L 60 69 M60 69 Q 55 73 51 69 M60 69 Q 65 73 69 69" stroke={OUT} strokeWidth="2.2" fill="none" strokeLinecap="round" />
      <path d="M57 71 Q 60 79 63 71 Z" fill="#ff7b9c" />
      <circle cx="50" cy="49" r="4.2" fill={OUT} />
      <circle cx="70" cy="49" r="4.2" fill={OUT} />
      <circle cx="51.5" cy="47.5" r="1.5" fill="#fff" />
      <circle cx="71.5" cy="47.5" r="1.5" fill="#fff" />
      <rect x="44" y="100" width="12" height="12" rx="5" fill={t.base} stroke={OUT} strokeWidth="3" />
      <rect x="64" y="100" width="12" height="12" rx="5" fill={t.base} stroke={OUT} strokeWidth="3" />
    </g>
  );
}

function Car({ t }: { t: Tone }) {
  return (
    <g>
      <path
        d="M12 84 C 12 72, 18 68, 28 66 L 40 48 C 43 43, 48 40, 54 40 L 78 40 C 84 40, 88 43, 91 48 L 101 66 C 107 67, 110 72, 110 82 L 110 90 C 110 93, 108 95, 105 95 L 17 95 C 14 95, 12 93, 12 90 Z"
        fill={t.base}
        stroke={OUT}
        strokeWidth="3.5"
        strokeLinejoin="round"
      />
      <path d="M46 49 C 47 47, 50 46, 54 46 L 60 46 L 60 64 L 36 64 Z" fill="#d6efff" stroke={OUT} strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M66 46 L 78 46 C 82 46, 84 48, 86 51 L 93 64 L 66 64 Z" fill="#d6efff" stroke={OUT} strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M20 76 L 102 76" stroke={t.light} strokeWidth="4" strokeLinecap="round" opacity="0.7" />
      <circle cx="104" cy="80" r="4" fill="#fff6b0" stroke={OUT} strokeWidth="2" />
      <circle cx="36" cy="96" r="12" fill={OUT} />
      <circle cx="36" cy="96" r="5" fill="#cfd6e3" />
      <circle cx="88" cy="96" r="12" fill={OUT} />
      <circle cx="88" cy="96" r="5" fill="#cfd6e3" />
    </g>
  );
}

function Star({ t }: { t: Tone }) {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? 48 : 21;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push(`${(60 + r * Math.cos(a)).toFixed(1)},${(64 + r * Math.sin(a)).toFixed(1)}`);
  }
  return (
    <g>
      <polygon points={pts.join(' ')} fill={t.base} stroke={OUT} strokeWidth="4" strokeLinejoin="round" />
      <path d="M48 52 L 56 46" stroke="#fff" strokeWidth="5" strokeLinecap="round" opacity="0.7" />
    </g>
  );
}

function Cup({ t }: { t: Tone }) {
  return (
    <g>
      <path d="M82 54 C 102 54, 102 86, 82 86" stroke={OUT} strokeWidth="14" fill="none" strokeLinecap="round" />
      <path d="M82 54 C 102 54, 102 86, 82 86" stroke={t.base} strokeWidth="7" fill="none" strokeLinecap="round" />
      <path d="M26 40 L 86 40 L 82 100 C 82 106, 77 110, 71 110 L 41 110 C 35 110, 30 106, 30 100 Z" fill={t.base} stroke={OUT} strokeWidth="3.5" strokeLinejoin="round" />
      <ellipse cx="56" cy="40" rx="30" ry="7" fill={t.dark} stroke={OUT} strokeWidth="3" />
      <path d="M30 64 L 84 64" stroke={t.light} strokeWidth="6" />
      <path d="M44 30 C 40 24, 48 20, 44 14 M58 30 C 54 24, 62 20, 58 14" stroke="#b7aee6" strokeWidth="3" fill="none" strokeLinecap="round" />
    </g>
  );
}

function Box({ t, open }: { t: Tone; open: boolean }) {
  return (
    <g>
      {open ? (
        <>
          <path d="M24 56 L 32 22 L 100 22 L 96 56 Z" fill={t.light} stroke={OUT} strokeWidth="3.5" strokeLinejoin="round" />
          <path d="M60 22 L 58 56" stroke={t.base} strokeWidth="6" />
          <rect x="22" y="52" width="76" height="12" rx="2" fill="#3a2f63" stroke={OUT} strokeWidth="3" />
          <path d="M44 44 L 44 36 M60 42 L 60 32 M76 44 L 76 36" stroke="#ffd23f" strokeWidth="4" strokeLinecap="round" />
        </>
      ) : (
        <rect x="18" y="44" width="84" height="18" rx="3" fill={t.dark} stroke={OUT} strokeWidth="3.5" />
      )}
      <rect x="22" y="60" width="76" height="48" rx="3" fill={t.base} stroke={OUT} strokeWidth="3.5" />
      <rect x="54" y={open ? 60 : 44} width="12" height={open ? 48 : 64} fill={t.light} opacity="0.8" />
      {!open && <rect x="18" y="44" width="84" height="18" rx="3" fill="none" stroke={OUT} strokeWidth="3.5" />}
    </g>
  );
}

function Door({ t, open }: { t: Tone; open: boolean }) {
  return (
    <g>
      <rect x="24" y="8" width="72" height="106" rx="6" fill="#d9d1fb" stroke={OUT} strokeWidth="3.5" />
      {open ? (
        <>
          <rect x="31" y="15" width="58" height="99" fill="#fff4bf" />
          <circle cx="66" cy="50" r="22" fill="#ffe680" opacity="0.8" />
          <path d="M44 100 L 60 70 L 76 100" fill="none" stroke="#ffd23f" strokeWidth="3" opacity="0.6" />
          <path d="M31 15 L 46 24 L 46 106 L 31 114 Z" fill={t.base} stroke={OUT} strokeWidth="3.5" strokeLinejoin="round" />
          <circle cx="42" cy="66" r="2.8" fill="#ffd23f" stroke={OUT} strokeWidth="1.5" />
        </>
      ) : (
        <>
          <rect x="31" y="15" width="58" height="99" rx="3" fill={t.base} stroke={OUT} strokeWidth="3.5" />
          <rect x="38" y="23" width="44" height="34" rx="4" fill={t.light} opacity="0.55" />
          <rect x="38" y="64" width="44" height="40" rx="4" fill={t.light} opacity="0.55" />
          <circle cx="79" cy="64" r="4.5" fill="#ffd23f" stroke={OUT} strokeWidth="2" />
        </>
      )}
      <path d="M14 114 L 106 114" stroke={OUT} strokeWidth="3.5" strokeLinecap="round" />
    </g>
  );
}

function Key({ t }: { t: Tone }) {
  return (
    <g transform="rotate(-24 60 64)">
      <rect x="52" y="58" width="52" height="11" rx="4" fill={t.base} stroke={OUT} strokeWidth="3.5" />
      <path d="M84 68 L 84 82 L 92 82 L 92 68 M96 68 L 96 78 L 103 78 L 103 68" fill={t.base} stroke={OUT} strokeWidth="3" strokeLinejoin="round" />
      <circle cx="38" cy="63" r="22" fill={t.base} stroke={OUT} strokeWidth="3.5" />
      <circle cx="38" cy="63" r="9" fill="#f6f3ff" stroke={OUT} strokeWidth="3" />
      <path d="M26 50 Q 32 44 40 44" stroke={t.light} strokeWidth="4" fill="none" strokeLinecap="round" />
    </g>
  );
}

function Hat({ t }: { t: Tone }) {
  return (
    <g>
      <ellipse cx="60" cy="92" rx="54" ry="15" fill={t.base} stroke={OUT} strokeWidth="3.5" />
      <path d="M32 90 L 34 58 C 35 50, 44 46, 60 46 C 76 46, 85 50, 86 58 L 88 90 Z" fill={t.base} stroke={OUT} strokeWidth="3.5" strokeLinejoin="round" />
      <path d="M33 78 Q 60 86 87 78 L 87.6 88 Q 60 96 32.4 88 Z" fill={t.dark} />
      <path d="M44 56 C 47 52, 52 51, 58 51" stroke={t.light} strokeWidth="5" fill="none" strokeLinecap="round" />
      <path d="M78 80 l 10 -6 l 2 10 Z" fill="#ffd23f" stroke={OUT} strokeWidth="2" strokeLinejoin="round" />
    </g>
  );
}

function Table({ t }: { t: Tone }) {
  return (
    <g>
      <rect x="17" y="62" width="10" height="50" rx="3" fill={t.dark} stroke={OUT} strokeWidth="3" />
      <rect x="93" y="62" width="10" height="50" rx="3" fill={t.dark} stroke={OUT} strokeWidth="3" />
      <rect x="6" y="52" width="108" height="13" rx="4" fill={t.base} stroke={OUT} strokeWidth="3.5" />
      <path d="M12 56 H 108" stroke={t.light} strokeWidth="3" strokeLinecap="round" />
    </g>
  );
}

/** Draw `n` copies of a shape with their feet on `ground`, centred around x = cx. */
function Copies({ item, n, cx, ground, s, gap }: { item: ItemSpec; n: number; cx: number; ground: number; s: number; gap: number }) {
  const xs = n === 1 ? [cx] : n === 2 ? [cx - gap / 2, cx + gap / 2] : [cx - gap, cx, cx + gap];
  return (
    <>
      {xs.map((x, i) => (
        <g key={i} transform={`translate(${x} ${ground}) scale(${s}) translate(-60 -114)`}>
          <ItemShape item={item} />
        </g>
      ))}
    </>
  );
}

/** Two/three copies, or an item IN / ON / UNDER a reference object. */
function Composite({ item }: { item: ItemSpec }) {
  const main: ItemSpec = { kind: item.kind, color: item.color, size: item.size, state: item.state };
  const n = item.count ?? 1;
  const sizeK = item.size === 'small' ? 0.75 : item.size === 'big' ? 1.2 : 1;
  if (!item.rel) {
    const s = (n === 3 ? 0.36 : 0.5) * sizeK;
    return <Copies item={main} n={n} cx={60} ground={110} s={s} gap={n === 3 ? 38 : 54} />;
  }
  const ref: ItemSpec = { kind: item.rel.ref, color: 'brown', size: 'normal', state: item.rel.ref === 'box' ? (item.rel.pos === 'in' ? 'open' : 'closed') : 'none' };
  const t = PALETTE.brown;
  const k = (n === 1 ? 1 : n === 2 ? 0.8 : 0.66) * sizeK;
  const gap = n === 1 ? 0 : 34;
  if (item.rel.ref === 'table') {
    if (item.rel.pos === 'on')
      return (
        <>
          <ItemShape item={ref} />
          <Copies item={main} n={n} cx={60} ground={53} s={0.4 * k} gap={gap} />
        </>
      );
    return (
      <>
        <ItemShape item={ref} />
        <Copies item={main} n={n} cx={60} ground={112} s={0.38 * k} gap={gap} />
      </>
    );
  }
  // box
  if (item.rel.pos === 'in')
    return (
      <>
        <ItemShape item={ref} />
        <Copies item={main} n={n} cx={60} ground={74} s={0.52 * k} gap={gap} />
        <rect x="22" y="60" width="76" height="48" rx="3" fill={t.base} stroke={OUT} strokeWidth="3.5" />
        <rect x="54" y="60" width="12" height="48" fill={t.light} opacity="0.8" />
      </>
    );
  return (
    <>
      <ItemShape item={ref} />
      <Copies item={main} n={n} cx={60} ground={44} s={0.36 * k} gap={gap} />
    </>
  );
}

function Fallback({ label }: { label: string }) {
  return (
    <g>
      <rect x="14" y="20" width="92" height="84" rx="14" fill="#f1edff" stroke={OUT} strokeWidth="3" strokeDasharray="6 5" />
      <text x="60" y="68" textAnchor="middle" fontSize="16" fill={OUT} fontFamily="Rubik, sans-serif">
        {label}
      </text>
    </g>
  );
}

export function ItemShape({ item }: { item: ItemSpec }) {
  if ((item.count && item.count > 1) || item.rel) return <Composite item={item} />;
  const t = PALETTE[item.color] ?? PALETTE.gray;
  switch (item.kind) {
    case 'apple':
      return <Apple t={t} />;
    case 'ball':
      return <Ball t={t} />;
    case 'cat':
      return <Cat t={t} />;
    case 'dog':
      return <Dog t={t} />;
    case 'car':
      return <Car t={t} />;
    case 'star':
      return <Star t={t} />;
    case 'cup':
      return <Cup t={t} />;
    case 'box':
      return <Box t={t} open={item.state === 'open'} />;
    case 'door':
      return <Door t={t} open={item.state === 'open'} />;
    case 'key':
      return <Key t={t} />;
    case 'hat':
      return <Hat t={t} />;
    case 'table':
      return <Table t={t} />;
    default:
      return <Fallback label={describeItemHe(item)} />;
  }
}

export function ItemArt({
  item,
  size = 120,
  className = '',
  decorative = false,
  ignoreSize = false,
}: {
  item: ItemSpec;
  size?: number | string;
  className?: string;
  decorative?: boolean;
  ignoreSize?: boolean;
}) {
  // Composite pictures (several copies / an item on a table) use the whole frame.
  const composite = (item.count && item.count > 1) || !!item.rel;
  const s = composite ? 1 : ignoreSize ? 0.92 : (SCALE[item.size] ?? SCALE.normal);
  const label = describeItemHe(item);
  return (
    <svg
      viewBox="0 0 120 120"
      width={size}
      height={size}
      className={className}
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : label}
      aria-hidden={decorative ? true : undefined}
    >
      <g transform={`translate(60 114) scale(${s}) translate(-60 -114)`}>
        <ItemShape item={item} />
      </g>
    </svg>
  );
}
