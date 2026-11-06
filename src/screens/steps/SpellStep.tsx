import { useEffect, useMemo, useRef, useState } from 'react';
import type { AlienMood } from '../../components/Alien';
import { ItemArt } from '../../components/ItemArt';
import { AlienStage, BigButton, HelpButton, HintPanel, SpeakButton } from '../../components/ui';
import { IconArrowLeft } from '../../components/Icons';
import { initialSupport, onHelp, onWrong, type SupportState } from '../../engine/hints';
import { seededShuffle } from '../../engine/alienMind';
import { recordWordAttempt } from '../../engine/session';
import { getWord } from '../../content/words';
import { useGame, now } from '../../state/GameContext';
import { playSfx } from '../../audio/sfx';
import { speak } from '../../audio/speech';
import type { WordDef } from '../../engine/types';

// Production task (level 3): build the English word by tapping letter tiles
// in order. Tapping only — no dragging. Tracked apart from recognition.

interface Tile {
  id: string;
  ch: string;
}

const EXTRA_POOL = 'SMTAEORLNPGHUIWBDCK'.split('');

function makeTiles(word: string): Tile[] {
  const letters = word.split('');
  const extras: string[] = [];
  for (let k = 0; extras.length < 2 && k < EXTRA_POOL.length * 2; k++) {
    const c = EXTRA_POOL[(k + word.length * 3) % EXTRA_POOL.length];
    if (!letters.includes(c) && !extras.includes(c)) extras.push(c);
  }
  const tiles = [...letters, ...extras].map((ch, i) => ({ id: `${ch}${i}`, ch }));
  return seededShuffle(tiles, word.charCodeAt(0) + word.length * 11);
}

function SpellWord({ word, taskId, onComplete, continueLabel }: { word: WordDef; taskId: string; onComplete: () => void; continueLabel: string }) {
  const { update } = useGame();
  const target = word.english.split('');
  const tiles = useMemo(() => makeTiles(word.english), [word.english]);
  const [slots, setSlots] = useState<(string | null)[]>(() => target.map(() => null));
  const [locked, setLocked] = useState<boolean[]>(() => target.map(() => false));
  const [support, setSupport] = useState<SupportState>(initialSupport);
  const [done, setDone] = useState(false);
  const [shake, setShake] = useState(false);
  const [mood, setMood] = useState<AlienMood>('curious');
  const [line, setLine] = useState(`אני רוצה לכתוב "${word.hebrew}" באנגלית. תעזרו לי להרכיב את המילה מהאותיות?`);
  const busy = useRef(false);

  const tileById = (id: string | null) => tiles.find((t) => t.id === id);
  const used = new Set(slots.filter(Boolean) as string[]);
  const extrasHidden = support.level >= 2;
  const visibleTiles = tiles.filter((t) => !extrasHidden || target.includes(t.ch));
  const nextSlot = slots.findIndex((s) => s === null);
  const nextLetter = nextSlot >= 0 ? target[nextSlot] : null;
  const nextTile = nextLetter ? visibleTiles.find((t) => t.ch === nextLetter && !used.has(t.id)) : undefined;

  function check(filled: (string | null)[]) {
    const built = filled.map((id) => tileById(id)?.ch ?? '').join('');
    const correct = built === word.english;
    const attemptNumber = support.wrong + 1;
    update((d) =>
      recordWordAttempt(d, {
        wordId: word.id,
        taskId,
        taskType: 'spell_word',
        outcome: correct ? 'correct' : 'wrong',
        attemptNumber,
        support,
        completed: correct,
        phase: 'learn',
        context: 'new',
        now: now(),
      }),
    );
    if (correct) {
      playSfx('correct');
      setDone(true);
      setMood('success');
      setLine(support.used.length ? `יפה מאוד! ${word.english} — ${word.hebrew}. הרכבתם בעזרת רמז.` : `מדהים! הרכבתם לבד: ${word.english} — ${word.hebrew}!`);
      return;
    }
    playSfx('tryAgain');
    const s = onWrong(support);
    setSupport(s);
    // Letters already in the right place stay (green); the others go back.
    const keep = filled.map((id, i) => tileById(id)?.ch === target[i]);
    setLocked(keep);
    setSlots(filled.map((id, i) => (keep[i] ? id : null)));
    setShake(true);
    setTimeout(() => setShake(false), 500);
    setMood('thinking');
    if (s.level === 1) {
      setLine(keep.some(Boolean) ? 'כמעט! האותיות הירוקות כבר במקום. הקשיבו שוב למילה ונסו להשלים.' : 'כמעט! הקשיבו שוב למילה ונסו שוב.');
      void speak(word.english, 'en');
    } else if (s.level === 2) setLine('הורדתי את האותיות המיותרות. האות הבאה זוהרת בצהוב.');
    else setLine('בואו נעשה את זה יחד: המילה כתובה באפור בתוך המשבצות. לחצו על האותיות לפי הסדר.');
  }

  function tapTile(t: Tile) {
    if (done || busy.current || used.has(t.id) || nextSlot < 0) return;
    busy.current = true;
    setTimeout(() => (busy.current = false), 180);
    playSfx('tap');
    const filled = [...slots];
    filled[nextSlot] = t.id;
    setSlots(filled);
    if (filled.every(Boolean)) setTimeout(() => check(filled), 250);
  }

  function clearSlot(i: number) {
    if (done || locked[i] || !slots[i]) return;
    const s = [...slots];
    s[i] = null;
    setSlots(s);
  }

  function backspace() {
    for (let i = slots.length - 1; i >= 0; i--) {
      if (slots[i] && !locked[i]) return clearSlot(i);
    }
  }

  function help() {
    if (done) return;
    const s = onHelp(support);
    setSupport(s);
    if (s.level === 1) {
      setLine(`רמז: הקשיבו למילה. אומרים: ${word.sayItHe}.`);
      void speak(word.english, 'en');
    } else if (s.level === 2) setLine('הורדתי את האותיות המיותרות. האות הבאה זוהרת בצהוב.');
    else setLine('המילה כתובה באפור בתוך המשבצות. לחצו על האותיות לפי הסדר.');
  }

  useEffect(() => {
    // read the word once when the task opens
    const t = setTimeout(() => void speak(word.english, 'en'), 500);
    return () => clearTimeout(t);
  }, [word.english]);

  return (
    <div className="flex flex-col gap-4" data-testid="spell-word" data-word={word.id}>
      <AlienStage mood={mood} text={line} />
      <div className="card p-4 flex flex-col items-center gap-4 text-center">
        <div className="flex items-center gap-4 flex-wrap justify-center">
          <ItemArt item={word.positiveExamples[0]} size="clamp(110px, 26vw, 160px)" />
          <div className="flex flex-col items-center gap-2">
            <span className="text-3xl font-extrabold">{word.hebrew}</span>
            <SpeakButton text={word.english} sayHe={support.level >= 1 ? word.sayItHe : undefined} label={`השמעת המילה ${word.hebrew} באנגלית`} testId="spell-speak" />
          </div>
        </div>
        <div dir="ltr" className={`flex gap-2 sm:gap-3 justify-center ${shake ? 'anim-shake' : ''}`} data-testid="spell-slots" aria-label="המשבצות של המילה">
          {target.map((ch, i) => {
            const t = tileById(slots[i]);
            const isLocked = locked[i] || done;
            return (
              <button
                key={i}
                type="button"
                onClick={() => clearSlot(i)}
                aria-label={t ? `אות ${t.ch}${isLocked ? ' (נכונה)' : ' — לחצו כדי להחזיר'}` : `משבצת ריקה ${i + 1}`}
                className={`w-[clamp(52px,14vw,72px)] h-[clamp(60px,16vw,80px)] rounded-2xl border-3 grid place-items-center en text-[clamp(1.8rem,7vw,2.6rem)] ${
                  isLocked && t ? 'border-good bg-good-bg text-good' : t ? 'border-primary bg-white text-primary-dark' : 'border-dashed border-line bg-lab text-line'
                }`}
              >
                {t ? t.ch : support.level >= 3 ? <span className="text-[#c9c0ef]">{ch}</span> : ''}
              </button>
            );
          })}
        </div>
        <div dir="ltr" className="flex gap-2 sm:gap-3 flex-wrap justify-center" data-testid="spell-tiles">
          {visibleTiles.map((t) => {
            const isUsed = used.has(t.id);
            const glow = !done && support.level >= 2 && nextTile?.id === t.id;
            return (
              <button
                key={t.id}
                type="button"
                data-testid={`tile-${t.ch}`}
                data-next={nextTile?.id === t.id ? 'true' : 'false'}
                disabled={isUsed || done}
                onClick={() => tapTile(t)}
                aria-label={`האות ${t.ch}`}
                className={`w-[clamp(52px,13vw,66px)] h-[clamp(52px,13vw,66px)] rounded-2xl border-3 border-ink en text-[clamp(1.6rem,6vw,2.2rem)] transition ${
                  isUsed ? 'opacity-25 bg-white shadow-none' : 'bg-white shadow-[0_5px_0_#2b2350] active:translate-y-1 active:shadow-[0_1px_0_#2b2350]'
                } ${glow ? 'ring-6 ring-sun anim-glow' : ''}`}
              >
                {t.ch}
              </button>
            );
          })}
        </div>
        {!done && (
          <button type="button" className="btn btn-soft !min-h-[48px] !text-base" onClick={backspace} data-testid="spell-back">
            ⌫ מחיקת אות
          </button>
        )}
      </div>
      {support.level > 0 && !done && (
        <HintPanel level={support.level}>
          <p>
            <b>{word.hebrew}</b> באנגלית — אומרים: {word.sayItHe}
          </p>
          {support.level >= 2 && <p className="text-base mt-1">האות הבאה היא {nextLetter ? <bdi className="en" dir="ltr">{nextLetter}</bdi> : '—'}</p>}
        </HintPanel>
      )}
      <div className="flex items-center justify-between gap-3 flex-wrap pt-2">
        {!done ? <HelpButton onClick={help} level={support.level} /> : <span />}
        <BigButton onClick={onComplete} locked={!done} lockedMessage="קודם מרכיבים את המילה 🙂" testId="next-btn">
          {continueLabel} <IconArrowLeft size={24} />
        </BigButton>
      </div>
    </div>
  );
}

export function SpellStep({ stepId, wordIds, onDone }: { stepId: string; wordIds: string[]; onDone: () => void }) {
  const [i, setI] = useState(0);
  const word = getWord(wordIds[i]);
  const last = i + 1 >= wordIds.length;
  return (
    <div className="flex flex-col gap-2" data-testid="spell-step">
      <p className="text-center font-bold text-ink-soft" aria-live="polite">
        🔤 מרכיבים מילים — מילה {i + 1} מתוך {wordIds.length}
      </p>
      <SpellWord key={word.id} word={word} taskId={`${stepId}:${word.id}`} continueLabel={last ? 'המשך' : 'למילה הבאה'} onComplete={() => (last ? onDone() : setI(i + 1))} />
    </div>
  );
}
