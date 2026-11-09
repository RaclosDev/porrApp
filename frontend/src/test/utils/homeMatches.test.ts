import { describe, expect, it } from 'vitest';
import {
  currentRoundMatches,
  hasShownScore,
  isLiveMatch,
  upcomingMatches,
} from '../../utils/homeMatches';
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
  it('does not show last season results while the next playoffs have not started', () => {
    const finals = game({
      id: 1,
      home: 'Thunder',
      away: 'Knicks',
      date: '2026-06-14T00:00:00Z',
      status: 'FINISHED',
      finished: true,
    });
    expect(upcomingMatches([finals], 6, NOW)).toEqual({ finished: true, matches: [] });
    const recent = { ...finals, id: 2, date: '2026-10-30T00:00:00Z' };
    expect(upcomingMatches([finals, recent], 6, NOW).matches).toEqual([recent]);
  });

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

describe('currentRoundMatches', () => {
  const week = (played: number, total: number) =>
    Array.from({ length: total }, (_, i) =>
      game({
        id: i + 1,
        home: `Local ${i}`,
        away: `Visitante ${i}`,
        round: 'Semana 3',
        date: new Date(Date.parse('2026-11-02T00:00:00Z') + i * 3_600_000).toISOString(),
        finished: i < played,
        status: i < played ? 'FINISHED' : 'SCHEDULED',
      }),
    );

  it('una jornada normal va entera', () => {
    expect(currentRoundMatches(week(5, 10)).matches).toHaveLength(10);
  });

  it('de una semana de la NBA enseña los últimos resultados y los siguientes partidos', () => {
    const { round, matches } = currentRoundMatches(week(46, 54));
    expect(round).toBe('Semana 3');
    expect(matches.map((m) => m.id)).toEqual([44, 45, 46, 47, 48, 49, 50, 51, 52, 53]);
  });

  it('con la semana recién empezada, desde el primer partido', () => {
    expect(currentRoundMatches(week(0, 50)).matches.map((m) => m.id)[0]).toBe(1);
  });
});
