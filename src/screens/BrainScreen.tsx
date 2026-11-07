import { useState } from 'react';
import { AlienStage, EnglishWord, Page, TopBar } from '../components/ui';
import { BrainMap } from '../components/BrainMap';
import { useGame } from '../state/GameContext';
import { useNav } from '../state/nav';
import { UNITS, unitWordIds } from '../content/units';
import { levelOfGame } from '../engine/gameProgress';
import { getWord } from '../content/words';
import { emptyConcept, guessLabelHe, UNDERSTANDING_HE } from '../engine/alienMind';
import { GRAMMAR, kosmoDictionary, kosmoTaught } from '../engine/kosmo';
import { brainTimeline, brainView } from '../engine/brain';
import type { KosmoWord, SaveData } from '../engine/types';

// "Cosmo's Brain": the transparent view of Kosmo's real knowledge model —
// what he links each word to, what is still only "maybe", which links the
// child's teaching cut, and what he still mixes up. Nothing here is made up:
// it is drawn from the same data Kosmo acts on.

const HOW_HE: Record<KosmoWord['first'], string> = {
  teach: 'לימדתם אותי בשלב הלימוד',
  show: 'הראיתם לי מה זה',
  fix: 'תיקנתם אותי כשהתבלבלתי',
  remind: 'הזכרתם לי',
};

function LearnedFromYou({ e }: { e: KosmoWord | null }) {
  if (!e) return <p className="text-sm text-good font-bold">✓ לימדתם אותי בשלב הלימוד</p>;
  const parts = [HOW_HE[e.first]];
  if (e.fixed > (e.first === 'fix' ? 1 : 0)) parts.push(`תיקנתם אותי ${e.fixed} פעמים`);
  if (e.reminded > (e.first === 'remind' ? 1 : 0)) parts.push(`הזכרתם לי ${e.reminded} פעמים`);
  return (
    <p className="text-sm text-good font-bold" data-testid="learned-from-you">
      ✓ {parts.join(' · ')}
      {e.usedRight > 0 && <span className="text-ink"> · השתמשתי בזה נכון לבד {e.usedRight === 1 ? 'פעם אחת' : `${e.usedRight} פעמים`} 🤖</span>}
    </p>
  );
}

type Cat = 'understood' | 'partial' | 'misconception' | 'mixup' | 'none';
const CAT_HE: Record<Cat | 'all', string> = {
  all: 'הכול',
  understood: '💡 מבין',
  partial: '🤔 מבין חלקית',
  misconception: '🙃 חושב משהו לא נכון',
  mixup: '😵‍💫 מתבלבל',
  none: '❔ עוד לא לימדתם',
};

function categoryOf(d: SaveData, id: string): Cat {
  const v = brainView(d, id);
  if (v.examples > 0) return v.understanding === 'understood' ? 'understood' : v.understanding === 'partial' ? 'partial' : 'misconception';
  return v.mixupWith ? 'mixup' : 'none';
}

export function BrainScreen() {
  const { data } = useGame();
  const { go } = useNav();
  const [filter, setFilter] = useState<Cat | 'all'>('all');
  const level = levelOfGame(data.game);
  const allIds = UNITS.flatMap((u) => unitWordIds(u, level));
  const counts = allIds.reduce<Record<Cat, number>>((acc, id) => ({ ...acc, [categoryOf(data, id)]: (acc[categoryOf(data, id)] ?? 0) + 1 }), { understood: 0, partial: 0, misconception: 0, mixup: 0, none: 0 });
  const timeline = brainTimeline(data);
  const dict = kosmoDictionary(data);
  return (
    <>
      <TopBar onHome={() => go({ name: 'lab' })} title="המוח של קוסמו" />
      <Page>
        <div className="flex flex-col gap-4" data-testid="brain-screen">
          <AlienStage mood="thinking" text="זה המוח שלי, והוא שקוף! אני יודע רק מה שלימדתם אותי. כאן רואים לאיזה משמעות חיברתי כל מילה, מה עוד רק 'אולי', אילו חיבורים חתכתם לי — ובמה אני עוד מתבלבל." autoRead={false} />

          <section className="card p-4 flex flex-wrap items-center gap-2" data-testid="kosmo-dictionary" data-count={dict.length}>
            <h2 className="text-xl font-extrabold w-full">📖 המילון של קוסמו: {dict.length} מילים — כולן ממך</h2>
            {dict.length === 0 && <p>עוד לא לימדתם אותי מילים. בכל פעם שתראו לי, תתקנו אותי או תזכירו לי — המילה תיכנס לכאן.</p>}
            {dict.map(({ wordId, understanding }) => (
              <span key={wordId} className={`inline-flex items-center gap-1 rounded-full border-2 px-3 py-1 ${understanding === 'understood' ? 'bg-good-bg border-good' : 'bg-lab border-line'}`}>
                <bdi className="en text-primary-dark" dir="ltr">
                  {GRAMMAR[wordId]?.token ?? getWord(wordId).english}
                </bdi>
                <span className="text-sm">{understanding === 'understood' ? '💡' : '🤔'}</span>
              </span>
            ))}
          </section>

          <section className="card p-4 flex flex-col gap-2" data-testid="brain-timeline" data-count={timeline.length}>
            <h2 className="text-xl font-extrabold">🕒 מה שיניתם במוח שלי לאחרונה</h2>
            {timeline.length === 0 ? (
              <p>עוד לא שיניתם לי את הדעה. כשאחשוב משהו לא נכון ותראו לי דוגמה טובה — זה יופיע כאן.</p>
            ) : (
              timeline.map((t, i) => (
                <p key={i} className="flex flex-wrap items-center gap-2">
                  <bdi dir="ltr" className="en text-primary-dark">
                    {getWord(t.wordId).english}
                  </bdi>
                  {t.before && <span className="rounded-full bg-try-bg border-2 border-try px-2 line-through decoration-2">✂️ {guessLabelHe(t.before)}</span>}
                  <span aria-hidden>←</span>
                  {t.after && <span className="rounded-full bg-good-bg border-2 border-good px-2">{guessLabelHe(t.after)}</span>}
                  <span className="text-sm text-ink-soft">{t.negative ? `(כשסימנתם ש${t.byHe} זה לא ${getWord(t.wordId).english})` : `(בזכות ${t.byHe})`}</span>
                </p>
              ))
            )}
          </section>

          <div className="flex flex-wrap gap-2" role="tablist" aria-label="סינון לפי מה שקוסמו מבין" data-testid="brain-filter">
            {(['all', 'understood', 'partial', 'misconception', 'mixup', 'none'] as const).map((c) => (
              <button
                key={c}
                type="button"
                role="tab"
                aria-selected={filter === c}
                data-testid={`brain-filter-${c}`}
                onClick={() => setFilter(c)}
                className={`rounded-full border-2 px-3 py-1 font-bold ${filter === c ? 'bg-primary text-white border-primary' : 'bg-white border-line'}`}
              >
                {CAT_HE[c]} {c !== 'all' && <span className="opacity-80">({counts[c]})</span>}
              </button>
            ))}
          </div>

          {UNITS.map((u) => {
            const ids = unitWordIds(u, level).filter((id) => filter === 'all' || categoryOf(data, id) === filter);
            if (!ids.length) return null;
            return (
              <section key={u.id} className="card p-4 flex flex-col gap-3">
                <h2 className="text-xl font-extrabold">{u.titleHe}</h2>
                <div className="grid sm:grid-cols-2 gap-3 items-start">
                  {ids.map((id) => {
                    const w = getWord(id);
                    const k = data.alien.concepts[id] ?? emptyConcept(id);
                    const v = brainView(data, id);
                    return (
                      <div key={id} className="rounded-3xl border-3 border-line p-3 flex flex-col gap-2" data-testid={`brain-${id}`} data-understanding={v.understanding} data-category={categoryOf(data, id)}>
                        <div className="flex items-center gap-2">
                          <EnglishWord text={w.english} size="md" />
                          <span className="font-bold">{w.hebrew}</span>
                          <span
                            className={`ms-auto rounded-full px-2 py-0.5 text-sm font-bold border-2 ${v.understanding === 'understood' ? 'bg-good-bg border-good' : v.understanding === 'misconception' || v.mixupWith ? 'bg-try-bg border-try' : 'bg-lab border-line'}`}
                          >
                            {v.mixupWith ? 'מתבלבל' : UNDERSTANDING_HE[v.understanding]}
                          </span>
                        </div>
                        <BrainMap wordId={id} compact />
                        {k.misconceptions.length > 0 && (
                          <p className="text-sm">
                            פעם חשבתי ש-<bdi className="en" dir="ltr">{w.english}</bdi> זה {k.misconceptions.map((m) => guessLabelHe(m.feature)).join(', ואחר כך ')}.
                            {k.corrections.length > 0 && ` תיקנתם אותי ${k.corrections.length === 1 ? 'פעם אחת' : `${k.corrections.length} פעמים`}.`}
                          </p>
                        )}
                        {k.tests.length > 0 && (
                          <p className="text-sm text-ink-soft">
                            בדיקות: {k.tests.filter((t) => t.alienCorrect).length} הצלחות, {k.tests.filter((t) => !t.alienCorrect).length} טעויות
                          </p>
                        )}
                        {kosmoTaught(data, id) && <LearnedFromYou e={data.alien.lexicon[id] ?? null} />}
                        {!kosmoTaught(data, id) && (
                          <p className="text-sm text-ink-soft" data-testid={`not-taught-${id}`}>
                            {v.mixupWith ? `עוד לא לימדתם אותי. בינתיים אני מתבלבל בינה לבין ${getWord(v.mixupWith).english}.` : 'עוד לא לימדתם אותי — כשאפגוש אותה, אבקש שתראו לי.'}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </Page>
    </>
  );
}
