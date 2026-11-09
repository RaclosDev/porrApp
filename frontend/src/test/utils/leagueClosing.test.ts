import { describe, expect, it } from 'vitest';
import type { LeaderboardRow } from '../../hooks/useLeaderboard';
import {
  closingHeadline,
  closingResultText,
  closingShareText,
  joinNames,
  leagueClosing,
} from '../../utils/leagueClosing';

const row = (userId: number, name: string, total: number, rank: number | '-' = 1) =>
  ({
    key: userId,
    id: userId,
    userId,
    name,
    paid: rank !== '-',
    rank,
    points: { total },
  }) as LeaderboardRow;

const ranking = [
  row(1, 'Ana', 120, 1),
  row(2, 'Luis', 110, 2),
  row(3, 'Eva', 98, 3),
  row(4, 'Pau', 98, 3),
  row(5, 'Marta', 80, 4),
];

describe('leagueClosing', () => {
  it('gives the champion, the podium with ties together and the result of the user', () => {
    const closing = leagueClosing(ranking, '5');

    expect(closing.champions).toEqual(['Ana']);
    expect(closing.places).toEqual([
      { rank: 1, score: 120, names: ['Ana'] },
      { rank: 2, score: 110, names: ['Luis'] },
      { rank: 3, score: 98, names: ['Eva', 'Pau'] },
    ]);
    expect(closing.me).toEqual({ rank: 4, points: 80, participants: 5 });
  });

  it('has several champions when the top is tied', () => {
    const closing = leagueClosing([row(1, 'Ana', 50, 1), row(2, 'Luis', 50, 1)], 2);

    expect(closing.champions).toEqual(['Ana', 'Luis']);
    expect(closing.me).toEqual({ rank: 1, points: 50, participants: 2 });
  });

  it('has no podium when nobody scored and no result for who is not in the ranking', () => {
    const closing = leagueClosing([row(1, 'Ana', 0, 1)], 9);

    expect(closing.champions).toEqual([]);
    expect(closing.places).toEqual([]);
    expect(closing.me).toBeNull();
    expect(leagueClosing(ranking, null).me).toBeNull();
  });
});

describe('closing texts', () => {
  it('joins names the Spanish way', () => {
    expect(joinNames(['Ana'])).toBe('Ana');
    expect(joinNames(['Ana', 'Luis'])).toBe('Ana y Luis');
    expect(joinNames(['Ana', 'Luis', 'Eva'])).toBe('Ana, Luis y Eva');
  });

  it('names the winner, or the winners, in the headline', () => {
    expect(closingHeadline(['Ana'], 'Los Cracks')).toBe('Ana gana Los Cracks');
    expect(closingHeadline(['Ana', 'Luis'], 'Los Cracks')).toBe('Ana y Luis ganan Los Cracks');
    expect(closingHeadline([], 'Los Cracks')).toBe('Los Cracks ha terminado');
  });

  it('tells the user how they finished', () => {
    expect(closingResultText({ rank: 4, points: 80, participants: 5 })).toBe(
      'Has quedado 4.º de 5 con 80 pts',
    );
  });

  it('builds a share summary with names and points only', () => {
    const text = closingShareText(leagueClosing(ranking, 5), 'Los Cracks', 'LaLiga');

    expect(text).toBe(
      [
        '🏆 Ana gana «Los Cracks» (LaLiga)',
        '1.º Ana · 120 pts',
        '2.º Luis · 110 pts',
        '3.º Eva y Pau · 98 pts',
        'Yo: 4.º de 5 · 80 pts',
      ].join('\n'),
    );
    expect(text).not.toMatch(/@|https?:/);
  });

  it('does not repeat the competition when the league is named after it', () => {
    expect(closingShareText(leagueClosing(ranking, null), 'LaLiga', 'laliga ')).toMatch(
      /^🏆 Ana gana «LaLiga»\n/,
    );
  });
});
