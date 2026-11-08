import { describe, expect, it } from 'vitest';
import type { Competition } from '../../types/api';
import {
  SPORT_LABELS,
  buildCreateRequest,
  emptyDraft,
  formatCopy,
  formatUnavailableReason,
  lockModesFor,
  normalizeDraft,
  sportChoices,
  validateStep,
  type LeagueDraft,
} from '../../components/createLeague/leagueDraft';
import { scoringSections } from '../../utils/scoringRules';

const competitions: Competition[] = [
  { id: 1, name: 'LaLiga', externalId: 'esp.1', formatType: 'LEAGUE', sport: 'FOOTBALL' },
  { id: 9, name: 'UFC', externalId: 'mma.ufc', formatType: 'EVENTS', sport: 'MMA' },
];
const ctx = { competitions };

const ufcDraft = (patch: Partial<LeagueDraft> = {}) =>
  normalizeDraft(
    { ...emptyDraft(), sport: 'MMA', competitionId: 9, poolFormat: 'MATCH_DAY', ...patch },
    ctx,
  );

describe('liga de la UFC en el asistente', () => {
  it('aparece como deporte propio y se juega solo por veladas', () => {
    expect(sportChoices(ctx)).toEqual(['FOOTBALL', 'MMA', 'OTHER']);
    expect(SPORT_LABELS.MMA).toBe('UFC');
    // Sin el deporte del servidor también se reconoce por su id.
    expect(
      normalizeDraft(
        { ...emptyDraft(), competitionId: 9 },
        { competitions: [{ ...competitions[1], sport: undefined }] },
      ).sport,
    ).toBe('MMA');

    const draft = ufcDraft();
    expect(formatCopy('MATCH_DAY', draft, ctx).title).toBe('Por veladas');
    expect(formatUnavailableReason('MATCH_DAY', draft, ctx)).toBeNull();
    expect(formatUnavailableReason('SURVIVOR', draft, ctx)).toMatch(/velada a velada/);
    expect(formatUnavailableReason('FULL_BRACKET', draft, ctx)).toMatch(/velada a velada/);
    expect(ufcDraft({ poolFormat: 'SURVIVOR' }).poolFormat).toBeNull();
  });

  it('cierra por defecto toda la velada al empezar, o por bloques', () => {
    const draft = ufcDraft();
    expect(lockModesFor(draft, ctx).map((mode) => mode.value)).toEqual(['PER_ROUND', 'PER_MATCH']);
    expect(draft.lockMode).toBe('PER_ROUND');
  });

  it('cubre todas las veladas o una sola, que hay que elegir', () => {
    const all = ufcDraft();
    expect(validateStep('format', all, ctx)).toEqual({});
    expect(buildCreateRequest({ ...all, name: 'Veladas' }, ctx).matchSelection).toBeUndefined();

    const empty = ufcDraft({
      matches: { ...all.matches, mode: 'PICK', included: [] },
      matchesCompetitionId: 9,
    });
    expect(validateStep('format', empty, ctx)).toEqual({ matches: 'Elige una velada.' });

    const one = { ...empty, matches: { ...empty.matches, included: [11, 12] }, name: 'UFC 334' };
    expect(buildCreateRequest(one, ctx).matchSelection).toEqual({
      mode: 'CUSTOM',
      teamIds: [],
      includedMatchIds: [11, 12],
    });
  });

  it('puede seguir solo las veladas numeradas o solo las Fight Night', () => {
    const numbered = ufcDraft({ eventSeries: 'NUMBERED', name: 'Numeradas' });
    expect(buildCreateRequest(numbered, ctx).matchSelection).toEqual({
      mode: 'ALL',
      eventSeries: 'NUMBERED',
    });
    const fightNights = ufcDraft({ eventSeries: 'FIGHT_NIGHT', name: 'Fight Night' });
    expect(buildCreateRequest(fightNights, ctx).matchSelection).toEqual({
      mode: 'ALL',
      eventSeries: 'FIGHT_NIGHT',
    });
    // Una sola velada, u otra competición, no siguen ninguna serie.
    const single = ufcDraft({
      eventSeries: 'NUMBERED',
      matches: { ...numbered.matches, mode: 'PICK', included: [11] },
      matchesCompetitionId: 9,
    });
    expect(single.eventSeries).toBeNull();
    expect(
      normalizeDraft({ ...numbered, sport: 'FOOTBALL', competitionId: 1 }, ctx).eventSeries,
    ).toBeNull();
  });

  it('elige qué partes de la cartelera entran, con al menos una', () => {
    const whole = ufcDraft({ name: 'Veladas' });
    expect(whole.cardSegments).toEqual(['EARLY_PRELIMS', 'PRELIMS', 'MAIN']);
    // Con la velada completa no se manda nada: la liga queda como las de antes.
    expect(buildCreateRequest(whole, ctx).matchSelection).toBeUndefined();

    const mainCard = ufcDraft({ cardSegments: ['MAIN'], name: 'Estelar' });
    expect(buildCreateRequest(mainCard, ctx).matchSelection).toEqual({
      mode: 'ALL',
      cardSegments: ['MAIN'],
    });
    // Se mandan en el orden de la velada, se marquen como se marquen.
    const prelims = ufcDraft({
      cardSegments: ['MAIN', 'EARLY_PRELIMS'],
      eventSeries: 'NUMBERED',
      name: 'Numeradas',
    });
    expect(buildCreateRequest(prelims, ctx).matchSelection).toEqual({
      mode: 'ALL',
      eventSeries: 'NUMBERED',
      cardSegments: ['EARLY_PRELIMS', 'MAIN'],
    });
    const single = ufcDraft({
      cardSegments: ['PRELIMS'],
      matches: { ...whole.matches, mode: 'PICK', included: [11] },
      matchesCompetitionId: 9,
      name: 'UFC 334',
    });
    expect(buildCreateRequest(single, ctx).matchSelection).toMatchObject({
      mode: 'CUSTOM',
      includedMatchIds: [11],
      cardSegments: ['PRELIMS'],
    });

    expect(validateStep('format', ufcDraft({ cardSegments: [] }), ctx)).toEqual({
      cardSegments: 'Marca al menos una parte de la cartelera.',
    });
    // Fuera de la UFC vuelve a ser la velada completa.
    expect(
      normalizeDraft({ ...mainCard, sport: 'FOOTBALL', competitionId: 1 }, ctx).cardSegments,
    ).toHaveLength(3);
  });

  it('puntúa ganador, método y asalto en vez del 1X2', () => {
    expect(
      scoringSections('MATCH_DAY', false, false, false, false, null, true).map(
        (section) => section.id,
      ),
    ).toEqual(['fights']);
    expect(scoringSections('MATCH_DAY', false).map((section) => section.id)).toEqual(['matches']);
  });
});
