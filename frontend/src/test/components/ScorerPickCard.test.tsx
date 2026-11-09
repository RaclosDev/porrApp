import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ScorerPickCard from '../../components/matchday/ScorerPickCard';
import ScorerPicksReview from '../../components/league/ScorerPicksReview';
import type { ScorerCandidate, ScorerPickState, ScorerPickView } from '../../types/api';

const api = vi.hoisted(() => ({
  fetchScorerPickState: vi.fn(),
  fetchScorerPicks: vi.fn(),
  fetchCompetitionPlayers: vi.fn(),
  fetchGroup: vi.fn(),
  saveScorerPick: vi.fn(),
  assignScorerPick: vi.fn(),
}));

vi.mock('../../services/api', () => api);

const mbappe: ScorerCandidate = {
  playerId: '231388',
  name: 'Kylian Mbappé',
  shortName: 'K. Mbappé',
  team: 'Real Madrid',
  position: 'F',
  goals: 12,
};
const ramos: ScorerCandidate = {
  playerId: '9',
  name: 'Gonçalo Ramos',
  shortName: 'G. Ramos',
  team: 'Paris Saint-Germain',
  position: 'F',
  goals: 3,
};

const view = (patch: Partial<ScorerPickView>): ScorerPickView => ({
  predictionId: 30,
  userId: 2,
  participantName: 'Ana',
  writtenName: 'Ramos',
  status: 'DOUBTFUL',
  playerId: null,
  playerName: null,
  team: '',
  byAdmin: false,
  canAssign: false,
  candidates: [],
  ...patch,
});

const stateOf = (patch: Partial<ScorerPickState>): ScorerPickState => ({
  enabled: true,
  inBracket: false,
  locked: false,
  lockAt: '2026-08-15T19:00:00Z',
  mine: null,
  canResolve: false,
  ...patch,
});

const renderWith = (ui: React.ReactElement) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
};

describe('pichichi de una liga por jornadas', () => {
  beforeEach(() => {
    Object.values(api).forEach((mock) => mock.mockReset());
    api.fetchCompetitionPlayers.mockResolvedValue([mbappe, ramos]);
    api.fetchScorerPicks.mockResolvedValue([]);
    api.fetchGroup.mockResolvedValue({ competitionId: 7 });
  });

  it('con el plazo abierto guarda el jugador elegido de la lista con su id', async () => {
    api.fetchScorerPickState.mockResolvedValue(stateOf({}));
    api.saveScorerPick.mockResolvedValue(
      stateOf({
        mine: view({
          writtenName: 'Kylian Mbappé',
          status: 'PLAYER',
          playerId: '231388',
          playerName: 'Kylian Mbappé',
          team: 'Real Madrid',
        }),
      }),
    );
    renderWith(<ScorerPickCard groupId={10} competitionId={7} canEdit />);

    const input = await screen.findByRole('textbox', { name: 'Pichichi' });
    await waitFor(() => expect(api.fetchCompetitionPlayers).toHaveBeenCalledWith(7));
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeDisabled();
    fireEvent.change(input, { target: { value: 'kylian mbappe' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() =>
      expect(api.saveScorerPick).toHaveBeenCalledWith(10, {
        name: 'Kylian Mbappé',
        playerId: '231388',
      }),
    );
    expect(await screen.findByText(/Tu pichichi: Kylian Mbappé \(Real Madrid\)/)).toBeVisible();
  });

  it('si no hay jugador con ese nombre manda lo escrito y avisa de que queda dudoso', async () => {
    api.fetchScorerPickState.mockResolvedValue(stateOf({}));
    api.saveScorerPick.mockResolvedValue(stateOf({ mine: view({}) }));
    renderWith(<ScorerPickCard groupId={10} competitionId={7} canEdit />);

    fireEvent.change(await screen.findByRole('textbox', { name: 'Pichichi' }), {
      target: { value: 'Ramos' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() =>
      expect(api.saveScorerPick).toHaveBeenCalledWith(10, { name: 'Ramos', playerId: null }),
    );
    expect(
      await screen.findByText(/dudoso: el administrador de la liga lo resolverá/),
    ).toBeVisible();
  });

  it('cerrado el plazo no deja cambiarlo y enseña los de la liga', async () => {
    api.fetchScorerPickState.mockResolvedValue(
      stateOf({
        locked: true,
        mine: view({
          writtenName: 'Mbappe',
          status: 'MATCHED',
          playerName: 'Kylian Mbappé',
          playerId: '231388',
          team: 'Real Madrid',
        }),
      }),
    );
    api.fetchScorerPicks.mockResolvedValue([
      view({ participantName: 'Bruno', writtenName: 'Haaland' }),
    ]);
    renderWith(<ScorerPickCard groupId={10} competitionId={7} canEdit />);

    expect(await screen.findByText(/Plazo cerrado/)).toBeVisible();
    expect(screen.queryByRole('textbox', { name: 'Pichichi' })).not.toBeInTheDocument();
    expect(await screen.findByText('Pichichis de la liga (1)')).toBeVisible();
    expect(screen.getByText('Bruno')).toBeInTheDocument();
  });

  it('no pinta nada si la liga no juega el pichichi o lo elige dentro del cuadro', async () => {
    api.fetchScorerPickState.mockResolvedValue(stateOf({ inBracket: true }));
    const { container } = renderWith(<ScorerPickCard groupId={10} competitionId={7} canEdit />);
    await waitFor(() => expect(api.fetchScorerPickState).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it('el administrador asigna un jugador a un pichichi dudoso', async () => {
    api.fetchScorerPickState.mockResolvedValue(stateOf({ locked: true, canResolve: true }));
    api.fetchScorerPicks.mockResolvedValue([
      view({
        canAssign: true,
        candidates: [ramos, { ...ramos, playerId: '10', name: 'Sergio Ramos', team: 'Sevilla' }],
      }),
    ]);
    api.assignScorerPick.mockResolvedValue(view({ status: 'PLAYER', playerId: '9' }));
    renderWith(<ScorerPicksReview groupId={10} />);

    expect(await screen.findByText('Pichichis por resolver')).toBeVisible();
    const assign = screen.getByRole('button', { name: 'Asignar' });
    expect(assign).toBeDisabled();
    fireEvent.change(screen.getByRole('combobox', { name: /Jugador de Ana/ }), {
      target: { value: '9' },
    });
    fireEvent.click(assign);

    await waitFor(() => expect(api.assignScorerPick).toHaveBeenCalledWith(10, 30, '9'));
  });

  it('quien no administra la liga no ve la revisión', async () => {
    api.fetchScorerPickState.mockResolvedValue(stateOf({ locked: true }));
    const { container } = renderWith(<ScorerPicksReview groupId={10} />);
    await waitFor(() => expect(api.fetchScorerPickState).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });
});
