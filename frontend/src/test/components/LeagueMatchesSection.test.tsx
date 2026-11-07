import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import LeagueMatchesSection from '../../components/groups/LeagueMatchesSection';
import type { Group, MatchSelectionView, SelectableMatch } from '../../types/api';
import { confirmAction } from '../../utils/confirmAction';

vi.mock('../../utils/confirmAction', () => ({ confirmAction: vi.fn() }));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));

const api = vi.hoisted(() => ({ fetchMatchSelection: vi.fn(), saveMatchSelection: vi.fn() }));
vi.mock('../../services/api', () => api);

const match = (id: number, patch: Partial<SelectableMatch>): SelectableMatch => ({
  id,
  round: 'Jornada 12',
  date: '2099-11-08T21:00:00+01:00',
  homeTeamId: id * 10,
  home: `Local ${id}`,
  homeLogo: null,
  awayTeamId: id * 10 + 1,
  away: `Visitante ${id}`,
  awayLogo: null,
  homeScore: null,
  awayScore: null,
  selected: false,
  closed: false,
  locked: false,
  predictions: 0,
  ...patch,
});

const VIEW: MatchSelectionView = {
  mode: 'CUSTOM',
  teamIds: [],
  includedMatchIds: [1, 2],
  excludedMatchIds: [],
  teams: [],
  matches: [
    match(1, { selected: true, closed: true, locked: true, predictions: 3, round: 'Jornada 11' }),
    match(2, { selected: true, predictions: 4 }),
    match(3, {}),
  ],
  removedPredictions: 0,
  keptMatches: 0,
};

const group = { id: 9, poolFormat: 'MATCH_DAY', competitionId: 1 } as Group;

const renderSection = () =>
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <LeagueMatchesSection group={group} />
    </QueryClientProvider>,
  );

describe('LeagueMatchesSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.fetchMatchSelection.mockResolvedValue(VIEW);
    api.saveMatchSelection.mockResolvedValue(VIEW);
  });

  it('pide confirmación antes de borrar predicciones y guarda la nueva selección', async () => {
    vi.mocked(confirmAction).mockResolvedValue(true);
    renderSection();

    expect(await screen.findByText('Elegidos a mano: 2 partidos')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Elegir partidos' }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Local 2/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Local 3/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar partidos' }));

    await waitFor(() => expect(api.saveMatchSelection).toHaveBeenCalled());
    expect(vi.mocked(confirmAction).mock.calls[0][0].message).toContain('4 predicciones');
    expect(api.saveMatchSelection).toHaveBeenCalledWith(9, {
      mode: 'CUSTOM',
      teamIds: [],
      includedMatchIds: [1, 3],
    });
  });

  it('no guarda si se cancela la confirmación', async () => {
    vi.mocked(confirmAction).mockResolvedValue(false);
    renderSection();

    fireEvent.click(await screen.findByRole('button', { name: 'Elegir partidos' }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Local 2/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar partidos' }));

    await waitFor(() => expect(confirmAction).toHaveBeenCalled());
    expect(api.saveMatchSelection).not.toHaveBeenCalled();
  });
});
