import { useEffect, useRef, useState } from 'react';
import type { KosmoSource, MissionDef, MissionStepDef, SaveData, UnitDef } from '../../engine/types';
import { inLevel } from '../../content/levels';
import { levelOfGame } from '../../engine/gameProgress';
import { ItemArt } from '../../components/ItemArt';
import { AlienStage, BigButton, EnglishWord, OptionCard } from '../../components/ui';
import { IconArrowLeft, IconLock } from '../../components/Icons';
import { MISSIONS_BY_ID, UNITS_BY_ID, unitWordIds } from '../../content/units';
import { item } from '../../content/items';
import { buildMissionQuestion } from '../../engine/tasks';
import { completeUnit } from '../../engine/gameProgress';
import { isDueForReview, needsPractice } from '../../engine/learning';
import { guessLabelHe } from '../../engine/alienMind';
import { kosmoLearns, kosmoUsedRight, planMissionStep, type MissionPlan } from '../../engine/kosmo';
import { initialSupport } from '../../engine/hints';
import { recordDelayedReview, recordWordAttempt } from '../../engine/session';
import type { QuestionInstance } from '../../engine/tasks';
import { getWord, WORDS_BY_ID } from '../../content/words';
import { useGame, now } from '../../state/GameContext';
import { playSfx } from '../../audio/sfx';
import { ChoiceQuestion } from './ChoiceQuestion';

const SCENE_TITLE: Record<MissionDef['scene'], string> = {
  supply: 'ארגז האספקה של החללית',
  colors: 'מכונת הצבעים',
  door: 'הדרך לחדר הבקרה',
};

export function MissionScene({ m, steps, doneCount, finished = false, solo }: { m: MissionDef; steps: MissionStepDef[]; doneCount: number; finished?: boolean; solo?: number }) {
  const done = steps.slice(0, doneCount);
  const collect = steps.filter((s) => s.effect.type === 'collect');
  const stateStep = [...done].reverse().find((s) => s.effect.type === 'state');
  const doorState = stateStep && stateStep.effect.type === 'state' ? stateStep.effect.state : 'closed';
  const hasKey = done.some((s) => s.answer.kind === 'key');
  return (
    <div className="card p-3 sm:p-4" data-testid="mission-scene" data-done={doneCount} data-door={m.scene === 'door' ? doorState : undefined}>
      <div className="flex items-center justify-between mb-2">
        <p className="font-extrabold text-lg">{SCENE_TITLE[m.scene]}</p>
        <p className="text-sm font-bold text-ink-soft flex items-center gap-3">
          {solo !== undefined && (
            <span className="rounded-full bg-good-bg border-2 border-good text-good px-2 py-0.5" data-testid="kosmo-solo" data-solo={solo} title="פעמים שקוסמו עשה לבד, בזכות מה שלימדתם אותו">
              🤖 קוסמו לבד: {solo}
            </span>
          )}
          <span>
            {doneCount}/{steps.length}
          </span>
        </p>
      </div>
      <div className="flex items-end gap-3">
        {m.scene === 'door' && (
          <div className="relative shrink-0">
            <ItemArt item={item('door', 'brown', 'normal', doorState)} size="clamp(90px, 22vw, 130px)" className={doorState === 'open' ? 'anim-pop' : ''} />
            {!hasKey && doorState === 'closed' && (
              <span className="absolute top-1 inset-x-0 flex justify-center text-ink" aria-label="נעול">
                <IconLock size={26} />
              </span>
            )}
          </div>
        )}
        {m.scene === 'colors' && (
          <div className={`shrink-0 rounded-2xl border-3 border-ink px-2 py-3 ${finished ? 'bg-sun' : 'bg-[#e8e2ff]'}`} aria-hidden>
            <div className="flex gap-1">
              {['#ef4444', '#3b82f6', '#fbd02b'].map((c) => (
                <span key={c} className="w-4 h-4 rounded-full border-2 border-ink" style={{ background: finished || doneCount > 0 ? c : '#cfc6f5' }} />
              ))}
            </div>
          </div>
        )}
        <div className="flex gap-2 flex-wrap flex-1">
          {collect.map((s) => {
            const got = done.includes(s);
            return (
              <div key={s.id} className={`rounded-2xl w-[clamp(58px,15vw,84px)] h-[clamp(58px,15vw,84px)] grid place-items-center ${got ? 'bg-good-bg border-3 border-good anim-pop' : 'border-3 border-dashed border-line bg-lab'}`}>
                {got ? <ItemArt item={s.answer} size="90%" /> : <span className="text-2xl text-line font-extrabold">?</span>}
              </div>
            );
          })}
        </div>
        {m.scene === 'door' && finished && (
          <svg viewBox="0 0 120 90" width="clamp(90px, 22vw, 130px)" className="shrink-0 anim-pop" role="img" aria-label="חדר הבקרה">
            <rect x="6" y="20" width="108" height="62" rx="10" fill="#3a2f63" stroke="#2b2350" strokeWidth="4" />
            <rect x="16" y="30" width="44" height="26" rx="5" fill="#7ef0cf" />
            <circle cx="76" cy="40" r="7" fill="#ff6b6b" />
            <circle cx="96" cy="40" r="7" fill="#ffd23f" />
            <rect x="68" y="58" width="36" height="10" rx="5" fill="#9cc5ff" />
            <path d="M22 70h30" stroke="#ffd23f" strokeWidth="5" strokeLinecap="round" />
            <path d="M60 6v14" stroke="#2b2350" strokeWidth="4" />
            <circle cx="60" cy="6" r="5" fill="#ffd23f" stroke="#2b2350" strokeWidth="3" />
          </svg>
        )}
      </div>
    </div>
  );
}

export function PlayStep({ missionId, unit, onDone, onGoToStep }: { missionId: string; unit: UnitDef; onDone: () => void; onGoToStep: (stepId: string) => void }) {
  const { data, update } = useGame();
  const m = MISSIONS_BY_ID[missionId];
  const level = levelOfGame(data.game);
  const [steps] = useState(() => m.steps.filter((s) => inLevel(s.minLevel, level)));
  const [i, setI] = useState(0);
  const [phase, setPhase] = useState<'intro' | 'steps' | 'done'>('intro');
  const [solo, setSolo] = useState(0);
  const hasAbility = !m.requiredAbility || data.alien.abilities.includes(m.requiredAbility);

  useEffect(() => {
    if (phase !== 'done') return;
    playSfx('unlock');
    update((d) => ({
      ...d,
      game: {
        ...d.game,
        completedMissions: d.game.completedMissions.includes(m.id) ? d.game.completedMissions : [...d.game.completedMissions, m.id],
        inventory: d.game.inventory.includes(m.rewardId) ? d.game.inventory : [...d.game.inventory, m.rewardId],
      },
    }));
  }, [phase, m.id, m.rewardId, update]);

  if (!hasAbility) {
    const teachStep = unit.steps.find((s) => s.type === 'teach');
    return (
      <div className="flex flex-col gap-4">
        <AlienStage mood="confused" text="אוי, עוד לא למדתי מספיק כדי לעשות את המשימה הזאת. תלמדו אותי קודם?" />
        {teachStep && (
          <div className="flex justify-end">
            <BigButton onClick={() => onGoToStep(teachStep.id)}>בואו נלמד את קוסמו</BigButton>
          </div>
        )}
      </div>
    );
  }

  if (phase === 'intro')
    return (
      <div className="flex flex-col gap-4" data-testid="mission-intro">
        <AlienStage mood="curious" text={m.introHe} />
        <MissionScene m={m} steps={steps} doneCount={0} />
        <div className="card p-4 flex flex-wrap gap-2 items-center justify-center">
          <span className="font-bold">במשימה נשתמש במילים:</span>
          {[...new Set(steps.flatMap((s) => s.wordIds))].map((w) => (
            <span key={w} className="rounded-full bg-lab border-2 border-line px-3 py-1">
              <bdi className="en text-primary-dark" dir="ltr">{WORDS_BY_ID[w].english}</bdi> <span className="text-sm">{WORDS_BY_ID[w].hebrew}</span>
            </span>
          ))}
        </div>
        <p className="text-center font-bold" data-testid="mission-how">
          🤖 קוסמו ינסה לבד את מה שלימדתם אותו — ואתם תבדקו אותו. מה שעוד לא לימדתם, הוא יבקש שתראו לו.
        </p>
        <div className="flex justify-end">
          <BigButton variant="teal" onClick={() => setPhase('steps')} testId="next-btn">
            יוצאים למשימה! 🚀
          </BigButton>
        </div>
      </div>
    );

  if (phase === 'done')
    return (
      <div className="flex flex-col gap-4" data-testid="mission-done">
        <AlienStage
          mood="success"
          text={`הצלחנו! ${m.rewardHe} ${solo ? `${solo} ${solo === 1 ? 'פעם' : 'פעמים'} מתוך ${steps.length} עשיתי לבד — בזכות מה שלימדתם אותי!` : 'תודה שלימדתם אותי — בפעם הבאה אנסה לבד.'}`}
        />
        <MissionScene m={m} steps={steps} doneCount={steps.length} finished solo={solo} />
        <div className="flex justify-end">
          <BigButton onClick={onDone} testId="next-btn">
            המשך <IconArrowLeft size={24} />
          </BigButton>
        </div>
      </div>
    );

  const step = steps[i];
  return (
    <div className="flex flex-col gap-3" data-testid="mission-step" data-step={step.id} data-prompt={step.promptEn}>
      <MissionScene m={m} steps={steps} doneCount={i} solo={solo} />
      <MissionStepView
        key={step.id}
        m={m}
        step={step}
        variant={i + data.attempts.length}
        last={i + 1 >= steps.length}
        onAlone={() => setSolo((n) => n + 1)}
        onDone={() => {
          if (i + 1 >= steps.length) setPhase('done');
          else setI(i + 1);
        }}
      />
    </div>
  );
}

// ---------------------------- One mission step -------------------------------
// Kosmo tries first, using ONLY what the child taught him (engine/kosmo.ts).
// The child checks him. A wrong try has a visible consequence in the world and
// the child shows him the right one — that example becomes his knowledge, so
// next time (here, in later missions and stations) he can do it alone.

const FAIL_HE: Record<MissionDef['scene'], string> = {
  supply: 'ארגז האספקה לא מקבל את זה — זה לא מה שביקשו! 📦🚫',
  colors: 'מכונת הצבעים מצפצפת: 🚫 זה לא מה שהיא צריכה!',
  door: 'אוי, זה לא עבד — שום דבר לא זז! 🚪🚫',
};

function askLineFor(plan: MissionPlan, step: MissionStepDef, afterWrong: boolean): string {
  const req = step.promptEn;
  if (afterWrong) return `נכון, טעיתי! 😅 איזה מהם הוא ${req}? תראו לי, ואזכור.`;
  if (plan.mode === 'asks') {
    const w = plan.wordId ? WORDS_BY_ID[plan.wordId]?.english : req;
    if (plan.reason === 'fading') return `${req}... את ${w} לימדתם אותי, אבל שכחתי! 😅 תזכירו לי — איזה מהם?`;
    if (plan.reason === 'lookalike' && plan.lookAlike) return `${req}? את ${WORDS_BY_ID[plan.lookAlike].english} אני מכיר — ו-${w} זה משהו אחר! תראו לי איזה מהם?`;
    if (plan.reason === 'unsure') return `${req}? אני לא בטוח איזה מהם. תראו לי?`;
    return `אני צריך: ${req}. את ${w} עוד לא לימדו אותי — תראו לי איזה מהם?`;
  }
  return step.effect.type === 'collect' ? `אני צריך: ${req}. איזה מהם לקחת?` : `${req}! איך זה צריך להיראות אחרי?`;
}

/** Kosmo's reaction to being shown the answer (computed on the current data, before it is saved). */
function learnReaction(d: SaveData, step: MissionStepDef, source: KosmoSource): string {
  for (const w of step.wordIds) {
    const r = kosmoLearns(d, w, step.answer, source, now());
    const target = WORDS_BY_ID[w].target;
    if (r.effect === 'resolved' && r.before && (r.before.dim !== target.dim || r.before.value !== target.value))
      return `אהה! 💡 חשבתי ש-${WORDS_BY_ID[w].english} זה ${guessLabelHe(r.before)}. עכשיו הבנתי: ${WORDS_BY_ID[w].english} זה ${guessLabelHe(target)}!`;
  }
  if (source === 'remind') return 'עכשיו נזכרתי! תודה.';
  return `למדתי: ${step.promptEn}! בפעם הבאה אנסה לבד.`;
}

function MissionStepView({ m, step, variant, last, onAlone, onDone }: { m: MissionDef; step: MissionStepDef; variant: number; last: boolean; onAlone: () => void; onDone: () => void }) {
  const { data, update } = useGame();
  const [q] = useState(() => buildMissionQuestion(step, { variant, taskId: `${m.id}:${step.id}` }));
  const [plan] = useState<MissionPlan>(() => planMissionStep(data, step.wordIds, q.options, now()));
  const [dueAtStart] = useState(() => new Set(step.wordIds.filter((w) => isDueForReview(data.learning[w], now()))));
  const [stage, setStage] = useState<'kosmo' | 'child' | 'done'>(plan.mode === 'tries' ? 'kosmo' : 'child');
  const [kosmoWasWrong, setKosmoWasWrong] = useState(false);
  const [line, setLine] = useState(() =>
    plan.mode === 'tries'
      ? plan.mixedWith
        ? `${step.promptEn}? את זה עוד לא לימדו אותי, אבל זה נשמע לי כמו ${WORDS_BY_ID[plan.mixedWith].english}... אז אני חושב שזה זה 👉 צדקתי?`
        : `${step.promptEn}? את זה לימדתם אותי! אני חושב שזה זה 👉 צדקתי?`
      : askLineFor(plan, step, false),
  );
  const [alone, setAlone] = useState(false);
  const busy = useRef(false);
  const childQ: QuestionInstance = plan.mode === 'tries' && kosmoWasWrong ? { ...q, options: q.options.filter((_, i) => i !== plan.pick) } : q;

  function recordJudgment(d: SaveData, ok: boolean): SaveData {
    return step.wordIds.reduce(
      (acc, w) =>
        recordWordAttempt(acc, {
          wordId: w,
          taskId: `${m.id}:${step.id}:check`,
          taskType: 'check_alien',
          outcome: ok ? 'correct' : 'wrong',
          attemptNumber: 1,
          // Confirming what Kosmo showed is success WITH support, never "independent".
          support: ok ? { ...initialSupport, used: ['shown_by_kosmo'] } : initialSupport,
          completed: ok,
          phase: 'learn',
          context: 'new',
          now: now(),
        }),
      d,
    );
  }

  function judge(saysRight: boolean) {
    if (plan.mode !== 'tries' || stage !== 'kosmo' || busy.current) return;
    busy.current = true;
    setTimeout(() => (busy.current = false), 450);
    if (plan.correct) {
      update((d) => kosmoUsedRight(saysRight ? recordJudgment(d, true) : recordJudgment(d, false), step.wordIds, now()));
      playSfx(saysRight ? 'correct' : 'pop');
      setAlone(true);
      onAlone();
      setStage('done');
      setLine(saysRight ? `יש! עשיתי את זה לבד — בזכות מה שלימדתם אותי 🎉 ${step.doneHe}` : `דווקא צדקתי! 😄 ${step.promptEn} — ${step.promptHe}. לימדתם אותי את זה קודם. ${step.doneHe}`);
      return;
    }
    setKosmoWasWrong(true);
    if (saysRight) {
      // The child accepted Kosmo's mistake: the world shows it did not work.
      update((d) => recordJudgment(d, false));
      playSfx('tryAgain');
      setLine(`${FAIL_HE[m.scene]} ${askLineFor(plan, step, true)}`);
    } else {
      playSfx('pop');
      setLine(askLineFor(plan, step, true));
    }
    setStage('child');
  }

  if (stage === 'kosmo' || (stage === 'done' && alone)) {
    const pick = plan.mode === 'tries' ? plan.pick : -1;
    return (
      <div className="flex flex-col gap-4" data-testid="mission-kosmo" data-kosmo-correct={plan.mode === 'tries' && plan.correct ? 'true' : 'false'} data-stage={stage}>
        <AlienStage mood={stage === 'done' ? 'success' : 'curious'} text={line} />
        <div className="card px-4 py-3 flex items-center justify-center gap-3 flex-wrap">
          <EnglishWord text={step.promptEn} size="lg" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3" data-testid="kosmo-options">
          {q.options.map((o, i) => (
            <OptionCard key={o.key} option={o} state={i === pick ? (stage === 'done' ? 'correct' : 'alien') : 'idle'} onClick={() => {}} disabled caption={i === pick ? '👽 קוסמו בחר' : undefined} />
          ))}
        </div>
        {stage === 'kosmo' ? (
          <div className="grid grid-cols-2 gap-3">
            <button type="button" className="btn btn-soft !text-xl !min-h-[64px]" onClick={() => judge(true)} data-testid="kosmo-right">
              ✅ צדקת, קוסמו
            </button>
            <button type="button" className="btn btn-soft !text-xl !min-h-[64px]" onClick={() => judge(false)} data-testid="kosmo-wrong">
              ❌ טעית
            </button>
          </div>
        ) : (
          <div className="flex justify-end">
            <BigButton onClick={onDone} testId="next-btn">
              {last ? 'סיום המשימה' : 'הבא'} <IconArrowLeft size={24} />
            </BigButton>
          </div>
        )}
      </div>
    );
  }

  const source: KosmoSource = kosmoWasWrong ? 'fix' : plan.mode === 'asks' && plan.reason === 'fading' ? 'remind' : 'show';
  return (
    <ChoiceQuestion
      key={kosmoWasWrong ? 'after-kosmo' : 'ask'}
      question={childQ}
      phase="learn"
      askLine={line}
      successLine={() => `${step.doneHe} ${learnReaction(data, step, source)}`}
      onComplete={(r) => {
        const t = now();
        update((d) => {
          let out = d;
          for (const w of step.wordIds) {
            out = kosmoLearns(out, w, step.answer, source, t).data;
            if (dueAtStart.has(w)) out = recordDelayedReview(out, w, r.firstTryCorrect, r.anyHint, true, t);
          }
          return out;
        });
        onDone();
      }}
      continueLabel={last ? 'סיום המשימה' : 'הבא'}
    />
  );
}

// ------------------------------ Summary -------------------------------------

export function SummaryStep({ unit, onFinish, onNextUnit }: { unit: UnitDef; onFinish: () => void; onNextUnit: (id: string) => void }) {
  const { data, update } = useGame();
  useEffect(() => {
    update((d) => ({ ...d, game: completeUnit(d.game, unit.id, now()).game }));
    playSfx('unlock');
  }, [unit.id, update]);

  const unitWords = unitWordIds(unit, levelOfGame(data.game));
  const met = unitWords.filter((id) => data.learning[id]?.introduced);
  const independent = unitWords.filter((id) => (data.learning[id]?.independentCorrect ?? 0) > 0);
  const spelled = unitWords.filter((id) => (data.learning[id]?.spellIndependent ?? 0) + (data.learning[id]?.spellWithHelp ?? 0) > 0);
  const practice = unitWords.filter((id) => needsPractice(data.learning[id]));
  const abilities = unitWords
    .map((id) => getWord(id).teach?.ability)
    .filter((a): a is NonNullable<typeof a> => !!a && data.alien.abilities.includes(a.id));
  const next = unit.unlocksUnitId ? UNITS_BY_ID[unit.unlocksUnitId] : null;
  const nextOpen = next && data.game.unlockedUnits.includes(next.id);
  const lastUnit = !unit.unlocksUnitId;

  return (
    <div className="flex flex-col gap-4" data-testid="summary-step">
      <AlienStage
        mood="success"
        text={lastUnit ? 'סיימנו את כל התחנות במעבדה! למדתי כל כך הרבה בזכותכם.' : `סיימנו את התחנה "${unit.titleHe}"! איזה צוות אנחנו!`}
      />
      <div className="grid sm:grid-cols-2 gap-3">
        <section className="card p-4">
          <h3 className="font-extrabold text-lg mb-2">🔤 מילים שפגשנו</h3>
          <div className="flex flex-wrap gap-2">
            {met.map((id) => (
              <WordChip key={id} id={id} />
            ))}
          </div>
        </section>
        <section className="card p-4">
          <h3 className="font-extrabold text-lg mb-2">⭐ זיהיתם לבד, בלי רמז</h3>
          {independent.length ? (
            <div className="flex flex-wrap gap-2">
              {independent.map((id) => (
                <WordChip key={id} id={id} />
              ))}
            </div>
          ) : (
            <p>בפעם הבאה ננסה לזהות לבד — כל ניסיון עוזר!</p>
          )}
        </section>
        {spelled.length > 0 && (
          <section className="card p-4">
            <h3 className="font-extrabold text-lg mb-2">🔤 מילים שהרכבתם מאותיות</h3>
            <div className="flex flex-wrap gap-2">
              {spelled.map((id) => (
                <WordChip key={id} id={id} />
              ))}
            </div>
          </section>
        )}
        <section className="card p-4">
          <h3 className="font-extrabold text-lg mb-2">🔁 כדאי לתרגל עוד</h3>
          {practice.length ? (
            <div className="flex flex-wrap gap-2">
              {practice.map((id) => (
                <WordChip key={id} id={id} />
              ))}
            </div>
          ) : (
            <p>כרגע אין — אבל קוסמו יבקש להיזכר במילים בפעם הבאה.</p>
          )}
        </section>
        <section className="card p-4">
          <h3 className="font-extrabold text-lg mb-2">👽 מה קוסמו למד לעשות</h3>
          {abilities.length ? (
            abilities.map((a) => (
              <p key={a.id} className="text-lg font-bold">
                ✓ {a.labelHe}
              </p>
            ))
          ) : (
            <p>קוסמו עדיין מתאמן.</p>
          )}
        </section>
      </div>
      {next && nextOpen && (
        <div className="card p-4 flex items-center gap-3 anim-pop bg-[#fffbe8]" data-testid="unlocked-next">
          <span className="text-3xl">🔓</span>
          <p className="text-xl font-extrabold">תחנה חדשה נפתחה: {next.titleHe}!</p>
        </div>
      )}
      <div className="flex justify-between gap-3 flex-wrap">
        <BigButton variant="soft" onClick={onFinish} testId="back-to-lab">
          חזרה למעבדה
        </BigButton>
        {next && nextOpen && (
          <BigButton onClick={() => onNextUnit(next.id)} testId="next-unit-btn">
            לתחנה הבאה <IconArrowLeft size={24} />
          </BigButton>
        )}
      </div>
    </div>
  );
}

function WordChip({ id }: { id: string }) {
  const w = getWord(id);
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-lab border-2 border-line pe-3 ps-1 py-1">
      <ItemArt item={w.positiveExamples[0]} size={34} decorative />
      <EnglishWord text={w.english} size="md" />
      <span className="text-sm">{w.hebrew}</span>
    </span>
  );
}
