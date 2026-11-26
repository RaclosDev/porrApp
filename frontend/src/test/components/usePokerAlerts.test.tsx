import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const play = vi.fn();
let stored = false;
vi.mock('../../components/poker/pokerSound', () => ({
  playPokerSound: (kind: string) => play(kind),
  soundEnabled: () => stored,
  storeSoundEnabled: vi.fn(),
  unlockAudio: vi.fn(),
}));

import { POKER_ALERT_MS, usePokerAlerts } from '../../components/poker/usePokerAlerts';

const ana = (rebuys: number, addOns: number) => ({ playerId: 7, name: 'Ana', rebuys, addOns });

type Props = {
  level: number;
  onBreak: boolean;
  remainingMs: number;
  entries?: { playerId: number; name: string; rebuys: number; addOns: number }[];
  tv?: boolean;
};

describe('usePokerAlerts', () => {
  beforeEach(() => {
    play.mockClear();
    stored = false;
  });

  const render = (initial: Props) =>
    renderHook((props: Props) => usePokerAlerts({ running: true, tv: true, ...props }), {
      initialProps: initial,
    });

  it('no suena al montar y suena al subir de nivel', () => {
    const { rerender } = render({ level: 0, onBreak: false, remainingMs: 600_000 });
    expect(play).not.toHaveBeenCalled();
    rerender({ level: 1, onBreak: false, remainingMs: 600_000 });
    expect(play).toHaveBeenCalledWith('level');
  });

  it('fuera de la pantalla completa el crupier avisa sin sonar, con el sonido apagado de serie', () => {
    const base = { level: 0, onBreak: false, remainingMs: 600_000, tv: false };
    const { result, rerender } = render({ ...base, entries: [ana(0, 0)] });
    rerender({ ...base, entries: [ana(1, 0)] });
    expect(play).not.toHaveBeenCalled();
    expect(result.current.alert).toMatchObject({ kind: 'rebuy', name: 'Ana' });
    expect(result.current.soundOn).toBe(false);
  });

  it('fuera de la pantalla completa suena si se activó el sonido y la mesa está a la vista', () => {
    stored = true;
    const base = { level: 0, onBreak: false, remainingMs: 600_000, tv: false };
    const { rerender } = render({ ...base, entries: [ana(0, 0)] });
    rerender({ ...base, entries: [ana(1, 0)] });
    expect(play).toHaveBeenCalledWith('rebuy');
  });

  it('no suena con la pestaña en segundo plano', () => {
    stored = true;
    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    const { rerender } = render({ level: 0, onBreak: false, remainingMs: 600_000, tv: false });
    rerender({ level: 1, onBreak: false, remainingMs: 600_000, tv: false });
    expect(play).not.toHaveBeenCalled();
    visibility.mockRestore();
  });

  it('usa otro sonido al empezar un descanso', () => {
    const { rerender } = render({ level: 1, onBreak: false, remainingMs: 600_000 });
    rerender({ level: 2, onBreak: true, remainingMs: 600_000 });
    expect(play).toHaveBeenCalledWith('break');
  });

  it('avisa una sola vez en el último minuto', () => {
    const { rerender } = render({ level: 0, onBreak: false, remainingMs: 120_000 });
    rerender({ level: 0, onBreak: false, remainingMs: 59_000 });
    rerender({ level: 0, onBreak: false, remainingMs: 30_000 });
    expect(play.mock.calls.filter(([kind]) => kind === 'warning')).toHaveLength(1);
  });

  it('el interruptor silencia los avisos', () => {
    stored = true;
    const { result, rerender } = render({
      level: 0,
      onBreak: false,
      remainingMs: 600_000,
      tv: false,
    });
    act(() => result.current.toggleSound());
    play.mockClear();
    rerender({ level: 1, onBreak: false, remainingMs: 600_000, tv: false });
    expect(play).not.toHaveBeenCalled();
  });

  it('suenan los disparos con cada recompra y el dinero con cada add-on, de uno en uno', () => {
    vi.useFakeTimers();
    const base = { level: 0, onBreak: false, remainingMs: 600_000 };
    const { result, rerender } = render({ ...base, entries: [ana(2, 0)] });
    expect(play).not.toHaveBeenCalled();
    rerender({ ...base, entries: [ana(3, 1)] });
    expect(play).toHaveBeenLastCalledWith('rebuy');
    expect(result.current.alert).toMatchObject({ kind: 'rebuy', playerId: 7, name: 'Ana' });
    act(() => vi.advanceTimersByTime(POKER_ALERT_MS));
    expect(play).toHaveBeenLastCalledWith('addOn');
    expect(result.current.alert).toMatchObject({ kind: 'addOn', name: 'Ana' });
    act(() => vi.advanceTimersByTime(POKER_ALERT_MS));
    expect(result.current.alert).toBeNull();
    play.mockClear();
    rerender({ ...base, entries: [ana(2, 1)] });
    expect(play).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('muestra el cartel del cambio de nivel', () => {
    const { result, rerender } = render({ level: 0, onBreak: false, remainingMs: 600_000 });
    rerender({ level: 1, onBreak: false, remainingMs: 600_000 });
    expect(result.current.alert).toMatchObject({ kind: 'level' });
    expect(result.current.alert?.playerId).toBeUndefined();
  });
});
