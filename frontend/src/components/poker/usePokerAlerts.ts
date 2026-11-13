import { useEffect, useRef, useState } from 'react';
import { playPokerSound, soundEnabled, storeSoundEnabled, unlockAudio } from './pokerSound';

interface Options {
  /** El reloj corre y la mesa está a la vista: mantiene la pantalla encendida. */
  running: boolean;
  level: number | null;
  /** Nivel actual de descanso (sin ciegas). */
  onBreak: boolean;
  remainingMs: number | null;
}

const WARNING_MS = 60_000;

/** Sonidos de cambio de nivel y aviso previo, y bloqueo de apagado de pantalla mientras corre el reloj. */
export function usePokerAlerts({ running, level, onBreak, remainingMs }: Options) {
  const [enabled, setEnabled] = useState(soundEnabled);
  const enabledRef = useRef(enabled);
  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);
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
    if (previous !== null && previous !== level && enabledRef.current) {
      playPokerSound(onBreak ? 'break' : 'level');
    }
  }, [level, onBreak]);

  useEffect(() => {
    if (level === null || remainingMs === null || !running || onBreak) return;
    if (remainingMs > 0 && remainingMs <= WARNING_MS && warnedLevel.current !== level) {
      warnedLevel.current = level;
      if (enabledRef.current) playPokerSound('warning');
    }
  }, [level, remainingMs, running, onBreak]);

  function toggle() {
    unlockAudio();
    const next = !enabled;
    setEnabled(next);
    storeSoundEnabled(next);
    if (next) playPokerSound('warning');
  }

  return { soundOn: enabled, toggleSound: toggle };
}
