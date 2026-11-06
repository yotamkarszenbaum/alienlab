// ---------------------------------------------------------------------------
// Local persistence (localStorage, this device only). Handles:
//  - missing save            -> new game
//  - corrupted JSON / shape  -> raw copy kept under a backup key, fresh start
//  - older schema versions   -> migrated step by step
//  - newer schema versions   -> not overwritten; game runs without saving
//  - storage not available   -> in-memory mode (progress not saved)
// ---------------------------------------------------------------------------
import type { AlienKnowledge, AttemptRecord, ConceptKnowledge, GameProgress, Level, SaveData, Settings, WordProgress } from './types';
import { emptyWordProgress, MAX_ATTEMPT_LOG } from './learning';
import { emptyAlien, emptyConcept } from './alienMind';
import { emptyGame } from './gameProgress';
import { WORDS } from '../content/words';
import { UNITS, UNITS_BY_ID, stepsFor } from '../content/units';

export const SCHEMA_VERSION = 2;
export const STORAGE_KEY = 'alienlab:save';
export const BACKUP_KEY_PREFIX = 'alienlab:save-backup:';

export type LoadStatus = 'new' | 'loaded' | 'migrated' | 'corrupt_reset' | 'newer_version' | 'unavailable';

export const defaultSettings: Settings = {
  music: false,
  sfx: true,
  readAloudHe: true,
  reducedMotion: false,
  devTimeOffsetMs: 0,
};

export function newSave(now: number): SaveData {
  return {
    version: SCHEMA_VERSION,
    createdAt: now,
    learning: Object.fromEntries(WORDS.map((w) => [w.id, emptyWordProgress()])),
    attempts: [],
    alien: emptyAlien(),
    game: emptyGame(),
    settings: { ...defaultSettings },
  };
}

// ----------------------------- validation ---------------------------------

const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const num = (x: unknown, d = 0) => (typeof x === 'number' && Number.isFinite(x) ? x : d);
const optNum = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? x : undefined);
const bool = (x: unknown, d = false) => (typeof x === 'boolean' ? x : d);
const strArr = (x: unknown) => (Array.isArray(x) ? x.filter((s): s is string => typeof s === 'string') : []);

function normWord(x: unknown): WordProgress {
  const d = emptyWordProgress();
  if (!isObj(x)) return d;
  return {
    introduced: bool(x.introduced),
    introducedAt: optNum(x.introducedAt),
    attempts: num(x.attempts),
    independentCorrect: num(x.independentCorrect),
    hintedCorrect: num(x.hintedCorrect),
    wrong: num(x.wrong),
    notHelpful: num(x.notHelpful),
    contextIndependent: num(x.contextIndependent),
    lastPracticedAt: optNum(x.lastPracticedAt),
    nextReviewAt: optNum(x.nextReviewAt),
    delayedReviews: Array.isArray(x.delayedReviews)
      ? x.delayedReviews
          .filter(isObj)
          .filter((r) => ['independent', 'with_help', 'wrong'].includes(r.result as string))
          .map((r) => ({ at: num(r.at), result: r.result as 'independent' | 'with_help' | 'wrong' }))
      : [],
    recent: Array.isArray(x.recent) ? (x.recent.filter((r) => r === 'i' || r === 'h' || r === 'w') as ('i' | 'h' | 'w')[]) : [],
    spellIndependent: num(x.spellIndependent),
    spellWithHelp: num(x.spellWithHelp),
    spellWrong: num(x.spellWrong),
  };
}

function normConcept(id: string, x: unknown): ConceptKnowledge {
  const d = emptyConcept(id);
  if (!isObj(x)) return d;
  return {
    conceptId: id,
    heard: bool(x.heard),
    examples: strArr(x.examples),
    rejected: strArr(x.rejected),
    misconceptions: Array.isArray(x.misconceptions) ? (x.misconceptions.filter(isObj) as unknown as ConceptKnowledge['misconceptions']) : [],
    corrections: Array.isArray(x.corrections) ? (x.corrections.filter(isObj) as unknown as ConceptKnowledge['corrections']) : [],
    tests: Array.isArray(x.tests) ? (x.tests.filter(isObj) as unknown as ConceptKnowledge['tests']) : [],
    understoodAt: optNum(x.understoodAt),
  };
}

function normAlien(x: unknown): AlienKnowledge {
  const a = emptyAlien();
  if (!isObj(x)) return a;
  const concepts: Record<string, ConceptKnowledge> = {};
  if (isObj(x.concepts)) for (const [k, v] of Object.entries(x.concepts)) concepts[k] = normConcept(k, v);
  return { concepts, abilities: strArr(x.abilities) };
}

function normGame(x: unknown): GameProgress {
  const g = emptyGame();
  if (!isObj(x)) return g;
  const knownUnit = (id: string) => !!UNITS_BY_ID[id];
  const doneSteps: Record<string, string[]> = {};
  if (isObj(x.doneSteps))
    for (const [k, v] of Object.entries(x.doneSteps)) {
      const u = UNITS_BY_ID[k];
      if (u) doneSteps[k] = [...new Set(strArr(v).filter((id) => u.steps.some((s) => s.id === id)))];
    }
  const level = x.level === 1 || x.level === 2 || x.level === 3 ? (x.level as Level) : null;
  const teachState: GameProgress['teachState'] = {};
  if (isObj(x.teachState))
    for (const [k, v] of Object.entries(x.teachState)) {
      if (isObj(v) && ['teach', 'test', 'repair', 'done'].includes(v.phase as string))
        teachState[k] = { phase: v.phase as 'teach', tests: num(v.tests), repairs: num(v.repairs) };
    }
  const unlocked = strArr(x.unlockedUnits).filter(knownUnit);
  if (!unlocked.includes(UNITS[0].id)) unlocked.unshift(UNITS[0].id);
  const completed = strArr(x.completedUnits).filter(knownUnit);
  // A completed unit always unlocks the next one (repairs inconsistent saves).
  for (const c of completed) {
    const nxt = UNITS_BY_ID[c].unlocksUnitId;
    if (nxt && !unlocked.includes(nxt)) unlocked.push(nxt);
  }
  const current = typeof x.currentUnitId === 'string' && knownUnit(x.currentUnitId) ? x.currentUnitId : null;
  return {
    introSeen: bool(x.introSeen),
    level,
    currentUnitId: current && unlocked.includes(current) ? current : null,
    doneSteps,
    teachState,
    completedUnits: completed,
    unlockedUnits: unlocked,
    completedMissions: strArr(x.completedMissions),
    inventory: strArr(x.inventory),
    activities: num(x.activities),
    startedAt: optNum(x.startedAt),
    lastPlayedAt: optNum(x.lastPlayedAt),
  };
}

function normSettings(x: unknown): Settings {
  if (!isObj(x)) return { ...defaultSettings };
  return {
    music: bool(x.music, defaultSettings.music),
    sfx: bool(x.sfx, defaultSettings.sfx),
    readAloudHe: bool(x.readAloudHe, defaultSettings.readAloudHe),
    reducedMotion: bool(x.reducedMotion, defaultSettings.reducedMotion),
    devTimeOffsetMs: num(x.devTimeOffsetMs),
  };
}

function normAttempts(x: unknown): AttemptRecord[] {
  if (!Array.isArray(x)) return [];
  return x
    .filter(isObj)
    .filter((a) => typeof a.wordId === 'string' && typeof a.at === 'number')
    .slice(-MAX_ATTEMPT_LOG) as unknown as AttemptRecord[];
}

/** Fill missing fields with defaults and drop unknown/invalid values. */
export function normalize(raw: Record<string, unknown>, now: number): SaveData {
  const base = newSave(now);
  const learning: Record<string, WordProgress> = { ...base.learning };
  if (isObj(raw.learning)) for (const w of WORDS) if (w.id in raw.learning) learning[w.id] = normWord(raw.learning[w.id]);
  return {
    version: SCHEMA_VERSION,
    createdAt: num(raw.createdAt, now),
    learning,
    attempts: normAttempts(raw.attempts),
    alien: normAlien(raw.alien),
    game: normGame(raw.game),
    settings: normSettings(raw.settings),
  };
}

// ----------------------------- migrations ---------------------------------
// Each entry upgrades a save from version N to N+1. Version 0 = pre-release
// saves that had no "version" field and kept learning data under "words".
// Version 1 stored progress as a step index per unit and had no levels:
// convert it to finished step ids and keep those players on level 1.
const MIGRATIONS: Record<number, (d: Record<string, unknown>) => Record<string, unknown>> = {
  0: (d) => ({ ...d, learning: d.learning ?? d.words, version: 1 }),
  1: (d) => {
    const g: Record<string, unknown> = isObj(d.game) ? { ...d.game } : {};
    const unitStep = isObj(g.unitStep) ? g.unitStep : {};
    const completed = strArr(g.completedUnits);
    const doneSteps: Record<string, string[]> = {};
    for (const u of UNITS) {
      const steps = stepsFor(u, 1);
      const n = completed.includes(u.id) ? steps.length : Math.max(0, Math.floor(num(unitStep[u.id])));
      if (n > 0) doneSteps[u.id] = steps.slice(0, n).map((s) => s.id);
    }
    delete g.unitStep;
    return { ...d, game: { ...g, doneSteps, level: 1 }, version: 2 };
  },
};

export function migrate(raw: Record<string, unknown>): { data: Record<string, unknown>; migrated: boolean } {
  let v = typeof raw.version === 'number' ? raw.version : 0;
  let data = raw;
  let migrated = false;
  while (v < SCHEMA_VERSION) {
    const m = MIGRATIONS[v];
    if (!m) break;
    data = m(data);
    v += 1;
    migrated = true;
  }
  return { data, migrated };
}

// ------------------------------- I/O --------------------------------------

export interface StorageLike {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}

function getStorage(): StorageLike | null {
  try {
    const s = globalThis.localStorage;
    if (!s) return null;
    const probe = 'alienlab:probe';
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}

export function loadSave(now: number, storage: StorageLike | null = getStorage()): { data: SaveData; status: LoadStatus; canSave: boolean } {
  if (!storage) return { data: newSave(now), status: 'unavailable', canSave: false };
  let raw: string | null = null;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    return { data: newSave(now), status: 'unavailable', canSave: false };
  }
  if (!raw) return { data: newSave(now), status: 'new', canSave: true };
  try {
    const parsed = JSON.parse(raw);
    if (!isObj(parsed) || (!isObj(parsed.game) && !isObj(parsed.learning) && !isObj(parsed.words))) throw new Error('bad shape');
    if (typeof parsed.version === 'number' && parsed.version > SCHEMA_VERSION) {
      // Saved by a newer version of the game: keep it untouched.
      return { data: normalize(parsed, now), status: 'newer_version', canSave: false };
    }
    const { data, migrated } = migrate(parsed);
    return { data: normalize(data, now), status: migrated ? 'migrated' : 'loaded', canSave: true };
  } catch {
    try {
      storage.setItem(BACKUP_KEY_PREFIX + now, raw);
    } catch {
      /* ignore */
    }
    return { data: newSave(now), status: 'corrupt_reset', canSave: true };
  }
}

export function writeSave(data: SaveData, storage: StorageLike | null = getStorage()): boolean {
  if (!storage) return false;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function clearSave(storage: StorageLike | null = getStorage()): boolean {
  if (!storage) return false;
  try {
    storage.removeItem(STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

export function hasProgress(d: SaveData): boolean {
  return d.game.introSeen || d.game.level !== null || d.attempts.length > 0 || Object.values(d.game.doneSteps).some((s) => s.length > 0);
}
