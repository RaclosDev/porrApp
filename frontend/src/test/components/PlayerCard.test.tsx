import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PlayerAvatar, PlayerCards, PlayerName } from '../../components/PlayerCard';

const score = (id: number, userId: number, name: string, total: number, pending = false) => ({
  id,
  userId,
  name,
  predictionName: null,
  avatarUrl: userId === 1 ? '/api/users/1/avatar/a' : null,
  total,
  pending,
});

vi.mock('../../context/AppContext', () => ({
  useAppContext: () => ({
    leaderboardData: [
      score(10, 1, 'Ana', 30),
      score(11, 2, 'Luis', 30),
      score(12, 3, 'Paz', 12),
      score(13, 4, 'Sin', 50, true),
    ],
    leaderboardMatchdays: [
      {
        label: 'Jornada 1',
        date: null,
        finished: true,
        current: false,
        matchCount: 10,
        pointsByPrediction: { '10': 18, '11': 10, '12': 4, '13': 40 },
      },
      {
        label: 'Jornada 2',
        date: null,
        finished: true,
        current: false,
        matchCount: 10,
        pointsByPrediction: { '10': 12, '11': 20, '12': 8 },
      },
      {
        label: 'Jornada 3',
        date: null,
        finished: false,
        current: true,
        matchCount: 10,
        pointsByPrediction: { '10': 99 },
      },
    ],
  }),
}));

describe('Cromo de jugador', () => {
  it('la foto abre el cromo con sus números y, dentro, la foto se amplía', () => {
    render(
      <PlayerCards>
        <PlayerAvatar url="/api/users/1/avatar/a" name="Ana" userId={1} />
      </PlayerCards>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Ver el cromo de Ana' }));
    const card = screen.getByRole('dialog', { name: 'Cromo de Ana' });
    // Empata a puntos con Luis: comparten el primer puesto; quien no ha pagado no cuenta.
    expect(within(card).getByText('Puesto').nextElementSibling).toHaveTextContent('1.º');
    expect(within(card).getByText('Puntos').nextElementSibling).toHaveTextContent('30');
    expect(within(card).getByText('Jornadas ganadas').nextElementSibling).toHaveTextContent('1');
    expect(within(card).getByText('Media por jornada').nextElementSibling).toHaveTextContent('15');
    expect(within(card).getByText('Mejor jornada').nextElementSibling).toHaveTextContent(
      '18 · Jornada 1',
    );
    expect(within(card).getByRole('list', { name: /últimas jornadas/ })).toHaveTextContent('1218');

    fireEvent.click(within(card).getByRole('button', { name: 'Ver la foto de Ana' }));
    expect(screen.getByRole('dialog', { name: 'Foto de Ana' })).toBeTruthy();
  });

  it('el nombre abre el cromo y su acción, aunque no tenga foto', () => {
    const run = vi.fn();
    render(
      <PlayerCards>
        <PlayerName
          name="Paz"
          userId={3}
          predictionId={12}
          action={{ label: 'Ver su predicción', run }}
        />
      </PlayerCards>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Ver el cromo de Paz' }));
    const card = screen.getByRole('dialog', { name: 'Cromo de Paz' });
    expect(within(card).getByText('Puesto').nextElementSibling).toHaveTextContent('2.º');
    fireEvent.click(within(card).getByRole('button', { name: 'Ver su predicción' }));
    expect(run).toHaveBeenCalledOnce();
    expect(screen.queryByRole('dialog', { name: 'Cromo de Paz' })).toBeNull();
  });

  it('sin datos en la liga lo dice; sin proveedor la foto se amplía directamente', () => {
    const { unmount } = render(
      <PlayerCards>
        <PlayerName name="Nueva" userId={99} />
      </PlayerCards>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Ver el cromo de Nueva' }));
    expect(screen.getByRole('dialog', { name: 'Cromo de Nueva' })).toHaveTextContent(
      'Aún sin predicción en esta liga.',
    );
    unmount();

    render(<PlayerAvatar url="/api/users/1/avatar/a" name="Ana" userId={1} />);
    expect(screen.getByRole('button', { name: 'Ver la foto de Ana' })).toBeTruthy();
  });
});
