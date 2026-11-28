import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { chips } from '../../components/poker/pokerFormat';
import PokerTv from '../../components/poker/PokerTv';
import type { BlindClock } from '../../services/endpoints/poker';
import type { PokerAlert } from '../../components/poker/usePokerAlerts';

const remove = vi.fn();
vi.mock('../../components/poker/usePokerMusic', () => ({
  usePokerMusic: () => ({
    queue: { items: [{ id: 9, videoId: 'abc', title: 'Canción pedida', addedBy: 'Ana' }] },
    remove: { mutate: remove, isPending: false },
  }),
}));
vi.mock('../../components/poker/YoutubePlayer', () => ({
  default: ({ videoId, onDone }: { videoId: string; onDone: () => void }) => (
    <button type="button" data-video={videoId} onClick={onDone}>
      reproductor
    </button>
  ),
}));

const levels = [
  { minutes: 15, small: 25, big: 50, ante: 0 },
  { minutes: 15, small: 50, big: 100, ante: 10 },
];

function renderTv(
  clock: BlindClock = { level: 0, endsAt: Date.now() + 90_000, remainingMs: 90_000 },
  alert: PokerAlert | null = null,
  leagueId?: number,
  tvLevels = levels,
) {
  const onClose = vi.fn();
  render(
    <PokerTv
      clock={clock}
      levels={tvLevels}
      playersLeft={3}
      playersTotal={5}
      averageChips={12500}
      potCents={5000}
      buyTimers={[{ key: 'rebuy', label: 'Recompras', ms: 120_000 }]}
      alert={alert}
      leagueId={leagueId}
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

  it('el crupier de la mesa saca el revólver con la recompra', () => {
    renderTv(undefined, { id: 3, kind: 'rebuy', playerId: 7, name: 'Ana' });
    const crupier = document.querySelector('.poker-tv-scene .crupier')!;
    expect(crupier).toHaveAttribute('aria-hidden', 'true');
    expect(crupier.querySelector('.p-gun')).toBeInTheDocument();
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
    expect(screen.getByText(`${chips(25)} / ${chips(50)}`)).toBeInTheDocument();
    expect(screen.getByText(`${chips(50)} / ${chips(100)}`)).toBeInTheDocument();
    expect(screen.getByText('En mesa').nextElementSibling).toHaveTextContent('3 / 5');
    expect(screen.getByText('bote').previousElementSibling).toHaveTextContent(/50,00/);
    expect(screen.getByText('tiempo de recompras')).toBeInTheDocument();
    expect(screen.getByText('media de fichas').previousElementSibling).toHaveTextContent(
      chips(12500),
    );
  });

  it('el descanso no gasta número: tras el nivel 1 viene el nivel 2', () => {
    const pause = { minutes: 10, small: 0, big: 0, ante: 0 };
    renderTv({ level: 1, endsAt: Date.now() + 90_000, remainingMs: 90_000 }, null, undefined, [
      levels[0],
      pause,
      levels[1],
    ]);
    expect(screen.getByText('Tras el nivel 1')).toBeInTheDocument();
  });

  it('con la TV activada suena la cola, pero la cola no se enseña en la tele', () => {
    renderTv(undefined, null, 4);
    expect(screen.queryByText('reproductor')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /TV apagada/ }));
    const player = screen.getByText('reproductor');
    expect(player).toHaveAttribute('data-video', 'abc');
    expect(screen.queryByText('Canción pedida')).not.toBeInTheDocument();
    fireEvent.click(player);
    expect(remove).toHaveBeenCalledWith(9);
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
