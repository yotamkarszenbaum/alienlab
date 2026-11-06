// The alien "Zibi" — one consistent SVG character with 7 moods.
export type AlienMood = 'neutral' | 'curious' | 'happy' | 'thinking' | 'confused' | 'discovery' | 'success';

const OUT = '#2b2350';
const SKIN = '#45d0a0';
const SKIN_LIGHT = '#a6f0d2';
const SPOT = '#7fe3bf';

function Arm({ d }: { d: string }) {
  return (
    <g>
      <path d={d} stroke={OUT} strokeWidth="22" fill="none" strokeLinecap="round" />
      <path d={d} stroke={SKIN} strokeWidth="14" fill="none" strokeLinecap="round" />
    </g>
  );
}

const ARMS: Record<AlienMood, [string, string]> = {
  neutral: ['M40 128 Q 20 140 22 162', 'M160 128 Q 180 140 178 162'],
  curious: ['M40 128 Q 20 140 22 162', 'M160 124 Q 184 114 186 94'],
  happy: ['M40 128 Q 18 126 14 108', 'M160 128 Q 182 126 186 108'],
  thinking: ['M40 128 Q 20 140 22 162', 'M160 132 Q 156 166 128 158'],
  confused: ['M40 122 Q 20 92 46 70', 'M160 128 Q 180 140 178 162'],
  discovery: ['M40 120 Q 14 100 20 76', 'M160 120 Q 186 100 180 76'],
  success: ['M40 118 Q 14 92 24 66', 'M160 118 Q 186 92 176 66'],
};

function Eyes({ mood }: { mood: AlienMood }) {
  if (mood === 'success' || mood === 'happy') {
    return (
      <g stroke={OUT} strokeWidth="6" fill="none" strokeLinecap="round">
        <path d="M60 108 Q 76 88 92 108" />
        <path d="M108 108 Q 124 88 140 108" />
      </g>
    );
  }
  const big = mood === 'discovery';
  const r = big ? 23 : 20;
  const pr = big ? 8 : 9;
  const off: Record<string, [number, number]> = {
    neutral: [0, 1],
    curious: [3, -3],
    thinking: [-5, -8],
    confused: [0, 0],
    discovery: [0, 0],
  };
  const [dx, dy] = off[mood] ?? [0, 0];
  const rR = mood === 'confused' ? 16 : r;
  return (
    <g>
      <circle cx="76" cy="104" r={r} fill="#fff" stroke={OUT} strokeWidth="3.5" />
      <circle cx="124" cy="104" r={rR} fill="#fff" stroke={OUT} strokeWidth="3.5" />
      <circle className="alien-pupil" cx={76 + dx} cy={104 + dy} r={pr} fill={OUT} />
      <circle className="alien-pupil" cx={124 + dx} cy={104 + dy} r={mood === 'confused' ? 7 : pr} fill={OUT} />
      <circle cx={73 + dx} cy={100 + dy} r="3" fill="#fff" />
      <circle cx={121 + dx} cy={100 + dy} r="2.6" fill="#fff" />
    </g>
  );
}

function Brows({ mood }: { mood: AlienMood }) {
  const p = { stroke: OUT, strokeWidth: 4.5, fill: 'none', strokeLinecap: 'round' as const };
  if (mood === 'curious')
    return (
      <g>
        <path d="M60 74 Q 76 64 92 72" {...p} />
        <path d="M108 72 Q 124 64 140 74" {...p} />
      </g>
    );
  if (mood === 'thinking')
    return (
      <g>
        <path d="M60 78 Q 76 74 92 78" {...p} />
        <path d="M110 74 Q 124 62 140 70" {...p} />
      </g>
    );
  if (mood === 'confused')
    return (
      <g>
        <path d="M60 70 Q 76 76 92 80" {...p} />
        <path d="M110 80 Q 124 76 140 82" {...p} />
      </g>
    );
  if (mood === 'discovery')
    return (
      <g>
        <path d="M58 68 Q 76 56 94 66" {...p} />
        <path d="M106 66 Q 124 56 142 68" {...p} />
      </g>
    );
  return null;
}

function Mouth({ mood }: { mood: AlienMood }) {
  switch (mood) {
    case 'happy':
    case 'success':
      return (
        <g>
          <path d="M78 136 Q 100 166 122 136 Z" fill={OUT} stroke={OUT} strokeWidth="3" strokeLinejoin="round" />
          <path d="M90 150 Q 100 158 110 150 Q 100 146 90 150 Z" fill="#ff7b9c" />
        </g>
      );
    case 'curious':
      return <ellipse cx="100" cy="144" rx="6" ry="7" fill={OUT} />;
    case 'thinking':
      return <path d="M88 146 Q 98 141 112 143" stroke={OUT} strokeWidth="4.5" fill="none" strokeLinecap="round" />;
    case 'confused':
      return <path d="M82 146 Q 91 138 100 146 Q 109 154 118 146" stroke={OUT} strokeWidth="4.5" fill="none" strokeLinecap="round" />;
    case 'discovery':
      return <ellipse cx="100" cy="146" rx="9" ry="11" fill={OUT} />;
    default:
      return <path d="M84 140 Q 100 154 116 140" stroke={OUT} strokeWidth="4.5" fill="none" strokeLinecap="round" />;
  }
}

function Overlay({ mood }: { mood: AlienMood }) {
  if (mood === 'confused')
    return (
      <text x="172" y="58" fontSize="44" fontWeight="800" fill="#7c5cff" fontFamily="Fredoka, Rubik, sans-serif" className="alien-overlay">
        ?
      </text>
    );
  if (mood === 'discovery')
    return (
      <g className="alien-overlay">
        <text x="174" y="56" fontSize="46" fontWeight="800" fill="#ff8a3d" fontFamily="Fredoka, Rubik, sans-serif">
          !
        </text>
        <path d="M22 40 l4 -10 l4 10 l10 4 l-10 4 l-4 10 l-4 -10 l-10 -4 Z" fill="#ffd23f" />
      </g>
    );
  if (mood === 'thinking')
    return (
      <g className="alien-overlay" fill="#ffffff" stroke={OUT} strokeWidth="2.5">
        <circle cx="168" cy="40" r="5" />
        <circle cx="180" cy="24" r="7" />
      </g>
    );
  if (mood === 'success')
    return (
      <g className="alien-overlay" fill="#ffd23f" stroke={OUT} strokeWidth="2">
        <path d="M20 46 l5 -12 l5 12 l12 5 l-12 5 l-5 12 l-5 -12 l-12 -5 Z" />
        <path d="M176 40 l4 -9 l4 9 l9 4 l-9 4 l-4 9 l-4 -9 l-9 -4 Z" />
      </g>
    );
  return null;
}

export function Alien({ mood = 'neutral', size = 160, className = '' }: { mood?: AlienMood; size?: number | string; className?: string }) {
  const glow = mood === 'discovery' || mood === 'success' || mood === 'happy';
  const [armL, armR] = ARMS[mood];
  return (
    <svg
      viewBox="0 0 200 225"
      width={size}
      height={typeof size === 'number' ? size * 1.125 : size}
      className={`alien alien--${mood} ${className}`}
      role="img"
      aria-label={`החייזר זיבי (${MOOD_HE[mood]})`}
    >
      <g className="alien-body">
        {/* antennae */}
        <path d="M80 52 L 64 18" stroke={OUT} strokeWidth="5" strokeLinecap="round" />
        <path d="M120 52 L 136 18" stroke={OUT} strokeWidth="5" strokeLinecap="round" />
        {glow && <circle cx="64" cy="16" r="16" fill="#ffd23f" opacity="0.35" />}
        {glow && <circle cx="136" cy="16" r="16" fill="#ffd23f" opacity="0.35" />}
        <circle cx="64" cy="16" r="9" fill="#ffd23f" stroke={OUT} strokeWidth="3.5" />
        <circle cx="136" cy="16" r="9" fill="#ffd23f" stroke={OUT} strokeWidth="3.5" />
        <Arm d={armL} />
        <Arm d={armR} />
        {/* feet */}
        <ellipse cx="76" cy="204" rx="20" ry="10" fill={SKIN} stroke={OUT} strokeWidth="3.5" />
        <ellipse cx="124" cy="204" rx="20" ry="10" fill={SKIN} stroke={OUT} strokeWidth="3.5" />
        {/* body */}
        <path
          d="M100 42 C 152 42, 172 86, 170 134 C 168 180, 142 202, 100 202 C 58 202, 32 180, 30 134 C 28 86, 48 42, 100 42 Z"
          fill={SKIN}
          stroke={OUT}
          strokeWidth="4"
        />
        <ellipse cx="100" cy="168" rx="44" ry="28" fill={SKIN_LIGHT} />
        <circle cx="66" cy="66" r="6" fill={SPOT} />
        <circle cx="136" cy="70" r="4.5" fill={SPOT} />
        <circle cx="54" cy="90" r="3.5" fill={SPOT} />
        <circle cx="148" cy="96" r="3" fill={SPOT} />
        <ellipse cx="56" cy="130" rx="11" ry="7" fill="#ff9fb8" opacity="0.75" />
        <ellipse cx="144" cy="130" rx="11" ry="7" fill="#ff9fb8" opacity="0.75" />
        <Brows mood={mood} />
        <Eyes mood={mood} />
        <Mouth mood={mood} />
      </g>
      <Overlay mood={mood} />
    </svg>
  );
}

export const MOOD_HE: Record<AlienMood, string> = {
  neutral: 'רגוע',
  curious: 'סקרן',
  happy: 'שמח',
  thinking: 'חושב',
  confused: 'מבולבל קצת',
  discovery: 'גילה משהו',
  success: 'הצליח',
};
