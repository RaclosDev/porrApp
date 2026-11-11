import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import TrackerAttendees from '../../components/tracker/TrackerAttendees';
import TrackerGamePicker from '../../components/tracker/TrackerGamePicker';
import TrackerSheet from '../../components/tracker/TrackerSheet';
import TrackerIdentity from '../../components/tracker/TrackerIdentity';
import TrackerStandings from '../../components/tracker/TrackerStandings';
import type {
  Tracker,
  TrackerGame,
  TrackerRound,
  TrackerSession,
} from '../../services/endpoints/trackers';

const tracker: Tracker = {
  id: 1,
  name: 'Mus',
  unit: 'puntos',
  lowerWins: false,
  owner: true,
  joinCode: 'ABCDEFGH',
  myPlayerId: null,
  claimedPlayerIds: [],
  currentSessionId: 1,
  players: [
    { id: 11, name: 'Ana' },
    { id: 12, name: 'Berto' },
  ],
  sessions: [],
  rounds: [],
  overall: [],
};

const session: TrackerSession = {
  id: 5,
  number: 2,
  gameId: 3,
  startedAt: '2026-11-10T18:00:00Z',
  rounds: 1,
  standings: [
    { playerId: 11, name: 'Ana', total: 7, rank: 1, roundsWon: 1, sessionsWon: 0 },
    { playerId: 12, name: 'Berto', total: 2, rank: 2, roundsWon: 0, sessionsWon: 0 },
  ],
  winners: [],
  dayId: 1,
  playerIds: [11, 12],
  endedAt: null,
  plannedRounds: null,
};

const firstRound: TrackerRound = {
  id: 40,
  sessionId: 5,
  // Numeración de toda la liga: en la hoja sale como la ronda 1 de la partida.
  number: 7,
  note: null,
  createdAt: '2026-11-10T18:05:00Z',
  scores: { 11: 7, 12: 2 },
  recordedBy: 'Ana',
  revision: 0,
};

const points = { name: 'Catán', unit: 'puntos', mode: 'POINTS' as const, lowerWins: false };

const sheet = (overrides: Partial<Parameters<typeof TrackerSheet>[0]> = {}) => {
  const props = {
    session,
    game: points,
    players: tracker.players,
    rounds: [firstRound],
    busy: false,
    onAdd: vi.fn().mockResolvedValue(true),
    onEdit: vi.fn().mockResolvedValue(true),
    onDelete: vi.fn().mockResolvedValue(true),
    ...overrides,
  };
  render(<TrackerSheet {...props} />);
  return props;
};

describe('TrackerSheet', () => {
  it('conserva los puntos y muestra las rondas ganadas y el objetivo', () => {
    const { onAdd } = sheet({ game: { ...points, mode: 'ROUNDS', targetWins: 5 } });

    expect(screen.getAllByRole('row')[1]).toHaveTextContent('Ganadas10');
    expect(screen.getAllByRole('row')[2]).toHaveTextContent('Total puntos72');
    expect(screen.getByRole('status')).toHaveTextContent('Objetivo: ganar 5 rondas');
    fireEvent.change(screen.getByLabelText('Ana'), { target: { value: '15' } });
    fireEvent.change(screen.getByLabelText('Berto'), { target: { value: '4' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apuntar ronda' }));
    expect(onAdd).toHaveBeenCalledWith({ scores: { 11: 15, 12: 4 }, sessionId: 5 });
  });

  it('pone los totales arriba y una fila por ronda', () => {
    sheet();

    const rows = screen.getAllByRole('row');
    expect(rows[1]).toHaveTextContent('Total72');
    expect(rows[2]).toHaveTextContent('172');
  });

  it('manda solo quienes tienen puntos escritos: en blanco es que no jugó', async () => {
    const { onAdd } = sheet();

    fireEvent.change(screen.getByLabelText('Ana'), { target: { value: '-3' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apuntar ronda' }));

    await waitFor(() => expect(screen.getByLabelText('Ana')).toHaveValue(''));
    expect(onAdd).toHaveBeenCalledWith({ scores: { 11: -3 }, sessionId: 5 });
  });

  it('avisa si no hay puntos o no son un número entero', async () => {
    const { onAdd } = sheet();

    fireEvent.click(screen.getByRole('button', { name: 'Apuntar ronda' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('al menos un jugador');

    fireEvent.change(screen.getByLabelText('Berto'), { target: { value: '2,5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apuntar ronda' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Berto'));
    expect(onAdd).not.toHaveBeenCalled();
  });

  it('tocando una ronda se corrige o se borra', async () => {
    const { onEdit, onDelete } = sheet();

    fireEvent.click(screen.getByRole('button', { name: 'Corregir la ronda 1' }));
    expect(screen.getByLabelText('Ana')).toHaveValue('7');
    fireEvent.change(screen.getByLabelText('Berto'), { target: { value: '4' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar la ronda' }));
    await waitFor(() =>
      expect(onEdit).toHaveBeenCalledWith(40, {
        scores: { 11: 7, 12: 4 },
        sessionId: 5,
        expectedRevision: 0,
      }),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Corregir la ronda 1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Borrar la ronda' }));
    await waitFor(() =>
      expect(onDelete).toHaveBeenCalledWith(expect.objectContaining({ id: 40, number: 1 })),
    );
  });

  it('en un juego por victorias se toca a quien gana la ronda', () => {
    const { onAdd } = sheet({
      game: { name: 'Mus', unit: 'victorias', mode: 'WINS', lowerWins: false },
      rounds: [{ ...firstRound, scores: { 11: 1, 12: 0 } }],
    });

    expect(screen.getAllByRole('row')[1]).toHaveTextContent('Ganadas10');
    expect(screen.getByLabelText('ganó')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Gana Berto' }));

    expect(onAdd).toHaveBeenCalledWith({ winners: [12], sessionId: 5 });
  });
});

describe('TrackerGamePicker', () => {
  const games: TrackerGame[] = [
    {
      id: 3,
      name: 'Catán',
      unit: 'puntos',
      lowerWins: false,
      sessions: 1,
      rounds: 4,
      mode: 'POINTS',
    },
  ];

  it('crea un juego libre con puntos por ronda y objetivo de cinco victorias', async () => {
    const onCreate = vi.fn().mockResolvedValue(true);
    render(<TrackerGamePicker games={[]} busy={false} onPick={vi.fn()} onCreate={onCreate} />);
    fireEvent.change(screen.getByLabelText('Nombre del juego'), {
      target: { value: ' El juego del gimnasio ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Puntos por ronda' }));
    fireEvent.change(screen.getByLabelText('Rondas que hay que ganar (opcional)'), {
      target: { value: '5' },
    });
    fireEvent.click(screen.getByLabelText('Gana la ronda quien menos puntos tiene'));
    fireEvent.click(screen.getByRole('button', { name: 'Crear y jugar' }));

    await waitFor(() =>
      expect(onCreate).toHaveBeenCalledWith({
        name: 'El juego del gimnasio',
        mode: 'ROUNDS',
        unit: 'puntos',
        lowerWins: true,
        targetWins: 5,
      }),
    );
  });

  it('las plantillas se pueden cambiar y no arrastran el objetivo a un ganador directo', async () => {
    const onCreate = vi.fn().mockResolvedValue(true);
    render(<TrackerGamePicker games={[]} busy={false} onPick={vi.fn()} onCreate={onCreate} />);
    fireEvent.click(screen.getByRole('button', { name: 'Mus' }));
    fireEvent.change(screen.getByLabelText('Rondas que hay que ganar (opcional)'), {
      target: { value: '5' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Polilla tramposa' }));
    fireEvent.change(screen.getByLabelText('Nombre del juego'), {
      target: { value: 'Polilla del Gym' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Crear y jugar' }));

    await waitFor(() =>
      expect(onCreate).toHaveBeenCalledWith({
        name: 'Polilla del Gym',
        mode: 'DIRECT',
        unit: 'victorias',
        lowerWins: false,
      }),
    );
  });

  it('rechaza objetivos fraccionarios o fuera de rango', () => {
    const onCreate = vi.fn();
    render(<TrackerGamePicker games={[]} busy={false} onPick={vi.fn()} onCreate={onCreate} />);
    fireEvent.click(screen.getByRole('button', { name: 'Mus' }));
    for (const value of ['0', '2.5', '501']) {
      fireEvent.change(screen.getByLabelText('Rondas que hay que ganar (opcional)'), {
        target: { value },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Crear y jugar' }));
      expect(screen.getByRole('alert')).toHaveTextContent('de 1 a 500');
    }
    expect(onCreate).not.toHaveBeenCalled();
  });

  it('elige un juego de la liga con un toque', () => {
    const onPick = vi.fn();
    render(<TrackerGamePicker games={games} busy={false} onPick={onPick} onCreate={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /Catán/ }));

    expect(onPick).toHaveBeenCalledWith(3);
  });

  it('crea un juego por victorias', async () => {
    const onCreate = vi.fn().mockResolvedValue(true);
    render(<TrackerGamePicker games={games} busy={false} onPick={vi.fn()} onCreate={onCreate} />);

    fireEvent.click(screen.getByRole('button', { name: 'Otro juego nuevo' }));
    fireEvent.change(screen.getByLabelText('Nombre del juego'), { target: { value: ' Mus ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Victorias por ronda' }));
    fireEvent.click(screen.getByRole('button', { name: 'Crear y jugar' }));

    await waitFor(() =>
      expect(onCreate).toHaveBeenCalledWith({
        name: 'Mus',
        mode: 'WINS',
        unit: 'victorias',
        lowerWins: false,
      }),
    );
  });
});

describe('TrackerAttendees', () => {
  it('marca con un toque y añade jugadores', async () => {
    const onToggle = vi.fn();
    const onAddPlayer = vi.fn().mockResolvedValue(true);
    render(
      <TrackerAttendees
        label="Han venido"
        players={tracker.players}
        selected={[11]}
        busy={false}
        onToggle={onToggle}
        onAddPlayer={onAddPlayer}
      />,
    );

    expect(screen.getByRole('button', { name: /Ana/ })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: /Berto/ }));
    expect(onToggle).toHaveBeenCalledWith(12);

    fireEvent.change(screen.getByLabelText('Nombre del jugador nuevo'), {
      target: { value: 'Carla' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Añadir' }));
    await waitFor(() => expect(onAddPlayer).toHaveBeenCalledWith('Carla'));
  });
});

describe('TrackerStandings', () => {
  const standings = [
    { playerId: 1, name: 'Ana', total: 7, rank: 1, roundsWon: 2, sessionsWon: 10 },
    { playerId: 2, name: 'Berto', total: 7, rank: 1, roundsWon: 1, sessionsWon: 3 },
    { playerId: 3, name: 'Carla', total: 1, rank: 3, roundsWon: 0, sessionsWon: 0 },
  ];

  it('muestra las posiciones con empates y las sesiones ganadas en el histórico', () => {
    render(
      <TrackerStandings
        caption="Histórico"
        standings={standings}
        unit="fichas"
        showSessions
        empty={false}
      />,
    );

    expect(screen.getAllByRole('row')).toHaveLength(4);
    expect(screen.getByRole('columnheader', { name: 'Partidas ganadas' })).toBeInTheDocument();
    expect(screen.getByRole('row', { name: /Carla/ })).toHaveTextContent('3');
    expect(screen.getByText('10')).toBeInTheDocument();
  });

  it('sin partidas nadie va primero', () => {
    render(<TrackerStandings caption="Sesión" standings={standings} unit="puntos" empty />);

    expect(screen.queryByRole('columnheader', { name: 'Partidas' })).not.toBeInTheDocument();
    expect(screen.getAllByText('–')).toHaveLength(3);
  });
});

describe('TrackerIdentity', () => {
  it('deja elegir un jugador libre y no ofrece los que ya son de otra persona', () => {
    const onClaim = vi.fn().mockResolvedValue(true);
    const shared = { ...tracker, claimedPlayerIds: [11] };
    render(<TrackerIdentity tracker={shared} busy={false} onClaim={onClaim} onRelease={vi.fn()} />);

    expect(screen.queryByRole('button', { name: 'Soy Ana' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Soy Berto' }));
    expect(onClaim).toHaveBeenCalledWith(12);
  });

  it('si ya eres un jugador lo dice y deja quitarte', () => {
    const onRelease = vi.fn().mockResolvedValue(true);
    const mine = { ...tracker, myPlayerId: 12, claimedPlayerIds: [12] };
    render(<TrackerIdentity tracker={mine} busy={false} onClaim={vi.fn()} onRelease={onRelease} />);

    expect(screen.getByText('Berto')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Quitarme' }));
    expect(onRelease).toHaveBeenCalled();
  });

  it('marca con (tú) tu fila en la clasificación', () => {
    const rows = [{ playerId: 12, name: 'Berto', total: 1, rank: 1, roundsWon: 1, sessionsWon: 0 }];
    render(
      <TrackerStandings
        caption="Sesión"
        standings={rows}
        unit="puntos"
        empty={false}
        myPlayerId={12}
      />,
    );

    expect(screen.getByRole('row', { name: /Berto \(tú\)/ })).toBeInTheDocument();
  });
});
