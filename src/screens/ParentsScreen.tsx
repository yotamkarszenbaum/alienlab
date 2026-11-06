import { useMemo, useState } from 'react';
import { BigButton, Dialog, Page, TopBar } from '../components/ui';
import { useGame, now } from '../state/GameContext';
import { useNav } from '../state/nav';
import { wordsForLevel } from '../content/words';
import { LEVELS } from '../content/levels';
import { levelOfGame, setLevel } from '../engine/gameProgress';
import { UNITS } from '../content/units';
import { LEVEL_HE, levelOf, needsPractice, spellingHe, DAY } from '../engine/learning';
import { emptyConcept, understandingOf, UNDERSTANDING_HE } from '../engine/alienMind';
import { useSpeechStatus, type SpeechStatus } from '../audio/speech';
import { setTimeOffset } from '../engine/clock';

const fmt = (t?: number) => (t ? new Date(t).toLocaleString('he-IL', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');

function Gate({ onPass }: { onPass: () => void }) {
  const [{ a, b }] = useState(() => ({ a: 6 + Math.floor(Math.random() * 4), b: 11 + Math.floor(Math.random() * 4) }));
  const [v, setV] = useState('');
  const [err, setErr] = useState(false);
  return (
    <form
      className="card p-6 max-w-md mx-auto flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (Number(v) === a * b) onPass();
        else setErr(true);
      }}
      data-testid="parents-gate"
    >
      <h2 className="text-2xl font-extrabold">כניסה להורים</h2>
      <p className="text-lg">
        כדי להמשיך, פתרו את התרגיל: <b dir="ltr">{a} × {b}</b>
      </p>
      <input
        inputMode="numeric"
        pattern="[0-9]*"
        aria-label="התשובה לתרגיל"
        className="rounded-2xl border-3 border-line px-4 py-3 text-2xl text-center"
        value={v}
        onChange={(e) => {
          setV(e.target.value);
          setErr(false);
        }}
        data-testid="gate-input"
        data-answer={a * b}
      />
      {err && <p role="alert" className="text-try font-bold">התשובה לא נכונה, נסו שוב.</p>}
      <button className="btn btn-primary" type="submit" data-testid="gate-submit">
        כניסה
      </button>
      <p className="text-sm text-ink-soft">זהו מחסום פשוט שנועד למנוע כניסה מקרית של ילדים. הוא אינו מערכת אימות או אבטחת מידע.</p>
    </form>
  );
}

function Stat({ label, value, testId }: { label: string; value: string | number; testId?: string }) {
  return (
    <div className="card p-4 flex flex-col gap-1" data-testid={testId}>
      <span className="text-3xl font-extrabold">{value}</span>
      <span className="text-base font-medium">{label}</span>
    </div>
  );
}

const STATUS_HE: Record<SpeechStatus, string> = { ok: 'עובד', unavailable: 'לא זמין', unknown: 'עוד לא נבדק' };

export function ParentsScreen() {
  const { data, update, resetAll, setSettings, canSave, loadStatus } = useGame();
  const level = levelOfGame(data.game);
  const WORDS = wordsForLevel(level);
  const showSpelling = level === 3 || WORDS.some((w) => (data.learning[w.id]?.spellIndependent ?? 0) + (data.learning[w.id]?.spellWithHelp ?? 0) + (data.learning[w.id]?.spellWrong ?? 0) > 0);
  const { go } = useNav();
  const [open, setOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetDone, setResetDone] = useState(false);
  const [exportMsg, setExportMsg] = useState<string | null>(null);
  const [exportText, setExportText] = useState<string | null>(null);
  const en = useSpeechStatus('en');
  const he = useSpeechStatus('he');

  const stats = useMemo(() => {
    const exposed = WORDS.filter((w) => data.learning[w.id]?.introduced);
    const independent = WORDS.filter((w) => (data.learning[w.id]?.independentCorrect ?? 0) > 0);
    const practice = WORDS.filter((w) => needsPractice(data.learning[w.id]));
    const reviews = WORDS.flatMap((w) => data.learning[w.id]?.delayedReviews ?? []);
    const spelled = WORDS.filter((w) => (data.learning[w.id]?.spellIndependent ?? 0) > 0);
    return { exposed, independent, practice, reviews, spelled, reviewsIndependent: reviews.filter((r) => r.result === 'independent').length };
  }, [data, WORDS]);

  if (!open)
    return (
      <>
        <TopBar onHome={() => go({ name: 'home' })} homeLabel="חזרה למסך הפתיחה" title="אזור להורים" />
        <Page className="pt-6">
          <Gate onPass={() => setOpen(true)} />
        </Page>
      </>
    );

  return (
    <>
      <TopBar onHome={() => go({ name: 'home' })} homeLabel="חזרה למסך הפתיחה" title="אזור להורים" />
      <Page>
        <div className="flex flex-col gap-5" data-testid="parents-dashboard">
          {resetDone && <p className="card p-4 text-lg font-bold" role="status">ההתקדמות נמחקה. אפשר להתחיל משחק חדש.</p>}

          <section className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            <Stat label={`יחידות שהושלמו (מתוך ${UNITS.length})`} value={data.game.completedUnits.length} testId="stat-units" />
            <Stat label={`מילים שהילד נחשף אליהן (מתוך ${WORDS.length})`} value={stats.exposed.length} testId="stat-exposed" />
            <Stat label="מילים שזוהו לפחות פעם אחת ללא רמז" value={stats.independent.length} testId="stat-independent" />
            <Stat label="מילים שכדאי לתרגל עוד" value={stats.practice.length} testId="stat-practice" />
            <Stat label={`חזרות מאוחרות שבוצעו (${stats.reviewsIndependent} ללא עזרה)`} value={stats.reviews.length} testId="stat-reviews" />
            <Stat label="פעילויות שהושלמו" value={data.game.activities} testId="stat-activities" />
            {showSpelling && <Stat label="מילים שהילד הרכיב לבד מאותיות (הפקה)" value={stats.spelled.length} testId="stat-spelled" />}
          </section>

          <section className="card p-5 flex flex-col gap-3" data-testid="level-settings">
            <h2 className="text-xl font-extrabold">רמת קושי</h2>
            <p className="text-base">הרמה נבחרת לפי טווח גילים (המשחק לא שואל גיל מדויק). אפשר לשנות בכל רגע: מילים שכבר נלמדו נשמרות. כשמעלים רמה, המילים החדשות מופיעות בתחנות כ"מילים חדשות". כשמורידים רמה, המילים הנוספות מוסתרות אבל הנתונים שלהן לא נמחקים.</p>
            <div className="grid sm:grid-cols-3 gap-3" role="radiogroup" aria-label="רמת קושי">
              {LEVELS.map((l) => (
                <button
                  key={l.level}
                  type="button"
                  role="radio"
                  aria-checked={level === l.level}
                  data-testid={`parent-level-${l.level}`}
                  onClick={() => update((d) => ({ ...d, game: setLevel(d.game, l.level) }))}
                  className={`rounded-3xl border-3 p-3 text-start flex flex-col gap-1 min-h-[44px] ${level === l.level ? 'border-primary bg-[#f1ecff]' : 'border-line bg-white'}`}
                >
                  <span className="font-extrabold text-lg">{'⭐'.repeat(l.stars)} {l.titleHe}</span>
                  <span className="text-sm font-bold">{l.agesHe}</span>
                  <span className="text-sm">{l.descriptionHe}</span>
                </button>
              ))}
            </div>
          </section>

          {stats.practice.length > 0 && (
            <p className="card p-4 text-lg">
              <b>מילים לתרגול נוסף:</b> {stats.practice.map((w) => `${w.english} (${w.hebrew})`).join(', ')}
            </p>
          )}

          <section className="card p-4 overflow-x-auto">
            <h2 className="text-xl font-extrabold mb-3">התקדמות לפי מילה</h2>
            <table className="w-full text-start text-base border-collapse min-w-[640px]" data-testid="word-table">
              <thead>
                <tr className="border-b-2 border-line text-ink-soft">
                  <th className="text-start p-2">מילה</th>
                  <th className="text-start p-2">מצב</th>
                  <th className="p-2">ללא רמז</th>
                  <th className="p-2">עם רמז</th>
                  <th className="p-2">שגויים</th>
                  <th className="p-2">תרגול אחרון</th>
                  <th className="p-2">חזרה מוצעת</th>
                  <th className="p-2">בדיקה מאוחרת</th>
                  {showSpelling && <th className="p-2">הרכבה מאותיות</th>}
                </tr>
              </thead>
              <tbody>
                {WORDS.map((w) => {
                  const wp = data.learning[w.id];
                  const last = wp?.delayedReviews[wp.delayedReviews.length - 1];
                  return (
                    <tr key={w.id} className="border-b border-line" data-testid={`row-${w.id}`} data-level={levelOf(wp)}>
                      <td className="p-2">
                        <bdi className="en" dir="ltr">
                          {w.english}
                        </bdi>{' '}
                        {w.hebrew}
                      </td>
                      <td className="p-2">
                        {LEVEL_HE[levelOf(wp)]}
                        {needsPractice(wp) ? ' · כדאי לתרגל' : ''}
                      </td>
                      <td className="p-2 text-center" data-testid={`indep-${w.id}`}>{wp?.independentCorrect ?? 0}</td>
                      <td className="p-2 text-center" data-testid={`hinted-${w.id}`}>{wp?.hintedCorrect ?? 0}</td>
                      <td className="p-2 text-center">{wp?.wrong ?? 0}</td>
                      <td className="p-2 text-center">{fmt(wp?.lastPracticedAt)}</td>
                      <td className="p-2 text-center">{wp?.attempts ? fmt(wp?.nextReviewAt) : '—'}</td>
                      <td className="p-2 text-center">{last ? (last.result === 'independent' ? 'עבר לבד' : last.result === 'with_help' ? 'עם עזרה' : 'לא הצליח') : 'עוד לא בוצעה'}</td>
                      {showSpelling && <td className="p-2 text-center" data-testid={`spell-${w.id}`}>{spellingHe(wp)}</td>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>

          <section className="card p-4 overflow-x-auto">
            <h2 className="text-xl font-extrabold mb-3">מה החייזר למד (מודל הידע הפנימי)</h2>
            <table className="w-full text-base border-collapse min-w-[520px]">
              <thead>
                <tr className="border-b-2 border-line text-ink-soft">
                  <th className="text-start p-2">מושג</th>
                  <th className="text-start p-2">הבנה</th>
                  <th className="p-2">דוגמאות</th>
                  <th className="p-2">אי-הבנות</th>
                  <th className="p-2">תיקונים</th>
                  <th className="p-2">בדיקות</th>
                </tr>
              </thead>
              <tbody>
                {WORDS.filter((w) => w.teach).map((w) => {
                  const k = data.alien.concepts[w.id] ?? emptyConcept(w.id);
                  return (
                    <tr key={w.id} className="border-b border-line">
                      <td className="p-2">
                        <bdi className="en" dir="ltr">{w.english}</bdi>
                      </td>
                      <td className="p-2" data-understanding={understandingOf(w.target, k)}>{UNDERSTANDING_HE[understandingOf(w.target, k)]}</td>
                      <td className="p-2 text-center">{k.examples.length}</td>
                      <td className="p-2 text-center">{k.misconceptions.length}</td>
                      <td className="p-2 text-center">{k.corrections.length}</td>
                      <td className="p-2 text-center">{k.tests.length}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>

          <section className="card p-5 flex flex-col gap-2 text-base leading-relaxed">
            <h2 className="text-xl font-extrabold">איך לקרוא את הנתונים</h2>
            <p><b>זוהתה ללא רמז</b> — הילד בחר נכון בניסיון הראשון, בלי ללחוץ על עזרה ובלי טעות קודמת באותה שאלה.</p>
            <p><b>זוהתה בעזרת רמז</b> — הילד הגיע לתשובה נכונה אחרי רמז או אחרי ניסיון שגוי. ההתקדמות במשחק ממשיכה, אבל המילה מסומנת לתרגול עצמאי.</p>
            <p><b>זוהתה בהקשר חדש</b> — זיהוי ללא רמז במשימה, בבדיקת החייזר או בחזרה, עם תמונות שונות מאלה של שלב הלימוד.</p>
            <p><b>נבדקה בחזרה מאוחרת</b> — רק אחרי שעברו לפחות 4 שעות מהתרגול האחרון והמילה הגיעה למועד החזרה שלה. מילה לא מסומנת כ"נזכרת לאורך זמן" לפני שבדיקה כזו בוצעה בפועל.</p>
            <p><b>הרכבה מאותיות (רמת מפקדי חלל)</b> — הפקה עצמאית: הילד רואה תמונה ומילה בעברית ומרכיב את המילה באנגלית. נמדדת בנפרד מזיהוי, ואינה משנה את מצב הזיהוי של המילה.</p>
            <p><b>מגבלות:</b> המדדים מבוססים רק על פעולות במשחק: זיהוי משמעות, בחירה מתוך אפשרויות, וברמה 3 גם הרכבת מילה מאותיות נתונות. הם אינם בודקים הגייה, קריאה חופשית או כתיבה בלי אותיות נתונות, ואינם אבחון. מספר הניסיונות קטן, ולכן הנתונים מתארים מגמה ולא רמת ידיעה מדויקת. כשכמה ילדים משחקים באותו מכשיר, הנתונים מתערבבים.</p>
          </section>

          <section className="card p-5 flex flex-col gap-3 text-base">
            <h2 className="text-xl font-extrabold">הגדרות</h2>
            <label className="flex items-center gap-3 min-h-[44px]">
              <input type="checkbox" className="w-6 h-6" checked={data.settings.readAloudHe} onChange={(e) => setSettings({ readAloudHe: e.target.checked })} />
              הקראת הוראות בעברית (כשיש קול עברי במכשיר)
            </label>
            <label className="flex items-center gap-3 min-h-[44px]">
              <input type="checkbox" className="w-6 h-6" checked={data.settings.reducedMotion} onChange={(e) => setSettings({ reducedMotion: e.target.checked })} />
              הפחתת אנימציות
            </label>
            <label className="flex items-center gap-3 min-h-[44px]">
              <input type="checkbox" className="w-6 h-6" checked={data.settings.music} onChange={(e) => setSettings({ music: e.target.checked })} />
              מוזיקת רקע
            </label>
            <label className="flex items-center gap-3 min-h-[44px]">
              <input type="checkbox" className="w-6 h-6" checked={data.settings.sfx} onChange={(e) => setSettings({ sfx: e.target.checked })} />
              צלילי משחק (ההשמעה של המילים עצמן תמיד זמינה)
            </label>
            <p data-testid="audio-status">
              מצב שמע במכשיר הזה — קול באנגלית: <b>{STATUS_HE[en]}</b>, קול בעברית: <b>{STATUS_HE[he]}</b>. כשאין קול, המשחק מציג איך אומרים את המילה באותיות עבריות.
            </p>
          </section>

          <section className="card p-5 flex flex-col gap-3 text-base">
            <h2 className="text-xl font-extrabold">פרטיות ושמירה</h2>
            <p>המשחק לא מבקש שם, גיל, אימייל, מצלמה או מיקרופון, ואינו שולח נתונים לשום שרת. ההתקדמות נשמרת רק בדפדפן הזה (localStorage), אינה מסונכרנת בין מכשירים, ועלולה להימחק אם מנקים את נתוני הדפדפן.</p>
            {!canSave && <p className="font-bold">{loadStatus === 'newer_version' ? 'השמירה במכשיר שייכת לגרסה חדשה יותר — המשחק לא ישנה אותה.' : 'בדפדפן הזה השמירה לא זמינה כרגע.'}</p>}
            <div className="flex flex-wrap gap-3">
              <BigButton
                variant="soft"
                onClick={async () => {
                  const json = JSON.stringify(data, null, 2);
                  try {
                    await navigator.clipboard.writeText(json);
                    setExportMsg('נתוני ההתקדמות הועתקו. אפשר להדביק אותם בקובץ טקסט.');
                    setExportText(null);
                  } catch {
                    setExportMsg('ההעתקה האוטומטית לא זמינה כאן. סמנו את הטקסט והעתיקו ידנית:');
                    setExportText(json);
                  }
                }}
              >
                העתקת נתוני ההתקדמות (JSON)
              </BigButton>
              <BigButton variant="soft" onClick={() => setConfirmReset(true)} testId="reset-btn">
                איפוס התקדמות
              </BigButton>
            </div>
            {exportMsg && <p role="status">{exportMsg}</p>}
            {exportText && <textarea readOnly className="w-full h-40 rounded-2xl border-3 border-line p-3 text-sm font-mono" dir="ltr" value={exportText} aria-label="נתוני ההתקדמות" />}
          </section>

          <section className="rounded-3xl border-3 border-dashed border-ink-soft p-5 flex flex-col gap-3 text-base bg-white/60">
            <h2 className="text-lg font-extrabold">🛠 כלי בדיקה למפתחים (לא חלק מחוויית הילד)</h2>
            <p>כדי לבדוק את מנגנון החזרות המאוחרות בלי לחכות, אפשר להזיז את שעון המשחק קדימה. הזזה משפיעה רק על המשחק במכשיר הזה.</p>
            <p>הזזת שעון נוכחית: <b data-testid="time-offset">{((n) => (n === 1 ? 'יום אחד' : `${n} ימים`))(Math.round(data.settings.devTimeOffsetMs / DAY))}</b> · שעת המשחק: {fmt(now())}</p>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                className="btn btn-soft !text-base"
                data-testid="time-travel"
                onClick={() => {
                  const off = data.settings.devTimeOffsetMs + DAY;
                  setTimeOffset(off);
                  setSettings({ devTimeOffsetMs: off });
                }}
              >
                הזזת השעון ביום קדימה
              </button>
              <button
                type="button"
                className="btn btn-soft !text-base"
                onClick={() => {
                  setTimeOffset(0);
                  setSettings({ devTimeOffsetMs: 0 });
                }}
              >
                איפוס השעון
              </button>
            </div>
          </section>

          <div className="flex justify-center">
            <BigButton onClick={() => go({ name: 'home' })}>חזרה למשחק</BigButton>
          </div>
        </div>
        <Dialog open={confirmReset} title="למחוק את כל ההתקדמות?" onClose={() => setConfirmReset(false)}>
          <p className="text-lg mb-5">כל המילים, הנתונים ומה שהחייזר למד יימחקו מהמכשיר הזה. אי אפשר לבטל את הפעולה.</p>
          <div className="flex gap-3 flex-wrap">
            <button
              className="btn btn-primary"
              data-testid="confirm-reset"
              onClick={() => {
                resetAll();
                setConfirmReset(false);
                setResetDone(true);
              }}
            >
              כן, למחוק
            </button>
            <button className="btn btn-soft" onClick={() => setConfirmReset(false)}>
              ביטול
            </button>
          </div>
        </Dialog>
      </Page>
    </>
  );
}
