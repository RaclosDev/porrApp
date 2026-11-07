import scoringRuleSet from '../../../../backend/src/main/java/com/porra/mundial/scoring/ScoringRuleSet.java?raw';
import { afterEach, describe, expect, it } from 'vitest';
import type { Competition } from '../../types/api';
import { DEFAULT_SCORING_RULES, SCORING_MAX_POINTS } from '../../utils/scoringRules';
import {
  buildCreateRequest,
  emptyDraft,
  firstIncompleteStep,
  formatUnavailableReason,
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
  ],
};

const draftWith = (patch: Partial<LeagueDraft>) =>
  normalizeDraft({ ...emptyDraft(), ...patch }, ctx);

const NOW = new Date('2026-11-07T12:00:00');

describe('borrador de liga', () => {
  afterEach(() => localStorage.clear());

  it('usa los mismos puntos por defecto y el mismo mÃ¡ximo que el servidor', () => {
    const javaDefaults = Object.fromEntries(
      [...scoringRuleSet.matchAll(/private int (\w+) = (\d+);/g)].map(([, key, value]) => [
        key,
        Number(value),
      ]),
    );
    expect(javaDefaults).toEqual(DEFAULT_SCORING_RULES);
    expect(scoringRuleSet).toContain(`MAX_POINTS = ${SCORING_MAX_POINTS};`);
  });

  it('no ofrece superviviente sin competiciÃ³n oficial ni cuadros en una liga regular', () => {
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

  it('al cambiar de competiciÃ³n quita el formato y el pichichi que ya no encajan', () => {
    const tournament = draftWith({
      competitionId: 2,
      poolFormat: 'KNOCKOUTS_ONLY',
      pichichi: true,
    });
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
    expect(draftWith({ competitionId: 1, poolFormat: 'SURVIVOR' }).lockMode).toBeNull();
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
    expect(firstIncompleteStep(matchday, ctx)).toBe(3);
    expect(firstIncompleteStep({ ...matchday, name: 'Amigos' }, ctx)).toBe(4);
  });

  it('envÃ­a solo los ajustes que cambian algo', () => {
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
      rules: ' 10 â‚¬ por Bizum ',
    });
    expect(buildCreateRequest(configured, ctx)).toEqual({
      name: 'Barrio',
      competitionId: null,
      customCompetitionName: 'Torneo del barrio',
      poolFormat: 'KNOCKOUTS_ONLY',
      pichichi: false,
      rules: '10 â‚¬ por Bizum',
      entryFee: true,
      scoring: { ...DEFAULT_SCORING_RULES, championPoints: 300 },
      lockMode: 'FIXED_DATE',
      lockDate: '2026-12-01T20:00',
    });

    // Personalizar sin cambiar ningÃºn valor no manda puntuaciÃ³n.
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
});
