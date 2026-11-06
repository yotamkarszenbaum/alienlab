import type { QuestionDef, SaveData } from '../../engine/types';
import { buildPictureToWord, buildSentenceQuestion, buildWordToPicture, type QuestionInstance } from '../../engine/tasks';
import { audioOnlyFor, optionCountFor } from '../../engine/hints';
import { getWord } from '../../content/words';
import { SENTENCES_BY_ID } from '../../content/units';
import { introducedWords } from '../../engine/session';

/** Build a concrete question whose difficulty follows the child's record for that word. */
export function buildQuestion(def: QuestionDef, data: SaveData, englishAudioWorks: boolean): QuestionInstance {
  if (def.mode === 'sentence_to_picture') {
    return buildSentenceQuestion(SENTENCES_BY_ID[def.sentenceId!], { variant: data.attempts.length, taskId: def.id });
  }
  const word = getWord(def.wordId!);
  const wp = data.learning[word.id];
  const indep = wp?.independentCorrect ?? 0;
  const variant = wp?.attempts ?? 0;
  if (def.mode === 'picture_to_word') {
    return buildPictureToWord(word, introducedWords(data), { optionCount: optionCountFor(indep, 2, 3), variant, taskId: def.id });
  }
  return buildWordToPicture(word, {
    optionCount: optionCountFor(indep),
    audioOnly: audioOnlyFor(indep, englishAudioWorks),
    variant,
    taskId: def.id,
  });
}

/** Easier variant after a guided demonstration: two options, different pictures, easiest distractor. */
export function easierVersion(q: QuestionInstance): QuestionInstance | null {
  if (q.wordIds.length !== 1 || q.mode === 'sentence_to_picture' || q.mode === 'mission') return null;
  const word = getWord(q.wordIds[0]);
  const v = Number(q.key.split(':')[1] ?? 0) + 1;
  return buildWordToPicture(word, { optionCount: 2, audioOnly: false, variant: v, taskId: `${q.taskId}-easy`, easy: true });
}
