import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { chips } from '../../components/poker/pokerFormat';
import PokerTv from '../../components/poker/PokerTv';
import type { BlindClock } from '../../services/endpoints/poker';
import type { PokerAlert } from '../../components/poker/usePokerAlerts';

const levels = [
  { minutes: 15, small: 25, big: 50, ante: 0 },
  { minutes: 15, small: 50, big: 100, ante: 10 },
];

function renderTv(
  clock: BlindClock = { level: 0, endsAt: Date.now() + 90_000, remainingMs: 90_000 },
  alert: PokerAlert | null = null,
) {
  const onClose = vi.fn();
  render(
    <PokerTv
      clock={clock}
      levels={levels}
      playersLeft={3}
      playersTotal={5}
      averageChips={12500}
      potCents={5000}
      buyTimers={[{ key: 'rebuy', label: 'Recompras', ms: 120_000 }]}
      alert={alert}
      onClose={onClose}
    />,
  );
  return onClose;
}

describe('PokerTv', () => {
  it('saca en el centro quién ha hecho la recompra', () => {
    renderTv(undefined, { id: 1, kind: 'rebuy', playerId: 7, name: 'Ana' });
    const banner = screen.getByRole('status');
    expect(banner).toHaveTextContent('Ana');
    expect(banner).toHaveTextContent('ha hecho una recompra');
  });

  it('anuncia la subida de ciegas con las nuevas', () => {
    renderTv(undefined, { id: 2, kind: 'level' });
    expect(screen.getByRole('status')).toHaveTextContent(
      `Suben las ciegas${chips(25)} / ${chips(50)}`,
    );
  });

  it('muestra nivel, tiempo, ciegas, siguiente nivel y datos de la mesa', () => {
    renderTv();
    expect(screen.getByText('Nivel 1')).toBeInTheDocument();
    expect(screen.getByRole('timer')).toHaveTextContent('01:30');
    expect(screen.getByText('25 / 50')).toBeInTheDocument();
    expect(screen.getByText('Siguiente · 50 / 100')).toBeInTheDocument();
    expect(screen.getByText('3/5')).toBeInTheDocument();
    expect(screen.getByText('Recompras')).toBeInTheDocument();
    expect(screen.getByText('media de fichas').previousElementSibling).toHaveTextContent(
      chips(12500),
    );
  });

  it('avisa si el reloj está en pausa', () => {
    renderTv({ level: 0, endsAt: null, remainingMs: 90_000 });
    expect(screen.getByText('Reloj en pausa')).toBeInTheDocument();
  });

  it('se cierra con el botón y con Escape', () => {
    const onClose = renderTv();
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
