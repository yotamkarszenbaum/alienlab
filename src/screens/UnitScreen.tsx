import { useEffect } from 'react';
import { Page, TopBar } from '../components/ui';
import { UNITS_BY_ID } from '../content/units';
import { inLevel } from '../content/levels';
import { advanceStep, isUnitUnlocked, levelOfGame, reopenStep, stepIndexOf, visibleSteps } from '../engine/gameProgress';
import { useGame, now } from '../state/GameContext';
import { useNav } from '../state/nav';
import { DiscoverStep, PracticeStep, SentenceStep } from './steps/LearnSteps';
import { TeachStep } from './steps/TeachStep';
import { PlayStep, SummaryStep } from './steps/PlayStep';
import { SpellStep } from './steps/SpellStep';
import { SaysStep } from './steps/SaysStep';
import { BuildStep } from './steps/BuildStep';
import { FillStep } from './steps/FillStep';
import { ReadStep } from './steps/ReadStep';

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

  const level = levelOfGame(data.game);
  const steps = visibleSteps(data.game, unit);
  const idx = stepIndexOf(data.game, unit);
  const step = steps[idx];
  const next = () => {
    update((d) => ({ ...d, game: advanceStep(d.game, unit.id, step.id, now()) }));
    window.scrollTo({ top: 0 });
  };
  const goToStep = (stepId: string) => update((d) => ({ ...d, game: reopenStep(d.game, unit.id, stepId) }));

  let body;
  switch (step.type) {
    case 'discover':
      body = <DiscoverStep key={step.id} wordId={step.wordId} onDone={next} />;
      break;
    case 'practice':
      body = <PracticeStep key={step.id} questions={step.questions.filter((q) => inLevel(q.minLevel, level))} onDone={next} />;
      break;
    case 'sentence':
      body = <SentenceStep key={step.id} sentenceId={step.sentenceId} questions={step.questions.filter((q) => inLevel(q.minLevel, level))} onDone={next} />;
      break;
    case 'spell':
      body = <SpellStep key={step.id} stepId={step.id} wordIds={level >= 3 && step.wordIdsL3 ? step.wordIdsL3 : step.wordIds} onDone={next} />;
      break;
    case 'fill':
      body = <FillStep key={step.id} stepId={step.id} sentences={step.sentences} onDone={next} />;
      break;
    case 'read':
      body = <ReadStep key={step.id} stepId={step.id} titleHe={step.titleHe} lines={step.lines} questions={step.questions} onDone={next} />;
      break;
    case 'says':
      body = <SaysStep key={step.id} stepId={step.id} scene={step.scene} rounds={step.rounds} onDone={next} />;
      break;
    case 'build':
      body = <BuildStep key={step.id} stepId={step.id} sentences={step.sentences} onDone={next} />;
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
          onFinish={() => {
            update((d) => ({ ...d, game: advanceStep(d.game, unit.id, step.id, now()) }));
            go({ name: 'lab' });
          }}
          onNextUnit={(id) => {
            update((d) => ({ ...d, game: advanceStep(d.game, unit.id, step.id, now()) }));
            go({ name: 'unit', unitId: id });
          }}
        />
      );
      break;
  }

  return (
    <>
      <TopBar onHome={() => go({ name: 'lab' })} title={unit.titleHe} progress={{ current: idx, total: steps.length }} />
      <Page>
        <div data-testid="unit-screen" data-unit={unit.id} data-step={step.id} data-step-type={step.type} data-level={level}>
          {body}
        </div>
      </Page>
    </>
  );
}
