import { ItemArt } from './ItemArt';
import { useGame } from '../state/GameContext';
import { UNITS, unitWordIds } from '../content/units';
import { getWord } from '../content/words';
import { levelOfGame } from '../engine/gameProgress';
import { masteryOf, masterySummary, MILESTONES, MILESTONE_UI } from '../engine/mastery';

/** The five-milestone map. `parent` shows the precise definitions and counts. */
export function MasteryMap({ parent = false }: { parent?: boolean }) {
  const { data } = useGame();
  const level = levelOfGame(data.game);
  const all = UNITS.flatMap((u) => unitWordIds(u, level));
  const sum = masterySummary(data, all);
  return (
    <div className="flex flex-col gap-3" data-testid={parent ? 'mastery-parent' : 'mastery-map'}>
      <div className="grid grid-cols-5 gap-2" data-testid="mastery-summary">
        {MILESTONES.map((m) => (
          <div key={m} className="card p-2 text-center flex flex-col items-center" data-testid={`ms-sum-${m}`} data-count={sum[m]}>
            <span className="text-2xl">{MILESTONE_UI[m].icon}</span>
            <span className="text-sm font-bold leading-tight">{MILESTONE_UI[m].kidHe}</span>
            <span className="text-xl font-extrabold">
              {sum[m]}/{all.length}
            </span>
          </div>
        ))}
      </div>
      {parent && (
        <ul className="text-sm leading-relaxed list-disc ps-5">
          {MILESTONES.map((m) => (
            <li key={m}>
              {MILESTONE_UI[m].icon} <b>{MILESTONE_UI[m].kidHe}</b> — {MILESTONE_UI[m].parentHe}
            </li>
          ))}
          <li>כל שלב נדלק רק מפעולה שהילד עשה בעצמו. השלמת משימה שבה הופיעה המילה לא מדליקה שום שלב, וגם לא אישור של תשובה שקוסמו הראה.</li>
        </ul>
      )}
      {UNITS.map((u) => (
        <section key={u.id} className="card p-3 overflow-x-auto">
          <h3 className="font-extrabold mb-2">{u.titleHe}</h3>
          <table className="w-full text-center border-separate border-spacing-y-1">
            <thead>
              <tr className="text-sm text-ink-soft">
                <th className="text-start font-bold">מילה</th>
                {MILESTONES.map((m) => (
                  <th key={m} className="font-bold" title={MILESTONE_UI[m].parentHe}>
                    {MILESTONE_UI[m].icon}
                    <span className="hidden sm:block text-xs">{MILESTONE_UI[m].kidHe}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {unitWordIds(u, level).map((id) => {
                const w = getWord(id);
                const ms = masteryOf(data.learning[id]);
                const lit = MILESTONES.filter((m) => ms[m]);
                return (
                  <tr key={id} data-testid={`mastery-${id}`} data-ms={lit.join(',')}>
                    <td className="text-start">
                      <span className="inline-flex items-center gap-2">
                        <ItemArt item={w.positiveExamples[0]} size={30} decorative />
                        <bdi dir="ltr" className="en text-primary-dark">
                          {w.english}
                        </bdi>
                        <span className="text-sm">{w.hebrew}</span>
                      </span>
                    </td>
                    {MILESTONES.map((m) => (
                      <td key={m} aria-label={`${MILESTONE_UI[m].kidHe}: ${ms[m] ? 'כן' : 'עוד לא'}`}>
                        <span className={`inline-grid place-items-center w-9 h-9 rounded-full text-lg ${ms[m] ? 'bg-sun border-2 border-ink' : 'bg-lab border-2 border-dashed border-line opacity-50 grayscale'}`}>
                          {MILESTONE_UI[m].icon}
                        </span>
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      ))}
    </div>
  );
}
