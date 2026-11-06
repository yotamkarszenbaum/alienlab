import { useMemo, useRef, useState } from 'react';
import type { AlienMood } from '../../components/Alien';
import { ItemArt } from '../../components/ItemArt';
import { AlienStage, BigButton, HelpButton, HintPanel, SpeakButton } from '../../components/ui';
import { IconArrowLeft } from '../../components/Icons';
import { initialSupport, onHelp, onWrong, type SupportState } from '../../engine/hints';
import { seededShuffle } from '../../engine/alienMind';
import { recordWordAttempt } from '../../engine/session';
import { WORDS_BY_ID } from '../../content/words';
import { inLevel } from '../../content/levels';
import { levelOfGame } from '../../engine/gameProgress';
import { useGame, now } from '../../state/GameContext';
import { playSfx } from '../../audio/sfx';
import { speak } from '../../audio/speech';
import type { BuildDef, SaveData } from '../../engine/types';

// Sentence building (ages 8–12): the child sees what Kosmo should say in
// Hebrew and taps English word chips in the right order (no dragging).
// Word-order mistakes raise support but are not counted against a word;
// a word only counts as wrong when the child left it out (used a wrong word).

interface Chip {
  id: string;
  text: string;
}

function BuildSentence({ def, taskId, onComplete, continueLabel }: { def: BuildDef; taskId: string; onComplete: () => void; continueLabel: string }) {
  const { update } = useGame();
  const target = def.tokens;
  const sentence = target.join(' ');
  const chips = useMemo<Chip[]>(
    () => seededShuffle([...def.tokens, ...def.extraTokens].map((t, i) => ({ id: `${t}-${i}`, text: t })), def.id.length * 13 + target.length),
    [def, target.length],
  );
  const [slots, setSlots] = useState<(string | null)[]>(() => target.map(() => null));
  const [locked, setLocked] = useState<boolean[]>(() => target.map(() => false));
  const [support, setSupport] = useState<SupportState>(initialSupport);
  const [done, setDone] = useState(false);
  const [shake, setShake] = useState(false);
  const [mood, setMood] = useState<AlienMood>('curious');
  const [line, setLine] = useState(`רציתי לומר באנגלית "${def.hebrew}", אבל המילים שלי התערבבו! 😵 תסדרו לי אותן לפי הסדר?`);
  const busy = useRef(false);

  const chipById = (id: string | null) => chips.find((c) => c.id === id);
  const used = new Set(slots.filter(Boolean) as string[]);
  const extrasHidden = support.level >= 2;
  const visibleChips = chips.filter((c) => !extrasHidden || target.includes(c.text));
  const nextSlot = slots.findIndex((s) => s === null);
  const nextText = nextSlot >= 0 ? target[nextSlot] : null;
  const nextChip = nextText ? visibleChips.find((c) => c.text === nextText && !used.has(c.id)) : undefined;

  const record = (d: SaveData, wordId: string, outcome: 'correct' | 'wrong', s: SupportState, n: number, completed: boolean) =>
    recordWordAttempt(d, { wordId, taskId, taskType: 'build_sentence', outcome, attemptNumber: n, support: s, completed, phase: 'learn', context: 'new', now: now() });

  function check(filled: (string | null)[]) {
    const built = filled.map((id) => chipById(id)?.text ?? '');
    const correct = built.join(' ') === sentence;
    const attemptNumber = support.wrong + 1;
    if (correct) {
      update((d) => def.wordIds.reduce((acc, w) => record(acc, w, 'correct', support, attemptNumber, true), d));
      playSfx('correct');
      setDone(true);
      setMood('success');
      setLine(`${sentence}! ${support.used.length ? 'יפה מאוד, הצלחתם בעזרת רמז.' : 'מושלם — סידרתם לבד!'} עכשיו אני יודע להגיד "${def.hebrew}".`);
      return;
    }
    // A word counts as wrong only when it is missing (a wrong word was used instead).
    const has = (en: string) => built.some((t) => t === en || t === `${en}S` || t === `${en}ES`);
    const missing = def.wordIds.filter((w) => !has(WORDS_BY_ID[w]?.english ?? ''));
    if (missing.length) update((d) => missing.reduce((acc, w) => record(acc, w, 'wrong', support, attemptNumber, false), d));
    playSfx('tryAgain');
    const s = onWrong(support);
    setSupport(s);
    const keep = filled.map((id, i) => chipById(id)?.text === target[i]);
    setLocked(keep);
    setSlots(filled.map((id, i) => (keep[i] ? id : null)));
    setShake(true);
    setTimeout(() => setShake(false), 500);
    setMood('thinking');
    if (s.level === 1) {
      setLine(`${keep.some(Boolean) ? 'כמעט! המילים הירוקות כבר במקום.' : 'כמעט! הסדר עוד לא נכון.'} רמז: ${def.tipHe}`);
      void speak(sentence, 'en');
    } else if (s.level === 2) setLine('הורדתי את המילה המיותרת. המילה הבאה זוהרת בצהוב.');
    else setLine('בואו נעשה את זה יחד: המשפט כתוב באפור. לחצו על המילים לפי הסדר.');
  }

  function tapChip(c: Chip) {
    if (done || busy.current || used.has(c.id) || nextSlot < 0) return;
    busy.current = true;
    setTimeout(() => (busy.current = false), 180);
    playSfx('tap');
    const filled = [...slots];
    filled[nextSlot] = c.id;
    setSlots(filled);
    if (filled.every(Boolean)) setTimeout(() => check(filled), 250);
  }

  function clearSlot(i: number) {
    if (done || locked[i] || !slots[i]) return;
    const s = [...slots];
    s[i] = null;
    setSlots(s);
  }

  function help() {
    if (done) return;
    const s = onHelp(support);
    setSupport(s);
    if (s.level === 1) {
      setLine(`רמז: ${def.tipHe}`);
      void speak(sentence, 'en');
    } else if (s.level === 2) setLine('הורדתי את המילה המיותרת. המילה הבאה זוהרת בצהוב.');
    else setLine('המשפט כתוב באפור בתוך המשבצות. לחצו על המילים לפי הסדר.');
  }

  return (
    <div className="flex flex-col gap-4" data-testid="build-sentence" data-sentence={def.id}>
      <AlienStage mood={mood} text={line} />
      <div className="card p-4 flex flex-col items-center gap-4 text-center">
        <div className="flex items-center gap-4 flex-wrap justify-center">
          <ItemArt item={def.picture} size="clamp(100px, 24vw, 150px)" className={done ? 'anim-pop' : ''} />
          <div className="flex flex-col items-center gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold">{def.hebrew}</span>
            {support.level >= 1 && <SpeakButton text={sentence} size="sm" label="השמעת המשפט באנגלית" />}
          </div>
        </div>
        <div dir="ltr" className={`flex gap-2 justify-center flex-wrap ${shake ? 'anim-shake' : ''}`} data-testid="build-slots">
          {target.map((t, i) => {
            const c = chipById(slots[i]);
            const isLocked = locked[i] || done;
            return (
              <button
                key={i}
                type="button"
                onClick={() => clearSlot(i)}
                aria-label={c ? `${c.text}${isLocked ? ' (במקום הנכון)' : ' — לחצו כדי להחזיר'}` : `מקום ${i + 1} במשפט`}
                className={`min-w-[clamp(64px,18vw,104px)] h-[56px] px-2 rounded-2xl border-3 grid place-items-center en text-[clamp(1.1rem,4.5vw,1.6rem)] ${
                  isLocked && c ? 'border-good bg-good-bg text-good' : c ? 'border-primary bg-white text-primary-dark' : 'border-dashed border-line bg-lab text-line'
                }`}
              >
                {c ? c.text : support.level >= 3 ? <span className="text-[#c9c0ef]">{t}</span> : ''}
              </button>
            );
          })}
        </div>
        <div dir="ltr" className="flex gap-2 flex-wrap justify-center" data-testid="build-chips">
          {visibleChips.map((c) => {
            const isUsed = used.has(c.id);
            const glow = !done && support.level >= 2 && nextChip?.id === c.id;
            return (
              <button
                key={c.id}
                type="button"
                data-testid={`chip-${c.text}`}
                data-next={nextChip?.id === c.id ? 'true' : 'false'}
                disabled={isUsed || done}
                onClick={() => tapChip(c)}
                className={`min-h-[52px] px-4 rounded-2xl border-3 border-ink en text-[clamp(1.1rem,4.5vw,1.5rem)] ${
                  isUsed ? 'opacity-25 bg-white' : 'bg-white shadow-[0_5px_0_#2b2350] active:translate-y-1 active:shadow-[0_1px_0_#2b2350]'
                } ${glow ? 'ring-6 ring-sun anim-glow' : ''}`}
              >
                {c.text}
              </button>
            );
          })}
        </div>
      </div>
      {support.level > 0 && !done && (
        <HintPanel level={support.level}>
          <p>{def.tipHe}</p>
          {support.level >= 2 && nextText && (
            <p className="text-base mt-1">
              המילה הבאה: <bdi className="en" dir="ltr">{nextText}</bdi>
            </p>
          )}
        </HintPanel>
      )}
      <div className="flex items-center justify-between gap-3 flex-wrap pt-2">
        {!done ? <HelpButton onClick={help} level={support.level} /> : <span />}
        <BigButton onClick={onComplete} locked={!done} lockedMessage="קודם מסדרים את המשפט 🙂" testId="next-btn">
          {continueLabel} <IconArrowLeft size={24} />
        </BigButton>
      </div>
    </div>
  );
}

export function BuildStep({ stepId, sentences, onDone }: { stepId: string; sentences: BuildDef[]; onDone: () => void }) {
  const { data } = useGame();
  const [list] = useState(() => sentences.filter((s) => inLevel(s.minLevel, levelOfGame(data.game))));
  const [i, setI] = useState(0);
  const def = list[i];
  const last = i + 1 >= list.length;
  return (
    <div className="flex flex-col gap-2" data-testid="build-step">
      <p className="text-center font-bold text-ink-soft" aria-live="polite">
        🧩 בונים משפטים — {i + 1} מתוך {list.length}
      </p>
      <BuildSentence key={def.id} def={def} taskId={`${stepId}:${def.id}`} continueLabel={last ? 'המשך' : 'למשפט הבא'} onComplete={() => (last ? onDone() : setI(i + 1))} />
    </div>
  );
}
