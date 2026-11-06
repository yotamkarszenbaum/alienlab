import { useEffect } from 'react';
import { Page, TopBar } from '../components/ui';
import { UNITS_BY_ID } from '../content/units';
import { advanceStep, isUnitUnlocked, stepIndexOf } from '../engine/gameProgress';
import { useGame, now } from '../state/GameContext';
import { useNav } from '../state/nav';
import { DiscoverStep, PracticeStep, SentenceStep } from './steps/LearnSteps';
import { TeachStep } from './steps/TeachStep';
import { PlayStep, SummaryStep } from './steps/PlayStep';

export function UnitScreen({ unitId }: { unitId: string }) {
  const { data, update } = useGame();
  const { go } = useNav();
  const unit = UNITS_BY_ID[unitId];
  const unlocked = unit && isUnitUnlocked(data.game, unitId);

  useEffect(() => {
    if (!unit || !unlocked) {
      go({ name: 'lab', message: 'התחנה הזו עוד נעולה. היא תיפתח כשנסיים את התחנה הקודמת.' });
      return;
    }
    if (data.game.currentUnitId !== unitId) update((d) => ({ ...d, game: { ...d.game, currentUnitId: unitId, lastPlayedAt: now() } }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unitId, unlocked]);

  if (!unit || !unlocked) return null;

  const idx = stepIndexOf(data.game, unit);
  const step = unit.steps[idx];
  const next = () => {
    update((d) => ({ ...d, game: advanceStep(d.game, unit.id, idx, now()) }));
    window.scrollTo({ top: 0 });
  };
  const goToStep = (stepId: string) => {
    const i = unit.steps.findIndex((s) => s.id === stepId);
    if (i >= 0) update((d) => ({ ...d, game: { ...d.game, unitStep: { ...d.game.unitStep, [unit.id]: i } } }));
  };

  let body;
  switch (step.type) {
    case 'discover':
      body = <DiscoverStep key={step.id} wordId={step.wordId} onDone={next} />;
      break;
    case 'practice':
      body = <PracticeStep key={step.id} questions={step.questions} onDone={next} />;
      break;
    case 'sentence':
      body = <SentenceStep key={step.id} sentenceId={step.sentenceId} questions={step.questions} onDone={next} />;
      break;
    case 'teach':
      body = <TeachStep key={step.id} stepId={step.id} conceptId={step.conceptId} onDone={next} />;
      break;
    case 'play':
      body = <PlayStep key={step.id} missionId={step.missionId} unit={unit} onDone={next} onGoToStep={goToStep} />;
      break;
    case 'summary':
      body = (
        <SummaryStep
          key={step.id}
          unit={unit}
          onFinish={() => go({ name: 'lab' })}
          onNextUnit={(id) => go({ name: 'unit', unitId: id })}
        />
      );
      break;
  }

  return (
    <>
      <TopBar onHome={() => go({ name: 'lab' })} title={unit.titleHe} progress={{ current: idx, total: unit.steps.length }} />
      <Page>
        <div data-testid="unit-screen" data-unit={unit.id} data-step={step.id} data-step-type={step.type}>
          {body}
        </div>
      </Page>
    </>
  );
}
