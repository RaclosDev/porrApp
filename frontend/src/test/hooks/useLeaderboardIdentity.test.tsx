import { renderHook } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { useLeaderboard } from '../../hooks/useLeaderboard';
import { useAppContext } from '../../context/AppContext';
import { appContext, participantScore } from '../context/fixtures';

vi.mock('../../context/AppContext', () => ({ useAppContext: vi.fn() }));

it('uses user ids for admin status and own matchday points despite duplicate names', () => {
  vi.mocked(useAppContext).mockReturnValue(
    appContext({
      userId: '2',
      userName: 'Ana',
      activeGroupAdminId: 1,
      activeGroupAdmin: 'Ana',
      leaderboardData: [
        participantScore({ id: 1, userId: 1, name: 'Ana', total: 20 }),
        participantScore({ id: 2, userId: 2, name: 'Ana', total: 5 }),
      ],
      leaderboardMatchdays: [
        {
          date: null,
          label: 'Jornada 1',
          current: true,
          finished: false,
          matchCount: 2,
          pointsByPrediction: { 1: 20, 2: 5 },
        },
      ],
    }),
  );
  const { result } = renderHook(() => useLeaderboard());
  expect(result.current.isLeagueAdmin).toBe(false);
  expect(result.current.matchdayStats?.myPoints).toBe(5);
});

it('does not infer administrator status from an absent id and a matching name', () => {
  vi.mocked(useAppContext).mockReturnValue(
    appContext({ userId: '2', userName: 'Ana', activeGroupAdminId: null, activeGroupAdmin: 'Ana' }),
  );
  const { result } = renderHook(() => useLeaderboard());
  expect(result.current.isLeagueAdmin).toBe(false);
});
