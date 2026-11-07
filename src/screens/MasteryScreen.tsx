import { AlienStage, Page, TopBar } from '../components/ui';
import { MasteryMap } from '../components/MasteryMap';
import { useNav } from '../state/nav';
import { MILESTONES, MILESTONE_UI } from '../engine/mastery';

/** The child's own map: what they really know, in five steps per word. */
export function MasteryScreen() {
  const { go } = useNav();
  return (
    <>
      <TopBar onHome={() => go({ name: 'lab' })} title="המפה שלי" />
      <Page>
        <div className="flex flex-col gap-4" data-testid="mastery-screen">
          <AlienStage mood="happy" text="זו המפה שלך! לכל מילה יש חמישה כוכבים, וכל אחד נדלק רק ממה שעשית בעצמך — לא מנקודות ולא מזה שסיימנו משימה." autoRead={false} />
          <div className="card p-3 flex flex-wrap gap-x-4 gap-y-1 justify-center text-base">
            {MILESTONES.map((m) => (
              <span key={m}>
                {MILESTONE_UI[m].icon} <b>{MILESTONE_UI[m].kidHe}</b>
              </span>
            ))}
          </div>
          <MasteryMap />
        </div>
      </Page>
    </>
  );
}
