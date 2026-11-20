import { useCallback, useEffect, useRef, useState } from 'react';
import {
  playPokerSound,
  soundEnabled,
  storeSoundEnabled,
  unlockAudio,
  type PokerSoundKind,
} from './pokerSound';

interface EntryCount {
  playerId: number;
  name: string;
  rebuys: number;
  addOns: number;
}

/** Cartel que la TV muestra en el centro mientras suena un aviso. */
export interface PokerAlert {
  id: number;
  kind: PokerSoundKind;
  playerId?: number;
  name?: string;
}

/** Tiempo que el cartel se queda en la TV. */
export const POKER_ALERT_MS = 5000;

interface Options {
  /** El reloj corre y la mesa está a la vista: mantiene la pantalla encendida. */
  running: boolean;
  level: number | null;
  /** Nivel actual de descanso (sin ciegas). */
  onBreak: boolean;
  remainingMs: number | null;
  /** Recompras y add-ons de cada jugador: suena un aviso, con su nombre, cada vez que sube alguno. */
  entries?: EntryCount[];
  /** Solo suena en la pantalla que hace de TV, no en el móvil de cada jugador. */
  tv?: boolean;
}

const WARNING_MS = 60_000;

/** En el modo TV, sonidos de cambio de nivel, aviso previo, recompras y add-ons, y bloqueo de apagado de pantalla mientras corre el reloj. */
export function usePokerAlerts({
  running,
  level,
  onBreak,
  remainingMs,
  entries = [],
  tv = false,
}: Options) {
  const [enabled, setEnabled] = useState(soundEnabled);
  const enabledRef = useRef(enabled && tv);
  const tvRef = useRef(tv);
  useEffect(() => {
    enabledRef.current = enabled && tv;
    tvRef.current = tv;
  }, [enabled, tv]);
  const [alerts, setAlerts] = useState<PokerAlert[]>([]);
  const nextId = useRef(0);

  /** En la TV: cartel en el centro y, con el sonido activado, el aviso. */
  const announce = useCallback((kind: PokerSoundKind, who?: { playerId: number; name: string }) => {
    if (!tvRef.current) return;
    nextId.current += 1;
    const item: PokerAlert = { id: nextId.current, kind, ...who };
    setAlerts((queue) => [...queue, item]);
  }, []);
  const alert = alerts[0] ?? null;

  // Los carteles salen de uno en uno; cada uno suena al aparecer.
  useEffect(() => {
    if (!alert) return;
    if (enabledRef.current) playPokerSound(alert.kind);
    const timer = window.setTimeout(
      () => setAlerts((queue) => queue.filter((item) => item.id !== alert.id)),
      POKER_ALERT_MS,
    );
    return () => window.clearTimeout(timer);
  }, [alert]);

  // Al cerrar la TV se descartan los carteles pendientes.
  useEffect(() => {
    if (!tv) setAlerts([]);
  }, [tv]);
  const lastLevel = useRef<number | null>(null);
  const warnedLevel = useRef<number | null>(null);

  useEffect(() => {
    const unlock = () => unlockAudio();
    window.addEventListener('pointerdown', unlock, { once: true });
    return () => window.removeEventListener('pointerdown', unlock);
  }, []);

  useEffect(() => {
    if (!running || !('wakeLock' in navigator)) return;
    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;
    const request = async () => {
      try {
        const lock = await navigator.wakeLock.request('screen');
        if (cancelled) void lock.release();
        else sentinel = lock;
      } catch {
        // Sin permiso (ahorro de batería, pestaña oculta): el reloj sigue funcionando igual.
      }
    };
    // El navegador libera el bloqueo al ocultar la pestaña: se pide otra vez al volver.
    const onVisible = () => {
      if (document.visibilityState === 'visible') void request();
    };
    void request();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      void sentinel?.release();
    };
  }, [running]);

  useEffect(() => {
    if (level === null) return;
    const previous = lastLevel.current;
    lastLevel.current = level;
    if (previous !== null && previous !== level) announce(onBreak ? 'break' : 'level');
  }, [level, onBreak, announce]);

  useEffect(() => {
    if (level === null || remainingMs === null || !running || onBreak) return;
    if (remainingMs > 0 && remainingMs <= WARNING_MS && warnedLevel.current !== level) {
      warnedLevel.current = level;
      announce('warning');
    }
  }, [level, remainingMs, running, onBreak, announce]);

  // Solo cuenta lo que sube respecto a la última consulta: al abrir la mesa no suena nada.
  const lastCounts = useRef<Map<number, EntryCount> | null>(null);
  useEffect(() => {
    const previous = lastCounts.current;
    lastCounts.current = new Map(entries.map((entry) => [entry.playerId, entry]));
    if (!previous) return;
    for (const entry of entries) {
      const before = previous.get(entry.playerId);
      if (!before) continue;
      const who = { playerId: entry.playerId, name: entry.name };
      for (let i = before.rebuys; i < entry.rebuys; i++) announce('rebuy', who);
      for (let i = before.addOns; i < entry.addOns; i++) announce('addOn', who);
    }
  }, [entries, announce]);

  function toggle() {
    unlockAudio();
    const next = !enabled;
    setEnabled(next);
    storeSoundEnabled(next);
    if (next) playPokerSound('warning');
  }

  return { soundOn: enabled, toggleSound: toggle, alert };
}
