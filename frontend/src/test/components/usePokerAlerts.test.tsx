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

type Props = { level: number; onBreak: boolean; remainingMs: number };

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
});
