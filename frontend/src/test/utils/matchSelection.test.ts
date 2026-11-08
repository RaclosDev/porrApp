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
  toggleCompetition,
  toggleMatch,
  toggleTeam,
  addableCompetitions,
  describeCompetitions,
  mergeCalendar,
} from '../../components/matchSelection/matchSelection';
import type { Competition } from '../../types/api';
import { displayRoundLabel } from '../../utils/matchday';

const match = (id: number, home: number, away: number, patch: Partial<SelectableMatch> = {}) =>
  ({
    id,
    round: 'Jornada 1',
    competitionId: 1,
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
      fromView({
        mode: 'CUSTOM',
        teamIds: [],
        includedMatchIds: [2],
        excludedMatchIds: [],
        competitionIds: [1],
      }).mode,
    ).toBe('PICK');
    expect(
      fromView({
        mode: 'ALL',
        teamIds: [],
        includedMatchIds: [],
        excludedMatchIds: [],
        competitionIds: [1],
      }),
    ).toEqual({ ...ALL_MATCHES, competitionIds: [1] });
    const empty = { teamIds: [], included: [], excluded: [], competitionIds: [] };
    expect(selectionError({ ...empty, mode: 'TEAMS' })).toMatch('equipo');
    expect(selectionError({ ...empty, mode: 'PICK' })).toMatch('partido');
    expect(selectionError(ALL_MATCHES)).toBeNull();
  });

  it('un partido cerrado con predicciones se queda y se avisa de las que se borran', () => {
    const locked = match(4, 40, 50, { locked: true, closed: true, predictions: 2 });
    const value = {
      mode: 'PICK' as const,
      teamIds: [],
      included: [2],
      excluded: [],
      competitionIds: [],
    };
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
    const value = {
      mode: 'TEAMS' as const,
      teamIds: [10],
      included: [],
      excluded: [],
      competitionIds: [],
    };
    expect(
      describeSelection(value, [{ id: 10, name: 'Real Madrid', logoUrl: null }], calendar),
    ).toBe('De Real Madrid: 2 partidos');
    expect(describeSelection(ALL_MATCHES, [], calendar)).toBe('Todos los partidos');
  });
});

describe('varias competiciones', () => {
  const champions = match(7, 10, 80, { competitionId: 2, round: 'Semana 2026-11-02' });

  it('al juntar otra competición pasa a elegir a mano y se pide con todas', () => {
    const value = toggleCompetition(ALL_MATCHES, 1, 2, true, calendar);
    expect(value.mode).toBe('PICK');
    expect(value.competitionIds).toEqual([1, 2]);
    expect(switchMode(value, 'ALL', calendar)).toBe(value);
    expect(selectionError({ ...value, mode: 'ALL' })).toMatch('varias competiciones');

    const picked = toggleMatch(toggleMatch(value, calendar[1], true), champions, true);
    expect(toRequest(picked)).toEqual({
      mode: 'CUSTOM',
      teamIds: [],
      includedMatchIds: [2, 7],
      competitionIds: [1, 2],
    });
  });

  it('un equipo seguido aporta sus partidos de cada competición, y quitar una descarta lo suyo', () => {
    let value = toggleCompetition(ALL_MATCHES, 1, 2, true, calendar);
    value = toggleTeam(switchMode(value, 'TEAMS', calendar), 10, true);
    expect([...calendar, champions].filter((m) => isSelected(value, m)).map((m) => m.id)).toEqual([
      1, 2, 7,
    ]);
    value = toggleMatch(value, champions, false);
    expect(value.excluded).toEqual([7]);

    const single = toggleCompetition(value, 1, 2, false, [...calendar, champions]);
    expect(single.competitionIds).toEqual([1]);
    expect(single.excluded).toEqual([]);
    expect(isSelected(single, champions)).toBe(false);
    // Quitar una competición avisa de las predicciones de sus partidos abiertos.
    const saved = { ...champions, selected: true, predictions: 2 };
    expect(removedPredictions(single, [saved])).toBe(2);
  });

  it('ofrece competiciones oficiales del mismo deporte sin terminar', () => {
    const comp = (id: number, patch: Partial<Competition>): Competition => ({
      id,
      name: `C${id}`,
      externalId: `c.${id}`,
      formatType: 'LEAGUE',
      sport: 'FOOTBALL',
      finished: false,
      ...patch,
    });
    const all = [
      comp(1, {}),
      comp(2, {}),
      comp(3, { finished: true }),
      comp(4, { sport: 'LEAGUE_OF_LEGENDS' }),
      comp(5, { finished: true }),
    ];
    expect(addableCompetitions(all, 1, [1, 5]).map((item) => item.id)).toEqual([2, 5]);
    expect(describeCompetitions(['LaLiga', 'Champions', 'Premier'])).toBe(
      'LaLiga, Champions y Premier',
    );
  });

  it('mezcla el calendario nuevo con lo que el servidor sabe de cada partido', () => {
    const saved = [{ ...calendar[2], selected: true }];
    const fresh = [
      { ...calendar[2], round: 'Semana 2026-11-02', predictions: 0 },
      { ...champions, selected: true },
    ];
    expect(mergeCalendar(saved, fresh)).toEqual([
      { ...saved[0], round: 'Semana 2026-11-02' },
      { ...champions, selected: false, locked: false, predictions: 0 },
    ]);
  });

  it('muestra la semana por su lunes', () => {
    expect(displayRoundLabel('Semana 2026-11-02')).toBe('Semana del 2 nov');
  });
});
