import { describe, it, expect } from 'vitest';
import { buildEvolution, buildStages } from '../../components/evolution/evolutionData';
import type { LeaderboardRow } from '../../hooks/useLeaderboard';
import type { Match } from '../../types/api';

const row = (key: number, name: string, points: Record<string, number>): LeaderboardRow =>
  ({
    key,
    id: key,
    userId: key,
    name,
    predictionName: '',
    avatarUrl: '',
    points: { total: 0, matchday: 0, log: [], ...points },
    matchdayPoints: 0,
    paid: true,
    thirdPlaceMatch: null,
    thirdPlaceWinner: null,
  }) as unknown as LeaderboardRow;

describe('evolutionData', () => {
  const results = [
    row(1, 'Ana', { r1: 10, r32: 5, total: 15 }),
    row(2, 'Luis', { r1: 12, r32: 0, total: 12 }),
  ];

  it('termina el eje por rondas en la última ronda con puntos', () => {
    const stages = buildStages('rounds', results, []);
    expect(stages.map((s) => s.key)).toEqual(['r1', 'r32']);
  });

  it('acumula puntos y calcula la posición en cada ronda', () => {
    const stages = buildStages('rounds', results, []);
    const { users } = buildEvolution(results, 'Ana', 'rounds', stages, {});
    const ana = users.find((u) => u.name === 'Ana');
    const luis = users.find((u) => u.name === 'Luis');

    expect(ana?.pointsEvolution).toEqual([10, 15]);
    expect(luis?.pointsEvolution).toEqual([12, 12]);
    expect(ana?.rankEvolution).toEqual([2, 1]);
    expect(ana?.isMe).toBe(true);
  });

  describe('torneo que empieza en octavos y no juega el tercer puesto', () => {
    const euro = { firstRound: 'r16', thirdPlaceMatch: false } as const;
    const euroResults = [
      row(1, 'Ana', { r1: 10, r16: 30, qf: 40, sf: 0, finals: 200, total: 280 }),
      row(2, 'Luis', { r1: 12, r16: 0, qf: 0, sf: 60, finals: 0, total: 72 }),
    ];
    /** Los 15 partidos de sus eliminatorias, en orden: 8 de octavos, 4 de cuartos, 2 semis y la final. */
    const knockouts = (played: number): Match[] =>
      Array.from({ length: 15 }, (_, index) => ({
        id: index + 1,
        home: `Local ${index}`,
        away: `Visitante ${index}`,
        round: index < 8 ? 'r16' : index < 12 ? 'qf' : index < 14 ? 'sf' : 'final',
        date: new Date(Date.UTC(2024, 5, 29 + index)).toISOString(),
        finished: index < played,
      })) as unknown as Match[];

    it('por rondas no tiene dieciseisavos', () => {
      const stages = buildStages('rounds', euroResults, knockouts(15), euro);
      expect(stages.map((s) => s.key)).toEqual(['r1', 'r16', 'qf', 'sf', 'finals', 'total']);
      expect(stages.map((s) => s.label)).not.toContain('Dieciseisavos');

      const { users } = buildEvolution(euroResults, 'Ana', 'rounds', stages, {});
      expect(users.find((u) => u.name === 'Ana')?.pointsEvolution).toEqual([
        10, 40, 80, 80, 280, 280,
      ]);
    });

    it('partido a partido empieza en octavos y acaba en la final', () => {
      const stages = buildStages('matches', euroResults, knockouts(15), euro);
      const labels = stages.map((s) => s.label);
      expect(labels).toEqual([
        'Grupos',
        ...Array(8).fill('Octavos'),
        ...Array(4).fill('Cuartos'),
        ...Array(2).fill('Semis'),
        'Finales',
        'Total',
      ]);
      // Cada ronda enseña su nombre una vez y se cierra en su último partido.
      expect(stages.filter((s) => s.showLabel).map((s) => s.label)).toEqual([
        'Grupos',
        'Octavos',
        'Cuartos',
        'Semis',
        'Finales',
        'Total',
      ]);
      expect(stages.filter((s) => s.isRoundBoundary).map((s) => s.matchTitle)).toEqual([
        'Puntuación tras Fase de Grupos',
        'Local 7 vs Visitante 7',
        'Local 11 vs Visitante 11',
        'Local 13 vs Visitante 13',
        'Local 14 vs Visitante 14',
        'Clasificación Final',
      ]);

      // Al cerrar cada ronda los puntos cuadran con los de la clasificación.
      const { users } = buildEvolution(euroResults, 'Ana', 'matches', stages, {});
      const ana = users.find((u) => u.name === 'Ana')?.pointsEvolution ?? [];
      expect(ana[8]).toBe(40);
      expect(ana[12]).toBe(80);
      expect(ana[14]).toBe(80);
      expect(ana[ana.length - 1]).toBe(280);
    });

    it('sin la final jugada no enseña el total', () => {
      const stages = buildStages('matches', euroResults, knockouts(14), euro);
      expect(stages).toHaveLength(15);
      expect(stages[stages.length - 1].label).toBe('Semis');
    });
  });

  it('el Mundial conserva sus 32 partidos de eliminatoria y el total tras el último', () => {
    const worldCup = (played: number): Match[] =>
      Array.from({ length: 32 }, (_, index) => ({
        id: index + 1,
        home: `Local ${index}`,
        away: `Visitante ${index}`,
        round: 'r32',
        date: new Date(Date.UTC(2026, 5, 28) + index * 3600_000).toISOString(),
        finished: index < played,
      })) as unknown as Match[];
    const labels = (played: number) =>
      buildStages('matches', results, worldCup(played)).map((s) => s.label);

    expect(labels(32)).toEqual([
      'Grupos',
      ...Array(16).fill('1/16'),
      ...Array(8).fill('Octavos'),
      ...Array(4).fill('Cuartos'),
      ...Array(2).fill('Semis'),
      ...Array(2).fill('Finales'),
      'Total',
    ]);
    // Con el tercer puesto jugado y la final pendiente todavía no hay total.
    expect(labels(31).slice(-1)).toEqual(['Finales']);
    expect(buildStages('matches', results, worldCup(32))).toEqual(
      buildStages('matches', results, worldCup(32), { firstRound: 'r32', thirdPlaceMatch: true }),
    );
  });
});
