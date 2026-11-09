import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import TrackerInvite from '../../components/tracker/TrackerInvite';
import TrackerCard from '../../components/tracker/TrackerCard';
import { copyWithToast } from '../../utils/leagueInvite';
import type { Tracker } from '../../services/endpoints/trackers';

vi.mock('../../components/tracker/TrackerQr', () => ({
  default: ({ link }: { link: string }) => <p>QR de {link}</p>,
}));
vi.mock('../../utils/leagueInvite', () => ({ copyWithToast: vi.fn() }));

const tracker: Tracker = {
  id: 1,
  name: 'Mus',
  unit: 'puntos',
  lowerWins: false,
  owner: true,
  joinCode: 'ABCDEFGH',
  myPlayerId: 11,
  claimedPlayerIds: [11],
  currentSessionId: null,
  players: [{ id: 11, name: 'Ana' }],
  sessions: [],
  rounds: [],
  overall: [],
};

afterEach(() => vi.clearAllMocks());

describe('TrackerInvite', () => {
  it('enseña el QR y el código desde el principio y deja copiar el enlace', () => {
    render(<TrackerInvite tracker={tracker} busy={false} onAddPlayer={vi.fn()} />);

    expect(screen.getByText('ABCDEFGH')).toBeInTheDocument();
    expect(screen.getByText(/QR de .*\/marcador\/unirse\/ABCDEFGH/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Copiar enlace' }));
    expect(copyWithToast).toHaveBeenCalledWith(
      expect.stringContaining('/marcador/unirse/ABCDEFGH'),
      'Enlace copiado',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Ocultar QR' }));
    expect(screen.queryByText(/QR de/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mostrar QR' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('el dueño apunta a mano a quien no tiene la app y el campo se vacía', async () => {
    const onAddPlayer = vi.fn().mockResolvedValue(true);
    render(<TrackerInvite tracker={tracker} busy={false} onAddPlayer={onAddPlayer} />);

    fireEvent.change(screen.getByLabelText('Jugador sin la app'), { target: { value: 'Luis' } });
    fireEvent.click(screen.getByRole('button', { name: 'Añadir' }));

    await waitFor(() => expect(screen.getByLabelText('Jugador sin la app')).toHaveValue(''));
    expect(onAddPlayer).toHaveBeenCalledWith('Luis');
  });

  it('no deja apuntar a mano a quien solo está invitado', () => {
    render(
      <TrackerInvite tracker={{ ...tracker, owner: false }} busy={false} onAddPlayer={vi.fn()} />,
    );
    expect(screen.queryByLabelText('Jugador sin la app')).not.toBeInTheDocument();
  });
});

describe('TrackerCard', () => {
  it('enlaza al marcador y cuenta jugadores y partidas', () => {
    render(
      <MemoryRouter>
        <ul>
          <TrackerCard tracker={{ id: 5, name: 'Mus', owner: true, players: 1, rounds: 3 }} />
        </ul>
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: 'Abrir el marcador Mus' })).toHaveAttribute(
      'href',
      '/marcador/5',
    );
    expect(screen.getByText('1 jugador · 3 partidas')).toBeInTheDocument();
    expect(screen.getByText(/Administras/)).toBeInTheDocument();
  });
});
