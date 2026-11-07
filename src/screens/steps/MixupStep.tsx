import { useEffect, useMemo, useRef, useState } from 'react';
import type { AlienMood } from '../../components/Alien';
import { ItemArt } from '../../components/ItemArt';
import { AlienStage, BigButton, HelpButton, HintPanel, SpeakButton } from '../../components/ui';
import { IconArrowLeft } from '../../components/Icons';
import { initialSupport, onHelp, onWrong, type SupportState } from '../../engine/hints';
import { guessLabelHe, seededShuffle } from '../../engine/alienMind';
import { applyMixupRound, GRAMMAR, kosmoLearns, planMixup, type MixupPlan, type MixupRoundResult as RoundResult } from '../../engine/kosmo';
import { levelOfGame } from '../../engine/gameProgress';
import { inRange } from '../../content/levels';
import { unitWordIds } from '../../content/units';
import { getWord, WORDS_BY_ID } from '../../content/words';
import { useGame, now } from '../../state/GameContext';
import { brainChange, type BrainChange } from '../../engine/brain';
import { BrainChangeCard } from '../../components/BrainMap';
import { useSpeechStatus, speak } from '../../audio/speech';
import { playSfx } from '../../audio/sfx';
import type { KosmoSource, Level, MixupRoundDef, SaveData, UnitDef } from '../../engine/types';

// "Kosmo gets confused" (levels 2–3). Kosmo looks at a picture and says what he
// sees in English. What he says comes from what the child taught him so far
// (engine/kosmo.ts): right when he was taught, a consistent mix-up when he
// confuses a look-alike, a gap when he does not know / is not sure / forgot.
// The child confirms, fixes, or fills the gap — and every fix or answer
// becomes Kosmo's knowledge for the next rounds, missions and stations.
// As the opening of a station it also checks the child's basic words: words
// the child handled on their own skip their introduction; the others skip only
// the introduction screen and keep one practice question.

type Stage = 'judge' | 'find' | 'fix' | 'done';


const sentenceOf = (tokens: string[]) => `${tokens.join(' ')}.`;
const baseEnglish = (focus: string) => GRAMMAR[focus]?.token ?? WORDS_BY_ID[focus]?.english ?? focus;
const GAP = '___';

/** What Kosmo says before the child acts, by why he does what he does. */
function openingLine(plan: MixupPlan, roundNo: number): string {
  if (plan.mode === 'gap') {
    if (plan.reason === 'fading') return 'את המילה שחסרה פה לימדתם אותי פעם, אבל שכחתי! 😅 תזכירו לי?';
    if (plan.reason === 'lookalike' && plan.lookAlike)
      return `את ${WORDS_BY_ID[plan.lookAlike].english} אני כבר מכיר — וזה לא ${WORDS_BY_ID[plan.lookAlike].english}! אז איזו מילה צריכה להיות פה? תלמדו אותי.`;
    if (plan.reason === 'unsure') return 'יש לי רעיון, אבל אני לא בטוח שהוא מתאים לתמונה הזאת 🤔 איזו מילה צריכה להיות במקום החסר?';
    return 'את המילה שחסרה פה עוד לא לימדו אותי 🤔 איזו מילה צריכה להיות במקום החסר?';
  }
  return roundNo === 1
    ? 'אני מסתכל על התמונה ומספר באנגלית מה אני רואה, לפי מה שלימדו אותי. אבל לפעמים אני מתבלבל! 🤪 אני צודק?'
    : 'ועכשיו? אני צודק, או שהתבלבלתי?';
}

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
  // Kosmo's knowledge when the round starts decides what he says (fixed for the round).
  const [plan] = useState<MixupPlan>(() => planMixup(data, round, now()));
  const kosmoRight = plan.mode === 'right';
  const wrongAt = plan.mode === 'wrong' ? round.focusAt : -1;
  const fix = round.tokens[round.focusAt];
  const EN = baseEnglish(round.focus);
  const [stage, setStage] = useState<Stage>(plan.mode === 'gap' ? 'fix' : 'judge');
  const [support, setSupport] = useState<SupportState>(initialSupport);
  const [perfect, setPerfect] = useState(true);
  const [wrongTaps, setWrongTaps] = useState<number[]>([]);
  const [wrongChoices, setWrongChoices] = useState<string[]>([]);
  const [mood, setMood] = useState<AlienMood>(plan.mode === 'gap' ? 'thinking' : 'curious');
  const [line, setLine] = useState(() => openingLine(plan, roundNo));
  const busy = useRef(false);
  const choices = useMemo(() => seededShuffle(round.choices, round.id.length * 13 + roundNo), [round, roundNo]);
  const said = plan.kosmoTokens;
  const [change, setChange] = useState<BrainChange | null>(null);

  const guard = () => {
    if (busy.current) return false;
    busy.current = true;
    setTimeout(() => (busy.current = false), 450);
    return true;
  };

  /** Kosmo's reaction to what the child taught him in this round. */
  function learnedLine(source: KosmoSource): string {
    if (GRAMMAR[round.focus]) return `תודה! כשיש יותר מאחד אומרים ${GRAMMAR[round.focus].token} ולא ${GRAMMAR[round.focus].mixToken}. אזכור את זה!`;
    const r = kosmoLearns(data, round.focus, round.picture, source, now());
    const target = WORDS_BY_ID[round.focus].target;
    if (source === 'remind') return `נכון! עכשיו נזכרתי: ${EN}. תודה שהזכרתם לי!`;
    if (source === 'fix') return `תודה שתיקנתם אותי! ${EN} — לא ${said[round.focusAt]}. בפעם הבאה לא אתבלבל.`;
    if (r.effect === 'resolved' && r.before && (r.before.dim !== target.dim || r.before.value !== target.value))
      return `אהה! 💡 חשבתי ש-${EN} זה ${guessLabelHe(r.before)}. עכשיו הבנתי: ${EN} זה ${guessLabelHe(target)}!`;
    return `תודה! עכשיו אני יודע: ${EN}. אשתמש בזה בפעם הבאה!`;
  }

  function finish(caught: boolean, s: SupportState, wasPerfect: boolean) {
    if (plan.mode !== 'right' && !GRAMMAR[round.focus]) {
      const source: KosmoSource = plan.mode === 'wrong' ? 'fix' : plan.reason === 'fading' ? 'remind' : 'show';
      setChange(brainChange(round.focus, data.alien.concepts[round.focus], kosmoLearns(data, round.focus, round.picture, source, now()).data.alien.concepts[round.focus]));
    }
    setStage('done');
    record({ perfect: wasPerfect, caught, plan }, s);
    void speak(sentenceOf(round.tokens), 'en');
  }

  function judge(saysRight: boolean) {
    if (stage !== 'judge' || !guard()) return;
    if (saysRight === kosmoRight) {
      playSfx('correct');
      if (kosmoRight) {
        setMood('success');
        setLine(`נכון! את ${EN} לימדתם אותי — וזכרתי! 😄`);
        finish(true, support, perfect);
      } else {
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
      setLine(`דווקא הפעם צדקתי! 😄 את ${EN} לימדתם אותי קודם — תסתכלו: כל המילים מתאימות לתמונה.`);
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
    if (i === wrongAt) {
      playSfx('pop');
      setMood('curious');
      setStage('fix');
      setLine(`בדיוק! ${said[i]} לא מתאים לתמונה. במה להחליף אותו?`);
      return;
    }
    playSfx('tryAgain');
    setPerfect(false);
    const s = onWrong(support);
    setSupport(s);
    setWrongTaps((w) => [...w, i]);
    setMood('thinking');
    setLine(s.level >= 2 ? 'המילה שהתבלבלתי בה זוהרת בצהוב. לחצו עליה.' : `${said[i]} דווקא נכונה. ${round.tipHe}`);
  }

  function chooseFix(c: string) {
    if (stage !== 'fix' || wrongChoices.includes(c) || !guard()) return;
    if (c === fix) {
      playSfx('correct');
      setMood('success');
      const source: KosmoSource = plan.mode === 'wrong' ? 'fix' : plan.reason === 'fading' ? 'remind' : 'show';
      setLine(`${learnedLine(source)}${perfect ? '' : ' (הצלחתם בעזרת רמז.)'}`);
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
      if (s.level === 2) void speak(sentenceOf(said), 'en');
    } else if (stage === 'find') setLine('המילה שהתבלבלתי בה זוהרת בצהוב.');
    else setLine(s.level >= 3 ? 'המילה הנכונה זוהרת בצהוב.' : `השארתי פחות אפשרויות. ${round.tipHe}`);
  }

  // Level-2 support in the fix stage: keep the answer and one other choice.
  const visibleChoices =
    stage === 'fix' && support.level >= 2 && choices.length > 2
      ? choices.filter((c) => c === fix || wrongChoices.includes(c) || c === choices.find((x) => x !== fix && !wrongChoices.includes(x)))
      : choices;
  const glowJudge = stage === 'judge' && support.level >= 3;
  const glowToken = stage === 'find' && support.level >= 2;
  const glowFix = stage === 'fix' && support.level >= 3;
  const tokenSize = 'text-[clamp(1.5rem,5.5vw,2.3rem)]';
  const shown = stage === 'done' ? round.tokens : said;
  const speakable = stage === 'done' ? round.tokens : said.filter((t) => t !== GAP);

  return (
    <div className="flex flex-col gap-4" data-testid="mixup-round" data-round={round.id} data-stage={stage} data-mode={plan.mode} data-kosmo-right={kosmoRight ? 'true' : 'false'}>
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
              {shown.map((t, i) => {
                const last = i === shown.length - 1;
                const isTaught = stage === 'done' && plan.mode !== 'right' && i === round.focusAt;
                const pickedWrong = stage === 'fix' && i === wrongAt;
                const tappedWrong = wrongTaps.includes(i);
                const isGap = t === GAP;
                const label = `${isGap ? '' : t}${last ? '.' : ''}`;
                if (stage === 'find')
                  return (
                    <button
                      key={i}
                      type="button"
                      data-testid={`token-${i}`}
                      data-wrong={i === wrongAt ? 'true' : 'false'}
                      disabled={tappedWrong}
                      onClick={() => tapToken(i)}
                      className={`en ${tokenSize} min-h-[56px] px-3 rounded-2xl border-3 transition ${
                        tappedWrong ? 'border-line bg-white text-ink-soft opacity-60' : 'border-ink bg-white text-primary-dark shadow-[0_4px_0_#2b2350] active:translate-y-1 active:shadow-[0_1px_0_#2b2350]'
                      } ${glowToken && i === wrongAt ? 'ring-6 ring-sun anim-glow' : ''}`}
                    >
                      {label}
                    </button>
                  );
                if (isGap)
                  return (
                    <span key={i} data-testid={`token-${i}`} data-gap="true" className={`en ${tokenSize} inline-grid place-items-center min-w-[3.2em] px-2 rounded-xl border-3 border-dashed border-primary bg-lab text-line`}>
                      ?{last ? '.' : ''}
                    </span>
                  );
                return (
                  <span
                    key={i}
                    data-testid={`token-${i}`}
                    className={`en ${tokenSize} px-1 rounded-xl ${isTaught ? 'bg-good-bg text-good px-3 border-3 border-good anim-pop' : pickedWrong ? 'bg-try-bg text-try line-through px-3 border-3 border-dashed border-try' : 'text-primary-dark'}`}
                  >
                    {label}
                  </span>
                );
              })}
            </p>
            <SpeakButton text={sentenceOf(speakable)} size="sm" label="השמעת המשפט באנגלית" autoPlayKey={alienReads ? null : `${round.id}:${stage === 'done' ? 'done' : 'say'}`} testId="mixup-speak" />
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
            {plan.mode === 'wrong' ? (
              <>
                במקום <bdi className="en text-try" dir="ltr">{said[round.focusAt]}</bdi> צריך לומר:
              </>
            ) : (
              'מה צריך להיות במקום החסר?'
            )}
          </p>
          <div dir="ltr" className="flex gap-3 flex-wrap justify-center" data-testid="mixup-choices">
            {visibleChoices.map((c) => {
              const isWrong = wrongChoices.includes(c);
              return (
                <button
                  key={c}
                  type="button"
                  data-testid={`fix-${c}`}
                  data-correct={c === fix ? 'true' : 'false'}
                  disabled={isWrong}
                  onClick={() => chooseFix(c)}
                  className={`min-h-[56px] min-w-[96px] px-5 rounded-2xl border-3 en text-[clamp(1.2rem,4.5vw,1.6rem)] ${
                    isWrong ? 'opacity-35 border-line bg-white line-through' : 'border-ink bg-white shadow-[0_5px_0_#2b2350] active:translate-y-1 active:shadow-[0_1px_0_#2b2350]'
                  } ${glowFix && c === fix ? 'ring-6 ring-sun anim-glow' : ''}`}
                >
                  {c}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {stage === 'done' && <BrainChangeCard change={change} />}

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
    const t = now();
    update((d: SaveData) => applyMixupRound(d, round, r, s, `${stepId}:${round.id}`, t));
  }

  if (summary) {
    const played = rounds.filter((r) => results[r.id]);
    const mistakes = played.filter((r) => results[r.id].plan.mode === 'wrong');
    const fixed = mistakes.filter((r) => results[r.id].caught).length;
    const taught = played.filter((r) => results[r.id].plan.mode === 'gap').length;
    const usedRight = played.filter((r) => results[r.id].plan.mode === 'right').length;
    const knownIds = toCheck.filter((w) => {
      const rs = rounds.filter((r) => r.wordIds.includes(w));
      return rs.length > 0 && rs.every((r) => results[r.id]?.perfect);
    });
    const practiceIds = toCheck.filter((w) => !knownIds.includes(w));
    const skip = [...knownIds.flatMap((w) => [`${w}-discover`, `${w}-practice`]), ...practiceIds.map((w) => `${w}-discover`)];
    const line = `תודה! ${fixed ? `תיקנתם ${fixed} ${fixed === 1 ? 'טעות' : 'טעויות'} שלי, ` : ''}${taught ? `לימדתם אותי ${taught} ${taught === 1 ? 'מילה' : 'מילים'}` : ''}${usedRight ? `${fixed || taught ? ', ו' : ''}${usedRight} ${usedRight === 1 ? 'פעם' : 'פעמים'} השתמשתי לבד במה שלימדתם אותי` : ''}! 🎉`;
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
