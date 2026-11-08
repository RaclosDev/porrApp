import { describe, expect, it } from 'vitest';
import { hasShownScore, isLiveMatch, upcomingMatches } from '../../utils/homeMatches';
import { game } from '../fixtures';

const NOW = Date.parse('2026-11-08T12:00:00Z');

describe('isLiveMatch', () => {
  it('is live only when ESPN says so, never because kick-off has passed', () => {
    const base = { home: 'Athletic Club', away: 'Getafe', date: '2026-10-25T13:00:00Z' };
    expect(isLiveMatch(game({ ...base, status: 'SCHEDULED' }))).toBe(false);
    expect(isLiveMatch(game({ ...base, status: 'LIVE' }))).toBe(true);
    expect(isLiveMatch(game({ ...base, status: 'LIVE', finished: true }))).toBe(false);
  });

  it('an event without teams (a Grand Prix, an undecided tie) is never a live match', () => {
    expect(isLiveMatch(game({ home: 'Por definir', away: 'Por definir', status: 'LIVE' }))).toBe(
      false,
    );
    expect(isLiveMatch(game({ home: '', away: 'Brasil', status: 'LIVE' }))).toBe(false);
  });
});

describe('hasShownScore', () => {
  it('hides a 0-0 of a match that has not started', () => {
    const notStarted = game({
      home: 'A',
      away: 'B',
      status: 'SCHEDULED',
      home_score: 0,
      away_score: 0,
    });
    expect(hasShownScore(notStarted)).toBe(false);
    expect(hasShownScore({ ...notStarted, status: 'LIVE' })).toBe(true);
    expect(hasShownScore({ ...notStarted, finished: true, status: 'FINISHED' })).toBe(true);
  });
});

describe('upcomingMatches', () => {
  it('never lists past matches as upcoming nor placeholders as matches', () => {
    const { finished, matches } = upcomingMatches(
      [
        game({
          id: 1,
          home: 'Barcelona',
          away: 'Real Madrid',
          date: '2026-10-25T20:00:00Z',
          status: 'SCHEDULED',
        }),
        game({
          id: 2,
          home: 'Por definir',
          away: 'Por definir',
          date: '2026-11-07T18:00:00Z',
          status: 'LIVE',
        }),
        game({
          id: 3,
          home: 'Gen.G',
          away: 'Invictus',
          date: '2026-11-08T11:00:00Z',
          status: 'LIVE',
        }),
        game({
          id: 4,
          home: 'Sevilla',
          away: 'Osasuna',
          date: '2026-11-09T20:00:00Z',
          status: 'SCHEDULED',
        }),
      ],
      6,
      NOW,
    );
    expect(finished).toBe(false);
    expect(matches.map((m) => m.id)).toEqual([3, 4]);
  });
});
