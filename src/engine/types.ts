// ---------------------------------------------------------------------------
// Shared types for AlienLab. Content (words, units, missions) and state
// (learning progress, alien knowledge, game progress) are kept separate.
// ---------------------------------------------------------------------------

/** Visual feature dimensions that every item in the game is described by. */
export type Dim = 'kind' | 'color' | 'size' | 'state' | 'count' | 'pos';

export interface Feature {
  dim: Dim;
  value: string;
}

export type Kind = 'apple' | 'ball' | 'cat' | 'dog' | 'car' | 'star' | 'cup' | 'box' | 'door' | 'key' | 'hat' | 'table';

/** Where an item is relative to another object (IN / ON / UNDER). */
export type Pos = 'in' | 'on' | 'under';
export type ColorName =
  | 'red'
  | 'blue'
  | 'yellow'
  | 'green'
  | 'orange'
  | 'purple'
  | 'brown'
  | 'white'
  | 'gray'
  | 'black';
export type Size = 'small' | 'normal' | 'big';

/** Difficulty level, chosen by age range (6–7 / 8–9 / 10–12) — never by exact age. */
export type Level = 1 | 2 | 3;
export type ItemState = 'none' | 'open' | 'closed';

/** A concrete picture in the game, e.g. a big blue ball or an open brown door. */
export interface ItemSpec {
  kind: Kind;
  color: ColorName;
  size: Size;
  state: ItemState;
  /** How many copies are shown (TWO / THREE). Missing = one. */
  count?: 2 | 3;
  /** The item is IN / ON / UNDER a reference object (a table or a box). */
  rel?: { pos: Pos; ref: Kind };
}

// ------------------------------- Content ----------------------------------

export type WordCategory = 'object' | 'animal' | 'color' | 'size' | 'action' | 'number' | 'place';

export type TaskType =
  | 'picture_to_word' // 1. identify the word from a picture
  | 'word_to_picture' // 2. choose the picture for a (heard / shown) word
  | 'teach_example' // 3. choose an example to teach the alien
  | 'check_alien' // 4. check the alien's decision
  | 'repair_example' // 5. choose a corrective example
  | 'mission' // 6. complete a mission combining learned words
  | 'spell_word' // 7. build the English word from letter tiles (production, levels 2–3)
  | 'build_sentence' // 8. build an English phrase from word chips (levels 2–3)
  | 'fill_blank' // 9. complete a sentence from a word bank (levels 2–3)
  | 'read' // 10. read a short message and answer with pictures (level 3)
  | 'fix_kosmo'; // 11. catch and fix Kosmo's mistake in an English sentence (levels 2–3)

export type DiscoverVisual =
  | { type: 'single'; item: ItemSpec }
  | { type: 'set'; items: ItemSpec[] }
  | { type: 'compare'; target: ItemSpec; contrast: ItemSpec; targetLabelHe?: string; contrastLabelHe?: string }
  | { type: 'transition'; from: ItemSpec; to: ItemSpec };

export interface TeachConfig {
  /** Items offered on the "teach the alien" screen. */
  pool: ItemSpec[];
  /** Items the test / repair scenes are built from. */
  testPool: ItemSpec[];
  /** Ability the alien gains once it truly understands the concept. */
  ability: { id: string; labelHe: string; icon: string };
  /** e.g. "הצבע האדום" — used in the alien's "aha" sentence. */
  meaningHe: string;
  /** What kind of concept this is, in kid words: "צבע", "גודל", "סוג של חיה". */
  dimLabelHe: string;
}

export interface WordDef {
  id: string;
  english: string;
  hebrew: string;
  /** First difficulty level that includes this word (default 1 = everyone). */
  minLevel?: Level;
  /** Hebrew transliteration of the English pronunciation (audio fallback). */
  sayItHe: string;
  category: WordCategory;
  unitId: string;
  /** What the word means in the game's feature space. */
  target: Feature;
  illustration: DiscoverVisual;
  /** Optional recorded audio file. None ship in v1 (Web Speech API is used). */
  audio?: string;
  /** Pictures that ARE this word (varied visuals). */
  positiveExamples: ItemSpec[];
  /** Pictures that are NOT this word (distractors). */
  negativeExamples: ItemSpec[];
  practiceTypes: TaskType[];
  missionIds: string[];
  /** Short explanation shown/read on the first hint, e.g. "APPLE זה תפוח". */
  explainHe: string;
  /** Discover screen line of the alien. */
  discoverLineHe: string;
  teach?: TeachConfig;
  /** Levels 2–3: the new word in a short sentence made of words the child already knows. */
  example?: { en: string; he: string; picture: ItemSpec };
  /** Levels 2–3 spelling: how Kosmo writes the word "by its sound" (a typical Hebrew-speaker spelling mistake). */
  kosmoSpelling?: string;
  /**
   * The look-alike word Kosmo confuses this word with until the child teaches him (e.g. CAT ↔ DOG, ON ↔ UNDER).
   * Missing = no natural look-alike: Kosmo asks the child instead.
   */
  kosmoMixesUp?: string;
}

export interface SentenceDef {
  id: string;
  english: string;
  hebrew: string;
  wordIds: string[];
  parts: { en: string; he: string }[];
  before: ItemSpec;
  answer: ItemSpec;
  distractors: ItemSpec[];
}

export interface QuestionDef {
  id: string;
  minLevel?: Level;
  mode: 'word_to_picture' | 'picture_to_word' | 'sentence_to_picture';
  wordId?: string;
  sentenceId?: string;
}

/** "Kosmo says": one round = a word to find inside the shared scene. */
export interface SaysRoundDef {
  id: string;
  wordId: string;
}

/** Sentence building: tap word chips in English order. */
export interface BuildDef {
  id: string;
  minLevel?: Level;
  tokens: string[];
  extraTokens: string[];
  hebrew: string;
  wordIds: string[];
  picture: ItemSpec;
  /** Short grammar tip shown as the first hint, e.g. "באנגלית הצבע בא לפני הדבר". */
  tipHe: string;
}

/** Complete the sentence: "I SEE A ___." with a bank of 2–3 chips. */
export interface MixupRoundDef {
  id: string;
  minLevel?: Level;
  maxLevel?: Level;
  /** What the picture shows (for an action: the end state). */
  picture: ItemSpec;
  /** For an action (OPEN / CLOSE): the state before, shown with an arrow. */
  pictureFrom?: ItemSpec;
  /** The CORRECT sentence, word by word. */
  tokens: string[];
  /** Index of the word Kosmo has to get right. What he says there comes from his knowledge. */
  focusAt: number;
  /** Game word id (or grammar pseudo-word such as 'are') behind tokens[focusAt]. */
  focus: string;
  /** Choices for that place (including the right word); every other choice does not fit. */
  choices: string[];
  /** Hebrew of the correct sentence. */
  hebrew: string;
  /** What to look at — the first hint. */
  tipHe: string;
  /** Game words of this unit whose learning data the round records. */
  wordIds: string[];
}

export interface FillDef {
  id: string;
  minLevel?: Level;
  before: string;
  after: string;
  answer: string;
  bank: string[];
  hebrew: string;
  picture: ItemSpec;
  /** Words whose knowledge this sentence shows (empty for grammar-only items like IS / ARE). */
  wordIds: string[];
  tipHe: string;
}

export interface ReadQuestionDef {
  id: string;
  promptHe: string;
  /** Index of the line in the text that answers the question. */
  line: number;
  answer: ItemSpec;
  distractors: ItemSpec[];
  wordIds: string[];
}

export type StepDef = { minLevel?: Level; maxLevel?: Level } & (
  | { id: string; type: 'discover'; wordId: string }
  | { id: string; type: 'says'; scene: ItemSpec[]; rounds: SaysRoundDef[] }
  /**
   * Levels 2–3: "Kosmo gets confused" — Kosmo describes a picture in English and sometimes gets a word wrong;
   * the child judges, finds the wrong word and fixes it. With `opening`, it opens the station and checks the
   * basic words: words the child already knows skip their introduction.
   */
  | { id: string; type: 'mixup'; opening?: boolean; rounds: MixupRoundDef[] }
  | { id: string; type: 'build'; sentences: BuildDef[] }
  | { id: string; type: 'practice'; questions: QuestionDef[]; titleHe?: string }
  | { id: string; type: 'sentence'; sentenceId: string; questions: QuestionDef[] }
  | { id: string; type: 'spell'; wordIds: string[]; /** harder words for level 3 */ wordIdsL3?: string[] }
  | { id: string; type: 'fill'; sentences: FillDef[] }
  | { id: string; type: 'read'; titleHe: string; lines: string[]; questions: ReadQuestionDef[] }
  | { id: string; type: 'teach'; conceptId: string }
  | { id: string; type: 'play'; missionId: string }
  | { id: string; type: 'summary' }
);

export interface UnitDef {
  id: string;
  order: number;
  titleHe: string;
  subtitleHe: string;
  icon: ItemSpec[];
  accent: string;
  wordIds: string[];
  steps: StepDef[];
  unlocksUnitId?: string;
}

export type SceneEffect =
  | { type: 'collect' }
  | { type: 'state'; target: 'door' | 'box'; state: 'open' | 'closed' };

export interface MissionStepDef {
  id: string;
  minLevel?: Level;
  promptEn: string;
  promptHe: string;
  wordIds: string[];
  answer: ItemSpec;
  distractors: ItemSpec[];
  effect: SceneEffect;
  /** What the alien says after the child picks correctly. */
  doneHe: string;
}

export interface MissionDef {
  id: string;
  unitId: string;
  titleHe: string;
  introHe: string;
  scene: 'supply' | 'colors' | 'door';
  /** Alien ability that must exist before the mission can run. */
  requiredAbility?: string;
  steps: MissionStepDef[];
  rewardHe: string;
  rewardId: string;
}

// ------------------------------- Support ----------------------------------

/** 'shown_by_kosmo': Kosmo showed an answer and the child only confirmed it — counts as success with support. */
export type HintType = 'verbal' | 'reduce' | 'highlight' | 'demo' | 'shown_by_kosmo';

// ------------------------------ Learning ----------------------------------

export type LearningLevel =
  | 'not_introduced'
  | 'introduced'
  | 'practicing'
  | 'recognized_with_help'
  | 'recognized_independently'
  | 'applied_in_context'
  | 'reviewed_later';

export type AttemptOutcome = 'correct' | 'wrong' | 'not_helpful';

export interface AttemptRecord {
  id: string;
  at: number;
  wordId: string;
  taskId: string;
  taskType: TaskType | 'review';
  outcome: AttemptOutcome;
  correct: boolean;
  /** 1 = first try on this question, 2 = second try ... */
  attemptNumber: number;
  hintUsed: boolean;
  hintTypes: HintType[];
  /** Correct on the first try with no hint of any kind. */
  independent: boolean;
  /** The question was finished (answered correctly) with this attempt. */
  completed: boolean;
  phase: 'learn' | 'review';
  /** 'new' = the word was used in a new context (mission, alien test, review). */
  context: 'intro' | 'new';
}

export interface DelayedReview {
  at: number;
  result: 'independent' | 'with_help' | 'wrong';
}

export interface WordProgress {
  introduced: boolean;
  introducedAt?: number;
  attempts: number;
  independentCorrect: number;
  hintedCorrect: number;
  wrong: number;
  notHelpful: number;
  contextIndependent: number;
  lastPracticedAt?: number;
  nextReviewAt?: number;
  delayedReviews: DelayedReview[];
  /** Last results, newest last: i = independent, h = with help, w = wrong. */
  recent: ('i' | 'h' | 'w')[];
  /** Production (spelling the word from letters) — tracked apart from recognition. */
  spellIndependent: number;
  spellWithHelp: number;
  spellWrong: number;
}

// ---------------------------- Alien knowledge ------------------------------

export type Understanding = 'unknown' | 'heard' | 'misconception' | 'partial' | 'understood';

export interface ConceptKnowledge {
  conceptId: string;
  heard: boolean;
  /** Item ids the child showed and the alien learned from. */
  examples: string[];
  /** Item ids the child offered that do not show the concept (not learned). */
  rejected: string[];
  /** Item ids the child marked as "this is NOT the word" (counter-examples, level 3). */
  negatives: string[];
  /** Wrong hypotheses the alien held, in order. */
  misconceptions: { feature: Feature; at: number }[];
  /** Examples that changed the alien's mind. */
  corrections: { itemId: string; at: number; before: Feature | null; after: Feature | null }[];
  tests: { at: number; scene: string[]; choice: string | null; alienCorrect: boolean }[];
  understoodAt?: number;
}

/** How the child taught Kosmo a word. */
export type KosmoSource = 'teach' | 'show' | 'fix' | 'remind';

/** Kosmo's memory of a word: who taught it and how he used it since (what he knows lives in `concepts`). */
export interface KosmoWord {
  first: KosmoSource;
  firstAt: number;
  lastAt: number;
  /** Times the child showed / corrected / reminded Kosmo. */
  shown: number;
  fixed: number;
  reminded: number;
  /** Times Kosmo then used the word right by himself. */
  usedRight: number;
  /** Grammar pseudo-words (e.g. ARE) have no picture meaning: Kosmo simply knows them or not. */
  knows?: boolean;
}

export interface AlienKnowledge {
  concepts: Record<string, ConceptKnowledge>;
  abilities: string[];
  /** Kosmo's word memory, built only by the child's teaching. */
  lexicon: Record<string, KosmoWord>;
}

// ----------------------------- Game progress ------------------------------

export interface TeachStepState {
  phase: 'teach' | 'test' | 'repair' | 'done';
  tests: number;
  repairs: number;
}

export interface GameProgress {
  introSeen: boolean;
  /** Chosen difficulty level; null until the player picks one. */
  level: Level | null;
  currentUnitId: string | null;
  /** Ids of finished steps per unit. The current step = first visible step not done
   *  (robust when the level changes and steps are added or hidden). */
  doneSteps: Record<string, string[]>;
  teachState: Record<string, TeachStepState>;
  completedUnits: string[];
  unlockedUnits: string[];
  completedMissions: string[];
  /** Things the alien obtained in missions. */
  inventory: string[];
  activities: number;
  startedAt?: number;
  lastPlayedAt?: number;
}

export interface Settings {
  music: boolean;
  sfx: boolean;
  readAloudHe: boolean;
  reducedMotion: boolean;
  /** Developer testing tool: simulated time offset in ms (clearly labelled in UI). */
  devTimeOffsetMs: number;
}

export interface SaveData {
  version: number;
  createdAt: number;
  learning: Record<string, WordProgress>;
  attempts: AttemptRecord[];
  alien: AlienKnowledge;
  game: GameProgress;
  settings: Settings;
}
