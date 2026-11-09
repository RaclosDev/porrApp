import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import TrackerRoundForm from '../../components/tracker/TrackerRoundForm';
import TrackerStandings from '../../components/tracker/TrackerStandings';
import type { Tracker } from '../../services/endpoints/trackers';

const tracker: Tracker = {
  id: 1,
  name: 'Mus',
  unit: 'puntos',
  lowerWins: false,
  owner: true,
  joinCode: 'ABCDEFGH',
  currentSessionId: 1,
  players: [
    { id: 11, name: 'Ana' },
    { id: 12, name: 'Berto' },
  ],
  sessions: [],
  rounds: [],
  overall: [],
};

describe('TrackerRoundForm', () => {
  it('manda solo los jugadores con puntos escritos y vacía el formulario', async () => {
    const onSubmit = vi.fn().mockResolvedValue(true);
    render(<TrackerRoundForm tracker={tracker} busy={false} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText('Ana'), { target: { value: '-3' } });
    fireEvent.change(screen.getByLabelText('Nota (opcional)'), { target: { value: 'la primera' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apuntar partida' }));

    await waitFor(() => expect(screen.getByLabelText('Ana')).toHaveValue(''));
    expect(onSubmit).toHaveBeenCalledWith({ note: 'la primera', scores: { 11: -3 } });
  });

  it('avisa si no hay puntos o no son un número entero', async () => {
    const onSubmit = vi.fn().mockResolvedValue(true);
    render(<TrackerRoundForm tracker={tracker} busy={false} onSubmit={onSubmit} />);

    fireEvent.click(screen.getByRole('button', { name: 'Apuntar partida' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('al menos un jugador');

    fireEvent.change(screen.getByLabelText('Berto'), { target: { value: '2,5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apuntar partida' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Berto'));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('el +1 apunta una victoria de ese jugador sin tocar el formulario', async () => {
    const onSubmit = vi.fn().mockResolvedValue(true);
    render(<TrackerRoundForm tracker={tracker} busy={false} onSubmit={onSubmit} />);

    fireEvent.click(screen.getByRole('button', { name: 'Victoria de Berto: 1 puntos' }));

    expect(onSubmit).toHaveBeenCalledWith({ note: '', scores: { 12: 1 } });
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
    expect(screen.getByRole('columnheader', { name: 'Sesiones' })).toBeInTheDocument();
    expect(screen.getByRole('row', { name: /Carla/ })).toHaveTextContent('3');
    expect(screen.getByText('10')).toBeInTheDocument();
  });

  it('sin partidas nadie va primero', () => {
    render(<TrackerStandings caption="Sesión" standings={standings} unit="puntos" empty />);

    expect(screen.queryByRole('columnheader', { name: 'Sesiones' })).not.toBeInTheDocument();
    expect(screen.getAllByText('–')).toHaveLength(3);
  });
});
