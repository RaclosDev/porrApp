import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import LeagueClosing from '../../components/league/LeagueClosing';
import * as api from '../../services/api';
import * as appContextModule from '../../context/AppContext';
import { appContext, participantScore } from '../context/fixtures';
import type { LeagueSummary } from '../../types/api';

type AppContextValue = ReturnType<typeof appContextModule.useAppContext>;

vi.mock('../../services/api');
vi.mock('../../context/AppContext');
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));

const players = ['Ana', 'Luis', 'Eva', 'Marta'].map((name, index) =>
  participantScore({ id: index + 1, userId: index + 1, name, total: 120 - index * 10 }),
);

const summary = (fields: Partial<LeagueSummary>): LeagueSummary => ({
  groupId: 10,
  rank: 4,
  points: 90,
  participants: 4,
  pendingPredictions: 0,
  finished: true,
  ...fields,
});

const renderClosing = (summaries: LeagueSummary[], fields: Partial<AppContextValue> = {}) => {
  vi.mocked(api.fetchMyLeagueSummaries).mockResolvedValue(summaries);
  vi.mocked(appContextModule.useAppContext).mockReturnValue(
    appContext({
      isAuthenticated: true,
      activeGroupId: '10',
      activeGroupName: 'Los Cracks',
      activeCompetitionName: 'LaLiga',
      leaderboardData: players,
      userId: '4',
      userName: 'Marta',
      ...fields,
    }),
  );
  return render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <MemoryRouter>
        <LeagueClosing />
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

const setNavigator = (key: 'share' | 'clipboard', value: unknown) =>
  Object.defineProperty(navigator, key, { value, configurable: true });

describe('LeagueClosing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    setNavigator('share', undefined);
    setNavigator('clipboard', undefined);
  });

  it('shows the champion, the podium and how the user finished once the league is over', async () => {
    renderClosing([summary({})]);

    const closing = await screen.findByRole('region', { name: 'Ana gana Los Cracks' });
    expect(within(closing).getByText('Liga terminada')).toBeInTheDocument();
    const podium = within(closing).getByRole('region', { name: 'Podio final' });
    expect(within(podium).getAllByRole('listitem')).toHaveLength(3);
    expect(podium).toHaveTextContent('Ana');
    expect(podium).not.toHaveTextContent('Marta');
    expect(within(closing).getByText('Has quedado 4.º de 4 con 90 pts')).toBeInTheDocument();
    expect(within(closing).getByRole('link', { name: 'Ver clasificación' })).toHaveAttribute(
      'href',
      '/ranking',
    );
  });

  it('stays hidden while the league is being played, in another league or without session', async () => {
    const { unmount } = renderClosing([
      summary({ finished: false }),
      summary({ groupId: 11, finished: true }),
    ]);
    await waitFor(() => expect(api.fetchMyLeagueSummaries).toHaveBeenCalled());
    expect(screen.queryByText('Liga terminada')).not.toBeInTheDocument();
    unmount();

    vi.clearAllMocks();
    renderClosing([summary({})], { isAuthenticated: false });
    expect(api.fetchMyLeagueSummaries).not.toHaveBeenCalled();
    expect(screen.queryByText('Liga terminada')).not.toBeInTheDocument();
  });

  it('shares a summary without private data through the Web Share API', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    setNavigator('share', share);
    renderClosing([summary({})]);

    fireEvent.click(await screen.findByRole('button', { name: 'Compartir resultado' }));

    await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
    const shared = share.mock.calls[0][0];
    expect(shared.title).toBe('Final de Los Cracks');
    expect(shared.text).toBe(
      [
        '🏆 Ana gana «Los Cracks» (LaLiga)',
        '1.º Ana · 120 pts',
        '2.º Luis · 110 pts',
        '3.º Eva · 100 pts',
        'Yo: 4.º de 4 · 90 pts',
      ].join('\n'),
    );
    expect(shared.url).toBe(`${window.location.origin}/?group=10`);
    expect(JSON.stringify(shared)).not.toContain('@');
  });

  it('copies the summary with its link when the device cannot share', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    setNavigator('clipboard', { writeText });
    renderClosing([summary({})]);

    fireEvent.click(await screen.findByRole('button', { name: 'Compartir resultado' }));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Resumen copiado'));
    expect(writeText).toHaveBeenCalledWith(
      expect.stringMatching(/^🏆 Ana gana «Los Cracks»[\s\S]*\/\?group=10$/),
    );
  });

  it('does not copy anything when the user cancels the share sheet', async () => {
    const writeText = vi.fn();
    setNavigator('clipboard', { writeText });
    setNavigator('share', vi.fn().mockRejectedValue(new DOMException('Cancelado', 'AbortError')));
    renderClosing([summary({})]);

    fireEvent.click(await screen.findByRole('button', { name: 'Compartir resultado' }));

    await waitFor(() => expect(navigator.share).toHaveBeenCalled());
    expect(writeText).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('says so when the league ended and nobody scored', async () => {
    renderClosing([summary({})], {
      leaderboardData: players.map((player) => ({ ...player, total: 0 })),
    });

    const closing = await screen.findByRole('region', { name: 'Los Cracks ha terminado' });
    expect(within(closing).getByText('Nadie ha puntuado en esta liga.')).toBeInTheDocument();
  });
});
