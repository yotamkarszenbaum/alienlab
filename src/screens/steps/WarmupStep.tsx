import { useEffect, useRef, useState } from 'react';
import type { AlienMood } from '../../components/Alien';
import { AlienStage, BigButton, EnglishWord, OptionCard, SpeakButton, type OptionState } from '../../components/ui';
import { ItemArt } from '../../components/ItemArt';
import { IconArrowLeft } from '../../components/Icons';
import type { Level, UnitDef } from '../../engine/types';
import { buildWordToPicture, type ChoiceOption, type QuestionInstance } from '../../engine/tasks';
import { initialSupport } from '../../engine/hints';
import { introduceWord, recordChoice } from '../../engine/session';
import { unitWordIds } from '../../content/units';
import { getWord, WORDS_BY_ID } from '../../content/words';
import { useGame, now } from '../../state/GameContext';
import { playSfx } from '../../audio/sfx';

// Levels 2–3: older children already know many basic words from school.
// A quick, no-pressure check: words they recognise skip the "discover" and
// first-practice screens; words they don't know (or mark "not learned yet")
// are introduced as usual. Correct answers are stored as independent
// recognition; "not learned yet" is not counted as a mistake.

type Result = 'known' | 'new';

function wordsToCheck(unit: UnitDef, level: Level, introduced: (id: string) => boolean): string[] {
  return unitWordIds(unit, level).filter((id) => (WORDS_BY_ID[id].minLevel ?? 1) < level && !introduced(id));
}

export function WarmupStep({ unit, stepId, level, onDone }: { unit: UnitDef; stepId: string; level: Level; onDone: (skipStepIds: string[]) => void }) {
  const { data, update } = useGame();
  const [words] = useState(() => wordsToCheck(unit, level, (id) => !!data.learning[id]?.introduced));
  const [i, setI] = useState(0);
  const [results, setResults] = useState<Record<string, Result>>({});
  const [picked, setPicked] = useState<ChoiceOption | null>(null);
  const [answered, setAnswered] = useState<null | 'right' | 'wrong' | 'skip'>(null);
  const [summary, setSummary] = useState(false);
  const busy = useRef(false);
  const doneOnce = useRef(false);

  // Nothing to check (e.g. the words were already learned at a lower level).
  useEffect(() => {
    if (!words.length && !doneOnce.current) {
      doneOnce.current = true;
      onDone([]);
    }
  }, [words.length, onDone]);

  const build = (k: number): QuestionInstance =>
    buildWordToPicture(getWord(words[k]), { optionCount: 4, audioOnly: false, variant: k + 1, taskId: `${stepId}:${words[k]}`, context: 'intro' });
  const [q, setQ] = useState<QuestionInstance | null>(() => (words.length ? build(0) : null));

  if (!words.length || !q) return null;
  const word = getWord(words[i]);

  function choose(o: ChoiceOption) {
    if (answered || busy.current || !q) return;
    busy.current = true;
    setTimeout(() => (busy.current = false), 450);
    setPicked(o);
    update((d) => recordChoice(introduceWord(d, word.id, now()), q, o, 1, initialSupport, 'learn', now()));
    if (o.correct) {
      playSfx('correct');
      setAnswered('right');
      setResults((r) => ({ ...r, [word.id]: 'known' }));
    } else {
      playSfx('pop');
      setAnswered('wrong');
      setResults((r) => ({ ...r, [word.id]: 'new' }));
    }
  }

  function dontKnow() {
    if (answered) return;
    playSfx('tap');
    setAnswered('skip');
    setResults((r) => ({ ...r, [word.id]: 'new' }));
  }

  function next() {
    if (i + 1 >= words.length) return setSummary(true);
    setI(i + 1);
    setQ(build(i + 1));
    setPicked(null);
    setAnswered(null);
  }

  if (summary) {
    const known = words.filter((w) => results[w] === 'known');
    const toLearn = words.filter((w) => results[w] !== 'known');
    return (
      <div className="flex flex-col gap-4" data-testid="warmup-summary" data-known={known.length}>
        <AlienStage
          mood="success"
          text={
            known.length === words.length
              ? `וואו! אתם כבר מכירים את כל ${words.length} המילים. נדלג עליהן ונעבור ישר לדברים החדשים!`
              : known.length
                ? `אתם כבר מכירים ${known.length} מתוך ${words.length} מילים! נדלג עליהן, ונלמד יחד רק את מה שחדש.`
                : 'אין בעיה — נלמד את כל המילים יחד, אחת אחת.'
          }
        />
        <div className="grid sm:grid-cols-2 gap-3">
          <section className="card p-4">
            <h3 className="font-extrabold text-lg mb-2">✓ כבר מכירים ({known.length})</h3>
            <div className="flex flex-wrap gap-2">
              {known.map((w) => (
                <Chip key={w} id={w} />
              ))}
            </div>
          </section>
          <section className="card p-4">
            <h3 className="font-extrabold text-lg mb-2">✨ נלמד עכשיו ({toLearn.length})</h3>
            <div className="flex flex-wrap gap-2">
              {toLearn.map((w) => (
                <Chip key={w} id={w} />
              ))}
            </div>
          </section>
        </div>
        <div className="flex justify-end">
          <BigButton onClick={() => onDone(known.flatMap((w) => [`${w}-discover`, `${w}-practice`]))} testId="next-btn">
            המשך <IconArrowLeft size={24} />
          </BigButton>
        </div>
      </div>
    );
  }

  const line =
    answered === 'right'
      ? `מכירים! ${word.english} — ${word.hebrew}.`
      : answered === 'wrong'
        ? `לא נורא. ${word.english} זה ${word.hebrew} — נלמד את זה עוד רגע.`
        : answered === 'skip'
          ? 'אין בעיה — נלמד את המילה הזאת עוד רגע!'
          : i === 0
            ? 'אתם כבר בטח מכירים חלק מהמילים בתחנה הזאת. בואו נבדוק מהר — מילים שתכירו, נדלג עליהן!'
            : 'ומה עם המילה הזאת?';
  const mood: AlienMood = answered === 'right' ? 'success' : answered ? 'happy' : 'curious';
  const stateOf = (o: ChoiceOption): OptionState => {
    if (!answered) return 'idle';
    if (o.correct && answered !== 'skip') return 'correct';
    if (picked && o.key === picked.key && !o.correct) return 'wrong';
    return 'eliminated';
  };

  return (
    <div className="flex flex-col gap-4" data-testid="warmup-step" data-word={word.id}>
      <p className="text-center font-bold text-ink-soft" aria-live="polite">
        ⚡ מה אתם כבר יודעים? — מילה {i + 1} מתוך {words.length}
      </p>
      <AlienStage mood={mood} text={line} />
      <div className="card px-4 py-4 flex items-center gap-4 flex-wrap justify-center">
        <EnglishWord text={word.english} />
        <SpeakButton text={word.english} sayHe={word.sayItHe} />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3" data-testid="options">
        {q.options.map((o) => (
          <OptionCard key={o.key} option={o} state={stateOf(o)} onClick={() => choose(o)} disabled={!!answered} />
        ))}
      </div>
      <div className="flex items-center justify-between gap-3 flex-wrap pt-2">
        {!answered ? (
          <button type="button" className="btn btn-soft !text-lg" onClick={dontKnow} data-testid="dont-know">
            🤔 עוד לא למדתי את המילה הזאת
          </button>
        ) : (
          <span />
        )}
        <BigButton onClick={next} locked={!answered} lockedMessage="בוחרים תמונה, או לוחצים 'עוד לא למדתי'" testId="next-btn">
          {i + 1 >= words.length ? 'סיום הבדיקה' : 'למילה הבאה'} <IconArrowLeft size={24} />
        </BigButton>
      </div>
    </div>
  );
}

function Chip({ id }: { id: string }) {
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
