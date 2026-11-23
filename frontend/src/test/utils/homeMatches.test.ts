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

  // Los partidos de `week` van de hora en hora desde el 2 de noviembre a medianoche.
  const at = (hour: number, minutes = 0) =>
    Date.parse('2026-11-02T00:00:00Z') + hour * 3_600_000 + minutes * 60_000;
  const ids = (list: { id: number }[]) => list.map((m) => m.id);

  it('con el siguiente partido cerca, primero lo que queda y después los resultados, el último arriba', () => {
    const { matches, flipped } = currentRoundMatches(week(5, 10), at(4, 50));
    expect(ids(matches)).toEqual([6, 7, 8, 9, 10, 5, 4, 3, 2, 1]);
    expect(ids(flipped)).toEqual([5, 4, 3, 2, 1, 6, 7, 8, 9, 10]);
  });

  it('con el último resultado más cerca que el siguiente partido, primero los resultados', () => {
    const { matches, flipped } = currentRoundMatches(week(5, 10), at(4, 10));
    expect(ids(matches)).toEqual([5, 4, 3, 2, 1, 6, 7, 8, 9, 10]);
    expect(ids(flipped)).toEqual([6, 7, 8, 9, 10, 5, 4, 3, 2, 1]);
  });

  it('con un partido en juego, lo pendiente va siempre primero', () => {
    const games = week(5, 10);
    games[5] = { ...games[5], status: 'IN_PROGRESS' };
    expect(ids(currentRoundMatches(games, at(4, 10)).matches)[0]).toBe(6);
  });

  it('sin nada jugado todavía, la jornada va entera y sin bloques', () => {
    const { matches, flipped } = currentRoundMatches(week(0, 10), at(0));
    expect(matches).toHaveLength(10);
    expect(flipped).toEqual([]);
  });

  it('una jornada ya acabada va entera y sin bloques', () => {
    const { matches, flipped } = currentRoundMatches(week(10, 10), at(12));
    expect(ids(matches)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(flipped).toEqual([]);
  });

  it('de una semana de la NBA enseña los siguientes partidos y guarda sitio para los últimos resultados', () => {
    const { round, matches } = currentRoundMatches(week(46, 54), at(45, 50));
    expect(round).toBe('Semana 3');
    expect(ids(matches)).toEqual([47, 48, 49, 50, 51, 52, 53, 46, 45, 44]);
  });

  it('con la semana recién empezada, desde el primer partido', () => {
    expect(currentRoundMatches(week(0, 50)).matches.map((m) => m.id)[0]).toBe(1);
  });
});
