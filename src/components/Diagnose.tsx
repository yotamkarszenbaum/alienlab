import { useMemo, useRef, useState } from 'react';
import type { AlienMood } from './Alien';
import { AlienStage, HelpButton, HintPanel } from './ui';
import { ItemArt } from './ItemArt';
import { diagnoseOptions } from '../engine/brain';
import { examplesOf } from '../engine/alienMind';
import { initialSupport, onHelp, onWrong, type SupportState } from '../engine/hints';
import { playSfx } from '../audio/sfx';
import type { ConceptKnowledge, ItemSpec, WordDef } from '../engine/types';

// "Cosmo's Mistakes": before fixing Kosmo, the child works out WHAT he
// misunderstands — from the examples he got and the choice he made. Turns
// "find the right answer" into "diagnose and repair a misunderstanding".

export function DiagnoseCard({
  word,
  k,
  choice,
  onSolved,
}: {
  word: WordDef;
  k: ConceptKnowledge;
  /** What Kosmo chose (shown as evidence). */
  choice?: ItemSpec | null;
  onSolved: (perfect: boolean, support: SupportState) => void;
}) {
  const options = useMemo(() => diagnoseOptions(word, k) ?? [], [word, k]);
  const EN = word.english;
  const [support, setSupport] = useState<SupportState>(initialSupport);
  const [wrong, setWrong] = useState<string[]>([]);
  const [mood, setMood] = useState<AlienMood>('confused');
  const [line, setLine] = useState(`למה טעיתי? 🔍 תהיו בלשים: הסתכלו על הדוגמאות שהראיתם לי ועל מה שבחרתי. מה אני חושב ש-${EN} אומר?`);
  const busy = useRef(false);
  const examples = examplesOf(k);
  const hint = 'מה משותף לכל הדוגמאות שהראיתם לקוסמו? ומה יש גם בדבר שהוא בחר?';

  function pick(key: string) {
    if (busy.current || wrong.includes(key)) return;
    busy.current = true;
    setTimeout(() => (busy.current = false), 450);
    const o = options.find((x) => x.key === key)!;
    if (o.correct) {
      playSfx('correct');
      onSolved(support.wrong === 0 && support.used.length === 0, support);
      return;
    }
    playSfx('tryAgain');
    const s = onWrong(support, 'teach');
    setSupport(s);
    setWrong((w) => [...w, key]);
    setMood('thinking');
    setLine(s.level >= 3 ? 'התשובה זוהרת בצהוב.' : `לא בדיוק — אם הייתי חושב ש-${EN} זה ${o.labelHe}, לא הייתי בוחר כך. ${hint}`);
  }

  function help() {
    const s = onHelp(support, 'teach');
    setSupport(s);
    setLine(s.level >= 3 ? 'התשובה זוהרת בצהוב.' : s.level === 2 ? `הורדתי אפשרות אחת. ${hint}` : `רמז: ${hint}`);
  }

  const visible = support.level >= 2 ? options.filter((o) => o.correct || wrong.includes(o.key) || o === options.find((x) => !x.correct && !wrong.includes(x.key))) : options;

  return (
    <div className="flex flex-col gap-4" data-testid="diagnose">
      <AlienStage mood={mood} text={line} />
      <div className="card p-4 flex flex-col gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="font-bold">הדוגמאות שקיבלתי:</span>
          {examples.map((e, i) => (
            <ItemArt key={i} item={e} size={56} />
          ))}
          {choice && (
            <>
              <span className="font-bold ms-2">ובבדיקה בחרתי:</span>
              <span className="rounded-2xl border-3 border-try bg-try-bg p-1">
                <ItemArt item={choice} size={56} />
              </span>
            </>
          )}
        </div>
        <p className="text-xl font-bold">
          קוסמו חושב ש-<bdi className="en text-primary-dark" dir="ltr">{EN}</bdi> זה…
        </p>
        <div className="grid sm:grid-cols-3 gap-3" data-testid="diagnose-options">
          {visible.map((o) => (
            <button
              key={o.key}
              type="button"
              data-testid={`diag-${o.key}`}
              data-correct={o.correct ? 'true' : 'false'}
              disabled={wrong.includes(o.key)}
              onClick={() => pick(o.key)}
              className={`btn btn-soft !text-xl !min-h-[64px] ${wrong.includes(o.key) ? 'opacity-40 line-through' : ''} ${support.level >= 3 && o.correct ? 'ring-6 ring-sun anim-glow' : ''}`}
            >
              {o.labelHe}
            </button>
          ))}
        </div>
      </div>
      {support.level > 0 && (
        <HintPanel level={support.level}>
          <p>{hint}</p>
        </HintPanel>
      )}
      <div className="flex">
        <HelpButton onClick={help} level={support.level} />
      </div>
    </div>
  );
}
