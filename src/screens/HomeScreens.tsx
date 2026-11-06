import { useState } from 'react';
import { Alien, type AlienMood } from '../components/Alien';
import { ItemArt } from '../components/ItemArt';
import { AlienStage, BigButton, Page, SoundToggles, TopBar } from '../components/ui';
import { IconArrowLeft, IconBrain, IconCheck, IconLock, IconParent, IconStar } from '../components/Icons';
import { useGame, now } from '../state/GameContext';
import { useNav } from '../state/nav';
import { hasProgress } from '../engine/storage';
import { UNITS, REWARD_LABELS } from '../content/units';
import { stepIndexOf, unitStatus } from '../engine/gameProgress';
import { dueWords, wordsNeedingPractice } from '../engine/session';
import { WORDS } from '../content/words';
import { item } from '../content/items';
import { playSfx } from '../audio/sfx';

// ------------------------------- Home ---------------------------------------

export function HomeScreen() {
  const { data, loadStatus, canSave } = useGame();
  const { go } = useNav();
  const saved = hasProgress(data);
  const notice =
    loadStatus === 'corrupt_reset'
      ? 'לא הצלחנו לקרוא את השמירה הקודמת, אז פתחנו מעבדה חדשה.'
      : loadStatus === 'unavailable'
        ? 'בדפדפן הזה אי אפשר לשמור התקדמות. אפשר לשחק, אבל ההתקדמות לא תישמר.'
        : loadStatus === 'newer_version'
          ? 'השמירה נוצרה בגרסה חדשה יותר של המשחק ולכן לא נשמור עליה שינויים.'
          : null;
  return (
    <div className="min-h-dvh flex flex-col">
      <div className="flex justify-end px-4 pt-3 max-w-5xl mx-auto w-full">
        <SoundToggles />
      </div>
      <Page className="flex-1 flex flex-col items-center justify-center gap-5 text-center pt-2">
        <div className="relative">
          <div className="absolute -inset-6 rounded-full bg-white/60 blur-2xl" aria-hidden />
          <svg viewBox="0 0 320 120" className="absolute -top-6 left-1/2 -translate-x-1/2 w-[min(90vw,420px)] opacity-90" aria-hidden>
            <circle cx="40" cy="40" r="22" fill="#ffd23f" stroke="#2b2350" strokeWidth="3" />
            <ellipse cx="40" cy="40" rx="36" ry="9" fill="none" stroke="#2b2350" strokeWidth="3" />
            <circle cx="282" cy="70" r="14" fill="#ff9fb8" stroke="#2b2350" strokeWidth="3" />
            <path d="M250 22 l3 -8 l3 8 l8 3 l-8 3 l-3 8 l-3 -8 l-8 -3 Z" fill="#7c5cff" />
          </svg>
          <Alien mood="happy" size="clamp(170px, 40vw, 230px)" className="relative" />
        </div>
        <h1 className="en text-[clamp(3rem,12vw,5.5rem)] leading-none text-primary-dark drop-shadow-[0_4px_0_#fff]" lang="en" dir="ltr">
          AlienLab
        </h1>
        <p className="text-2xl font-bold -mt-2">לומדים אנגלית עם החייזר זיבי</p>
        <div className="flex gap-4 items-end justify-center" aria-hidden>
          <ItemArt item={item('apple', 'red')} size={58} decorative />
          <ItemArt item={item('ball', 'blue')} size={58} decorative />
          <ItemArt item={item('star', 'yellow')} size={58} decorative />
          <ItemArt item={item('key', 'yellow')} size={58} decorative />
        </div>
        {notice && <p className="card px-4 py-3 text-lg font-medium max-w-md">{notice}</p>}
        <div className="flex flex-col items-center gap-4 mt-2">
          {saved ? (
            <BigButton onClick={() => go(data.game.introSeen ? { name: 'lab' } : { name: 'intro' })} className="!text-2xl !px-10 !min-h-[68px]" testId="continue-btn">
              המשך משחק <IconArrowLeft size={28} />
            </BigButton>
          ) : (
            <BigButton onClick={() => go({ name: 'intro' })} className="!text-2xl !px-10 !min-h-[68px]" testId="start-btn">
              התחל משחק <IconArrowLeft size={28} />
            </BigButton>
          )}
          <BigButton variant="soft" onClick={() => go({ name: 'parents' })} className="!text-lg" testId="parents-btn">
            <IconParent /> אזור להורים
          </BigButton>
        </div>
        {!canSave && loadStatus !== 'unavailable' && loadStatus !== 'newer_version' && <p className="text-sm text-ink-soft">ההתקדמות לא נשמרת במכשיר הזה.</p>}
        <p className="text-sm text-ink-soft max-w-sm">בלי הרשמה ובלי פרטים אישיים. ההתקדמות נשמרת רק במכשיר הזה.</p>
      </Page>
    </div>
  );
}

// ------------------------------- Intro --------------------------------------

const INTRO: { text: string; mood: AlienMood }[] = [
  { text: 'שלום! אני זיבי, חייזר קטן שהגיע לכדור הארץ.', mood: 'happy' },
  { text: 'אני רוצה ללמוד אנגלית, אבל אני לא יודע אפילו מילה אחת.', mood: 'confused' },
  { text: 'רוצים שנלמד יחד? קודם נגלה מילים חדשות, ואחר כך אתם תלמדו אותי!', mood: 'curious' },
];

export function IntroScreen() {
  const { update } = useGame();
  const { go } = useNav();
  const [i, setI] = useState(0);
  const last = i === INTRO.length - 1;
  return (
    <>
      <TopBar onHome={() => go({ name: 'home' })} homeLabel="חזרה למסך הפתיחה" />
      <Page className="flex flex-col items-center gap-6 pt-4" >
        <div data-testid="intro-screen" className="w-full flex flex-col items-center gap-6">
          <Alien mood={INTRO[i].mood} size="clamp(170px, 42vw, 240px)" />
          <div className="w-full max-w-xl">
            <AlienStage mood={INTRO[i].mood} text={INTRO[i].text} compact />
          </div>
          <div className="flex gap-2" aria-hidden>
            {INTRO.map((_, k) => (
              <span key={k} className="w-3 h-3 rounded-full" style={{ background: k <= i ? '#7c5cff' : '#d9d1fb' }} />
            ))}
          </div>
          <div className="flex gap-3">
            {i > 0 && (
              <BigButton variant="soft" onClick={() => setI(i - 1)}>
                אחורה
              </BigButton>
            )}
            {last ? (
              <BigButton
                className="!text-2xl !px-8"
                testId="intro-start"
                onClick={() => {
                  update((d) => ({ ...d, game: { ...d.game, introSeen: true, startedAt: d.game.startedAt ?? now(), lastPlayedAt: now() } }));
                  go({ name: 'lab' });
                }}
              >
                בואו נתחיל! 🚀
              </BigButton>
            ) : (
              <BigButton onClick={() => setI(i + 1)} testId="intro-next">
                הבא <IconArrowLeft size={24} />
              </BigButton>
            )}
          </div>
        </div>
      </Page>
    </>
  );
}

// -------------------------------- Lab ---------------------------------------

export function LabScreen({ message }: { message?: string }) {
  const { data } = useGame();
  const { go } = useNav();
  const [lockedMsg, setLockedMsg] = useState<string | null>(message ?? null);
  const t = now();
  const due = dueWords(data, t);
  const practice = wordsNeedingPractice(data);
  const allDone = UNITS.every((u) => data.game.completedUnits.includes(u.id));
  const fresh = Object.values(data.game.unitStep).every((s) => !s) && data.attempts.length === 0;
  const returning = data.game.lastPlayedAt && t - data.game.lastPlayedAt > 12 * 60 * 60 * 1000;

  let line = 'איזה כיף שחזרתם! נמשיך מאיפה שעצרנו?';
  let mood: AlienMood = 'happy';
  if (lockedMsg) {
    line = lockedMsg;
    mood = 'thinking';
  } else if (due.length) {
    line = returning ? 'ברוכים השבים! שכחתי כמה מילים מאז הפעם הקודמת... תעזרו לי להיזכר?' : 'הממ, שכחתי כמה מילים... תעזרו לי להיזכר?';
    mood = 'thinking';
  } else if (fresh) {
    line = 'ברוכים הבאים למעבדה שלי! בואו נתחיל בתחנה הראשונה.';
    mood = 'curious';
  } else if (allDone) {
    line = 'סיימנו את כל התחנות! אפשר לתרגל עוד, או לראות מה יש לי בראש.';
  }

  return (
    <>
      <TopBar onHome={() => go({ name: 'home' })} homeLabel="חזרה למסך הפתיחה" title="המעבדה של זיבי" />
      <Page>
        <div className="flex flex-col gap-5" data-testid="lab-screen">
          <AlienStage mood={mood} text={line} />

          {due.length > 0 && (
            <button
              type="button"
              className="card anim-pop p-4 flex items-center gap-4 text-start bg-[#fff8dc] border-sun-dark cursor-pointer"
              onClick={() => go({ name: 'review', mode: 'due' })}
              data-testid="review-station"
            >
              <span className="text-4xl" aria-hidden>
                🧠
              </span>
              <span className="flex-1">
                <span className="block text-xl font-extrabold">משימת זיכרון: עוזרים לזיבי להיזכר</span>
                <span className="block text-base">
                  {due.length} {due.length === 1 ? 'מילה' : 'מילים'} מהפעם הקודמת
                </span>
              </span>
              <IconArrowLeft size={28} />
            </button>
          )}

          <div className="grid sm:grid-cols-3 gap-4" data-testid="stations">
            {UNITS.map((u) => {
              const st = unitStatus(data.game, u);
              const idx = stepIndexOf(data.game, u);
              const prev = UNITS.find((p) => p.unlocksUnitId === u.id);
              const met = u.wordIds.filter((w) => data.learning[w]?.introduced).length;
              return (
                <button
                  key={u.id}
                  type="button"
                  data-testid={`station-${u.id}`}
                  data-status={st}
                  aria-label={`${u.titleHe} — ${st === 'locked' ? 'נעול' : st === 'completed' ? 'הושלם' : 'פתוח'}`}
                  className={`card text-start p-4 flex flex-col gap-3 transition ${st === 'locked' ? 'opacity-70 grayscale-[.5]' : 'hover:-translate-y-1'} cursor-pointer`}
                  style={{ borderColor: st === 'locked' ? undefined : u.accent }}
                  onClick={() => {
                    if (st === 'locked') {
                      playSfx('tryAgain');
                      setLockedMsg(`התחנה "${u.titleHe}" עוד נעולה. היא תיפתח כשנסיים את "${prev?.titleHe ?? ''}".`);
                      return;
                    }
                    go({ name: 'unit', unitId: u.id });
                  }}
                >
                  <div className="flex items-end justify-center gap-1 h-[84px] rounded-2xl" style={{ background: `${u.accent}1f` }}>
                    {u.icon.map((i, k) => (
                      <ItemArt key={k} item={i} size={70} decorative />
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="grid place-items-center w-9 h-9 rounded-full text-white font-extrabold border-2 border-ink" style={{ background: u.accent }}>
                      {u.order}
                    </span>
                    <span className="text-xl font-extrabold flex-1">{u.titleHe}</span>
                  </div>
                  <span className="text-base text-ink-soft">{u.subtitleHe}</span>
                  <span className="flex items-center gap-2 font-bold">
                    {st === 'locked' && (
                      <>
                        <IconLock size={22} /> נעול — ייפתח אחרי "{prev?.titleHe}"
                      </>
                    )}
                    {st === 'available' && (
                      <span className="rounded-full bg-sun border-2 border-ink px-3 py-0.5">
                        <IconStar size={16} className="inline -mt-1" /> פתוח! בואו נתחיל
                      </span>
                    )}
                    {st === 'in_progress' && (
                      <span>
                        בתהליך: שלב {idx + 1} מתוך {u.steps.length} · {met}/4 מילים
                      </span>
                    )}
                    {st === 'completed' && (
                      <span className="text-good flex items-center gap-1">
                        <IconCheck size={22} /> הושלם! אפשר לבקר שוב
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap gap-3 justify-center">
            <BigButton variant="soft" onClick={() => go({ name: 'brain' })} testId="brain-btn">
              <IconBrain /> מה זיבי יודע?
            </BigButton>
            {practice.length > 0 && (
              <BigButton variant="soft" onClick={() => go({ name: 'review', mode: 'practice' })} testId="practice-btn">
                🔁 תרגול נוסף ({practice.length})
              </BigButton>
            )}
          </div>

          {(data.alien.abilities.length > 0 || data.game.inventory.length > 0) && (
            <div className="card p-4 flex flex-col gap-2" data-testid="inventory">
              <p className="font-extrabold">מה זיבי השיג עד עכשיו</p>
              <div className="flex flex-wrap gap-2">
                {data.alien.abilities.map((a) => {
                  const w = WORDS.find((x) => x.teach?.ability.id === a);
                  return (
                    <span key={a} className="rounded-full bg-[#e6fbf5] border-2 border-teal px-3 py-1 font-bold">
                      ⭐ {w?.teach?.ability.labelHe}
                    </span>
                  );
                })}
                {data.game.inventory.map((r) => (
                  <span key={r} className="rounded-full bg-[#fff6d6] border-2 border-sun-dark px-3 py-1 font-bold">
                    🎁 {REWARD_LABELS[r] ?? r}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </Page>
    </>
  );
}

