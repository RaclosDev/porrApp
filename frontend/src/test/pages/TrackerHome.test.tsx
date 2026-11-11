import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import TrackerHome from '../../pages/TrackerHome';
import type { Tracker, TrackerSession } from '../../services/endpoints/trackers';

const fetchTracker = vi.fn();
const addPlayer = vi.fn();
vi.mock('../../services/endpoints/trackers', async (original) => ({
  ...(await original<typeof import('../../services/endpoints/trackers')>()),
  fetchTracker: (id: string) => fetchTracker(id),
  addTrackerPlayer: (id: number, name: string) => addPlayer(id, name),
}));

const session = (overrides: Partial<TrackerSession>): TrackerSession => ({
  id: 1,
  number: 1,
  gameId: 3,
  startedAt: '2026-11-05T18:00:00Z',
  rounds: 2,
  standings: [
    { playerId: 11, name: 'Ana', total: 9, rank: 1, roundsWon: 2, sessionsWon: 0 },
    { playerId: 12, name: 'Berto', total: 4, rank: 2, roundsWon: 0, sessionsWon: 0 },
  ],
  winners: [11],
  dayId: 1,
  playerIds: [11, 12],
  endedAt: '2026-11-05T19:00:00Z',
  plannedRounds: null,
  ...overrides,
});

const base: Tracker = {
  id: 9,
  name: 'Jueves',
  unit: 'puntos',
  lowerWins: false,
  owner: true,
  joinCode: 'ABCDEFGH',
  myPlayerId: 11,
  claimedPlayerIds: [11],
  currentSessionId: null,
  players: [
    { id: 11, name: 'Ana' },
    { id: 12, name: 'Berto' },
  ],
  games: [
    {
      id: 3,
      name: 'Catán',
      unit: 'puntos',
      lowerWins: false,
      sessions: 2,
      rounds: 4,
      mode: 'POINTS',
    },
  ],
  days: [
    {
      id: 1,
      startedAt: '2026-11-05T18:00:00Z',
      closedAt: '2026-11-05T23:00:00Z',
      playerIds: [11, 12],
      sessionIds: [1],
    },
  ],
  sessions: [session({})],
  rounds: [],
  overall: [
    { playerId: 11, name: 'Ana', total: 9, rank: 1, roundsWon: 2, sessionsWon: 1 },
    { playerId: 12, name: 'Berto', total: 4, rank: 2, roundsWon: 0, sessionsWon: 0 },
  ],
};

const renderHome = (tracker: Tracker) => {
  fetchTracker.mockResolvedValue(tracker);
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <TrackerHome leagueId="9" />
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

describe('Inicio de una liga de juegos de mesa', () => {
  it('ordena el último día por la fecha corregida y muestra esa fecha', async () => {
    renderHome({
      ...base,
      days: [
        { ...base.days![0], playedOn: '2026-11-01' },
        {
          ...base.days![0],
          id: 2,
          startedAt: '2026-11-03T18:00:00Z',
          playedOn: '2026-11-04',
          sessionIds: [2],
        },
      ],
      sessions: [...base.sessions, session({ id: 2, number: 2, dayId: 2 })],
    });
    const lastDay = await screen.findByRole('region', { name: 'Último día de juego' });
    expect(lastDay).toHaveTextContent('4 de noviembre');
    expect(lastDay).toHaveTextContent('Catán · partida 2');
    expect(lastDay).not.toHaveTextContent('Catán · partida 1');
  });

  it('sin día en curso: botón para empezarlo, podio y último día', async () => {
    renderHome(base);

    expect(await screen.findByRole('link', { name: 'Empezar día de juego' })).toHaveAttribute(
      'href',
      '/partida',
    );
    // En el podio solo quien ha ganado alguna partida.
    const podium = screen.getByRole('region', { name: 'Quién va ganando' });
    expect(podium).toHaveTextContent('1.º Ana (tú)1 partida ganada');
    expect(podium).not.toHaveTextContent('Berto');
    expect(screen.getByRole('link', { name: 'Ver ranking' })).toHaveAttribute('href', '/ranking');

    const lastDay = screen.getByRole('region', { name: 'Último día de juego' });
    expect(lastDay).toHaveTextContent('Vinieron Ana, Berto');
    expect(lastDay).toHaveTextContent('Catán · partida 1: Gana Ana');
  });

  it('con un día en curso: qué se juega y el enlace a la partida', async () => {
    renderHome({
      ...base,
      currentDayId: 2,
      days: [
        ...(base.days ?? []),
        {
          id: 2,
          startedAt: '2026-11-12T18:00:00Z',
          closedAt: null,
          playerIds: [11, 12],
          sessionIds: [2],
        },
      ],
      sessions: [
        ...base.sessions,
        session({ id: 2, number: 2, dayId: 2, endedAt: null, rounds: 1 }),
      ],
    });

    expect(await screen.findByRole('link', { name: 'Ir a la partida' })).toHaveAttribute(
      'href',
      '/partida',
    );
    expect(screen.getByText(/Jugando a Catán · partida 2, 1 ronda\./)).toBeInTheDocument();
  });

  it('sin jugadores abre el alta sin cuenta y mantiene aparte las invitaciones', async () => {
    renderHome({ ...base, players: [], overall: [], days: [], sessions: [] });

    expect(await screen.findByRole('button', { name: 'Añadir jugador' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(screen.getByLabelText('Nombre del jugador')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Invitar con enlace' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(screen.queryByRole('region', { name: 'Quién va ganando' })).not.toBeInTheDocument();
    addPlayer.mockResolvedValue({ ...base, players: [{ id: 15, name: 'Luis' }] });
    fireEvent.change(screen.getByLabelText('Nombre del jugador'), { target: { value: 'Luis' } });
    fireEvent.click(screen.getByRole('button', { name: 'Añadir' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Luis ya está en la liga.');
    expect(screen.getByLabelText('Nombre del jugador')).toHaveValue('');
  });

  it('un miembro sin identidad ve los jugadores y puede abrir el alta, sin controles de administrador', async () => {
    renderHome({ ...base, owner: false, myPlayerId: null });
    fireEvent.click(await screen.findByRole('button', { name: 'Añadir jugador' }));
    expect(screen.getByLabelText('Nombre del jugador')).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Jugadores' })).toHaveTextContent('Berto');
    expect(screen.queryByRole('button', { name: 'Editar a Berto' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar formulario' }));
    expect(screen.getByRole('button', { name: 'Añadir jugador' })).toHaveFocus();
  });
});
