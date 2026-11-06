// ---------------------------------------------------------------------------
// Shared types for AlienLab. Content (words, units, missions) and state
// (learning progress, alien knowledge, game progress) are kept separate.
// ---------------------------------------------------------------------------

/** Visual feature dimensions that every item in the game is described by. */
export type Dim = 'kind' | 'color' | 'size' | 'state';

export interface Feature {
  dim: Dim;
  value: string;
}

export type Kind = 'apple' | 'ball' | 'cat' | 'dog' | 'car' | 'star' | 'cup' | 'box' | 'door' | 'key';
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
export type ItemState = 'none' | 'open' | 'closed';

/** A concrete picture in the game, e.g. a big blue ball or an open brown door. */
export interface ItemSpec {
  kind: Kind;
  color: ColorName;
  size: Size;
  state: ItemState;
}

// ------------------------------- Content ----------------------------------

export type WordCategory = 'object' | 'animal' | 'color' | 'size' | 'action';

export type TaskType =
  | 'picture_to_word' // 1. identify the word from a picture
  | 'word_to_picture' // 2. choose the picture for a (heard / shown) word
  | 'teach_example' // 3. choose an example to teach the alien
  | 'check_alien' // 4. check the alien's decision
  | 'repair_example' // 5. choose a corrective example
  | 'mission'; // 6. complete a mission combining learned words

export type DiscoverVisual =
  | { type: 'single'; item: ItemSpec }
  | { type: 'set'; items: ItemSpec[] }
  | { type: 'compare'; target: ItemSpec; contrast: ItemSpec }
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
  mode: 'word_to_picture' | 'picture_to_word' | 'sentence_to_picture';
  wordId?: string;
  sentenceId?: string;
}

export type StepDef =
  | { id: string; type: 'discover'; wordId: string }
  | { id: string; type: 'practice'; questions: QuestionDef[]; titleHe?: string }
  | { id: string; type: 'sentence'; sentenceId: string; questions: QuestionDef[] }
  | { id: string; type: 'teach'; conceptId: string }
  | { id: string; type: 'play'; missionId: string }
  | { id: string; type: 'summary' };

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

export type HintType = 'verbal' | 'reduce' | 'highlight' | 'demo';

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
  /** Wrong hypotheses the alien held, in order. */
  misconceptions: { feature: Feature; at: number }[];
  /** Examples that changed the alien's mind. */
  corrections: { itemId: string; at: number; before: Feature | null; after: Feature | null }[];
  tests: { at: number; scene: string[]; choice: string | null; alienCorrect: boolean }[];
  understoodAt?: number;
}

export interface AlienKnowledge {
  concepts: Record<string, ConceptKnowledge>;
  abilities: string[];
}

// ----------------------------- Game progress ------------------------------

export interface TeachStepState {
  phase: 'teach' | 'test' | 'repair' | 'done';
  tests: number;
  repairs: number;
}

export interface GameProgress {
  introSeen: boolean;
  currentUnitId: string | null;
  /** Index of the current step in each unit. */
  unitStep: Record<string, number>;
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
