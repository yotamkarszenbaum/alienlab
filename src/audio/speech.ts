// ---------------------------------------------------------------------------
// Pronunciation through the browser's Web Speech API.
// We never assume a voice exists: availability is detected per language and
// the UI falls back to a written Hebrew transliteration when audio fails.
// ---------------------------------------------------------------------------
import { useEffect, useState } from 'react';

export type Lang = 'en' | 'he';
export type SpeechStatus = 'unknown' | 'ok' | 'unavailable';

const status: Record<Lang, SpeechStatus> = { en: 'unknown', he: 'unknown' };
const listeners = new Set<() => void>();
let voices: SpeechSynthesisVoice[] = [];
let voicesLoaded = false;

function synth(): SpeechSynthesis | null {
  try {
    return typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;
  } catch {
    return null;
  }
}

function emit() {
  listeners.forEach((l) => l());
}

function setStatus(lang: Lang, s: SpeechStatus) {
  if (status[lang] !== s) {
    status[lang] = s;
    emit();
  }
}

const LANG_PREFIX: Record<Lang, string[]> = { en: ['en'], he: ['he', 'iw'] };
const PREFERRED: Record<Lang, RegExp> = {
  en: /(Samantha|Google US English|Aria|Jenny|Ava|Allison|Zira|Karen|Moira|Daniel|en-US)/i,
  he: /(Carmit|Asaf|Hila|Google|he-IL)/i,
};

function voicesFor(lang: Lang) {
  return voices.filter((v) => LANG_PREFIX[lang].some((p) => v.lang?.toLowerCase().startsWith(p)));
}

function pickVoice(lang: Lang): SpeechSynthesisVoice | null {
  const vs = voicesFor(lang);
  if (!vs.length) return null;
  return vs.find((v) => PREFERRED[lang].test(v.name) && v.localService) ?? vs.find((v) => PREFERRED[lang].test(v.name)) ?? vs[0];
}

function refreshVoices() {
  const s = synth();
  if (!s) return;
  voices = s.getVoices();
  if (voices.length) {
    voicesLoaded = true;
    (['en', 'he'] as Lang[]).forEach((l) => {
      if (!voicesFor(l).length) setStatus(l, 'unavailable');
      else if (status[l] === 'unavailable') setStatus(l, 'unknown');
    });
  }
}

export function initSpeech() {
  const s = synth();
  if (!s) {
    setStatus('en', 'unavailable');
    setStatus('he', 'unavailable');
    return;
  }
  refreshVoices();
  try {
    s.addEventListener?.('voiceschanged', refreshVoices);
  } catch {
    /* old browsers */
  }
  // Some browsers never report voices; we then learn availability from the first real attempt.
  setTimeout(refreshVoices, 1200);
}

export function getSpeechStatus(lang: Lang): SpeechStatus {
  return status[lang];
}

export function useSpeechStatus(lang: Lang): SpeechStatus {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((x) => x + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return status[lang];
}

let speakToken = 0;

function speakOne(text: string, lang: Lang, rate: number, token: number): Promise<boolean> {
  const s = synth();
  if (!s) return Promise.resolve(false);
  if (voicesLoaded && !voicesFor(lang).length) {
    setStatus(lang, 'unavailable');
    return Promise.resolve(false);
  }
  return new Promise((resolve) => {
    let started = false;
    let done = false;
    const finish = (ok: boolean) => {
      if (done) return;
      done = true;
      resolve(ok);
    };
    try {
      const u = new SpeechSynthesisUtterance(text);
      const v = pickVoice(lang);
      if (v) u.voice = v;
      u.lang = v?.lang ?? (lang === 'en' ? 'en-US' : 'he-IL');
      u.rate = rate;
      u.pitch = lang === 'en' ? 1.05 : 1.1;
      u.onstart = () => {
        started = true;
        setStatus(lang, 'ok');
      };
      u.onend = () => {
        if (!started) {
          started = true;
          setStatus(lang, 'ok');
        }
        finish(true);
      };
      u.onerror = (e) => {
        // "interrupted"/"canceled" happen when the child taps again — not a failure.
        const err = (e as SpeechSynthesisErrorEvent).error;
        if (err === 'interrupted' || err === 'canceled') return finish(started);
        setStatus(lang, 'unavailable');
        finish(false);
      };
      s.speak(u);
      setTimeout(() => {
        if (!started && !done && token === speakToken) {
          if (status[lang] !== 'ok') setStatus(lang, 'unavailable');
          finish(false);
        }
      }, 2500);
    } catch {
      setStatus(lang, 'unavailable');
      finish(false);
    }
  });
}

/** Speak a single text. Cancels anything already playing (avoids queues on repeated taps). */
export async function speak(text: string, lang: Lang, rate?: number): Promise<boolean> {
  const s = synth();
  if (!s) {
    setStatus(lang, 'unavailable');
    return false;
  }
  const token = ++speakToken;
  try {
    s.cancel();
  } catch {
    /* ignore */
  }
  await new Promise((r) => setTimeout(r, 40));
  if (token !== speakToken) return false;
  return speakOne(text, lang, rate ?? (lang === 'en' ? 0.82 : 1), token);
}

/** Split "זה תפוח. באנגלית קוראים לו APPLE." into Hebrew and English parts. */
export function splitMixed(text: string): { text: string; lang: Lang }[] {
  const out: { text: string; lang: Lang }[] = [];
  const re = /[A-Z][A-Z'\- ]*[A-Z]|[A-Z]/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push({ text: text.slice(last, m.index), lang: 'he' });
    out.push({ text: m[0], lang: 'en' });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last), lang: 'he' });
  return out.filter((p) => p.text.replace(/[\s.,!?:\-—…"'()]/g, '').length > 0);
}

/** Read a Hebrew sentence aloud, switching to the English voice for English words. */
export async function speakMixed(text: string): Promise<boolean> {
  if (status.he === 'unavailable') return false;
  const s = synth();
  if (!s) return false;
  const token = ++speakToken;
  try {
    s.cancel();
  } catch {
    /* ignore */
  }
  await new Promise((r) => setTimeout(r, 40));
  let any = false;
  for (const part of splitMixed(text)) {
    if (token !== speakToken) return any;
    if (status[part.lang] === 'unavailable') continue;
    const ok = await speakOne(part.text, part.lang, part.lang === 'en' ? 0.82 : 1, token);
    any = any || ok;
    if (!ok && part.lang === 'he') return any;
  }
  return any;
}

export function stopSpeech() {
  speakToken++;
  try {
    synth()?.cancel();
  } catch {
    /* ignore */
  }
}
