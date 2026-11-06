import { useEffect, useMemo, useRef, useState } from 'react';
import type { AlienMood } from '../../components/Alien';
import { ItemArt } from '../../components/ItemArt';
import { AlienStage, BigButton, HelpButton, HintPanel, SpeakButton } from '../../components/ui';
import { IconArrowLeft } from '../../components/Icons';
import { initialSupport, onHelp, onWrong, type SupportState } from '../../engine/hints';
import { seededShuffle } from '../../engine/alienMind';
import { introduceWord, recordWordAttempt } from '../../engine/session';
import { levelOfGame } from '../../engine/gameProgress';
import { inRange } from '../../content/levels';
import { unitWordIds } from '../../content/units';
import { getWord, WORDS_BY_ID } from '../../content/words';
import { useGame, now } from '../../state/GameContext';
import { useSpeechStatus, speak } from '../../audio/speech';
import { playSfx } from '../../audio/sfx';
import type { Level, MixupRoundDef, SaveData, UnitDef } from '../../engine/types';

// "Kosmo gets confused" (levels 2–3). Kosmo looks at a picture and says what he
// sees in English — sometimes with a wrong word. The child decides whether he
// is right, taps the wrong word and picks the right one. As the opening of a
// station it also checks the basic words: words the child handled on their own
// skip their introduction; the others skip only the introduction screen (the
// round already showed them) and keep one practice question.

type Stage = 'judge' | 'find' | 'fix' | 'done';

interface RoundResult {
  perfect: boolean;
  caught: boolean; // the child found Kosmo's mistake (or confirmed he was right)
}

const sentenceOf = (tokens: string[]) => `${tokens.join(' ')}.`;

function RoundView({
  round,
  roundNo,
  total,
  record,
  onComplete,
  continueLabel,
}: {
  round: MixupRoundDef;
  roundNo: number;
  total: number;
  record: (r: RoundResult, support: SupportState) => void;
  onComplete: () => void;
  continueLabel: string;
}) {
  const { data } = useGame();
  const heStatus = useSpeechStatus('he');
  const alienReads = data.settings.readAloudHe && heStatus !== 'unavailable';
  const kosmoRight = round.wrongAt === undefined;
  const [stage, setStage] = useState<Stage>('judge');
  const [support, setSupport] = useState<SupportState>(initialSupport);
  const [perfect, setPerfect] = useState(true);
  const [wrongTaps, setWrongTaps] = useState<number[]>([]);
  const [wrongChoices, setWrongChoices] = useState<string[]>([]);
  const [mood, setMood] = useState<AlienMood>('curious');
  const [line, setLine] = useState(
    roundNo === 1
      ? 'אני מסתכל על התמונה ומספר באנגלית מה אני רואה. אבל לפעמים אני מתבלבל! 🤪 אני צודק?'
      : 'ועכשיו? אני צודק, או שהתבלבלתי?',
  );
  const busy = useRef(false);
  const choices = useMemo(() => (round.choices ? seededShuffle(round.choices, round.id.length * 13 + roundNo) : []), [round, roundNo]);
  const corrected = kosmoRight ? round.tokens : round.tokens.map((t, i) => (i === round.wrongAt ? round.fix! : t));

  const guard = () => {
    if (busy.current) return false;
    busy.current = true;
    setTimeout(() => (busy.current = false), 450);
    return true;
  };

  function finish(ok: boolean, s: SupportState, wasPerfect: boolean) {
    setStage('done');
    record({ perfect: wasPerfect, caught: ok }, s);
    void speak(sentenceOf(corrected), 'en');
  }

  function judge(saysRight: boolean) {
    if (stage !== 'judge' || !guard()) return;
    if (saysRight === kosmoRight) {
      if (kosmoRight) {
        playSfx('correct');
        setMood('success');
        setLine(perfect ? 'נכון! הפעם צדקתי 😄 כל המילים מתאימות לתמונה.' : 'נכון, הפעם צדקתי.');
        finish(true, support, perfect);
      } else {
        playSfx('correct');
        setMood('thinking');
        setStage('find');
        setLine('נכון, התבלבלתי! 😅 איזו מילה לא נכונה? לחצו עליה.');
      }
      return;
    }
    playSfx('tryAgain');
    setPerfect(false);
    if (kosmoRight) {
      setMood('happy');
      setLine('דווקא הפעם צדקתי! 😄 תסתכלו שוב: כל המילים מתאימות לתמונה.');
      finish(false, support, false);
      return;
    }
    const s = onWrong(support);
    setSupport(s);
    setMood('confused');
    setStage('find');
    setLine(`בעצם התבלבלתי! 😅 ${round.tipHe} איזו מילה לא נכונה?`);
  }

  function tapToken(i: number) {
    if (stage !== 'find' || !guard()) return;
    if (i === round.wrongAt) {
      playSfx('pop');
      setMood('curious');
      setStage('fix');
      setLine(`בדיוק! ${round.tokens[i]} לא מתאים לתמונה. במה להחליף אותו?`);
      return;
    }
    playSfx('tryAgain');
    setPerfect(false);
    const s = onWrong(support);
    setSupport(s);
    setWrongTaps((w) => [...w, i]);
    setMood('thinking');
    setLine(s.level >= 2 ? 'המילה שהתבלבלתי בה זוהרת בצהוב. לחצו עליה.' : `${round.tokens[i]} דווקא נכונה. ${round.tipHe}`);
  }

  function chooseFix(c: string) {
    if (stage !== 'fix' || wrongChoices.includes(c) || !guard()) return;
    if (c === round.fix) {
      playSfx('correct');
      setMood('success');
      setLine(perfect ? `תודה! ${round.fix} — זאת המילה הנכונה. עכשיו המשפט שלי נכון 🎉` : `עכשיו המשפט נכון: ${round.fix} במקום ${round.tokens[round.wrongAt!]}. תיקנתם בעזרת רמז.`);
      finish(true, support, perfect);
      return;
    }
    playSfx('tryAgain');
    setPerfect(false);
    const s = onWrong(support);
    setSupport(s);
    setWrongChoices((w) => [...w, c]);
    setMood('thinking');
    setLine(s.level >= 3 ? 'המילה הנכונה זוהרת בצהוב.' : `גם ${c} לא מתאים לתמונה. ${round.tipHe}`);
  }

  function help() {
    if (stage === 'done') return;
    setPerfect(false);
    const s = onHelp(support);
    setSupport(s);
    if (s.level === 1) setLine(`רמז: ${round.tipHe}`);
    else if (stage === 'judge') {
      setLine(s.level >= 3 ? 'התשובה זוהרת בצהוב.' : 'הקשיבו שוב למשפט, ובדקו כל מילה מול התמונה.');
      if (s.level === 2) void speak(sentenceOf(round.tokens), 'en');
    } else if (stage === 'find') setLine('המילה שהתבלבלתי בה זוהרת בצהוב.');
    else setLine(s.level >= 3 ? 'המילה הנכונה זוהרת בצהוב.' : `השארתי פחות אפשרויות. ${round.tipHe}`);
  }

  // Level-2 support in the fix stage: keep the answer and one other choice.
  const visibleChoices =
    stage === 'fix' && support.level >= 2 && choices.length > 2
      ? choices.filter((c) => c === round.fix || wrongChoices.includes(c) || c === choices.find((x) => x !== round.fix && !wrongChoices.includes(x)))
      : choices;
  const glowJudge = stage === 'judge' && support.level >= 3;
  const glowToken = stage === 'find' && support.level >= 2;
  const glowFix = stage === 'fix' && support.level >= 3;
  const tokenSize = 'text-[clamp(1.5rem,5.5vw,2.3rem)]';

  return (
    <div className="flex flex-col gap-4" data-testid="mixup-round" data-round={round.id} data-stage={stage} data-kosmo-right={kosmoRight ? 'true' : 'false'}>
      <AlienStage mood={mood} text={line} />
      <div className="card p-4 sm:p-5 grid gap-4 sm:grid-cols-[auto_1fr] items-center">
        <div className="flex items-center justify-center gap-2">
          {round.pictureFrom && (
            <>
              <ItemArt item={round.pictureFrom} size="clamp(96px, 24vw, 130px)" />
              <span className="text-4xl font-black text-primary" aria-label="ואחר כך">
                ←
              </span>
            </>
          )}
          <ItemArt item={round.picture} size={round.pictureFrom ? 'clamp(96px, 24vw, 130px)' : 'clamp(150px, 38vw, 180px)'} className={stage === 'done' ? 'anim-pop' : ''} />
        </div>
        <div className="flex flex-col items-center gap-3 text-center">
          <p className="text-base font-bold text-ink-soft">{stage === 'done' ? 'המשפט הנכון:' : 'קוסמו אומר:'}</p>
          <div className="flex items-center gap-3 flex-wrap justify-center">
            <p dir="ltr" lang="en" className="flex flex-wrap items-center justify-center gap-x-2 gap-y-2" data-testid="mixup-sentence">
              {(stage === 'done' ? corrected : round.tokens).map((t, i) => {
                const last = i === round.tokens.length - 1;
                const isFixed = stage === 'done' && !kosmoRight && i === round.wrongAt;
                const pickedWrong = stage === 'fix' && i === round.wrongAt;
                const tappedWrong = wrongTaps.includes(i);
                const label = `${t}${last ? '.' : ''}`;
                if (stage === 'find')
                  return (
                    <button
                      key={i}
                      type="button"
                      data-testid={`token-${i}`}
                      data-wrong={i === round.wrongAt ? 'true' : 'false'}
                      disabled={tappedWrong}
                      onClick={() => tapToken(i)}
                      className={`en ${tokenSize} min-h-[56px] px-3 rounded-2xl border-3 transition ${
                        tappedWrong ? 'border-line bg-white text-ink-soft opacity-60' : 'border-ink bg-white text-primary-dark shadow-[0_4px_0_#2b2350] active:translate-y-1 active:shadow-[0_1px_0_#2b2350]'
                      } ${glowToken && i === round.wrongAt ? 'ring-6 ring-sun anim-glow' : ''}`}
                    >
                      {label}
                    </button>
                  );
                return (
                  <span
                    key={i}
                    data-testid={`token-${i}`}
                    className={`en ${tokenSize} px-1 rounded-xl ${isFixed ? 'bg-good-bg text-good px-3 border-3 border-good anim-pop' : pickedWrong ? 'bg-try-bg text-try line-through px-3 border-3 border-dashed border-try' : 'text-primary-dark'}`}
                  >
                    {label}
                  </span>
                );
              })}
            </p>
            <SpeakButton text={sentenceOf(stage === 'done' ? corrected : round.tokens)} size="sm" label="השמעת המשפט באנגלית" autoPlayKey={alienReads ? null : `${round.id}:${stage === 'done' ? 'done' : 'say'}`} testId="mixup-speak" />
          </div>
          {stage === 'done' && (
            <p className="text-xl font-bold" data-testid="mixup-hebrew">
              {round.hebrew}
            </p>
          )}
        </div>
      </div>

      {stage === 'judge' && (
        <div className="grid grid-cols-2 gap-3">
          <button type="button" className={`btn btn-soft !text-xl !min-h-[64px] ${glowJudge && kosmoRight ? 'ring-6 ring-sun anim-glow' : ''}`} onClick={() => judge(true)} data-testid="judge-right">
            ✅ קוסמו צודק
          </button>
          <button type="button" className={`btn btn-soft !text-xl !min-h-[64px] ${glowJudge && !kosmoRight ? 'ring-6 ring-sun anim-glow' : ''}`} onClick={() => judge(false)} data-testid="judge-wrong">
            🤪 קוסמו התבלבל
          </button>
        </div>
      )}

      {stage === 'fix' && (
        <div className="card p-4 flex flex-col items-center gap-3">
          <p className="font-bold">
            במקום <bdi className="en text-try" dir="ltr">{round.tokens[round.wrongAt!]}</bdi> צריך לומר:
          </p>
          <div dir="ltr" className="flex gap-3 flex-wrap justify-center" data-testid="mixup-choices">
            {visibleChoices.map((c) => {
              const isWrong = wrongChoices.includes(c);
              return (
                <button
                  key={c}
                  type="button"
                  data-testid={`fix-${c}`}
                  data-correct={c === round.fix ? 'true' : 'false'}
                  disabled={isWrong}
                  onClick={() => chooseFix(c)}
                  className={`min-h-[56px] min-w-[96px] px-5 rounded-2xl border-3 en text-[clamp(1.2rem,4.5vw,1.6rem)] ${
                    isWrong ? 'opacity-35 border-line bg-white line-through' : 'border-ink bg-white shadow-[0_5px_0_#2b2350] active:translate-y-1 active:shadow-[0_1px_0_#2b2350]'
                  } ${glowFix && c === round.fix ? 'ring-6 ring-sun anim-glow' : ''}`}
                >
                  {c}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {stage === 'done' && !perfect && round.wordIds.length > 0 && (
        <div className="card p-3 flex flex-wrap items-center gap-2" data-testid="mixup-reminder">
          <span className="font-bold">תזכורת קטנה:</span>
          {round.wordIds.map((w) => (
            <WordChip key={w} id={w} />
          ))}
        </div>
      )}

      {support.level > 0 && stage !== 'done' && (
        <HintPanel level={support.level}>
          <p>{round.tipHe}</p>
        </HintPanel>
      )}

      <div className="flex items-center justify-between gap-3 flex-wrap pt-2">
        {stage !== 'done' ? <HelpButton onClick={help} level={support.level} /> : <span />}
        <BigButton onClick={onComplete} locked={stage !== 'done'} lockedMessage="קודם בודקים את המשפט של קוסמו 🙂" testId="next-btn">
          {continueLabel} <IconArrowLeft size={24} />
        </BigButton>
      </div>
      <span className="sr-only" aria-live="polite">
        סבב {roundNo} מתוך {total}
      </span>
    </div>
  );
}

export function WordChip({ id }: { id: string }) {
  const w = getWord(id);
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-lab border-2 border-line pe-3 ps-1 py-1">
      <ItemArt item={w.positiveExamples[0]} size={30} decorative />
      <bdi className="en text-primary-dark" dir="ltr">
        {w.english}
      </bdi>
      <span className="text-sm">{w.hebrew}</span>
    </span>
  );
}

/** Basic words of the unit that the opening checks: from lower levels, not yet introduced. */
export function wordsToCheck(unit: UnitDef, level: Level, introduced: (id: string) => boolean): string[] {
  return unitWordIds(unit, level).filter((id) => (WORDS_BY_ID[id].minLevel ?? 1) < level && !introduced(id));
}

export function MixupStep({
  unit,
  stepId,
  rounds: allRounds,
  opening,
  onDone,
}: {
  unit: UnitDef;
  stepId: string;
  rounds: MixupRoundDef[];
  opening: boolean;
  onDone: (skipStepIds: string[]) => void;
}) {
  const { data, update } = useGame();
  const level = levelOfGame(data.game);
  const [toCheck] = useState(() => (opening ? wordsToCheck(unit, level, (id) => !!data.learning[id]?.introduced) : []));
  const [rounds] = useState(() => {
    const inLvl = allRounds.filter((r) => inRange(r.minLevel, r.maxLevel, level));
    return opening ? inLvl.filter((r) => r.wordIds.some((w) => toCheck.includes(w))) : inLvl;
  });
  const [i, setI] = useState(0);
  const [results, setResults] = useState<Record<string, RoundResult>>({});
  const [summary, setSummary] = useState(false);
  const doneOnce = useRef(false);

  // Opening with nothing to check (the basic words were already learned at a lower level).
  useEffect(() => {
    if (!rounds.length && !doneOnce.current) {
      doneOnce.current = true;
      onDone([]);
    }
  }, [rounds.length, onDone]);
  if (!rounds.length) return null;

  const round = rounds[i];

  function record(r: RoundResult, s: SupportState) {
    setResults((x) => ({ ...x, [round.id]: r }));
    const taskId = `${stepId}:${round.id}`;
    const t = now();
    update((d: SaveData) =>
      round.wordIds.reduce((acc, w) => {
        let out = introduceWord(acc, w, t);
        const base = { wordId: w, taskId, taskType: 'fix_kosmo' as const, phase: 'learn' as const, context: 'new' as const, now: t };
        if (r.perfect) return recordWordAttempt(out, { ...base, outcome: 'correct', attemptNumber: 1, support: initialSupport, completed: true });
        out = recordWordAttempt(out, { ...base, outcome: 'wrong', attemptNumber: 1, support: initialSupport, completed: false });
        return r.caught ? recordWordAttempt(out, { ...base, outcome: 'correct', attemptNumber: 2, support: s, completed: true }) : out;
      }, d),
    );
  }

  if (summary) {
    const perfectRounds = rounds.filter((r) => results[r.id]?.perfect).length;
    const mistakes = rounds.filter((r) => r.wrongAt !== undefined);
    const fixed = mistakes.filter((r) => results[r.id]?.caught).length;
    const knownIds = toCheck.filter((w) => {
      const rs = rounds.filter((r) => r.wordIds.includes(w));
      return rs.length > 0 && rs.every((r) => results[r.id]?.perfect);
    });
    const practiceIds = toCheck.filter((w) => !knownIds.includes(w));
    const skip = [...knownIds.flatMap((w) => [`${w}-discover`, `${w}-practice`]), ...practiceIds.map((w) => `${w}-discover`)];
    const line = opening
      ? knownIds.length === toCheck.length
        ? `וואו! תפסתם ${fixed} טעויות שלי, ואתם מכירים את כל המילים. נעבור ישר לדברים החדשים!`
        : `תודה! תפסתם ${fixed} מתוך ${mistakes.length} הטעויות שלי. את המילים שכבר מכירים נדלג, ואת השאר נתרגל רגע.`
      : `תודה שתיקנתם אותי! תפסתם ${fixed} מתוך ${mistakes.length} הטעויות שלי${perfectRounds === rounds.length ? ', והכול בלי עזרה!' : '.'}`;
    return (
      <div className="flex flex-col gap-4" data-testid="mixup-summary" data-known={knownIds.length} data-practice={practiceIds.length}>
        <AlienStage mood="success" text={line} />
        {opening && (
          <div className="grid sm:grid-cols-2 gap-3">
            <section className="card p-4">
              <h3 className="font-extrabold text-lg mb-2">✓ כבר יודעים ({knownIds.length})</h3>
              <div className="flex flex-wrap gap-2">
                {knownIds.map((w) => (
                  <WordChip key={w} id={w} />
                ))}
              </div>
            </section>
            <section className="card p-4">
              <h3 className="font-extrabold text-lg mb-2">🔁 נתרגל רגע ({practiceIds.length})</h3>
              <div className="flex flex-wrap gap-2">
                {practiceIds.map((w) => (
                  <WordChip key={w} id={w} />
                ))}
              </div>
            </section>
          </div>
        )}
        <div className="flex justify-end">
          <BigButton onClick={() => onDone(opening ? skip : [])} testId="next-btn">
            המשך <IconArrowLeft size={24} />
          </BigButton>
        </div>
      </div>
    );
  }

  const last = i + 1 >= rounds.length;
  return (
    <div className="flex flex-col gap-2" data-testid="mixup-step">
      <p className="text-center font-bold text-ink-soft" aria-live="polite">
        🤪 קוסמו מתבלבל — {i + 1} מתוך {rounds.length}
      </p>
      <RoundView
        key={round.id}
        round={round}
        roundNo={i + 1}
        total={rounds.length}
        record={record}
        continueLabel={last ? 'סיום' : 'למשפט הבא'}
        onComplete={() => (last ? setSummary(true) : (setI(i + 1), window.scrollTo({ top: 0 })))}
      />
    </div>
  );
}
