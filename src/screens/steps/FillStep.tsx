import { useMemo, useRef, useState } from 'react';
import type { AlienMood } from '../../components/Alien';
import { ItemArt } from '../../components/ItemArt';
import { AlienStage, BigButton, HelpButton, HintPanel } from '../../components/ui';
import { IconArrowLeft } from '../../components/Icons';
import { initialSupport, onHelp, onWrong, type SupportState } from '../../engine/hints';
import { seededShuffle } from '../../engine/alienMind';
import { recordWordAttempt } from '../../engine/session';
import { inLevel } from '../../content/levels';
import { levelOfGame } from '../../engine/gameProgress';
import { useGame, now } from '../../state/GameContext';
import { playSfx } from '../../audio/sfx';
import { speak } from '../../audio/speech';
import type { FillDef, SaveData } from '../../engine/types';

// Complete the sentence from a word bank (curriculum, grade 3: "complete short
// sentences using a word bank"). At level 3 also grammar: THERE IS / THERE ARE,
// IN / ON / UNDER. Tap only.

function FillSentence({ def, taskId, onComplete, continueLabel }: { def: FillDef; taskId: string; onComplete: () => void; continueLabel: string }) {
  const { update } = useGame();
  const bank = useMemo(() => seededShuffle(def.bank, def.id.length * 7 + def.answer.length), [def]);
  const [support, setSupport] = useState<SupportState>(initialSupport);
  const [wrong, setWrong] = useState<string[]>([]);
  const [done, setDone] = useState(false);
  const [mood, setMood] = useState<AlienMood>('curious');
  const [line, setLine] = useState('אוי, שכחתי מילה באמצע המשפט שלי! 😅 איזו מילה חסרה?');
  const busy = useRef(false);

  // Level 2 support: drop wrong chips so two remain; level 3: highlight the answer.
  const visible = support.level >= 2 && bank.length > 2 ? bank.filter((c) => c === def.answer || c === bank.find((x) => x !== def.answer && !wrong.includes(x)) || wrong.includes(c)).filter((c, i, a) => a.indexOf(c) === i) : bank;

  const record = (d: SaveData, outcome: 'correct' | 'wrong', s: SupportState, n: number) =>
    def.wordIds.reduce(
      (acc, w) => recordWordAttempt(acc, { wordId: w, taskId, taskType: 'fill_blank', outcome, attemptNumber: n, support: s, completed: outcome === 'correct', phase: 'learn', context: 'new', now: now() }),
      d,
    );

  function choose(chip: string) {
    if (done || busy.current || wrong.includes(chip)) return;
    busy.current = true;
    setTimeout(() => (busy.current = false), 450);
    const n = support.wrong + 1;
    if (chip === def.answer) {
      update((d) => record(d, 'correct', support, n));
      playSfx('correct');
      setDone(true);
      setMood('success');
      const sentence = [def.before, def.answer, def.after].filter(Boolean).join(' ').replace(/ \./g, '.');
      setLine(support.used.length ? `נכון: ${sentence} הצלחתם בעזרת רמז.` : `מעולה! ${sentence}`);
      void speak(sentence, 'en');
      return;
    }
    update((d) => record(d, 'wrong', support, n));
    playSfx('tryAgain');
    const s = onWrong(support);
    setSupport(s);
    setWrong((w) => [...w, chip]);
    setMood('thinking');
    setLine(s.level >= 3 ? 'בואו נעשה את זה יחד: המילה הנכונה זוהרת.' : `לא נורא. רמז: ${def.tipHe}`);
  }

  function help() {
    if (done) return;
    const s = onHelp(support);
    setSupport(s);
    setLine(s.level >= 3 ? 'המילה הנכונה זוהרת בצהוב.' : s.level === 2 ? `השארתי רק שתי אפשרויות. ${def.tipHe}` : `רמז: ${def.tipHe}`);
  }

  return (
    <div className="flex flex-col gap-4" data-testid="fill-sentence" data-sentence={def.id}>
      <AlienStage mood={mood} text={line} />
      <div className="card p-4 sm:p-5 flex flex-col items-center gap-4 text-center">
        <ItemArt item={def.picture} size="clamp(110px, 26vw, 160px)" className={done ? 'anim-pop' : ''} />
        <p dir="ltr" lang="en" className="en text-[clamp(1.4rem,5.5vw,2.2rem)] text-primary-dark flex flex-wrap items-center justify-center gap-2" data-testid="fill-text">
          {def.before && <span>{def.before}</span>}
          <span
            className={`inline-grid place-items-center min-w-[3.5em] px-2 rounded-xl border-3 ${done ? 'border-good bg-good-bg text-good anim-pop' : 'border-dashed border-primary bg-lab text-line'}`}
            data-testid="fill-blank"
          >
            {done ? def.answer : '?'}
          </span>
          {def.after && <span>{def.after}</span>}
        </p>
        <p className="text-xl font-bold">{def.hebrew}</p>
        <div dir="ltr" className="flex gap-3 flex-wrap justify-center" data-testid="fill-bank">
          {visible.map((c) => {
            const isWrong = wrong.includes(c);
            const glow = !done && support.level >= 3 && c === def.answer;
            return (
              <button
                key={c}
                type="button"
                data-testid={`bank-${c}`}
                data-correct={c === def.answer ? 'true' : 'false'}
                disabled={done || isWrong}
                onClick={() => choose(c)}
                className={`min-h-[56px] min-w-[88px] px-5 rounded-2xl border-3 en text-[clamp(1.2rem,4.5vw,1.6rem)] ${
                  isWrong ? 'opacity-35 border-line bg-white line-through' : done && c === def.answer ? 'border-good bg-good-bg' : 'border-ink bg-white shadow-[0_5px_0_#2b2350] active:translate-y-1 active:shadow-[0_1px_0_#2b2350]'
                } ${glow ? 'ring-6 ring-sun anim-glow' : ''}`}
              >
                {c}
              </button>
            );
          })}
        </div>
      </div>
      {support.level > 0 && !done && (
        <HintPanel level={support.level}>
          <p>{def.tipHe}</p>
        </HintPanel>
      )}
      <div className="flex items-center justify-between gap-3 flex-wrap pt-2">
        {!done ? <HelpButton onClick={help} level={support.level} /> : <span />}
        <BigButton onClick={onComplete} locked={!done} lockedMessage="קודם משלימים את המשפט 🙂" testId="next-btn">
          {continueLabel} <IconArrowLeft size={24} />
        </BigButton>
      </div>
    </div>
  );
}

export function FillStep({ stepId, sentences, onDone }: { stepId: string; sentences: FillDef[]; onDone: () => void }) {
  const { data } = useGame();
  const [list] = useState(() => sentences.filter((s) => inLevel(s.minLevel, levelOfGame(data.game))));
  const [i, setI] = useState(0);
  const def = list[i];
  const last = i + 1 >= list.length;
  return (
    <div className="flex flex-col gap-2" data-testid="fill-step">
      <p className="text-center font-bold text-ink-soft" aria-live="polite">
        ✏️ משלימים משפטים — {i + 1} מתוך {list.length}
      </p>
      <FillSentence key={def.id} def={def} taskId={`${stepId}:${def.id}`} continueLabel={last ? 'המשך' : 'למשפט הבא'} onComplete={() => (last ? onDone() : setI(i + 1))} />
    </div>
  );
}
