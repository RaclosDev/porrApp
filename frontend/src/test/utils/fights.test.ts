import { describe, expect, it } from 'vitest';
import { matchdayFixture } from '../context/fixtures';
import type { FightInfo } from '../../types/api';
import { fightResultText, methodRoundText, weightClassLabel } from '../../utils/fights';
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
    ).toBe('Gana Gane por Decisión (Split) en el asalto 5');
    expect(
      fightResultText(matchdayFixture({ ...base, fight: fight({ resultMethod: 'DRAW' }) })),
    ).toBe('Empate: no puntúa');
    expect(
      fightResultText(matchdayFixture({ ...base, fight: fight({ resultMethod: 'NO_CONTEST' }) })),
    ).toBe('Sin resultado: no puntúa');
  });

  it('resume el método y el asalto elegidos', () => {
    expect(methodRoundText('SUBMISSION', 2)).toBe('Sumisión · asalto 2');
    expect(methodRoundText(null, null)).toBe('');
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
