import { useRef, useState } from 'react';
import type { AlienMood } from '../components/Alien';
import { AlienStage, BigButton, OptionCard, Page, TopBar } from '../components/ui';
import { ItemArt } from '../components/ItemArt';
import { BrainChangeCard } from '../components/BrainMap';
import { IconArrowLeft } from '../components/Icons';
import { useGame, now } from '../state/GameContext';
import { useNav } from '../state/nav';
import { describeItemHe, itemId } from '../content/items';
import { WORDS_BY_ID } from '../content/words';
import { initialSupport } from '../engine/hints';
import { recordWordAttempt } from '../engine/session';
import { kosmoLearns, kosmoUsedRight, planMissionStep, type MissionPlan } from '../engine/kosmo';
import { brainChange, type BrainChange } from '../engine/brain';
import { commandKey, commandMatches, commandText, workshopChips, workshopOpen, WORKSHOP_GOAL, WORKSHOP_MIN_WORDS, WORKSHOP_SCENES } from '../engine/workshop';
import { kosmoDictionary } from '../engine/kosmo';
import { playSfx } from '../audio/sfx';
import { speak } from '../audio/speech';
import type { Dim, SaveData } from '../engine/types';

// Teach & Unlock: the words the child taught Kosmo are the only words the child
// can use to instruct him. Precise instructions (fitting exactly one thing) +
// Kosmo acting on his real knowledge + parts only when he succeeds alone.

const DIM_HE: Partial<Record<Dim, string>> = { size: 'גודל', state: 'מצב', color: 'צבע', kind: 'דבר' };

type Stage = 'build' | 'kosmo' | 'show' | 'done';

export function WorkshopScreen() {
  const { data, update } = useGame();
  const { go } = useNav();
  const open = workshopOpen(data);
  const [sceneIdx, setSceneIdx] = useState(data.game.workshopParts.length);
  const scene = WORKSHOP_SCENES[sceneIdx % WORKSHOP_SCENES.length];
  const chips = workshopChips(data, scene);
  const [picked, setPicked] = useState<string[]>([]);
  const [stage, setStage] = useState<Stage>('build');
  const [plan, setPlan] = useState<MissionPlan | null>(null);
  const [target, setTarget] = useState<number>(-1);
  const [line, setLine] = useState('זו הסדנה שלי! אני יכול לעשות רק מה שלימדתם אותי. תנו לי הוראה באנגלית שמתאימה לדבר אחד בדיוק — ואני אבנה ממנו חלק לחללית.');
  const [mood, setMood] = useState<AlienMood>('curious');
  const [lastBad, setLastBad] = useState<number | null>(null);
  const [change, setChange] = useState<BrainChange | null>(null);
  const [newPart, setNewPart] = useState(false);
  const [taughtNow, setTaughtNow] = useState(false);
  const busy = useRef(false);
  const parts = data.game.workshopParts;
  const matches = commandMatches(scene, picked);
  const text = commandText(picked);

  const guard = () => {
    if (busy.current) return false;
    busy.current = true;
    setTimeout(() => (busy.current = false), 450);
    return true;
  };

  if (!open) {
    const n = kosmoDictionary(data).length;
    return (
      <>
        <TopBar onHome={() => go({ name: 'lab' })} title="הסדנה של קוסמו" />
        <Page>
          <div className="flex flex-col gap-4" data-testid="workshop-locked">
            <AlienStage mood="thinking" text={`הסדנה שלי נפתחת כשאדע לפחות ${WORKSHOP_MIN_WORDS} מילים. לימדו אותי בתחנות — ואז תוכלו לתת לי הוראות!`} />
            <p className="text-center font-bold">מילים שלימדתם אותי עד עכשיו: {Math.min(n, WORKSHOP_MIN_WORDS)}/{WORKSHOP_MIN_WORDS}</p>
            <div className="flex justify-end">
              <BigButton onClick={() => go({ name: 'lab' })} testId="back-to-lab">
                חזרה למעבדה <IconArrowLeft size={24} />
              </BigButton>
            </div>
          </div>
        </Page>
      </>
    );
  }

  function toggle(wordId: string, dim: Dim) {
    if (stage !== 'build') return;
    playSfx('tap');
    setPicked((p) => (p.includes(wordId) ? p.filter((x) => x !== wordId) : [...p.filter((x) => WORDS_BY_ID[x].target.dim !== dim), wordId]));
  }

  function send() {
    if (stage !== 'build' || matches.length !== 1 || !guard()) return;
    const t = matches[0];
    setTarget(t);
    void speak(text, 'en');
    const p = planMissionStep(data, picked, scene.map((i, idx) => ({ item: i, correct: idx === t })), now());
    setPlan(p);
    setChange(null);
    if (p.mode === 'tries') {
      setStage('kosmo');
      setMood('curious');
      setLine(p.mixedWith ? `${text}? זה נשמע לי כמו ${WORDS_BY_ID[p.mixedWith].english}… אז אני לוקח את זה 👉 צדקתי?` : `${text}! את זה לימדתם אותי — אני לוקח את זה 👉 צדקתי?`);
    } else {
      setStage('show');
      setMood('thinking');
      setLine(
        p.reason === 'fading'
          ? `${text}... לימדתם אותי, אבל שכחתי! 😅 תראו לי איזה מהם?`
          : p.reason === 'unsure'
            ? `${text}? אני עוד לא בטוח מה זה בדיוק. תראו לי איזה מהם?`
            : `${text}? את זה עוד לא הבנתי עד הסוף. תראו לי איזה מהם?`,
      );
    }
  }

  function recordWords(d: SaveData, ok: boolean, shownByKosmo: boolean, attempt = 1): SaveData {
    return picked.reduce(
      (acc, w) =>
        recordWordAttempt(acc, {
          wordId: w,
          taskId: `workshop:${commandKey(picked)}`,
          taskType: shownByKosmo ? 'check_alien' : 'mission',
          outcome: ok ? 'correct' : 'wrong',
          attemptNumber: attempt,
          support: ok && shownByKosmo ? { ...initialSupport, used: ['shown_by_kosmo'] } : initialSupport,
          completed: ok,
          phase: 'learn',
          context: 'new',
          now: now(),
        }),
      d,
    );
  }

  function judge(saysRight: boolean) {
    if (stage !== 'kosmo' || !plan || plan.mode !== 'tries' || !guard()) return;
    if (plan.correct) {
      const key = commandKey(picked);
      const fresh = !parts.includes(key);
      update((d) => {
        let out = kosmoUsedRight(recordWords(d, saysRight, true), picked, now());
        if (fresh) out = { ...out, game: { ...out.game, workshopParts: [...out.game.workshopParts, key] } };
        return out;
      });
      playSfx(fresh ? 'unlock' : 'correct');
      setNewPart(fresh);
      setStage('done');
      setMood('success');
      setLine(
        `${saysRight ? 'יש!' : 'דווקא צדקתי! 😄'} עשיתי לבד את "${text}" — בזכות מה שלימדתם אותי. ${fresh ? '🔧 חלק חדש לחללית!' : 'את החלק הזה כבר בנינו — נסו הוראה אחרת כדי לקבל חלק חדש.'}`,
      );
      return;
    }
    if (saysRight) {
      update((d) => recordWords(d, false, true));
      playSfx('tryAgain');
      setLine(`אוי — החלק לא נכנס לחללית! 🚀🚫 זה לא "${text}". תראו לי איזה מהם כן?`);
    } else {
      playSfx('pop');
      setLine(`נכון, טעיתי! 😅 תראו לי איזה מהם הוא "${text}", ואזכור.`);
    }
    setMood('thinking');
    setStage('show');
  }

  function show(idx: number) {
    if (stage !== 'show' || !guard()) return;
    if (idx !== target) {
      playSfx('tryAgain');
      setLastBad(idx);
      update((d) => recordWords(d, false, false));
      setLine(`זה ${describeItemHe(scene[idx])} — זה לא "${text}". נסו שוב: מה מתאים לכל המילים בהוראה?`);
      return;
    }
    playSfx('teach');
    const source = plan?.mode === 'tries' ? 'fix' : plan?.mode === 'asks' && plan.reason === 'fading' ? 'remind' : 'show';
    const t = now();
    let ch: BrainChange | null = null;
    for (const w of picked) ch = ch ?? brainChange(w, data.alien.concepts[w], kosmoLearns(data, w, scene[idx], source, t).data.alien.concepts[w]);
    setChange(ch);
    update((d) => picked.reduce((acc, w) => kosmoLearns(acc, w, scene[idx], source, t).data, recordWords(d, true, false, lastBad === null ? 1 : 2)));
    setLastBad(null);
    setStage('done');
    setNewPart(false);
    setTaughtNow(true);
    setMood('happy');
    setLine(`תודה! עכשיו אני יודע יותר. שלחו לי שוב את "${text}" — הפעם אנסה לבד ואבנה חלק!`);
  }

  function again(sameCommand: boolean) {
    setStage('build');
    setPlan(null);
    setChange(null);
    setLastBad(null);
    setTarget(-1);
    setTaughtNow(false);
    if (!sameCommand) {
      setPicked([]);
      if (newPart) setSceneIdx(parts.length);
    }
    setMood('curious');
    setLine(parts.length >= WORKSHOP_GOAL ? 'החללית שלנו מוכנה! 🚀 אפשר להמשיך לתת לי הוראות.' : 'הוראה חדשה? בחרו מילים שמתאימות לדבר אחד בדיוק.');
  }

  const stateOf = (idx: number) => {
    if (stage === 'kosmo' && plan?.mode === 'tries' && idx === plan.pick) return 'alien' as const;
    if (stage === 'done' && idx === target) return 'correct' as const;
    if (idx === lastBad) return 'wrong' as const;
    return 'idle' as const;
  };
  const groups = (['size', 'state', 'color', 'kind'] as Dim[]).map((dim) => ({ dim, chips: chips.filter((c) => c.dim === dim) })).filter((g) => g.chips.length);

  return (
    <>
      <TopBar onHome={() => go({ name: 'lab' })} title="הסדנה של קוסמו" />
      <Page>
        <div className="flex flex-col gap-4" data-testid="workshop" data-stage={stage} data-parts={parts.length}>
          <AlienStage mood={mood} text={line} />

          <section className="card p-3 flex items-center gap-3 flex-wrap" data-testid="spaceship" aria-label={`חלקים לחללית: ${parts.length} מתוך ${WORKSHOP_GOAL}`}>
            <span className="font-extrabold">🚀 החללית: {Math.min(parts.length, WORKSHOP_GOAL)}/{WORKSHOP_GOAL}</span>
            <div className="flex gap-1.5 flex-wrap">
              {Array.from({ length: WORKSHOP_GOAL }).map((_, i) => (
                <span key={i} className={`w-9 h-9 rounded-xl grid place-items-center text-lg border-2 ${i < parts.length ? 'bg-sun border-ink' : 'bg-lab border-line'}`}>
                  {i < parts.length ? '🔧' : ''}
                </span>
              ))}
            </div>
            {parts.length >= WORKSHOP_GOAL && <span className="font-extrabold text-good">החללית מוכנה! 🎉</span>}
          </section>

          <div className="grid grid-cols-3 gap-3" data-testid="workshop-scene">
            {scene.map((it, idx) => (
              <OptionCard
                key={`${sceneIdx}-${idx}`}
                option={{ key: itemId(it), item: it, correct: idx === target, labelHe: describeItemHe(it), similarity: 0 }}
                state={stateOf(idx)}
                onClick={() => show(idx)}
                disabled={stage !== 'show'}
                imgSize="clamp(70px, 18vw, 120px)"
                caption={stage === 'kosmo' && plan?.mode === 'tries' && idx === plan.pick ? '👽 קוסמו לקח' : undefined}
              />
            ))}
          </div>

          {stage === 'build' && (
            <section className="card p-4 flex flex-col gap-3" data-testid="command-builder">
              <p className="font-bold">בנו הוראה ממילים שלימדתם את קוסמו:</p>
              {groups.map((g) => (
                <div key={g.dim} className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-bold text-ink-soft w-12">{DIM_HE[g.dim]}</span>
                  {g.chips.map((c) => (
                    <button
                      key={c.wordId}
                      type="button"
                      dir="ltr"
                      data-testid={`chip-${c.wordId}`}
                      data-unlocked={c.unlocked ? 'true' : 'false'}
                      disabled={!c.unlocked}
                      onClick={() => toggle(c.wordId, c.dim)}
                      title={c.unlocked ? undefined : 'עוד לא לימדתם את קוסמו את המילה הזאת'}
                      className={`en min-h-[48px] px-4 rounded-2xl border-3 text-lg ${
                        !c.unlocked ? 'border-dashed border-line bg-lab text-line' : picked.includes(c.wordId) ? 'border-primary bg-primary text-white' : 'border-ink bg-white text-primary-dark shadow-[0_4px_0_#2b2350]'
                      }`}
                    >
                      {!c.unlocked && '🔒 '}
                      {WORDS_BY_ID[c.wordId].english}
                    </button>
                  ))}
                </div>
              ))}
              <p className="text-sm text-ink-soft">🔒 = מילה שעוד לא לימדתם את קוסמו. לימדו אותה בתחנות, והיא תיפתח כאן.</p>
              <div className="flex items-center gap-3 flex-wrap">
                <span className="font-bold">ההוראה:</span>
                <bdi dir="ltr" className="en text-2xl text-primary-dark" data-testid="command-text">
                  {text || '…'}
                </bdi>
                <span className={`font-bold ${matches.length === 1 ? 'text-good' : 'text-try'}`} data-testid="command-status" data-matches={matches.length}>
                  {!picked.length ? '' : matches.length === 0 ? 'אין כזה בסדנה' : matches.length === 1 ? '✓ מתאים לדבר אחד בדיוק' : `מתאים ל-${matches.length} דברים — הוסיפו מילה כדי שיהיה רק אחד!`}
                </span>
              </div>
              <div className="flex justify-end">
                <BigButton variant="teal" onClick={send} locked={matches.length !== 1} lockedMessage="ההוראה צריכה להתאים לדבר אחד בדיוק" testId="send-command">
                  שלחו לקוסמו 🚀
                </BigButton>
              </div>
            </section>
          )}

          {stage === 'kosmo' && (
            <div className="grid grid-cols-2 gap-3">
              <button type="button" className="btn btn-soft !text-xl !min-h-[64px]" onClick={() => judge(true)} data-testid="kosmo-right" data-kosmo-correct={plan?.mode === 'tries' && plan.correct ? 'true' : 'false'}>
                ✅ צדקת, קוסמו
              </button>
              <button type="button" className="btn btn-soft !text-xl !min-h-[64px]" onClick={() => judge(false)} data-testid="kosmo-wrong">
                ❌ טעית
              </button>
            </div>
          )}

          {stage === 'show' && <p className="text-center font-bold text-lg">לחצו על הדבר שמתאים להוראה "{text}"</p>}

          {stage === 'done' && (
            <>
              <BrainChangeCard change={change} />
              {newPart && (
                <div className="card p-3 flex items-center gap-3 anim-pop bg-[#fffbe8]" data-testid="new-part">
                  <span className="text-3xl">🔧</span>
                  <ItemArt item={scene[target]} size={56} />
                  <span className="text-xl font-extrabold">חלק חדש לחללית!</span>
                </div>
              )}
              <div className="flex justify-between gap-3 flex-wrap">
                {taughtNow ? (
                  <BigButton variant="soft" onClick={() => again(true)} testId="resend-btn">
                    לשלוח שוב את אותה הוראה
                  </BigButton>
                ) : (
                  <span />
                )}
                <BigButton onClick={() => again(false)} testId="next-command">
                  הוראה חדשה <IconArrowLeft size={24} />
                </BigButton>
              </div>
            </>
          )}
        </div>
      </Page>
    </>
  );
}
