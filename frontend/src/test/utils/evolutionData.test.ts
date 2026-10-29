import { describe, it, expect } from 'vitest';
import { buildEvolution, buildStages } from '../../components/evolution/evolutionData';
import type { LeaderboardRow } from '../../hooks/useLeaderboard';

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
});
