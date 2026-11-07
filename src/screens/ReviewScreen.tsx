import { useState } from 'react';
import { AlienStage, BigButton, Page, TopBar } from '../components/ui';
import { IconArrowLeft } from '../components/Icons';
import { useGame, now } from '../state/GameContext';
import { useNav } from '../state/nav';
import { dueWords, recordDelayedReview, wordsNeedingPractice } from '../engine/session';
import { buildPictureToWord, buildWordToPicture, CATEGORY_HE, contextPicture, type QuestionInstance } from '../engine/tasks';
import { introducedWords } from '../engine/session';
import { kosmoLearns } from '../engine/kosmo';
import { audioOnlyFor, optionCountFor } from '../engine/hints';
import { getWord } from '../content/words';
import { sameItem } from '../content/items';
import { useSpeechStatus } from '../audio/speech';
import { ChoiceQuestion } from './steps/ChoiceQuestion';
import { easierVersion } from './steps/questionFactory';
import type { SaveData } from '../engine/types';

const MAX_REVIEW = 4;

/**
 * Memory mission: the word comes back in a NEW context (a picture it was never
 * learned with) and the child must recall the English word — it is not shown.
 */
function buildMemoryQuestion(wordId: string, d: SaveData, k: number): QuestionInstance {
  const w = getWord(wordId);
  const wp = d.learning[wordId];
  return {
    ...buildPictureToWord(w, introducedWords(d), {
      optionCount: optionCountFor(wp?.independentCorrect ?? 0, 3, 4),
      variant: (wp?.attempts ?? 0) + k,
      taskId: `memory:${wordId}`,
      picture: contextPicture(w, (wp?.attempts ?? 0) * 7 + k + wordId.length),
    }),
    context: 'new',
  };
}

function buildReviewQuestion(wordId: string, d: SaveData, audioWorks: boolean): QuestionInstance {
  const w = getWord(wordId);
  const wp = d.learning[wordId];
  const indep = wp?.independentCorrect ?? 0;
  // Different picture than during learning (variant shifted) -> word used in a new context.
  return buildWordToPicture(w, {
    optionCount: optionCountFor(indep, 3, 4),
    audioOnly: audioOnlyFor(indep, audioWorks),
    variant: (wp?.attempts ?? 0) + 2,
    taskId: `review:${wordId}`,
    context: 'new',
  });
}

/**
 * The review is part of the story ("Kosmo's memory machine needs words"),
 * not a separate test. Only words that were really due count as delayed reviews.
 */
export function ReviewScreen({ mode }: { mode: 'due' | 'practice' }) {
  const { data, update } = useGame();
  const { go } = useNav();
  const enStatus = useSpeechStatus('en');
  const [dueAtStart] = useState(() => new Set(dueWords(data, now())));
  const [words] = useState(() => (mode === 'due' ? [...dueAtStart] : wordsNeedingPractice(data)).slice(0, MAX_REVIEW));
  const [i, setI] = useState(0);
  const build = (id: string, k: number) => (mode === 'due' ? buildMemoryQuestion(id, data, k) : buildReviewQuestion(id, data, enStatus !== 'unavailable'));
  const [q, setQ] = useState<QuestionInstance | null>(() => (words.length ? build(words[0], 0) : null));
  const [finished, setFinished] = useState(false);

  const title = mode === 'due' ? 'משימת זיכרון' : 'תרגול נוסף';

  if (!q || finished) {
    return (
      <>
        <TopBar onHome={() => go({ name: 'lab' })} title={title} />
        <Page>
          <div className="flex flex-col gap-4" data-testid="review-done">
            <AlienStage
              mood={finished ? 'success' : 'happy'}
              text={finished ? (mode === 'due' ? 'כל גבישי הזיכרון שלי דולקים! 🔮 נזכרתם במילים בעצמכם — ועכשיו גם אני זוכר אותן. תודה!' : 'מכונת הזיכרון שלי עובדת שוב! עכשיו אני זוכר את המילים. תודה!') : 'כרגע אין מילים לחזרה. נחזור אליהן בפעם הבאה!'}
            />
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

  const wordId = words[i];
  const w = getWord(wordId);
  const counts = phaseFor(wordId);
  function phaseFor(id: string): 'review' | 'learn' {
    return dueAtStart.has(id) ? 'review' : 'learn';
  }

  return (
    <>
      <TopBar onHome={() => go({ name: 'lab' })} title={title} progress={{ current: i, total: words.length }} />
      <Page>
        <div
          data-testid="review-screen"
          data-word={wordId}
          data-phase={counts}
          data-mode={q.mode}
          data-new-context={q.picture && !w.positiveExamples.some((p) => sameItem(p, q.picture!)) ? 'true' : 'false'}
        >
          <div className="card p-3 mb-3 flex items-center gap-3" aria-hidden>
            <span className="text-3xl">{mode === 'due' ? '🔮' : '⚙️'}</span>
            <div className="flex gap-1.5">
              {words.map((_, k) => (
                <span key={k} className="w-6 h-6 rounded-full border-2 border-ink" style={{ background: k < i ? '#ffd23f' : '#e3dcff' }} />
              ))}
            </div>
            <span className="font-bold">{mode === 'due' ? 'גבישי הזיכרון של קוסמו' : 'מכונת הזיכרון של קוסמו'}</span>
          </div>
          <ChoiceQuestion
            question={q}
            phase={counts}
            askLine={
              mode === 'due'
                ? `🔮 גביש ${i + 1}: ראיתי את זה בדרך לחללית, אבל שכחתי איך קוראים לזה באנגלית! (${CATEGORY_HE[w.category]}.) תזכירו לי?`
                : q.showText
                  ? `מכונת הזיכרון צריכה ${w.english}. איפה זה?`
                  : 'הקשיבו למילה שהמכונה צריכה, ומצאו את התמונה!'
            }
            successLine={(_, withHelp) => (withHelp ? `נכון! ${w.english} — ${w.hebrew}. נמשיך לתרגל אותה.` : `נכון! ${w.english} — ${w.hebrew}. זכרתם בעצמכם!`)}
            makeEasier={easierVersion}
            onComplete={(r) => {
              const t = now();
              update((d) => {
                const out = recordDelayedReview(d, wordId, r.firstTryCorrect, r.anyHint, dueAtStart.has(wordId), t);
                // Reminding Kosmo with the new picture refreshes his memory too.
                return mode === 'due' ? kosmoLearns(out, wordId, q.picture ?? null, 'remind', t).data : out;
              });
              if (i + 1 >= words.length) setFinished(true);
              else {
                setI(i + 1);
                setQ(build(words[i + 1], i + 1));
              }
            }}
          />
        </div>
      </Page>
    </>
  );
}
