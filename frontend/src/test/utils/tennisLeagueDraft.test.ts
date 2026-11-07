import scoringRuleSet from '../../../../backend/src/main/java/com/porra/mundial/scoring/ScoringRuleSet.java?raw';
import { describe, expect, it } from 'vitest';
import type { Competition, TennisInfo } from '../../types/api';
import { defaultScoringRules, scoringSections, toDraft } from '../../utils/scoringRules';
import {
  buildCreateRequest,
  emptyDraft,
  formatUnavailableReason,
  normalizeDraft,
  sportChoices,
  tennisDrawChoices,
  type LeagueDraft,
} from '../../components/createLeague/leagueDraft';
import { tennisLoserSets, tennisPick, tennisPickedSign } from '../../utils/matchday';

const tennis = (id: number, info: Partial<TennisInfo>, finished = false): Competition => ({
  id,
  name: info.tournament ?? 'Torneo',
  externalId: `tennis.${info.draw === 'WOMEN' ? 'wta' : 'atp'}.${info.tournamentId}`,
  formatType: 'TOURNAMENT',
  sport: 'TENNIS',
  finished,
  tennis: {
    tournamentId: 172,
    tournament: 'Roland Garros',
    level: 'GRAND_SLAM',
    draw: 'MEN',
    setsToWin: 3,
    startDate: '2027-05-23T04:00:00Z',
    endDate: '2027-06-07T03:59:00Z',
    ...info,
  },
});

const ctx = {
  competitions: [
    { id: 1, name: 'LaLiga', externalId: 'esp.1', formatType: 'LEAGUE' as const },
    tennis(10, { tournamentId: 172, draw: 'MEN' }),
    tennis(11, { tournamentId: 172, draw: 'WOMEN', setsToWin: 2 }),
    tennis(12, { tournamentId: 13, tournament: 'Masters de París', level: 'MASTERS_1000' }),
    tennis(13, { tournamentId: 154, tournament: 'Open de Australia' }, true),
  ],
};

const draftWith = (patch: Partial<LeagueDraft>) =>
  normalizeDraft({ ...emptyDraft(), sport: 'TENNIS', ...patch }, ctx);

describe('liga de tenis', () => {
  it('es un deporte más y solo se juega partido a partido', () => {
    expect(sportChoices(ctx)).toEqual(['FOOTBALL', 'TENNIS', 'OTHER']);
    const draft = draftWith({ competitionId: 10 });
    expect(draft.poolFormat).toBe('MATCH_DAY');
    expect(formatUnavailableReason('SURVIVOR', draft, ctx)).toMatch(/partido a partido/);
    expect(formatUnavailableReason('KNOCKOUTS_ONLY', draft, ctx)).toMatch(/partido a partido/);
    expect(formatUnavailableReason('MATCH_DAY', draft, ctx)).toBeNull();
  });

  it('ofrece los dos cuadros solo si el torneo los tiene, y nunca uno terminado', () => {
    expect(tennisDrawChoices(ctx, 172)).toEqual(['MEN', 'WOMEN', 'BOTH']);
    expect(tennisDrawChoices(ctx, 13)).toEqual(['MEN']);
    expect(draftWith({ competitionId: 13 }).competitionId).toBeNull();
  });

  it('el cuadro femenino es su competición; con los dos, entra como segunda', () => {
    expect(draftWith({ competitionId: 10, tennisDraw: 'WOMEN' }).competitionId).toBe(11);

    const both = draftWith({ competitionId: 11, tennisDraw: 'BOTH', name: 'RG' });
    expect(both.competitionId).toBe(10);
    expect(buildCreateRequest(both, ctx).matchSelection).toEqual({
      mode: 'ALL',
      competitionIds: [10, 11],
    });
    expect(
      buildCreateRequest(draftWith({ competitionId: 10 }), ctx).matchSelection,
    ).toBeUndefined();

    // Un torneo sin cuadro femenino vuelve al masculino.
    expect(draftWith({ competitionId: 12, tennisDraw: 'BOTH' }).tennisDraw).toBe('MEN');
  });

  it('nace con la puntuación del tenis, la misma que el servidor, y no la manda si no cambia', () => {
    const draft = draftWith({ competitionId: 10 });
    expect(draft.scoring).toEqual(toDraft(defaultScoringRules('TENNIS')));
    expect(buildCreateRequest(draft, ctx).scoring).toBeUndefined();

    const method = /defaultTennis\(\) \{([\s\S]*?)\}/.exec(scoringRuleSet)?.[1] ?? '';
    const javaTennis = Object.fromEntries(
      [...method.matchAll(/\.(\w+)\((\d+)\)/g)].map(([, key, value]) => [key, Number(value)]),
    );
    expect(Object.keys(javaTennis).length).toBeGreaterThan(0);
    expect(defaultScoringRules('TENNIS')).toMatchObject(javaTennis);
  });

  it('puntúa por ronda y por sets', () => {
    const sections = scoringSections('MATCH_DAY', false, false, 'TENNIS');
    expect(sections.flatMap((section) => section.fields.map((field) => field.key))).toEqual([
      'roundOf16Points',
      'quarterFinalPoints',
      'semiFinalPoints',
      'championPoints',
      'exactScorePoints',
    ]);
  });
});

describe('pronóstico de tenis', () => {
  it('los sets posibles dependen de si es al mejor de tres o de cinco', () => {
    expect(tennisLoserSets(2)).toEqual([0, 1]);
    expect(tennisLoserSets(3)).toEqual([0, 1, 2]);
  });

  it('guarda los sets del lado de cada jugador y deduce el ganador', () => {
    expect(tennisPick('1', 3, 2)).toEqual({ homeScore: '3', awayScore: '2', sign: '1' });
    expect(tennisPick('2', 2, 0)).toEqual({ homeScore: '0', awayScore: '2', sign: '2' });
    expect(tennisPick('2', 2, null)).toEqual({ homeScore: '', awayScore: '', sign: '2' });
    expect(tennisPickedSign({ homeScore: '1', awayScore: '3', sign: '' })).toBe('2');
    expect(tennisPickedSign({ homeScore: '', awayScore: '', sign: 'X' })).toBeNull();
  });
});
