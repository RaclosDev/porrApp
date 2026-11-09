import { describe, expect, it } from 'vitest';
import type { KnockoutRound, KnockoutTie } from '../../services/api';
import type { Match, PredictionSummary } from '../../types/api';
import {
  favouriteTeams,
  fieldFromDraw,
  fieldFromMatches,
  passLabel,
  pickedTeams,
  rankFinals,
  rankRound,
  roundAccuracy,
  roundPickers,
  roundSurprises,
  teamRounds,
  teamSituation,
  teamStatus,
  toKnockoutEntries,
  visibleRounds,
  type KnockoutEntry,
} from '../../utils/knockoutStats';

const tie = (home: string, away: string, winner: string | null = null): KnockoutTie => ({
  home,
  away,
  winner,
  matchIds: [],
});

const round = (name: string, ties: KnockoutTie[], drawn = true): KnockoutRound => ({
  round: name,
  drawn,
  expectedTies: ties.length,
  ties,
});

const summary = (
  key: string,
  name: string,
  customRounds: (string | null)[][] | null,
): PredictionSummary => ({
  key,
  hash: key,
  paid: false,
  participantName: name,
  userId: Number(key),
  predictionName: null,
  groupId: 7,
  data: customRounds && { user: name, prediction: name, groups: {}, customRounds, r16: [] },
});

const entry = (id: string, name: string, picks: (string | null)[][]): KnockoutEntry => ({
  id,
  name,
  userId: Number(id),
  picks,
});

/**
 * Champions: octavos decididos (pasan Madrid, Bayern, Inter y PSG), cuartos a medias (pasa Madrid;
 * Inter - PSG por jugar) y semifinales y final sin sortear.
 */
const draw = fieldFromDraw([
  round('r16', [
    tie('Madrid', 'City', 'Madrid'),
    tie('Bayern', 'Arsenal', 'Bayern'),
    tie('Inter', 'Milan', 'Inter'),
    tie('PSG', 'Barça', 'PSG'),
  ]),
  round('qf', [tie('Madrid', 'Bayern', 'Madrid'), tie('Inter', 'PSG')]),
  round('sf', [], false),
  round('final', [], false),
]);

const league: KnockoutEntry[] = [
  entry('1', 'Ana', [
    ['Madrid', 'Arsenal', 'Inter', 'Barça'],
    ['Madrid', null],
  ]),
  entry('2', 'Berto', [
    ['City', 'Bayern', 'Inter', 'PSG'],
    ['Bayern', null],
  ]),
  // Carla entró tarde: solo tiene los cuartos.
  entry('3', 'Carla', [[], ['Madrid', null]]),
];

describe('Cuadro real', () => {
  it('lee de unas eliminatorias sorteadas quién pasa, quién cae y qué rondas están decididas', () => {
    expect(draw.rounds.map((r) => [r.title, r.decided, r.final])).toEqual([
      ['Octavos', true, false],
      ['Cuartos', false, false],
      ['Semifinales', false, false],
      ['Final', false, true],
    ]);
    expect([...draw.rounds[1].winners]).toEqual(['Madrid']);
    expect(draw.eliminatedAt.get('City')).toBe(0);
    expect(draw.eliminatedAt.get('Bayern')).toBe(1);
    expect(draw.eliminatedAt.has('Inter')).toBe(false);
  });

  it('en el play-in de la NBA perder un cruce no elimina si queda otro', () => {
    const playoffs = fieldFromDraw(
      [
        round('playin', [
          tie('Lakers', 'Warriors', 'Lakers'),
          tie('Kings', 'Suns', 'Kings'),
          // El que pierde el primero se la juega con el que gana el segundo.
          tie('Warriors', 'Kings', 'Warriors'),
        ]),
        round('r16', [tie('Thunder', 'Warriors')]),
      ],
      true,
    );
    expect(playoffs.rounds[0].title).toBe('Play-in');
    expect(playoffs.eliminatedAt.has('Warriors')).toBe(false);
    expect(playoffs.eliminatedAt.get('Suns')).toBe(0);
    expect(playoffs.eliminatedAt.get('Kings')).toBe(0);
    expect(teamStatus(playoffs, 'Warriors', 0)).toBe('yes');
  });

  it('lee de un cuadro propio las rondas, los pases directos y el campeón', () => {
    const match = (fields: Partial<Match>): Match =>
      ({
        id: 1,
        home: '',
        away: '',
        home_team_id: 1,
        away_team_id: 2,
        finished: false,
        ...fields,
      }) as Match;
    const field = fieldFromMatches([
      match({ round: 'bracket-1', home: 'A', away: 'B', winner: 'A', finished: true }),
      match({ round: 'bracket-1', home: 'C', away: 'D', winner: 'D', finished: true }),
      match({ round: 'bracket-1', home: 'E', away: '', away_team_id: null }),
      match({ round: 'bracket-2', home: 'A', away: 'D', winner: 'D', finished: true }),
      match({ round: 'bracket-2', home: 'E', away: '', away_team_id: null }),
      match({ round: 'group', home: 'A', away: 'C' }),
    ]);
    expect(field.rounds.map((r) => r.title)).toEqual(['Cuartos de final', 'Semifinales', 'Final']);
    expect(field.rounds.map((r) => r.decided)).toEqual([true, true, false]);
    expect([...field.rounds[0].byes]).toEqual(['E']);
    // El pase directo cuenta como pasado, pero no como acierto de nadie.
    expect(teamStatus(field, 'E', 0)).toBe('yes');
    expect(teamStatus(field, 'A', 1)).toBe('no');
    expect(teamStatus(field, 'D', 2)).toBe('pending');
    expect(teamSituation(field, 'A')).toBe('Cayó en semifinales');
    expect(teamSituation(field, 'D')).toBe('Sigue en juego');
    expect(passLabel(field.rounds[0])).toBe('Pasa de cuartos de final');
    expect(passLabel(field.rounds[2])).toBe('Campeón');
    // El árbol es fijo: los dos primeros cruces dan el primero de la ronda siguiente.
    expect([field.slots('C', 0), field.slots('C', 1), field.slots('E', 1)]).toEqual([
      [1],
      [0],
      [1],
    ]);
    expect(field.slots('Z', 0)).toEqual([]);
  });
});

describe('Predicciones visibles', () => {
  const predictions = [
    // La propia llega entera del servidor, también lo que sigue abierto.
    summary('1', 'Ana', [
      ['Madrid', 'Arsenal'],
      ['Madrid', 'Inter'],
    ]),
    // La de otro llega ya sin lo abierto.
    summary('2', 'Berto', [
      ['City', 'Bayern'],
      [null, null],
    ]),
    // Antes de cualquier cierre, de los demás no llega nada.
    summary('3', 'Carla', null),
  ];

  it('solo cuenta las elecciones ya cerradas, también en la predicción propia', () => {
    const entries = toKnockoutEntries(predictions, {
      fullyLocked: false,
      lockedPicks: [
        [true, true],
        [true, false],
      ],
    });
    expect(entries.map((e) => [e.name, e.picks])).toEqual([
      [
        'Ana',
        [
          ['Madrid', 'Arsenal'],
          ['Madrid', null],
        ],
      ],
      [
        'Berto',
        [
          ['City', 'Bayern'],
          [null, null],
        ],
      ],
    ]);
  });

  it('sin nada cerrado no entra ninguna predicción, ni la propia', () => {
    expect(toKnockoutEntries(predictions, { fullyLocked: false, lockedPicks: [] })).toEqual([]);
    expect(
      toKnockoutEntries(predictions, { fullyLocked: false, lockedPicks: [[false, false]] }),
    ).toEqual([]);
    // Sin el estado de cierre no se puede saber qué está abierto.
    expect(toKnockoutEntries(predictions, undefined)).toEqual([]);
  });

  it('con todo cerrado se ve todo', () => {
    const entries = toKnockoutEntries(predictions, { fullyLocked: true, lockedPicks: [] });
    expect(entries[0].picks[1]).toEqual(['Madrid', 'Inter']);
  });
});

describe('Más elegidos por ronda', () => {
  it('cuenta sobre quienes predijeron la ronda y ordena de más a menos elegido', () => {
    expect(visibleRounds(league, draw)).toEqual([0, 1]);
    const octavos = rankRound(league, draw, 0);
    expect(octavos.total).toBe(2);
    expect(octavos.picks.slice(0, 2)).toEqual([
      { team: 'Inter', count: 2, total: 2, percent: 100 },
      { team: 'Arsenal', count: 1, total: 2, percent: 50 },
    ]);
    const cuartos = rankRound(league, draw, 1);
    expect(cuartos.total).toBe(3);
    expect(cuartos.picks).toEqual([
      { team: 'Madrid', count: 2, total: 3, percent: 67 },
      { team: 'Bayern', count: 1, total: 3, percent: 33 },
    ]);
  });

  it('compara con lo real: pasó, no pasó o aún no se sabe', () => {
    expect(teamStatus(draw, 'Madrid', 0)).toBe('yes');
    expect(teamStatus(draw, 'Arsenal', 0)).toBe('no');
    expect(teamStatus(draw, 'Bayern', 1)).toBe('no');
    expect(teamStatus(draw, 'Inter', 1)).toBe('pending');
    // Eliminado antes: tampoco pasará las siguientes.
    expect(teamStatus(draw, 'Bayern', 2)).toBe('no');
    expect(teamStatus(draw, 'Madrid', 3)).toBe('pending');
  });

  it('da los aciertos medios sobre los cruces decididos y las sorpresas', () => {
    // Ana acierta Madrid e Inter; Berto, Bayern, Inter y PSG.
    expect(roundAccuracy(league, draw, 0)).toEqual({ average: 2.5, size: 4 });
    expect(roundAccuracy(league, draw, 1)).toEqual({ average: 2 / 3, size: 1 });
    expect(roundAccuracy(league, draw, 2)).toBeNull();
    expect(roundSurprises(league, draw, 0)).toEqual([]);
    expect(roundSurprises([league[0]], draw, 0)).toEqual(['Bayern', 'PSG']);
  });

  it('en un cuadro propio los pases directos no salen entre los elegidos', () => {
    const match = (fields: Partial<Match>): Match =>
      ({
        id: 1,
        home: '',
        away: '',
        home_team_id: 1,
        away_team_id: 2,
        finished: false,
        ...fields,
      }) as Match;
    const field = fieldFromMatches([
      match({ round: 'bracket-1', home: 'A', away: 'B' }),
      match({ round: 'bracket-1', home: 'E', away: '', away_team_id: null }),
    ]);
    const entries = [
      entry('1', 'Ana', [['A', 'E'], ['E']]),
      entry('2', 'Berto', [['B', 'E'], ['B']]),
    ];
    expect(rankRound(entries, field, 0).picks.map((pick) => pick.team)).toEqual(['A', 'B']);
    expect(rankRound(entries, field, 1).picks.map((pick) => pick.team)).toEqual(['B', 'E']);
  });
});

describe('Buscador de equipos', () => {
  it('ofrece los equipos que alguien ha puesto y, de atajo, los de la ronda más avanzada', () => {
    expect(pickedTeams(league)).toEqual([
      'Arsenal',
      'Barça',
      'Bayern',
      'City',
      'Inter',
      'Madrid',
      'PSG',
    ]);
    expect(favouriteTeams(league, draw, 1)).toEqual(['Madrid']);
  });

  it('cuenta en cada ronda cuántas predicciones hacen pasar al equipo', () => {
    expect(teamRounds(league, draw, 'Madrid')).toEqual([
      { round: 0, count: 1, total: 2, percent: 50, status: 'yes' },
      { round: 1, count: 2, total: 3, percent: 67, status: 'yes' },
    ]);
    expect(teamRounds(league, draw, 'Bayern').map((row) => row.status)).toEqual(['yes', 'no']);
    // El Inter - PSG de cuartos sigue abierto: de esa ronda aún no hay nada que contar.
    expect(teamRounds(league, draw, 'Inter').map((row) => row.round)).toEqual([0]);
    expect(roundPickers(league, draw, 'Inter', 1)).toEqual({ yes: [], no: [] });
  });

  it('dice quién lo hace pasar y dónde lo deja fuera el resto', () => {
    const cuartos = roundPickers(league, draw, 'Madrid', 1);
    expect(cuartos.yes.map((e) => e.name)).toEqual(['Ana', 'Carla']);
    // Berto ya lo dejó fuera en octavos.
    expect(cuartos.no.map(({ entry: e, note }) => [e.name, note])).toEqual([
      ['Berto', 'Cae en octavos'],
    ]);

    const bayern = roundPickers(league, draw, 'Bayern', 1);
    expect(bayern.yes.map((e) => e.name)).toEqual(['Berto']);
    expect(bayern.no.map(({ entry: e, note }) => [e.name, note])).toEqual([
      // Carla lo deja en cuartos; de Ana se sabe que ya cayó en octavos.
      ['Carla', 'Cae en cuartos'],
      ['Ana', 'Cae en octavos'],
    ]);

    // En octavos solo cuentan Ana y Berto: Carla no predijo esa ronda.
    const octavos = roundPickers(league, draw, 'Madrid', 0);
    expect(octavos.yes.map((e) => e.name)).toEqual(['Ana']);
    expect(octavos.no.map(({ entry: e }) => e.name)).toEqual(['Berto']);
  });

  it('resume la situación real del equipo', () => {
    expect(teamSituation(draw, 'City')).toBe('Cayó en octavos');
    expect(teamSituation(draw, 'Madrid')).toBe('Sigue en juego');
    expect(teamSituation(fieldFromDraw([round('final', [tie('A', 'B', 'A')])]), 'A')).toBe(
      'Campeón',
    );
    expect(teamSituation(fieldFromDraw([round('r16', [tie('A', 'B')])]), 'A')).toBeNull();
  });
});

describe('Finales más repetidas', () => {
  const semis = (winners: (string | null)[] = [null, null]) =>
    fieldFromDraw([
      round('sf', [tie('Madrid', 'Bayern', winners[0]), tie('Inter', 'PSG', winners[1])]),
      round('final', [], false),
    ]);
  const finals = [
    entry('1', 'Ana', [['Madrid', 'Inter']]),
    entry('2', 'Berto', [['Inter', 'Madrid']]),
    entry('3', 'Carla', [['Bayern', 'Inter']]),
    // De Dani solo se ve una semifinal: aún no tiene final.
    entry('4', 'Dani', [['Madrid', null]]),
  ];

  it('cuenta los dos que pasan las semifinales, sin importar el orden', () => {
    expect(rankFinals(finals, semis())).toEqual({
      total: 3,
      real: null,
      finals: [
        { teams: ['Inter', 'Madrid'], count: 2, percent: 67 },
        { teams: ['Bayern', 'Inter'], count: 1, percent: 33 },
      ],
    });
  });

  it('da la final real cuando las dos semifinales están decididas', () => {
    expect(rankFinals(finals, semis(['Madrid', null])).real).toBeNull();
    expect(rankFinals(finals, semis(['Madrid', 'Inter'])).real).toEqual(['Madrid', 'Inter']);
  });

  it('sin ronda anterior a la final no hay finales que contar', () => {
    const only = fieldFromDraw([round('final', [tie('Madrid', 'Inter')])]);
    expect(rankFinals([entry('1', 'Ana', [['Madrid']])], only)).toEqual({
      total: 0,
      real: null,
      finals: [],
    });
    expect(rankFinals(league, draw).total).toBe(0);
  });
});
