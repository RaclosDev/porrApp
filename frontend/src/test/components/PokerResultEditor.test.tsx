import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import PokerResultEditor from '../../components/poker/PokerResultEditor';
import { defaultSettings } from '../../components/poker/pokerFormat';
import type { PokerSession } from '../../services/endpoints/poker';

const session = (finalChips: number | null) =>
  ({
    id: 2,
    revision: 0,
    date: '2026-11-25',
    settings: { ...defaultSettings, buyInCents: 1000 },
    results: [
      {
        playerId: 1,
        name: 'Kike',
        place: 1,
        paidCents: 1000,
        prizeCents: 2000,
        rebuys: 0,
        addOns: 0,
        finalChips,
        points: 5,
      },
      {
        playerId: 2,
        name: 'Toto',
        place: 2,
        paidCents: 1000,
        prizeCents: 0,
        rebuys: 0,
        addOns: 0,
        finalChips: finalChips === null ? null : 0,
        points: 0,
      },
    ],
  }) as unknown as PokerSession;

describe('PokerResultEditor', () => {
  it('quita las fichas si no se contaron', async () => {
    const onSave = vi.fn().mockResolvedValue(true);
    render(
      <PokerResultEditor session={session(20000)} busy={false} onSave={onSave} onClose={vi.fn()} />,
    );
    fireEvent.click(screen.getByLabelText(/las fichas no se contaron/i));
    fireEvent.click(screen.getByRole('button', { name: /guardar/i }));
    await vi.waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ clearChips: true })),
    );
  });

  it('sin fichas no ofrece quitarlas', () => {
    render(
      <PokerResultEditor session={session(null)} busy={false} onSave={vi.fn()} onClose={vi.fn()} />,
    );
    expect(screen.queryByLabelText(/las fichas no se contaron/i)).toBeNull();
  });
});
