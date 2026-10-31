import { describe, expect, it } from 'vitest';
import type { PredictionData, PredictionSummary } from '../../types/api';
import { standing } from '../fixtures';
import {
  buildOfficialState,
  groupWinnerPicks,
  isRealScorer,
  predictedReach,
  rankFinals,
  rankPicks,
  rankScorers,
  reachLabel,
  stageAccuracy,
  stagePickers,
  stageTeams,
  teamFunnel,
  toBracketEntries,
  type BracketEntry,
} from '../../utils/bracketStats';

/** Cuadro antiguo: sin r32, los dieciseisavos salen de los grupos y los terceros. */
const bracket = (fields: Partial<PredictionData>): PredictionData => ({
  groups: { A: ['España', 'Italia', 'Chile'], B: ['Francia', 'Japón', 'Perú'] },
  thirds: ['Chile'],
  r32: [],
  r16: [
    ['España', 'Japón'],
    ['Francia', 'Chile'],
  ],
  qf: [['España', 'Francia']],
  sf: [['España', 'Brasil']],
  final: ['España', 'Brasil'],
  champion: 'España',
  scorer: 'Kylian Mbappe',
  ...fields,
});

const entry = (id: string, data: PredictionData): BracketEntry => ({
  id,
  name: `P${id}`,
  userId: Number(id),
  data,
});

const entries = [
  entry('1', bracket({})),
  entry('2', bracket({ champion: 'Brasil', scorer: 'Kylian Mbappé' })),
  entry('3', bracket({ final: ['Francia', 'Brasil'], champion: 'Francia', scorer: 'Harry Kane' })),
];

describe('stageTeams', () => {
  it('deduce los que pasan de grupos de los grupos y los terceros elegidos', () => {
    expect(stageTeams(bracket({}), 'groups').sort()).toEqual(
      ['Chile', 'España', 'Francia', 'Italia', 'Japón'].sort(),
    );
    expect(stageTeams(bracket({}), 'third')).toEqual(['Chile']);
  });

  it('usa los dieciseisavos cuando el cuadro los trae completos', () => {
    const r32 = Array.from({ length: 16 }, (_, i) => [`L${i}`, `V${i}`]);
    expect(stageTeams(bracket({ r32, groups: {} }), 'groups')).toHaveLength(32);
  });

  it('ignora huecos sin equipo', () => {
    expect(stageTeams(bracket({ final: ['1º Grupo A', 'Por definir'] }), 'final')).toEqual([]);
  });
});

describe('rankings', () => {
  it('ordena los campeones por votos', () => {
    expect(rankPicks(entries, 'champion')).toEqual(
      [
        { team: 'España', count: 1, percent: 33 },
        { team: 'Brasil', count: 1, percent: 33 },
        { team: 'Francia', count: 1, percent: 33 },
      ].sort((a, b) => a.team.localeCompare(b.team, 'es')),
    );
  });

  it('cuenta las finales sin importar el orden', () => {
    const finals = rankFinals([...entries, entry('4', bracket({ final: ['Brasil', 'España'] }))]);
    expect(finals[0]).toEqual({ teams: ['Brasil', 'España'], count: 3, percent: 75 });
  });

  it('junta los pichichis que solo cambian en tildes y usa la grafía más repetida', () => {
    const scorers = rankScorers([...entries, entry('4', bracket({}))]);
    expect(scorers[0]).toEqual({ name: 'Kylian Mbappe', count: 3, percent: 75 });
    expect(isRealScorer('kylian mbappe', ['Kylian Mbappé'])).toBe(true);
    expect(isRealScorer('Mbappé', ['Kylian Mbappé'])).toBe(false);
  });
});

describe('toBracketEntries', () => {
  it('descarta los pronósticos ocultos y los que no tienen cuadro', () => {
    const summary = (key: string, data: PredictionData | null): PredictionSummary => ({
      key,
      hash: key,
      paid: true,
      participantName: `Jugador ${key}`,
      userId: null,
      predictionName: null,
      groupId: 1,
      data,
    });
    const result = toBracketEntries([
      summary('1', bracket({})),
      summary('2', null),
      summary('3', { groups: {} }),
    ]);
    expect(result.map((e) => e.id)).toEqual(['1']);
    expect(result[0].name).toBe('Jugador 1');
  });
});

describe('buildOfficialState', () => {
  const finishedGroups = {
    A: {
      España: standing({ mp: 3 }),
      Italia: standing({ mp: 3 }),
      Chile: standing({ mp: 3 }),
      Perú: standing({ mp: 3 }),
    },
    B: {
      Francia: standing({ mp: 2 }),
      Japón: standing({ mp: 2 }),
      Brasil: standing({ mp: 2 }),
      México: standing({ mp: 2 }),
    },
  };
  const groupsOnly: PredictionData = {
    groups: {
      A: ['España', 'Chile', 'Italia', 'Perú'],
      B: ['Francia', 'Japón', 'Brasil', 'México'],
    },
  };

  it('no da nada por hecho antes de que empiece el torneo', () => {
    const official = buildOfficialState({}, {});
    expect(official.started).toBe(false);
    expect(official.status('España', 'champion')).toBe('pending');
    expect(official.reach('España')).toEqual({ stage: null, out: false });
  });

  it('decide las posiciones de un grupo terminado y espera a los terceros', () => {
    const official = buildOfficialState(groupsOnly, finishedGroups);
    expect(official.status('España', 'first')).toBe('yes');
    expect(official.status('Italia', 'second')).toBe('no');
    expect(official.status('Perú', 'groups')).toBe('no');
    expect(official.status('España', 'groups')).toBe('yes');
    // El 3º depende de la tabla de terceros, que no se cierra hasta el último grupo.
    expect(official.status('Italia', 'groups')).toBe('pending');
    // Grupo B en juego.
    expect(official.status('Francia', 'first')).toBe('pending');
    expect(official.groupWinner('A')).toBe('España');
    expect(official.groupWinner('B')).toBeNull();
  });

  it('elimina a quien perdió su cruce aunque la ronda no esté completa', () => {
    const official = buildOfficialState(
      {
        r32: [
          ['España', 'Japón'],
          ['Francia', 'Chile'],
        ],
        r16: [['España', null]],
      },
      {},
    );
    expect(official.status('España', 'r16')).toBe('yes');
    expect(official.status('Japón', 'r16')).toBe('no');
    expect(official.status('Japón', 'champion')).toBe('no');
    expect(official.status('Francia', 'r16')).toBe('pending');
    expect(official.reach('Japón')).toEqual({ stage: 'groups', out: true });
  });

  it('con campeón el torneo ha terminado y la final se conoce', () => {
    const official = buildOfficialState(
      { final: ['España', 'Argentina'], champion: 'España', scorer: 'Kylian Mbappé, Harry Kane' },
      {},
    );
    expect(official.finished).toBe(true);
    expect(official.status('España', 'champion')).toBe('yes');
    expect(official.status('Argentina', 'champion')).toBe('no');
    expect(official.reach('Argentina')).toEqual({ stage: 'final', out: true });
    expect(reachLabel(official.reach('Argentina').stage, 'real')).toBe('Subcampeón');
    expect(official.scorers).toEqual(['Kylian Mbappé', 'Harry Kane']);
  });
});

describe('aciertos y buscador', () => {
  const official = buildOfficialState(
    {
      r32: Array.from({ length: 16 }, (_, i) =>
        i === 0 ? ['España', 'Japón'] : i === 1 ? ['Francia', 'Chile'] : [`L${i}`, `V${i}`],
      ),
      r16: [
        ['España', 'Chile'],
        ...Array.from({ length: 7 }, (_, i) => [`L${i + 2}`, `V${i + 2}`]),
      ],
    },
    {},
  );

  it('calcula los aciertos medios de una ronda completa', () => {
    // Cada cuadro pone España, Japón, Francia y Chile en octavos; llegaron España y Chile.
    expect(stageAccuracy(entries, 'r16', official)).toEqual({ average: 2, size: 16 });
    expect(stageAccuracy(entries, 'qf', official)).toBeNull();
  });

  it('da el embudo de un equipo con lo que ha pasado de verdad', () => {
    const rows = teamFunnel(entries, 'Francia', ['r16', 'champion'], official);
    expect(rows).toEqual([
      { stage: 'r16', count: 3, percent: 100, status: 'no' },
      { stage: 'champion', count: 1, percent: 33, status: 'no' },
    ]);
  });

  it('separa quién lo pone y hasta dónde lo lleva el resto', () => {
    const { yes, no } = stagePickers(entries, 'Brasil', 'champion');
    expect(yes.map((e) => e.id)).toEqual(['2']);
    expect(no.map((n) => n.note)).toEqual(['Subcampeón', 'Subcampeón']);
    expect(predictedReach(entries[0].data, 'Japón')).toBe('r16');
  });

  it('en las posiciones de grupo dice qué puesto le da cada uno', () => {
    const { no } = stagePickers(entries, 'Italia', 'first');
    expect(no[0].note).toBe('Lo pone 2º');
    expect(stagePickers(entries, 'Perú', 'third').no[0].note).toBe('Lo pone 3º, no pasa');
  });

  it('elige el primero más votado de cada grupo', () => {
    const picks = groupWinnerPicks(entries, official);
    expect(picks.map((p) => [p.group, p.top?.team, p.top?.count])).toEqual([
      ['A', 'España', 3],
      ['B', 'Francia', 3],
    ]);
  });
});
