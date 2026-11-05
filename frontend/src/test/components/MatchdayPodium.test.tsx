import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import MatchdayPodium, { podiumPlaces } from '../../components/MatchdayPodium';
import type { LeaderboardRow } from '../../hooks/useLeaderboard';

const row = (id: number, name: string, total: number, paid = true) =>
  ({
    key: id,
    id,
    userId: id,
    name,
    avatarUrl: '',
    points: { total },
    paid,
  }) as unknown as LeaderboardRow;

// Clasificación con empates en el segundo y el tercer puesto (1, 2, 2, 3, 3).
const tied = [
  row(1, 'Raclos', 20),
  row(2, 'Cristian', 10),
  row(3, 'Giorgi', 10),
  row(4, 'JS', 0),
  row(5, 'Panchito', 0),
];

it('keeps the podium with ties, including a third place on zero points', () => {
  const places = podiumPlaces(tied);
  expect(places.map((p) => [p.score, p.leaders.map((l) => l.name)])).toEqual([
    [20, ['Raclos']],
    [10, ['Cristian', 'Giorgi']],
    [0, ['JS', 'Panchito']],
  ]);
  render(<MatchdayPodium rows={tied} />);
  expect(screen.getByLabelText('Podio de la clasificación general')).toBeInTheDocument();
  expect(screen.getAllByText('Empate')).toHaveLength(2);
});

it('hides the podium while nobody has scored and skips unpaid members', () => {
  expect(podiumPlaces([row(1, 'A', 0), row(2, 'B', 0)])).toEqual([]);
  expect(podiumPlaces([row(1, 'A', 5, false), row(2, 'B', 3)]).map((p) => p.score)).toEqual([3]);
});
