import { describe, expect, it } from 'vitest';
import type { PredictionData, PredictionSummary } from '../../types/api';
import { standing } from '../fixtures';
import {
  groupStageTournament,
  roundOfStage,
  toGroupStageEntries,
} from '../../utils/groupStageBracket';
import {
  favouriteTeams,
  passLabel,
  rankFinals,
  rankRound,
  roundAccuracy,
  roundPickers,
  roundSurprises,
  teamRounds,
  teamSituation,
  teamStatus,
} from '../../utils/knockoutStats';

const summary = (key: string, data: PredictionData | null): PredictionSummary => ({
  key,
  hash: key,
  paid: true,
  participantName: `Jugador ${key}`,
  userId: Number(key),
  predictionName: null,
  groupId: 1,
  data,
});

/* ------------------------------------------------------------------------------------------ */
/* Mismos recuentos que la pantalla del Mundial antes de pasar por el cuadro genérico          */
/* ------------------------------------------------------------------------------------------ */

const GROUPS = 'ABCDEFGHIJKL'.split('');
const SIZE = 20;

/** Generador determinista: la misma semilla da siempre el mismo cuadro. */
const random = (seed: number) => () => {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return seed / 2147483648;
};
const shuffle = <T>(list: T[], next: () => number) => {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};
const pairs = (teams: string[]) =>
  Array.from({ length: teams.length / 2 }, (_, i) => [teams[i * 2], teams[i * 2 + 1]]);

/** Las rondas eliminatorias de un cuadro a partir de sus dieciseisavos. */
function knockout(r32: string[][], next: () => number) {
  const winners = (ties: string[][]) => ties.map(([a, b]) => (next() < 0.5 ? a : b));
  const r16 = pairs(winners(r32));
  const qf = pairs(winners(r16));
  const sf = pairs(winners(qf));
  const final = winners(sf);
  return { r32, r16, qf, sf, final, champion: winners([final])[0] };
}

/** Cuadro completo: orden de los 12 grupos, 8 terceros y eliminatorias. */
function fullBracket(seed: number): PredictionData {
  const next = random(seed);
  const groups = Object.fromEntries(
    GROUPS.map((g) => [
      g,
      shuffle(
        [1, 2, 3, 4].map((n) => `${g}${n}`),
        next,
      ),
    ]),
  );
  const thirds = shuffle(
    Object.values(groups).map((g) => g[2]),
    next,
  ).slice(0, 8);
  const qualified = [...Object.values(groups).flatMap((g) => [g[0], g[1]]), ...thirds];
  return { groups, thirds, ...knockout(pairs(shuffle(qualified, next)), next) };
}

/** El torneo real, ya terminado. */
const official: PredictionData = { ...fullBracket(1), scorer: 'Kylian Mbappé, Harry Kane' };
const standings = Object.fromEntries(
  Object.entries(official.groups!).map(([group, teams]) => [
    group,
    Object.fromEntries(teams.map((team) => [team, standing({ mp: 3 })])),
  ]),
);

/** Una predicción guarda los tres primeros de cada grupo. */
const saved = (seed: number): PredictionData => {
  const data = fullBracket(seed);
  return {
    ...data,
    groups: Object.fromEntries(Object.entries(data.groups!).map(([g, t]) => [g, t.slice(0, 3)])),
  };
};

const leagues = [
  {
    name: 'cuadro completo con predicciones antiguas (sin dieciseisavos guardados)',
    knockoutsOnly: false,
    brackets: Array.from({ length: SIZE }, (_, i) => ({ ...saved(i + 10), r32: [] })),
  },
  {
    name: 'cuadro completo con los dieciseisavos guardados',
    knockoutsOnly: false,
    brackets: Array.from({ length: SIZE }, (_, i) => saved(i + 10)),
  },
  {
    name: 'solo eliminatorias, desde los dieciseisavos reales',
    knockoutsOnly: true,
    brackets: Array.from({ length: SIZE }, (_, i) => ({
      groups: {},
      thirds: [],
      ...knockout(official.r32 as string[][], random(i + 10)),
    })),
  },
];

/**
 * Lo que contaba la pantalla anterior: los equipos que el cuadro guardado mete en cada ronda
 * (`stage=…` en los enlaces compartidos), siempre sobre todos los cuadros de la liga.
 */
const SAVED: Record<string, (data: PredictionData) => string[]> = {
  groups: (d) =>
    d.r32?.length
      ? (d.r32.flat() as string[])
      : [...Object.values(d.groups!).flatMap((g) => [g[0], g[1]]), ...d.thirds!],
  r16: (d) => d.r16!.flat() as string[],
  qf: (d) => d.qf!.flat() as string[],
  sf: (d) => d.sf!.flat() as string[],
  final: (d) => d.final!,
  champion: (d) => [d.champion!],
};
/** Dónde lo deja quien no lo mete en la ronda, según la primera en la que falta. */
const FALLS: Record<string, string> = {
  groups: 'Cae en grupos',
  r16: 'Cae en dieciseisavos',
  qf: 'Cae en octavos',
  sf: 'Cae en cuartos',
  final: 'Cae en semifinales',
  champion: 'Subcampeón',
};
const percent = (count: number) => Math.round((count / SIZE) * 100);

describe.each(leagues)('Mismos recuentos que antes: $name', ({ knockoutsOnly, brackets }) => {
  const stages = Object.keys(SAVED).filter((stage) => !(knockoutsOnly && stage === 'groups'));
  const predictions = brackets.map((data, i) => summary(String(i + 1).padStart(2, '0'), data));
  const entries = toGroupStageEntries(predictions, knockoutsOnly);
  const { field } = groupStageTournament(official, standings, knockoutsOnly);
  const teams = knockoutsOnly ? SAVED.groups(official) : Object.values(official.groups!).flat();
  const having = (stage: string, team: string) =>
    predictions.filter((p) => SAVED[stage](p.data!).includes(team));

  it('entran todas las predicciones y cada ronda guardada es una ronda del cuadro', () => {
    expect(entries.map((entry) => entry.id)).toEqual(predictions.map((p) => p.key));
    expect(field.rounds.map((round) => round.title)).toEqual(
      ['Grupos', 'Dieciseisavos', 'Octavos', 'Cuartos', 'Semifinales', 'Final'].slice(
        knockoutsOnly ? 1 : 0,
      ),
    );
    stages.forEach((stage, round) => expect(roundOfStage(stage, knockoutsOnly)).toBe(`${round}`));
  });

  it('más elegidos por ronda: mismos equipos, recuentos, porcentajes y orden', () => {
    stages.forEach((stage, round) => {
      const counts = new Map<string, number>();
      for (const p of predictions) {
        for (const team of SAVED[stage](p.data!)) counts.set(team, (counts.get(team) ?? 0) + 1);
      }
      const expected = [...counts]
        .map(([team, count]) => ({ team, count, total: SIZE, percent: percent(count) }))
        .sort((a, b) => b.count - a.count || a.team.localeCompare(b.team, 'es'));

      const ranking = rankRound(entries, field, round);
      expect(ranking.total).toBe(SIZE);
      expect(ranking.picks).toEqual(expected);
    });
    // Los atajos del buscador siguen siendo los campeones más elegidos.
    expect(favouriteTeams(entries, field, 6)).toEqual(
      rankRound(entries, field, stages.length - 1)
        .picks.slice(0, 6)
        .map((pick) => pick.team),
    );
  });

  it('buscador: cada equipo sale en las mismas predicciones de cada ronda, con lo que pasó', () => {
    for (const team of teams) {
      const rows = teamRounds(entries, field, team);
      expect(rows.map((row) => row.round)).toEqual(stages.map((_, round) => round));
      stages.forEach((stage, round) => {
        const count = having(stage, team).length;
        expect([team, stage, rows[round]]).toEqual([
          team,
          stage,
          {
            round,
            count,
            total: SIZE,
            percent: percent(count),
            status: SAVED[stage](official).includes(team) ? 'yes' : 'no',
          },
        ]);
      });
    }
  });

  it('buscador: quién lo pone en la ronda y dónde lo deja fuera el resto', () => {
    for (const team of teams) {
      stages.forEach((stage, round) => {
        const pickers = roundPickers(entries, field, team, round);
        expect(pickers.yes.map((entry) => entry.id)).toEqual(having(stage, team).map((p) => p.key));
        const fall = (data: PredictionData) =>
          stages.findIndex((earlier) => !SAVED[earlier](data).includes(team));
        const expected = predictions
          .filter((p) => !SAVED[stage](p.data!).includes(team))
          // Primero los que más lejos lo llevan; a igualdad, por nombre.
          .sort((a, b) => fall(b.data!) - fall(a.data!) || a.key.localeCompare(b.key))
          .map((p) => [p.key, FALLS[stages[fall(p.data!)]]]);
        expect(pickers.no.map(({ entry, note }) => [entry.id, note])).toEqual(expected);
      });
    }
  });

  it('aciertos medios, sorpresas y finales más repetidas', () => {
    stages.slice(0, -1).forEach((stage, round) => {
      const real = SAVED[stage](official);
      const hits = predictions.reduce(
        (sum, p) => sum + SAVED[stage](p.data!).filter((team) => real.includes(team)).length,
        0,
      );
      expect(roundAccuracy(entries, field, round)).toEqual({
        average: hits / SIZE,
        size: real.length,
      });
      expect(roundSurprises(entries, field, round)).toEqual(
        real
          .filter((team) => having(stage, team).length === 0)
          .sort((a, b) => a.localeCompare(b, 'es')),
      );
    });

    const counts = new Map<string, number>();
    for (const p of predictions) {
      const key = [...p.data!.final!].sort().join('|');
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const finals = rankFinals(entries, field);
    const first = (key: string) => key.split('|')[0];
    expect(finals.total).toBe(SIZE);
    expect(finals.finals.map((f) => [f.teams.join('|'), f.count, f.percent])).toEqual(
      [...counts]
        // Por votos y por el primer equipo; a igualdad, la que antes aparece.
        .sort((a, b) => b[1] - a[1] || first(a[0]).localeCompare(first(b[0]), 'es'))
        .map(([key, count]) => [key, count, percent(count)]),
    );
    expect([...finals.real!].sort()).toEqual([...official.final!].sort());
  });
});

/* ------------------------------------------------------------------------------------------ */
/* El adaptador                                                                                */
/* ------------------------------------------------------------------------------------------ */

/** Predicción antigua: sin r32, los que pasan de grupos salen de los grupos y los terceros. */
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
  ...fields,
});

describe('toGroupStageEntries', () => {
  it('descarta las predicciones ocultas y las que no tienen cuadro', () => {
    const result = toGroupStageEntries(
      [summary('1', bracket({})), summary('2', null), summary('3', { groups: {} })],
      false,
    );
    expect(result.map((entry) => entry.id)).toEqual(['1']);
    expect(result[0].name).toBe('Jugador 1');
  });

  it('cada ronda lleva a quien la pasa; sin dieciseisavos, los grupos se deducen', () => {
    const [entry] = toGroupStageEntries([summary('1', bracket({}))], false);
    expect(entry.picks).toEqual([
      ['España', 'Italia', 'Chile', 'Francia', 'Japón'],
      ['España', 'Japón', 'Francia', 'Chile'],
      ['España', 'Francia'],
      ['España', 'Brasil'],
      ['España', 'Brasil'],
      ['España'],
    ]);
  });

  it('usa los dieciseisavos cuando la predicción los trae completos', () => {
    const r32 = Array.from({ length: 16 }, (_, i) => [`L${i}`, `V${i}`]);
    const [entry] = toGroupStageEntries([summary('1', bracket({ r32 }))], false);
    expect(entry.picks[0]).toHaveLength(32);
  });

  it('ignora los huecos sin equipo y, en solo eliminatorias, no tiene ronda de grupos', () => {
    const [entry] = toGroupStageEntries(
      [summary('1', bracket({ final: ['1º Grupo A', 'Por definir'] }))],
      true,
    );
    expect(entry.picks).toHaveLength(5);
    expect(entry.picks[3]).toEqual([]);
  });
});

describe('enlaces compartidos antes de unificar el buscador', () => {
  it('la ronda a la que se llega es la que se pasa en el cuadro', () => {
    expect(['groups', 'r16', 'qf', 'sf', 'final', 'champion'].map((s) => roundOfStage(s, false)))
      // prettier-ignore
      .toEqual(['0', '1', '2', '3', '4', '5']);
    expect(roundOfStage('r16', true)).toBe('0');
    expect(roundOfStage('champion', true)).toBe('4');
  });

  it('los puestos de grupo solo existen en las ligas de cuadro completo', () => {
    expect(roundOfStage('first', false)).toBe('first');
    expect(roundOfStage('third', false)).toBe('third');
    expect(roundOfStage('first', true)).toBeNull();
    expect(roundOfStage('groups', true)).toBeNull();
    expect(roundOfStage('otra', false)).toBeNull();
  });
});

describe('groupStageTournament', () => {
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
    const { field, started, finished } = groupStageTournament({}, {}, false);
    expect(started).toBe(false);
    expect(finished).toBe(false);
    expect(teamStatus(field, 'España', 5)).toBe('pending');
    expect(teamSituation(field, 'España')).toBeNull();
    expect(groupStageTournament(null, null, false).field.rounds).toHaveLength(6);
  });

  it('decide los puestos de un grupo terminado y espera a los terceros', () => {
    const tournament = groupStageTournament(groupsOnly, finishedGroups, false);
    const { field } = tournament;
    expect(tournament.started).toBe(true);
    expect(tournament.positionStatus('España', 'first')).toBe('yes');
    expect(tournament.positionStatus('Italia', 'second')).toBe('no');
    expect(tournament.positionStatus('Perú', 'third')).toBe('no');
    expect(teamStatus(field, 'Perú', 0)).toBe('no');
    expect(teamSituation(field, 'Perú')).toBe('Cayó en grupos');
    expect(teamStatus(field, 'España', 0)).toBe('yes');
    // El 3º depende de la tabla de terceros, que no se cierra hasta el último grupo.
    expect(teamStatus(field, 'Italia', 0)).toBe('pending');
    expect(tournament.positionStatus('Italia', 'third')).toBe('pending');
    // Grupo B en juego.
    expect(tournament.positionStatus('Francia', 'first')).toBe('pending');
    expect(tournament.groupWinner('A')).toBe('España');
    expect(tournament.groupWinner('B')).toBeNull();
  });

  it('con todos los grupos terminados, el tercero pasa si está entre los mejores', () => {
    const all = { A: finishedGroups.A, B: finishedGroups.A };
    const tournament = groupStageTournament({ ...groupsOnly, thirds: ['Italia'] }, all, false);
    expect(tournament.positionStatus('Italia', 'third')).toBe('yes');
    expect(teamStatus(tournament.field, 'Italia', 0)).toBe('yes');
    expect(tournament.positionStatus('Brasil', 'third')).toBe('no');
    expect(tournament.field.eliminatedAt.get('Brasil')).toBe(0);
  });

  it('deja fuera a quien perdió su cruce aunque la ronda no esté completa', () => {
    const { field } = groupStageTournament(
      {
        r32: [
          ['España', 'Japón'],
          ['Francia', 'Chile'],
        ],
        r16: [['España', null]],
      },
      {},
      false,
    );
    expect(teamStatus(field, 'España', 1)).toBe('yes');
    expect(teamStatus(field, 'Japón', 1)).toBe('no');
    expect(teamStatus(field, 'Japón', 5)).toBe('no');
    expect(teamStatus(field, 'Francia', 1)).toBe('pending');
    expect(teamSituation(field, 'Japón')).toBe('Cayó en dieciseisavos');
    expect(teamSituation(field, 'Francia')).toBe('Sigue en juego');
  });

  it('con campeón el torneo ha terminado y se conoce la final', () => {
    const tournament = groupStageTournament(
      { final: ['España', 'Argentina'], champion: 'España', scorer: 'Kylian Mbappé, Harry Kane' },
      {},
      true,
    );
    const { field } = tournament;
    expect(tournament.finished).toBe(true);
    expect(passLabel(field.rounds[4])).toBe('Campeón');
    expect(teamStatus(field, 'España', 4)).toBe('yes');
    expect(teamStatus(field, 'Argentina', 4)).toBe('no');
    expect(teamSituation(field, 'España')).toBe('Campeón');
    expect(teamSituation(field, 'Argentina')).toBe('Subcampeón');
    expect(tournament.scorers).toEqual(['Kylian Mbappé', 'Harry Kane']);
  });
});
