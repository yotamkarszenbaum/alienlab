import { useEffect, useMemo, useRef, useState } from 'react';
import type { AlienMood } from '../../components/Alien';
import { ItemArt, PALETTE } from '../../components/ItemArt';
import { AlienStage, BigButton, HelpButton, HintPanel, OptionCard, SpeakButton, type OptionState } from '../../components/ui';
import { IconArrowLeft, IconSparkle, IconThumbDown, IconThumbUp } from '../../components/Icons';
import type { ConceptKnowledge, Feature, ItemSpec, TeachStepState, WordDef } from '../../engine/types';
import {
  alienChoose,
  buildRepairOptions,
  buildTestScene,
  emptyConcept,
  examplesOf,
  guessLabelHe,
  hasFeature,
  notGuessPhraseHe,
  recordTest,
  snapshot,
  targetPhraseHe,
  teachExample,
  type ExampleEffect,
} from '../../engine/alienMind';
import { initialSupport, onHelp, onWrong, type SupportState } from '../../engine/hints';
import { recordWordAttempt, setConcept, syncAbility } from '../../engine/session';
import { setTeachState, teachStateOf } from '../../engine/gameProgress';
import { describeItemHe, itemId, KIND_HE } from '../../content/items';
import { getWord } from '../../content/words';
import { useGame, now } from '../../state/GameContext';
import { playSfx } from '../../audio/sfx';
import { speak } from '../../audio/speech';
import type { ChoiceOption } from '../../engine/tasks';

const MAX_TEACH_EXAMPLES = 3;

function asOption(i: ItemSpec): ChoiceOption {
  return { key: itemId(i), item: i, correct: false, labelHe: describeItemHe(i), similarity: 0 };
}

// --------------------------- Alien's thought --------------------------------

function GuessIcon({ f, examples }: { f: Feature; examples: ItemSpec[] }) {
  if (f.dim === 'kind') {
    const ex = examples.find((e) => e.kind === f.value);
    return ex ? (
      <span style={{ filter: 'grayscale(1) contrast(1.1)' }}>
        <ItemArt item={{ ...ex, size: 'normal' }} size={64} decorative ignoreSize />
      </span>
    ) : null;
  }
  if (f.dim === 'color') {
    const c = PALETTE[f.value as keyof typeof PALETTE];
    return <span className="block w-14 h-14 rounded-full border-3 border-ink" style={{ background: c?.base }} aria-hidden />;
  }
  if (f.dim === 'size') {
    return (
      <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden>
        <circle cx="16" cy="44" r="8" fill="#d9d1fb" stroke="#2b2350" strokeWidth="3" />
        <circle cx="42" cy="36" r="18" fill="#ffd23f" stroke="#2b2350" strokeWidth="3" />
      </svg>
    );
  }
  return (
    <span style={{ filter: 'grayscale(1)' }}>
      <ItemArt item={{ kind: 'box', color: 'gray', size: 'normal', state: f.value === 'open' ? 'open' : 'closed' }} size={64} decorative ignoreSize />
    </span>
  );
}

export function AlienThought({ word, k, compact = false }: { word: WordDef; k: ConceptKnowledge; compact?: boolean }) {
  const s = snapshot(word.target, k);
  const exs = examplesOf(k);
  const others = s.shared.filter((f) => f !== s.guess);
  return (
    <div className={`thought flex items-center gap-3 px-4 py-3 ${compact ? '' : 'min-h-[92px]'}`} data-testid="alien-thought" data-understanding={s.understanding} data-guess={s.guess ? `${s.guess.dim}:${s.guess.value}` : ''}>
      <span className="text-sm font-bold text-ink-soft shrink-0">זיבי חושב:</span>
      {!s.guess ? (
        <span className="text-2xl font-extrabold text-primary">?</span>
      ) : (
        <div className="flex items-center gap-3 anim-pop" key={`${s.guess.dim}:${s.guess.value}:${s.understanding}`}>
          <GuessIcon f={s.guess} examples={exs} />
          <div className="flex flex-col">
            <span className="text-xl font-extrabold">
              <bdi className="en text-primary-dark" dir="ltr">
                {word.english}
              </bdi>{' '}
              = {guessLabelHe(s.guess)}
              {s.understanding === 'understood' ? ' 💡' : ''}
            </span>
            {s.understanding === 'partial' && others.length > 0 && (
              <span className="text-sm text-ink-soft">…אבל אולי רק אם זה גם {others.map(guessLabelHe).join(' וגם ')}?</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ExamplesTray({ k, rejected = true }: { k: ConceptKnowledge; rejected?: boolean }) {
  const exs = examplesOf(k);
  return (
    <div className="flex items-center gap-2 flex-wrap" data-testid="examples-tray" data-count={exs.length}>
      <span className="text-sm font-bold text-ink-soft">מה זיבי ראה:</span>
      {exs.length === 0 && <span className="text-sm text-ink-soft">עדיין כלום</span>}
      {exs.map((e) => (
        <span key={itemId(e)} className="anim-pop rounded-2xl bg-white border-2 border-teal p-0.5" title={describeItemHe(e)}>
          <ItemArt item={e} size={52} />
        </span>
      ))}
      {rejected && k.rejected.length > 0 && (
        <span className="text-xs text-ink-soft">({k.rejected.length === 1 ? 'דוגמה אחת לא מתאימה לא נלמדה' : `${k.rejected.length} דוגמאות לא מתאימות לא נלמדו`})</span>
      )}
    </div>
  );
}

// ------------------------------ Lines ---------------------------------------

function teachReaction(word: WordDef, effect: ExampleEffect, k: ConceptKnowledge, before: Feature | null): { line: string; mood: AlienMood } {
  const s = snapshot(word.target, k);
  const EN = word.english;
  if (!s.guess) return { line: `${EN}? עדיין לא הבנתי.`, mood: 'confused' };
  const g = guessLabelHe(s.guess);
  switch (effect) {
    case 'first':
      if (s.understanding === 'partial') {
        const other = s.shared.filter((f) => f !== s.guess).map(guessLabelHe).join(' וגם ');
        return { line: `${EN} זה ${g}! אבל... אולי רק כשזה גם ${other}? 🤔`, mood: 'thinking' };
      }
      return { line: `${EN}... זה כמו ה${g} הזה! אני חושב שהבנתי.`, mood: 'happy' };
    case 'no_change':
      return { line: `את זה כבר ראיתי בערך... אני עדיין חושב ש-${EN} זה ${g}.`, mood: 'thinking' };
    case 'progress':
      return { line: `הממ... זה עזר קצת, אבל אני עדיין חושב ש-${EN} זה ${g}.`, mood: 'thinking' };
    case 'new_guess':
      return { line: `רגע! אז ${EN} זה לא ${before ? guessLabelHe(before) : '...'}. אולי ${EN} זה ${g}?`, mood: 'curious' };
    case 'resolved':
      return { line: `מה דומה בין כל אלה? אולי ${EN} זה ${word.teach!.meaningHe}! 💡`, mood: 'discovery' };
    default:
      return { line: `${EN} = ${g}?`, mood: 'thinking' };
  }
}

// ------------------------------ Main step -----------------------------------

export function TeachStep({ stepId, conceptId, onDone }: { stepId: string; conceptId: string; onDone: () => void }) {
  const { data, update } = useGame();
  const word = getWord(conceptId);
  const k = data.alien.concepts[conceptId] ?? emptyConcept(conceptId);
  let ts = teachStateOf(data.game, stepId);
  const snap = snapshot(word.target, k);

  // Keep the saved phase consistent with the alien's knowledge (e.g. after a refresh).
  if (ts.phase !== 'teach' && k.examples.length === 0) ts = { ...ts, phase: 'teach' };
  if (ts.phase === 'done' && snap.understanding !== 'understood') ts = { ...ts, phase: 'test' };

  const setPhase = (patch: Partial<TeachStepState>) =>
    update((d) => ({ ...d, game: setTeachState(d.game, stepId, { ...teachStateOf(d.game, stepId), ...patch }) }));

  const record = (taskType: 'teach_example' | 'check_alien' | 'repair_example', outcome: 'correct' | 'wrong' | 'not_helpful', support: SupportState, attemptNumber: number) =>
    update((d) =>
      recordWordAttempt(d, {
        wordId: conceptId,
        taskId: `${stepId}:${taskType}`,
        taskType,
        outcome,
        attemptNumber,
        support,
        completed: outcome === 'correct',
        phase: 'learn',
        context: taskType === 'check_alien' ? 'new' : 'intro',
        now: now(),
      }),
    );

  const common = { word, k, record, setPhase, ts };
  return (
    <div data-testid="teach-step" data-phase={ts.phase} data-concept={conceptId}>
      {ts.phase === 'teach' && <TeachPhase key="teach" {...common} />}
      {ts.phase === 'test' && <TestPhase key={`test-${ts.tests}`} {...common} />}
      {ts.phase === 'repair' && <RepairPhase key={`repair-${ts.repairs}`} {...common} />}
      {ts.phase === 'done' && <DonePhase key="done" {...common} onDone={onDone} />}
    </div>
  );
}

type PhaseProps = {
  word: WordDef;
  k: ConceptKnowledge;
  ts: TeachStepState;
  record: (t: 'teach_example' | 'check_alien' | 'repair_example', o: 'correct' | 'wrong' | 'not_helpful', s: SupportState, n: number) => void;
  setPhase: (p: Partial<TeachStepState>) => void;
};

// ------------------------------ Teach ---------------------------------------

function TeachPhase({ word, k, record, setPhase }: PhaseProps) {
  const { update } = useGame();
  const EN = word.english;
  const target = word.target;
  const ask = `הראו לי ${targetPhraseHe(target)} — ${EN}`;
  const [line, setLine] = useState(`אני חושב שאני מתחיל להבין! עכשיו תורכם ללמד אותי. ${ask}.`);
  const [mood, setMood] = useState<AlienMood>('curious');
  const [support, setSupport] = useState<SupportState>(initialSupport);
  const [lastBad, setLastBad] = useState<string | null>(null);
  const busy = useRef(false);
  const full = k.examples.length >= MAX_TEACH_EXAMPLES;

  function pick(i: ItemSpec) {
    if (busy.current || full) return;
    busy.current = true;
    setTimeout(() => (busy.current = false), 500);
    const r = teachExample(k, target, i, now());
    if (r.effect === 'duplicate') {
      setLine('את זה כבר הראיתם לי! אפשר לבחור משהו אחר.');
      return;
    }
    update((d) => setConcept(d, r.knowledge));
    if (r.effect === 'invalid') {
      playSfx('tryAgain');
      const s = onWrong(support, 'teach');
      setSupport(s);
      record('teach_example', 'wrong', support, support.wrong + 1);
      setLastBad(itemId(i));
      setMood('confused');
      setLine(`הממ... זה ${describeItemHe(i)}. אנחנו מלמדים את זיבי ${EN} — ${word.hebrew}. נסו למצוא ${targetPhraseHe(target)}.`);
      void speak(EN, 'en');
      return;
    }
    playSfx('teach');
    record('teach_example', 'correct', support, support.wrong + 1);
    setLastBad(null);
    const reaction = teachReaction(word, r.effect, r.knowledge, r.before.guess);
    setLine(reaction.line);
    setMood(reaction.mood);
  }

  function help() {
    const s = onHelp(support, 'teach');
    setSupport(s);
    if (s.level === 1) {
      setLine(`רמז: ${word.explainHe}. בחרו ${targetPhraseHe(target)}.`);
      void speak(EN, 'en');
    } else setLine(`הדברים שזוהרים בצהוב הם ${EN}. בחרו אחד מהם!`);
  }

  function stateOf(i: ItemSpec): OptionState {
    const id = itemId(i);
    if (k.examples.includes(id)) return 'selected';
    if (id === lastBad) return 'wrong';
    if (support.level >= 2 && hasFeature(i, target)) return 'highlight';
    return 'idle';
  }

  return (
    <div className="flex flex-col gap-4">
      <AlienStage mood={mood} text={line} />
      <div className="card p-4 flex flex-col gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <SpeakButton text={EN} sayHe={word.sayItHe} size="sm" />
          <p className="text-xl font-bold">
            {full ? 'זיבי ראה מספיק דוגמאות. בואו נבדוק אותו!' : <>לחצו על דברים שהם <bdi className="en text-primary-dark" dir="ltr">{EN}</bdi> ({word.hebrew}) כדי ללמד את זיבי</>}
          </p>
        </div>
        <AlienThought word={word} k={k} />
        <ExamplesTray k={k} />
      </div>
      {support.level > 0 && (
        <HintPanel level={support.level}>
          <p>
            <bdi className="en text-primary-dark" dir="ltr">{EN}</bdi> = <b>{word.hebrew}</b> (אומרים: {word.sayItHe})
          </p>
        </HintPanel>
      )}
      <div className="grid grid-cols-3 gap-3" data-testid="teach-pool">
        {word.teach!.pool.map((i) => {
          const o = asOption(i);
          const st = stateOf(i);
          return (
            <OptionCard
              key={o.key}
              option={{ ...o, correct: hasFeature(i, target) }}
              state={st}
              onClick={() => pick(i)}
              disabled={full || st === 'selected'}
              imgSize="clamp(80px, 22vw, 140px)"
              caption={st === 'selected' ? <span className="text-xs font-bold text-primary-dark mt-1">זיבי ראה ✓</span> : undefined}
            />
          );
        })}
      </div>
      <div className="flex items-center justify-between gap-3 flex-wrap pt-2">
        <HelpButton onClick={help} level={support.level} />
        <BigButton
          variant="teal"
          locked={k.examples.length === 0}
          lockedMessage="קודם מראים לזיבי לפחות דבר אחד"
          onClick={() => setPhase({ phase: 'test' })}
          testId="start-test-btn"
        >
          בואו נבדוק את זיבי! 🧪
        </BigButton>
      </div>
    </div>
  );
}

// ------------------------------ Test ----------------------------------------

function TestPhase({ word, k, ts, record, setPhase }: PhaseProps) {
  const { data, update } = useGame();
  const EN = word.english;
  const target = word.target;
  const scene = useMemo(() => buildTestScene(target, k, word.teach!.testPool, ts.tests), [k.examples.join('|'), ts.tests]); // eslint-disable-line react-hooks/exhaustive-deps
  const choice = useMemo(() => alienChoose(scene, target, k), [scene]); // eslint-disable-line react-hooks/exhaustive-deps
  const chosen = choice === null ? null : scene[choice];
  const alienRight = !!chosen && hasFeature(chosen, target);
  const [stage, setStage] = useState<'thinking' | 'chosen' | 'right' | 'wrong'>('thinking');
  const [support, setSupport] = useState<SupportState>(initialSupport);
  const [line, setLine] = useState(`משימה לזיבי: למצוא ${targetPhraseHe(target)} — ${EN}. זיבי חושב…`);
  const [mood, setMood] = useState<AlienMood>('thinking');
  const busy = useRef(false);

  useEffect(() => {
    playSfx('think');
    const t = setTimeout(
      () => {
        setStage('chosen');
        if (chosen) {
          setMood('happy');
          setLine(`אני בוחר את זה! זה ${EN}, נכון? עכשיו אתם בודקים: צדקתי?`);
        } else {
          setMood('confused');
          setLine(`אני לא מוצא כאן שום ${EN}... אני לא בטוח מה זה.`);
        }
      },
      data.settings.reducedMotion ? 500 : 1800,
    );
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function judge(saysRight: boolean) {
    if (busy.current || !chosen) return;
    busy.current = true;
    setTimeout(() => (busy.current = false), 500);
    const childCorrect = saysRight === alienRight;
    record('check_alien', childCorrect ? 'correct' : 'wrong', support, support.wrong + 1);
    if (!childCorrect) {
      playSfx('tryAgain');
      const s = onWrong(support, 'teach');
      setSupport(s);
      setMood('thinking');
      const d = describeItemHe(chosen);
      if (s.level >= 3) {
        setLine(alienRight ? `זיבי בחר ${d}. זה באמת ${targetPhraseHe(target)}, אז זיבי צדק! לחצו על "צדק".` : `זיבי בחר ${d}. זה לא ${targetPhraseHe(target)}, אז זיבי טעה. לחצו על "טעה".`);
      } else {
        setLine(`בואו נסתכל שוב יחד: זיבי בחר ${d}. ${word.explainHe}. האם זה ${targetPhraseHe(target)}?`);
        void speak(EN, 'en');
      }
      return;
    }
    const t = now();
    let next = recordTest(k, scene, choice, target, t);
    if (alienRight) {
      // The child confirmed a correct choice: the alien learns from it too.
      const r = teachExample(next, target, chosen, t);
      next = r.knowledge;
      const s = snapshot(target, next);
      update((d) => setConcept(d, next));
      playSfx('correct');
      setStage('right');
      if (s.understanding === 'understood') {
        setMood('success');
        setLine('יש! צדקתי! תודה שבדקתם אותי.');
      } else {
        setMood('thinking');
        setLine('יופי, צדקתי! אבל אני עדיין לא בטוח לגמרי... בואו נבדוק אותי עוד פעם.');
      }
    } else {
      update((d) => setConcept(d, next));
      playSfx('pop');
      setStage('wrong');
      setMood('confused');
      setLine(`אוי! טעיתי? אז מה זה ${EN}? אתם יכולים לעזור לי להבין?`);
    }
  }

  function help() {
    const s = onHelp(support, 'teach');
    setSupport(s);
    if (!chosen) return;
    const d = describeItemHe(chosen);
    if (s.level === 1) setLine(`רמז: ${word.explainHe}. זיבי בחר ${d}.`);
    else if (s.level === 2) setLine(`רמז: בדקו — האם ה${d.split(' ')[0]} שזיבי בחר הוא ${targetPhraseHe(target)}?`);
    else setLine(alienRight ? `זיבי בחר ${d} — וזה ${targetPhraseHe(target)}. אז הוא צדק!` : `זיבי בחר ${d} — וזה לא ${targetPhraseHe(target)}. אז הוא טעה.`);
  }

  const s = snapshot(target, data.alien.concepts[word.id] ?? k);
  const continueAfterRight = () => {
    if (s.understanding === 'understood') {
      update((d) => syncAbility(d, word.id).data);
      setPhase({ phase: 'done' });
    } else setPhase({ phase: 'test', tests: ts.tests + 1 });
  };

  return (
    <div className="flex flex-col gap-4">
      <AlienStage mood={mood} text={line} />
      <div className="card p-4 flex flex-col gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="rounded-full bg-teal text-white px-3 py-1 font-bold">🧪 בדיקה</span>
          <p className="text-xl font-bold">
            זיבי מחפש: <bdi className="en text-primary-dark" dir="ltr">{EN}</bdi>
          </p>
          <SpeakButton text={EN} sayHe={word.sayItHe} size="sm" />
        </div>
        <AlienThought word={word} k={k} compact />
      </div>
      <div className="grid grid-cols-3 gap-3" data-testid="test-scene">
        {scene.map((i, idx) => {
          const o = asOption(i);
          const isChoice = idx === choice && stage !== 'thinking';
          return (
            <OptionCard
              key={o.key}
              option={{ ...o, correct: hasFeature(i, target) }}
              state={isChoice ? 'alien' : 'idle'}
              onClick={() => undefined}
              disabled
              imgSize="clamp(84px, 24vw, 150px)"
              caption={isChoice ? <span className="text-sm font-extrabold text-teal-dark mt-1" data-testid="alien-choice">👽 זיבי בחר</span> : undefined}
            />
          );
        })}
      </div>
      {support.level > 0 && stage === 'chosen' && (
        <HintPanel level={support.level}>
          <p>
            <bdi className="en text-primary-dark" dir="ltr">{EN}</bdi> = <b>{word.hebrew}</b>
          </p>
        </HintPanel>
      )}
      {stage === 'chosen' && chosen && (
        <div className="flex flex-col items-center gap-3">
          <p className="text-2xl font-extrabold">זיבי צדק?</p>
          <div className="flex gap-4 flex-wrap justify-center">
            <button type="button" className="btn btn-teal !text-xl" onClick={() => judge(true)} data-testid="judge-right">
              <IconThumbUp /> כן, צדק!
            </button>
            <button type="button" className="btn btn-soft !text-xl" onClick={() => judge(false)} data-testid="judge-wrong">
              <IconThumbDown /> לא, טעה
            </button>
          </div>
          <HelpButton onClick={help} level={support.level} />
        </div>
      )}
      {stage === 'chosen' && !chosen && (
        <div className="flex justify-end">
          <BigButton onClick={() => setPhase({ phase: 'repair', repairs: ts.repairs })} testId="help-alien-btn">
            בואו נעזור לזיבי <IconArrowLeft size={24} />
          </BigButton>
        </div>
      )}
      {stage === 'wrong' && (
        <div className="flex justify-end">
          <BigButton variant="sun" onClick={() => setPhase({ phase: 'repair' })} testId="help-alien-btn">
            בואו נעזור לזיבי <IconArrowLeft size={24} />
          </BigButton>
        </div>
      )}
      {stage === 'right' && (
        <div className="flex justify-end">
          <BigButton onClick={continueAfterRight} testId="next-btn">
            המשך <IconArrowLeft size={24} />
          </BigButton>
        </div>
      )}
    </div>
  );
}

// ------------------------------ Repair --------------------------------------

function RepairPhase({ word, k, ts, record, setPhase }: PhaseProps) {
  const { update } = useGame();
  const EN = word.english;
  const target = word.target;
  const snap = snapshot(target, k);
  const pool = useMemo(() => [...word.teach!.testPool, ...word.teach!.pool], [word]);
  // Options are fixed for this repair round so they don't jump around under the child's finger.
  const [options] = useState(() => buildRepairOptions(target, k, pool, ts.repairs));
  const guess = snap.guess;
  const question = guess
    ? `נראה שזיבי חושב ש-${EN} זה ${guessLabelHe(guess)}. איך נראה לו ש-${EN} זה ${word.teach!.dimLabelHe}?`
    : `זיבי עדיין לא יודע מה זה ${EN}. בואו נראה לו!`;
  const [line, setLine] = useState(question);
  const [mood, setMood] = useState<AlienMood>('confused');
  const [support, setSupport] = useState<SupportState>(initialSupport);
  const [lastBad, setLastBad] = useState<string | null>(null);
  const [fixed, setFixed] = useState<null | 'resolved' | 'new_guess'>(null);
  const busy = useRef(false);
  const hintLine = guess ? `זיבי צריך לראות ${targetPhraseHe(target)} ${notGuessPhraseHe(guess)}.` : `זיבי צריך לראות ${targetPhraseHe(target)}.`;

  function apply(i: ItemSpec, byDemo = false) {
    if (busy.current || fixed) return;
    busy.current = true;
    setTimeout(() => (busy.current = false), 500);
    const r = teachExample(k, target, i, now());
    const attemptNumber = support.wrong + 1;
    if (r.effect !== 'duplicate') update((d) => setConcept(d, r.knowledge));
    if (r.effect === 'invalid') {
      playSfx('tryAgain');
      record('repair_example', 'wrong', support, attemptNumber);
      const s = onWrong(support, 'teach');
      setSupport(s);
      setLastBad(itemId(i));
      setMood('confused');
      setLine(`זה ${describeItemHe(i)} — זה לא ${targetPhraseHe(target)}, אז זיבי לא לומד ממנו. ${hintLine}`);
      return;
    }
    if (r.effect === 'resolved' || r.effect === 'new_guess') {
      playSfx('teach');
      record('repair_example', 'correct', byDemo ? { ...support, used: [...support.used, 'demo'] } : support, attemptNumber);
      setFixed(r.effect);
      const reaction = teachReaction(word, r.effect, r.knowledge, r.before.guess);
      setMood(reaction.mood);
      setLine(`${reaction.line} בואו נבדוק אותי שוב!`);
      return;
    }
    // valid example but it did not change the alien's mind
    playSfx('pop');
    record('repair_example', 'not_helpful', support, attemptNumber);
    const s = onWrong(support, 'teach');
    setSupport(s);
    setLastBad(itemId(i));
    setMood('thinking');
    const reaction = teachReaction(word, r.effect === 'duplicate' ? 'no_change' : r.effect, r.knowledge, r.before.guess);
    setLine(`${reaction.line} ${guess && guess.dim === 'kind' ? `(זיבי כבר מכיר ${KIND_HE[guess.value as keyof typeof KIND_HE]?.noun ?? ''}.) ` : ''}${hintLine}`);
  }

  function help() {
    const s = onHelp(support, 'teach');
    setSupport(s);
    if (s.level === 1) setLine(`רמז: ${hintLine}`);
    else if (s.level === 2) setLine(`הדוגמה שתעזור לזיבי זוהרת בצהוב. ${hintLine}`);
    else setLine('בואו נעשה את זה יחד. לחצו על "תראו לי" ואראה לזיבי דוגמה טובה.');
  }

  const helpful = options.find((o) => o.effect === 'resolved' || o.effect === 'new_guess');

  return (
    <div className="flex flex-col gap-4">
      <AlienStage mood={mood} text={line} />
      <div className="card p-4 flex flex-col gap-3">
        <p className="text-xl font-bold" data-testid="repair-question" data-question={question}>
          בחרו דוגמה אחת שתעזור לזיבי להבין:
        </p>
        <AlienThought word={word} k={k} compact />
        <ExamplesTray k={k} />
      </div>
      {support.level > 0 && !fixed && (
        <HintPanel level={support.level}>
          <p>{hintLine}</p>
        </HintPanel>
      )}
      <div className="grid grid-cols-3 gap-3" data-testid="repair-options">
        {options.map((o) => {
          const opt = asOption(o.item);
          const id = itemId(o.item);
          let st: OptionState = 'idle';
          if (fixed && k.examples.includes(id)) st = 'correct';
          else if (id === lastBad) st = 'wrong';
          else if (!fixed && support.level >= 2 && helpful && id === itemId(helpful.item)) st = 'highlight';
          return (
            <OptionCard
              key={opt.key}
              option={{ ...opt, correct: o.effect === 'resolved' || o.effect === 'new_guess' }}
              state={st}
              onClick={() => apply(o.item)}
              disabled={!!fixed}
              imgSize="clamp(84px, 24vw, 150px)"
            />
          );
        })}
      </div>
      <div className="flex items-center justify-between gap-3 flex-wrap pt-2">
        {!fixed ? <HelpButton onClick={help} level={support.level} /> : <span />}
        {!fixed && support.level >= 3 && helpful && (
          <BigButton variant="sun" onClick={() => apply(helpful.item, true)} testId="demo-btn">
            <IconSparkle /> תראו לי
          </BigButton>
        )}
        {fixed && (
          <BigButton variant="teal" onClick={() => setPhase({ phase: 'test', tests: ts.tests + 1, repairs: ts.repairs + 1 })} testId="retest-btn">
            לבדוק את זיבי שוב 🧪
          </BigButton>
        )}
      </div>
    </div>
  );
}

// ------------------------------ Done ----------------------------------------

function DonePhase({ word, k, onDone }: PhaseProps & { onDone: () => void }) {
  const { data } = useGame();
  const last = k.misconceptions[k.misconceptions.length - 1];
  const EN = word.english;
  const line = last
    ? `אהה! עכשיו אני מבין! ${EN} זה ${word.teach!.meaningHe}, לא ${guessLabelHe(last.feature)}!`
    : `יש! עכשיו אני מבין! ${EN} זה ${word.teach!.meaningHe}!`;
  const ability = word.teach!.ability;
  const has = data.alien.abilities.includes(ability.id);
  const { update } = useGame();
  useEffect(() => {
    playSfx('unlock');
    update((d) => syncAbility(d, word.id).data); // idempotent (e.g. after a refresh)
  }, [update, word.id]);
  return (
    <div className="flex flex-col gap-4">
      <AlienStage mood="success" text={line} />
      <div className="card p-5 flex flex-col items-center gap-4 text-center">
        <AlienThought word={word} k={k} />
        {has && (
          <div className="anim-pop rounded-3xl bg-sun border-3 border-ink px-5 py-3 text-xl font-extrabold" data-testid="ability-badge">
            ⭐ יכולת חדשה לזיבי: {ability.labelHe}
          </div>
        )}
        <ExamplesTray k={k} rejected={false} />
        <p className="text-lg">
          זיבי למד מ-{k.examples.length} דוגמאות
          {k.corrections.length > 0 ? ` ושיניתם לו את הדעה ${k.corrections.length === 1 ? 'פעם אחת' : `${k.corrections.length} פעמים`}` : ''}. אתם מורים מעולים!
        </p>
      </div>
      <div className="flex justify-end">
        <BigButton onClick={onDone} testId="next-btn">
          המשך <IconArrowLeft size={24} />
        </BigButton>
      </div>
    </div>
  );
}
