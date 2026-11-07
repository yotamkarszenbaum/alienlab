import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { AlienMood } from '../../components/Alien';
import { AlienStage, BigButton, EnglishWord, HelpButton, HintPanel, OptionCard, SpeakButton, WordOption, type OptionState } from '../../components/ui';
import { ItemArt } from '../../components/ItemArt';
import { IconArrowLeft } from '../../components/Icons';
import { initialSupport, onHelp, onLessHelp, onWrong, type SupportState } from '../../engine/hints';
import { reduceOptions, type ChoiceOption, type QuestionInstance } from '../../engine/tasks';
import { recordChoice } from '../../engine/session';
import { useGame, now } from '../../state/GameContext';
import { playSfx } from '../../audio/sfx';
import { speak, useSpeechStatus } from '../../audio/speech';
import { WORDS_BY_ID } from '../../content/words';

// Positions (percent of the scene) for up to 5 items: two on the shelf, three on the floor.
const SCENE_POS = [
  { left: 3, top: 49, w: 24 },
  { left: 27, top: 14, w: 20 },
  { left: 38, top: 52, w: 22 },
  { left: 72, top: 49, w: 24 },
  { left: 56, top: 17, w: 18 },
];

/** A simple lab room drawn in SVG: window with stars, a shelf and the floor. */
function LabScene({ children }: { children: ReactNode }) {
  return (
    <div className="card relative w-full overflow-hidden !p-0" style={{ aspectRatio: '16 / 10' }} data-testid="options" data-layout="scene">
      <svg viewBox="0 0 160 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full" aria-hidden>
        <rect x="0" y="0" width="160" height="72" fill="#e9e3ff" />
        <rect x="0" y="72" width="160" height="28" fill="#d8ceff" />
        <path d="M0 72 H160" stroke="#2b2350" strokeWidth="0.8" />
        <rect x="8" y="8" width="34" height="24" rx="3" fill="#2f2a5c" stroke="#2b2350" strokeWidth="0.8" />
        <circle cx="16" cy="15" r="1.2" fill="#fff" />
        <circle cx="30" cy="12" r="0.9" fill="#fff" />
        <circle cx="35" cy="24" r="1.3" fill="#ffd23f" />
        <circle cx="21" cy="25" r="0.8" fill="#fff" />
        <rect x="40" y="45.5" width="80" height="3" rx="1" fill="#b98a5e" stroke="#2b2350" strokeWidth="0.6" />
        <rect x="126" y="10" width="26" height="18" rx="2" fill="#fff" stroke="#2b2350" strokeWidth="0.6" />
        <circle cx="132" cy="19" r="2.5" fill="#7ef0cf" />
        <circle cx="140" cy="19" r="2.5" fill="#ff9fb8" />
        <circle cx="148" cy="19" r="2.5" fill="#ffd23f" />
      </svg>
      {children}
    </div>
  );
}

export interface QuestionResult {
  firstTryCorrect: boolean;
  anyHint: boolean;
  wrongs: number;
  chosen: ChoiceOption;
}

function featureTipHe(wordIds: string[]): string | null {
  const dims = wordIds.map((id) => WORDS_BY_ID[id]?.target.dim);
  if (dims.includes('color')) return 'שימו לב לצבע.';
  if (dims.includes('size')) return 'שימו לב לגודל — מה גדול ומה קטן?';
  if (dims.includes('state')) return 'שימו לב: פתוח או סגור?';
  return null;
}

function sayItOf(q: QuestionInstance) {
  return q.wordIds.map((id) => WORDS_BY_ID[id]?.sayItHe).filter(Boolean).join(' ');
}

export function ChoiceQuestion({
  question,
  phase,
  askLine,
  successLine,
  makeEasier,
  onComplete,
  continueLabel = 'המשך',
  header,
  ignoreSize = false,
  layout = 'grid',
  afterSuccess,
}: {
  question: QuestionInstance;
  phase: 'learn' | 'review';
  askLine: string;
  successLine?: (q: QuestionInstance, withHelp: boolean) => string;
  makeEasier?: (q: QuestionInstance) => QuestionInstance | null;
  onComplete: (r: QuestionResult) => void;
  continueLabel?: string;
  header?: ReactNode | ((supportLevel: number) => ReactNode);
  ignoreSize?: boolean;
  layout?: 'grid' | 'scene';
  /** Extra content once answered (e.g. what changed in Kosmo's brain). */
  afterSuccess?: ReactNode;
}) {
  const { update, data } = useGame();
  const enStatus = useSpeechStatus('en');
  const heStatus = useSpeechStatus('he');
  const [q, setQ] = useState(question);
  const [support, setSupport] = useState<SupportState>(initialSupport);
  const [eliminated, setEliminated] = useState<string[]>([]);
  const [lastWrong, setLastWrong] = useState<string | null>(null);
  const [done, setDone] = useState<ChoiceOption | null>(null);
  const [line, setLine] = useState(askLine);
  const [mood, setMood] = useState<AlienMood>('curious');
  const [isFollowUp, setIsFollowUp] = useState(false);
  const [firstResult, setFirstResult] = useState<{ firstTryCorrect: boolean; anyHint: boolean; wrongs: number } | null>(null);
  const busy = useRef(false);
  const nudges = useRef(0);

  // reset when a new question arrives
  useEffect(() => {
    setQ(question);
    setSupport(initialSupport);
    setEliminated([]);
    setLastWrong(null);
    setDone(null);
    setLine(askLine);
    setMood('curious');
    setIsFollowUp(false);
    setFirstResult(null);
    nudges.current = 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question.key]);

  // Gentle nudge if the child does not choose (no timer pressure, no penalty).
  useEffect(() => {
    if (done) return;
    const t = setTimeout(() => {
      if (nudges.current >= 2) return;
      nudges.current += 1;
      setMood('happy');
      setLine('קחו את הזמן 🙂 אפשר ללחוץ על מה שנראה לכם נכון, או על "עזרה".');
    }, 16000);
    return () => clearTimeout(t);
  }, [done, line]);

  const english = q.promptEn;
  const hebrew = q.promptHe;
  const explain =
    q.mode === 'read'
      ? `התשובה כתובה במשפט: ${english.replace(/[.!?]+$/, '')}`
      : q.wordIds.length === 1
        ? (WORDS_BY_ID[q.wordIds[0]]?.explainHe ?? `${english} זה ${hebrew}`)
        : `${english} זה ${hebrew}`;
  const tip = featureTipHe(q.wordIds);
  const audioOnly = !q.showText && enStatus !== 'unavailable';
  const readAloud = data.settings.readAloudHe && heStatus !== 'unavailable';

  const visibleOptions = useMemo(() => {
    if (support.level >= 2) return reduceOptions(q.options, eliminated);
    return q.options;
  }, [q, support.level, eliminated]);

  function applySupportLine(s: SupportState, fromWrong: boolean) {
    if (s.level === 1) {
      setLine(fromWrong ? `לא נורא, בואו ננסה יחד. ${explain}.` : `רמז: ${explain}.`);
      setMood('thinking');
      void speak(english, 'en');
    } else if (s.level === 2) {
      setLine(`${fromWrong ? 'כמעט! ' : ''}השארתי רק שתי תמונות. ${tip ?? explain + '.'}`);
      setMood('thinking');
    } else if (s.level === 3) {
      setLine(`בואו נעשה את זה יחד: התמונה הזוהרת היא ${english}. לחצו עליה!`);
      setMood('happy');
      void speak(english, 'en');
    }
  }

  function choose(o: ChoiceOption) {
    if (done || busy.current) return;
    if (eliminated.includes(o.key)) return;
    busy.current = true;
    setTimeout(() => (busy.current = false), 500);
    const attemptNumber = support.wrong + 1;
    update((d) => recordChoice(d, q, o, attemptNumber, support, phase, now()));
    if (o.correct) {
      playSfx('correct');
      setDone(o);
      setMood('success');
      const withHelp = support.used.length > 0;
      const result = { firstTryCorrect: support.wrong === 0 && !withHelp, anyHint: withHelp, wrongs: support.wrong };
      if (!isFollowUp) setFirstResult(result);
      setLine(
        successLine
          ? successLine(q, withHelp)
          : withHelp
            ? `יפה מאוד! ${english} — ${hebrew}. הצלחתם בעזרת רמז, ובפעם הבאה ננסה לבד.`
            : `כל הכבוד! ${english} — ${hebrew}!`,
      );
    } else {
      playSfx('tryAgain');
      const s = onWrong(support);
      setSupport(s);
      setEliminated((e) => [...e, o.key]);
      setLastWrong(o.key);
      applySupportLine(s, true);
    }
  }

  function help() {
    if (done) return;
    const s = onHelp(support);
    setSupport(s);
    applySupportLine(s, false);
  }

  function next() {
    const usedDemo = support.used.includes('demo');
    if (usedDemo && !isFollowUp && makeEasier) {
      const easier = makeEasier(q);
      if (easier) {
        // Persistent difficulty -> guided demo, then an easier (different) task with the same word.
        setQ(easier);
        setIsFollowUp(true);
        setSupport(initialSupport);
        setEliminated([]);
        setLastWrong(null);
        setDone(null);
        setMood('curious');
        setLine(`עכשיו תורכם לבד, בגרסה קלה יותר: איפה ${easier.promptEn}?`);
        return;
      }
    }
    onComplete({ ...(firstResult ?? { firstTryCorrect: false, anyHint: true, wrongs: support.wrong }), chosen: done! });
  }

  function stateOf(o: ChoiceOption): OptionState {
    if (done) return o.key === done.key ? 'correct' : 'eliminated';
    if (o.key === lastWrong) return 'wrong';
    if (eliminated.includes(o.key)) return 'eliminated';
    if (support.level >= 3 && o.correct) return 'highlight';
    return 'idle';
  }

  const cols = visibleOptions.length >= 4 ? 'grid-cols-2 lg:grid-cols-4' : visibleOptions.length === 3 ? 'grid-cols-3' : 'grid-cols-2';

  return (
    <div className="flex flex-col gap-4" data-testid="choice-question" data-question={q.key} data-mode={q.mode}>
      <AlienStage mood={mood} text={line} />
      {typeof header === 'function' ? header(done ? 0 : support.level) : header}

      <div className="card px-4 py-4 flex flex-col items-center gap-3 text-center">
        {q.mode === 'read' ? (
          <p className="text-2xl font-extrabold" data-testid="read-question">
            {hebrew}
          </p>
        ) : q.mode === 'picture_to_word' && q.picture ? (
          <>
            <ItemArt item={q.picture} size="clamp(130px, 30vw, 190px)" />
            <p className="text-xl font-bold">איך קוראים לזה באנגלית?</p>
          </>
        ) : audioOnly ? (
          <div className="flex items-center gap-4">
            <SpeakButton text={english} size="lg" sayHe={sayItOf(q)} autoPlayKey={q.key} testId="prompt-speak" />
            <p className="text-xl font-bold">הקשיבו — ואז בחרו את התמונה</p>
          </div>
        ) : (
          <div className="flex items-center gap-4 flex-wrap justify-center">
            <EnglishWord text={english} size={english.length > 10 ? 'lg' : 'xl'} />
            <SpeakButton text={english} sayHe={sayItOf(q)} autoPlayKey={readAloud ? null : q.key} testId="prompt-speak" />
          </div>
        )}
      </div>

      {support.level > 0 && !done && (
        <HintPanel level={support.level} onLess={() => setSupport(onLessHelp(support))}>
          {support.level >= 1 && q.mode === 'read' && (
            <p className="flex items-center gap-2 flex-wrap">
              התשובה נמצאת במשפט המודגש:{' '}
              <bdi className="en text-primary-dark" dir="ltr">
                {english}
              </bdi>
              <SpeakButton text={english} size="sm" label="השמעת המשפט" />
            </p>
          )}
          {support.level >= 1 && q.mode !== 'read' && (
            <p>
              <bdi className="en text-primary-dark" dir="ltr">
                {english}
              </bdi>{' '}
              = <b>{hebrew}</b> <span className="text-ink-soft text-base">(אומרים: {sayItOf(q)})</span>
            </p>
          )}
          {support.level >= 2 && tip && <p className="text-base mt-1">{tip}</p>}
          {support.level >= 3 && <p className="text-base mt-1">התמונה הנכונה זוהרת בצהוב.</p>}
        </HintPanel>
      )}

      {layout === 'scene' ? (
        <LabScene>
          {q.options.map((o, idx) => {
            const base = SCENE_POS[idx % SCENE_POS.length];
            // A BIG item gets a bigger spot (same floor line), so size differences are obvious.
            const grow = o.item?.size === 'big' ? 1.3 : 1;
            const w = base.w * grow;
            const pos = { w, left: base.left - (w - base.w) / 2, top: base.top - (w - base.w) * 1.6 };
            const st = visibleOptions.includes(o) ? stateOf(o) : 'eliminated';
            return (
              <OptionCard
                key={o.key}
                option={o}
                state={st}
                bare
                onClick={() => choose(o)}
                disabled={!!done}
                imgSize="100%"
                style={{ position: 'absolute', left: `${pos.left}%`, top: `${pos.top}%`, width: `${pos.w}%`, aspectRatio: '1 / 1' }}
              />
            );
          })}
        </LabScene>
      ) : (
      <div className={`grid ${cols} gap-3 sm:gap-4`} data-testid="options">
        {visibleOptions.map((o) =>
          o.wordId ? (
            <WordOption key={o.key} option={o} state={stateOf(o)} onClick={() => choose(o)} disabled={!!done} />
          ) : (
            <OptionCard key={o.key} option={o} state={stateOf(o)} onClick={() => choose(o)} disabled={!!done} ignoreSize={ignoreSize} />
          ),
        )}
      </div>
      )}

      {done && afterSuccess}

      <div className="flex items-center justify-between gap-3 flex-wrap pt-2">
        {!done ? <HelpButton onClick={help} level={support.level} /> : <span />}
        <BigButton onClick={next} locked={!done} lockedMessage="קודם בוחרים תמונה 🙂" testId="next-btn">
          {continueLabel} <IconArrowLeft size={24} />
        </BigButton>
      </div>
    </div>
  );
}
