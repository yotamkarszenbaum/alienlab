import type { Level, MissionDef, SentenceDef, StepDef, UnitDef } from '../engine/types';
import { inLevel, inRange } from './levels';
import { item } from './items';
import { WORDS_BY_ID } from './words';

// ---------------------------------------------------------------------------
// Units, step sequences, sentences and missions. All data-driven: the step
// runner reads these arrays and never hard-codes words.
// ---------------------------------------------------------------------------

function wordSteps(wordId: string, minLevel?: Level): StepDef[] {
  return [
    { id: `${wordId}-discover`, type: 'discover', wordId, minLevel },
    { id: `${wordId}-practice`, type: 'practice', questions: [{ id: `${wordId}-q1`, mode: 'word_to_picture', wordId }], minLevel },
  ];
}

export const UNITS: UnitDef[] = [
  {
    id: 'earth',
    order: 1,
    titleHe: 'דברים בכדור הארץ',
    subtitleHe: 'חפצים ובעלי חיים',
    icon: [item('apple', 'red'), item('ball', 'blue'), item('cat', 'orange')],
    accent: '#22b8a0',
    wordIds: ['apple', 'ball', 'cat', 'dog', 'car', 'cup'],
    unlocksUnitId: 'colors',
    steps: [
      ...wordSteps('apple'),
      ...wordSteps('ball'),
      ...wordSteps('cat'),
      ...wordSteps('dog'),
      ...wordSteps('car', 2),
      ...wordSteps('cup', 3),
      {
        id: 'earth-mix',
        type: 'practice',
        titleHe: 'סבב תרגול קצר',
        questions: [
          { id: 'earth-mix-1', mode: 'picture_to_word', wordId: 'cat' },
          { id: 'earth-mix-2', mode: 'word_to_picture', wordId: 'ball' },
          { id: 'earth-mix-3', mode: 'picture_to_word', wordId: 'apple' },
          { id: 'earth-mix-4', mode: 'picture_to_word', wordId: 'car', minLevel: 2 },
        ],
      },
      {
        id: 'earth-says',
        type: 'says',
        maxLevel: 1,
        scene: [item('apple', 'red'), item('ball', 'blue'), item('cat', 'orange'), item('dog', 'brown'), item('star', 'yellow')],
        rounds: [
          { id: 'r1', wordId: 'ball' },
          { id: 'r2', wordId: 'cat' },
          { id: 'r3', wordId: 'apple' },
          { id: 'r4', wordId: 'dog' },
        ],
      },
      { id: 'earth-spell', type: 'spell', wordIds: ['cat', 'dog', 'cup'], minLevel: 3 },
      { id: 'teach-dog', type: 'teach', conceptId: 'dog' },
      { id: 'play-supply', type: 'play', missionId: 'm-supply' },
      { id: 'earth-summary', type: 'summary' },
    ],
  },
  {
    id: 'colors',
    order: 2,
    titleHe: 'צבעים וגדלים',
    subtitleHe: 'אדום, כחול, צהוב וגדול',
    icon: [item('ball', 'red'), item('cup', 'blue'), item('star', 'yellow')],
    accent: '#7c5cff',
    wordIds: ['red', 'blue', 'yellow', 'big', 'green', 'small'],
    unlocksUnitId: 'lab',
    steps: [
      ...wordSteps('red'),
      ...wordSteps('blue'),
      ...wordSteps('yellow'),
      ...wordSteps('big'),
      ...wordSteps('green', 2),
      ...wordSteps('small', 3),
      {
        id: 'colors-mix',
        type: 'practice',
        titleHe: 'סבב תרגול קצר',
        questions: [
          { id: 'colors-mix-1', mode: 'word_to_picture', wordId: 'yellow' },
          { id: 'colors-mix-2', mode: 'picture_to_word', wordId: 'red' },
          { id: 'colors-mix-3', mode: 'picture_to_word', wordId: 'blue' },
          { id: 'colors-mix-4', mode: 'word_to_picture', wordId: 'green', minLevel: 2 },
          { id: 'colors-mix-5', mode: 'picture_to_word', wordId: 'small', minLevel: 3 },
        ],
      },
      {
        id: 'colors-says',
        type: 'says',
        maxLevel: 1,
        scene: [item('car', 'blue'), item('apple', 'red'), item('star', 'yellow'), item('dog', 'brown', 'big'), item('cup', 'green')],
        rounds: [
          { id: 'r1', wordId: 'red' },
          { id: 'r2', wordId: 'big' },
          { id: 'r3', wordId: 'yellow' },
          { id: 'r4', wordId: 'blue' },
        ],
      },
      {
        id: 'colors-build',
        type: 'build',
        minLevel: 2,
        sentences: [
          { id: 'b1', tokens: ['RED', 'BALL'], extraTokens: ['BLUE'], hebrew: 'כדור אדום', wordIds: ['red', 'ball'], picture: item('ball', 'red'), tipHe: 'באנגלית הצבע בא לפני הדבר: קודם "אדום", ואחר כך "כדור".' },
          { id: 'b2', tokens: ['BIG', 'DOG'], extraTokens: ['CAT'], hebrew: 'כלב גדול', wordIds: ['big', 'dog'], picture: item('dog', 'brown', 'big'), tipHe: 'באנגלית הגודל בא לפני הדבר: קודם "גדול", ואחר כך "כלב".' },
          { id: 'b3', tokens: ['GREEN', 'CAR'], extraTokens: ['YELLOW'], hebrew: 'מכונית ירוקה', wordIds: ['green', 'car'], picture: item('car', 'green'), tipHe: 'באנגלית הצבע בא לפני הדבר: קודם "ירוקה", ואחר כך "מכונית".' },
          { id: 'b4', minLevel: 3, tokens: ['SMALL', 'YELLOW', 'CUP'], extraTokens: ['BIG'], hebrew: 'כוס צהובה קטנה', wordIds: ['small', 'yellow', 'cup'], picture: item('cup', 'yellow', 'small'), tipHe: 'באנגלית קודם הגודל, אחר כך הצבע, ובסוף הדבר: קטנה ← צהובה ← כוס.' },
        ],
      },
      { id: 'colors-spell', type: 'spell', wordIds: ['red', 'big', 'blue'], minLevel: 3 },
      { id: 'teach-red', type: 'teach', conceptId: 'red' },
      { id: 'teach-big', type: 'teach', conceptId: 'big' },
      { id: 'teach-green', type: 'teach', conceptId: 'green', minLevel: 2 },
      { id: 'play-colors', type: 'play', missionId: 'm-colors' },
      { id: 'colors-summary', type: 'summary' },
    ],
  },
  {
    id: 'lab',
    order: 3,
    titleHe: 'המעבדה נפתחת',
    subtitleHe: 'מפתח, דלת, לפתוח ולסגור',
    icon: [item('key', 'yellow'), item('door', 'purple', 'normal', 'closed')],
    accent: '#ff8a3d',
    wordIds: ['key', 'door', 'open', 'close', 'box', 'star'],
    steps: [
      ...wordSteps('key'),
      ...wordSteps('door'),
      ...wordSteps('open'),
      ...wordSteps('close'),
      ...wordSteps('box', 2),
      ...wordSteps('star', 3),
      {
        id: 'sentence-open-door',
        type: 'sentence',
        sentenceId: 'open-the-door',
        questions: [
          { id: 'sentence-q1', mode: 'sentence_to_picture', sentenceId: 'close-the-door' },
          { id: 'sentence-q2', mode: 'sentence_to_picture', sentenceId: 'open-the-door' },
        ],
      },
      {
        id: 'lab-says',
        type: 'says',
        maxLevel: 1,
        scene: [item('key', 'yellow'), item('door', 'brown', 'normal', 'closed'), item('box', 'red', 'normal', 'open'), item('cup', 'blue'), item('star', 'yellow')],
        rounds: [
          { id: 'r1', wordId: 'key' },
          { id: 'r2', wordId: 'open' },
          { id: 'r3', wordId: 'door' },
          { id: 'r4', wordId: 'close' },
        ],
      },
      {
        id: 'lab-build',
        type: 'build',
        minLevel: 2,
        sentences: [
          { id: 'b1', tokens: ['OPEN', 'THE', 'DOOR'], extraTokens: ['CLOSE'], hebrew: 'פתח את הדלת', wordIds: ['open', 'door'], picture: item('door', 'brown', 'normal', 'open'), tipHe: 'קודם הפעולה (לפתוח), אחר כך THE, ובסוף הדבר (דלת).' },
          { id: 'b2', tokens: ['CLOSE', 'THE', 'BOX'], extraTokens: ['OPEN'], hebrew: 'סגור את הקופסה', wordIds: ['close', 'box'], picture: item('box', 'blue', 'normal', 'closed'), tipHe: 'קודם הפעולה (לסגור), אחר כך THE, ובסוף הדבר (קופסה).' },
          { id: 'b3', minLevel: 3, tokens: ['OPEN', 'THE', 'RED', 'BOX'], extraTokens: ['DOOR'], hebrew: 'פתח את הקופסה האדומה', wordIds: ['open', 'red', 'box'], picture: item('box', 'red', 'normal', 'open'), tipHe: 'פעולה ← THE ← צבע ← דבר. באנגלית הצבע בא לפני הקופסה.' },
        ],
      },
      { id: 'lab-spell', type: 'spell', wordIds: ['key', 'door', 'star'], minLevel: 3 },
      { id: 'teach-open', type: 'teach', conceptId: 'open' },
      { id: 'teach-close', type: 'teach', conceptId: 'close', minLevel: 2 },
      { id: 'play-door', type: 'play', missionId: 'm-door' },
      { id: 'lab-summary', type: 'summary' },
    ],
  },
];

export const SENTENCES: SentenceDef[] = [
  {
    id: 'open-the-door',
    english: 'OPEN THE DOOR',
    hebrew: 'פתח את הדלת',
    wordIds: ['open', 'door'],
    parts: [
      { en: 'OPEN', he: 'לפתוח' },
      { en: 'THE', he: 'את ה...' },
      { en: 'DOOR', he: 'דלת' },
    ],
    before: item('door', 'brown', 'normal', 'closed'),
    answer: item('door', 'brown', 'normal', 'open'),
    distractors: [item('door', 'brown', 'normal', 'closed'), item('box', 'brown', 'normal', 'open')],
  },
  {
    id: 'close-the-door',
    english: 'CLOSE THE DOOR',
    hebrew: 'סגור את הדלת',
    wordIds: ['close', 'door'],
    parts: [
      { en: 'CLOSE', he: 'לסגור' },
      { en: 'THE', he: 'את ה...' },
      { en: 'DOOR', he: 'דלת' },
    ],
    before: item('door', 'blue', 'normal', 'open'),
    answer: item('door', 'blue', 'normal', 'closed'),
    distractors: [item('door', 'blue', 'normal', 'open'), item('box', 'blue', 'normal', 'closed')],
  },
];

export const MISSIONS: MissionDef[] = [
  {
    id: 'm-supply',
    unitId: 'earth',
    titleHe: 'משלוח לחללית',
    introHe: 'החללית שלי צריכה כמה דברים מכדור הארץ. תעזרו לי לאסוף אותם?',
    scene: 'supply',
    requiredAbility: 'find-dogs',
    rewardHe: 'ארגז האספקה של החללית מלא!',
    rewardId: 'supply-crate',
    steps: [
      {
        id: 's1',
        promptEn: 'BALL',
        promptHe: 'כדור',
        wordIds: ['ball'],
        answer: item('ball', 'yellow'),
        distractors: [item('cat', 'gray'), item('apple', 'green'), item('dog', 'brown')],
        effect: { type: 'collect' },
        doneHe: 'BALL! כדור! אני שם אותו בארגז.',
      },
      {
        id: 's2',
        promptEn: 'APPLE',
        promptHe: 'תפוח',
        wordIds: ['apple'],
        answer: item('apple', 'green'),
        distractors: [item('ball', 'purple'), item('cat', 'black'), item('dog', 'white')],
        effect: { type: 'collect' },
        doneHe: 'APPLE! תפוח ירוק לארוחת הערב שלי.',
      },
      {
        id: 's3',
        promptEn: 'CAT',
        promptHe: 'חתול',
        wordIds: ['cat'],
        answer: item('cat', 'gray'),
        distractors: [item('dog', 'white'), item('ball', 'red'), item('apple', 'yellow')],
        effect: { type: 'collect' },
        doneHe: 'CAT! החתול רוצה לטוס איתי לחלל.',
      },
      {
        id: 's4',
        promptEn: 'DOG',
        promptHe: 'כלב',
        wordIds: ['dog'],
        answer: item('dog', 'black'),
        distractors: [item('cat', 'orange'), item('ball', 'blue'), item('apple', 'red')],
        effect: { type: 'collect' },
        doneHe: 'DOG! גם הכלב מצטרף. הב הב!',
      },
      {
        id: 's5',
        minLevel: 2,
        promptEn: 'CAR',
        promptHe: 'מכונית',
        wordIds: ['car'],
        answer: item('car', 'yellow'),
        distractors: [item('ball', 'yellow'), item('cat', 'orange'), item('cup', 'blue')],
        effect: { type: 'collect' },
        doneHe: 'CAR! מכונית קטנה לנסוע בה על הירח.',
      },
      {
        id: 's6',
        minLevel: 3,
        promptEn: 'CUP',
        promptHe: 'כוס',
        wordIds: ['cup'],
        answer: item('cup', 'green'),
        distractors: [item('apple', 'green'), item('ball', 'green'), item('car', 'green')],
        effect: { type: 'collect' },
        doneHe: 'CUP! עכשיו יש לי ממה לשתות בחלל.',
      },
    ],
  },
  {
    id: 'm-colors',
    unitId: 'colors',
    titleHe: 'מכונת הצבעים',
    introHe: 'מכונת הצבעים שלי צריכה דברים מיוחדים. אני כבר יודע לחפש לפי צבע — תגידו לי מה לקחת!',
    scene: 'colors',
    requiredAbility: 'sort-colors',
    rewardHe: 'מכונת הצבעים עובדת!',
    rewardId: 'color-machine',
    steps: [
      {
        id: 'c1',
        promptEn: 'RED APPLE',
        promptHe: 'תפוח אדום',
        wordIds: ['red', 'apple'],
        answer: item('apple', 'red'),
        distractors: [item('apple', 'green'), item('ball', 'red'), item('apple', 'yellow')],
        effect: { type: 'collect' },
        doneHe: 'RED APPLE — תפוח אדום! נכנס למכונה.',
      },
      {
        id: 'c2',
        promptEn: 'BLUE BALL',
        promptHe: 'כדור כחול',
        wordIds: ['blue', 'ball'],
        answer: item('ball', 'blue'),
        distractors: [item('ball', 'red'), item('cup', 'blue'), item('ball', 'yellow')],
        effect: { type: 'collect' },
        doneHe: 'BLUE BALL — כדור כחול! המכונה מזמזמת.',
      },
      {
        id: 'c3',
        promptEn: 'BIG DOG',
        promptHe: 'כלב גדול',
        wordIds: ['big', 'dog'],
        answer: item('dog', 'brown', 'big'),
        distractors: [item('dog', 'brown', 'small'), item('cat', 'orange', 'big'), item('cat', 'gray', 'small')],
        effect: { type: 'collect' },
        doneHe: 'BIG DOG — כלב גדול! הוא בקושי נכנס.',
      },
      {
        id: 'c5',
        minLevel: 2,
        promptEn: 'GREEN CAR',
        promptHe: 'מכונית ירוקה',
        wordIds: ['green', 'car'],
        answer: item('car', 'green'),
        distractors: [item('car', 'red'), item('ball', 'green'), item('car', 'yellow')],
        effect: { type: 'collect' },
        doneHe: 'GREEN CAR — מכונית ירוקה! המכונה אוהבת ירוק.',
      },
      {
        id: 'c6',
        minLevel: 3,
        promptEn: 'SMALL DOG',
        promptHe: 'כלב קטן',
        wordIds: ['small', 'dog'],
        answer: item('dog', 'brown', 'small'),
        distractors: [item('dog', 'brown', 'big'), item('cat', 'gray', 'small'), item('dog', 'white', 'big')],
        effect: { type: 'collect' },
        doneHe: 'SMALL DOG — כלב קטן! הוא נכנס בקלות.',
      },
      {
        id: 'c4',
        promptEn: 'BIG YELLOW BALL',
        promptHe: 'כדור צהוב גדול',
        wordIds: ['big', 'yellow', 'ball'],
        answer: item('ball', 'yellow', 'big'),
        distractors: [item('ball', 'yellow', 'small'), item('ball', 'blue', 'big'), item('star', 'yellow', 'big')],
        effect: { type: 'collect' },
        doneHe: 'BIG YELLOW BALL! המכונה נדלקת!',
      },
    ],
  },
  {
    id: 'm-door',
    unitId: 'lab',
    titleHe: 'הדלת הנעולה',
    introHe: 'הדלת לחדר הבקרה של המעבדה נעולה. אני יודע לפתוח דברים, אבל צריך שתגידו לי מה לעשות!',
    scene: 'door',
    requiredAbility: 'open-things',
    rewardHe: 'חדר הבקרה של המעבדה נפתח!',
    rewardId: 'control-room',
    steps: [
      {
        id: 'd1',
        promptEn: 'KEY',
        promptHe: 'מפתח',
        wordIds: ['key'],
        answer: item('key', 'yellow'),
        distractors: [item('star', 'yellow'), item('cup', 'red'), item('ball', 'blue')],
        effect: { type: 'collect' },
        doneHe: 'KEY — מפתח! עכשיו אפשר לפתוח את המנעול.',
      },
      {
        id: 'd2',
        promptEn: 'OPEN THE DOOR',
        promptHe: 'פתח את הדלת',
        wordIds: ['open', 'door'],
        answer: item('door', 'brown', 'normal', 'open'),
        distractors: [item('door', 'brown', 'normal', 'closed'), item('box', 'brown', 'normal', 'open')],
        effect: { type: 'state', target: 'door', state: 'open' },
        doneHe: 'OPEN THE DOOR — אני פותח את הדלת! קליק!',
      },
      {
        id: 'd3',
        promptEn: 'RED BALL',
        promptHe: 'כדור אדום',
        wordIds: ['red', 'ball'],
        answer: item('ball', 'red'),
        distractors: [item('ball', 'blue'), item('apple', 'red'), item('ball', 'yellow')],
        effect: { type: 'collect' },
        doneHe: 'RED BALL — מצאתי כדור אדום בחדר!',
      },
      {
        id: 'd4',
        promptEn: 'BIG CAT',
        promptHe: 'חתול גדול',
        wordIds: ['big', 'cat'],
        answer: item('cat', 'gray', 'big'),
        distractors: [item('cat', 'gray', 'small'), item('dog', 'brown', 'big'), item('cat', 'orange', 'small')],
        effect: { type: 'collect' },
        doneHe: 'BIG CAT — חתול גדול! הוא שומר על חדר הבקרה.',
      },
      {
        id: 'd6',
        minLevel: 2,
        promptEn: 'BLUE BOX',
        promptHe: 'קופסה כחולה',
        wordIds: ['blue', 'box'],
        answer: item('box', 'blue', 'normal', 'closed'),
        distractors: [item('box', 'red', 'normal', 'closed'), item('door', 'blue', 'normal', 'closed'), item('cup', 'blue')],
        effect: { type: 'collect' },
        doneHe: 'BLUE BOX — קופסה כחולה! יש בה כלים למעבדה.',
      },
      {
        id: 'd7',
        minLevel: 3,
        promptEn: 'YELLOW STAR',
        promptHe: 'כוכב צהוב',
        wordIds: ['yellow', 'star'],
        answer: item('star', 'yellow'),
        distractors: [item('star', 'purple'), item('ball', 'yellow'), item('key', 'yellow')],
        effect: { type: 'collect' },
        doneHe: 'YELLOW STAR — כוכב צהוב! הוא מאיר את חדר הבקרה.',
      },
      {
        id: 'd5',
        promptEn: 'CLOSE THE DOOR',
        promptHe: 'סגור את הדלת',
        wordIds: ['close', 'door'],
        answer: item('door', 'brown', 'normal', 'closed'),
        distractors: [item('door', 'brown', 'normal', 'open'), item('box', 'brown', 'normal', 'closed')],
        effect: { type: 'state', target: 'door', state: 'closed' },
        doneHe: 'CLOSE THE DOOR — סוגרים את הדלת מאחורינו. אנחנו בחדר הבקרה!',
      },
    ],
  },
];

export const UNITS_BY_ID: Record<string, UnitDef> = Object.fromEntries(UNITS.map((u) => [u.id, u]));
export const MISSIONS_BY_ID: Record<string, MissionDef> = Object.fromEntries(MISSIONS.map((m) => [m.id, m]));
export const SENTENCES_BY_ID: Record<string, SentenceDef> = Object.fromEntries(SENTENCES.map((s) => [s.id, s]));

export const FIRST_UNIT_ID = UNITS[0].id;

/** Steps of a unit that are part of the given level. */
export function stepsFor(unit: UnitDef, level: Level | null | undefined): StepDef[] {
  return unit.steps.filter((s) => inRange(s.minLevel, s.maxLevel, level));
}

export function unitWordIds(unit: UnitDef, level: Level | null | undefined): string[] {
  return unit.wordIds.filter((id) => inLevel(WORDS_BY_ID[id]?.minLevel, level));
}

export const REWARD_LABELS: Record<string, string> = Object.fromEntries(MISSIONS.map((m) => [m.rewardId, m.rewardHe]));
