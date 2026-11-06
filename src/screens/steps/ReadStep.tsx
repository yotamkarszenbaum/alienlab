import { useState } from 'react';
import type { ReadQuestionDef } from '../../engine/types';
import { buildReadQuestion } from '../../engine/tasks';
import { ChoiceQuestion } from './ChoiceQuestion';

// Reading (level 3, ages 10–12): a short message in English. The child
// answers Hebrew questions about it by choosing pictures. The first hint
// highlights the sentence that holds the answer (and can read it aloud).

function MessageCard({ titleHe, lines, highlight }: { titleHe: string; lines: string[]; highlight: number | null }) {
  return (
    <div className="card p-4 sm:p-5 bg-[#fffdf3]" data-testid="read-text">
      <p className="font-extrabold text-lg mb-2">📡 {titleHe}</p>
      <div dir="ltr" lang="en" className="flex flex-col gap-1.5 text-start">
        {lines.map((l, i) => (
          <p
            key={i}
            data-line={i}
            data-highlight={highlight === i ? 'true' : 'false'}
            className={`en text-[clamp(1.05rem,3.6vw,1.4rem)] leading-snug rounded-xl px-2 py-1 transition ${highlight === i ? 'bg-sun/70 ring-2 ring-sun-dark' : ''}`}
          >
            {l}
          </p>
        ))}
      </div>
    </div>
  );
}

export function ReadStep({ stepId, titleHe, lines, questions, onDone }: { stepId: string; titleHe: string; lines: string[]; questions: ReadQuestionDef[]; onDone: () => void }) {
  const [i, setI] = useState(0);
  const build = (k: number) => buildReadQuestion(questions[k], lines, { taskId: `${stepId}:${questions[k].id}`, variant: k });
  const [q, setQ] = useState(() => build(0));
  const last = i + 1 >= questions.length;
  return (
    <div className="flex flex-col gap-2" data-testid="read-step">
      <p className="text-center font-bold text-ink-soft" aria-live="polite">
        📖 קוראים הודעה — שאלה {i + 1} מתוך {questions.length}
      </p>
      <ChoiceQuestion
        question={q}
        phase="learn"
        askLine={i === 0 ? 'הגיעה הודעה באנגלית מהמפקד! קראו אותה, ועזרו לי להבין: ' + questions[0].promptHe : questions[i].promptHe}
        header={(level) => <MessageCard titleHe={titleHe} lines={lines} highlight={level >= 1 ? questions[i].line : null} />}
        successLine={(_, withHelp) => (withHelp ? 'נכון! מצאתם את זה בהודעה בעזרת רמז.' : 'נכון! קראתם והבנתם לבד — כל הכבוד!')}
        continueLabel={last ? 'המשך' : 'לשאלה הבאה'}
        onComplete={() => {
          if (last) return onDone();
          setI(i + 1);
          setQ(build(i + 1));
        }}
      />
    </div>
  );
}
