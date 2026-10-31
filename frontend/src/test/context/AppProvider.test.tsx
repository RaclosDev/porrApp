import { render, screen, act, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { AppProvider, useAppContext } from '../../context/AppContext';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAppStore, defaultBracketState } from '../../store/useAppStore';

function ConsumerComponent() {
  const { allGames, nameToIdMap, officialPoints, groupOdds, leaderboardData } = useAppContext();
  return (
    <div>
      <span data-testid="games-count">
        {Array.isArray(allGames) ? allGames.length : 'not-array'}
      </span>
      <span data-testid="map-keys">{Object.keys(nameToIdMap).length}</span>
      <span data-testid="is-points-obj">{typeof officialPoints === 'object' ? 'yes' : 'no'}</span>
      <span data-testid="is-odds-obj">{typeof groupOdds === 'object' ? 'yes' : 'no'}</span>
      <span data-testid="is-leaderboard-arr">{Array.isArray(leaderboardData) ? 'yes' : 'no'}</span>
    </div>
  );
}

describe('AppProvider & useAppContext', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    localStorage.clear();
    useAppStore.setState({
      activeGroupId: '',
      userId: '',
      isDemoMode: false,
      bracketState: defaultBracketState,
    });
  });

  it('replaces a malformed JSON draft without crashing the persistence effect', async () => {
    localStorage.setItem('draft_bracket_u7_g42', JSON.stringify({ r32: {} }));
    useAppStore.setState({ activeGroupId: '42', userId: '7' });
    render(
      <QueryClientProvider client={queryClient}>
        <AppProvider>Ready</AppProvider>
      </QueryClientProvider>,
    );
    await waitFor(() =>
      expect(JSON.parse(localStorage.getItem('draft_bracket_u7_g42')!)).toEqual(
        defaultBracketState,
      ),
    );
    expect(screen.getByText('Ready')).toBeInTheDocument();
  });

  it('renders children without reference errors when unauthenticated', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <AppProvider>
          <div>App content rendered</div>
        </AppProvider>
      </QueryClientProvider>,
    );

    expect(screen.getByText('App content rendered')).toBeInTheDocument();
  });

  it('safely handles empty/uncached data and provides safe defaults without throwing', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <AppProvider>
          <ConsumerComponent />
        </AppProvider>
      </QueryClientProvider>,
    );

    expect(screen.getByTestId('games-count')).toHaveTextContent('0');
    expect(screen.getByTestId('map-keys')).toHaveTextContent('0');
    expect(screen.getByTestId('is-points-obj')).toHaveTextContent('yes');
    expect(screen.getByTestId('is-odds-obj')).toHaveTextContent('yes');
    expect(screen.getByTestId('is-leaderboard-arr')).toHaveTextContent('yes');
  });

  it('does not throw when activeCompetitionId changes and cache is empty', () => {
    const { rerender } = render(
      <QueryClientProvider client={queryClient}>
        <AppProvider>
          <ConsumerComponent />
        </AppProvider>
      </QueryClientProvider>,
    );

    act(() => {
      useAppStore.getState().setActiveCompetitionId(999);
    });

    rerender(
      <QueryClientProvider client={queryClient}>
        <AppProvider>
          <ConsumerComponent />
        </AppProvider>
      </QueryClientProvider>,
    );

    expect(screen.getByTestId('games-count')).toHaveTextContent('0');
  });
});
