import { AlienStage, EnglishWord, Page, TopBar } from '../components/ui';
import { ItemArt } from '../components/ItemArt';
import { useGame } from '../state/GameContext';
import { useNav } from '../state/nav';
import { UNITS } from '../content/units';
import { getWord } from '../content/words';
import { emptyConcept, guessLabelHe, understandingOf, UNDERSTANDING_HE } from '../engine/alienMind';
import { AlienThought } from './steps/TeachStep';
import { parseItemId } from '../content/items';


/** A child-friendly view of the alien's real internal knowledge model. */
export function BrainScreen() {
  const { data } = useGame();
  const { go } = useNav();
  return (
    <>
      <TopBar onHome={() => go({ name: 'lab' })} title="מה זיבי יודע?" />
      <Page>
        <div className="flex flex-col gap-4" data-testid="brain-screen">
          <AlienStage mood="thinking" text="זה המוח שלי! כאן רואים כל מה שלמדתי מכם — וגם במה התבלבלתי." autoRead={false} />
          {UNITS.map((u) => (
            <section key={u.id} className="card p-4 flex flex-col gap-3">
              <h2 className="text-xl font-extrabold">{u.titleHe}</h2>
              <div className="grid sm:grid-cols-2 gap-3 items-start">
                {u.wordIds.map((id) => {
                  const w = getWord(id);
                  const k = data.alien.concepts[id] ?? emptyConcept(id);
                  const u2 = understandingOf(w.target, k);
                  const taught = !!w.teach;
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
                      {!taught && k.heard && <p className="text-sm text-ink-soft">שמעתי את המילה יחד אתכם.</p>}
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
