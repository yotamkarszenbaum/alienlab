import { useState } from 'react';
import { buildPictureToWord, type QuestionInstance } from '../../engine/tasks';
import { optionCountFor } from '../../engine/hints';
import { introducedWords, recordDelayedReview } from '../../engine/session';
import { kosmoLearns, kosmoTaught } from '../../engine/kosmo';
import { getWord } from '../../content/words';
import { useGame, now } from '../../state/GameContext';
import type { SaveData } from '../../engine/types';
import { ChoiceQuestion } from './ChoiceQuestion';
import { easierVersion } from './questionFactory';

// Spaced retrieval inside the game (not a separate test): when the child's
// review of a word is due, Kosmo's memory of it fades too ("fading" state in
// engine/kosmo.ts). As the child enters a station, Kosmo shows a picture and
// asks what it is called — the English word is NOT shown in advance, the child
// has to recall it. The answer is stored as a delayed review (apart from the
// immediate success right after learning) and refreshes Kosmo's memory.

export const MAX_REMINDERS = 3;

function buildReminder(d: SaveData, wordId: string, k: number): QuestionInstance {
  const wp = d.learning[wordId];
  return {
    ...buildPictureToWord(getWord(wordId), introducedWords(d), {
      optionCount: optionCountFor(wp?.independentCorrect ?? 0, 3, 4),
      // a different picture from the last time -> the meaning, not one image
      variant: (wp?.attempts ?? 0) + k + 3,
      taskId: `remind:${wordId}`,
    }),
    context: 'new',
  };
}

export function ReminderStep({ words, onDone }: { words: string[]; onDone: () => void }) {
  const { data, update } = useGame();
  const [i, setI] = useState(0);
  const [q, setQ] = useState<QuestionInstance>(() => buildReminder(data, words[0], 0));
  const wordId = words[i];
  const w = getWord(wordId);
  const kosmoKnew = kosmoTaught(data, wordId);
  return (
    <div className="flex flex-col gap-2" data-testid="reminder-step" data-word={wordId}>
      <p className="text-center font-bold text-ink-soft" aria-live="polite">
        🧠 קוסמו מבקש תזכורת — {i + 1} מתוך {words.length}
      </p>
      <ChoiceQuestion
        key={q.key}
        question={q}
        phase="review"
        askLine={
          kosmoKnew
            ? `רגע לפני שמתחילים: את זה לימדתם אותי פעם, אבל אני כבר לא בטוח שאני זוכר 😅 איך קוראים לזה באנגלית?`
            : `רגע לפני שמתחילים: את זה למדתם, ואני רוצה ללמוד מכם. איך קוראים לזה באנגלית?`
        }
        successLine={(_, withHelp) =>
          withHelp ? `נכון! ${w.english} — ${w.hebrew}. עכשיו גם אני זוכר. נמשיך לתרגל אותה.` : `נכון! ${w.english} — ${w.hebrew}. זכרתם בעצמכם, ועכשיו גם אני נזכרתי!`
        }
        makeEasier={easierVersion}
        onComplete={(r) => {
          const t = now();
          update((d) => kosmoLearns(recordDelayedReview(d, wordId, r.firstTryCorrect, r.anyHint, true, t), wordId, q.picture ?? null, 'remind', t).data);
          if (i + 1 >= words.length) onDone();
          else {
            setI(i + 1);
            setQ(buildReminder(data, words[i + 1], i + 1));
          }
        }}
        continueLabel={i + 1 >= words.length ? 'יוצאים לדרך' : 'הבא'}
      />
    </div>
  );
}
