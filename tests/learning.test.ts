import { describe, expect, it } from 'vitest';
import { initialSupport, onHelp, onWrong } from '../src/engine/hints';
import { DAY, HOUR, isDueForReview, levelOf } from '../src/engine/learning';
import { dueWords, introduceWord, recordChoice, recordDelayedReview, recordWordAttempt } from '../src/engine/session';
import { buildMissionQuestion, buildWordToPicture, reduceOptions } from '../src/engine/tasks';
import { clearSave, loadSave, newSave, STORAGE_KEY, writeSave, type StorageLike } from '../src/engine/storage';
import { getWord } from '../src/content/words';
import { MISSIONS_BY_ID } from '../src/content/units';

const T0 = 1_800_000_000_000;

function memStorage(): StorageLike & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return { map, getItem: (k) => map.get(k) ?? null, setItem: (k, v) => void map.set(k, v), removeItem: (k) => void map.delete(k) };
}

describe('support ladder', () => {
  it('wrong answers escalate verbal -> reduce -> demo', () => {
    let s = onWrong(initialSupport);
    expect(s.level).toBe(1);
    expect(s.used).toEqual(['verbal']);
    s = onWrong(s);
    expect(s.level).toBe(2);
    expect(s.used).toContain('reduce');
    s = onWrong(s);
    expect(s.level).toBe(3);
    expect(s.used).toContain('demo');
  });
  it('help button gives a hint first, not the solution', () => {
    const s = onHelp(initialSupport);
    expect(s.level).toBe(1);
    expect(s.used).toEqual(['verbal']);
  });
  it('reduce keeps the correct answer and one distractor', () => {
    const q = buildWordToPicture(getWord('apple'), { optionCount: 4, audioOnly: false, variant: 0, taskId: 't' });
    const r = reduceOptions(q.options, []);
    expect(r).toHaveLength(2);
    expect(r.some((o) => o.correct)).toBe(true);
  });
});

describe('learning progress', () => {
  it('independent success differs from success with a hint', () => {
    let d = introduceWord(newSave(T0), 'apple', T0);
    d = introduceWord(d, 'ball', T0);
    expect(levelOf(d.learning.apple)).toBe('introduced');
    const q = buildWordToPicture(getWord('apple'), { optionCount: 2, audioOnly: false, variant: 0, taskId: 'q' });
    const right = q.options.find((o) => o.correct)!;
    const helped = recordChoice(d, q, right, 1, onHelp(initialSupport), 'learn', T0);
    expect(levelOf(helped.learning.apple)).toBe('recognized_with_help');
    expect(helped.learning.apple.hintedCorrect).toBe(1);
    expect(helped.learning.apple.independentCorrect).toBe(0);
    expect(helped.attempts[0].hintUsed).toBe(true);
    expect(helped.attempts[0].hintTypes).toEqual(['verbal']);

    const alone = recordChoice(d, q, right, 1, initialSupport, 'learn', T0);
    expect(levelOf(alone.learning.apple)).toBe('recognized_independently');
    expect(alone.attempts[0].independent).toBe(true);
  });

  it('multi-word mission logs only the word that was wrong', () => {
    const d = newSave(T0);
    const q = buildMissionQuestion(MISSIONS_BY_ID['m-colors'].steps[0], { variant: 0, taskId: 'c1' });
    const greenApple = q.options.find((o) => o.item?.kind === 'apple' && o.item.color === 'green')!;
    const out = recordChoice(d, q, greenApple, 1, initialSupport, 'learn', T0);
    expect(out.learning.red.wrong).toBe(1);
    expect(out.learning.apple.wrong).toBe(0);
    expect(out.attempts).toHaveLength(1);
  });

  it('delayed review: not offered right away, offered after the gap, counted separately', () => {
    let d = introduceWord(newSave(T0), 'cat', T0);
    d = recordWordAttempt(d, {
      wordId: 'cat', taskId: 'x', taskType: 'word_to_picture', outcome: 'correct', attemptNumber: 1,
      support: initialSupport, completed: true, phase: 'learn', context: 'intro', now: T0,
    });
    expect(levelOf(d.learning.cat)).toBe('recognized_independently');
    expect(isDueForReview(d.learning.cat, T0 + HOUR)).toBe(false);
    expect(dueWords(d, T0 + DAY + 1)).toEqual(['cat']);
    // review result is only stored when it was really due
    expect(recordDelayedReview(d, 'cat', true, false, false, T0 + 1).learning.cat.delayedReviews).toHaveLength(0);
    d = recordDelayedReview(d, 'cat', true, false, true, T0 + DAY + 1);
    expect(levelOf(d.learning.cat)).toBe('reviewed_later');
  });

  it('struggled words come back sooner', () => {
    let d = introduceWord(newSave(T0), 'dog', T0);
    for (const outcome of ['wrong', 'wrong', 'correct'] as const) {
      d = recordWordAttempt(d, {
        wordId: 'dog', taskId: 'x', taskType: 'word_to_picture', outcome, attemptNumber: 1,
        support: onWrong(initialSupport), completed: outcome === 'correct', phase: 'learn', context: 'intro', now: T0,
      });
    }
    expect(d.learning.dog.nextReviewAt).toBe(T0 + 4 * HOUR);
  });
});

describe('storage', () => {
  it('round-trips progress', () => {
    const s = memStorage();
    const d = introduceWord(newSave(T0), 'apple', T0);
    writeSave(d, s);
    const r = loadSave(T0, s);
    expect(r.status).toBe('loaded');
    expect(r.data.learning.apple.introduced).toBe(true);
  });
  it('corrupted save -> backup + fresh start', () => {
    const s = memStorage();
    s.setItem(STORAGE_KEY, '{not json');
    const r = loadSave(T0, s);
    expect(r.status).toBe('corrupt_reset');
    expect([...s.map.keys()].some((k) => k.startsWith('alienlab:save-backup:'))).toBe(true);
  });
  it('partial / invalid fields are repaired', () => {
    const s = memStorage();
    s.setItem(STORAGE_KEY, JSON.stringify({ version: 1, game: { unitStep: { earth: 999, nope: 3 }, completedUnits: ['earth'], unlockedUnits: [] } }));
    const r = loadSave(T0, s);
    expect(r.data.game.unitStep.earth).toBe(11); // clamped to last step index
    expect(r.data.game.unitStep).not.toHaveProperty('nope');
    expect(r.data.game.unlockedUnits).toEqual(['earth', 'colors']);
    expect(r.data.learning.apple.attempts).toBe(0);
  });
  it('old (v0) save is migrated', () => {
    const s = memStorage();
    s.setItem(STORAGE_KEY, JSON.stringify({ words: { cat: { introduced: true, attempts: 2 } }, game: {} }));
    const r = loadSave(T0, s);
    expect(r.status).toBe('migrated');
    expect(r.data.learning.cat.attempts).toBe(2);
  });
  it('newer version is not overwritten', () => {
    const s = memStorage();
    s.setItem(STORAGE_KEY, JSON.stringify({ version: 99, game: {} }));
    const r = loadSave(T0, s);
    expect(r.status).toBe('newer_version');
    expect(r.canSave).toBe(false);
  });
  it('reset clears the save', () => {
    const s = memStorage();
    writeSave(newSave(T0), s);
    clearSave(s);
    expect(loadSave(T0, s).status).toBe('new');
  });
});
