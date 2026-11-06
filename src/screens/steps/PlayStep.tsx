import { useEffect, useMemo, useState } from 'react';
import type { MissionDef, UnitDef } from '../../engine/types';
import { ItemArt } from '../../components/ItemArt';
import { AlienStage, BigButton, EnglishWord } from '../../components/ui';
import { IconArrowLeft, IconLock } from '../../components/Icons';
import { MISSIONS_BY_ID, UNITS_BY_ID } from '../../content/units';
import { item } from '../../content/items';
import { buildMissionQuestion } from '../../engine/tasks';
import { completeUnit } from '../../engine/gameProgress';
import { needsPractice } from '../../engine/learning';
import { getWord, WORDS_BY_ID } from '../../content/words';
import { useGame, now } from '../../state/GameContext';
import { playSfx } from '../../audio/sfx';
import { ChoiceQuestion } from './ChoiceQuestion';

const SCENE_TITLE: Record<MissionDef['scene'], string> = {
  supply: 'ארגז האספקה של החללית',
  colors: 'מכונת הצבעים',
  door: 'הדרך לחדר הבקרה',
};

export function MissionScene({ m, doneCount, finished = false }: { m: MissionDef; doneCount: number; finished?: boolean }) {
  const done = m.steps.slice(0, doneCount);
  const collect = m.steps.filter((s) => s.effect.type === 'collect');
  const stateStep = [...done].reverse().find((s) => s.effect.type === 'state');
  const doorState = stateStep && stateStep.effect.type === 'state' ? stateStep.effect.state : 'closed';
  const hasKey = done.some((s) => s.answer.kind === 'key');
  return (
    <div className="card p-3 sm:p-4" data-testid="mission-scene" data-done={doneCount} data-door={m.scene === 'door' ? doorState : undefined}>
      <div className="flex items-center justify-between mb-2">
        <p className="font-extrabold text-lg">{SCENE_TITLE[m.scene]}</p>
        <p className="text-sm font-bold text-ink-soft">
          {doneCount}/{m.steps.length}
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
  const [i, setI] = useState(0);
  const [phase, setPhase] = useState<'intro' | 'steps' | 'done'>('intro');
  const hasAbility = !m.requiredAbility || data.alien.abilities.includes(m.requiredAbility);
  const q = useMemo(() => buildMissionQuestion(m.steps[i], { variant: i + data.attempts.length, taskId: `${m.id}:${m.steps[i].id}` }), [i]); // eslint-disable-line react-hooks/exhaustive-deps

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
            <BigButton onClick={() => onGoToStep(teachStep.id)}>בואו נלמד את זיבי</BigButton>
          </div>
        )}
      </div>
    );
  }

  if (phase === 'intro')
    return (
      <div className="flex flex-col gap-4" data-testid="mission-intro">
        <AlienStage mood="curious" text={m.introHe} />
        <MissionScene m={m} doneCount={0} />
        <div className="card p-4 flex flex-wrap gap-2 items-center justify-center">
          <span className="font-bold">במשימה נשתמש במילים:</span>
          {[...new Set(m.steps.flatMap((s) => s.wordIds))].map((w) => (
            <span key={w} className="rounded-full bg-lab border-2 border-line px-3 py-1">
              <bdi className="en text-primary-dark" dir="ltr">{WORDS_BY_ID[w].english}</bdi> <span className="text-sm">{WORDS_BY_ID[w].hebrew}</span>
            </span>
          ))}
        </div>
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
        <AlienStage mood="success" text={`הצלחנו! ${m.rewardHe} תודה שעזרתם לי.`} />
        <MissionScene m={m} doneCount={m.steps.length} finished />
        <div className="flex justify-end">
          <BigButton onClick={onDone} testId="next-btn">
            המשך <IconArrowLeft size={24} />
          </BigButton>
        </div>
      </div>
    );

  const step = m.steps[i];
  const ask = step.effect.type === 'collect' ? `אני צריך: ${step.promptEn}. איזה מהם לקחת?` : `${step.promptEn}! איך זה צריך להיראות אחרי?`;
  return (
    <div className="flex flex-col gap-3" data-testid="mission-step" data-step={step.id}>
      <MissionScene m={m} doneCount={i} />
      <ChoiceQuestion
        question={q}
        phase="learn"
        askLine={ask}
        successLine={() => step.doneHe}
        onComplete={() => {
          if (i + 1 >= m.steps.length) setPhase('done');
          else setI(i + 1);
        }}
        continueLabel={i + 1 >= m.steps.length ? 'סיום המשימה' : 'הבא'}
      />
    </div>
  );
}

// ------------------------------ Summary -------------------------------------

export function SummaryStep({ unit, onFinish, onNextUnit }: { unit: UnitDef; onFinish: () => void; onNextUnit: (id: string) => void }) {
  const { data, update } = useGame();
  useEffect(() => {
    update((d) => ({ ...d, game: completeUnit(d.game, unit.id, now()).game }));
    playSfx('unlock');
  }, [unit.id, update]);

  const met = unit.wordIds.filter((id) => data.learning[id]?.introduced);
  const independent = unit.wordIds.filter((id) => (data.learning[id]?.independentCorrect ?? 0) > 0);
  const practice = unit.wordIds.filter((id) => needsPractice(data.learning[id]));
  const abilities = unit.wordIds
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
        <section className="card p-4">
          <h3 className="font-extrabold text-lg mb-2">🔁 כדאי לתרגל עוד</h3>
          {practice.length ? (
            <div className="flex flex-wrap gap-2">
              {practice.map((id) => (
                <WordChip key={id} id={id} />
              ))}
            </div>
          ) : (
            <p>כרגע אין — אבל זיבי יבקש להיזכר במילים בפעם הבאה.</p>
          )}
        </section>
        <section className="card p-4">
          <h3 className="font-extrabold text-lg mb-2">👽 מה זיבי למד לעשות</h3>
          {abilities.length ? (
            abilities.map((a) => (
              <p key={a.id} className="text-lg font-bold">
                ✓ {a.labelHe}
              </p>
            ))
          ) : (
            <p>זיבי עדיין מתאמן.</p>
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
