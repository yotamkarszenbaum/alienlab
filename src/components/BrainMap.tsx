import type { Feature } from '../engine/types';
import { brainView, COLOR_HEX, featureIcon, featureShortHe, type BrainChange, type BrainLink } from '../engine/brain';
import { guessLabelHe } from '../engine/alienMind';
import { UNDERSTANDING_HE } from '../engine/alienMind';
import { WORDS_BY_ID } from '../content/words';
import { useGame } from '../state/GameContext';

// The transparent brain: the word in the middle, the meanings Kosmo links it to
// around it. A solid line = what he thinks now, dashed = "maybe", a cut line =
// a link the child's teaching removed. Derived from the real model only.

const W = 360;
const CX = W / 2;
/** Height and node positions fit the number of links, so small brains stay compact. */
function layout(n: number) {
  if (n <= 2) {
    const H = 104;
    return { H, CY: H / 2, slots: [{ x: 62, y: H / 2 }, { x: W - 62, y: H / 2 }] };
  }
  if (n <= 4) {
    const H = 150;
    return { H, CY: H / 2, slots: [{ x: 62, y: 34 }, { x: W - 62, y: 34 }, { x: 62, y: H - 34 }, { x: W - 62, y: H - 34 }] };
  }
  const H = 210;
  return { H, CY: H / 2, slots: [{ x: 62, y: 38 }, { x: W - 62, y: 38 }, { x: 62, y: H / 2 }, { x: W - 62, y: H / 2 }, { x: 62, y: H - 38 }, { x: W - 62, y: H - 38 }] };
}

const STROKE: Record<BrainLink['state'] | 'mixup', { color: string; width: number; dash?: string }> = {
  guess: { color: '#7c5cff', width: 5 },
  possible: { color: '#b9aef0', width: 3, dash: '7 6' },
  cut: { color: '#e08a1e', width: 3, dash: '3 7' },
  mixup: { color: '#e08a1e', width: 3, dash: '10 6' },
};

function Node({ x, y, f, state, understood }: { x: number; y: number; f: Feature; state: BrainLink['state']; understood: boolean }) {
  const label = featureShortHe(f);
  const faded = state === 'cut';
  const strong = state === 'guess';
  return (
    <g opacity={faded ? 0.55 : 1} data-link={state} data-feature={`${f.dim}:${f.value}`}>
      <rect x={x - 54} y={y - 19} width={108} height={38} rx={19} fill={strong ? (understood ? '#dcfce9' : '#efeaff') : '#fff'} stroke={strong ? (understood ? '#15935a' : '#7c5cff') : '#d9d2f7'} strokeWidth={strong ? 3 : 2} />
      {f.dim === 'color' ? (
        <circle cx={x + 34} cy={y} r={9} fill={COLOR_HEX[f.value] ?? '#ccc'} stroke="#2b2350" strokeWidth={1.5} />
      ) : (
        <text x={x + 34} y={y + 6} fontSize={17} textAnchor="middle">
          {featureIcon(f)}
        </text>
      )}
      <text x={x - 6} y={y + 6} fontSize={15} fontWeight={800} textAnchor="middle" direction="rtl" fill="#2b2350" textDecoration={faded ? 'line-through' : undefined}>
        {label}
      </text>
      {strong && understood && (
        <text x={x - 44} y={y - 10} fontSize={14} textAnchor="middle">
          💡
        </text>
      )}
    </g>
  );
}

export function BrainMap({ wordId, compact = false }: { wordId: string; compact?: boolean }) {
  const { data } = useGame();
  const v = brainView(data, wordId);
  const w = WORDS_BY_ID[wordId];
  const understood = v.understanding === 'understood';
  const { H, CY, slots } = layout(Math.max(v.links.length, 1));
  const links = v.links.map((l, i) => ({ ...l, ...slots[i] }));
  return (
    <div className="flex flex-col items-center gap-1" data-testid={`brain-map-${wordId}`} data-understanding={v.understanding} data-links={v.links.map((l) => `${l.state}:${l.feature.dim}:${l.feature.value}`).join(',')}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: compact ? 300 : 380 }} role="img" aria-label={`המוח של קוסמו: ${w.english}`}>
        {links.map((l, i) => {
          const s = STROKE[l.state];
          const mx = (CX + l.x) / 2;
          const my = (CY + l.y) / 2;
          return (
            <g key={`line-${i}`}>
              <line x1={CX} y1={CY} x2={l.x} y2={l.y} stroke={s.color} strokeWidth={s.width} strokeDasharray={s.dash} strokeLinecap="round" />
              {l.state === 'cut' && (
                <text x={mx} y={my + 6} fontSize={18} textAnchor="middle">
                  ✂️
                </text>
              )}
            </g>
          );
        })}
        {v.mixupWith && (
          <g data-link="mixup">
            <line x1={CX} y1={CY} x2={W - 70} y2={CY} stroke={STROKE.mixup.color} strokeWidth={STROKE.mixup.width} strokeDasharray={STROKE.mixup.dash} />
            <rect x={W - 124} y={CY - 19} width={108} height={38} rx={19} fill="#fff3d6" stroke="#e08a1e" strokeWidth={2} />
            <text x={W - 70} y={CY + 6} fontSize={15} fontWeight={800} textAnchor="middle" fill="#b45309" fontFamily="inherit">
              {WORDS_BY_ID[v.mixupWith].english}?
            </text>
            <text x={(CX + W - 124) / 2 + 10} y={CY - 10} fontSize={16} textAnchor="middle">
              😵‍💫
            </text>
          </g>
        )}
        {!v.links.length && !v.mixupWith && (
          <text x={62} y={CY + 8} fontSize={26} textAnchor="middle" fill="#b9aef0" fontWeight={800}>
            ?
          </text>
        )}
        {links.map((l, i) => (
          <Node key={`node-${i}`} x={l.x} y={l.y} f={l.feature} state={l.state} understood={understood} />
        ))}
        <rect x={CX - 58} y={CY - 24} width={116} height={48} rx={14} fill="#5b3fd8" stroke="#2b2350" strokeWidth={3} />
        <text x={CX} y={CY + 8} fontSize={22} fontWeight={900} textAnchor="middle" fill="#fff" style={{ letterSpacing: 1 }}>
          {w.english}
        </text>
      </svg>
      {!compact && (
        <p className="text-sm text-ink-soft flex flex-wrap gap-x-3 justify-center">
          <span>
            <b className="text-primary">━</b> מה קוסמו חושב
          </span>
          <span>
            <b className="text-[#b9aef0]">┅</b> אולי
          </span>
          <span>✂️ נחתך בזכותכם</span>
          {v.mixupWith && <span>😵‍💫 מתבלבל</span>}
          <span className="font-bold text-ink">· {UNDERSTANDING_HE[v.understanding]}</span>
        </p>
      )}
    </div>
  );
}

/** "🧠 במוח של קוסמו: BLUE ✂️ מכונית → 💡 הצבע הכחול" — shown right after a teaching moment. */
export function BrainChangeCard({ change }: { change: BrainChange | null }) {
  if (!change) return null;
  const EN = WORDS_BY_ID[change.wordId]?.english ?? change.wordId;
  const isNew = !change.before && !!change.after;
  const changedGuess = !!change.before && !!change.after && !(change.before.dim === change.after.dim && change.before.value === change.after.value);
  const understood = change.understandingAfter === 'understood';
  return (
    <div className="card p-3 flex flex-wrap items-center gap-2 anim-pop bg-[#f7f4ff]" data-testid="brain-change" data-word={change.wordId} data-before={change.before ? `${change.before.dim}:${change.before.value}` : ''} data-after={change.after ? `${change.after.dim}:${change.after.value}` : ''}>
      <span className="font-extrabold">🧠 במוח של קוסמו:</span>
      <bdi dir="ltr" className="en text-primary-dark text-lg">
        {EN}
      </bdi>
      {isNew ? (
        <span className="rounded-full bg-good-bg border-2 border-good px-2 font-bold">✨ קשר חדש: {guessLabelHe(change.after!)}</span>
      ) : changedGuess ? (
        <>
          <span className="rounded-full bg-try-bg border-2 border-try px-2 font-bold line-through decoration-2">✂️ {guessLabelHe(change.before!)}</span>
          <span aria-hidden>←</span>
          <span className={`rounded-full border-2 px-2 font-bold ${understood ? 'bg-good-bg border-good' : 'bg-lab border-line'}`}>
            {understood ? '💡' : '🤔'} {guessLabelHe(change.after!)}
          </span>
        </>
      ) : (
        <>
          {change.cut.length > 0 && <span className="rounded-full bg-try-bg border-2 border-try px-2 font-bold">✂️ נחתך: {change.cut.map(guessLabelHe).join(', ')}</span>}
          {change.after && (
            <span className={`rounded-full border-2 px-2 font-bold ${understood ? 'bg-good-bg border-good' : 'bg-lab border-line'}`}>
              {understood ? '💡 עכשיו בטוח:' : '🤔 נשאר:'} {guessLabelHe(change.after)}
            </span>
          )}
        </>
      )}
    </div>
  );
}
