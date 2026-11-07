import { AlienStage, EnglishWord, Page, TopBar } from '../components/ui';
import { ItemArt } from '../components/ItemArt';
import { useGame } from '../state/GameContext';
import { useNav } from '../state/nav';
import { UNITS, unitWordIds } from '../content/units';
import { levelOfGame } from '../engine/gameProgress';
import { getWord } from '../content/words';
import { emptyConcept, examplesOf, guessLabelHe, understandingOf, UNDERSTANDING_HE } from '../engine/alienMind';
import { GRAMMAR, kosmoDictionary, kosmoTaught } from '../engine/kosmo';
import { getWord as wordOf } from '../content/words';
import type { KosmoWord } from '../engine/types';

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
import { AlienThought } from './steps/TeachStep';
import { parseItemId } from '../content/items';


/** A child-friendly view of the alien's real internal knowledge model. */
export function BrainScreen() {
  const { data } = useGame();
  const { go } = useNav();
  return (
    <>
      <TopBar onHome={() => go({ name: 'lab' })} title="מה קוסמו יודע?" />
      <Page>
        <div className="flex flex-col gap-4" data-testid="brain-screen">
          <AlienStage mood="thinking" text="זה המוח שלי! אני יודע רק מה שלימדתם אותי — כאן רואים מה למדתי מכם, איך, ובמה אני עוד מתבלבל." autoRead={false} />
          <section className="card p-4 flex flex-wrap items-center gap-2" data-testid="kosmo-dictionary" data-count={kosmoDictionary(data).length}>
            <h2 className="text-xl font-extrabold w-full">📖 המילון של קוסמו: {kosmoDictionary(data).length} מילים — כולן ממך</h2>
            {kosmoDictionary(data).length === 0 && <p>עוד לא לימדתם אותי מילים. בכל פעם שתראו לי, תתקנו אותי או תזכירו לי — המילה תיכנס לכאן.</p>}
            {kosmoDictionary(data).map(({ wordId, understanding }) => (
              <span key={wordId} className={`inline-flex items-center gap-1 rounded-full border-2 px-3 py-1 ${understanding === 'understood' ? 'bg-good-bg border-good' : 'bg-lab border-line'}`}>
                <bdi className="en text-primary-dark" dir="ltr">
                  {GRAMMAR[wordId]?.token ?? wordOf(wordId).english}
                </bdi>
                <span className="text-sm">{understanding === 'understood' ? '💡' : '🤔'}</span>
              </span>
            ))}
          </section>
          {UNITS.map((u) => (
            <section key={u.id} className="card p-4 flex flex-col gap-3">
              <h2 className="text-xl font-extrabold">{u.titleHe}</h2>
              <div className="grid sm:grid-cols-2 gap-3 items-start">
                {unitWordIds(u, levelOfGame(data.game)).map((id) => {
                  const w = getWord(id);
                  const k = data.alien.concepts[id] ?? emptyConcept(id);
                  const u2 = understandingOf(w.target, k);
                  const taught = examplesOf(k).length > 0;
                  const mix = w.kosmoMixesUp;
                  return (
                    <div key={id} className="rounded-3xl border-3 border-line p-3 flex flex-col gap-2" data-testid={`brain-${id}`} data-understanding={u2}>
                      <div className="flex items-center gap-2">
                        <EnglishWord text={w.english} size="md" />
                        <span className="font-bold">{w.hebrew}</span>
                        <span className={`ms-auto rounded-full px-2 py-0.5 text-sm font-bold border-2 ${u2 === 'understood' ? 'bg-good-bg border-good' : u2 === 'misconception' ? 'bg-try-bg border-try' : 'bg-lab border-line'}`}>
                          {UNDERSTANDING_HE[u2]}
                        </span>
                      </div>
                      {taught && k.examples.length > 0 && <AlienThought word={w} k={k} compact />}
                      {taught && k.examples.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1">
                          <span className="text-sm text-ink-soft">דוגמאות:</span>
                          {k.examples.map((e) => {
                            const it = parseItemId(e);
                            return it ? <ItemArt key={e} item={it} size={40} /> : null;
                          })}
                        </div>
                      )}
                      {taught && (k.negatives ?? []).length > 0 && (
                        <div className="flex flex-wrap items-center gap-1">
                          <span className="text-sm text-ink-soft">זה לא {w.english}:</span>
                          {(k.negatives ?? []).map((e) => {
                            const it = parseItemId(e);
                            return it ? <ItemArt key={e} item={it} size={36} /> : null;
                          })}
                        </div>
                      )}
                      {k.misconceptions.length > 0 && (
                        <p className="text-sm">
                          פעם חשבתי ש-<bdi className="en" dir="ltr">{w.english}</bdi> זה {k.misconceptions.map((m) => guessLabelHe(m.feature)).join(', ואחר כך ')}.
                          {k.corrections.length > 0 && ` תיקנתם אותי ${k.corrections.length === 1 ? 'פעם אחת' : `${k.corrections.length} פעמים`}.`}
                        </p>
                      )}
                      {taught && k.tests.length > 0 && (
                        <p className="text-sm text-ink-soft">
                          בדיקות: {k.tests.filter((t) => t.alienCorrect).length} הצלחות, {k.tests.filter((t) => !t.alienCorrect).length} טעויות
                        </p>
                      )}
                      {kosmoTaught(data, id) && <LearnedFromYou e={data.alien.lexicon[id] ?? null} />}
                      {!taught && (
                        <p className="text-sm text-ink-soft" data-testid={`not-taught-${id}`}>
                          {mix && !kosmoTaught(data, mix)
                            ? `עוד לא לימדתם אותי. בינתיים אני מתבלבל בינה לבין ${wordOf(mix).english}.`
                            : 'עוד לא לימדתם אותי — כשאפגוש אותה, אבקש שתראו לי.'}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </Page>
    </>
  );
}
