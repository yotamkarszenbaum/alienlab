// ---------------------------------------------------------------------------
// Game progress (separate from learning progress): units, steps, missions,
// inventory. The game never blocks on a single difficult word — units unlock
// when their core activities are completed, even with hints.
// ---------------------------------------------------------------------------
import type { GameProgress, TeachStepState, UnitDef } from './types';
import { FIRST_UNIT_ID, UNITS, UNITS_BY_ID } from '../content/units';

export function emptyGame(): GameProgress {
  return {
    introSeen: false,
    currentUnitId: null,
    unitStep: {},
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

export function unitStatus(g: GameProgress, unit: UnitDef): UnitStatus {
  if (!isUnitUnlocked(g, unit.id)) return 'locked';
  if (g.completedUnits.includes(unit.id)) return 'completed';
  return (g.unitStep[unit.id] ?? 0) > 0 ? 'in_progress' : 'available';
}

export function stepIndexOf(g: GameProgress, unit: UnitDef): number {
  const i = g.unitStep[unit.id] ?? 0;
  return Math.max(0, Math.min(unit.steps.length - 1, i));
}

export function advanceStep(g: GameProgress, unitId: string, fromIndex: number, now: number): GameProgress {
  const unit = UNITS_BY_ID[unitId];
  if (!unit) return g;
  const next = Math.min(unit.steps.length - 1, fromIndex + 1);
  return {
    ...g,
    currentUnitId: unitId,
    unitStep: { ...g.unitStep, [unitId]: Math.max(g.unitStep[unitId] ?? 0, next) },
    activities: g.activities + 1,
    lastPlayedAt: now,
  };
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
