import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { SaveData, Settings } from '../engine/types';
import { clearSave, loadSave, newSave, writeSave, type LoadStatus } from '../engine/storage';
import { now, setTimeOffset } from '../engine/clock';
import { setMusicEnabled, setSfxEnabled } from '../audio/sfx';

interface GameCtx {
  data: SaveData;
  update: (fn: (d: SaveData) => SaveData) => void;
  loadStatus: LoadStatus;
  canSave: boolean;
  saveFailed: boolean;
  resetAll: () => void;
  setSettings: (patch: Partial<Settings>) => void;
}

const Ctx = createContext<GameCtx | null>(null);

export function GameProvider({ children }: { children: ReactNode }) {
  const initial = useMemo(() => {
    const r = loadSave(Date.now());
    setTimeOffset(r.data.settings.devTimeOffsetMs);
    return r;
  }, []);
  const [data, setData] = useState<SaveData>(initial.data);
  const [saveFailed, setSaveFailed] = useState(false);
  const first = useRef(true);

  useEffect(() => {
    setTimeOffset(data.settings.devTimeOffsetMs);
    setSfxEnabled(data.settings.sfx);
    setMusicEnabled(data.settings.music);
    document.documentElement.classList.toggle('reduce-motion', data.settings.reducedMotion);
  }, [data.settings]);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (!initial.canSave) return;
    setSaveFailed(!writeSave(data));
  }, [data, initial.canSave]);

  const update = useCallback((fn: (d: SaveData) => SaveData) => setData((d) => fn(d)), []);

  const resetAll = useCallback(() => {
    clearSave();
    setTimeOffset(0);
    const fresh = newSave(Date.now());
    setData(fresh);
  }, []);

  const setSettings = useCallback((patch: Partial<Settings>) => setData((d) => ({ ...d, settings: { ...d.settings, ...patch } })), []);

  const value = useMemo(
    () => ({ data, update, loadStatus: initial.status, canSave: initial.canSave, saveFailed, resetAll, setSettings }),
    [data, update, initial.status, initial.canSave, saveFailed, resetAll, setSettings],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useGame(): GameCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useGame outside provider');
  return c;
}

export { now };
