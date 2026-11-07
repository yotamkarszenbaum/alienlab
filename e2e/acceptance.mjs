// End-to-end acceptance tests (spec section 19) — runs a real Chrome via playwright-core.
// Usage: npm run build && npx vite preview --port 4173 & node e2e/acceptance.mjs
// Env: CHROME=/path/to/chrome  URL=http://localhost:4173/
import { chromium } from 'playwright-core';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
const PKG_VERSION = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;

const BASE_URL = process.env.URL ?? 'http://localhost:4173/';
const CHROME = process.env.CHROME ?? '/usr/bin/google-chrome';
const SHOTS = new URL('./screenshots/', import.meta.url).pathname;
mkdirSync(SHOTS, { recursive: true });

const results = [];
function record(id, name, start, action, expected, actual, pass, fix = '') {
  results.push({ id, name, start, action, expected, actual, pass, fix });
  console.log(`${pass ? 'PASS' : 'FAIL'}  #${id} ${name} — ${actual}`);
}
const extra = [];
function note(name, actual, pass) {
  extra.push({ name, actual, pass });
  console.log(`${pass ? 'PASS' : 'FAIL'}  [15] ${name} — ${actual}`);
}

const browser = await chromium.launch({
  executablePath: CHROME,
  args: ['--no-sandbox', '--disable-background-networking', '--disable-component-update', '--disable-sync', '--no-first-run'],
});

const W = 700; // wait after a click (the UI ignores taps faster than ~450ms on purpose)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function helpers(page) {
  const click = async (sel, wait = W) => {
    await page.locator(sel).first().click();
    await sleep(wait);
  };
  const save = () => page.evaluate(() => JSON.parse(localStorage.getItem('alienlab:save') || 'null'));
  const stepId = () => page.getAttribute('[data-testid=unit-screen]', 'data-step');
  const stepType = () => page.getAttribute('[data-testid=unit-screen]', 'data-step-type');
  const text = (sel) => page.locator(sel).first().innerText();
  const exists = async (sel) => (await page.locator(sel).count()) > 0;
  const overflowX = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

  async function answerQuestions() {
    const s0 = await stepId();
    for (let g = 0; g < 12; g++) {
      if ((await stepId()) !== s0) return;
      if (await exists('[data-testid=sentence-intro]')) {
        await click('[data-testid=next-btn]');
        continue;
      }
      await page.waitForSelector('[data-testid=choice-question]');
      await click('[data-testid=options] button[data-correct=true]');
      await click('[data-testid=next-btn]');
    }
  }

  async function doTeach(onPhase) {
    for (let g = 0; g < 30; g++) {
      if (!(await exists('[data-testid=teach-step]'))) return;
      const phase = await page.getAttribute('[data-testid=teach-step]', 'data-phase');
      if (onPhase) await onPhase(phase);
      if (phase === 'teach') {
        await click('[data-testid=teach-pool] button[data-correct=true]:not([disabled])');
        await click('[data-testid=start-test-btn]');
      } else if (phase === 'test') {
        await page.waitForSelector('[data-testid=alien-choice]', { timeout: 8000 });
        const right = await page.locator('[data-testid=test-scene] button:has([data-testid=alien-choice])').getAttribute('data-correct');
        await click(right === 'true' ? '[data-testid=judge-right]' : '[data-testid=judge-wrong]');
        await click(right === 'true' ? '[data-testid=next-btn]' : '[data-testid=help-alien-btn]');
      } else if (phase === 'repair') {
        if (await exists('[data-testid=diagnose-options]')) await click('[data-testid=diagnose-options] button[data-correct=true]');
        await click('[data-testid=repair-options] button[data-correct=true]');
        await click('[data-testid=retest-btn]');
      } else if (phase === 'done') {
        await click('[data-testid=next-btn]');
        return;
      }
    }
  }

  /** One mission step. Kosmo tries first when his knowledge lets him; the child checks him or shows him. */
  async function missionStep(onKosmo) {
    const prompt = await page.getAttribute('[data-testid=mission-step]', 'data-prompt');
    if (await exists('[data-testid=mission-kosmo][data-stage=kosmo]')) {
      const ok = (await page.getAttribute('[data-testid=mission-kosmo]', 'data-kosmo-correct')) === 'true';
      const pick = await page.locator('[data-testid=kosmo-options] button:has-text("קוסמו בחר")').first().getAttribute('data-testid');
      if (onKosmo) await onKosmo({ prompt, ok, pick });
      await click(ok ? '[data-testid=kosmo-right]' : '[data-testid=kosmo-wrong]');
      if (ok) {
        await click('[data-testid=next-btn]');
        return { prompt, kind: 'alone', pick };
      }
      await click('[data-testid=options] button[data-correct=true]');
      await click('[data-testid=next-btn]');
      return { prompt, kind: 'kosmo-wrong', pick };
    }
    await click('[data-testid=options] button[data-correct=true]');
    await click('[data-testid=next-btn]');
    return { prompt, kind: 'asks' };
  }

  async function doMission(onStep) {
    await click('[data-testid=next-btn]'); // intro
    const log = [];
    for (let g = 0; g < 12; g++) {
      if (await exists('[data-testid=mission-done]')) break;
      if (onStep) await onStep();
      log.push(await missionStep());
    }
    await click('[data-testid=next-btn]');
    return log;
  }

  /** Kosmo asks for a reminder when entering a station (spaced retrieval). */
  async function doReminder() {
    for (let g = 0; g < 6; g++) {
      if ((await stepType()) !== 'reminder') return;
      await click('[data-testid=options] button[data-correct=true]');
      await click('[data-testid=next-btn]');
    }
  }

  async function doSpell() {
    const s0 = await stepId();
    for (let g = 0; g < 6; g++) {
      if ((await stepId()) !== s0) return;
      for (let k = 0; k < 8; k++) {
        if ((await page.getAttribute('[data-testid=next-btn]', 'aria-disabled')) !== 'true') break;
        const nxt = page.locator('[data-testid=spell-tiles] button[data-next=true]').first();
        if (!(await nxt.count())) break;
        await nxt.click();
        await sleep(300);
      }
      await sleep(600);
      await click('[data-testid=next-btn]');
    }
  }

  async function doBuild() {
    const s0 = await stepId();
    for (let g = 0; g < 6; g++) {
      if ((await stepId()) !== s0) return;
      for (let k = 0; k < 8; k++) {
        if ((await page.getAttribute('[data-testid=next-btn]', 'aria-disabled')) !== 'true') break;
        const nxt = page.locator('[data-testid=build-chips] button[data-next=true]').first();
        if (!(await nxt.count())) break;
        await nxt.click();
        await sleep(300);
      }
      await sleep(600);
      await click('[data-testid=next-btn]');
    }
  }

  async function doFill() {
    const s0 = await stepId();
    for (let g = 0; g < 8; g++) {
      if ((await stepId()) !== s0) return;
      await click('[data-testid=fill-bank] button[data-correct=true]');
      await click('[data-testid=next-btn]');
    }
  }

  /** Kosmo's mix-ups. mode(roundId) → 'right' (answer well) or 'misjudge' (make one mistake first). */
  async function doMixup(mode = () => 'right', onRound) {
    const s0 = await stepId();
    for (let g = 0; g < 14; g++) {
      if ((await stepId()) !== s0) return;
      if (await exists('[data-testid=mixup-summary]')) {
        await click('[data-testid=next-btn]');
        return;
      }
      if (!(await exists('[data-testid=mixup-round]'))) {
        await sleep(400);
        continue;
      }
      const rid = await page.getAttribute('[data-testid=mixup-round]', 'data-round');
      const kind = await page.getAttribute('[data-testid=mixup-round]', 'data-mode');
      const misjudge = mode(rid) === 'misjudge';
      if (onRound) await onRound(rid, 'start', kind);
      if (kind === 'gap') {
        if (misjudge) await click('[data-testid=mixup-choices] button[data-correct=false]');
        await click('[data-testid=mixup-choices] button[data-correct=true]');
      } else {
        await click(kind === 'right' !== misjudge ? '[data-testid=judge-right]' : '[data-testid=judge-wrong]');
        if ((await page.getAttribute('[data-testid=mixup-round]', 'data-stage')) === 'find') {
          if (onRound) await onRound(rid, 'find', kind);
          await click('[data-testid=mixup-sentence] [data-wrong=true]');
          if (onRound) await onRound(rid, 'fix', kind);
          await click('[data-testid=mixup-choices] button[data-correct=true]');
        }
      }
      if (onRound) await onRound(rid, 'done', kind);
      await click('[data-testid=next-btn]');
    }
  }

  async function playUnit(hooks = {}) {
    for (let g = 0; g < 40; g++) {
      const id = await stepId();
      const type = await stepType();
      if (hooks.each) await hooks.each(id, type);
      if (hooks[id]) {
        await hooks[id]();
        continue;
      }
      if (type === 'discover') await click('[data-testid=next-btn]');
      else if (type === 'practice' || type === 'sentence') await answerQuestions();
      else if (type === 'teach') await doTeach();
      else if (type === 'spell') await doSpell();
      else if (type === 'build') await doBuild();
      else if (type === 'says' || type === 'read') await answerQuestions();
      else if (type === 'fill') await doFill();
      else if (type === 'mixup') await doMixup();
      else if (type === 'play') await doMission();
      else if (type === 'reminder') await doReminder();
      else if (type === 'summary') return;
    }
  }
  return { click, save, stepId, stepType, text, exists, overflowX, answerQuestions, doTeach, doMission, missionStep, doReminder, doBuild, doSpell, doFill, doMixup, playUnit };
}

async function startNewGame(page, h, level = 1) {
  await page.goto(BASE_URL);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await h.click('[data-testid=start-btn]');
  await h.click(`[data-testid=level-${level}]`);
  await h.click('[data-testid=intro-next]');
  await h.click('[data-testid=intro-next]');
  await h.click('[data-testid=intro-start]');
}

async function gotoParents(page, h) {
  await h.click('[data-testid=home-btn]');
  if (await h.exists('[data-testid=home-btn]')) await h.click('[data-testid=home-btn]');
  await h.click('[data-testid=parents-btn]');
  const ans = await page.getAttribute('[data-testid=gate-input]', 'data-answer');
  await page.fill('[data-testid=gate-input]', ans);
  await h.click('[data-testid=gate-submit]');
}

// =========================================================================
// Desktop run — full play-through of all three units
// =========================================================================
const ctx = await browser.newContext({ viewport: { width: 1180, height: 900 }, locale: 'he-IL' });
const page = await ctx.newPage();
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(e.message));
const h = helpers(page);

// ---- Test 1: new game without registration
await page.goto(BASE_URL);
await page.evaluate(() => localStorage.clear());
await page.reload();
await sleep(500);
const inputsOnHome = await page.locator('input, textarea, select').count();
const hasStart = await h.exists('[data-testid=start-btn]');
await page.screenshot({ path: SHOTS + 'd01-home.png' });
await h.click('[data-testid=start-btn]');
const levelScreen = await h.exists('[data-testid=level-screen]');
const levelInputs = await page.locator('input, textarea, select').count();
await page.screenshot({ path: SHOTS + 'd01b-level.png', fullPage: true });
await h.click('[data-testid=level-1]');
await page.screenshot({ path: SHOTS + 'd02-intro.png' });
await h.click('[data-testid=intro-next]');
await h.click('[data-testid=intro-next]');
await h.click('[data-testid=intro-start]');
const inLab = await h.exists('[data-testid=lab-screen]');
record(1, 'פתיחת משחק חדש', 'דפדפן נקי, ללא שמירה', 'כניסה → "התחל משחק" → בחירת רמה לפי טווח גילים → היכרות → "בואו נתחיל"', 'הגעה למעבדה בלי הרשמה ובלי שדות קלט', `כפתור התחלה: ${hasStart}, שדות קלט במסך הפתיחה ובבחירת הרמה: ${inputsOnHome + levelInputs}, מסך בחירת רמה (ללא שאלת גיל מדויק): ${levelScreen}, הגיע למעבדה: ${inLab}`, hasStart && inputsOnHome === 0 && levelInputs === 0 && levelScreen && inLab);
await page.screenshot({ path: SHOTS + 'd03-lab.png' });
const workshopLockedAtStart = (await page.getAttribute('[data-testid=workshop-card]', 'data-open')) === 'false';

// ---- Section 15: locked unit
await h.click('[data-testid=station-colors]');
const lockedLine = await h.text('[data-testid=alien-line]');
note('ניסיון לגשת ליחידה נעולה', `נשאר במעבדה והחייזר אומר: "${lockedLine.slice(0, 60)}…"`, lockedLine.includes('נעולה') && (await h.exists('[data-testid=lab-screen]')));

// ---- Test 2: Hebrew + RTL
await h.click('[data-testid=station-earth]');
const dirInfo = await page.evaluate(() => {
  const en = document.querySelector('[data-testid=alien-line] bdi.en');
  return { dir: document.documentElement.dir, lang: document.documentElement.lang, enDir: en ? getComputedStyle(en).direction : null, line: document.querySelector('[data-testid=alien-line]')?.textContent };
});
const hasHebrew = /[֐-׿]/.test(dirInfo.line ?? '');
record(2, 'הוראות בעברית וכיוון כתיבה', 'מסך גילוי המילה הראשונה', 'בדיקת dir/lang של הדף ושל מילה באנגלית בתוך משפט', 'דף RTL בעברית; מילה אנגלית מוצגת LTR', `dir=${dirInfo.dir}, lang=${dirInfo.lang}, טקסט עברי: ${hasHebrew}, כיוון המילה האנגלית: ${dirInfo.enDir}`, dirInfo.dir === 'rtl' && dirInfo.lang === 'he' && hasHebrew && dirInfo.enDir === 'ltr');

// ---- Test 3: new word
const img = await h.exists('[data-testid=discover-step] svg[aria-label="תפוח אדום"]');
const enWord = (await page.locator('[data-testid=discover-step] bdi.en').allInnerTexts()).join(' ');
const heMeaning = await h.text('[data-testid=hebrew-meaning]');
record(3, 'הצגת מילה חדשה', 'שלב הגילוי של APPLE', 'צפייה במסך', 'תמונה, מילה באנגלית ותרגום', `תמונה: ${img}, מילה: ${enWord.includes('APPLE')}, תרגום: "${heMeaning}"`, img && enWord.includes('APPLE') && heMeaning === 'תפוח');
await page.screenshot({ path: SHOTS + 'd04-discover.png', fullPage: true });

// ---- Test 4 (part A): audio button on a device with no voices -> clear fallback
await h.click('[data-testid=word-speak]', 3200);
const fallback = await h.exists('[data-testid=discover-step] [data-testid=speech-fallback]');
const fallbackText = fallback ? await h.text('[data-testid=discover-step] [data-testid=speech-fallback]') : '';
const sayVisible = (await h.text('[data-testid=discover-step]')).includes('אֶפֶּל');
const audioA = fallback && sayVisible;
await h.click('[data-testid=next-btn]');

// ---- Test 5: correct practice
await page.waitForSelector('[data-testid=choice-question]');
const optCount1 = await page.locator('[data-testid=options] button.option').count();
await h.click('[data-testid=options] button[data-correct=true]');
const correctShown = await h.exists('[data-testid=options] .is-correct');
const praise = await h.text('[data-testid=alien-line]');
const nextLocked = await page.getAttribute('[data-testid=next-btn]', 'aria-disabled');
record(5, 'תרגול נכון', 'תרגול APPLE (2 אפשרויות)', 'בחירה בתמונה הנכונה', 'משוב חיובי ואפשרות להמשיך', `אפשרויות: ${optCount1}, סימון נכון: ${correctShown}, משוב: "${praise}", כפתור המשך נעול: ${nextLocked === 'true'}`, optCount1 === 2 && correctShown && praise.includes('כל הכבוד') && nextLocked !== 'true');
await h.click('[data-testid=next-btn]');

// ---- Test 7: help button shows a relevant hint (BALL)
await h.click('[data-testid=next-btn]'); // discover ball
await page.waitForSelector('[data-testid=choice-question]');
// Section 15: continue before answering (a child taps the greyed-out button)
await page.locator('[data-testid=next-btn]').click({ force: true });
await sleep(W);
const lockedMsg = await page.locator('text=קודם בוחרים תמונה').count();
note('לחיצה על "המשך" לפני שבחרו תשובה', `נשאר באותה שאלה והוצגה הודעה ידידותית: ${lockedMsg > 0}`, lockedMsg > 0 && (await h.stepId()) === 'ball-practice');
await h.click('[data-testid=help-btn]');
const hint1 = await h.exists('[data-testid=hint-panel][data-level="1"]');
const hintText = hint1 ? await h.text('[data-testid=hint-panel]') : '';
record(7, 'מתן רמז', 'תרגול BALL', 'לחיצה על "עזרה"', 'רמז שקשור לשאלה (לא הפתרון)', `רמז רמה 1: ${hint1}, תוכן: "${hintText.replace(/\s+/g, ' ')}", אין הדגשת תשובה: ${!(await h.exists('.is-highlight'))}`, hint1 && hintText.includes('BALL') && hintText.includes('כדור') && !(await h.exists('.is-highlight')));
await page.screenshot({ path: SHOTS + 'd05-hint.png', fullPage: true });
await h.click('[data-testid=options] button[data-correct=true]');
await h.click('[data-testid=next-btn]');

// ---- Test 6 + 8: wrong answer + graduated support (CAT)
await h.click('[data-testid=next-btn]'); // discover cat
await page.waitForSelector('[data-testid=choice-question]');
const stepBefore = await h.stepId();
const saveBefore = await h.save();
await h.click('[data-testid=options] button[data-correct=false]');
const wrongLine = await h.text('[data-testid=alien-line]');
const stillHere = (await h.stepId()) === stepBefore;
const saveAfter = await h.save();
record(6, 'תרגול שגוי', 'תרגול CAT', 'בחירה בתמונה שגויה', 'אין פסילה ואין חזרה להתחלה', `נשאר בשלב ${stepBefore}: ${stillHere}, משוב: "${wrongLine}", התקדמות היחידה לא השתנתה: ${JSON.stringify(saveBefore.game.doneSteps) === JSON.stringify(saveAfter.game.doneSteps)}`, stillHere && wrongLine.includes('לא נורא') && JSON.stringify(saveBefore.game.doneSteps) === JSON.stringify(saveAfter.game.doneSteps));
await page.screenshot({ path: SHOTS + 'd06-wrong.png', fullPage: true });
const lvl1 = await page.getAttribute('[data-testid=hint-panel]', 'data-level');
const line1 = await h.text('[data-testid=alien-line]');
await h.click('[data-testid=help-btn]');
const lvl2 = await page.getAttribute('[data-testid=hint-panel]', 'data-level');
const line2 = await h.text('[data-testid=alien-line]');
await h.click('[data-testid=help-btn]');
const lvl3 = await page.getAttribute('[data-testid=hint-panel]', 'data-level');
const line3 = await h.text('[data-testid=alien-line]');
const glow = await h.exists('[data-testid=options] .is-highlight');
await page.screenshot({ path: SHOTS + 'd07-demo.png', fullPage: true });
record(8, 'רמז מדורג', 'אחרי טעות ב-CAT', 'המשך התקשות: לחיצות נוספות על עזרה', 'כל פעם תמיכה אחרת ומוגברת', `רמות: ${lvl1}→${lvl2}→${lvl3}; הודעות שונות: ${new Set([line1, line2, line3]).size === 3}; הדגמה (תשובה זוהרת) ברמה 3: ${glow}`, lvl1 === '1' && lvl2 === '2' && lvl3 === '3' && new Set([line1, line2, line3]).size === 3 && glow);
await h.click('[data-testid=options] button[data-correct=true]');
const qKey1 = await page.getAttribute('[data-testid=choice-question]', 'data-question');
await h.click('[data-testid=next-btn]');
const qKey2 = await page.getAttribute('[data-testid=choice-question]', 'data-question');
note('קושי מתמשך → הדגמה ואז משימה קלה יותר ושונה', `שאלה ${qKey1} הוחלפה ב-${qKey2}`, qKey1 !== qKey2 && qKey2.includes('-easy'));
await h.click('[data-testid=options] button[data-correct=true]');
await h.click('[data-testid=next-btn]');

// DOG
await h.click('[data-testid=next-btn]');
await h.click('[data-testid=options] button[data-correct=true]');
await h.click('[data-testid=next-btn]');

// Mixed practice — section 15: rapid repeated taps
await page.waitForSelector('[data-testid=choice-question]');
const attemptsBeforeTap = (await h.save()).attempts.length;
const correctOpt = page.locator('[data-testid=options] button[data-correct=true]').first();
await correctOpt.click();
await correctOpt.click({ force: true }).catch(() => {});
await correctOpt.click({ force: true }).catch(() => {});
await sleep(W);
const attemptsAfterTap = (await h.save()).attempts.length;
note('לחיצות מהירות מרובות', `3 לחיצות מהירות נרשמו כ-${attemptsAfterTap - attemptsBeforeTap} ניסיון`, attemptsAfterTap - attemptsBeforeTap === 1);
await h.click('[data-testid=next-btn]');
await h.answerQuestions();

// ---- "Kosmo says" (level 1): find the word inside the lab scene
await page.waitForSelector('[data-testid=says-step]');
const sceneItems = await page.locator('[data-testid=options][data-layout=scene] button.option').count();
await h.click('[data-testid=options] button[data-correct=false]');
const saysHint = await h.exists('[data-testid=hint-panel]');
await page.screenshot({ path: SHOTS + 'd07b-says.png', fullPage: true });
await h.click('[data-testid=options] button[data-correct=true]');
const saysAttempt = (await h.save()).attempts.filter((a) => a.taskId.startsWith('earth-says')).map((a) => `${a.wordId}:${a.outcome}`);
await h.click('[data-testid=next-btn]');
await h.answerQuestions();
note('"קוסמו אומר" (גילי 6–7)', `פריטים בסצנה: ${sceneItems}; אחרי טעות הוצג רמז: ${saysHint}; נרשם: ${saysAttempt.join(', ')}`, sceneItems === 5 && saysHint && saysAttempt.includes('ball:wrong') && saysAttempt.includes('ball:correct'));

// ---- Teach DOG: partial understanding for nouns
await page.waitForSelector('[data-testid=teach-step]');
await page.screenshot({ path: SHOTS + 'd08-teach-dog.png', fullPage: true });
await h.click('[data-testid=teach-pool] button[data-testid="opt-dog.brown.normal.none"]');
const dogUnderstanding = await page.getAttribute('[data-testid=alien-thought]', 'data-understanding');
await h.doTeach();
// ---- First mission: Kosmo tries first, using only what the child taught him
await h.click('[data-testid=next-btn]'); // mission intro
const supplyLog = [];
for (let g = 0; g < 8; g++) {
  if (await h.exists('[data-testid=mission-done]')) break;
  supplyLog.push(
    await h.missionStep(async ({ prompt }) => {
      if (prompt === 'BALL') await page.screenshot({ path: SHOTS + 'd08b-kosmo-tries.png', fullPage: true });
    }),
  );
}
const soloSupply = await page.getAttribute('[data-testid=kosmo-solo]', 'data-solo');
await page.screenshot({ path: SHOTS + 'd08c-mission-done.png', fullPage: true });
await h.click('[data-testid=next-btn]');
const sSup = await h.save();
const logOf = (log, p) => log.find((x) => x.prompt === p);
note(
  'משימה: קוסמו מנסה ראשון לפי מה שלימדו אותו',
  `BALL (לא לימדו): ${logOf(supplyLog, 'BALL')?.kind}, בחר ${logOf(supplyLog, 'BALL')?.pick} (מתבלבל עם APPLE); APPLE: ${logOf(supplyLog, 'APPLE')?.kind} (כבר מכיר BALL, אז שואל); DOG (לימדו בשלב הלימוד): ${logOf(supplyLog, 'DOG')?.kind}; קוסמו לבד: ${soloSupply}; BALL נכנסה למילון: ${sSup.alien.lexicon.ball?.first}`,
  logOf(supplyLog, 'BALL')?.kind === 'kosmo-wrong' && logOf(supplyLog, 'BALL')?.pick?.startsWith('opt-apple') && logOf(supplyLog, 'APPLE')?.kind === 'asks' && logOf(supplyLog, 'DOG')?.kind === 'alone' && soloSupply === '1' && sSup.alien.lexicon.ball?.first === 'fix',
);
await page.waitForSelector('[data-testid=summary-step]');
await page.screenshot({ path: SHOTS + 'd09-summary.png', fullPage: true });
const unlockedShown = await h.exists('[data-testid=unlocked-next]');
note('סיכום יחידה מציג תחנה חדשה שנפתחה', `"תחנה חדשה נפתחה": ${unlockedShown}`, unlockedShown);

// ---- Test 15: save & reload
await h.click('[data-testid=back-to-lab]');
await page.reload();
await sleep(600);
const cont = await h.exists('[data-testid=continue-btn]');
await h.click('[data-testid=continue-btn]');
const earthStatus = await page.getAttribute('[data-testid=station-earth]', 'data-status');
const colorsStatus = await page.getAttribute('[data-testid=station-colors]', 'data-status');
record(15, 'שמירת התקדמות', 'אחרי השלמת יחידה 1', 'רענון הדף → "המשך משחק"', 'ההתקדמות נשמרה', `כפתור "המשך משחק": ${cont}, יחידה 1: ${earthStatus}, יחידה 2: ${colorsStatus}`, cont && earthStatus === 'completed' && colorsStatus === 'available');

// ---- Teach & Unlock: after station 1 Kosmo knows enough words → his workshop opens
const workshopOpenNow = (await page.getAttribute('[data-testid=workshop-card]', 'data-open')) === 'true';
await h.click('[data-testid=workshop-card]');
await page.waitForSelector('[data-testid=command-builder]');
const chipState = await page.locator('[data-testid=command-builder] button[data-unlocked]').evaluateAll((b) => b.map((x) => `${x.dataset.testid.replace('chip-', '')}:${x.dataset.unlocked}`));
await h.click('[data-testid=chip-ball]');
const ballMatches = await page.getAttribute('[data-testid=command-status]', 'data-matches');
const sendLockedForBall = (await page.getAttribute('[data-testid=send-command]', 'aria-disabled')) === 'true';
await h.click('[data-testid=chip-ball]'); // un-pick
await h.click('[data-testid=chip-dog]');
const dogMatches = await page.getAttribute('[data-testid=command-status]', 'data-matches');
await page.screenshot({ path: SHOTS + 'd09b-workshop.png', fullPage: true });
await h.click('[data-testid=send-command]');
const kosmoOkInWorkshop = (await page.getAttribute('[data-testid=kosmo-right]', 'data-kosmo-correct')) === 'true';
await h.click('[data-testid=kosmo-right]');
const partShown = await h.exists('[data-testid=new-part]');
await page.screenshot({ path: SHOTS + 'd09c-workshop-part.png', fullPage: true });
const sWs = await h.save();
note(
  'הידע פותח אפשרויות: הסדנה של קוסמו',
  `במעבדה בהתחלה הסדנה נעולה: ${workshopLockedAtStart}; אחרי תחנה 1 נפתחה: ${workshopOpenNow}; מילים בהוראות: ${chipState.join(', ')}; "BALL" מתאים ל-${ballMatches} דברים (שליחה נעולה: ${sendLockedForBall}); "DOG" מתאים ל-${dogMatches}; קוסמו עשה לבד: ${kosmoOkInWorkshop}; חלק חדש לחללית: ${partShown}; נשמר: ${JSON.stringify(sWs.game.workshopParts)}`,
  workshopLockedAtStart && workshopOpenNow && chipState.includes('ball:true') && chipState.includes('red:false') && ballMatches === '2' && sendLockedForBall && dogMatches === '1' && kosmoOkInWorkshop && partShown && sWs.game.workshopParts.includes('dog'),
);
await h.click('[data-testid=home-btn]');

// ---- Unit 2 up to teach-red
let brainChangeInfo = null;
await h.click('[data-testid=station-colors]');
await h.playUnit({
  'teach-red': async () => {
    // Test 10: teaching updates the knowledge model
    const guessBefore = await page.getAttribute('[data-testid=alien-thought]', 'data-guess');
    await h.click('[data-testid=teach-pool] button[data-testid="opt-apple.red.normal.none"]');
    const guessAfter = await page.getAttribute('[data-testid=alien-thought]', 'data-guess');
    const s1 = await h.save();
    record(10, 'לימוד החייזר', 'מסך "ללמד את קוסמו" RED, החייזר לא יודע דבר', 'בחירת תפוח אדום כדוגמה', 'מצב הידע הפנימי מתעדכן', `השערה לפני: "${guessBefore}", אחרי: "${guessAfter}", דוגמאות שמורות: ${JSON.stringify(s1.alien.concepts.red.examples)}`, guessBefore === '' && guessAfter === 'kind:apple' && s1.alien.concepts.red.examples[0] === 'apple.red.normal.none');
    // Test 11: partial understanding
    const und = await page.getAttribute('[data-testid=alien-thought]', 'data-understanding');
    record(11, 'הבנה חלקית', 'אחרי דוגמה אחת (תפוח אדום)', 'בדיקת מצב ההבנה', 'מצב מוגדר מראש של הבנה חלקית/שגויה', `RED אחרי תפוח אדום: ${und} ("RED = תפוח"); DOG אחרי כלב חום אחד: ${dogUnderstanding}`, und === 'misconception' && dogUnderstanding === 'partial');
    await page.screenshot({ path: SHOTS + 'd10-teach-red.png', fullPage: true });
    // A non-example is not learned
    await h.click('[data-testid=teach-pool] button[data-testid="opt-ball.blue.normal.none"]');
    const s2 = await h.save();
    note('דוגמה לא מתאימה לא נלמדת', `כדור כחול נדחה: ${s2.alien.concepts.red.rejected.includes('ball.blue.normal.none')}, דוגמאות: ${s2.alien.concepts.red.examples.length}`, s2.alien.concepts.red.examples.length === 1 && s2.alien.concepts.red.rejected.includes('ball.blue.normal.none'));
    await h.click('[data-testid=start-test-btn]');
    // Test 12: the alien acts from its knowledge (deterministic)
    await page.waitForSelector('[data-testid=alien-choice]', { timeout: 8000 });
    const choice1 = await page.locator('[data-testid=test-scene] button:has([data-testid=alien-choice])').getAttribute('data-testid');
    const scene1 = await page.locator('[data-testid=test-scene] button').evaluateAll((b) => b.map((x) => x.dataset.testid));
    await page.screenshot({ path: SHOTS + 'd11-test-red.png', fullPage: true });
    // Section 15: refresh while the alien is acting
    await page.reload();
    await h.click('[data-testid=continue-btn]');
    await h.click('[data-testid=station-colors]');
    await page.waitForSelector('[data-testid=alien-choice]', { timeout: 8000 });
    const choice2 = await page.locator('[data-testid=test-scene] button:has([data-testid=alien-choice])').getAttribute('data-testid');
    const c = choice1.replace('opt-', '').split('.');
    record(12, 'בדיקת החייזר', 'החייזר חושב ש-RED = תפוח', 'החייזר מתבקש למצוא משהו RED', 'בחירה לפי מה שנלמד, לא אקראית', `סצנה: ${scene1.join(', ')}; החייזר בחר ${choice1} (תפוח שאינו אדום); אחרי רענון באמצע הבדיקה בחר שוב ${choice2}`, c[0] === 'apple' && c[1] !== 'red' && choice1 === choice2);
    note('רענון הדפדפן בזמן שהחייזר מבצע פעולה', `חזרה לאותו שלב בדיקה, אותה בחירה (${choice2})`, choice1 === choice2);
    await h.click('[data-testid=judge-wrong]');
    await h.click('[data-testid=help-alien-btn]');
    // Diagnosis: what does Kosmo think RED means?
    await page.waitForSelector('[data-testid=diagnose-options]');
    const diagOpts = await page.locator('[data-testid=diagnose-options] button').evaluateAll((b) => b.map((x) => `${x.innerText.trim()}${x.dataset.correct === 'true' ? '✓' : ''}`));
    await page.screenshot({ path: SHOTS + 'd11b-diagnose.png', fullPage: true });
    await h.click('[data-testid=diagnose-options] button[data-correct=false]');
    const diagHint = await h.text('[data-testid=alien-line]');
    await h.click('[data-testid=diagnose-options] button[data-correct=true]');
    const sDiag = await h.save();
    const diagAttempts = sDiag.attempts.filter((a) => a.taskType === 'diagnose_kosmo').map((a) => `${a.outcome}${a.independent ? '(לבד)' : ''}`);
    note('אבחון לפני תיקון: מה קוסמו לא מבין?', `אפשרויות: ${diagOpts.join(' / ')}; אחרי תשובה שגויה: "${diagHint.replace(/\s+/g, ' ').slice(0, 70)}…"; נרשם: ${diagAttempts.join(', ')}`, diagOpts.includes('תפוח✓') && diagOpts.some((o) => o.startsWith('הצבע האדום')) && diagAttempts.includes('wrong') && diagAttempts.some((a) => a.startsWith('correct')) && !diagAttempts.includes('correct(לבד)'));
    const rq = await page.getAttribute('[data-testid=repair-question]', 'data-question');
    await page.screenshot({ path: SHOTS + 'd12-repair.png', fullPage: true });
    // Test 13: corrective example changes knowledge and the next test
    const invalidOpt = await page.locator('[data-testid=repair-options] button').evaluateAll((b) => b.map((x) => x.dataset.testid).find((id) => !id.includes('.red.')));
    if (invalidOpt) await h.click(`[data-testid="${invalidOpt}"]`);
    const hintAfterBad = await h.exists('[data-testid=hint-panel]');
    await h.click('[data-testid=repair-options] button[data-correct=true]');
    const bc = await page.locator('[data-testid=brain-change]').first();
    brainChangeInfo = { before: await bc.getAttribute('data-before'), after: await bc.getAttribute('data-after') };
    await page.screenshot({ path: SHOTS + 'd12b-brain-change.png', fullPage: true });
    const und2 = await page.getAttribute('[data-testid=alien-thought]', 'data-understanding');
    const guess2 = await page.getAttribute('[data-testid=alien-thought]', 'data-guess');
    await h.click('[data-testid=retest-btn]');
    await page.waitForSelector('[data-testid=alien-choice]', { timeout: 8000 });
    const choice3 = await page.locator('[data-testid=test-scene] button:has([data-testid=alien-choice])').getAttribute('data-testid');
    const c3 = choice3.replace('opt-', '').split('.');
    await h.click('[data-testid=judge-right]');
    await h.click('[data-testid=next-btn]');
    const aha = await h.text('[data-testid=alien-line]');
    await page.screenshot({ path: SHOTS + 'd13-aha.png', fullPage: true });
    const s3 = await h.save();
    record(13, 'תיקון טעות', 'החייזר טעה ובחר תפוח לא אדום', 'בחירת דוגמה לא מתאימה ואז כדור/מכונית אדומים', 'הידע משתנה והתגובה בבדיקה הבאה משתנה', `שאלת תיקון: "${rq}"; רמז אחרי דוגמה לא מתאימה: ${hintAfterBad}; אחרי התיקון: ${und2} (${guess2}); בבדיקה החוזרת בחר ${choice3}; תגובה: "${aha}"; יכולת: ${s3.alien.abilities.includes('sort-colors')}`, rq.includes('RED זה תפוח') && und2 === 'understood' && c3[1] === 'red' && c3[0] !== 'apple' && aha.includes('RED זה הצבע האדום, לא תפוח') && s3.alien.abilities.includes('sort-colors'));
    await h.click('[data-testid=next-btn]');
  },
  'play-colors': async () => {
    // Test 14: mission combining words from units 1 and 2
    await h.click('[data-testid=next-btn]');
    // RED APPLE: RED was taught in the teach step, APPLE was shown in the first mission → Kosmo does it alone
    const kosmoFirst = await h.exists('[data-testid=mission-kosmo][data-stage=kosmo]');
    const kosmoOk = (await page.getAttribute('[data-testid=mission-kosmo]', 'data-kosmo-correct')) === 'true';
    const kosmoPick = await page.locator('[data-testid=kosmo-options] button:has-text("קוסמו בחר")').first().getAttribute('data-testid');
    await page.screenshot({ path: SHOTS + 'd14a-kosmo-alone.png', fullPage: true });
    await h.click('[data-testid=kosmo-right]');
    await h.click('[data-testid=next-btn]');
    const sConf = await h.save();
    const conf = sConf.attempts.filter((a) => a.taskType === 'check_alien' && a.taskId.startsWith('m-colors'));
    // BLUE BALL: Kosmo knows RED, so BLUE must be something else → he asks the child (per-word analysis below)
    const askLine = await h.text('[data-testid=alien-line]');
    const before = await h.save();
    await h.click('[data-testid=options] button[data-testid="opt-ball.red.normal.none"]');
    const after = await h.save();
    note('ניתוח לפי מילה במשימה משולבת', `בחירת כדור אדום ל-BLUE BALL: BLUE שגויים ${before.learning.blue.wrong}→${after.learning.blue.wrong}, BALL שגויים ${before.learning.ball.wrong}→${after.learning.ball.wrong}`, after.learning.blue.wrong === before.learning.blue.wrong + 1 && after.learning.ball.wrong === before.learning.ball.wrong);
    note(
      'קוסמו עושה לבד את מה שלימדו אותו, ושואל על מה שלא',
      `RED APPLE: קוסמו ניסה לבד: ${kosmoFirst}, בחר ${kosmoPick}, נכון: ${kosmoOk}; אישור הילד נרשם כ"בתמיכה" (לא עצמאי): ${conf.length > 0 && conf.every((a) => !a.independent && a.hintTypes.includes('shown_by_kosmo'))}; BLUE BALL: "${askLine.replace(/\s+/g, ' ')}"`,
      kosmoFirst && kosmoOk && kosmoPick === 'opt-apple.red.normal.none' && conf.length > 0 && conf.every((a) => !a.independent && a.hintTypes.includes('shown_by_kosmo')) && askLine.includes('RED'),
    );
    await page.screenshot({ path: SHOTS + 'd14-mission.png', fullPage: true });
    await h.click('[data-testid=options] button[data-correct=true]');
    await h.click('[data-testid=next-btn]');
    for (let g = 0; g < 8; g++) {
      if (await h.exists('[data-testid=mission-done]')) break;
      await h.missionStep();
    }
    const done = await h.exists('[data-testid=mission-done]');
    await page.screenshot({ path: SHOTS + 'd15-mission-done.png', fullPage: true });
    await h.click('[data-testid=next-btn]');
    const s = await h.save();
    record(14, 'משימת יישום', 'משימת "מכונת הצבעים" (RED APPLE, BLUE BALL, BIG DOG, BIG YELLOW BALL)', 'השלמת 4 שלבים, כולל טעות אחת', 'המשימה מושלמת ומשפיעה על מצב המשחק', `המשימה הושלמה: ${done}; נשמרה: ${s.game.completedMissions.includes('m-colors')}; פרס במלאי: ${s.game.inventory.includes('color-machine')}`, done && s.game.completedMissions.includes('m-colors') && s.game.inventory.includes('color-machine'));
  },
});
await h.click('[data-testid=back-to-lab]');

// ---- Unit 3
const noReviewYet = !(await h.exists('[data-testid=review-station]'));
await h.click('[data-testid=station-lab]');
await h.playUnit({
  'sentence-open-door': async () => {
    await page.screenshot({ path: SHOTS + 'd16-sentence.png', fullPage: true });
    await h.answerQuestions();
  },
  'play-door': async () => {
    await h.click('[data-testid=next-btn]');
    let doorStates = [];
    const doorLog = [];
    for (let g = 0; g < 8; g++) {
      if (await h.exists('[data-testid=mission-done]')) break;
      doorStates.push(await page.getAttribute('[data-testid=mission-scene]', 'data-door'));
      doorLog.push(await h.missionStep());
      if (await h.exists('[data-testid=mission-scene]')) doorStates.push(await page.getAttribute('[data-testid=mission-scene]', 'data-door'));
    }
    await page.screenshot({ path: SHOTS + 'd17-door-done.png', fullPage: true });
    note('פעולה במשימה משנה את העולם (דלת)', `מצבי הדלת לאורך המשימה: ${[...new Set(doorStates.filter(Boolean))].join(' → ')}`, doorStates.includes('open'));
    const rb = doorLog.find((x) => x.prompt === 'RED BALL');
    note('תיקון של קוסמו משנה את מה שהוא עושה בהמשך', `במשימה הראשונה קוסמו לקח תפוח במקום BALL ותוקן; במשימה השלישית, RED BALL: ${rb?.kind} (בחר ${rb?.pick}); קוסמו לבד במשימה: ${doorLog.filter((x) => x.kind === 'alone').length}/${doorLog.length}`, rb?.kind === 'alone' && rb?.pick === 'opt-ball.red.normal.none');
    await h.click('[data-testid=next-btn]');
  },
});
await page.screenshot({ path: SHOTS + 'd18-final-summary.png', fullPage: true });
await h.click('[data-testid=back-to-lab]');

// ---- Test 16: delayed review
const reviewBefore = await h.exists('[data-testid=review-station]');
await gotoParents(page, h);
await h.click('[data-testid=time-travel]');
await h.click('[data-testid=home-btn]');
await h.click('[data-testid=continue-btn]');
const reviewAfter = await h.exists('[data-testid=review-station]');
await page.screenshot({ path: SHOTS + 'd19-lab-review.png', fullPage: true });
await h.click('[data-testid=review-station]');
let reviewed = 0;
const memoryInfo = [];
for (let g = 0; g < 6; g++) {
  if (await h.exists('[data-testid=review-done]')) break;
  if (g === 0) await page.screenshot({ path: SHOTS + 'd20-review.png', fullPage: true });
  memoryInfo.push(`${await page.getAttribute('[data-testid=review-screen]', 'data-word')}:${await page.getAttribute('[data-testid=review-screen]', 'data-mode')}:${await page.getAttribute('[data-testid=review-screen]', 'data-new-context')}`);
  await h.click('[data-testid=options] button[data-correct=true]');
  await h.click('[data-testid=next-btn]');
  reviewed++;
}
const sR = await h.save();
const delayed = Object.values(sR.learning).flatMap((w) => w.delayedReviews);
record(16, 'חזרה מאוחרת', 'סיום 3 היחידות', 'בדיקה מיידית, ואז הזזת שעון המשחק ביום (כלי מפתחים מסומן)', 'אין חזרה מיד אחרי הלמידה; אחרי מרווח מוצע תרגול חוזר', `תחנת זיכרון מיד אחרי הלמידה: ${!noReviewYet || reviewBefore}; אחרי יום: ${reviewAfter}; שאלות חזרה: ${reviewed}; חזרות מאוחרות שנשמרו: ${delayed.length}`, noReviewYet && !reviewBefore && reviewAfter && delayed.length === reviewed && reviewed > 0);
note('משימת זיכרון בהקשר חדש', `מילה:סוג שאלה:תמונה חדשה — ${memoryInfo.join(', ')}`, memoryInfo.length > 0 && memoryInfo.every((x) => x.endsWith(':picture_to_word:true')));
await h.click('[data-testid=back-to-lab]');

// ---- Mastery map: five milestones from real actions only
await h.click('[data-testid=mastery-btn]');
await page.waitForSelector('[data-testid=mastery-screen]');
await page.screenshot({ path: SHOTS + 'd20b-mastery.png', fullPage: true });
const sM = await h.save();
const msCount = async (m) => Number(await page.getAttribute(`[data-testid=ms-sum-${m}]`, 'data-count'));
const ms = { meaning: await msCount('meaning'), alone: await msCount('alone'), recall: await msCount('recall'), context: await msCount('context'), later: await msCount('later') };
const laterData = Object.values(sM.learning).filter((w) => w.delayedReviews.some((r) => r.result === 'independent')).length;
const aloneData = Object.values(sM.learning).filter((w) => w.introduced && w.independentCorrect > 0).length;
note('מפת שליטה: 5 שלבים לפי פעולות אמיתיות', `מכיר ${ms.meaning}, לבד ${ms.alone}, נזכר ${ms.recall}, במשפט/משימה ${ms.context}, אחרי זמן ${ms.later} | בנתונים: לבד ${aloneData}, אחרי זמן ${laterData}`, ms.meaning === 12 && ms.alone === aloneData && ms.later === laterData && ms.later > 0 && ms.recall > 0 && ms.context > 0 && ms.later <= ms.alone);
await h.click('[data-testid=home-btn]');

// ---- Test 9 + 17: data in the parents area
await gotoParents(page, h);
await page.screenshot({ path: SHOTS + 'd21-parents.png', fullPage: true });
const s9 = await h.save();
const ui = await page.evaluate(() => {
  const n = (id) => Number(document.querySelector(`[data-testid=${id}] span`)?.textContent);
  return { units: n('stat-units'), exposed: n('stat-exposed'), indep: n('stat-independent'), practice: n('stat-practice'), reviews: n('stat-reviews'), indepApple: Number(document.querySelector('[data-testid=indep-apple]').textContent), hintedBall: Number(document.querySelector('[data-testid=hinted-ball]').textContent), levelBall: document.querySelector('[data-testid=row-ball]').dataset.level, levelApple: document.querySelector('[data-testid=row-apple]').dataset.level };
});
const attemptsBall = s9.attempts.filter((a) => a.wordId === 'ball' && a.taskId === 'ball-q1');
const attemptsApple = s9.attempts.filter((a) => a.wordId === 'apple' && a.taskId === 'apple-q1');
record(9, 'הבחנה בין עזרה לעצמאות', 'APPLE נענתה לבד, BALL אחרי לחיצה על עזרה', 'קריאת הנתונים שנשמרו', 'הצלחה עם רמז נשמרת אחרת מהצלחה בלי רמז', `APPLE: independent=${attemptsApple[0]?.independent}, hintUsed=${attemptsApple[0]?.hintUsed}; BALL: independent=${attemptsBall[0]?.independent}, hintUsed=${attemptsBall[0]?.hintUsed}, hintTypes=${JSON.stringify(attemptsBall[0]?.hintTypes)}`, attemptsApple[0]?.independent === true && attemptsBall[0]?.independent === false && attemptsBall[0]?.hintUsed === true);
const exp = {
  units: s9.game.completedUnits.length,
  exposed: Object.values(s9.learning).filter((w) => w.introduced).length,
  indep: Object.values(s9.learning).filter((w) => w.independentCorrect > 0).length,
  reviews: Object.values(s9.learning).reduce((n, w) => n + w.delayedReviews.length, 0),
};
record(17, 'נתוני למידה', 'אחרי משחק מלא + חזרה', 'השוואת מסך ההורים לנתונים שנשמרו בפועל', 'המספרים תואמים לפעולות', `מסך: יחידות ${ui.units}, נחשף ${ui.exposed}, ללא רמז ${ui.indep}, חזרות ${ui.reviews} | נתונים: ${exp.units}, ${exp.exposed}, ${exp.indep}, ${exp.reviews}; BALL עם רמז=${ui.hintedBall}`, ui.units === 3 && ui.units === exp.units && ui.exposed === 12 && ui.exposed === exp.exposed && ui.indep === exp.indep && ui.reviews === exp.reviews && ui.hintedBall >= 1);

// ---- Brain screen screenshot
await h.click('[data-testid=home-btn]');
await h.click('[data-testid=continue-btn]');
await h.click('[data-testid=brain-btn]');
await page.screenshot({ path: SHOTS + 'd22-brain.png', fullPage: true });
const redLinks = await page.getAttribute('[data-testid=brain-map-red]', 'data-links');
const timelineN = Number(await page.getAttribute('[data-testid=brain-timeline]', 'data-count'));
const mixupCards = await page.locator('[data-testid^=brain-][data-category=mixup]').count();
note(
  'המוח השקוף של קוסמו',
  `RED במוח: ${redLinks}; בתיקון הוצג שינוי: ${brainChangeInfo?.before} → ${brainChangeInfo?.after}; שינויים אחרונים במוח: ${timelineN}; מילים שקוסמו עוד מתבלבל בהן: ${mixupCards}`,
  !!redLinks && redLinks.includes('guess:color:red') && redLinks.includes('cut:kind:apple') && brainChangeInfo?.before === 'kind:apple' && brainChangeInfo?.after === 'color:red' && timelineN > 0,
);
await h.click('[data-testid=home-btn]');

// ---- Levels: raising the level mid-game adds the new words, nothing is lost
await gotoParents(page, h);
await h.click('[data-testid=parent-level-2]');
await h.click('[data-testid=home-btn]');
await h.click('[data-testid=continue-btn]');
const chip = await h.text('[data-testid=level-chip]');
const newBadges = await page.locator('[data-testid^=new-words-]').count();
await page.screenshot({ path: SHOTS + 'd23-lab-level2.png', fullPage: true });
await h.click('[data-testid=station-earth]');
// A day has passed (time travel above): words due for review → Kosmo asks for a reminder first.
let reminderInfo = null;
if ((await h.stepType()) === 'reminder') {
  const word = await page.getAttribute('[data-testid=reminder-step]', 'data-word');
  const shownBefore = await page.locator('[data-testid=reminder-step] [data-testid=options] button[data-correct]').evaluateAll((b) => b.map((x) => x.dataset.testid));
  const before = await h.save();
  await page.screenshot({ path: SHOTS + 'd23c-reminder.png', fullPage: true });
  await h.doReminder();
  const after = await h.save();
  reminderInfo = {
    word,
    options: shownBefore.length,
    delayed: after.learning[word].delayedReviews.length - before.learning[word].delayedReviews.length,
    reminded: after.alien.lexicon[word]?.reminded ?? 0,
    attempts: after.attempts.filter((a) => a.taskId === `remind:${word}`).length,
  };
}
note('חזרה מרווחת בתוך המשחק: קוסמו מבקש תזכורת', `בכניסה לתחנה אחרי יום: ${reminderInfo ? `מילה ${reminderInfo.word}, ${reminderInfo.options} מילים לבחירה מול תמונה (המילה לא מוצגת מראש); נרשמה חזרה מאוחרת: ${reminderInfo.delayed}; קוסמו "נזכר": ${reminderInfo.reminded}` : 'לא הופיעה'}`, !!reminderInfo && reminderInfo.delayed === 1 && reminderInfo.attempts >= 1 && reminderInfo.reminded >= 1);
const firstNew = await h.stepId();
let l2Fill = null;
let l2Spell = [];
let l2Example = '';
let l2Kosmo = '';
let l2Review = false;
await h.playUnit({
  'car-discover': async () => {
    l2Example = (await h.exists('[data-testid=discover-example]')) ? await h.text('[data-testid=discover-example]') : '';
    await page.screenshot({ path: SHOTS + 'd23a-discover-example.png', fullPage: true });
    await h.click('[data-testid=next-btn]');
  },
  'earth-kosmo': async () => {
    l2Review = await h.exists('[data-testid=mixup-round]');
    await h.doMixup();
  },
  'earth-fill': async () => {
    await page.screenshot({ path: SHOTS + 'd23b-fill.png', fullPage: true });
    await h.click('[data-testid=fill-bank] button[data-correct=false]');
    const tip = (await h.exists('[data-testid=hint-panel]')) ? await h.text('[data-testid=hint-panel]') : '';
    const s0 = await h.save();
    await h.doFill();
    const s1 = await h.save();
    l2Fill = { tip, catWrong: s0.learning.cat.wrong, filled: s1.attempts.filter((a) => a.taskType === 'fill_blank' && a.completed).map((a) => a.wordId) };
  },
  'earth-spell': async () => {
    for (let g = 0; g < 4; g++) {
      if (!(await h.exists('[data-testid=spell-word]'))) break;
      l2Spell.push(await page.getAttribute('[data-testid=spell-word]', 'data-word'));
      if (!l2Kosmo && (await h.exists('[data-testid=kosmo-spelling]'))) l2Kosmo = await h.text('[data-testid=kosmo-spelling]');
      await h.doSpell();
      if ((await h.stepId()) !== 'earth-spell') break;
    }
  },
});
note('רמה 2: השלמת משפט ממאגר מילים', `אחרי בחירה שגויה הוצג טיפ: "${l2Fill?.tip.replace(/\s+/g, ' ')}"; נרשמה טעות ל-CAT: ${l2Fill?.catWrong}; הושלמו: ${l2Fill?.filled.join(', ')}`, !!l2Fill && l2Fill.tip.length > 0 && l2Fill.catWrong >= 1 && l2Fill.filled.includes('cat') && l2Fill.filled.includes('hat'));
note('רמה 2: איות מילים קצרות (CVC)', `מילים לאיות: ${l2Spell.join(', ')}; קוסמו כתב קודם: "${l2Kosmo.replace(/\s+/g, ' ').trim()}"`, l2Spell[0] === 'cat' && l2Kosmo.includes('KAT'));
note('רמה 2: מילה חדשה במשפט, וסבב "קוסמו מתבלבל" באמצע התחנה', `משפט לדוגמה ב-CAR: "${l2Example.replace(/\s+/g, ' ').trim()}"; סבב קוסמו במקום תרגול מעורב: ${l2Review}`, l2Example.includes('I HAVE A RED CAR') && l2Review);
const sL2 = await h.save();
note('העלאת רמה באמצע המשחק (1→2)', `תג רמה: "${chip.trim()}"; תחנות עם "מילים חדשות": ${newBadges}; השלב הבא ביחידה 1: ${firstNew}; CAR נלמדה: ${sL2.learning.car.introduced}; יחידות שהושלמו נשמרו: ${sL2.game.completedUnits.length}`, chip.includes('חוקרי חלל') && newBadges === 3 && firstNew === 'car-discover' && sL2.learning.car.introduced && sL2.game.completedUnits.length === 3);
await h.click('[data-testid=back-to-lab]');

// ---- Test 20: reset
await gotoParents(page, h);
await h.click('[data-testid=reset-btn]');
const dialogShown = await page.locator('[role=dialog]').count();
await h.click('[data-testid=confirm-reset]');
const afterReset = await page.evaluate(() => localStorage.getItem('alienlab:save'));
const parsed = afterReset ? JSON.parse(afterReset) : null;
await h.click('[data-testid=home-btn]');
const startAgain = await h.exists('[data-testid=start-btn]');
record(20, 'איפוס נתונים', 'משחק עם התקדמות מלאה', 'אזור הורים → איפוס → אישור', 'ההתקדמות נמחקת ואפשר להתחיל מחדש', `חלון אישור: ${dialogShown > 0}; ניסיונות שמורים אחרי איפוס: ${parsed ? parsed.attempts.length : 0}; כפתור "התחל משחק": ${startAgain}`, dialogShown > 0 && (!parsed || parsed.attempts.length === 0) && startAgain);

// ---- Section 15: corrupted save
await page.evaluate(() => localStorage.setItem('alienlab:save', '{oops'));
await page.reload();
await sleep(500);
const corruptMsg = await page.locator('text=לא הצלחנו לקרוא את השמירה הקודמת').count();
const backup = await page.evaluate(() => Object.keys(localStorage).some((k) => k.startsWith('alienlab:save-backup:')));
note('נתוני שמירה פגומים', `הודעה ידידותית: ${corruptMsg > 0}; גיבוי של הנתונים הפגומים נשמר: ${backup}; אפשר להתחיל: ${await h.exists('[data-testid=start-btn]')}`, corruptMsg > 0 && backup);

// ---- Test 19: no dragging needed
const draggable = await page.evaluate(() => document.querySelectorAll('[draggable=true]').length);
record(19, 'תפעול ללא גרירה', 'כל הריצה', 'כל המשימות הושלמו בלחיצות בלבד', 'אין צורך בגרירה', `כל 3 היחידות, הבדיקות, התיקונים והמשימות הושלמו בלחיצות; אלמנטים לגרירה: ${draggable}`, draggable === 0);

// ---- Section 15: browser back goes to a safe screen
await h.click('[data-testid=start-btn]');
await h.click('[data-testid=level-1]');
await h.click('[data-testid=intro-next]');
await h.click('[data-testid=intro-next]');
await h.click('[data-testid=intro-start]');
await h.click('[data-testid=station-earth]');
await page.goBack();
await sleep(600);
note('ניסיון לחזור למסך קודם (כפתור "אחורה" של הדפדפן)', `אחרי "אחורה" מתוך יחידה: מסך ${await page.getAttribute('[data-screen]', 'data-screen')}`, await h.exists('[data-testid=lab-screen]'));

// =========================================================================
// Test 4 (part B): with a working English voice the button really speaks
// =========================================================================
const ctxVoice = await browser.newContext({ viewport: { width: 1180, height: 900 } });
await ctxVoice.addInitScript(() => {
  window.__spoken = [];
  const voices = [{ lang: 'en-US', name: 'Test English', localService: true, default: true, voiceURI: 'x' }];
  window.SpeechSynthesisUtterance = class {
    constructor(t) {
      this.text = t;
    }
  };
  const synth = {
    getVoices: () => voices,
    speak: (u) => {
      setTimeout(() => {
        window.__spoken.push({ text: u.text, lang: u.lang, voice: u.voice?.name });
        u.onstart?.();
        setTimeout(() => u.onend?.(), 80);
      }, 30);
    },
    cancel: () => {},
    addEventListener: () => {},
  };
  Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true });
});
const pv = await ctxVoice.newPage();
const hv = helpers(pv);
await startNewGame(pv, hv);
await hv.click('[data-testid=station-earth]');
await hv.click('[data-testid=word-speak]', 1200);
const spoken = await pv.evaluate(() => window.__spoken);
const noFallback = !(await hv.exists('[data-testid=discover-step] [data-testid=speech-fallback]'));
// Section 15: a child who does not choose an answer gets a gentle nudge (no timer, no penalty)
await hv.click('[data-testid=next-btn]');
await pv.waitForSelector('[data-testid=choice-question]');
await sleep(17000);
const nudge = await hv.text('[data-testid=alien-line]');
note('ילד שאינו בוחר תשובה', `אחרי 17 שניות בלי בחירה: "${nudge}"; עדיין באותה שאלה: ${(await hv.stepId()) === 'apple-practice'}`, nudge.includes('קחו את הזמן') && (await hv.stepId()) === 'apple-practice');
record(4, 'השמעת מילה', 'מסך גילוי APPLE', 'לחיצה על כפתור השמע (א) במכשיר עם קול אנגלי, (ב) במכשיר בלי קולות', 'השמעה בפועל, או מצב חלופי ברור', `(א) נשלח למנוע הדיבור: ${JSON.stringify(spoken.find((s) => s.text === 'APPLE'))}, בלי הודעת "אין קול": ${noFallback}; (ב) Chrome ללא קולות: הוצג "${fallbackText.replace(/\s+/g, ' ')}"`, !!spoken.find((s) => s.text === 'APPLE' && s.lang === 'en-US') && noFallback && audioA);
await ctxVoice.close();

// =========================================================================
// Level 3 (ages 10–12): extra words + building words from letters
// =========================================================================
const ctx3 = await browser.newContext({ viewport: { width: 1180, height: 900 } });
const p3 = await ctx3.newPage();
const p3errors = [];
p3.on('pageerror', (e) => p3errors.push(e.message));
const h3 = helpers(p3);
await startNewGame(p3, h3, 3);
await h3.click('[data-testid=station-earth]');
const seen3 = [];
let spellInfo = null;
await h3.playUnit({
  each: async (id) => seen3.push(id),
  'earth-spell': async () => {
    await p3.screenshot({ path: SHOTS + 'd24-spell.png', fullPage: true });
    // word 1: build it wrong first -> hint, green letters kept
    const target = (await p3.getAttribute('[data-testid=spell-word]', 'data-word')).toUpperCase();
    const firstRecognitionWrongBefore = (await h3.save()).learning[target.toLowerCase()].wrong;
    const tiles = await p3.locator('[data-testid=spell-tiles] button').evaluateAll((b) => b.map((x) => x.dataset.testid.replace('tile-', '')));
    const wrongFirst = tiles.find((c) => !target.includes(c));
    await h3.click(`[data-testid=tile-${wrongFirst}]`, 250);
    for (const c of target.slice(1)) await h3.click(`[data-testid=spell-tiles] [data-testid=tile-${c}]:not([disabled])`, 250);
    await sleep(600);
    const hintLevel = await p3.getAttribute('[data-testid=hint-panel]', 'data-level');
    const greenKept = await p3.locator('[data-testid=spell-slots] .border-good').count();
    await p3.screenshot({ path: SHOTS + 'd25-spell-hint.png', fullPage: true });
    // now the remaining letters in order
    for (let g = 0; g < 8; g++) {
      if ((await p3.getAttribute('[data-testid=next-btn]', 'aria-disabled')) !== 'true') break;
      const nxt = p3.locator('[data-testid=spell-tiles] button[data-next=true]').first();
      if (!(await nxt.count())) break;
      await nxt.click();
      await sleep(450);
    }
    await sleep(500);
    const doneLine = await h3.text('[data-testid=alien-line]');
    await h3.click('[data-testid=next-btn]');
    // words 2 and 3 correctly on the first try
    for (let w = 0; w < 2; w++) {
      const t = (await p3.getAttribute('[data-testid=spell-word]', 'data-word')).toUpperCase();
      for (const c of t) await h3.click(`[data-testid=spell-tiles] [data-testid=tile-${c}]:not([disabled])`, 250);
      await sleep(700);
      await h3.click('[data-testid=next-btn]');
    }
    const s = await h3.save();
    const second = s.attempts.filter((a) => a.taskType === 'spell_word').map((a) => a.wordId).find((w) => w !== target.toLowerCase());
    spellInfo = { target, hintLevel, greenKept, doneLine, first: s.learning[target.toLowerCase()], second: s.learning[second], secondId: second, firstRecognitionWrongBefore };
  },
});
const s3 = await h3.save();
await h3.click('[data-testid=back-to-lab]');
await h3.click('[data-testid=station-colors]');
let buildInfo = null;
let negInfo = null;
await h3.playUnit({
  'colors-build': async () => {
    // sentence 1 (RED BALL): wrong ORDER first -> grammar tip, no word counted wrong
    const before = await h3.save();
    await h3.click('[data-testid=build-chips] [data-testid=chip-BALL]', 300);
    await h3.click('[data-testid=build-chips] [data-testid=chip-RED]', 300);
    await sleep(600);
    const tip = await h3.exists('[data-testid=hint-panel]') ? await h3.text('[data-testid=hint-panel]') : '';
    const afterOrder = await h3.save();
    await p3.screenshot({ path: SHOTS + 'd28-build-hint.png', fullPage: true });
    await h3.doBuild(); // finishes this sentence and the rest of the step
    const done = await h3.save();
    buildInfo = {
      tip,
      orderErrorsCounted: afterOrder.learning.red.wrong - before.learning.red.wrong + afterOrder.learning.ball.wrong - before.learning.ball.wrong,
      redHinted: done.learning.red.hintedCorrect - before.learning.red.hintedCorrect,
      sentences: done.attempts.filter((a) => a.taskType === 'build_sentence' && a.completed).map((a) => a.taskId.split(':')[1]),
    };
  },
  'teach-red': async () => {
    await h3.click('[data-testid=teach-pool] button[data-testid="opt-apple.red.normal.none"]');
    const g1 = await p3.getAttribute('[data-testid=alien-thought]', 'data-guess');
    await h3.click('[data-testid=mode-neg]');
    await h3.click('[data-testid=teach-pool] button[data-testid="opt-apple.green.normal.none"]');
    const g2 = await p3.getAttribute('[data-testid=alien-thought]', 'data-guess');
    const u2 = await p3.getAttribute('[data-testid=alien-thought]', 'data-understanding');
    const line = await h3.text('[data-testid=alien-line]');
    await p3.screenshot({ path: SHOTS + 'd29-negative.png', fullPage: true });
    const s = await h3.save();
    negInfo = { g1, g2, u2, line, negatives: s.alien.concepts.red.negatives };
    await h3.doTeach();
  },
});
note('בניית משפטים: שגיאת סדר', `טיפ: "${buildInfo?.tip.replace(/\s+/g, ' ')}"; שגיאות שנרשמו למילים בגלל סדר: ${buildInfo?.orderErrorsCounted}; RED נרשמה כ"עם עזרה": ${buildInfo?.redHinted}; משפטים שהושלמו: ${buildInfo?.sentences.join(', ')}`, !!buildInfo && buildInfo.tip.includes('הצבע בא לפני') && buildInfo.orderErrorsCounted === 0 && buildInfo.redHinted === 1 && ['b1', 'b2', 'b3', 'b4'].every((b) => buildInfo.sentences.includes(b)));
note('דוגמה נגדית (גילי 10–12)', `אחרי תפוח אדום: ${negInfo?.g1}; אחרי "תפוח ירוק זה לא RED": ${negInfo?.g2} (${negInfo?.u2}); נשמר: ${JSON.stringify(negInfo?.negatives)}; קוסמו: "${negInfo?.line}"`, negInfo?.g1 === 'kind:apple' && negInfo?.g2 === 'color:red' && negInfo?.u2 === 'understood' && negInfo?.negatives?.[0] === 'apple.green.normal.none');
await h3.click('[data-testid=back-to-lab]');
// ---- Level 3, unit 3: positions, reading, teaching UNDER
await h3.click('[data-testid=station-lab]');
let readInfo = null;
let underInfo = null;
let fillInfo = null;
await h3.playUnit({
  'under-discover': async () => {
    await p3.screenshot({ path: SHOTS + 'd30-under.png', fullPage: true });
    await h3.click('[data-testid=next-btn]');
  },
  'lab-fill': async () => {
    const seen = [];
    for (let g = 0; g < 6; g++) {
      if ((await h3.stepId()) !== 'lab-fill') break;
      const id = await p3.getAttribute('[data-testid=fill-sentence]', 'data-sentence');
      seen.push(id);
      if (id === 'f3') await p3.screenshot({ path: SHOTS + 'd31-fill-under.png', fullPage: true });
      await h3.click('[data-testid=fill-bank] button[data-correct=true]');
      await h3.click('[data-testid=next-btn]');
    }
    fillInfo = seen;
  },
  'lab-read': async () => {
    const lines = await p3.locator('[data-testid=read-text] [data-line]').count();
    await h3.click('[data-testid=options] button[data-correct=false]');
    const hl = await p3.getAttribute('[data-testid=read-text] [data-highlight=true]', 'data-line');
    await p3.screenshot({ path: SHOTS + 'd32-read.png', fullPage: true });
    await h3.answerQuestions();
    const s = await h3.save();
    readInfo = { lines, hl, done: s.attempts.filter((a) => a.taskType === 'read' && a.completed).map((a) => a.taskId.split(':')[1]) };
  },
  'teach-under': async () => {
    // In the Kosmo round before, the child corrected "THE BALL IS ON THE TABLE" → Kosmo arrives with UNDER = ball.
    const g0 = await p3.getAttribute('[data-testid=alien-thought]', 'data-guess');
    const btn = p3.locator('[data-testid=teach-pool] button[data-testid="opt-ball.red.normal.none.under-table"]');
    if (await btn.isEnabled()) await h3.click('[data-testid=teach-pool] button[data-testid="opt-ball.red.normal.none.under-table"]');
    const g1 = await p3.getAttribute('[data-testid=alien-thought]', 'data-guess');
    await h3.click('[data-testid=start-test-btn]');
    await p3.waitForSelector('[data-testid=alien-choice]', { timeout: 8000 });
    const choice = await p3.locator('[data-testid=test-scene] button:has([data-testid=alien-choice])').getAttribute('data-testid');
    await p3.screenshot({ path: SHOTS + 'd33-test-under.png', fullPage: true });
    underInfo = { g0, g1, choice };
    await h3.doTeach();
    const s = await h3.save();
    underInfo.ability = s.alien.abilities.includes('find-places');
  },
});
note('רמה 3: השלמת משפט עם IN/ON/UNDER', `משפטים: ${fillInfo?.join(', ')}`, !!fillInfo && fillInfo.includes('f3') && fillInfo.includes('f4'));
note('רמה 3: קריאת הודעה', `שורות בהודעה: ${readInfo?.lines}; אחרי טעות הודגשה שורה ${readInfo?.hl}; שאלות שנענו: ${readInfo?.done.join(', ')}`, readInfo?.lines === 4 && readInfo.hl === '1' && ['q1', 'q2', 'q3'].every((q) => readInfo.done.includes(q)));
note('רמה 3: קוסמו לומד UNDER', `קוסמו הגיע לשלב הלימוד עם ההשערה מהסבב הקודם ("THE BALL IS UNDER THE TABLE"): ${underInfo?.g0}; אחרי "כדור אדום מתחת לשולחן": ${underInfo?.g1}; בבדיקה בחר ${underInfo?.choice}; יכולת "יודע איפה דברים נמצאים": ${underInfo?.ability}`, underInfo?.g0 === 'kind:ball' && underInfo?.g1 === 'kind:ball' && underInfo.choice.includes('ball') && !underInfo.choice.includes('under') && underInfo.ability);
await h3.click('[data-testid=back-to-lab]');
note('רמה 3: מילים נוספות ביחידה 1', `שלבים ששוחקו כוללים: ${['earth-mixup', 'cup-discover', 'earth-kosmo', 'earth-spell'].filter((x) => seen3.includes(x)).join(', ')}; מילים מוכרות דולגו: ${!seen3.includes('apple-discover') && !seen3.includes('car-discover')}; מילים שנחשפו ביחידה: ${['apple', 'ball', 'cat', 'dog', 'car', 'hat', 'cup'].filter((w) => s3.learning[w].introduced).length}/7`, ['earth-mixup', 'cup-discover', 'earth-kosmo', 'earth-spell'].every((x) => seen3.includes(x)) && !seen3.includes('apple-discover') && !seen3.includes('earth-mix'));
note('רמה 3: הרכבת מילה ארוכה מאותיות + רמז', `מילה: ${spellInfo?.target}; אחרי הרכבה שגויה: רמז ברמה ${spellInfo?.hintLevel}, אותיות ירוקות שנשארו: ${spellInfo?.greenKept}; סיום: "${spellInfo?.doneLine}"`, spellInfo?.hintLevel === '1' && spellInfo.greenKept === spellInfo.target.length - 1);
note('הרכבה נשמרת בנפרד מזיהוי', `${spellInfo?.target}: איות שגוי ${spellInfo?.first.spellWrong}, איות בעזרה ${spellInfo?.first.spellWithHelp}; ${spellInfo?.secondId}: איות לבד ${spellInfo?.second?.spellIndependent}; שגיאות הזיהוי של ${spellInfo?.target} לא השתנו: ${spellInfo?.first.wrong === spellInfo?.firstRecognitionWrongBefore}`, spellInfo?.first.spellWrong === 1 && spellInfo.first.spellWithHelp === 1 && spellInfo.second?.spellIndependent === 1 && spellInfo.first.wrong === spellInfo.firstRecognitionWrongBefore);
await gotoParents(p3, h3);
const spellCol = await h3.text(`[data-testid=spell-${spellInfo?.secondId}]`);
const exposed3 = await p3.evaluate(() => document.querySelector('[data-testid=stat-exposed]').textContent);
await p3.screenshot({ path: SHOTS + 'd26-parents-level3.png', fullPage: true });
note('אזור הורים ברמה 3', `עמודת הרכבה ל-${spellInfo?.secondId}: "${spellCol}"; ${exposed3.replace(/\s+/g, ' ')}`, spellCol.includes('לבד') && exposed3.includes('מתוך 25'));
note('שגיאות JavaScript ברמה 3', p3errors.length ? p3errors.join(' | ') : 'אין', p3errors.length === 0);
// ---- "New game" from the home screen (same device, new player)
await h3.click('[data-testid=home-btn]');
const hasNewBtn = await h3.exists('[data-testid=new-game-btn]');
const version = await h3.text('[data-testid=app-version]');
await h3.click('[data-testid=new-game-btn]');
await h3.click('[data-testid=cancel-new-game]');
const keptAfterCancel = (await h3.save()).attempts.length;
await h3.click('[data-testid=new-game-btn]');
await p3.screenshot({ path: SHOTS + 'd27-new-game-dialog.png', fullPage: true });
await h3.click('[data-testid=confirm-new-game]');
const onLevel = await h3.exists('[data-testid=level-screen]');
const afterNew = await h3.save();
await h3.click('[data-testid=level-2]');
const afterPick = await h3.save();
note('משחק חדש מההתחלה (מסך הפתיחה)', `כפתור "משחק חדש": ${hasNewBtn}; ${version}; "ביטול" שמר ${keptAfterCancel} ניסיונות; אחרי אישור: מסך בחירת רמה ${onLevel}, ניסיונות שמורים ${afterNew?.attempts.length ?? 0}; רמה חדשה שנבחרה: ${afterPick.game.level}`, hasNewBtn && keptAfterCancel > 0 && onLevel && (afterNew?.attempts.length ?? 0) === 0 && afterPick.game.level === 2 && version.includes(`v${PKG_VERSION}`));
await ctx3.close();

// ---- "Kosmo gets confused" opens the station at levels 2–3
const ctxW = await browser.newContext({ viewport: { width: 1180, height: 900 } });
const pw = await ctxW.newPage();
const hw = helpers(pw);
await startNewGame(pw, hw, 2);
await hw.click('[data-testid=station-earth]');
const firstStep = await hw.stepId();
await pw.screenshot({ path: SHOTS + 'd34-mixup.png', fullPage: true });
let mixHint = '';
const modes = {};
await hw.doMixup(
  (rid) => (rid === 'e2-1' ? 'misjudge' : 'right'),
  async (rid, stage, kind) => {
    modes[rid] = kind;
    if (stage === 'find' && rid === 'e2-1') mixHint = await hw.text('[data-testid=alien-line]');
    if (stage === 'fix' && rid === 'e2-2') await pw.screenshot({ path: SHOTS + 'd35-mixup-fix.png', fullPage: true });
    if (stage === 'start' && rid === 'e2-3') await pw.screenshot({ path: SHOTS + 'd35b-mixup-gap.png', fullPage: true });
    if (stage === 'done' && rid === 'e2-3') await pw.screenshot({ path: SHOTS + 'd36-mixup-done.png', fullPage: true });
    if (stage === 'start' && rid === 'e2-5') await pw.screenshot({ path: SHOTS + 'd36b-mixup-right.png', fullPage: true });
  },
);
const sW = await hw.save();
const afterMix = await hw.stepId();
const doneE = sW.game.doneSteps.earth ?? [];
const mixAttempts = sW.attempts.filter((a) => a.taskType === 'fix_kosmo');
note(
  '"קוסמו מתבלבל" פותח את התחנה (רמות 2–3)',
  `שלב ראשון ברמה 2: ${firstStep}; סבבים: ${new Set(mixAttempts.map((a) => a.taskId)).size}; אחרי טעות בשיפוט (DOG): "${mixHint.replace(/\s+/g, ' ').slice(0, 50)}…"; השלב הבא: ${afterMix}; ההיכרות עם DOG דולגה: ${doneE.includes('dog-discover')}; APPLE דילגה גם על התרגול: ${doneE.includes('apple-practice')}; APPLE נרשמה כזיהוי עצמאי: ${sW.learning.apple.independentCorrect >= 1}`,
  firstStep === 'earth-mixup' && afterMix === 'dog-practice' && doneE.includes('dog-discover') && !doneE.includes('dog-practice') && doneE.includes('apple-practice') && sW.learning.apple.independentCorrect >= 1 && sW.learning.dog.wrong >= 1 && mixHint.includes('התבלבלתי'),
);
note(
  'הטעויות של קוסמו נובעות ממה שלימדו אותו, ותיקון משנה את התגובה שלו',
  `מצבי הסבבים: ${Object.entries(modes).map(([r, k]) => `${r}=${k}`).join(', ')}; אחרי שתיקנו את DOG (e2-1), בסבב e2-5 קוסמו אמר DOG נכון; CAT ו-APPLE הפכו לשאלה כי קוסמו כבר הכיר את DOG ו-BALL; המילון של קוסמו: ${Object.keys(sW.alien.lexicon).join(', ')}`,
  modes['e2-1'] === 'wrong' && modes['e2-2'] === 'wrong' && modes['e2-3'] === 'gap' && modes['e2-4'] === 'gap' && modes['e2-5'] === 'right' && sW.alien.lexicon.dog?.first === 'fix' && sW.alien.lexicon.dog?.usedRight === 1,
);
await hw.click('[data-testid=home-btn]');
await pw.screenshot({ path: SHOTS + 'd37-after-mixup.png', fullPage: true });
await ctxW.close();

// ---- Old (v1) save from the first version of the game still loads
const ctxOld = await browser.newContext({ viewport: { width: 1180, height: 900 } });
const po = await ctxOld.newPage();
const ho = helpers(po);
await po.goto(BASE_URL);
await po.evaluate(() =>
  localStorage.setItem(
    'alienlab:save',
    JSON.stringify({ version: 1, createdAt: 1, game: { introSeen: true, unitStep: { earth: 11, colors: 2 }, completedUnits: ['earth'], unlockedUnits: ['earth', 'colors'] }, learning: { apple: { introduced: true, attempts: 2, independentCorrect: 2 } } }),
  ),
);
await po.reload();
await ho.click('[data-testid=continue-btn]');
const oldChip = await ho.text('[data-testid=level-chip]');
const oldEarth = await po.getAttribute('[data-testid=station-earth]', 'data-status');
await ho.click('[data-testid=station-colors]');
const oldStep = await ho.stepId();
note('שמירה מהגרסה הקודמת (v1) נטענת', `רמה: "${oldChip.trim()}"; יחידה 1: ${oldEarth}; יחידה 2 ממשיכה מ-${oldStep}`, oldChip.includes('צוערי חלל') && oldEarth === 'completed' && oldStep === 'blue-discover');
await ctxOld.close();

// =========================================================================
// Test 18: phone layout (iPhone-size viewport, touch)
// =========================================================================
const mob = await browser.newContext({ viewport: { width: 375, height: 740 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const pm = await mob.newPage();
const hm = helpers(pm);
const overflow = [];
const tooSmall = new Set();
async function checkLayout(label) {
  const o = await hm.overflowX();
  if (o > 1) overflow.push(`${label}:${o}px`);
  const small = await pm.evaluate(() =>
    [...document.querySelectorAll('button')]
      .filter((b) => b.offsetParent !== null)
      .map((b) => ({ r: b.getBoundingClientRect(), t: (b.getAttribute('aria-label') || b.textContent || '').trim().slice(0, 20) }))
      .filter(({ r }) => r.width < 44 || r.height < 44 || r.right > window.innerWidth + 1 || r.left < -1)
      .map(({ t, r }) => `${t}(${Math.round(r.width)}x${Math.round(r.height)})`),
  );
  small.forEach((s) => tooSmall.add(`${label}: ${s}`));
}
await pm.goto(BASE_URL);
await pm.evaluate(() => localStorage.clear());
await pm.reload();
await sleep(500);
await checkLayout('home');
await pm.screenshot({ path: SHOTS + 'm01-home.png', fullPage: true });
await hm.click('[data-testid=start-btn]');
await checkLayout('level');
await pm.screenshot({ path: SHOTS + 'm01b-level.png', fullPage: true });
await hm.click('[data-testid=level-1]');
await checkLayout('intro');
await hm.click('[data-testid=intro-next]');
await hm.click('[data-testid=intro-next]');
await hm.click('[data-testid=intro-start]');
await checkLayout('lab');
await pm.screenshot({ path: SHOTS + 'm02-lab.png', fullPage: true });
await hm.click('[data-testid=station-earth]');
let shotN = 3;
const wanted = new Set(['apple-discover', 'apple-practice', 'earth-mix', 'earth-says', 'teach-dog', 'play-supply', 'earth-summary', 'colors-says', 'teach-red', 'play-colors']);
await hm.playUnit({
  each: async (id) => {
    await checkLayout(id);
    if (wanted.has(id)) {
      wanted.delete(id);
      await pm.screenshot({ path: SHOTS + `m${String(shotN++).padStart(2, '0')}-${id}.png`, fullPage: true });
    }
  },
});
await hm.click('[data-testid=back-to-lab]');
await hm.click('[data-testid=station-colors]');
await hm.playUnit({
  each: async (id, type) => {
    await checkLayout(id);
    if (wanted.has(id)) {
      wanted.delete(id);
      await pm.screenshot({ path: SHOTS + `m${String(shotN++).padStart(2, '0')}-${id}.png`, fullPage: true });
    }
    if (type === 'teach') {
      // also check layout in test & repair phases
      await hm.doTeach(async (phase) => {
        await checkLayout(`${id}:${phase}`);
        if (phase === 'repair') await pm.screenshot({ path: SHOTS + `m${String(shotN++).padStart(2, '0')}-${id}-repair.png`, fullPage: true });
      });
    }
  },
});
await gotoParents(pm, hm);
await checkLayout('parents');
// level 2 on a phone: sentence building
await hm.click('[data-testid=parent-level-2]');
await hm.click('[data-testid=home-btn]');
await hm.click('[data-testid=continue-btn]');
await hm.click('[data-testid=station-colors]');
await hm
  .playUnit({
    'colors-build': async () => {
      await checkLayout('colors-build');
      await pm.screenshot({ path: SHOTS + `m${String(shotN++).padStart(2, '0')}-build.png`, fullPage: true });
      await hm.doBuild();
    },
    'teach-green': async () => {
      await checkLayout('teach-green');
      throw new Error('stop');
    },
  })
  .catch(() => {});
// spelling step on a phone
await startNewGame(pm, hm, 3);
await checkLayout('lab-level3');
await hm.click('[data-testid=station-earth]');
await hm.playUnit({ 'earth-spell': async () => {
  await checkLayout('earth-spell');
  await pm.screenshot({ path: SHOTS + `m${String(shotN++).padStart(2, '0')}-spell.png`, fullPage: true });
  await hm.click('[data-testid=home-btn]');
} , each: async (id) => { if (!(await hm.exists('[data-testid=unit-screen]'))) throw new Error('left'); } }).catch(() => {});
await pm.screenshot({ path: SHOTS + `m${String(shotN++).padStart(2, '0')}-parents.png`, fullPage: true });
record(18, 'תצוגת נייד', 'מסך 375×740 עם מגע', 'מעבר על כל המסכים של יחידות 1–2 ואזור ההורים', 'בלי גלילה אופקית ובלי כפתורים חסומים/קטנים', `גלילה אופקית: ${overflow.length ? overflow.join(', ') : 'אין'}; כפתורים קטנים מ-44px או חתוכים: ${tooSmall.size ? [...tooSmall].slice(0, 6).join(' | ') : 'אין'}`, overflow.length === 0 && tooSmall.size === 0);
await mob.close();

note('שגיאות JavaScript בזמן הריצה', pageErrors.length ? pageErrors.join(' | ') : 'אין', pageErrors.length === 0);

await browser.close();
results.sort((a, b) => a.id - b.id);
writeFileSync(new URL('./results.json', import.meta.url), JSON.stringify({ ranAt: new Date().toISOString(), results, extra }, null, 2));
const failed = results.filter((r) => !r.pass).length + extra.filter((e) => !e.pass).length;
console.log(`\n${results.filter((r) => r.pass).length}/${results.length} acceptance tests passed; ${extra.filter((e) => e.pass).length}/${extra.length} extra checks passed`);
process.exit(failed ? 1 : 0);
