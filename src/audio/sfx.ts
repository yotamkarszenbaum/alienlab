// Interface sounds and soft background music, synthesised with Web Audio
// (no audio files). Music and interface sounds are muted independently of
// word pronunciation.
type Sfx = 'tap' | 'correct' | 'tryAgain' | 'unlock' | 'think' | 'pop' | 'teach';

let ctx: AudioContext | null = null;
let sfxOn = true;
let musicOn = false;
let musicTimer: number | null = null;

function ac(): AudioContext | null {
  try {
    if (!ctx) {
      const C = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!C) return null;
      ctx = new C();
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = 'triangle', vol = 0.12) {
  const c = ac();
  if (!c) return;
  const t = c.currentTime + start;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(c.destination);
  o.start(t);
  o.stop(t + dur + 0.05);
}

export function playSfx(name: Sfx) {
  if (!sfxOn) return;
  switch (name) {
    case 'tap':
      tone(660, 0, 0.08, 'sine', 0.06);
      break;
    case 'pop':
      tone(520, 0, 0.06, 'sine', 0.07);
      tone(780, 0.05, 0.08, 'sine', 0.06);
      break;
    case 'correct':
      tone(523, 0, 0.16);
      tone(659, 0.1, 0.16);
      tone(784, 0.2, 0.3);
      break;
    case 'tryAgain':
      tone(392, 0, 0.18, 'sine', 0.08);
      tone(349, 0.16, 0.24, 'sine', 0.07);
      break;
    case 'unlock':
      [523, 659, 784, 1046].forEach((f, i) => tone(f, i * 0.09, 0.25, 'triangle', 0.1));
      break;
    case 'think':
      tone(440, 0, 0.1, 'sine', 0.05);
      tone(494, 0.15, 0.1, 'sine', 0.05);
      tone(440, 0.3, 0.1, 'sine', 0.05);
      break;
    case 'teach':
      tone(587, 0, 0.12, 'triangle', 0.08);
      tone(880, 0.09, 0.18, 'triangle', 0.08);
      break;
  }
}

const MELODY = [523, 659, 784, 659, 587, 698, 880, 698, 523, 659, 784, 1046, 880, 784, 659, 587];
let step = 0;

function musicTick() {
  if (!musicOn) return;
  if (document.hidden) return;
  const f = MELODY[step % MELODY.length];
  tone(f / 2, 0, 0.5, 'sine', 0.025);
  if (step % 4 === 0) tone(f / 4, 0, 1.2, 'sine', 0.02);
  step++;
}

export function setSfxEnabled(on: boolean) {
  sfxOn = on;
}

export function setMusicEnabled(on: boolean) {
  musicOn = on;
  if (on && musicTimer === null) {
    ac();
    musicTimer = window.setInterval(musicTick, 480);
  } else if (!on && musicTimer !== null) {
    window.clearInterval(musicTimer);
    musicTimer = null;
  }
}
