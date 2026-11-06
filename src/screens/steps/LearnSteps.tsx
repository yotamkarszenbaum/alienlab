import { useEffect, useState } from 'react';
import type { DiscoverVisual as DV, ItemSpec, QuestionDef, SentenceDef } from '../../engine/types';
import { ItemArt } from '../../components/ItemArt';
import { AlienStage, BigButton, EnglishWord, SpeakButton } from '../../components/ui';
import { IconArrowLeft, IconRefresh } from '../../components/Icons';
import { useGame, now } from '../../state/GameContext';
import { introduceWord } from '../../engine/session';
import { levelOfGame } from '../../engine/gameProgress';
import { getWord } from '../../content/words';
import { SENTENCES_BY_ID } from '../../content/units';
import { useSpeechStatus } from '../../audio/speech';
import { ChoiceQuestion } from './ChoiceQuestion';
import { buildQuestion, easierVersion } from './questionFactory';
import type { QuestionInstance } from '../../engine/tasks';

// ------------------------------ Visuals ------------------------------------

function Transition({ from, to, replayKey }: { from: ItemSpec; to: ItemSpec; replayKey: number }) {
  const [after, setAfter] = useState(false);
  useEffect(() => {
    setAfter(false);
    const t = setTimeout(() => setAfter(true), 1100);
    return () => clearTimeout(t);
  }, [replayKey]);
  return (
    <div className="flex items-end justify-center gap-3">
      <div className="flex flex-col items-center">
        <ItemArt item={after ? to : from} size="clamp(150px, 34vw, 210px)" className={after ? 'anim-pop' : ''} />
        <span className="text-lg font-bold mt-1">{after ? 'אחרי' : 'לפני'}</span>
      </div>
    </div>
  );
}

export function DiscoverVisual({ v, replayKey = 0 }: { v: DV; replayKey?: number }) {
  if (v.type === 'single') return <ItemArt item={v.item} size="clamp(170px, 40vw, 240px)" className="anim-pop" />;
  if (v.type === 'set')
    return (
      <div className="flex items-end justify-center gap-1 sm:gap-4">
        {v.items.map((i, k) => (
          <ItemArt key={k} item={i} size="clamp(92px, 24vw, 170px)" className="anim-pop" />
        ))}
      </div>
    );
  if (v.type === 'compare')
    return (
      <div className="flex items-end justify-center gap-6">
        <div className="flex flex-col items-center">
          <ItemArt item={v.target} size="clamp(150px, 36vw, 220px)" />
          <span className="mt-1 rounded-full bg-sun px-3 py-1 font-extrabold border-2 border-ink">גדול ✓</span>
        </div>
        <div className="flex flex-col items-center opacity-80">
          <ItemArt item={v.contrast} size="clamp(150px, 36vw, 220px)" />
          <span className="mt-1 rounded-full bg-white px-3 py-1 font-bold border-2 border-line">קטן</span>
        </div>
      </div>
    );
  return <Transition from={v.from} to={v.to} replayKey={replayKey} />;
}

// ------------------------------ Discover -----------------------------------

export function DiscoverStep({ wordId, onDone }: { wordId: string; onDone: () => void }) {
  const { data, update } = useGame();
  const word = getWord(wordId);
  const heStatus = useSpeechStatus('he');
  const [replay, setReplay] = useState(0);
  useEffect(() => {
    update((d) => introduceWord(d, wordId, now()));
  }, [wordId, update]);
  const alienReads = data.settings.readAloudHe && heStatus !== 'unavailable';
  const example = levelOfGame(data.game) >= 2 ? word.example : undefined;
  return (
    <div className="flex flex-col gap-4" data-testid="discover-step" data-word={word.id}>
      <AlienStage mood="discovery" text={example ? `${word.discoverLineHe} ומיד אשתמש בה במשפט!` : word.discoverLineHe} />
      <div className="card p-4 sm:p-6 flex flex-col items-center gap-3 text-center">
        <DiscoverVisual v={word.illustration} replayKey={replay} />
        {word.illustration.type === 'transition' && (
          <button type="button" className="btn btn-soft !min-h-[44px] !text-base" onClick={() => setReplay((r) => r + 1)}>
            <IconRefresh size={20} /> לראות שוב
          </button>
        )}
        <div className="flex items-center gap-4 flex-wrap justify-center mt-1">
          <EnglishWord text={word.english} />
          <SpeakButton text={word.english} size="lg" autoPlayKey={alienReads ? null : word.id} testId="word-speak" />
        </div>
        <p className="text-3xl font-extrabold" data-testid="hebrew-meaning">
          {word.hebrew}
        </p>
        <p className="text-base text-ink-soft">
          אומרים: <b className="text-ink">{word.sayItHe}</b>
        </p>
      </div>
      {example && (
        <div className="card p-4 flex items-center gap-4 flex-wrap justify-center text-center anim-fade" data-testid="discover-example">
          <ItemArt item={example.picture} size="clamp(80px, 18vw, 110px)" />
          <div className="flex flex-col items-center gap-1">
            <span className="text-base font-bold text-ink-soft">קוסמו במשפט:</span>
            <span className="flex items-center gap-3 flex-wrap justify-center">
              <bdi dir="ltr" lang="en" className="en text-[clamp(1.4rem,5vw,2rem)] text-primary-dark">
                {example.en}
              </bdi>
              <SpeakButton text={example.en} size="sm" label="השמעת המשפט באנגלית" />
            </span>
            <span className="text-xl font-bold">{example.he}</span>
          </div>
        </div>
      )}
      <div className="flex justify-end">
        <BigButton onClick={onDone} testId="next-btn">
          הבנתי, נמשיך <IconArrowLeft size={24} />
        </BigButton>
      </div>
    </div>
  );
}

// ------------------------------ Practice -----------------------------------

const ASK = (q: QuestionInstance) =>
  q.mode === 'picture_to_word'
    ? 'מה השם של זה באנגלית? אפשר ללחוץ על הרמקול כדי לשמוע כל מילה.'
    : q.mode === 'sentence_to_picture'
      ? `אני מבקש: ${q.promptEn}. איזו תמונה מראה את זה?`
      : q.showText
        ? `תוכלו למצוא את ה-${q.promptEn}?`
        : 'הקשיבו למילה ומצאו את התמונה הנכונה!';

export function QuestionSequence({
  defs,
  onDone,
  doneLabel = 'המשך',
}: {
  defs: QuestionDef[];
  onDone: () => void;
  doneLabel?: string;
}) {
  const { data } = useGame();
  const enStatus = useSpeechStatus('en');
  const [index, setIndex] = useState(0);
  const [q, setQ] = useState<QuestionInstance>(() => buildQuestion(defs[0], data, enStatus !== 'unavailable'));
  const advance = () => {
    if (index + 1 >= defs.length) return onDone();
    const nextQ = buildQuestion(defs[index + 1], data, enStatus !== 'unavailable');
    setIndex(index + 1);
    setQ(nextQ);
  };
  return (
    <div className="flex flex-col gap-2">
      {defs.length > 1 && (
        <p className="text-center font-bold text-ink-soft" aria-live="polite">
          שאלה {index + 1} מתוך {defs.length}
        </p>
      )}
      <ChoiceQuestion
        question={q}
        phase="learn"
        askLine={ASK(q)}
        makeEasier={easierVersion}
        onComplete={advance}
        continueLabel={index + 1 >= defs.length ? doneLabel : 'לשאלה הבאה'}
      />
    </div>
  );
}

export function PracticeStep({ questions, onDone }: { questions: QuestionDef[]; onDone: () => void }) {
  return <QuestionSequence defs={questions} onDone={onDone} />;
}

// ------------------------------ Sentence -----------------------------------

function SentenceIntro({ s, onNext }: { s: SentenceDef; onNext: () => void }) {
  const [replay, setReplay] = useState(0);
  const { data } = useGame();
  const heStatus = useSpeechStatus('he');
  const alienReads = data.settings.readAloudHe && heStatus !== 'unavailable';
  return (
    <div className="flex flex-col gap-4" data-testid="sentence-intro">
      <AlienStage mood="discovery" text={`עכשיו נחבר מילים למשפט! כשאומרים לי ${s.english}, זה אומר: ${s.hebrew}.`} />
      <div className="card p-5 flex flex-col items-center gap-4 text-center">
        <DiscoverVisual v={{ type: 'transition', from: s.before, to: s.answer }} replayKey={replay} />
        <div dir="ltr" className="flex gap-2 sm:gap-3 flex-wrap justify-center">
          {s.parts.map((p, i) => (
            <div key={i} className="flex flex-col items-center rounded-2xl border-3 border-line bg-lab px-3 py-2">
              <span className="en text-3xl text-primary-dark">{p.en}</span>
              <span dir="rtl" className="text-base font-medium">
                {p.he}
              </span>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <SpeakButton text={s.english} sayHe={s.parts.map((p) => getWordSay(p.en)).join(' ')} size="lg" autoPlayKey={alienReads ? null : s.id} />
          <span className="text-2xl font-extrabold">{s.hebrew}</span>
        </div>
        <button type="button" className="btn btn-soft !min-h-[44px] !text-base" onClick={() => setReplay((r) => r + 1)}>
          <IconRefresh size={20} /> לראות שוב
        </button>
      </div>
      <div className="flex justify-end">
        <BigButton onClick={onNext} testId="next-btn">
          הבנתי, נתרגל <IconArrowLeft size={24} />
        </BigButton>
      </div>
    </div>
  );
}

const SAY: Record<string, string> = { THE: 'דְּה' };
function getWordSay(en: string) {
  if (SAY[en]) return SAY[en];
  try {
    return getWord(en.toLowerCase()).sayItHe;
  } catch {
    return en;
  }
}

export function SentenceStep({ sentenceId, questions, onDone }: { sentenceId: string; questions: QuestionDef[]; onDone: () => void }) {
  const [phase, setPhase] = useState<'intro' | 'questions'>('intro');
  const s = SENTENCES_BY_ID[sentenceId];
  if (phase === 'intro') return <SentenceIntro s={s} onNext={() => setPhase('questions')} />;
  return <QuestionSequence defs={questions} onDone={onDone} />;
}
