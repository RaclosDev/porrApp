import { describe, expect, it } from 'vitest';
import type { Competition, TennisInfo } from '../../types/api';
import {
  buildCreateRequest,
  emptyDraft,
  normalizeDraft,
  readStoredDraft,
  tennisScopeCompetitions,
  tennisScopeDrawChoices,
  type LeagueDraft,
} from '../../components/createLeague/leagueDraft';
import { competitionLabel } from '../../utils/poolFormat';

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
    tennis(10, { tournamentId: 172, draw: 'MEN' }),
    tennis(11, { tournamentId: 172, draw: 'WOMEN', setsToWin: 2 }),
    tennis(12, {
      tournamentId: 13,
      tournament: 'Masters de París',
      level: 'MASTERS_1000',
      startDate: '2026-11-02T10:00:00Z',
    }),
    tennis(14, {
      tournamentId: 339,
      tournament: 'ATP Finals',
      level: 'FINALS',
      startDate: '2026-11-15T10:00:00Z',
    }),
    tennis(
      13,
      { tournamentId: 154, tournament: 'Open de Australia', startDate: '2026-01-18T00:00:00Z' },
      true,
    ),
    tennis(15, {
      tournamentId: 154,
      tournament: 'Open de Australia',
      startDate: '2027-01-17T00:00:00Z',
      draw: 'WOMEN',
    }),
  ],
};

const draftWith = (patch: Partial<LeagueDraft>) =>
  normalizeDraft({ ...emptyDraft(), sport: 'TENNIS', name: 'Temporada', ...patch }, ctx);

describe('liga de tenis de varios torneos', () => {
  it('toma como principal el próximo torneo del alcance y deja los terminados al final', () => {
    expect(tennisScopeCompetitions(ctx, 'ALL', 'MEN').map((item) => item.id)).toEqual([
      12, 14, 10, 13,
    ]);
    expect(tennisScopeCompetitions(ctx, 'GRAND_SLAMS', 'WOMEN').map((item) => item.id)).toEqual([
      15, 11,
    ]);
    expect(draftWith({ tennisScope: 'GRAND_SLAMS' }).competitionId).toBe(10);
    expect(draftWith({ tennisScope: 'MASTERS_1000' }).competitionId).toBe(12);
    expect(draftWith({ tennisScope: 'GRAND_SLAMS', tennisDraw: 'WOMEN' }).competitionId).toBe(15);
    expect(draftWith({ tennisScope: 'ALL' }).poolFormat).toBe('MATCH_DAY');
  });

  it('ofrece los cuadros femeninos solo si algún torneo del alcance los tiene', () => {
    expect(tennisScopeDrawChoices(ctx, 'GRAND_SLAMS')).toEqual(['MEN', 'WOMEN', 'BOTH']);
    expect(tennisScopeDrawChoices(ctx, 'MASTERS_1000')).toEqual(['MEN']);
    expect(draftWith({ tennisScope: 'MASTERS_1000', tennisDraw: 'BOTH' }).tennisDraw).toBe('MEN');
  });

  it('pide el alcance y el circuito en vez de los dos cuadros de un torneo', () => {
    const both = draftWith({ tennisScope: 'GRAND_SLAMS', tennisDraw: 'BOTH' });
    expect(buildCreateRequest(both, ctx)).toMatchObject({
      competitionId: 10,
      poolFormat: 'MATCH_DAY',
      matchSelection: { mode: 'ALL', tennisScope: 'GRAND_SLAMS', tennisTour: 'BOTH' },
    });
    const wta = draftWith({ tennisScope: 'ALL', tennisDraw: 'WOMEN' });
    expect(buildCreateRequest(wta, ctx).matchSelection).toEqual({
      mode: 'ALL',
      tennisScope: 'ALL',
      tennisTour: 'WTA',
    });
    // Un torneo, como hasta ahora.
    const single = draftWith({ competitionId: 10, tennisDraw: 'BOTH' });
    expect(buildCreateRequest(single, ctx).matchSelection).toEqual({
      mode: 'ALL',
      competitionIds: [10, 11],
    });
  });

  it('en tenis no hay competición personalizada y otro deporte no sigue torneos', () => {
    // Un borrador guardado con la competición propia vuelve a los torneos de tenis.
    expect(draftWith({ tennisScope: 'ALL', custom: true })).toMatchObject({
      custom: false,
      tennisScope: 'ALL',
    });
    expect(
      normalizeDraft({ ...emptyDraft(), sport: 'FOOTBALL', tennisScope: 'ALL' }, ctx).tennisScope,
    ).toBeNull();
  });

  it('se guarda en el borrador y nombra la liga por sus torneos', () => {
    localStorage.setItem(
      'createLeagueDraft',
      JSON.stringify({ ...emptyDraft(), tennisScope: 'GRAND_SLAMS' }),
    );
    expect(readStoredDraft().tennisScope).toBe('GRAND_SLAMS');
    localStorage.clear();
    expect(
      competitionLabel({
        competitionName: 'Roland Garros',
        multiCompetition: true,
        tennisScope: 'GRAND_SLAMS',
      }),
    ).toBe('Tenis: Grand Slams');
    expect(competitionLabel({ competitionName: 'Roland Garros', multiCompetition: true })).toBe(
      'Varias competiciones',
    );
  });
});
