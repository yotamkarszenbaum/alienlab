import { Component, useEffect, useRef, useState, type ReactNode } from 'react';
import type React from 'react';
import { Alien, type AlienMood } from './Alien';
import { ItemArt } from './ItemArt';
import { IconBulb, IconCheck, IconHome, IconMusic, IconBell, IconSpeaker, IconMute, IconX } from './Icons';
import { speak, speakMixed, useSpeechStatus, type Lang } from '../audio/speech';
import { playSfx } from '../audio/sfx';
import { useGame } from '../state/GameContext';
import type { ChoiceOption } from '../engine/tasks';
import { WORDS_BY_ID } from '../content/words';

// ----------------------------- Rich text ----------------------------------

/** Renders Hebrew text where ENGLISH words appear LTR in the English font. */
export function RichText({ text }: { text: string }) {
  const parts: ReactNode[] = [];
  const re = /[A-Z][A-Z'\- ]*[A-Z]|[A-Z]/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    parts.push(
      <bdi key={i++} className="en" dir="ltr" lang="en">
        {m[0]}
      </bdi>,
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}

// ------------------------------ Buttons -----------------------------------

export function BigButton({
  children,
  onClick,
  variant = 'primary',
  locked = false,
  lockedMessage,
  className = '',
  ariaLabel,
  testId,
}: {
  children: ReactNode;
  onClick: () => void;
  variant?: 'primary' | 'sun' | 'teal' | 'soft';
  locked?: boolean;
  lockedMessage?: string;
  className?: string;
  ariaLabel?: string;
  testId?: string;
}) {
  const [nudge, setNudge] = useState(false);
  const busy = useRef(false);
  return (
    <div className="inline-flex flex-col items-center gap-2">
      <button
        type="button"
        data-testid={testId}
        aria-label={ariaLabel}
        aria-disabled={locked ? 'true' : undefined}
        className={`btn btn-${variant} ${nudge ? 'anim-shake' : ''} ${className}`}
        onClick={() => {
          if (locked) {
            setNudge(true);
            setTimeout(() => setNudge(false), 2600);
            return;
          }
          if (busy.current) return; // ignore rapid double taps
          busy.current = true;
          setTimeout(() => (busy.current = false), 450);
          playSfx('tap');
          onClick();
        }}
      >
        {children}
      </button>
      {locked && nudge && lockedMessage && (
        <p role="status" className="anim-fade text-base font-medium text-ink-soft bg-white/80 rounded-2xl px-3 py-1">
          {lockedMessage}
        </p>
      )}
    </div>
  );
}

export function SpeakButton({
  text,
  lang = 'en',
  sayHe,
  size = 'md',
  label,
  autoPlayKey,
  testId,
}: {
  text: string;
  lang?: Lang;
  sayHe?: string;
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  autoPlayKey?: string | number | null;
  testId?: string;
}) {
  const status = useSpeechStatus(lang);
  const [showFallback, setShowFallback] = useState(false);
  const [playing, setPlaying] = useState(false);
  const px = size === 'lg' ? 68 : size === 'sm' ? 46 : 56;
  const play = async () => {
    setPlaying(true);
    const ok = await speak(text, lang);
    setPlaying(false);
    if (!ok) setShowFallback(true);
  };
  useEffect(() => {
    if (autoPlayKey === undefined || autoPlayKey === null) return;
    const t = setTimeout(() => void play(), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPlayKey]);
  const unavailable = status === 'unavailable';
  return (
    <span className="inline-flex flex-col items-center gap-1">
      <button
        type="button"
        data-testid={testId}
        className={`icon-btn ${playing ? 'ring-4 ring-sun' : ''}`}
        style={{ width: px, height: px, background: unavailable ? '#f1eef9' : '#fff' }}
        aria-label={label ?? `השמעה: ${text}`}
        onClick={() => {
          void play();
          if (unavailable) setShowFallback(true);
        }}
      >
        {unavailable ? <IconMute size={px * 0.5} /> : <IconSpeaker size={px * 0.5} />}
      </button>
      {(showFallback || unavailable) && (
        <span role="status" data-testid="speech-fallback" className="anim-fade text-sm leading-tight text-ink-soft text-center max-w-[12rem]">
          {unavailable || !sayHe ? 'אין קול במכשיר הזה. ' : ''}
          {sayHe && (
            <>
              אומרים: <b className="text-ink text-base">{sayHe}</b>
            </>
          )}
        </span>
      )}
    </span>
  );
}

export function EnglishWord({ text, size = 'xl', className = '' }: { text: string; size?: 'md' | 'lg' | 'xl'; className?: string }) {
  const cls = size === 'xl' ? 'text-[clamp(2.6rem,9vw,4.2rem)]' : size === 'lg' ? 'text-[clamp(2rem,6vw,3rem)]' : 'text-2xl';
  return (
    <bdi dir="ltr" lang="en" className={`en ${cls} text-primary-dark leading-none tracking-wide ${className}`}>
      {text}
    </bdi>
  );
}

// ---------------------------- Alien stage ---------------------------------

export function SpeechBubble({ text, children, testId }: { text?: string; children?: ReactNode; testId?: string }) {
  const { data } = useGame();
  const heStatus = useSpeechStatus('he');
  const canRead = heStatus !== 'unavailable' && !!text;
  return (
    <div className="bubble anim-fade flex-1 min-w-0" data-testid={testId} aria-live="polite">
      {text && <RichText text={text} />}
      {children}
      {canRead && data.settings.readAloudHe && (
        <button
          type="button"
          className="absolute -bottom-4 inset-inline-start-3 icon-btn !min-w-0 !min-h-0 w-11 h-11"
          style={{ insetInlineStart: 12 }}
          aria-label="להקריא שוב"
          onClick={() => void speakMixed(text!)}
        >
          <IconSpeaker size={20} />
        </button>
      )}
    </div>
  );
}

/** Alien + speech bubble. Reads the line aloud in Hebrew when enabled and available. */
export function AlienStage({
  mood,
  text,
  children,
  compact = false,
  autoRead = true,
  testId = 'alien-line',
}: {
  mood: AlienMood;
  text?: string;
  children?: ReactNode;
  compact?: boolean;
  autoRead?: boolean;
  testId?: string;
}) {
  const { data } = useGame();
  const heStatus = useSpeechStatus('he');
  useEffect(() => {
    if (!autoRead || !text || !data.settings.readAloudHe || heStatus === 'unavailable') return;
    const t = setTimeout(() => void speakMixed(text), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, autoRead]);
  return (
    <div className={`flex items-center gap-3 ${compact ? '' : 'sm:gap-5'}`}>
      <div className="shrink-0">
        <Alien mood={mood} size={compact ? 84 : 'clamp(92px, 20vw, 150px)'} />
      </div>
      <SpeechBubble text={text} testId={testId}>
        {children}
      </SpeechBubble>
    </div>
  );
}

// ------------------------------- Options ----------------------------------

export type OptionState = 'idle' | 'correct' | 'wrong' | 'eliminated' | 'highlight' | 'alien' | 'selected';

export function OptionCard({
  option,
  state,
  onClick,
  disabled,
  imgSize = 'clamp(96px, 22vw, 150px)',
  ignoreSize = false,
  caption,
  bare = false,
  style,
}: {
  option: ChoiceOption;
  state: OptionState;
  onClick: () => void;
  disabled?: boolean;
  imgSize?: string | number;
  ignoreSize?: boolean;
  caption?: ReactNode;
  bare?: boolean;
  style?: React.CSSProperties;
}) {
  const cls =
    state === 'correct'
      ? 'is-correct anim-pop'
      : state === 'wrong'
        ? 'is-wrong anim-shake'
        : state === 'eliminated'
          ? 'is-eliminated'
          : state === 'highlight'
            ? 'is-highlight anim-glow'
            : state === 'alien'
              ? 'is-alien anim-pop'
              : state === 'selected'
                ? 'is-selected'
                : '';
  return (
    <button
      type="button"
      className={`option ${bare ? 'bare' : ''} ${cls}`}
      style={style}
      onClick={onClick}
      disabled={disabled || state === 'eliminated'}
      aria-label={option.labelHe + (state === 'correct' ? ' — נכון' : state === 'wrong' ? ' — לא זה' : '')}
      data-testid={`opt-${option.key}`}
      data-correct={option.correct ? 'true' : 'false'}
    >
      {state === 'correct' && (
        <span className="badge-mark bg-good text-white" aria-hidden>
          <IconCheck size={22} />
        </span>
      )}
      {state === 'wrong' && (
        <span className="badge-mark bg-sun text-ink" aria-hidden>
          <IconX size={20} />
        </span>
      )}
      {option.item ? (
        <ItemArt item={option.item} size={imgSize} decorative ignoreSize={ignoreSize} />
      ) : (
        <span className="py-6">
          <EnglishWord text={WORDS_BY_ID[option.wordId!]?.english ?? option.labelHe} size="lg" />
        </span>
      )}
      {caption}
    </button>
  );
}

/** A word option (picture -> word task) with its own listen button next to it. */
export function WordOption({ option, state, onClick, disabled }: { option: ChoiceOption; state: OptionState; onClick: () => void; disabled?: boolean }) {
  const w = WORDS_BY_ID[option.wordId!];
  return (
    <div className="flex flex-col items-stretch gap-2 min-w-0">
      <OptionCard option={option} state={state} onClick={onClick} disabled={disabled} />
      <div className="flex justify-center">
        <SpeakButton text={w.english} sayHe={w.sayItHe} size="sm" label={`השמעה של המילה ${w.english}`} />
      </div>
    </div>
  );
}

// ------------------------------ Help / hints -------------------------------

export function HelpButton({ onClick, level, testId = 'help-btn' }: { onClick: () => void; level: number; testId?: string }) {
  return (
    <button
      type="button"
      data-testid={testId}
      className="btn btn-sun !px-4 !min-h-[52px] !text-lg"
      onClick={() => {
        playSfx('pop');
        onClick();
      }}
      aria-label={level === 0 ? 'עזרה — קבלת רמז' : 'עוד עזרה'}
    >
      <IconBulb size={26} />
      <span>{level === 0 ? 'עזרה' : 'עוד עזרה'}</span>
    </button>
  );
}

export function HintPanel({ children, onLess, level }: { children: ReactNode; onLess?: () => void; level: number }) {
  return (
    <div role="status" className="anim-fade rounded-3xl border-3 border-dashed border-sun-dark bg-[#fff8dc] px-4 py-3 text-lg font-medium flex items-start gap-3" data-testid="hint-panel" data-level={level}>
      <span className="shrink-0 mt-0.5">
        <IconBulb size={28} />
      </span>
      <div className="flex-1">{children}</div>
      {onLess && level > 1 && (
        <button type="button" className="text-sm underline text-ink-soft shrink-0 min-h-[44px] px-2" onClick={onLess}>
          פחות עזרה
        </button>
      )}
    </div>
  );
}

// ------------------------------- Layout ------------------------------------

export function SoundToggles() {
  const { data, setSettings } = useGame();
  return (
    <div className="flex gap-2">
      <button
        type="button"
        className="icon-btn"
        aria-pressed={data.settings.music}
        aria-label={data.settings.music ? 'כיבוי מוזיקת רקע' : 'הפעלת מוזיקת רקע'}
        title="מוזיקת רקע"
        onClick={() => setSettings({ music: !data.settings.music })}
      >
        <IconMusic size={24} />
      </button>
      <button
        type="button"
        className="icon-btn"
        aria-pressed={data.settings.sfx}
        aria-label={data.settings.sfx ? 'כיבוי צלילי משחק' : 'הפעלת צלילי משחק'}
        title="צלילי משחק"
        onClick={() => setSettings({ sfx: !data.settings.sfx })}
      >
        <IconBell size={24} />
      </button>
    </div>
  );
}

export function TopBar({ onHome, title, progress, homeLabel = 'חזרה למעבדה' }: { onHome?: () => void; title?: ReactNode; progress?: { current: number; total: number }; homeLabel?: string }) {
  return (
    <header className="flex items-center gap-3 px-3 sm:px-5 pt-3 pb-2 max-w-5xl mx-auto w-full">
      {onHome && (
        <button type="button" className="icon-btn" onClick={onHome} aria-label={homeLabel} title={homeLabel} data-testid="home-btn">
          <IconHome size={24} />
        </button>
      )}
      <div className="flex-1 min-w-0">
        {title && <div className="font-extrabold text-lg sm:text-xl truncate">{title}</div>}
        {progress && <ProgressDots {...progress} />}
      </div>
      <SoundToggles />
    </header>
  );
}

export function ProgressDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex gap-1.5 mt-1" role="progressbar" aria-valuemin={1} aria-valuemax={total} aria-valuenow={current + 1} aria-label={`שלב ${current + 1} מתוך ${total}`}>
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className="h-2.5 rounded-full transition-all"
          style={{ width: i === current ? 26 : 10, background: i < current ? '#1fb79c' : i === current ? '#7c5cff' : '#d9d1fb' }}
        />
      ))}
    </div>
  );
}

export function Dialog({ open, title, children, onClose }: { open: boolean; title: string; children: ReactNode; onClose?: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (open) ref.current?.querySelector<HTMLElement>('button, input')?.focus();
  }, [open]);
  useEffect(() => {
    if (!open || !onClose) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div ref={ref} className="card anim-pop w-full max-w-md p-6">
        <h2 className="text-2xl font-extrabold mb-3">{title}</h2>
        {children}
      </div>
    </div>
  );
}

export function Page({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <main className={`max-w-5xl mx-auto w-full px-3 sm:px-5 pb-10 ${className}`}>{children}</main>;
}

// ----------------------------- Error boundary ------------------------------

export class ErrorBoundary extends Component<{ children: ReactNode; onReset: () => void; resetKey: string }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(err: unknown) {
    console.error('[AlienLab] screen error', err);
  }
  componentDidUpdate(prev: { resetKey: string }) {
    if (prev.resetKey !== this.props.resetKey && this.state.failed) this.setState({ failed: false });
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <Page className="pt-10">
        <div className="card p-6 flex flex-col items-center gap-4 text-center">
          <Alien mood="confused" size={140} />
          <p className="text-2xl font-bold">אופס! משהו קטן השתבש במעבדה.</p>
          <p className="text-lg">ההתקדמות שלכם שמורה. בואו ננסה שוב.</p>
          <div className="flex gap-3 flex-wrap justify-center">
            <button className="btn btn-primary" onClick={() => this.setState({ failed: false })}>
              לנסות שוב
            </button>
            <button
              className="btn btn-soft"
              onClick={() => {
                this.setState({ failed: false });
                this.props.onReset();
              }}
            >
              חזרה למעבדה
            </button>
          </div>
        </div>
      </Page>
    );
  }
}
