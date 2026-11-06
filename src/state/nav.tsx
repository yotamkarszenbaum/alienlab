import { createContext, useContext } from 'react';

export type Screen =
  | { name: 'home' }
  | { name: 'intro' }
  | { name: 'lab'; message?: string }
  | { name: 'unit'; unitId: string }
  | { name: 'review'; mode: 'due' | 'practice' }
  | { name: 'brain' }
  | { name: 'parents' };

export interface Nav {
  screen: Screen;
  go: (s: Screen) => void;
}

export const NavCtx = createContext<Nav | null>(null);

export function useNav(): Nav {
  const n = useContext(NavCtx);
  if (!n) throw new Error('useNav outside provider');
  return n;
}

/** Where "back" goes from each screen — always a safe screen, never a half-finished step. */
export function parentOf(s: Screen): Screen | null {
  switch (s.name) {
    case 'home':
      return null;
    case 'intro':
    case 'lab':
    case 'parents':
      return { name: 'home' };
    default:
      return { name: 'lab' };
  }
}
