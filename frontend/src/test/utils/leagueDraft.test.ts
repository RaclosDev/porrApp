import scoringRuleSet from '../../../../backend/src/main/java/com/porra/mundial/scoring/ScoringRuleSet.java?raw';
import { afterEach, describe, expect, it } from 'vitest';
import type { Competition } from '../../types/api';
import { DEFAULT_SCORING_RULES, SCORING_MAX_POINTS } from '../../utils/scoringRules';
import {
  buildCreateRequest,
  competitionUnavailableReason,
  competitionsOfSport,
  sportChoices,
  emptyDraft,
  firstIncompleteStep,
  formatsForSport,
  formatUnavailableReason,
  formatCopy,
  lockModesFor,
  normalizeDraft,
  readStoredDraft,
  storeDraft,
  validateStep,
  type LeagueDraft,
} from '../../components/createLeague/leagueDraft';

const competition = (overrides: Partial<Competition>): Competition => ({
  id: 1,
  name: 'LaLiga',
  externalId: 'esp.1',
  formatType: 'LEAGUE',
  ...overrides,
});

const ctx = {
  competitions: [
    competition({}),
    competition({
      id: 2,
      name: 'Champions',
      externalId: 'uefa.champions',
      formatType: 'TOURNAMENT',
    }),
    competition({ id: 3, name: 'Mundial', externalId: 'fifa.world', formatType: 'TOURNAMENT' }),
    competition({
      id: 4,
      name: 'Worlds',
      externalId: 'lol.worlds',
      formatType: 'TOURNAMENT',
      sport: 'LEAGUE_OF_LEGENDS',
    }),
  ],
};

const draftWith = (patch: Partial<LeagueDraft>) =>
  normalizeDraft({ ...emptyDraft(), ...patch }, ctx);

const NOW = new Date('2026-11-07T12:00:00');

describe('borrador de liga', () => {
  afterEach(() => localStorage.clear());

  it('usa los mismos puntos por defecto y el mismo máximo que el servidor', () => {
    const javaDefaults = Object.fromEntries(
      [...scoringRuleSet.matchAll(/private int (\w+) = (\d+);/g)].map(([, key, value]) => [
        key,
        Number(value),
      ]),
    );
    expect(javaDefaults).toEqual(DEFAULT_SCORING_RULES);
    expect(scoringRuleSet).toContain(`MAX_POINTS = ${SCORING_MAX_POINTS};`);
  });

  it('la NFL es su propio deporte y se juega por semanas o superviviente', () => {
    const nfl = competition({ id: 9, name: 'NFL', externalId: 'nfl' });
    const nflCtx = { competitions: [...ctx.competitions, nfl] };
    expect(sportChoices(nflCtx)).toEqual([
      'FOOTBALL',
      'LEAGUE_OF_LEGENDS',
      'AMERICAN_FOOTBALL',
      'OTHER',
    ]);
    const draft = normalizeDraft({ ...emptyDraft(), competitionId: 9 }, nflCtx);
    expect(draft.sport).toBe('AMERICAN_FOOTBALL');
    expect(formatCopy('MATCH_DAY', draft, nflCtx).title).toBe('Por semanas');
    expect(formatUnavailableReason('SURVIVOR', draft, nflCtx)).toBeNull();
    expect(formatUnavailableReason('FULL_BRACKET', draft, nflCtx)).not.toBeNull();
  });

  it('el LoL se explica con series, sin 1X2 ni empate', () => {
    const lol = draftWith({ competitionId: 4 });
    expect(formatCopy('MATCH_DAY', lol, ctx).text).toContain('el resultado (2-1, 3-0…)');
    expect(formatCopy('MATCH_DAY', lol, ctx).text).not.toContain('X');
    expect(formatCopy('SURVIVOR', lol, ctx).text).not.toContain('empate');
  });

  it('agrupa por deporte y deja coherente la competición al cambiarlo', () => {
    expect(sportChoices(ctx)).toEqual(['FOOTBALL', 'LEAGUE_OF_LEGENDS', 'OTHER']);
    expect(competitionsOfSport(ctx, 'LEAGUE_OF_LEGENDS').map((item) => item.name)).toEqual([
      'Worlds',
    ]);
    // Un borrador de antes de este paso toma el deporte de su competición.
    expect(draftWith({ competitionId: 4 }).sport).toBe('LEAGUE_OF_LEGENDS');
    expect(validateStep('sport', emptyDraft(), ctx)).toHaveProperty('sport');
    const football = draftWith({ competitionId: 2, poolFormat: 'FULL_BRACKET', pichichi: true });
    expect(
      normalizeDraft({ ...football, sport: 'LEAGUE_OF_LEGENDS' }, ctx).competitionId,
    ).toBeNull();
    const other = normalizeDraft({ ...football, sport: 'OTHER' }, ctx);
    expect(other.custom).toBe(true);
    expect(other.competitionId).toBeNull();
    // El pichichi es cosa del fútbol.
    const worlds = draftWith({ competitionId: 4, poolFormat: 'FULL_BRACKET', pichichi: true });
    expect(worlds.pichichi).toBe(false);
  });

  it('no ofrece superviviente sin competición oficial ni cuadros en una liga regular', () => {
    expect(formatUnavailableReason('SURVIVOR', draftWith({ custom: true }), ctx)).toMatch(
      /oficial/,
    );
    expect(formatUnavailableReason('FULL_BRACKET', draftWith({ competitionId: 1 }), ctx)).toMatch(
      /no tiene cuadro/,
    );
    expect(
      formatUnavailableReason('FULL_BRACKET', draftWith({ competitionId: 2 }), ctx),
    ).toBeNull();
  });

  it('no ofrece un cuadro cuyas eliminatorias ya han empezado y lo cambia por jornadas', () => {
    const started = {
      competitions: [
        competition({
          id: 4,
          name: 'Worlds',
          externalId: 'lol.worlds',
          formatType: 'TOURNAMENT',
          sport: 'LEAGUE_OF_LEGENDS',
          groupStage: true,
          bracketClosesAt: {
            KNOCKOUTS_ONLY: '2020-10-29T08:00:00Z',
            FULL_BRACKET: '2020-10-10T08:00:00Z',
          },
        }),
      ],
    };
    const draft = { ...emptyDraft(), sport: 'LEAGUE_OF_LEGENDS' as const, competitionId: 4 };
    expect(formatUnavailableReason('KNOCKOUTS_ONLY', draft, started)).toMatch(
      /eliminatorias ya han empezado/,
    );
    expect(formatUnavailableReason('FULL_BRACKET', draft, started)).toMatch(/ya ha empezado/);
    expect(formatUnavailableReason('MATCH_DAY', draft, started)).toBeNull();
    expect(normalizeDraft({ ...draft, poolFormat: 'KNOCKOUTS_ONLY' }, started).poolFormat).not.toBe(
      'KNOCKOUTS_ONLY',
    );

    const later = {
      competitions: [
        { ...started.competitions[0], bracketClosesAt: { KNOCKOUTS_ONLY: '2999-01-01T00:00:00Z' } },
      ],
    };
    expect(formatUnavailableReason('KNOCKOUTS_ONLY', draft, later)).toBeNull();
  });

  it('con fecha fija, el cierre de un cuadro oficial tiene que ser antes de su primer cruce', () => {
    const worlds = {
      competitions: [
        competition({
          id: 4,
          name: 'Worlds',
          externalId: 'lol.worlds',
          formatType: 'TOURNAMENT',
          sport: 'LEAGUE_OF_LEGENDS',
          bracketClosesAt: { KNOCKOUTS_ONLY: '2099-11-03T22:00:00Z' },
        }),
      ],
    };
    const draft = {
      ...emptyDraft(),
      sport: 'LEAGUE_OF_LEGENDS' as const,
      competitionId: 4,
      poolFormat: 'KNOCKOUTS_ONLY' as const,
      lockMode: 'FIXED_DATE' as const,
    };
    expect(
      validateStep('rules', { ...draft, lockDate: '2099-11-04T10:00' }, worlds, NOW).lockDate,
    ).toMatch(/antes del primer cruce \(3 nov/);
    expect(
      validateStep('rules', { ...draft, lockDate: '2099-11-03T20:00' }, worlds, NOW).lockDate,
    ).toBeUndefined();
  });

  it('al cambiar de competición quita el formato y el pichichi que ya no encajan', () => {
    // El pichichi se juega con los goleadores del Mundial: solo en su cuadro.
    const tournament = draftWith({
      competitionId: 3,
      poolFormat: 'KNOCKOUTS_ONLY',
      pichichi: true,
    });
    expect(
      draftWith({ competitionId: 2, poolFormat: 'KNOCKOUTS_ONLY', pichichi: true }).pichichi,
    ).toBe(false);
    expect(tournament.pichichi).toBe(true);
    const custom = normalizeDraft({ ...tournament, custom: true }, ctx);
    expect(custom.competitionId).toBeNull();
    expect(custom.pichichi).toBe(false);
    expect(normalizeDraft({ ...tournament, competitionId: 1 }, ctx).poolFormat).toBeNull();
  });

  it('propone un cierre que encaja con cada formato', () => {
    expect(draftWith({ competitionId: 1, poolFormat: 'MATCH_DAY' }).lockMode).toBe('PER_MATCH');
    expect(draftWith({ competitionId: 2, poolFormat: 'FULL_BRACKET' }).lockMode).toBe('PER_ROUND');
    // El Mundial no tiene cuadro propio: solo cierra todo a la vez.
    const worldCup = draftWith({ competitionId: 3, poolFormat: 'FULL_BRACKET' });
    expect(worldCup.lockMode).toBe('FIRST_MATCH');
    expect(lockModesFor(worldCup, ctx).map((mode) => mode.value)).toEqual([
      'FIXED_DATE',
      'FIRST_MATCH',
    ]);
    // Superviviente se pronostica partido a partido: se cierra como una liga por jornadas.
    const survivor = draftWith({ competitionId: 1, poolFormat: 'SURVIVOR' });
    expect(survivor.lockMode).toBe('PER_MATCH');
    expect(lockModesFor(survivor, ctx).map((mode) => mode.value)).toEqual([
      'PER_MATCH',
      'PER_DAY',
      'PER_ROUND',
    ]);
    // Con varias competiciones la jornada es la semana.
    const multi = draftWith({ competitionId: 1, poolFormat: 'MATCH_DAY' });
    const weekly = lockModesFor(
      { ...multi, matches: { ...multi.matches, competitionIds: [1, 2] } },
      ctx,
    );
    expect(weekly.find((mode) => mode.value === 'PER_ROUND')?.label).toBe('Por semanas');
    expect(lockModesFor(multi, ctx).find((mode) => mode.value === 'PER_ROUND')?.label).toBe(
      'Por jornadas',
    );
  });

  it('no deja elegir una competición terminada ni un cuadro completo sin grupos', () => {
    const withData = {
      competitions: [
        competition({
          id: 5,
          name: 'Mundial',
          externalId: 'fifa.world',
          formatType: 'TOURNAMENT',
          finished: true,
          groupStage: true,
        }),
        competition({
          id: 6,
          name: 'Copa',
          externalId: 'esp.copa_del_rey',
          formatType: 'TOURNAMENT',
          groupStage: false,
        }),
        competition({
          id: 7,
          name: 'Libertadores',
          externalId: 'conmebol.libertadores',
          formatType: 'TOURNAMENT',
          groupStage: null,
        }),
      ],
    };
    expect(competitionUnavailableReason(withData.competitions[0])).toMatch(/terminado/);
    // Las terminadas no se ofrecen: ni en su deporte ni como deporte si no queda ninguna abierta.
    expect(competitionsOfSport(withData, 'FOOTBALL').map((item) => item.id)).toEqual([6, 7]);
    expect(
      sportChoices({ competitions: [{ ...withData.competitions[0], sport: 'FOOTBALL' }] }),
    ).toEqual(['OTHER']);
    expect(
      normalizeDraft({ ...emptyDraft(), sport: 'FOOTBALL', competitionId: 5 }, withData)
        .competitionId,
    ).toBeNull();
    const copa = normalizeDraft({ ...emptyDraft(), sport: 'FOOTBALL', competitionId: 6 }, withData);
    expect(formatUnavailableReason('FULL_BRACKET', copa, withData)).toMatch(/fase de grupos/);
    expect(formatUnavailableReason('KNOCKOUTS_ONLY', copa, withData)).toBeNull();
    // Sin partidos importados aún no se sabe: se deja elegir.
    const libertadores = normalizeDraft(
      { ...emptyDraft(), sport: 'FOOTBALL', competitionId: 7 },
      withData,
    );
    expect(formatUnavailableReason('FULL_BRACKET', libertadores, withData)).toBeNull();
  });

  it('valida cada paso y no deja pasar de uno con algo pendiente', () => {
    expect(validateStep('competition', emptyDraft(), ctx)).toHaveProperty('competition');
    expect(validateStep('competition', draftWith({ custom: true }), ctx)).toHaveProperty(
      'customName',
    );
    const fixed = draftWith({
      competitionId: 2,
      poolFormat: 'FULL_BRACKET',
      lockMode: 'FIXED_DATE',
    });
    expect(
      validateStep('rules', { ...fixed, lockDate: '2026-11-01T10:00' }, ctx, NOW),
    ).toHaveProperty('lockDate');
    expect(validateStep('rules', { ...fixed, lockDate: '2026-12-01T20:00' }, ctx, NOW)).toEqual({});
    const matchday = draftWith({ competitionId: 1, poolFormat: 'MATCH_DAY' });
    expect(
      validateStep('rules', { ...matchday, lockAmount: '31', lockUnit: 'days' }, ctx),
    ).toHaveProperty('lockAmount');
    expect(
      validateStep(
        'rules',
        {
          ...matchday,
          customScoring: true,
          scoring: { ...matchday.scoring, correctSignPoints: '-1' },
        },
        ctx,
      ),
    ).toHaveProperty('scoring');
    expect(firstIncompleteStep(matchday, ctx)).toBe(4);
    expect(firstIncompleteStep({ ...matchday, name: 'Amigos' }, ctx)).toBe(5);
  });

  it('envía solo los ajustes que cambian algo', () => {
    const plain = draftWith({ competitionId: 1, poolFormat: 'MATCH_DAY', name: '  Amigos  ' });
    expect(buildCreateRequest(plain, ctx)).toEqual({
      name: 'Amigos',
      competitionId: 1,
      poolFormat: 'MATCH_DAY',
      pichichi: false,
      lockMode: 'PER_MATCH',
      lockOffsetMinutes: 0,
    });

    const configured = draftWith({
      custom: true,
      customName: ' Torneo del barrio ',
      poolFormat: 'KNOCKOUTS_ONLY',
      lockMode: 'FIXED_DATE',
      lockDate: '2026-12-01T20:00',
      customScoring: true,
      scoring: { ...plain.scoring, championPoints: '300' },
      entryFee: true,
      name: 'Barrio',
      rules: ' 10 € por Bizum ',
    });
    expect(buildCreateRequest(configured, ctx)).toEqual({
      name: 'Barrio',
      competitionId: null,
      customCompetitionName: 'Torneo del barrio',
      poolFormat: 'KNOCKOUTS_ONLY',
      pichichi: false,
      rules: '10 € por Bizum',
      entryFee: true,
      scoring: { ...DEFAULT_SCORING_RULES, championPoints: 300 },
      lockMode: 'FIXED_DATE',
      lockDate: '2026-12-01T20:00',
    });

    // Personalizar sin cambiar ningún valor no manda puntuación.
    expect(buildCreateRequest({ ...plain, customScoring: true }, ctx)).not.toHaveProperty(
      'scoring',
    );
  });

  it('recupera el borrador guardado y descarta uno roto', () => {
    const draft = draftWith({ competitionId: 2, poolFormat: 'FULL_BRACKET', name: 'Oficina' });
    storeDraft(draft);
    expect(readStoredDraft()).toEqual(draft);

    localStorage.setItem('createLeagueDraft', '{roto');
    expect(readStoredDraft()).toEqual(emptyDraft());
    localStorage.setItem('createLeagueDraft', JSON.stringify({ poolFormat: 'OTRO', name: 7 }));
    expect(readStoredDraft()).toEqual(emptyDraft());
  });

  it('elige partidos solo por jornadas en una oficial y los olvida al cambiar de competición', () => {
    const teams = {
      mode: 'TEAMS' as const,
      teamIds: [7],
      included: [],
      excluded: [31],
      competitionIds: [],
    };
    const draft = draftWith({ sport: 'FOOTBALL', competitionId: 1, poolFormat: 'MATCH_DAY' });
    const picked = normalizeDraft({ ...draft, matches: teams }, ctx);
    expect(picked.matches).toEqual(teams);
    expect(buildCreateRequest({ ...picked, name: 'Peña' }, ctx).matchSelection).toEqual({
      mode: 'CUSTOM',
      teamIds: [7],
      includedMatchIds: [],
      excludedMatchIds: [31],
    });

    // Sin equipos no se puede seguir; con todos los partidos no se manda nada.
    expect(
      validateStep('format', { ...picked, matches: { ...teams, teamIds: [] } }, ctx),
    ).toHaveProperty('matches', 'Elige al menos un equipo.');
    expect(buildCreateRequest({ ...draft, name: 'Peña' }, ctx)).not.toHaveProperty(
      'matchSelection',
    );

    // Otra competición o superviviente: vuelven a entrar todos.
    expect(normalizeDraft({ ...picked, competitionId: 2 }, ctx).matches.mode).toBe('ALL');
    expect(normalizeDraft({ ...picked, poolFormat: 'SURVIVOR' }, ctx).matches.mode).toBe('ALL');
  });

  it('la Fórmula 1 solo se juega por Grandes Premios y se cierra sola en cada clasificación', () => {
    const f1 = competition({
      id: 9,
      name: 'Fórmula 1',
      externalId: 'f1',
      formatType: 'RACE',
      sport: 'FORMULA_1',
    });
    const withF1 = { competitions: [...ctx.competitions, f1] };
    expect(sportChoices(withF1)).toEqual(['FOOTBALL', 'LEAGUE_OF_LEGENDS', 'FORMULA_1', 'OTHER']);
    expect(formatsForSport('FORMULA_1')).toEqual(['GRAND_PRIX']);
    expect(formatsForSport('FOOTBALL')).not.toContain('GRAND_PRIX');

    // Un solo modo posible: queda elegido, sin cierre que configurar.
    const draft = normalizeDraft({ ...emptyDraft(), sport: 'FORMULA_1', competitionId: 9 }, withF1);
    expect(draft.poolFormat).toBe('GRAND_PRIX');
    expect(lockModesFor(draft, withF1)).toEqual([]);
    expect(draft.lockMode).toBeNull();
    expect(formatUnavailableReason('MATCH_DAY', draft, withF1)).toMatch(/Gran Premio/);
    const laLiga = normalizeDraft({ ...emptyDraft(), sport: 'FOOTBALL', competitionId: 1 }, withF1);
    expect(formatUnavailableReason('GRAND_PRIX', laLiga, withF1)).toMatch(/Fórmula 1/);

    const ready = { ...draft, name: 'Paddock' };
    expect(validateStep('rules', ready, withF1, NOW)).toEqual({});
    expect(buildCreateRequest(ready, withF1)).toEqual({
      name: 'Paddock',
      competitionId: 9,
      poolFormat: 'GRAND_PRIX',
      pichichi: false,
    });

    // El borrador guardado conserva el deporte.
    storeDraft(ready);
    expect(readStoredDraft().sport).toBe('FORMULA_1');
    expect(readStoredDraft().poolFormat).toBe('GRAND_PRIX');
  });
});

describe('borrador de liga de la NFL', () => {
  const nflCtx = {
    competitions: [
      competition({ id: 14, name: 'NFL', externalId: 'nfl', sport: 'AMERICAN_FOOTBALL' }),
    ],
  };
  const nflDraft = (patch: Partial<LeagueDraft>) =>
    normalizeDraft(
      { ...emptyDraft(), sport: 'AMERICAN_FOOTBALL', competitionId: 14, ...patch },
      nflCtx,
    );

  it('cierra por semanas, del jueves al lunes, y no por jornadas', () => {
    const weekly = lockModesFor(nflDraft({ poolFormat: 'MATCH_DAY' }), nflCtx).find(
      (mode) => mode.value === 'PER_ROUND',
    );
    expect(weekly?.label).toBe('Por semanas');
    expect(weekly?.hint).toMatch(/del jueves al lunes/);
  });

  it('explica que los playoffs ya van dentro de Por semanas', () => {
    const draft = nflDraft({ poolFormat: 'MATCH_DAY' });
    expect(formatUnavailableReason('KNOCKOUTS_ONLY', draft, nflCtx)).toMatch(/Super Bowl/);
    expect(formatUnavailableReason('FULL_BRACKET', draft, nflCtx)).toMatch(/Super Bowl/);
    expect(formatUnavailableReason('SURVIVOR', draft, nflCtx)).toBeNull();
  });
});
