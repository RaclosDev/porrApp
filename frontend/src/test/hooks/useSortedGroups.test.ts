import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useTournamentData } from '../../context/leagueData';
import { useSortedGroups } from '../../hooks/useSortedGroups';
import type { GroupOdds, GroupStandings } from '../../types/api';
import { standing } from '../fixtures';

vi.mock(import('../../context/leagueData'), async (original) => ({
  ...(await original()),
  useTournamentData: vi.fn(),
}));

const team = (name: string) => ({ name, win: null, qualify: null, outright: null });

const tournament = (groupOdds: GroupOdds | null, groupStandings: GroupStandings | null = null) =>
  vi
    .mocked(useTournamentData)
    .mockReturnValue({ groupOdds, groupStandings } as unknown as ReturnType<
      typeof useTournamentData
    >);

const sortedNames = (group: string) =>
  renderHook(() => useSortedGroups()).result.current[group].map((t) => t.name);

beforeEach(() => vi.clearAllMocks());

describe('useSortedGroups', () => {
  const odds: GroupOdds = {
    A: [team('Italia'), team('España'), team('Chile'), team('Japón')],
  };

  it('ordena por el puesto que da el servidor, que ya aplica todos los desempates', () => {
    tournament(odds, {
      A: {
        // Japón tiene más puntos, pero el servidor lo deja tercero.
        Japón: standing({ pos: 3, pts: 9 }),
        España: standing({ pos: 1, pts: 7 }),
        Italia: standing({ pos: 2, pts: 7 }),
        Chile: standing({ pos: 4, pts: 0 }),
      },
    });

    expect(sortedNames('A')).toEqual(['España', 'Italia', 'Japón', 'Chile']);
  });

  it('sin puesto ordena por puntos, diferencia de goles, goles y nombre', () => {
    tournament(odds, {
      A: {
        Italia: standing({ pts: 4, diff: 1, gls: 2 }),
        España: standing({ pts: 4, diff: 1, gls: 3 }),
        Chile: standing({ pts: 4, diff: 2, gls: 2 }),
        Japón: standing({ pts: 6, diff: 0, gls: 1 }),
      },
    });

    expect(sortedNames('A')).toEqual(['Japón', 'Chile', 'España', 'Italia']);
  });

  it('antes de jugarse nada deja los equipos por orden alfabético y a cero', () => {
    tournament(odds);

    const { result } = renderHook(() => useSortedGroups());

    expect(result.current.A.map((t) => t.name)).toEqual(['Chile', 'España', 'Italia', 'Japón']);
    expect(result.current.A[0].stats).toEqual(standing({}));
  });

  it('pone detrás de los clasificados a un equipo que aún no tiene puesto', () => {
    tournament(odds, {
      A: { Italia: standing({ pos: 1, pts: 3 }), Japón: standing({ pos: 2, pts: 1 }) },
    });

    expect(sortedNames('A')).toEqual(['Italia', 'Japón', 'Chile', 'España']);
  });

  it('encuentra las estadísticas de un equipo cuyo nombre lleva punto', () => {
    tournament(
      { B: [team('Austria'), team('Bosnia y Her.')] },
      { B: { 'Bosnia y Her': standing({ pos: 1, pts: 6 }), Austria: standing({ pos: 2 }) } },
    );

    const { result } = renderHook(() => useSortedGroups());

    expect(result.current.B[0]).toMatchObject({ name: 'Bosnia y Her.', stats: { pts: 6 } });
  });

  it('no devuelve grupos mientras no llegan los equipos, y tolera un grupo sin lista', () => {
    tournament(null);
    expect(renderHook(() => useSortedGroups()).result.current).toEqual({});

    tournament({ C: null } as unknown as GroupOdds);
    expect(renderHook(() => useSortedGroups()).result.current).toEqual({ C: [] });
  });
});
