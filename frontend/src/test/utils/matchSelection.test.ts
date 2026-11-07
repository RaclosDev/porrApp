import { describe, expect, it } from 'vitest';
import type { SelectableMatch } from '../../types/api';
import {
  ALL_MATCHES,
  describeSelection,
  fromView,
  groupByRound,
  isSelected,
  matchesQuery,
  removedPredictions,
  selectionError,
  switchMode,
  toRequest,
  toggleMatch,
  toggleTeam,
} from '../../components/matchSelection/matchSelection';

const match = (id: number, home: number, away: number, patch: Partial<SelectableMatch> = {}) =>
  ({
    id,
    round: 'Jornada 1',
    date: '2026-11-08T21:00:00+01:00',
    homeTeamId: home,
    home: `Equipo ${home}`,
    homeLogo: null,
    awayTeamId: away,
    away: `Equipo ${away}`,
    awayLogo: null,
    homeScore: null,
    awayScore: null,
    selected: true,
    closed: false,
    locked: false,
    predictions: 0,
    ...patch,
  }) satisfies SelectableMatch;

const calendar = [
  match(1, 10, 20, { closed: true, round: 'Jornada 1' }),
  match(2, 30, 10, { round: 'Jornada 2' }),
  match(3, 20, 30, { round: 'Jornada 2', predictions: 4 }),
];

describe('selección de partidos', () => {
  it('con equipos entran sus partidos y se pueden quitar o añadir a mano', () => {
    let value = toggleTeam(switchMode(ALL_MATCHES, 'TEAMS', calendar), 10, true);
    expect(calendar.filter((m) => isSelected(value, m)).map((m) => m.id)).toEqual([1, 2]);

    value = toggleMatch(value, calendar[1], false);
    value = toggleMatch(value, calendar[2], true);
    expect(calendar.filter((m) => isSelected(value, m)).map((m) => m.id)).toEqual([1, 3]);
    expect(toRequest(value, calendar)).toEqual({
      mode: 'CUSTOM',
      teamIds: [10],
      includedMatchIds: [3],
      excludedMatchIds: [2],
    });

    // Al pasar a elegir a mano se conservan los que ya entraban.
    const picked = switchMode(value, 'PICK', calendar);
    expect(picked.included).toEqual([1, 3]);
    expect(toRequest(picked)).toEqual({ mode: 'CUSTOM', teamIds: [], includedMatchIds: [1, 3] });
  });

  it('lee lo guardado y no deja guardar una selección vacía', () => {
    expect(
      fromView({ mode: 'CUSTOM', teamIds: [], includedMatchIds: [2], excludedMatchIds: [] }).mode,
    ).toBe('PICK');
    expect(fromView({ mode: 'ALL', teamIds: [], includedMatchIds: [], excludedMatchIds: [] })).toBe(
      ALL_MATCHES,
    );
    expect(selectionError({ mode: 'TEAMS', teamIds: [], included: [], excluded: [] })).toMatch(
      'equipo',
    );
    expect(selectionError({ mode: 'PICK', teamIds: [], included: [], excluded: [] })).toMatch(
      'partido',
    );
    expect(selectionError(ALL_MATCHES)).toBeNull();
  });

  it('un partido cerrado con predicciones se queda y se avisa de las que se borran', () => {
    const locked = match(4, 40, 50, { locked: true, closed: true, predictions: 2 });
    const value = { mode: 'PICK' as const, teamIds: [], included: [2], excluded: [] };
    expect(isSelected(value, locked)).toBe(true);
    // Quitar el 3 (abierto, 4 predicciones) las borra; el 4 está cerrado y no cuenta.
    expect(removedPredictions(value, [...calendar, locked])).toBe(4);
  });

  it('agrupa por jornada, busca sin tildes y resume lo elegido', () => {
    expect(groupByRound(calendar).map((g) => [g.round, g.matches.length, g.closed])).toEqual([
      ['Jornada 1', 1, true],
      ['Jornada 2', 2, false],
    ]);
    const atletico = match(5, 60, 70, { home: 'Atlético' });
    expect(matchesQuery(atletico, 'atletico')).toBe(true);
    expect(matchesQuery(atletico, 'betis')).toBe(false);
    const value = { mode: 'TEAMS' as const, teamIds: [10], included: [], excluded: [] };
    expect(
      describeSelection(value, [{ id: 10, name: 'Real Madrid', logoUrl: null }], calendar),
    ).toBe('De Real Madrid: 2 partidos');
    expect(describeSelection(ALL_MATCHES, [], calendar)).toBe('Todos los partidos');
  });
});
