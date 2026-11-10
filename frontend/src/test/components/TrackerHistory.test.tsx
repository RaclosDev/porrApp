import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import TrackerHistory from '../../components/tracker/TrackerHistory';
import TrackerOverall from '../../components/tracker/TrackerOverall';
import type { Tracker, TrackerSession, TrackerStanding } from '../../services/endpoints/trackers';

const row = (
  playerId: number,
  name: string,
  total: number,
  rank: number,
  sessionsWon = 0,
): TrackerStanding => ({ playerId, name, total, rank, roundsWon: 0, sessionsWon });

const ended = (overrides: Partial<TrackerSession>): TrackerSession => ({
  id: 1,
  number: 1,
  gameId: 3,
  startedAt: '2026-11-05T18:00:00Z',
  rounds: 1,
  standings: [row(11, 'Ana', 9, 1), row(12, 'Berto', 4, 2)],
  winners: [11],
  dayId: 1,
  playerIds: [11, 12],
  endedAt: '2026-11-05T19:00:00Z',
  plannedRounds: null,
  ...overrides,
});

const tracker: Tracker = {
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
    { id: 13, name: 'Carla' },
  ],
  games: [
    {
      id: 3,
      name: 'Catán',
      unit: 'puntos',
      lowerWins: false,
      sessions: 2,
      rounds: 3,
      mode: 'POINTS',
    },
    {
      id: 4,
      name: 'Mus',
      unit: 'victorias',
      lowerWins: false,
      sessions: 1,
      rounds: 2,
      mode: 'WINS',
    },
    {
      id: 5,
      name: 'Dixit',
      unit: 'puntos',
      lowerWins: false,
      sessions: 0,
      rounds: 0,
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
    {
      id: 2,
      startedAt: '2026-11-12T18:00:00Z',
      closedAt: null,
      playerIds: [11, 12, 13],
      sessionIds: [2, 3],
    },
  ],
  sessions: [
    ended({}),
    ended({
      id: 2,
      number: 2,
      dayId: 2,
      startedAt: '2026-11-12T18:00:00Z',
      playerIds: [11, 12, 13],
      standings: [row(12, 'Berto', 8, 1), row(11, 'Ana', 8, 1), row(13, 'Carla', 1, 3)],
      winners: [12, 11],
    }),
    ended({ id: 3, number: 3, gameId: 4, dayId: 2, endedAt: null, winners: [] }),
  ],
  rounds: [
    {
      id: 40,
      sessionId: 1,
      number: 1,
      note: null,
      createdAt: '2026-11-05T18:10:00Z',
      scores: { 11: 9, 12: 4 },
      recordedBy: 'Ana',
    },
  ],
  overall: [row(11, 'Ana', 17, 1, 2), row(12, 'Berto', 12, 2, 1)],
  byGame: [
    { gameId: 3, standings: [row(11, 'Ana', 17, 1, 2), row(12, 'Berto', 12, 2, 1)] },
    { gameId: 4, standings: [row(11, 'Ana', 0, 1), row(12, 'Berto', 0, 1)] },
  ],
};

describe('TrackerHistory', () => {
  it('lista los días del más reciente al más antiguo, con quién vino y quién ganó', () => {
    render(<TrackerHistory tracker={tracker} />);

    const days = screen.getAllByRole('heading', { level: 3 });
    expect(days[0]).toHaveTextContent(/12 de noviembre/);
    expect(days[1]).toHaveTextContent(/5 de noviembre/);
    expect(screen.getByText('Vinieron Ana, Berto, Carla')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Catán · partida 2/ })).toHaveTextContent(
      'Ganan Berto y Ana',
    );
    expect(screen.getByRole('button', { name: /Mus · partida 3/ })).toHaveTextContent('En juego');
  });

  it('abre la hoja de una partida antigua sin poder tocarla', () => {
    render(<TrackerHistory tracker={tracker} />);

    fireEvent.click(screen.getByRole('button', { name: /Catán · partida 1/ }));

    const table = screen.getByRole('table', { name: 'Hoja de la partida 1 de Catán' });
    expect(within(table).getAllByRole('row')[2]).toHaveTextContent('194');
    expect(screen.queryByRole('button', { name: /Corregir/ })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Ana')).not.toBeInTheDocument();
    expect(screen.getByText('Gana Ana')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Volver al histórico' }));
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(2);
  });

  it('sin partidas avisa de lo que saldrá', () => {
    render(<TrackerHistory tracker={{ ...tracker, days: [], sessions: [] }} />);

    expect(screen.getByText(/Aquí quedarán los días de juego/)).toBeInTheDocument();
  });
});

describe('TrackerOverall', () => {
  it('filtra la clasificación por juego y dice quién lo gana más', () => {
    render(<TrackerOverall tracker={tracker} />);

    // Dixit no se ha jugado: no sale en el filtro.
    expect(screen.queryByRole('button', { name: 'Dixit' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Todos los juegos' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Catán' }));
    expect(screen.getByRole('status')).toHaveTextContent(
      'Catán: 2 partidas y 3 rondas. Quien más lo gana: Ana (2).',
    );
    expect(screen.getByRole('table', { name: 'Clasificación de Catán' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Mus' }));
    expect(screen.getByRole('status')).toHaveTextContent('Todavía nadie ha ganado una partida.');
    expect(screen.getByRole('columnheader', { name: 'victorias' })).toBeInTheDocument();
  });
});

describe('Ranking por temporada', () => {
  const twoYears: Tracker = {
    ...tracker,
    sessions: [
      ...tracker.sessions,
      ended({
        id: 4,
        number: 4,
        dayId: null,
        startedAt: '2025-12-30T18:00:00Z',
        endedAt: '2025-12-30T20:00:00Z',
        standings: [row(13, 'Carla', 10, 1), row(12, 'Berto', 2, 2)],
        playerIds: [13, 12],
        winners: [13],
      }),
    ],
  };

  it('sin varios años no enseña el filtro', () => {
    render(<TrackerOverall tracker={tracker} />);
    expect(screen.queryByRole('group', { name: 'Temporada' })).not.toBeInTheDocument();
  });

  it('cuenta solo las partidas del año elegido', () => {
    render(<TrackerOverall tracker={twoYears} />);

    const seasons = screen.getByRole('group', { name: 'Temporada' });
    expect(
      within(seasons)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['Siempre', '2026', '2025']);

    fireEvent.click(within(seasons).getByRole('button', { name: '2025' }));
    const table = screen.getByRole('table', { name: 'Clasificación general en 2025' });
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows.map((item) => item.querySelector('th')?.textContent)).toEqual(['Carla', 'Berto']);

    // En 2026 Ana gana dos (una empatada con Berto) y Berto una.
    fireEvent.click(within(seasons).getByRole('button', { name: '2026' }));
    const current = screen.getByRole('table', { name: 'Clasificación general en 2026' });
    expect(within(current).getAllByRole('row')[1]).toHaveTextContent(/1Ana.*2$/);
  });
});
