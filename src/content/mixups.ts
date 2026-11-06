import type { MixupRoundDef } from '../engine/types';
import { item, items, placed } from './items';

// ---------------------------------------------------------------------------
// "Kosmo gets confused" (levels 2–3). Kosmo looks at a picture and says what he
// sees in English. Sometimes one word is wrong: the child judges, finds the
// wrong word and fixes it. Some rounds are right, so the child must really
// check every word.
//
// Rules (checked by tests/levels.test.ts):
// - every game word Kosmo says fits the picture, except the wrong word;
// - the fix fits the picture, every other choice does not;
// - only words the child already knows at that level (basic words from lower
//   levels, or words taught earlier) appear.
// Level 2: short descriptions ("I SEE A RED BALL").
// Level 3: full sentences — IS / ARE, numbers and plurals, IN / ON / UNDER.
// ---------------------------------------------------------------------------

const door = (color: 'brown' | 'blue' | 'green' | 'red', st: 'open' | 'closed') => item('door', color, 'normal', st);
const box = (color: 'blue' | 'red', st: 'open' | 'closed') => item('box', color, 'normal', st);

/** Opening of "Things on Earth": the basic words APPLE BALL CAT DOG (+ CAR HAT at level 3). */
export const EARTH_OPENING: MixupRoundDef[] = [
  // level 2
  { id: 'e2-1', maxLevel: 2, picture: item('dog', 'brown', 'big'), tokens: ['I', 'SEE', 'A', 'BIG', 'BALL'], wrongAt: 4, fix: 'DOG', choices: ['DOG', 'CAT', 'APPLE'], hebrew: 'אני רואה כלב גדול.', tipHe: 'איזו חיה רואים בתמונה?', wordIds: ['dog', 'ball'] },
  { id: 'e2-2', maxLevel: 2, picture: item('ball', 'red'), tokens: ['I', 'SEE', 'A', 'RED', 'BALL'], hebrew: 'אני רואה כדור אדום.', tipHe: 'מה רואים בתמונה, ובאיזה צבע?', wordIds: ['ball'] },
  { id: 'e2-3', maxLevel: 2, picture: item('apple', 'yellow'), tokens: ['I', 'SEE', 'A', 'YELLOW', 'BALL'], wrongAt: 4, fix: 'APPLE', choices: ['APPLE', 'CAT', 'DOG'], hebrew: 'אני רואה תפוח צהוב.', tipHe: 'מה רואים בתמונה? את זה אפשר לאכול 🙂', wordIds: ['apple', 'ball'] },
  { id: 'e2-4', maxLevel: 2, picture: item('cat', 'orange'), tokens: ['I', 'SEE', 'A', 'DOG'], wrongAt: 3, fix: 'CAT', choices: ['CAT', 'BALL', 'APPLE'], hebrew: 'אני רואה חתול.', tipHe: 'איזו חיה רואים בתמונה? היא אומרת "מיאו".', wordIds: ['cat', 'dog'] },
  // level 3
  { id: 'e3-1', minLevel: 3, picture: item('car', 'green', 'small'), tokens: ['I', 'HAVE', 'A', 'SMALL', 'GREEN', 'HAT'], wrongAt: 5, fix: 'CAR', choices: ['CAR', 'CAT', 'APPLE'], hebrew: 'יש לי מכונית ירוקה קטנה.', tipHe: 'מה רואים בתמונה? בזה נוסעים.', wordIds: ['car', 'hat'] },
  { id: 'e3-2', minLevel: 3, picture: item('ball', 'yellow', 'big'), tokens: ['THE', 'BALL', 'IS', 'BIG', 'AND', 'YELLOW'], hebrew: 'הכדור גדול וצהוב.', tipHe: 'בדקו מה רואים, את הגודל ואת הצבע.', wordIds: ['ball'] },
  { id: 'e3-3', minLevel: 3, picture: item('hat', 'blue'), tokens: ['MY', 'CAT', 'IS', 'BLUE'], wrongAt: 1, fix: 'HAT', choices: ['HAT', 'CAR', 'DOG'], hebrew: 'הכובע שלי כחול.', tipHe: 'מה כחול בתמונה? שמים את זה על הראש.', wordIds: ['hat', 'cat'] },
  { id: 'e3-4', minLevel: 3, picture: item('apple', 'red', 'big'), tokens: ['THIS', 'IS', 'A', 'BIG', 'RED', 'BALL'], wrongAt: 5, fix: 'APPLE', choices: ['APPLE', 'HAT', 'CAR'], hebrew: 'זה תפוח אדום גדול.', tipHe: 'מה רואים בתמונה? את זה אפשר לאכול 🙂', wordIds: ['apple', 'ball'] },
  { id: 'e3-5', minLevel: 3, picture: item('dog', 'brown', 'small'), tokens: ['I', 'HAVE', 'A', 'SMALL', 'DOG'], hebrew: 'יש לי כלב קטן.', tipHe: 'איזו חיה בתמונה, והיא גדולה או קטנה?', wordIds: ['dog'] },
];

/** Mid-station review with the new words (replaces the simple mixed practice at levels 2–3). */
export const EARTH_REVIEW: MixupRoundDef[] = [
  { id: 'k2-1', maxLevel: 2, picture: item('car', 'red'), tokens: ['I', 'SEE', 'A', 'RED', 'HAT'], wrongAt: 4, fix: 'CAR', choices: ['CAR', 'CAT', 'BALL'], hebrew: 'אני רואה מכונית אדומה.', tipHe: 'מה אדום בתמונה? בזה נוסעים.', wordIds: ['car', 'hat'] },
  { id: 'k2-2', maxLevel: 2, picture: item('hat', 'blue'), tokens: ['I', 'HAVE', 'A', 'BLUE', 'HAT'], hebrew: 'יש לי כובע כחול.', tipHe: 'מה רואים בתמונה, ובאיזה צבע?', wordIds: ['hat'] },
  { id: 'k2-3', maxLevel: 2, picture: item('hat', 'yellow', 'big'), tokens: ['I', 'SEE', 'A', 'BIG', 'YELLOW', 'CAT'], wrongAt: 5, fix: 'HAT', choices: ['HAT', 'CAR', 'APPLE'], hebrew: 'אני רואה כובע צהוב גדול.', tipHe: 'CAT ו-HAT נשמעות דומות! מה רואים בתמונה?', wordIds: ['hat', 'cat'] },
  { id: 'k2-4', maxLevel: 2, picture: item('ball', 'blue'), tokens: ['I', 'SEE', 'A', 'BLUE', 'CAR'], wrongAt: 4, fix: 'BALL', choices: ['BALL', 'HAT', 'DOG'], hebrew: 'אני רואה כדור כחול.', tipHe: 'מה כחול בתמונה? עם זה משחקים.', wordIds: ['ball', 'car'] },
  { id: 'k3-1', minLevel: 3, picture: item('cup', 'yellow'), tokens: ['MY', 'CAT', 'IS', 'YELLOW'], wrongAt: 1, fix: 'CUP', choices: ['CUP', 'CAR', 'HAT'], hebrew: 'הכוס שלי צהובה.', tipHe: 'CAT ו-CUP מתחילות באותה אות. מה רואים בתמונה?', wordIds: ['cup', 'cat'] },
  { id: 'k3-2', minLevel: 3, picture: item('car', 'red', 'small'), tokens: ['I', 'HAVE', 'A', 'SMALL', 'RED', 'CAR'], hebrew: 'יש לי מכונית אדומה קטנה.', tipHe: 'בדקו מה רואים, את הגודל ואת הצבע.', wordIds: ['car'] },
  { id: 'k3-3', minLevel: 3, picture: item('hat', 'green', 'big'), tokens: ['I', 'SEE', 'A', 'BIG', 'GREEN', 'CUP'], wrongAt: 5, fix: 'HAT', choices: ['HAT', 'BALL', 'DOG'], hebrew: 'אני רואה כובע ירוק גדול.', tipHe: 'מה ירוק בתמונה? שמים את זה על הראש.', wordIds: ['hat', 'cup'] },
  { id: 'k3-4', minLevel: 3, picture: item('cup', 'blue'), tokens: ['THIS', 'IS', 'A', 'BLUE', 'CUP'], hebrew: 'זו כוס כחולה.', tipHe: 'מה רואים בתמונה, ובאיזה צבע?', wordIds: ['cup'] },
];

/** Opening of "Colors and sizes": RED BLUE YELLOW BIG (+ GREEN SMALL at level 3). */
export const COLORS_OPENING: MixupRoundDef[] = [
  { id: 'c2-1', maxLevel: 2, picture: item('car', 'blue'), tokens: ['I', 'SEE', 'A', 'RED', 'CAR'], wrongAt: 3, fix: 'BLUE', choices: ['BLUE', 'YELLOW'], hebrew: 'אני רואה מכונית כחולה.', tipHe: 'באיזה צבע המכונית?', wordIds: ['red', 'blue'] },
  { id: 'c2-2', maxLevel: 2, picture: item('ball', 'yellow', 'big'), tokens: ['I', 'SEE', 'A', 'BIG', 'YELLOW', 'BALL'], hebrew: 'אני רואה כדור צהוב גדול.', tipHe: 'בדקו את הגודל ואת הצבע.', wordIds: ['big', 'yellow'] },
  { id: 'c2-3', maxLevel: 2, picture: item('ball', 'red', 'big'), tokens: ['I', 'SEE', 'A', 'BIG', 'BLUE', 'BALL'], wrongAt: 4, fix: 'RED', choices: ['RED', 'YELLOW'], hebrew: 'אני רואה כדור אדום גדול.', tipHe: 'באיזה צבע הכדור?', wordIds: ['red', 'blue', 'big'] },
  { id: 'c2-4', maxLevel: 2, picture: item('hat', 'yellow'), tokens: ['I', 'HAVE', 'A', 'RED', 'HAT'], wrongAt: 3, fix: 'YELLOW', choices: ['YELLOW', 'BLUE'], hebrew: 'יש לי כובע צהוב.', tipHe: 'באיזה צבע הכובע?', wordIds: ['yellow', 'red'] },
  { id: 'c3-1', minLevel: 3, picture: item('car', 'green', 'small'), tokens: ['THE', 'SMALL', 'CAR', 'IS', 'YELLOW'], wrongAt: 4, fix: 'GREEN', choices: ['GREEN', 'RED', 'BLUE'], hebrew: 'המכונית הקטנה ירוקה.', tipHe: 'באיזה צבע המכונית?', wordIds: ['small', 'yellow', 'green'] },
  { id: 'c3-2', minLevel: 3, picture: item('cup', 'blue', 'big'), tokens: ['MY', 'BIG', 'CUP', 'IS', 'BLUE'], hebrew: 'הכוס הגדולה שלי כחולה.', tipHe: 'בדקו את הגודל ואת הצבע.', wordIds: ['big', 'blue'] },
  { id: 'c3-3', minLevel: 3, picture: item('ball', 'yellow', 'small'), tokens: ['I', 'HAVE', 'A', 'BIG', 'YELLOW', 'BALL'], wrongAt: 3, fix: 'SMALL', choices: ['SMALL', 'GREEN', 'RED'], hebrew: 'יש לי כדור צהוב קטן.', tipHe: 'הכדור גדול או קטן?', wordIds: ['big', 'small', 'yellow'] },
  { id: 'c3-4', minLevel: 3, picture: item('apple', 'red', 'big'), tokens: ['THE', 'APPLE', 'IS', 'BIG', 'AND', 'GREEN'], wrongAt: 5, fix: 'RED', choices: ['RED', 'BLUE', 'SMALL'], hebrew: 'התפוח גדול ואדום.', tipHe: 'באיזה צבע התפוח?', wordIds: ['big', 'green', 'red'] },
];

export const COLORS_REVIEW: MixupRoundDef[] = [
  { id: 'k2-1', maxLevel: 2, picture: item('ball', 'green', 'small'), tokens: ['I', 'SEE', 'A', 'SMALL', 'RED', 'BALL'], wrongAt: 4, fix: 'GREEN', choices: ['GREEN', 'YELLOW', 'BLUE'], hebrew: 'אני רואה כדור ירוק קטן.', tipHe: 'באיזה צבע הכדור?', wordIds: ['small', 'red', 'green'] },
  { id: 'k2-2', maxLevel: 2, picture: item('car', 'green', 'big'), tokens: ['I', 'HAVE', 'A', 'BIG', 'GREEN', 'CAR'], hebrew: 'יש לי מכונית ירוקה גדולה.', tipHe: 'בדקו את הגודל ואת הצבע.', wordIds: ['big', 'green'] },
  { id: 'k2-3', maxLevel: 2, picture: item('hat', 'blue', 'small'), tokens: ['I', 'SEE', 'A', 'BIG', 'BLUE', 'HAT'], wrongAt: 3, fix: 'SMALL', choices: ['SMALL', 'GREEN', 'RED'], hebrew: 'אני רואה כובע כחול קטן.', tipHe: 'הכובע גדול או קטן?', wordIds: ['big', 'small', 'blue'] },
  { id: 'k2-4', maxLevel: 2, picture: item('apple', 'yellow', 'small'), tokens: ['I', 'SEE', 'A', 'SMALL', 'YELLOW', 'APPLE'], hebrew: 'אני רואה תפוח צהוב קטן.', tipHe: 'בדקו את הגודל ואת הצבע.', wordIds: ['small', 'yellow'] },
  { id: 'k3-1', minLevel: 3, picture: items(3, 'ball', 'red'), tokens: ['I', 'SEE', 'TWO', 'RED', 'BALLS'], wrongAt: 2, fix: 'THREE', choices: ['THREE', 'SMALL', 'GREEN'], hebrew: 'אני רואה שלושה כדורים אדומים.', tipHe: 'ספרו את הכדורים.', wordIds: ['two', 'three', 'red'] },
  { id: 'k3-2', minLevel: 3, picture: items(2, 'cat', 'gray', { size: 'small' }), tokens: ['THERE', 'ARE', 'TWO', 'SMALL', 'CATS'], hebrew: 'יש שני חתולים קטנים.', tipHe: 'ספרו, ובדקו את הגודל.', wordIds: ['two', 'small'] },
  { id: 'k3-3', minLevel: 3, picture: items(3, 'star', 'yellow'), tokens: ['THERE', 'ARE', 'THREE', 'GREEN', 'STARS'], wrongAt: 3, fix: 'YELLOW', choices: ['YELLOW', 'RED', 'BLUE'], hebrew: 'יש שלושה כוכבים צהובים.', tipHe: 'באיזה צבע הכוכבים?', wordIds: ['three', 'green', 'yellow'] },
  { id: 'k3-4', minLevel: 3, picture: items(2, 'dog', 'brown', { size: 'big' }), tokens: ['I', 'SEE', 'THREE', 'BIG', 'DOGS'], wrongAt: 2, fix: 'TWO', choices: ['TWO', 'SMALL', 'RED'], hebrew: 'אני רואה שני כלבים גדולים.', tipHe: 'ספרו את הכלבים.', wordIds: ['three', 'two', 'big'] },
  { id: 'k3-5', minLevel: 3, picture: items(3, 'cat', 'gray'), tokens: ['THERE', 'IS', 'THREE', 'CATS'], wrongAt: 1, fix: 'ARE', choices: ['ARE', 'AM'], hebrew: 'יש שלושה חתולים.', tipHe: 'כשיש יותר מאחד אומרים THERE ARE, וכשיש אחד אומרים THERE IS.', wordIds: ['three'] },
];

/** Opening of "The lab opens": KEY DOOR OPEN CLOSE (+ BOX STAR at level 3). */
export const LAB_OPENING: MixupRoundDef[] = [
  { id: 'l2-1', maxLevel: 2, pictureFrom: door('brown', 'closed'), picture: door('brown', 'open'), tokens: ['I', 'OPEN', 'THE', 'DOOR'], hebrew: 'אני פותח את הדלת.', tipHe: 'הסתכלו על החץ: הדלת נפתחת או נסגרת?', wordIds: ['open', 'door'] },
  { id: 'l2-2', maxLevel: 2, picture: item('key', 'yellow'), tokens: ['I', 'HAVE', 'A', 'YELLOW', 'DOOR'], wrongAt: 4, fix: 'KEY', choices: ['KEY', 'CAT', 'BALL'], hebrew: 'יש לי מפתח צהוב.', tipHe: 'מה רואים בתמונה? בעזרתו פותחים דלת.', wordIds: ['key', 'door'] },
  { id: 'l2-3', maxLevel: 2, pictureFrom: door('blue', 'open'), picture: door('blue', 'closed'), tokens: ['I', 'OPEN', 'THE', 'DOOR'], wrongAt: 1, fix: 'CLOSE', choices: ['CLOSE', 'KEY'], hebrew: 'אני סוגר את הדלת.', tipHe: 'הסתכלו על החץ: הדלת נפתחת או נסגרת?', wordIds: ['open', 'close', 'door'] },
  { id: 'l2-4', maxLevel: 2, picture: door('green', 'closed'), tokens: ['I', 'SEE', 'A', 'GREEN', 'KEY'], wrongAt: 4, fix: 'DOOR', choices: ['DOOR', 'CAR', 'HAT'], hebrew: 'אני רואה דלת ירוקה.', tipHe: 'מה ירוק בתמונה? דרכו נכנסים לחדר.', wordIds: ['key', 'door'] },
  { id: 'l3-1', minLevel: 3, pictureFrom: box('red', 'closed'), picture: box('red', 'open'), tokens: ['I', 'CLOSE', 'THE', 'BOX'], wrongAt: 1, fix: 'OPEN', choices: ['OPEN', 'KEY', 'STAR'], hebrew: 'אני פותח את הקופסה.', tipHe: 'הסתכלו על החץ: הקופסה נפתחת או נסגרת?', wordIds: ['close', 'open', 'box'] },
  { id: 'l3-2', minLevel: 3, picture: items(2, 'key', 'yellow'), tokens: ['I', 'HAVE', 'TWO', 'YELLOW', 'STARS'], wrongAt: 4, fix: 'KEYS', choices: ['KEYS', 'BOXES', 'CUPS'], hebrew: 'יש לי שני מפתחות צהובים.', tipHe: 'מה רואים בתמונה? בעזרתם פותחים דלתות.', wordIds: ['star', 'key'] },
  { id: 'l3-3', minLevel: 3, picture: items(3, 'star', 'yellow'), tokens: ['THERE', 'ARE', 'THREE', 'YELLOW', 'STARS'], hebrew: 'יש שלושה כוכבים צהובים.', tipHe: 'ספרו, ובדקו מה רואים ובאיזה צבע.', wordIds: ['star'] },
  { id: 'l3-4', minLevel: 3, pictureFrom: door('green', 'open'), picture: door('green', 'closed'), tokens: ['I', 'CLOSE', 'THE', 'GREEN', 'BOX'], wrongAt: 4, fix: 'DOOR', choices: ['DOOR', 'CUP', 'CAR'], hebrew: 'אני סוגר את הדלת הירוקה.', tipHe: 'מה נסגר בתמונה?', wordIds: ['box', 'door', 'close'] },
];

export const LAB_REVIEW: MixupRoundDef[] = [
  { id: 'k2-1', maxLevel: 2, pictureFrom: box('blue', 'closed'), picture: box('blue', 'open'), tokens: ['I', 'OPEN', 'THE', 'DOOR'], wrongAt: 3, fix: 'BOX', choices: ['BOX', 'KEY', 'STAR'], hebrew: 'אני פותח את הקופסה.', tipHe: 'מה נפתח בתמונה?', wordIds: ['door', 'box', 'open'] },
  { id: 'k2-2', maxLevel: 2, picture: item('star', 'yellow', 'big'), tokens: ['I', 'SEE', 'A', 'BIG', 'YELLOW', 'STAR'], hebrew: 'אני רואה כוכב צהוב גדול.', tipHe: 'בדקו מה רואים, את הגודל ואת הצבע.', wordIds: ['star'] },
  { id: 'k2-3', maxLevel: 2, pictureFrom: box('red', 'open'), picture: box('red', 'closed'), tokens: ['I', 'OPEN', 'THE', 'BOX'], wrongAt: 1, fix: 'CLOSE', choices: ['CLOSE', 'STAR'], hebrew: 'אני סוגר את הקופסה.', tipHe: 'הסתכלו על החץ: הקופסה נפתחת או נסגרת?', wordIds: ['open', 'close', 'box'] },
  { id: 'k2-4', maxLevel: 2, picture: item('key', 'blue'), tokens: ['I', 'HAVE', 'A', 'BLUE', 'STAR'], wrongAt: 4, fix: 'KEY', choices: ['KEY', 'BOX', 'DOOR'], hebrew: 'יש לי מפתח כחול.', tipHe: 'מה רואים בתמונה? בעזרתו פותחים דלת.', wordIds: ['star', 'key'] },
  { id: 'k3-1', minLevel: 3, picture: placed('ball', 'red', 'under'), tokens: ['THE', 'BALL', 'IS', 'ON', 'THE', 'TABLE'], wrongAt: 3, fix: 'UNDER', choices: ['UNDER', 'IN'], hebrew: 'הכדור מתחת לשולחן.', tipHe: 'הכדור למעלה על השולחן, או למטה?', wordIds: ['on', 'under', 'table'] },
  { id: 'k3-2', minLevel: 3, picture: placed('key', 'yellow', 'in'), tokens: ['THE', 'KEY', 'IS', 'IN', 'THE', 'BOX'], hebrew: 'המפתח בתוך הקופסה.', tipHe: 'איפה המפתח?', wordIds: ['key', 'in', 'box'] },
  { id: 'k3-3', minLevel: 3, picture: placed('cat', 'gray', 'on'), tokens: ['THE', 'CAT', 'IS', 'UNDER', 'THE', 'TABLE'], wrongAt: 3, fix: 'ON', choices: ['ON', 'IN'], hebrew: 'החתול על השולחן.', tipHe: 'החתול למעלה על השולחן, או למטה?', wordIds: ['under', 'on', 'table'] },
  { id: 'k3-4', minLevel: 3, picture: items(2, 'star', 'yellow', { rel: { pos: 'in', ref: 'box' } }), tokens: ['THERE', 'ARE', 'TWO', 'STARS', 'ON', 'THE', 'BOX'], wrongAt: 4, fix: 'IN', choices: ['IN', 'UNDER'], hebrew: 'יש שני כוכבים בתוך הקופסה.', tipHe: 'הכוכבים על הקופסה, או בתוכה?', wordIds: ['on', 'in', 'star', 'box'] },
  { id: 'k3-5', minLevel: 3, picture: items(2, 'cup', 'blue', { rel: { pos: 'on', ref: 'table' } }), tokens: ['THERE', 'IS', 'TWO', 'CUPS', 'ON', 'THE', 'TABLE'], wrongAt: 1, fix: 'ARE', choices: ['ARE', 'AM'], hebrew: 'יש שתי כוסות על השולחן.', tipHe: 'כשיש יותר מאחד אומרים THERE ARE, וכשיש אחד אומרים THERE IS.', wordIds: ['on', 'table'] },
];
