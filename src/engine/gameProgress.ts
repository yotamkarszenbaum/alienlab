// ---------------------------------------------------------------------------
// Game progress (separate from learning progress): units, steps, missions,
// inventory. The game never blocks on a single difficult word — units unlock
// when their core activities are completed, even with hints.
//
// Progress inside a unit is stored as the set of finished step ids. The
// current step is the first step of the player's level that is not finished.
// So when a parent raises the level, the new words of a unit simply become
// the next steps to play; lowering it hides them. Nothing is ever lost.
// ---------------------------------------------------------------------------
import type { GameProgress, Level, StepDef, TeachStepState, UnitDef } from './types';
import { FIRST_UNIT_ID, UNITS, UNITS_BY_ID, stepsFor } from '../content/units';

export function emptyGame(): GameProgress {
  return {
    introSeen: false,
    level: null,
    currentUnitId: null,
    doneSteps: {},
    teachState: {},
    completedUnits: [],
    unlockedUnits: [FIRST_UNIT_ID],
    completedMissions: [],
    inventory: [],
    activities: 0,
  };
}

export type UnitStatus = 'locked' | 'available' | 'in_progress' | 'completed';

export function isUnitUnlocked(g: GameProgress, unitId: string): boolean {
  return g.unlockedUnits.includes(unitId);
}

export function levelOfGame(g: GameProgress): Level {
  return g.level ?? 1;
}

export function visibleSteps(g: GameProgress, unit: UnitDef): StepDef[] {
  return stepsFor(unit, levelOfGame(g));
}

/** Index (in the level's step list) of the first unfinished step; the summary if all are done. */
export function stepIndexOf(g: GameProgress, unit: UnitDef): number {
  const steps = visibleSteps(g, unit);
  const done = g.doneSteps[unit.id] ?? [];
  const i = steps.findIndex((s) => !done.includes(s.id));
  return i === -1 ? steps.length - 1 : i;
}

/** A completed unit that got new steps (the level was raised). */
export function hasNewSteps(g: GameProgress, unit: UnitDef): boolean {
  if (!g.completedUnits.includes(unit.id)) return false;
  const done = g.doneSteps[unit.id] ?? [];
  return visibleSteps(g, unit).some((s) => s.type !== 'summary' && !done.includes(s.id));
}

export function unitStatus(g: GameProgress, unit: UnitDef): UnitStatus {
  if (!isUnitUnlocked(g, unit.id)) return 'locked';
  if (g.completedUnits.includes(unit.id)) return 'completed';
  return (g.doneSteps[unit.id] ?? []).length > 0 ? 'in_progress' : 'available';
}

export function advanceStep(g: GameProgress, unitId: string, stepId: string, now: number): GameProgress {
  if (!UNITS_BY_ID[unitId]) return g;
  const done = g.doneSteps[unitId] ?? [];
  return {
    ...g,
    currentUnitId: unitId,
    doneSteps: { ...g.doneSteps, [unitId]: done.includes(stepId) ? done : [...done, stepId] },
    activities: g.activities + 1,
    lastPlayedAt: now,
  };
}

/** Go back to a step (e.g. the alien must be taught before a mission). */
export function reopenStep(g: GameProgress, unitId: string, stepId: string): GameProgress {
  const done = g.doneSteps[unitId] ?? [];
  return { ...g, doneSteps: { ...g.doneSteps, [unitId]: done.filter((s) => s !== stepId) } };
}

export function completeUnit(g: GameProgress, unitId: string, now: number): { game: GameProgress; newlyUnlocked: string | null } {
  const unit = UNITS_BY_ID[unitId];
  if (!unit) return { game: g, newlyUnlocked: null };
  const completedUnits = g.completedUnits.includes(unitId) ? g.completedUnits : [...g.completedUnits, unitId];
  let newlyUnlocked: string | null = null;
  let unlockedUnits = g.unlockedUnits;
  if (unit.unlocksUnitId && !unlockedUnits.includes(unit.unlocksUnitId)) {
    unlockedUnits = [...unlockedUnits, unit.unlocksUnitId];
    newlyUnlocked = unit.unlocksUnitId;
  }
  return { game: { ...g, completedUnits, unlockedUnits, lastPlayedAt: now }, newlyUnlocked };
}

export function setLevel(g: GameProgress, level: Level): GameProgress {
  return { ...g, level };
}

export function teachStateOf(g: GameProgress, stepId: string): TeachStepState {
  return g.teachState[stepId] ?? { phase: 'teach', tests: 0, repairs: 0 };
}

export function setTeachState(g: GameProgress, stepId: string, s: TeachStepState): GameProgress {
  return { ...g, teachState: { ...g.teachState, [stepId]: s } };
}

export function nextUnitToPlay(g: GameProgress): string {
  const open = UNITS.filter((u) => isUnitUnlocked(g, u.id) && !g.completedUnits.includes(u.id));
  return (open[0] ?? UNITS[UNITS.length - 1]).id;
}
