import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import TrackerInvite from '../../components/tracker/TrackerInvite';
import TrackerAddPlayer from '../../components/tracker/TrackerAddPlayer';
import TrackerCard from '../../components/tracker/TrackerCard';
import { copyWithToast } from '../../utils/leagueInvite';
import type { Tracker } from '../../services/endpoints/trackers';

vi.mock('../../components/tracker/TrackerQr', () => ({
  default: ({ link }: { link: string }) => <p>QR de {link}</p>,
}));
vi.mock(import('../../utils/leagueInvite'), async (original) => ({
  ...(await original()),
  copyWithToast: vi.fn(),
}));

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
    render(<TrackerInvite tracker={tracker} />);

    expect(screen.getByText('ABCDEFGH')).toBeInTheDocument();
    expect(screen.getByText(/QR de .*\/join\/ABCDEFGH/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Copiar enlace' }));
    expect(copyWithToast).toHaveBeenCalledWith(
      expect.stringContaining('/join/ABCDEFGH'),
      'Enlace copiado',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Copiar el código ABCDEFGH' }));
    expect(copyWithToast).toHaveBeenCalledWith('ABCDEFGH', 'Código ABCDEFGH copiado');
    // Sin la API de compartir del sistema no se ofrece ese botón.
    expect(screen.queryByRole('button', { name: 'Compartir' })).not.toBeInTheDocument();
  });

  it('apunta a quien no tiene cuenta, limpia el nombre y confirma el alta', async () => {
    const onAddPlayer = vi.fn().mockResolvedValue(true);
    render(<TrackerAddPlayer busy={false} onAddPlayer={onAddPlayer} />);

    fireEvent.change(screen.getByLabelText('Nombre del jugador'), { target: { value: ' Luis ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Añadir' }));

    await waitFor(() => expect(screen.getByLabelText('Nombre del jugador')).toHaveValue(''));
    expect(onAddPlayer).toHaveBeenCalledWith('Luis');
    expect(screen.getByRole('status')).toHaveTextContent('Luis ya está en la liga.');
    expect(screen.getByLabelText('Nombre del jugador')).toHaveFocus();
  });

  it('conserva el nombre cuando falla y permite reintentarlo sin duplicar envíos', async () => {
    let finish: (ok: boolean) => void = () => {};
    const onAddPlayer = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<boolean>((resolve) => {
            finish = resolve;
          }),
      )
      .mockResolvedValue(true);
    render(<TrackerAddPlayer busy={false} onAddPlayer={onAddPlayer} />);
    fireEvent.change(screen.getByLabelText('Nombre del jugador'), { target: { value: 'Luis' } });
    fireEvent.click(screen.getByRole('button', { name: 'Añadir' }));
    expect(screen.getByRole('button', { name: 'Añadiendo…' })).toBeDisabled();
    finish(false);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Añadir' })).toBeEnabled());
    expect(screen.getByLabelText('Nombre del jugador')).toHaveValue('Luis');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Añadir' }));
    await screen.findByRole('status');
    expect(onAddPlayer).toHaveBeenCalledTimes(2);
  });

  it('la invitación por enlace está separada del alta sin cuenta', () => {
    render(<TrackerInvite tracker={tracker} />);
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copiar enlace' })).toBeInTheDocument();
  });
});

describe('TrackerCard', () => {
  it('abre la liga y cuenta jugadores y partidas', () => {
    render(
      <MemoryRouter>
        <ul>
          <TrackerCard tracker={{ id: 5, name: 'Mus', owner: true, players: 1, rounds: 3 }} />
        </ul>
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: 'Abrir el marcador Mus' })).toHaveAttribute(
      'href',
      '/?group=5',
    );
    expect(screen.getByText('1 jugador · 3 partidas')).toBeInTheDocument();
    expect(screen.getByText(/Administras/)).toBeInTheDocument();
  });
});
