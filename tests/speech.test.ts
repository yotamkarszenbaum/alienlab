import { describe, expect, it } from 'vitest';
import { speakableText, splitMixed } from '../src/audio/speech';

describe('Kosmo never reads emojis or symbols aloud', () => {
  it('drops emojis but keeps the sentence natural (a short pause where an emoji separated phrases)', () => {
    expect(speakableText('נכון! הפעם צדקתי 😄 כל המילים מתאימות לתמונה.')).toBe('נכון! הפעם צדקתי, כל המילים מתאימות לתמונה.');
    expect(speakableText('בעצם התבלבלתי! 😅 איזו מילה לא נכונה?')).toBe('בעצם התבלבלתי! איזו מילה לא נכונה?');
    expect(speakableText('אני מסתכל על התמונה. אבל לפעמים אני מתבלבל! 🤪 אני צודק?')).toBe('אני מסתכל על התמונה. אבל לפעמים אני מתבלבל! אני צודק?');
    expect(speakableText('🧠 קוסמו מבקש תזכורת')).toBe('קוסמו מבקש תזכורת');
    expect(speakableText('יש! עשיתי את זה לבד 🎉')).toBe('יש! עשיתי את זה לבד');
  });

  it('drops arrows, scissors, check marks, joined emojis and keycaps', () => {
    expect(speakableText('RED: ✂️ תפוח ← 💡 הצבע האדום')).not.toMatch(/[✂←💡]/u);
    expect(speakableText('מתבלבל 😵‍💫 עם DOG')).toBe('מתבלבל, עם DOG');
    expect(speakableText('✓ לימדתם אותי')).toBe('לימדתם אותי');
    expect(speakableText('למה טעיתי? 🔍 תהיו בלשים')).toBe('למה טעיתי? תהיו בלשים');
    expect(speakableText('2️⃣ דברים')).toBe('2 דברים');
    expect(speakableText('👉 צדקתי?')).toBe('צדקתי?');
  });

  it('leaves normal text and English words untouched', () => {
    const t = 'ברום ברום! מה זה? זאת מכונית. באנגלית קוראים לה CAR.';
    expect(speakableText(t)).toBe(t);
    expect(splitMixed(speakableText('BALL? את זה עוד לא לימדו אותי 🤔 אבל זה נשמע לי כמו APPLE...')).map((p) => p.lang)).toEqual(['en', 'he', 'en']);
    expect(speakableText('🤪')).toBe('');
  });
});

describe('every line in the game is clean for the voice', () => {
  it('no string in the source keeps an emoji or symbol after filtering', () => {
    const sources = import.meta.glob('../src/**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
    const files = Object.values(sources);
    const strings = files.flatMap((f) => f.match(/(['`])(?:(?!\1)[^\\\n]|\\.)*\1/g) ?? []).filter((s) => /[֐-׿]/.test(s) && /\p{Extended_Pictographic}/u.test(s));
    expect(strings.length).toBeGreaterThan(20);
    for (const s of strings) expect(speakableText(s), s).not.toMatch(/[\p{Extended_Pictographic}←-⇿✀-➿]/u);
  });
});
