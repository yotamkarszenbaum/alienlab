import { useState } from 'react';
import type { ItemSpec, SaysRoundDef } from '../../engine/types';
import { buildSceneQuestion } from '../../engine/tasks';
import { audioOnlyFor } from '../../engine/hints';
import { getWord } from '../../content/words';
import { useGame } from '../../state/GameContext';
import { useSpeechStatus } from '../../audio/speech';
import { ChoiceQuestion } from './ChoiceQuestion';

// "Kosmo says" (ages 6–7): Kosmo calls out a word, the child finds it inside
// the lab scene. Same support ladder and data recording as every question.
export function SaysStep({ stepId, scene, rounds, onDone }: { stepId: string; scene: ItemSpec[]; rounds: SaysRoundDef[]; onDone: () => void }) {
  const { data } = useGame();
  const enStatus = useSpeechStatus('en');
  const [i, setI] = useState(0);
  const build = (k: number) => {
    const w = getWord(rounds[k].wordId);
    return buildSceneQuestion(w, scene, {
      taskId: `${stepId}:${rounds[k].id}`,
      audioOnly: audioOnlyFor(data.learning[w.id]?.independentCorrect ?? 0, enStatus !== 'unavailable'),
    });
  };
  const [q, setQ] = useState(() => build(0));
  const last = i + 1 >= rounds.length;
  return (
    <div className="flex flex-col gap-2" data-testid="says-step">
      <p className="text-center font-bold text-ink-soft" aria-live="polite">
        🎧 קוסמו אומר — סיבוב {i + 1} מתוך {rounds.length}
      </p>
      <ChoiceQuestion
        question={q}
        phase="learn"
        layout="scene"
        askLine={q.showText ? `קוסמו אומר: ${q.promptEn}! איפה זה בחדר?` : 'קוסמו אומר מילה — הקשיבו ומצאו אותה בחדר!'}
        successLine={(qq, withHelp) => (withHelp ? `מצאתם! ${qq.promptEn} — ${qq.promptHe}.` : `מעולה! ${qq.promptEn} — ${qq.promptHe}! מצאתם לבד.`)}
        continueLabel={last ? 'המשך' : 'לסיבוב הבא'}
        onComplete={() => {
          if (last) return onDone();
          setI(i + 1);
          setQ(build(i + 1));
        }}
      />
    </div>
  );
}
