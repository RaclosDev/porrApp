import { describe, expect, it } from 'vitest';
import { matchdayFixture } from '../context/fixtures';
import type { FightInfo } from '../../types/api';
import {
  boutBilling,
  judgesScoresText,
  titleLabel,
  fightMethodText,
  fightOutcomes,
  fightResultParts,
  fightResultText,
  methodRoundText,
  weightClassLabel,
} from '../../utils/fights';
import {
  buildSubmission,
  mergeDraftWithServer,
  sortFightCard,
  withFightPick,
  withoutSaved,
} from '../../utils/matchday';

const fight = (overrides: Partial<FightInfo> = {}): FightInfo => ({
  eventId: '1',
  eventName: 'UFC 334',
  segment: 'MAIN',
  order: 1,
  weightClass: 'Heavyweight',
  scheduledRounds: 5,
  homeRecord: null,
  awayRecord: null,
  resultMethod: null,
  resultDetail: null,
  resultRound: null,
  resultClock: null,
  winner: null,
  ...overrides,
});

describe('textos de pelea', () => {
  it('traduce los pesos, también los femeninos', () => {
    expect(weightClassLabel('Light Heavyweight')).toBe('Peso semipesado');
    expect(weightClassLabel('W Strawweight')).toBe('Peso paja femenino');
    expect(weightClassLabel("Women's Flyweight")).toBe('Peso mosca femenino');
    expect(weightClassLabel('Openweight')).toBe('Openweight');
  });

  it('cuenta cómo acabó la pelea', () => {
    const base = { homeTeam: 'Gane', awayTeam: 'Hokit' };
    expect(
      fightResultText(
        matchdayFixture({
          ...base,
          fight: fight({
            winner: '1',
            resultMethod: 'DECISION',
            resultDetail: 'Decision - Split',
            resultRound: 5,
          }),
        }),
      ),
    ).toBe('Gana Gane por decisión dividida en el asalto 5');
    expect(
      fightResultText(
        matchdayFixture({
          ...base,
          fight: fight({
            winner: '2',
            resultMethod: 'KO_TKO',
            resultDetail: 'KO/TKO - Elbows',
            resultRound: 3,
            resultClock: '1:28',
          }),
        }),
      ),
    ).toBe('Gana Hokit por KO/TKO (codazos) en el asalto 3, a 1:28');
    expect(
      fightResultText(matchdayFixture({ ...base, fight: fight({ resultMethod: 'DRAW' }) })),
    ).toBe('Empate: no puntúa');
    expect(
      fightResultText(matchdayFixture({ ...base, fight: fight({ resultMethod: 'NO_CONTEST' }) })),
    ).toBe('Sin resultado: no puntúa');
  });

  it('traduce el método de ESPN con su tipo', () => {
    const method = (resultMethod: FightInfo['resultMethod'], resultDetail: string | null) =>
      fightMethodText(fight({ resultMethod, resultDetail }));
    expect(method('SUBMISSION', 'Submission - Rear Naked Choke')).toBe('Sumisión (mataleón)');
    expect(method('SUBMISSION', 'Submission - Suloev Stretch')).toBe('Sumisión (Suloev Stretch)');
    expect(method('SUBMISSION', 'Submission')).toBe('Sumisión');
    expect(method('KO_TKO', 'KO/TKO - Punches')).toBe('KO/TKO (puñetazos)');
    expect(method('KO_TKO', "TKO - Doctor's Stoppage")).toBe('TKO (parada médica)');
    expect(method('DECISION', 'Decision - Unanimous')).toBe('Decisión unánime');
    expect(method('DECISION', 'Decision - Split')).toBe('Decisión dividida');
    expect(method('DECISION', 'Decision - Majority')).toBe('Decisión mayoritaria');
    expect(method('DRAW', 'Draw - Majority')).toBe('Empate mayoritario');
    expect(method('NO_CONTEST', 'No Contest')).toBe('Sin resultado');
    expect(method('DISQUALIFICATION', 'DQ')).toBe('Descalificación');
    expect(method('OTHER', 'Overturned')).toBe('Overturned');
    expect(method(null, null)).toBeNull();
  });

  it('da método, asalto y tiempo, y una insignia a cada luchador', () => {
    const result = fight({
      winner: '1',
      resultMethod: 'SUBMISSION',
      resultDetail: 'Submission - Guillotine Choke',
      resultRound: 2,
      resultClock: '1:25',
    });
    expect(fightResultParts(result)).toEqual(['Sumisión (guillotina)', 'Asalto 2', '1:25']);
    expect(fightOutcomes(result, true)).toEqual({ home: 'W', away: 'L' });
    expect(fightOutcomes(fight({ winner: '2' }), true)).toEqual({ home: 'L', away: 'W' });
    expect(fightOutcomes(fight({ resultMethod: 'DRAW' }), true)).toEqual({ home: 'D', away: 'D' });
    expect(fightOutcomes(fight({ resultMethod: 'NO_CONTEST' }), true)).toEqual({
      home: 'NC',
      away: 'NC',
    });
    expect(fightOutcomes(result, false)).toBeNull();
    expect(fightOutcomes(null, true)).toBeNull();
  });

  it('resume el método y el asalto elegidos', () => {
    expect(methodRoundText('SUBMISSION', 2)).toBe('Sumisión · asalto 2');
    expect(methodRoundText(null, null)).toBe('');
  });
});

describe('cartel de una pelea', () => {
  it('marca el título en juego, también el interino', () => {
    expect(titleLabel(fight({ title: 'UFC Heavyweight Title' }))).toBe('Por el título');
    expect(titleLabel(fight({ title: 'UFC Interim Lightweight Title' }))).toBe(
      'Por el título interino',
    );
    expect(titleLabel(fight({ title: null }))).toBeNull();
    expect(titleLabel(fight())).toBeNull();
  });

  it('llama estelar a la primera pelea y coestelar a la segunda de la cartelera estelar', () => {
    expect(boutBilling(fight({ order: 1 }))).toBe('Pelea estelar');
    expect(boutBilling(fight({ order: 2 }))).toBe('Coestelar');
    expect(boutBilling(fight({ order: 2, segment: 'PRELIMS' }))).toBeNull();
    expect(boutBilling(fight({ order: 5 }))).toBeNull();
  });

  it('da las tarjetas de los jueces solo en las decisiones', () => {
    expect(
      judgesScoresText(fight({ resultMethod: 'DECISION', judgesScores: '30-27 | 29-28 | 30-27' })),
    ).toBe('30-27, 29-28, 30-27');
    expect(
      judgesScoresText(fight({ resultMethod: 'KO_TKO', judgesScores: '30-27 | 29-28 | 30-27' })),
    ).toBeNull();
    // ESPN las da desde la esquina roja: si gana la azul, se giran.
    expect(
      judgesScoresText(
        fight({ resultMethod: 'DECISION', winner: '2', judgesScores: '28-29 | 29-28 | 28-29' }),
      ),
    ).toBe('29-28, 28-29, 29-28');
    expect(judgesScoresText(fight({ resultMethod: 'DECISION' }))).toBeNull();
  });
});

describe('borrador de una pelea', () => {
  it('el asalto solo se guarda con KO/TKO o sumisión', () => {
    expect(withFightPick('1', 'DECISION', '3').round).toBe('');
    expect(withFightPick('2', 'SUBMISSION', '2')).toEqual({
      homeScore: '',
      awayScore: '',
      sign: '2',
      method: 'SUBMISSION',
      round: '2',
    });
  });

  it('envía método y asalto solo en las peleas', () => {
    const fixtures = [
      matchdayFixture({ matchId: 1, fight: fight() }),
      matchdayFixture({ matchId: 2 }),
    ];
    const submission = buildSubmission(fixtures, {
      1: withFightPick('2', 'KO_TKO', '1'),
      2: { homeScore: '', awayScore: '', sign: 'X' },
    });

    expect(submission).toEqual({
      kind: 'ready',
      items: [
        { matchId: 1, homeScore: null, awayScore: null, sign: '2', method: 'KO_TKO', round: 1 },
        { matchId: 2, homeScore: null, awayScore: null, sign: 'X' },
      ],
    });
    if (submission.kind !== 'ready') return;
    expect(withoutSaved({ 1: withFightPick('2', 'KO_TKO', '1') }, submission.items)).toEqual({});
    expect(withoutSaved({ 1: withFightPick('2', 'KO_TKO', '2') }, submission.items)).toHaveProperty(
      '1',
    );
  });

  it('recupera del servidor el método y el asalto', () => {
    const merged = mergeDraftWithServer(
      [
        matchdayFixture({
          matchId: 1,
          locked: true,
          predSign: '1',
          predMethod: 'KO_TKO',
          predRound: 2,
          fight: fight(),
        }),
      ],
      {},
    );
    expect(merged.predictions[1]).toEqual({
      homeScore: '',
      awayScore: '',
      sign: '1',
      method: 'KO_TKO',
      round: '2',
    });
  });

  it('ordena la cartelera de la estelar a los preliminares, con las canceladas al final', () => {
    const card = sortFightCard([
      matchdayFixture({ matchId: 1, fight: fight({ segment: 'PRELIMS', order: 6 }) }),
      matchdayFixture({
        matchId: 2,
        status: 'CANCELLED',
        fight: fight({ segment: 'MAIN', order: 3 }),
      }),
      matchdayFixture({ matchId: 3, fight: fight({ segment: 'MAIN', order: 2 }) }),
      matchdayFixture({ matchId: 4, fight: fight({ segment: 'MAIN', order: 1 }) }),
      matchdayFixture({ matchId: 5, fight: fight({ segment: 'EARLY_PRELIMS', order: 10 }) }),
    ]);
    expect(card.map((f) => f.matchId)).toEqual([4, 3, 1, 5, 2]);
  });
});
