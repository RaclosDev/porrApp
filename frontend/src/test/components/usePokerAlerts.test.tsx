import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const play = vi.fn();
vi.mock('../../components/poker/pokerSound', () => ({
  playPokerSound: (kind: string) => play(kind),
  soundEnabled: () => true,
  storeSoundEnabled: vi.fn(),
  unlockAudio: vi.fn(),
}));

import { usePokerAlerts } from '../../components/poker/usePokerAlerts';

type Props = {
  level: number;
  onBreak: boolean;
  remainingMs: number;
  rebuys?: number;
  addOns?: number;
};

describe('usePokerAlerts', () => {
  beforeEach(() => play.mockClear());

  const render = (initial: Props) =>
    renderHook((props: Props) => usePokerAlerts({ running: true, ...props }), {
      initialProps: initial,
    });

  it('no suena al montar y suena al subir de nivel', () => {
    const { rerender } = render({ level: 0, onBreak: false, remainingMs: 600_000 });
    expect(play).not.toHaveBeenCalled();
    rerender({ level: 1, onBreak: false, remainingMs: 600_000 });
    expect(play).toHaveBeenCalledWith('level');
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
    const { result, rerender } = render({ level: 0, onBreak: false, remainingMs: 600_000 });
    act(() => result.current.toggleSound());
    play.mockClear();
    rerender({ level: 1, onBreak: false, remainingMs: 600_000 });
    expect(play).not.toHaveBeenCalled();
  });

  it('suenan los disparos con cada recompra y el dinero con cada add-on', () => {
    const base = { level: 0, onBreak: false, remainingMs: 600_000 };
    const { rerender } = render({ ...base, rebuys: 2, addOns: 0 });
    expect(play).not.toHaveBeenCalled();
    rerender({ ...base, rebuys: 3, addOns: 0 });
    expect(play).toHaveBeenLastCalledWith('rebuy');
    rerender({ ...base, rebuys: 3, addOns: 1 });
    expect(play).toHaveBeenLastCalledWith('addOn');
    play.mockClear();
    rerender({ ...base, rebuys: 2, addOns: 1 });
    expect(play).not.toHaveBeenCalled();
  });
});
