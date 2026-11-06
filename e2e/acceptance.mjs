// End-to-end acceptance tests (spec section 19) — runs a real Chrome via playwright-core.
// Usage: npm run build && npx vite preview --port 4173 & node e2e/acceptance.mjs
// Env: CHROME=/path/to/chrome  URL=http://localhost:4173/
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';

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
        await click('[data-testid=repair-options] button[data-correct=true]');
        await click('[data-testid=retest-btn]');
      } else if (phase === 'done') {
        await click('[data-testid=next-btn]');
        return;
      }
    }
  }

  async function doMission(onStep) {
    await click('[data-testid=next-btn]'); // intro
    for (let g = 0; g < 10; g++) {
      if (await exists('[data-testid=mission-done]')) break;
      if (onStep) await onStep();
      await click('[data-testid=options] button[data-correct=true]');
      await click('[data-testid=next-btn]');
    }
    await click('[data-testid=next-btn]');
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
      else if (type === 'play') await doMission();
      else if (type === 'summary') return;
    }
  }
  return { click, save, stepId, stepType, text, exists, overflowX, answerQuestions, doTeach, doMission, playUnit };
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

// ---- Teach DOG: partial understanding for nouns
await page.waitForSelector('[data-testid=teach-step]');
await page.screenshot({ path: SHOTS + 'd08-teach-dog.png', fullPage: true });
await h.click('[data-testid=teach-pool] button[data-testid="opt-dog.brown.normal.none"]');
const dogUnderstanding = await page.getAttribute('[data-testid=alien-thought]', 'data-understanding');
await h.doTeach();
await h.doMission();
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

// ---- Unit 2 up to teach-red
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
    const rq = await page.getAttribute('[data-testid=repair-question]', 'data-question');
    await page.screenshot({ path: SHOTS + 'd12-repair.png', fullPage: true });
    // Test 13: corrective example changes knowledge and the next test
    const invalidOpt = await page.locator('[data-testid=repair-options] button').evaluateAll((b) => b.map((x) => x.dataset.testid).find((id) => !id.includes('.red.')));
    if (invalidOpt) await h.click(`[data-testid="${invalidOpt}"]`);
    const hintAfterBad = await h.exists('[data-testid=hint-panel]');
    await h.click('[data-testid=repair-options] button[data-correct=true]');
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
    const before = await h.save();
    await h.click('[data-testid=options] button[data-testid="opt-apple.green.normal.none"]');
    const after = await h.save();
    note('ניתוח לפי מילה במשימה משולבת', `בחירת תפוח ירוק ל-RED APPLE: RED שגויים ${before.learning.red.wrong}→${after.learning.red.wrong}, APPLE שגויים ${before.learning.apple.wrong}→${after.learning.apple.wrong}`, after.learning.red.wrong === before.learning.red.wrong + 1 && after.learning.apple.wrong === before.learning.apple.wrong);
    await page.screenshot({ path: SHOTS + 'd14-mission.png', fullPage: true });
    for (let g = 0; g < 8; g++) {
      if (await h.exists('[data-testid=mission-done]')) break;
      await h.click('[data-testid=options] button[data-correct=true]');
      await h.click('[data-testid=next-btn]');
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
    for (let g = 0; g < 8; g++) {
      if (await h.exists('[data-testid=mission-done]')) break;
      await h.click('[data-testid=options] button[data-correct=true]');
      doorStates.push(await page.getAttribute('[data-testid=mission-scene]', 'data-door'));
      await h.click('[data-testid=next-btn]');
      doorStates.push(await page.getAttribute('[data-testid=mission-scene]', 'data-door'));
    }
    await page.screenshot({ path: SHOTS + 'd17-door-done.png', fullPage: true });
    note('פעולה במשימה משנה את העולם (דלת)', `מצבי הדלת לאורך המשימה: ${[...new Set(doorStates)].join(' → ')}`, doorStates.includes('open'));
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
for (let g = 0; g < 6; g++) {
  if (await h.exists('[data-testid=review-done]')) break;
  if (g === 0) await page.screenshot({ path: SHOTS + 'd20-review.png', fullPage: true });
  await h.click('[data-testid=options] button[data-correct=true]');
  await h.click('[data-testid=next-btn]');
  reviewed++;
}
const sR = await h.save();
const delayed = Object.values(sR.learning).flatMap((w) => w.delayedReviews);
record(16, 'חזרה מאוחרת', 'סיום 3 היחידות', 'בדיקה מיידית, ואז הזזת שעון המשחק ביום (כלי מפתחים מסומן)', 'אין חזרה מיד אחרי הלמידה; אחרי מרווח מוצע תרגול חוזר', `תחנת זיכרון מיד אחרי הלמידה: ${!noReviewYet || reviewBefore}; אחרי יום: ${reviewAfter}; שאלות חזרה: ${reviewed}; חזרות מאוחרות שנשמרו: ${delayed.length}`, noReviewYet && !reviewBefore && reviewAfter && delayed.length === reviewed && reviewed > 0);
await h.click('[data-testid=back-to-lab]');

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
const firstNew = await h.stepId();
await h.playUnit();
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
    // word 1 (CAT): build it wrong first -> hint, green letters kept
    const target = (await p3.getAttribute('[data-testid=spell-word]', 'data-word')).toUpperCase();
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
    spellInfo = { target, hintLevel, greenKept, doneLine, cat: s.learning.cat, dog: s.learning.dog };
  },
});
const s3 = await h3.save();
note('רמה 3: מילים נוספות ביחידה 1', `שלבים ששוחקו כוללים: ${['car-discover', 'cup-discover', 'earth-spell'].filter((x) => seen3.includes(x)).join(', ')}; מילים שנחשפו ביחידה: ${['apple', 'ball', 'cat', 'dog', 'car', 'cup'].filter((w) => s3.learning[w].introduced).length}/6`, seen3.includes('car-discover') && seen3.includes('cup-discover') && seen3.includes('earth-spell'));
note('רמה 3: הרכבת מילה מאותיות + רמז', `מילה: ${spellInfo?.target}; אחרי הרכבה שגויה: רמז ברמה ${spellInfo?.hintLevel}, אותיות ירוקות שנשארו: ${spellInfo?.greenKept}; סיום: "${spellInfo?.doneLine}"`, spellInfo?.hintLevel === '1' && spellInfo.greenKept === spellInfo.target.length - 1);
note('הרכבה נשמרת בנפרד מזיהוי', `CAT: איות שגוי ${spellInfo?.cat.spellWrong}, איות בעזרה ${spellInfo?.cat.spellWithHelp}; DOG: איות לבד ${spellInfo?.dog.spellIndependent}; שגיאות הזיהוי של CAT לא השתנו: ${spellInfo?.cat.wrong === 0}`, spellInfo?.cat.spellWrong === 1 && spellInfo.cat.spellWithHelp === 1 && spellInfo.dog.spellIndependent === 1 && spellInfo.cat.wrong === 0);
await gotoParents(p3, h3);
const spellCol = await h3.text('[data-testid=spell-dog]');
const exposed3 = await p3.evaluate(() => document.querySelector('[data-testid=stat-exposed]').textContent);
await p3.screenshot({ path: SHOTS + 'd26-parents-level3.png', fullPage: true });
note('אזור הורים ברמה 3', `עמודת הרכבה ל-DOG: "${spellCol}"; ${exposed3.replace(/\s+/g, ' ')}`, spellCol.includes('לבד') && exposed3.includes('מתוך 18'));
note('שגיאות JavaScript ברמה 3', p3errors.length ? p3errors.join(' | ') : 'אין', p3errors.length === 0);
await ctx3.close();

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
const wanted = new Set(['apple-discover', 'apple-practice', 'earth-mix', 'teach-dog', 'play-supply', 'earth-summary', 'teach-red', 'play-colors']);
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
