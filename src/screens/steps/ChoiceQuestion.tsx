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
}: {
  question: QuestionInstance;
  phase: 'learn' | 'review';
  askLine: string;
  successLine?: (q: QuestionInstance, withHelp: boolean) => string;
  makeEasier?: (q: QuestionInstance) => QuestionInstance | null;
  onComplete: (r: QuestionResult) => void;
  continueLabel?: string;
  header?: ReactNode;
  ignoreSize?: boolean;
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
  const explain = q.wordIds.length === 1 ? (WORDS_BY_ID[q.wordIds[0]]?.explainHe ?? `${english} זה ${hebrew}`) : `${english} זה ${hebrew}`;
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
      {header}

      <div className="card px-4 py-4 flex flex-col items-center gap-3 text-center">
        {q.mode === 'picture_to_word' && q.picture ? (
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
          {support.level >= 1 && (
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

      <div className={`grid ${cols} gap-3 sm:gap-4`} data-testid="options">
        {visibleOptions.map((o) =>
          o.wordId ? (
            <WordOption key={o.key} option={o} state={stateOf(o)} onClick={() => choose(o)} disabled={!!done} />
          ) : (
            <OptionCard key={o.key} option={o} state={stateOf(o)} onClick={() => choose(o)} disabled={!!done} ignoreSize={ignoreSize} />
          ),
        )}
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap pt-2">
        {!done ? <HelpButton onClick={help} level={support.level} /> : <span />}
        <BigButton onClick={next} locked={!done} lockedMessage="קודם בוחרים תמונה 🙂" testId="next-btn">
          {continueLabel} <IconArrowLeft size={24} />
        </BigButton>
      </div>
    </div>
  );
}
