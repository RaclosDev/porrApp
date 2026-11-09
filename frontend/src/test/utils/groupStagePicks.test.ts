import { describe, expect, it } from 'vitest';
import type { PredictionData, PredictionSummary } from '../../types/api';
import { standing } from '../fixtures';
import { groupStageTournament, toGroupStageEntries } from '../../utils/groupStageBracket';
import {
  groupWinnerPicks,
  positionPickers,
  positionRows,
  teamsByGroup,
} from '../../utils/groupStagePicks';
import { isRealScorer, rankScorers } from '../../utils/scorerPicks';

const bracket = (fields: Partial<PredictionData>): PredictionData => ({
  groups: { A: ['España', 'Italia', 'Chile'], B: ['Francia', 'Japón', 'Perú'] },
  thirds: ['Chile'],
  r16: [
    ['España', 'Japón'],
    ['Francia', 'Chile'],
  ],
  champion: 'España',
  scorer: 'Kylian Mbappe',
  ...fields,
});

const summary = (key: string, data: PredictionData): PredictionSummary => ({
  key,
  hash: key,
  paid: true,
  participantName: `P${key}`,
  userId: Number(key),
  predictionName: null,
  groupId: 1,
  data,
});

const entries = toGroupStageEntries(
  [
    summary('1', bracket({})),
    summary('2', bracket({ scorer: 'Kylian Mbappé' })),
    summary(
      '3',
      bracket({
        groups: { A: ['Italia', 'Chile', 'España'], B: ['Japón', 'Francia', 'Perú'] },
        thirds: ['España'],
        scorer: 'Harry Kane',
      }),
    ),
  ],
  false,
);

const official: PredictionData = {
  groups: { A: ['España', 'Chile', 'Italia', 'Perú'], B: ['Francia', 'Japón', 'Brasil', 'México'] },
  thirds: ['Italia'],
};
const played = (teams: string[]) =>
  Object.fromEntries(teams.map((team) => [team, standing({ mp: 3 })]));
const tournament = groupStageTournament(
  official,
  { A: played(official.groups!.A), B: played(official.groups!.B) },
  false,
);

describe('puestos de la fase de grupos', () => {
  it('cuenta en cuántas predicciones acaba el equipo en cada puesto y si fue así', () => {
    expect(positionRows(entries, 'España', tournament)).toEqual([
      { id: 'first', label: '1º de grupo', count: 2, percent: 67, status: 'yes' },
      { id: 'second', label: '2º de grupo', count: 0, percent: 0, status: 'no' },
      { id: 'third', label: 'Pasa como 3º', count: 1, percent: 33, status: 'no' },
    ]);
    // Tercero que no está entre los que pasan: no cuenta como «pasa como 3º».
    expect(positionRows(entries, 'Perú', tournament)[2]).toMatchObject({ count: 0, status: 'no' });
    expect(positionRows(entries, 'Italia', tournament)[2].status).toBe('yes');
  });

  it('dice quién lo pone en el puesto y en cuál lo pone el resto, por nombre', () => {
    const first = positionPickers(entries, 'Italia', 'first');
    expect(first.yes.map((entry) => entry.id)).toEqual(['3']);
    expect(first.no.map(({ entry, note }) => [entry.id, note])).toEqual([
      ['1', 'Lo pone 2º'],
      ['2', 'Lo pone 2º'],
    ]);
    expect(positionPickers(entries, 'Perú', 'third').no[0].note).toBe('Lo pone 3º, no pasa');
    expect(positionPickers(entries, 'Chile', 'first').no.map((n) => n.note)).toEqual([
      'Lo pone 3º y pasa',
      'Lo pone 3º y pasa',
      'Lo pone 2º',
    ]);
    expect(positionPickers(entries, 'México', 'second').no[0].note).toBe('Lo pone 4º');
  });

  it('elige el primero más votado de cada grupo y lo compara con el real', () => {
    expect(groupWinnerPicks(entries, tournament)).toEqual([
      { group: 'A', team: 'España', count: 2, percent: 67, real: 'España' },
      { group: 'B', team: 'Francia', count: 2, percent: 67, real: 'Francia' },
    ]);
    const unplayed = groupStageTournament(official, {}, false);
    expect(groupWinnerPicks(entries, unplayed).map((pick) => pick.real)).toEqual([null, null]);
  });
});

describe('equipos del buscador', () => {
  it('van por grupo oficial y, si se pide, solo los conocidos', () => {
    expect(teamsByGroup(official, [], false)).toEqual([
      { label: 'Grupo A', teams: ['Chile', 'España', 'Italia', 'Perú'] },
      { label: 'Grupo B', teams: ['Brasil', 'Francia', 'Japón', 'México'] },
    ]);
    expect(teamsByGroup(official, ['España', 'Japón', 'España'], true)).toEqual([
      { label: 'Grupo A', teams: ['España'] },
      { label: 'Grupo B', teams: ['Japón'] },
    ]);
  });

  it('sin grupos oficiales salen juntos los conocidos', () => {
    expect(teamsByGroup(null, ['Japón', 'España'], false)).toEqual([
      { label: null, teams: ['España', 'Japón'] },
    ]);
  });
});

describe('pichichi más elegido', () => {
  it('junta los que solo cambian en tildes y usa la grafía más repetida', () => {
    const scorers = rankScorers([...entries, { data: bracket({}) }, { data: { scorer: ' ' } }]);
    expect(scorers).toEqual([
      { name: 'Kylian Mbappe', count: 3, percent: 60 },
      { name: 'Harry Kane', count: 1, percent: 20 },
    ]);
    expect(isRealScorer('kylian mbappe', ['Kylian Mbappé'])).toBe(true);
    expect(isRealScorer('Mbappé', ['Kylian Mbappé'])).toBe(false);
  });
});
