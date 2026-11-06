import { describe, expect, it } from 'vitest';
import { MISSIONS_BY_ID, SENTENCES_BY_ID, UNITS, UNITS_BY_ID, stepsFor, unitWordIds } from '../src/content/units';
import { WORDS, WORDS_BY_ID, wordsForLevel } from '../src/content/words';
import { inLevel, inRange } from '../src/content/levels';
import { advanceStep, emptyGame, hasNewSteps, completeUnit, markStepsDone, setLevel, stepIndexOf, visibleSteps } from '../src/engine/gameProgress';
import { initialSupport, onHelp } from '../src/engine/hints';
import { introduceWord, recordWordAttempt } from '../src/engine/session';
import { levelOf } from '../src/engine/learning';
import { newSave } from '../src/engine/storage';
import { buildMissionQuestion, buildPictureToWord, buildSceneQuestion, buildWordToPicture } from '../src/engine/tasks';
import { hasFeature } from '../src/engine/alienMind';
import type { Level } from '../src/engine/types';

const T0 = 1_800_000_000_000;
/** Does a picture show a word? (an item's own features, or the table/box it sits on/in) */
function shows(i: import('../src/engine/types').ItemSpec, wordId: string): boolean {
  const t = WORDS_BY_ID[wordId].target;
  return hasFeature(i, t) || (t.dim === 'kind' && i.rel?.ref === t.value);
}
const LEVELS: Level[] = [1, 2, 3];

describe('levels — content', () => {
  it('12 / 18 / 25 words', () => {
    expect(wordsForLevel(1)).toHaveLength(12);
    expect(wordsForLevel(2)).toHaveLength(18);
    expect(wordsForLevel(3)).toHaveLength(25);
  });

  it('no step uses a word before it is introduced at that level', () => {
    for (const level of LEVELS) {
      for (const u of UNITS) {
        const seen = new Set<string>(UNITS.filter((p) => p.order < u.order).flatMap((p) => unitWordIds(p, level)));
        for (const s of stepsFor(u, level)) {
          const used: string[] = [];
          if (s.type === 'discover') seen.add(s.wordId);
          if (s.type === 'practice' || s.type === 'sentence')
            for (const q of s.questions.filter((q) => inLevel(q.minLevel, level))) {
              if (q.wordId) used.push(q.wordId);
              if (q.sentenceId) used.push(...SENTENCES_BY_ID[q.sentenceId].wordIds);
            }
          if (s.type === 'spell') used.push(...(level >= 3 && s.wordIdsL3 ? s.wordIdsL3 : s.wordIds));
          if (s.type === 'fill') for (const f of s.sentences.filter((f) => inLevel(f.minLevel, level))) used.push(...f.wordIds);
          if (s.type === 'read') for (const rq of s.questions) used.push(...rq.wordIds);
          if (s.type === 'says') used.push(...s.rounds.map((r) => r.wordId));
          if (s.type === 'build') for (const b of s.sentences.filter((b) => inLevel(b.minLevel, level))) used.push(...b.wordIds);
          if (s.type === 'teach') used.push(s.conceptId);
          if (s.type === 'play') for (const ms of MISSIONS_BY_ID[s.missionId].steps.filter((x) => inLevel(x.minLevel, level))) used.push(...ms.wordIds);
          for (const w of used) {
            expect(inLevel(WORDS_BY_ID[w].minLevel, level), `${w} at level ${level}`).toBe(true);
            expect(seen.has(w), `${w} used in ${s.id} before discover (level ${level})`).toBe(true);
          }
        }
      }
    }
  });

  it('"Kosmo says" only at level 1, sentence building only at levels 2–3, new teach concepts from level 2', () => {
    const types = (l: Level) => UNITS.flatMap((u) => stepsFor(u, l).map((s) => s.type));
    expect(types(1).filter((t) => t === 'says')).toHaveLength(3);
    expect(types(2).includes('says')).toBe(false);
    expect(types(1).includes('build')).toBe(false);
    expect(types(2).filter((t) => t === 'build')).toHaveLength(2);
    expect(types(3).filter((t) => t === 'build')).toHaveLength(2);
    const teach = (l: Level) => UNITS.flatMap((u) => stepsFor(u, l)).filter((s) => s.type === 'teach').map((s) => (s as { conceptId: string }).conceptId);
    expect(teach(1)).toEqual(['dog', 'red', 'big', 'open']);
    expect(teach(2)).toEqual(['dog', 'red', 'big', 'green', 'open', 'close']);
    expect(teach(3)).toEqual(['dog', 'red', 'big', 'green', 'open', 'under']);
  });

  it('every "Kosmo says" round has exactly one matching item in the scene', () => {
    for (const u of UNITS)
      for (const s of u.steps)
        if (s.type === 'says')
          for (const r of s.rounds) {
            const q = buildSceneQuestion(WORDS_BY_ID[r.wordId], s.scene, { taskId: 't', audioOnly: false });
            expect(q.options.filter((o) => o.correct), `${s.id}/${r.wordId}`).toHaveLength(1);
          }
  });

  it('sentence tokens use the right words and the extra chip is a real alternative', () => {
    for (const u of UNITS)
      for (const s of u.steps)
        if (s.type === 'build')
          for (const b of s.sentences) {
            const en = (w: string) => WORDS_BY_ID[w].english;
            for (const w of b.wordIds) expect(b.tokens.some((t) => t === en(w) || t === `${en(w)}S`), `${b.id} uses ${w}`).toBe(true);
            for (const x of b.extraTokens) expect(b.tokens).not.toContain(x);
            for (const w of b.wordIds) expect(shows(b.picture, w), `${b.id}: picture shows ${w}`).toBe(true);
          }
  });

  it('spelling from level 2 (short CVC words), longer words at level 3', () => {
    for (const u of UNITS) {
      expect(stepsFor(u, 1).some((s) => s.type === 'spell')).toBe(false);
      const sp = stepsFor(u, 2).find((s) => s.type === 'spell') as { wordIds: string[]; wordIdsL3?: string[] };
      expect(sp).toBeTruthy();
      for (const w of sp.wordIds) expect(WORDS_BY_ID[w].english.length, w).toBeLessThanOrEqual(3);
      expect(Math.max(...sp.wordIdsL3!.map((w) => WORDS_BY_ID[w].english.length))).toBeGreaterThanOrEqual(4);
    }
  });

  it('fill-in sentences: exactly one bank word fits, and the picture shows it', () => {
    for (const u of UNITS)
      for (const s of u.steps)
        if (s.type === 'fill')
          for (const f of s.sentences) {
            expect(f.bank).toContain(f.answer);
            expect(new Set(f.bank).size).toBe(f.bank.length);
            for (const w of f.wordIds) expect(shows(f.picture, w), `${s.id}/${f.id} picture shows ${w}`).toBe(true);
            // every other bank word that is a game word must NOT be shown in the picture
            for (const b of f.bank.filter((b) => b !== f.answer)) {
              const w = WORDS.find((x) => x.english === b);
              if (w) expect(shows(f.picture, w.id), `${s.id}/${f.id}: ${b} would also fit`).toBe(false);
            }
          }
  });

  it('reading questions: the answer fits the words, every distractor misses at least one', () => {
    for (const u of UNITS)
      for (const s of u.steps)
        if (s.type === 'read')
          for (const rq of s.questions) {
            for (const w of rq.wordIds) expect(shows(rq.answer, w), `${rq.id} answer shows ${w}`).toBe(true);
            for (const d of rq.distractors) expect(rq.wordIds.every((w) => shows(d, w)), `${rq.id} distractor fits too`).toBe(false);
            expect(s.lines[rq.line]).toBeTruthy();
          }
  });

  it('level 3 teaches UNDER; level 2 teaches CLOSE instead', () => {
    const teach = (l: Level) => UNITS.flatMap((u) => stepsFor(u, l)).filter((s) => s.type === 'teach').map((s) => (s as { conceptId: string }).conceptId);
    expect(teach(2)).toContain('close');
    expect(teach(3)).toContain('under');
    expect(teach(3)).not.toContain('close');
  });

  it('every new word builds valid questions (correct answer is unique)', () => {
    const intro = WORDS.map((w) => w.id);
    for (const w of WORDS) {
      for (let v = 0; v < 4; v++) {
        const q = buildWordToPicture(w, { optionCount: 4, audioOnly: false, variant: v, taskId: 't' });
        expect(q.options.filter((o) => o.item && hasFeature(o.item, w.target))).toHaveLength(1);
        const p = buildPictureToWord(w, intro, { optionCount: 3, variant: v, taskId: 't' });
        for (const o of p.options.filter((o) => !o.correct)) expect(hasFeature(p.picture!, WORDS_BY_ID[o.wordId!].target)).toBe(false);
      }
    }
    for (const m of Object.values(MISSIONS_BY_ID))
      for (const st of m.steps) {
        const q = buildMissionQuestion(st, { variant: 0, taskId: 't' });
        const fits = q.options.filter((o) => st.wordIds.every((id) => hasFeature(o.item!, WORDS_BY_ID[id].target)));
        expect(fits.map((o) => o.correct), `${m.id}/${st.id}`).toEqual([true]);
      }
  });
});

/** Game word behind an English token (plural-aware: BALLS → ball, BOXES → box). */
const gameWord = (t: string) => WORDS.find((w) => t === w.english || t === `${w.english}S` || t === `${w.english}ES`);
const tokensOf = (sentence: string) => sentence.replace(/[.!?,]/g, '').split(/\s+/).filter(Boolean);

describe('levels — "Kosmo gets confused" (levels 2–3)', () => {
  it('levels 2–3 open every station with Kosmo\'s mix-ups; level 1 does not', () => {
    for (const u of UNITS) {
      expect(stepsFor(u, 1)[0].type).toBe('discover');
      for (const l of [2, 3] as Level[]) {
        const first = stepsFor(u, l)[0];
        expect(first.type).toBe('mixup');
        expect((first as { opening?: boolean }).opening).toBe(true);
      }
    }
  });

  it('the simple mixed rounds are replaced by a Kosmo review at levels 2–3', () => {
    const ids = (l: Level) => UNITS.flatMap((u) => stepsFor(u, l).map((s) => s.id));
    expect(ids(1)).toEqual(expect.arrayContaining(['earth-mix', 'colors-mix', 'sentence-open-door']));
    for (const l of [2, 3] as Level[]) {
      expect(ids(l)).not.toEqual(expect.arrayContaining(['earth-mix']));
      expect(ids(l).filter((x) => ['earth-mix', 'colors-mix', 'sentence-open-door'].includes(x))).toEqual([]);
      expect(ids(l)).toEqual(expect.arrayContaining(['earth-kosmo', 'colors-kosmo', 'lab-kosmo']));
    }
    expect(ids(1).some((x) => x.endsWith('-kosmo') || x.endsWith('-mixup'))).toBe(false);
  });

  it('every round is consistent: the wrong word does not fit the picture, the fix does, other choices do not', () => {
    for (const u of UNITS)
      for (const s of u.steps)
        if (s.type === 'mixup')
          for (const r of s.rounds) {
            const tag = `${s.id}/${r.id}`;
            const wrong = r.wrongAt !== undefined;
            expect(wrong, `${tag}: fix and choices go with a wrong word`).toBe(!!r.fix && !!r.choices);
            r.tokens.forEach((t, i) => {
              const w = gameWord(t);
              if (!w) return;
              expect(shows(r.picture, w.id), `${tag}: "${t}" ${i === r.wrongAt ? 'must not' : 'must'} fit the picture`).toBe(i !== r.wrongAt);
            });
            if (wrong) {
              expect(r.wrongAt! < r.tokens.length).toBe(true);
              expect(r.choices).toContain(r.fix);
              expect(r.choices).not.toContain(r.tokens[r.wrongAt!]);
              expect(new Set(r.choices).size).toBe(r.choices!.length);
              expect(r.choices!.length).toBeGreaterThanOrEqual(2);
              for (const c of r.choices!) {
                const w = gameWord(c);
                if (w) expect(shows(r.picture, w.id), `${tag}: choice ${c}`).toBe(c === r.fix);
              }
            }
            for (const w of r.wordIds) expect(u.wordIds, `${tag}: ${w} is a word of this station`).toContain(w);
            if (r.pictureFrom) expect(r.pictureFrom.state).not.toBe(r.picture.state);
          }
  });

  it('Kosmo only uses words the child already knows at that level', () => {
    for (const level of [2, 3] as Level[])
      for (const u of UNITS) {
        const seen = new Set<string>(UNITS.filter((p) => p.order < u.order).flatMap((p) => unitWordIds(p, level)));
        const known = (w: string) => seen.has(w) || (WORDS_BY_ID[w].minLevel ?? 1) < level;
        for (const s of stepsFor(u, level)) {
          if (s.type === 'discover') {
            seen.add(s.wordId);
            const ex = WORDS_BY_ID[s.wordId].example;
            if (ex) {
              expect(shows(ex.picture, s.wordId), `${s.wordId}: example picture`).toBe(true);
              for (const t of tokensOf(ex.en)) {
                const w = gameWord(t);
                if (w && w.id !== s.wordId) expect(known(w.id), `${s.wordId} example uses ${w.id} (level ${level})`).toBe(true);
              }
            }
          }
          if (s.type !== 'mixup') continue;
          for (const r of s.rounds.filter((r) => inRange(r.minLevel, r.maxLevel, level)))
            for (const t of [...r.tokens, ...(r.choices ?? [])]) {
              const w = gameWord(t);
              if (w) expect(known(w.id), `${s.id}/${r.id} uses ${w.id} (level ${level})`).toBe(true);
            }
        }
      }
  });

  it('the opening covers every basic word of the station, with a mix of right and wrong rounds', () => {
    for (const level of [2, 3] as Level[])
      for (const u of UNITS) {
        const opening = stepsFor(u, level)[0] as { rounds: import('../src/engine/types').MixupRoundDef[] };
        const rounds = opening.rounds.filter((r) => inRange(r.minLevel, r.maxLevel, level));
        const basics = unitWordIds(u, level).filter((w) => (WORDS_BY_ID[w].minLevel ?? 1) < level);
        for (const w of basics) expect(rounds.some((r) => r.wordIds.includes(w)), `${u.id} level ${level}: ${w}`).toBe(true);
        expect(rounds.some((r) => r.wrongAt === undefined), `${u.id} L${level}: a round where Kosmo is right`).toBe(true);
        expect(rounds.filter((r) => r.wrongAt !== undefined).length).toBeGreaterThanOrEqual(2);
      }
  });

  it('level 3 sentences are longer than level 2 ones', () => {
    const avg = (l: Level) => {
      const rs = UNITS.flatMap((u) => stepsFor(u, l)).flatMap((s) => (s.type === 'mixup' ? s.rounds.filter((r) => inRange(r.minLevel, r.maxLevel, l)) : []));
      return rs.reduce((n, r) => n + r.tokens.length, 0) / rs.length;
    };
    expect(avg(3)).toBeGreaterThan(avg(2));
  });

  it('words handled alone skip their introduction; the others skip only the introduction screen', () => {
    let g = setLevel(emptyGame(), 2);
    const earth = UNITS_BY_ID.earth;
    expect(visibleSteps(g, earth)[stepIndexOf(g, earth)].id).toBe('earth-mixup');
    g = advanceStep(g, 'earth', 'earth-mixup', T0);
    // APPLE, BALL, DOG handled alone; CAT needed help
    g = markStepsDone(g, 'earth', [...['apple', 'ball', 'dog'].flatMap((w) => [`${w}-discover`, `${w}-practice`]), 'cat-discover']);
    expect(visibleSteps(g, earth)[stepIndexOf(g, earth)].id).toBe('cat-practice');
    g = advanceStep(g, 'earth', 'cat-practice', T0);
    expect(visibleSteps(g, earth)[stepIndexOf(g, earth)].id).toBe('car-discover'); // the new words of the level are always taught
  });

  it('the opening never counts as a "new activity" badge, the review does', () => {
    let g = setLevel(emptyGame(), 1);
    const earth = UNITS_BY_ID.earth;
    for (const s of visibleSteps(g, earth)) g = advanceStep(g, 'earth', s.id, T0);
    g = completeUnit(g, 'earth', T0).game;
    g = setLevel(g, 2);
    expect(hasNewSteps(g, earth)).toBe(true);
    g = markStepsDone(g, 'earth', visibleSteps(g, earth).filter((s) => s.id !== 'earth-kosmo' && s.id !== 'earth-mixup').map((s) => s.id));
    expect(hasNewSteps(g, earth)).toBe(true); // the Kosmo review is new
    g = markStepsDone(g, 'earth', ['earth-kosmo']);
    expect(hasNewSteps(g, earth)).toBe(false); // the opening alone is not
  });

  it('in spelling, Kosmo first writes every word "by its sound" — wrongly', () => {
    for (const u of UNITS)
      for (const s of u.steps)
        if (s.type === 'spell')
          for (const w of [...s.wordIds, ...(s.wordIdsL3 ?? [])]) {
            const k = WORDS_BY_ID[w].kosmoSpelling;
            expect(k, w).toBeTruthy();
            expect(k).not.toBe(WORDS_BY_ID[w].english);
            expect(k).toMatch(/^[A-Z]+$/);
          }
  });

  it('every new word of levels 2–3 has an example sentence that contains it', () => {
    for (const w of WORDS.filter((x) => (x.minLevel ?? 1) >= 2)) {
      expect(w.example, w.id).toBeTruthy();
      expect(tokensOf(w.example!.en).some((t) => gameWord(t)?.id === w.id), `${w.id} in "${w.example!.en}"`).toBe(true);
    }
  });
});

describe('levels — progress', () => {
  it('raising the level after finishing a unit adds its new words as next steps', () => {
    let g = setLevel(emptyGame(), 1);
    const earth = UNITS_BY_ID.earth;
    for (const s of visibleSteps(g, earth)) g = advanceStep(g, 'earth', s.id, T0);
    g = completeUnit(g, 'earth', T0).game;
    expect(hasNewSteps(g, earth)).toBe(false);
    g = setLevel(g, 3);
    expect(hasNewSteps(g, earth)).toBe(true);
    // Kosmo's mix-ups open the station (they skip themselves on screen when every older word is already known)
    expect(visibleSteps(g, earth)[stepIndexOf(g, earth)].id).toBe('earth-mixup');
    g = advanceStep(g, 'earth', 'earth-mixup', T0);
    expect(visibleSteps(g, earth)[stepIndexOf(g, earth)].id).toBe('car-discover');
    expect(g.completedUnits).toContain('earth'); // nothing taken away
    // lowering again hides them
    g = setLevel(g, 1);
    expect(hasNewSteps(g, earth)).toBe(false);
  });

  it('spelling is stored as production, apart from recognition', () => {
    let d = introduceWord(newSave(T0), 'cat', T0);
    d = recordWordAttempt(d, { wordId: 'cat', taskId: 's', taskType: 'spell_word', outcome: 'wrong', attemptNumber: 1, support: initialSupport, completed: false, phase: 'learn', context: 'new', now: T0 });
    d = recordWordAttempt(d, { wordId: 'cat', taskId: 's', taskType: 'spell_word', outcome: 'correct', attemptNumber: 2, support: onHelp(initialSupport), completed: true, phase: 'learn', context: 'new', now: T0 });
    expect(d.learning.cat.spellWrong).toBe(1);
    expect(d.learning.cat.spellWithHelp).toBe(1);
    expect(d.learning.cat.wrong).toBe(0);
    expect(d.learning.cat.attempts).toBe(0);
    expect(levelOf(d.learning.cat)).toBe('introduced'); // recognition level unchanged
    expect(d.attempts.map((a) => a.taskType)).toEqual(['spell_word', 'spell_word']);
  });
});
