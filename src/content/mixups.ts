import type { MixupRoundDef } from '../engine/types';
import { item, items, placed } from './items';

// ---------------------------------------------------------------------------
// "Kosmo gets confused" (levels 2–3) — sentence templates.
//
// Each round holds the CORRECT sentence and the word Kosmo has to get right
// (focus). What Kosmo actually says there is not written here: it comes from
// what the child has taught him so far (engine/kosmo.ts):
//   - taught, and it fits the picture  -> he says it right (the child confirms)
//   - mixes it up with a look-alike    -> he says the look-alike (the child fixes it)
//   - does not know / not sure / forgot -> he leaves a gap and asks (the child teaches)
// Words come back in later rounds, so the child sees the effect of teaching:
// a corrected mistake is not repeated, and one example can still mislead him
// ("BLUE = car") until a second, different example makes him understand.
//
// Rules (checked by tests/levels.test.ts): the right word fits the picture,
// the other choices and Kosmo's look-alike do not; only words the child
// already knows at that level appear. Concepts that have their own "teach
// Kosmo" step later in the station are not resolved here — that step stays
// meaningful.
// ---------------------------------------------------------------------------

const door = (color: 'brown' | 'blue' | 'green' | 'red', st: 'open' | 'closed') => item('door', color, 'normal', st);
const box = (color: 'blue' | 'red' | 'green', st: 'open' | 'closed') => item('box', color, 'normal', st);
const ARE_TIP = 'כשיש יותר מאחד אומרים THERE ARE, וכשיש אחד אומרים THERE IS.';

/** Opening of "Things on Earth": APPLE BALL CAT DOG (+ CAR HAT at level 3). */
export const EARTH_OPENING: MixupRoundDef[] = [
  { id: 'e2-1', maxLevel: 2, picture: item('dog', 'brown', 'big'), tokens: ['I', 'SEE', 'A', 'BIG', 'DOG'], focusAt: 4, focus: 'dog', choices: ['DOG', 'BALL', 'APPLE'], hebrew: 'אני רואה כלב גדול.', tipHe: 'איזו חיה רואים בתמונה?', wordIds: ['dog'] },
  { id: 'e2-2', maxLevel: 2, picture: item('ball', 'red'), tokens: ['I', 'SEE', 'A', 'RED', 'BALL'], focusAt: 4, focus: 'ball', choices: ['BALL', 'CAT', 'DOG'], hebrew: 'אני רואה כדור אדום.', tipHe: 'מה רואים בתמונה? עם זה משחקים.', wordIds: ['ball'] },
  { id: 'e2-3', maxLevel: 2, picture: item('cat', 'orange'), tokens: ['I', 'SEE', 'A', 'CAT'], focusAt: 3, focus: 'cat', choices: ['CAT', 'BALL', 'APPLE'], hebrew: 'אני רואה חתול.', tipHe: 'איזו חיה רואים בתמונה? היא אומרת "מיאו".', wordIds: ['cat'] },
  { id: 'e2-4', maxLevel: 2, picture: item('apple', 'yellow'), tokens: ['I', 'SEE', 'A', 'YELLOW', 'APPLE'], focusAt: 4, focus: 'apple', choices: ['APPLE', 'CAT', 'DOG'], hebrew: 'אני רואה תפוח צהוב.', tipHe: 'מה רואים בתמונה? את זה אפשר לאכול 🙂', wordIds: ['apple'] },
  { id: 'e2-5', maxLevel: 2, picture: item('dog', 'white'), tokens: ['I', 'HAVE', 'A', 'DOG'], focusAt: 3, focus: 'dog', choices: ['DOG', 'BALL', 'APPLE'], hebrew: 'יש לי כלב.', tipHe: 'איזו חיה רואים בתמונה?', wordIds: ['dog'] },

  { id: 'e3-1', minLevel: 3, picture: item('car', 'green', 'small'), tokens: ['I', 'HAVE', 'A', 'SMALL', 'GREEN', 'CAR'], focusAt: 5, focus: 'car', choices: ['CAR', 'HAT', 'APPLE'], hebrew: 'יש לי מכונית ירוקה קטנה.', tipHe: 'מה רואים בתמונה? בזה נוסעים.', wordIds: ['car'] },
  { id: 'e3-2', minLevel: 3, picture: item('hat', 'blue'), tokens: ['MY', 'HAT', 'IS', 'BLUE'], focusAt: 1, focus: 'hat', choices: ['HAT', 'CAR', 'DOG'], hebrew: 'הכובע שלי כחול.', tipHe: 'מה כחול בתמונה? שמים את זה על הראש.', wordIds: ['hat'] },
  { id: 'e3-3', minLevel: 3, picture: item('cat', 'gray', 'small'), tokens: ['THE', 'CAT', 'IS', 'SMALL'], focusAt: 1, focus: 'cat', choices: ['CAT', 'HAT', 'CAR'], hebrew: 'החתול קטן.', tipHe: 'איזו חיה רואים בתמונה? היא אומרת "מיאו".', wordIds: ['cat'] },
  { id: 'e3-4', minLevel: 3, picture: item('ball', 'yellow', 'big'), tokens: ['THE', 'BALL', 'IS', 'BIG', 'AND', 'YELLOW'], focusAt: 1, focus: 'ball', choices: ['BALL', 'CAR', 'HAT'], hebrew: 'הכדור גדול וצהוב.', tipHe: 'מה רואים בתמונה? עם זה משחקים.', wordIds: ['ball'] },
  { id: 'e3-5', minLevel: 3, picture: item('apple', 'red', 'big'), tokens: ['THIS', 'IS', 'A', 'BIG', 'RED', 'APPLE'], focusAt: 5, focus: 'apple', choices: ['APPLE', 'HAT', 'CAR'], hebrew: 'זה תפוח אדום גדול.', tipHe: 'מה רואים בתמונה? את זה אפשר לאכול 🙂', wordIds: ['apple'] },
  { id: 'e3-6', minLevel: 3, picture: item('dog', 'brown', 'small'), tokens: ['I', 'HAVE', 'A', 'SMALL', 'DOG'], focusAt: 4, focus: 'dog', choices: ['DOG', 'CAR', 'HAT'], hebrew: 'יש לי כלב קטן.', tipHe: 'איזו חיה רואים בתמונה?', wordIds: ['dog'] },
  { id: 'e3-7', minLevel: 3, picture: item('hat', 'green'), tokens: ['I', 'SEE', 'A', 'GREEN', 'HAT'], focusAt: 4, focus: 'hat', choices: ['HAT', 'CAR', 'DOG'], hebrew: 'אני רואה כובע ירוק.', tipHe: 'מה רואים בתמונה? שמים את זה על הראש.', wordIds: ['hat'] },
];

/** Mid-station round with the new words (replaces the simple mixed practice at levels 2–3). */
export const EARTH_REVIEW: MixupRoundDef[] = [
  { id: 'k2-1', maxLevel: 2, picture: item('car', 'red'), tokens: ['I', 'SEE', 'A', 'RED', 'CAR'], focusAt: 4, focus: 'car', choices: ['CAR', 'HAT', 'BALL'], hebrew: 'אני רואה מכונית אדומה.', tipHe: 'מה אדום בתמונה? בזה נוסעים.', wordIds: ['car'] },
  { id: 'k2-2', maxLevel: 2, picture: item('hat', 'blue'), tokens: ['I', 'HAVE', 'A', 'BLUE', 'HAT'], focusAt: 4, focus: 'hat', choices: ['HAT', 'CAR', 'APPLE'], hebrew: 'יש לי כובע כחול.', tipHe: 'מה כחול בתמונה? שמים את זה על הראש.', wordIds: ['hat'] },
  { id: 'k2-3', maxLevel: 2, picture: item('hat', 'yellow', 'big'), tokens: ['I', 'SEE', 'A', 'BIG', 'YELLOW', 'HAT'], focusAt: 5, focus: 'hat', choices: ['HAT', 'CAR', 'APPLE'], hebrew: 'אני רואה כובע צהוב גדול.', tipHe: 'מה רואים בתמונה? שמים את זה על הראש.', wordIds: ['hat'] },
  { id: 'k2-4', maxLevel: 2, picture: item('car', 'blue', 'big'), tokens: ['THE', 'CAR', 'IS', 'BIG', 'AND', 'BLUE'], focusAt: 1, focus: 'car', choices: ['CAR', 'HAT', 'BALL'], hebrew: 'המכונית גדולה וכחולה.', tipHe: 'מה רואים בתמונה? בזה נוסעים.', wordIds: ['car'] },

  { id: 'k3-1', minLevel: 3, picture: item('cup', 'yellow'), tokens: ['MY', 'CUP', 'IS', 'YELLOW'], focusAt: 1, focus: 'cup', choices: ['CUP', 'HAT', 'CAT'], hebrew: 'הכוס שלי צהובה.', tipHe: 'מה צהוב בתמונה? שותים ממנה.', wordIds: ['cup'] },
  { id: 'k3-2', minLevel: 3, picture: item('car', 'red', 'small'), tokens: ['I', 'HAVE', 'A', 'SMALL', 'RED', 'CAR'], focusAt: 5, focus: 'car', choices: ['CAR', 'CUP', 'HAT'], hebrew: 'יש לי מכונית אדומה קטנה.', tipHe: 'מה רואים בתמונה? בזה נוסעים.', wordIds: ['car'] },
  { id: 'k3-3', minLevel: 3, picture: item('cup', 'green', 'big'), tokens: ['I', 'SEE', 'A', 'BIG', 'GREEN', 'CUP'], focusAt: 5, focus: 'cup', choices: ['CUP', 'HAT', 'BALL'], hebrew: 'אני רואה כוס ירוקה גדולה.', tipHe: 'מה רואים בתמונה? שותים ממנה.', wordIds: ['cup'] },
];

/** Opening of "Colors and sizes": RED BLUE YELLOW BIG (+ GREEN SMALL at level 3). */
export const COLORS_OPENING: MixupRoundDef[] = [
  { id: 'c2-1', maxLevel: 2, picture: item('car', 'blue'), tokens: ['I', 'SEE', 'A', 'BLUE', 'CAR'], focusAt: 3, focus: 'blue', choices: ['BLUE', 'YELLOW', 'BIG'], hebrew: 'אני רואה מכונית כחולה.', tipHe: 'באיזה צבע המכונית?', wordIds: ['blue'] },
  { id: 'c2-2', maxLevel: 2, picture: item('ball', 'red'), tokens: ['I', 'SEE', 'A', 'RED', 'BALL'], focusAt: 3, focus: 'red', choices: ['RED', 'YELLOW', 'BIG'], hebrew: 'אני רואה כדור אדום.', tipHe: 'באיזה צבע הכדור?', wordIds: ['red'] },
  { id: 'c2-3', maxLevel: 2, picture: item('car', 'blue', 'big'), tokens: ['THE', 'BLUE', 'CAR', 'IS', 'BIG'], focusAt: 1, focus: 'blue', choices: ['BLUE', 'YELLOW'], hebrew: 'המכונית הכחולה גדולה.', tipHe: 'באיזה צבע המכונית?', wordIds: ['blue'] },
  { id: 'c2-4', maxLevel: 2, picture: item('ball', 'yellow', 'big'), tokens: ['I', 'SEE', 'A', 'BIG', 'YELLOW', 'BALL'], focusAt: 4, focus: 'yellow', choices: ['YELLOW', 'RED', 'BLUE'], hebrew: 'אני רואה כדור צהוב גדול.', tipHe: 'באיזה צבע הכדור?', wordIds: ['yellow'] },
  { id: 'c2-5', maxLevel: 2, picture: item('hat', 'blue'), tokens: ['MY', 'HAT', 'IS', 'BLUE'], focusAt: 3, focus: 'blue', choices: ['BLUE', 'YELLOW', 'BIG'], hebrew: 'הכובע שלי כחול.', tipHe: 'באיזה צבע הכובע?', wordIds: ['blue'] },
  { id: 'c2-6', maxLevel: 2, picture: item('dog', 'brown', 'big'), tokens: ['I', 'SEE', 'A', 'BIG', 'DOG'], focusAt: 3, focus: 'big', choices: ['BIG', 'RED', 'BLUE'], hebrew: 'אני רואה כלב גדול.', tipHe: 'הכלב גדול או קטן?', wordIds: ['big'] },

  { id: 'c3-1', minLevel: 3, picture: item('car', 'green', 'small'), tokens: ['THE', 'SMALL', 'CAR', 'IS', 'GREEN'], focusAt: 4, focus: 'green', choices: ['GREEN', 'RED', 'BLUE'], hebrew: 'המכונית הקטנה ירוקה.', tipHe: 'באיזה צבע המכונית?', wordIds: ['green'] },
  { id: 'c3-2', minLevel: 3, picture: item('ball', 'yellow', 'small'), tokens: ['I', 'HAVE', 'A', 'SMALL', 'YELLOW', 'BALL'], focusAt: 3, focus: 'small', choices: ['SMALL', 'GREEN', 'RED'], hebrew: 'יש לי כדור צהוב קטן.', tipHe: 'הכדור גדול או קטן?', wordIds: ['small'] },
  { id: 'c3-3', minLevel: 3, picture: item('cup', 'blue', 'big'), tokens: ['MY', 'BIG', 'CUP', 'IS', 'BLUE'], focusAt: 4, focus: 'blue', choices: ['BLUE', 'GREEN', 'YELLOW'], hebrew: 'הכוס הגדולה שלי כחולה.', tipHe: 'באיזה צבע הכוס?', wordIds: ['blue'] },
  { id: 'c3-4', minLevel: 3, picture: item('apple', 'red', 'big'), tokens: ['THE', 'APPLE', 'IS', 'BIG', 'AND', 'RED'], focusAt: 5, focus: 'red', choices: ['RED', 'GREEN', 'SMALL'], hebrew: 'התפוח גדול ואדום.', tipHe: 'באיזה צבע התפוח?', wordIds: ['red'] },
  { id: 'c3-5', minLevel: 3, picture: item('ball', 'red', 'small'), tokens: ['THE', 'SMALL', 'BALL', 'IS', 'RED'], focusAt: 1, focus: 'small', choices: ['SMALL', 'GREEN', 'YELLOW'], hebrew: 'הכדור הקטן אדום.', tipHe: 'הכדור גדול או קטן?', wordIds: ['small'] },
  { id: 'c3-6', minLevel: 3, picture: item('star', 'yellow', 'big'), tokens: ['THE', 'STAR', 'IS', 'BIG', 'AND', 'YELLOW'], focusAt: 5, focus: 'yellow', choices: ['YELLOW', 'RED', 'GREEN'], hebrew: 'הכוכב גדול וצהוב.', tipHe: 'באיזה צבע הכוכב?', wordIds: ['yellow'] },
  { id: 'c3-7', minLevel: 3, picture: item('dog', 'brown', 'big'), tokens: ['I', 'SEE', 'A', 'BIG', 'DOG'], focusAt: 3, focus: 'big', choices: ['BIG', 'GREEN', 'RED'], hebrew: 'אני רואה כלב גדול.', tipHe: 'הכלב גדול או קטן?', wordIds: ['big'] },
];

export const COLORS_REVIEW: MixupRoundDef[] = [
  { id: 'k2-1', maxLevel: 2, picture: item('ball', 'green', 'small'), tokens: ['I', 'SEE', 'A', 'SMALL', 'GREEN', 'BALL'], focusAt: 4, focus: 'green', choices: ['GREEN', 'RED', 'BLUE'], hebrew: 'אני רואה כדור ירוק קטן.', tipHe: 'באיזה צבע הכדור?', wordIds: ['green'] },
  { id: 'k2-2', maxLevel: 2, picture: item('hat', 'blue', 'small'), tokens: ['I', 'SEE', 'A', 'SMALL', 'BLUE', 'HAT'], focusAt: 3, focus: 'small', choices: ['SMALL', 'GREEN', 'RED'], hebrew: 'אני רואה כובע כחול קטן.', tipHe: 'הכובע גדול או קטן?', wordIds: ['small'] },
  { id: 'k2-3', maxLevel: 2, picture: item('ball', 'green', 'big'), tokens: ['THE', 'BIG', 'BALL', 'IS', 'GREEN'], focusAt: 4, focus: 'green', choices: ['GREEN', 'RED', 'BLUE'], hebrew: 'הכדור הגדול ירוק.', tipHe: 'באיזה צבע הכדור?', wordIds: ['green'] },
  { id: 'k2-4', maxLevel: 2, picture: item('apple', 'yellow', 'small'), tokens: ['I', 'SEE', 'A', 'SMALL', 'YELLOW', 'APPLE'], focusAt: 3, focus: 'small', choices: ['SMALL', 'GREEN', 'RED'], hebrew: 'אני רואה תפוח צהוב קטן.', tipHe: 'התפוח גדול או קטן?', wordIds: ['small'] },

  { id: 'k3-1', minLevel: 3, picture: items(3, 'ball', 'red'), tokens: ['I', 'SEE', 'THREE', 'RED', 'BALLS'], focusAt: 2, focus: 'three', choices: ['THREE', 'SMALL', 'GREEN'], hebrew: 'אני רואה שלושה כדורים אדומים.', tipHe: 'ספרו את הכדורים.', wordIds: ['three'] },
  { id: 'k3-2', minLevel: 3, picture: items(2, 'dog', 'brown', { size: 'big' }), tokens: ['I', 'SEE', 'TWO', 'BIG', 'DOGS'], focusAt: 2, focus: 'two', choices: ['TWO', 'SMALL', 'RED'], hebrew: 'אני רואה שני כלבים גדולים.', tipHe: 'ספרו את הכלבים.', wordIds: ['two'] },
  { id: 'k3-3', minLevel: 3, picture: items(3, 'cat', 'gray'), tokens: ['THERE', 'ARE', 'THREE', 'CATS'], focusAt: 1, focus: 'are', choices: ['ARE', 'AM'], hebrew: 'יש שלושה חתולים.', tipHe: ARE_TIP, wordIds: [] },
  { id: 'k3-4', minLevel: 3, picture: items(2, 'cat', 'gray', { size: 'small' }), tokens: ['THERE', 'ARE', 'TWO', 'SMALL', 'CATS'], focusAt: 2, focus: 'two', choices: ['TWO', 'GREEN', 'RED'], hebrew: 'יש שני חתולים קטנים.', tipHe: 'ספרו את החתולים.', wordIds: ['two'] },
  { id: 'k3-5', minLevel: 3, picture: items(3, 'star', 'yellow'), tokens: ['THERE', 'ARE', 'THREE', 'YELLOW', 'STARS'], focusAt: 1, focus: 'are', choices: ['ARE', 'AM'], hebrew: 'יש שלושה כוכבים צהובים.', tipHe: ARE_TIP, wordIds: [] },
];

/** Opening of "The lab opens": KEY DOOR OPEN CLOSE (+ BOX STAR at level 3). */
export const LAB_OPENING: MixupRoundDef[] = [
  { id: 'l2-1', maxLevel: 2, picture: item('key', 'yellow'), tokens: ['I', 'HAVE', 'A', 'YELLOW', 'KEY'], focusAt: 4, focus: 'key', choices: ['KEY', 'CAT', 'BALL'], hebrew: 'יש לי מפתח צהוב.', tipHe: 'מה רואים בתמונה? בעזרתו פותחים דלת.', wordIds: ['key'] },
  { id: 'l2-2', maxLevel: 2, picture: door('green', 'closed'), tokens: ['I', 'SEE', 'A', 'GREEN', 'DOOR'], focusAt: 4, focus: 'door', choices: ['DOOR', 'CAR', 'HAT'], hebrew: 'אני רואה דלת ירוקה.', tipHe: 'מה רואים בתמונה? דרכה נכנסים לחדר.', wordIds: ['door'] },
  { id: 'l2-3', maxLevel: 2, pictureFrom: door('brown', 'closed'), picture: door('brown', 'open'), tokens: ['I', 'OPEN', 'THE', 'DOOR'], focusAt: 1, focus: 'open', choices: ['OPEN', 'KEY'], hebrew: 'אני פותח את הדלת.', tipHe: 'הסתכלו על החץ: הדלת נפתחת או נסגרת?', wordIds: ['open'] },
  { id: 'l2-4', maxLevel: 2, pictureFrom: door('blue', 'open'), picture: door('blue', 'closed'), tokens: ['I', 'CLOSE', 'THE', 'DOOR'], focusAt: 1, focus: 'close', choices: ['CLOSE', 'KEY'], hebrew: 'אני סוגר את הדלת.', tipHe: 'הסתכלו על החץ: הדלת נפתחת או נסגרת?', wordIds: ['close'] },
  { id: 'l2-5', maxLevel: 2, pictureFrom: door('red', 'closed'), picture: door('red', 'open'), tokens: ['I', 'OPEN', 'THE', 'RED', 'DOOR'], focusAt: 1, focus: 'open', choices: ['OPEN', 'KEY'], hebrew: 'אני פותח את הדלת האדומה.', tipHe: 'הסתכלו על החץ: הדלת נפתחת או נסגרת?', wordIds: ['open'] },

  { id: 'l3-1', minLevel: 3, pictureFrom: box('red', 'closed'), picture: box('red', 'open'), tokens: ['I', 'OPEN', 'THE', 'BOX'], focusAt: 1, focus: 'open', choices: ['OPEN', 'KEY', 'STAR'], hebrew: 'אני פותח את הקופסה.', tipHe: 'הסתכלו על החץ: הקופסה נפתחת או נסגרת?', wordIds: ['open'] },
  { id: 'l3-2', minLevel: 3, picture: items(2, 'key', 'yellow'), tokens: ['I', 'HAVE', 'TWO', 'YELLOW', 'KEYS'], focusAt: 4, focus: 'key', choices: ['KEYS', 'BOXES', 'CUPS'], hebrew: 'יש לי שני מפתחות צהובים.', tipHe: 'מה רואים בתמונה? בעזרתם פותחים דלתות.', wordIds: ['key'] },
  { id: 'l3-3', minLevel: 3, picture: items(3, 'star', 'yellow'), tokens: ['THERE', 'ARE', 'THREE', 'YELLOW', 'STARS'], focusAt: 4, focus: 'star', choices: ['STARS', 'KEYS', 'BOXES'], hebrew: 'יש שלושה כוכבים צהובים.', tipHe: 'מה רואים בתמונה? בחלל יש המון כאלה.', wordIds: ['star'] },
  { id: 'l3-4', minLevel: 3, pictureFrom: door('green', 'open'), picture: door('green', 'closed'), tokens: ['I', 'CLOSE', 'THE', 'GREEN', 'DOOR'], focusAt: 1, focus: 'close', choices: ['CLOSE', 'STAR'], hebrew: 'אני סוגר את הדלת הירוקה.', tipHe: 'הסתכלו על החץ: הדלת נפתחת או נסגרת?', wordIds: ['close'] },
  { id: 'l3-5', minLevel: 3, picture: door('blue', 'open'), tokens: ['THE', 'DOOR', 'IS', 'OPEN'], focusAt: 1, focus: 'door', choices: ['DOOR', 'BOX', 'CUP'], hebrew: 'הדלת פתוחה.', tipHe: 'מה רואים בתמונה? דרכה נכנסים לחדר.', wordIds: ['door'] },
  { id: 'l3-6', minLevel: 3, picture: box('blue', 'closed'), tokens: ['I', 'SEE', 'A', 'BLUE', 'BOX'], focusAt: 4, focus: 'box', choices: ['BOX', 'STAR', 'KEY'], hebrew: 'אני רואה קופסה כחולה.', tipHe: 'מה רואים בתמונה? אפשר לשים בה דברים.', wordIds: ['box'] },
  { id: 'l3-7', minLevel: 3, pictureFrom: box('blue', 'closed'), picture: box('blue', 'open'), tokens: ['I', 'OPEN', 'THE', 'BLUE', 'BOX'], focusAt: 1, focus: 'open', choices: ['OPEN', 'KEY', 'STAR'], hebrew: 'אני פותח את הקופסה הכחולה.', tipHe: 'הסתכלו על החץ: הקופסה נפתחת או נסגרת?', wordIds: ['open'] },
];

export const LAB_REVIEW: MixupRoundDef[] = [
  { id: 'k2-1', maxLevel: 2, pictureFrom: box('blue', 'closed'), picture: box('blue', 'open'), tokens: ['I', 'OPEN', 'THE', 'BOX'], focusAt: 3, focus: 'box', choices: ['BOX', 'KEY', 'STAR'], hebrew: 'אני פותח את הקופסה.', tipHe: 'מה נפתח בתמונה? אפשר לשים בה דברים.', wordIds: ['box'] },
  { id: 'k2-2', maxLevel: 2, picture: item('star', 'yellow', 'big'), tokens: ['I', 'SEE', 'A', 'BIG', 'YELLOW', 'STAR'], focusAt: 5, focus: 'star', choices: ['STAR', 'KEY', 'BOX'], hebrew: 'אני רואה כוכב צהוב גדול.', tipHe: 'מה רואים בתמונה? בחלל יש המון כאלה.', wordIds: ['star'] },
  { id: 'k2-3', maxLevel: 2, pictureFrom: box('red', 'open'), picture: box('red', 'closed'), tokens: ['I', 'CLOSE', 'THE', 'BOX'], focusAt: 3, focus: 'box', choices: ['BOX', 'KEY', 'STAR'], hebrew: 'אני סוגר את הקופסה.', tipHe: 'מה נסגר בתמונה?', wordIds: ['box'] },
  { id: 'k2-4', maxLevel: 2, picture: item('star', 'blue'), tokens: ['I', 'HAVE', 'A', 'BLUE', 'STAR'], focusAt: 4, focus: 'star', choices: ['STAR', 'KEY', 'DOOR'], hebrew: 'יש לי כוכב כחול.', tipHe: 'מה רואים בתמונה? בחלל יש המון כאלה.', wordIds: ['star'] },

  { id: 'k3-1', minLevel: 3, picture: placed('ball', 'red', 'under'), tokens: ['THE', 'BALL', 'IS', 'UNDER', 'THE', 'TABLE'], focusAt: 3, focus: 'under', choices: ['UNDER', 'IN'], hebrew: 'הכדור מתחת לשולחן.', tipHe: 'הכדור למעלה על השולחן, או למטה?', wordIds: ['under'] },
  { id: 'k3-2', minLevel: 3, picture: placed('cat', 'gray', 'on'), tokens: ['THE', 'CAT', 'IS', 'ON', 'THE', 'TABLE'], focusAt: 3, focus: 'on', choices: ['ON', 'IN'], hebrew: 'החתול על השולחן.', tipHe: 'החתול למעלה על השולחן, או למטה?', wordIds: ['on'] },
  { id: 'k3-3', minLevel: 3, picture: placed('key', 'yellow', 'in'), tokens: ['THE', 'KEY', 'IS', 'IN', 'THE', 'BOX'], focusAt: 3, focus: 'in', choices: ['IN', 'UNDER'], hebrew: 'המפתח בתוך הקופסה.', tipHe: 'המפתח בפנים או בחוץ?', wordIds: ['in'] },
  { id: 'k3-4', minLevel: 3, picture: placed('ball', 'blue', 'under'), tokens: ['THE', 'BLUE', 'BALL', 'IS', 'UNDER', 'THE', 'TABLE'], focusAt: 4, focus: 'under', choices: ['UNDER', 'IN'], hebrew: 'הכדור הכחול מתחת לשולחן.', tipHe: 'הכדור למעלה על השולחן, או למטה?', wordIds: ['under'] },
  { id: 'k3-5', minLevel: 3, picture: placed('ball', 'green', 'on', 'box'), tokens: ['THE', 'BALL', 'IS', 'ON', 'THE', 'BOX'], focusAt: 3, focus: 'on', choices: ['ON', 'IN'], hebrew: 'הכדור על הקופסה.', tipHe: 'הכדור על הקופסה, או בתוכה?', wordIds: ['on'] },
  { id: 'k3-6', minLevel: 3, picture: items(2, 'cup', 'blue', { rel: { pos: 'on', ref: 'table' } }), tokens: ['THERE', 'ARE', 'TWO', 'CUPS', 'ON', 'THE', 'TABLE'], focusAt: 1, focus: 'are', choices: ['ARE', 'AM'], hebrew: 'יש שתי כוסות על השולחן.', tipHe: ARE_TIP, wordIds: [] },
];
