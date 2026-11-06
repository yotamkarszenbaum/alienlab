// Central clock. The parents area has a clearly-labelled developer tool that
// can shift time forward to test delayed reviews; everything reads time here.
let offsetMs = 0;

export function setTimeOffset(ms: number) {
  offsetMs = Number.isFinite(ms) ? ms : 0;
}

export function now(): number {
  return Date.now() + offsetMs;
}
