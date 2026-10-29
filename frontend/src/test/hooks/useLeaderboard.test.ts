import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLeaderboard } from '../../hooks/useLeaderboard';
import * as AppContextModule from '../../context/AppContext';

vi.mock('../../context/AppContext', () => ({
  useAppContext: vi.fn(),
}));

describe('useLeaderboard hook', () => {
  const mockLeaderboardData = [
    {
      id: 1,
      userId: 10,
      name: 'Carlos',
      betName: 'Porra Carlos',
      total: 100,
      matchPoints: 40,
      pending: false,
    },
    {
      id: 2,
      userId: 20,
      name: 'Elena',
      betName: 'Porra Elena',
      total: 120,
      matchPoints: 50,
      pending: false,
    },
    {
      id: 3,
      userId: 30,
      name: 'Moroso',
      betName: 'Porra Moroso',
      total: 150,
      matchPoints: 60,
      pending: true, // No pagado
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    AppContextModule.useAppContext.mockReturnValue({
      leaderboardData: mockLeaderboardData,
      loading: false,
      activeGroupName: 'Liga Amigos',
      activeGroupId: 10,
      activeGroupPichichi: true,
      activeGroupPoolFormat: 'FULL_BRACKET',
      activeGroupBetMode: 'BRACKET',
      activeGroupAdminId: 10,
      userId: 10,
      userName: 'Carlos',
    });
  });

  it('ordena por total descendente y envía participantes pendientes de pago al final', () => {
    const { result } = renderHook(() => useLeaderboard());

    const { results } = result.current;
    expect(results).toHaveLength(3);

    // 1º Elena (120 pts, pagado)
    expect(results[0].name).toBe('Elena');
    expect(results[0].rank).toBe(1);
    expect(results[0].paid).toBe(true);

    // 2º Carlos (100 pts, pagado)
    expect(results[1].name).toBe('Carlos');
    expect(results[1].rank).toBe(2);
    expect(results[1].paid).toBe(true);

    // 3º Moroso (150 pts pero pending: true -> enviado al final sin rank)
    expect(results[2].name).toBe('Moroso');
    expect(results[2].paid).toBe(false);
  });

  it('permite cambiar la columna de ordenación', () => {
    const { result } = renderHook(() => useLeaderboard());

    act(() => {
      result.current.handleSort('matchPoints');
    });

    expect(result.current.sortColumn).toBe('matchPoints');
  });

  it('reconoce correctamente si el usuario activo es el administrador de la liga', () => {
    const { result } = renderHook(() => useLeaderboard());

    // activeGroupAdminId = 10, userId = 10 -> isLeagueAdmin = true
    expect(result.current.isLeagueAdmin).toBe(true);
  });

  it('carga los puntos de la jornada actual y permite navegar entre jornadas', () => {
    AppContextModule.useAppContext.mockReturnValue({
      leaderboardData: mockLeaderboardData,
      leaderboardMatchdays: [
        {
          label: 'Jornada 1',
          current: false,
          finished: true,
          matchCount: 2,
          pointsByPrediction: { 1: 1, 2: 2 },
        },
        {
          label: 'Jornada 2',
          current: true,
          finished: false,
          matchCount: 2,
          pointsByPrediction: { 1: 3, 2: 5 },
        },
      ],
      loading: false,
      activeGroupName: 'Liga Amigos',
      activeGroupId: 10,
      activeGroupPichichi: true,
      activeGroupPoolFormat: 'MATCH_DAY',
      activeGroupBetMode: 'MATCH_DAY',
      activeGroupAdminId: 10,
      userId: 10,
      userName: 'Carlos',
    });

    const { result } = renderHook(() => useLeaderboard());

    expect(result.current.selectedMatchday).toBe('Jornada 2');
    expect(result.current.matchdayStats.myPoints).toBe(3);
    expect(result.current.matchdayStats.leader.name).toBe('Elena');

    const carlos = result.current.results.find((row) => row.name === 'Carlos');
    expect(carlos.points.matchday).toBe(3);

    act(() => {
      result.current.handleStepMatchday(-1);
    });

    expect(result.current.selectedMatchday).toBe('Jornada 1');

    const carlosJornada1 = result.current.results.find((row) => row.name === 'Carlos');
    expect(carlosJornada1.points.matchday).toBe(1);
    const elenaJornada1 = result.current.results.find((row) => row.name === 'Elena');
    expect(elenaJornada1.points.matchday).toBe(2);
  });
});
