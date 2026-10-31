import { describe, it, expect } from 'vitest';
import { buildBracketData, isMatchInRound } from '../../utils/bracketBuilder';
import { game, standing } from '../fixtures';

const canonicalPoints = Object.fromEntries(
  'ABCDEFGHIJKL'
    .split('')
    .map((g) => [g, { [`${g}1`]: standing({ pos: 1 }), [`${g}2`]: standing({ pos: 2 }) }]),
);
const canonicalQf = [
  ['E1', 'A2'],
  ['K2', 'D1'],
  ['C1', 'A1'],
  ['J1', 'B1'],
];

describe('bracketBuilder', () => {
  it.each([
    'cuartos de final',
    'semifinal',
    'quarter-final',
    'octavos de final',
    'third place final',
  ])('does not classify %s as the final', (round) => {
    const fixture = game({
      round,
      home: 'E1',
      away: 'A2',
      finished: true,
      home_score: 1,
      away_score: 0,
    });
    expect(isMatchInRound(fixture, 'final')).toBe(false);
    expect(buildBracketData(canonicalPoints, {}, [fixture]).champion).toBeNull();
  });
  it('anchors rescheduled and reversed quarterfinals to their FIFA branches', () => {
    const result = buildBracketData(canonicalPoints, {}, [
      game({ round: 'qf', home: 'B1', away: 'J1', date: '2026-07-01T12:00:00Z' }),
      game({ round: 'qf', home: 'A2', away: 'E1', date: '2026-07-20T12:00:00Z' }),
    ]);
    expect(result.qf).toEqual([
      ['E1', 'A2'],
      [null, null],
      [null, null],
      ['J1', 'B1'],
    ]);
  });
  it('deduce cuartos distintos desde octavos sin partidos explícitos de cuartos', () => {
    const points = Object.fromEntries(
      'ABCDEFGHIJKL'.split('').map((group) => [
        group,
        {
          [`${group}1`]: standing({ pos: 1 }),
          [`${group}2`]: standing({ pos: 2 }),
        },
      ]),
    );
    const pairs = [
      ['E1', 'T1'],
      ['I1', 'T2'],
      ['A2', 'B2'],
      ['F1', 'C2'],
      ['K2', 'L2'],
      ['H1', 'J2'],
      ['D1', 'T3'],
      ['G1', 'T4'],
    ];
    const r32 = pairs.map(([home, away]) =>
      game({ round: 'r32', home, away, home_score: 1, away_score: 0, finished: true }),
    );
    const r16 = [
      ['E1', 'I1'],
      ['A2', 'F1'],
      ['K2', 'H1'],
      ['D1', 'G1'],
    ].map(([home, away]) =>
      game({ round: 'r16', home, away, home_score: 1, away_score: 0, finished: true }),
    );
    const result = buildBracketData(points, {}, [...r32, ...r16]);
    expect(result.qf).toEqual([
      [
        { name: 'E1', isProvisional: false },
        { name: 'A2', isProvisional: false },
      ],
      [
        { name: 'K2', isProvisional: false },
        { name: 'D1', isProvisional: false },
      ],
      [null, null],
      [null, null],
    ]);
  });
  it.each([0, 1, 2, 3, 4])('conserva cuatro huecos con %s cuartos publicados', (count) => {
    const result = buildBracketData(
      {},
      {},
      Array.from({ length: count }, (_, i) => game({ round: 'qf', home: `L${i}`, away: `V${i}` })),
    );
    expect(result.qf).toHaveLength(4);
    expect(result.qf).toEqual(Array.from({ length: 4 }, () => [null, null]));
  });

  it.each([0, 1, 2])('conserva dos huecos con %s semifinales publicadas', (count) => {
    const result = buildBracketData(
      {},
      {},
      Array.from({ length: count }, (_, i) => game({ round: 'sf', home: `L${i}`, away: `V${i}` })),
    );
    expect(result.sf).toHaveLength(2);
    expect(result.sf).toEqual(Array.from({ length: 2 }, () => [null, null]));
  });

  it('propaga ganadores de cuartos a semifinales independientes', () => {
    const result = buildBracketData(
      canonicalPoints,
      {},
      Array.from({ length: 4 }, (_, i) =>
        game({
          round: 'qf',
          home: canonicalQf[i][0],
          away: canonicalQf[i][1],
          home_score: 1,
          away_score: 0,
          finished: true,
        }),
      ),
    );
    expect(result.sf).toEqual([
      [
        { name: 'E1', isProvisional: false },
        { name: 'K2', isProvisional: false },
      ],
      [
        { name: 'C1', isProvisional: false },
        { name: 'J1', isProvisional: false },
      ],
    ]);
    expect(new Set(result.qf).size).toBe(4);
    expect(new Set(result.sf).size).toBe(2);
  });

  it('does not mistake finished group matches for the tournament final or 3rd place match', () => {
    const mockGames = [
      {
        home: 'México',
        away: 'Sudáfrica',
        home_score: 2,
        away_score: 0,
        finished: true,
        winner: 'México',
        round: 'final', // Malformed/polluted round from ESPN status
        groupName: 'A',
      },
      {
        home: 'Canadá',
        away: 'Bosnia y Her.',
        home_score: 1,
        away_score: 1,
        finished: true,
        winner: null,
        round: 'third', // Malformed/polluted round
        groupName: 'B',
      },
    ];

    const result = buildBracketData({}, {}, mockGames.map(game));

    // Final and 3rd place matches should not pick up group stage matches
    expect(result.final).toEqual([null, null]);
    expect(result.champion).toBeNull();
    expect(result.thirdPlaceMatch).toEqual([null, null]);
    expect(result.thirdPlaceWinner).toBeNull();
  });

  it('correctly detects genuine tournament knockout final and third place match', () => {
    const mockGames = [
      {
        home: 'España',
        away: 'Francia',
        home_score: 3,
        away_score: 1,
        finished: true,
        winner: 'España',
        round: 'final',
        groupName: null,
      },
      {
        home: 'Brasil',
        away: 'Argentina',
        home_score: 2,
        away_score: 1,
        finished: true,
        winner: 'Brasil',
        round: 'third',
        groupName: null,
      },
    ];

    const result = buildBracketData(
      {
        H: { España: standing({ pos: 1 }) },
        C: { Francia: standing({ pos: 1 }) },
        E: { Brasil: standing({ pos: 1 }) },
        J: { Argentina: standing({ pos: 1 }) },
      },
      {},
      mockGames.map(game),
    );

    expect(result.final).toEqual(['España', 'Francia']);
    expect(result.champion).toEqual({ name: 'España', isProvisional: false });
    expect(result.thirdPlaceMatch).toEqual(['Brasil', 'Argentina']);
    expect(result.thirdPlaceWinner).toEqual({ name: 'Brasil', isProvisional: false });
  });
});
