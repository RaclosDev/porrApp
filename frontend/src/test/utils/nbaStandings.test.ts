import { describe, expect, it } from 'vitest';
import type { LeagueStanding } from '../../types/api';
import { gamesBehind, nbaStandingsGroups, nbaZone, winPercentage } from '../../utils/nbaStandings';

const row = (
  rank: number,
  teamName: string,
  wins: number,
  losses: number,
  group: string,
  division: string,
): LeagueStanding => ({
  group,
  division,
  rank,
  teamName,
  teamLogo: null,
  points: wins,
  gamesPlayed: wins + losses,
  wins,
  ties: 0,
  losses,
  goalDiff: 0,
  goalsFor: 0,
  goalsAgainst: 0,
});

const table: LeagueStanding[] = [
  row(1, 'Philadelphia 76ers', 8, 2, 'Conferencia Este', 'Atlántico'),
  row(2, 'Detroit Pistons', 6, 2, 'Conferencia Este', 'Central'),
  row(3, 'Atlanta Hawks', 7, 4, 'Conferencia Este', 'Sureste'),
  row(4, 'Boston Celtics', 5, 4, 'Conferencia Este', 'Atlántico'),
  row(1, 'Los Angeles Lakers', 8, 2, 'Conferencia Oeste', 'Pacífico'),
  row(2, 'Denver Nuggets', 5, 3, 'Conferencia Oeste', 'Noroeste'),
];

describe('tabla de la NBA', () => {
  it('por conferencias deja las tablas del servidor', () => {
    const groups = nbaStandingsGroups(table, 'conference');
    expect(groups.map((group) => group.title)).toEqual(['Conferencia Este', 'Conferencia Oeste']);
    expect(groups[0].rows.map((r) => r.rank)).toEqual([1, 2, 3, 4]);
  });

  it('por divisiones las ordena como la NBA y numera cada una', () => {
    const groups = nbaStandingsGroups(table, 'division');
    expect(groups.map((group) => group.title)).toEqual([
      'División Atlántico',
      'División Central',
      'División Sureste',
      'División Noroeste',
      'División Pacífico',
    ]);
    expect(groups[0].rows.map((r) => [r.teamName, r.rank])).toEqual([
      ['Philadelphia 76ers', 1],
      ['Boston Celtics', 2],
    ]);
  });

  it('da el porcentaje y los partidos por detrás como en la NBA', () => {
    expect(winPercentage(table[0])).toBe('.800');
    expect(winPercentage(row(1, 'Invicto', 5, 0, 'x', 'y'))).toBe('1.000');
    expect(winPercentage(row(1, 'Nuevo', 0, 0, 'x', 'y'))).toBe('.000');
    const east = table.slice(0, 4);
    expect(gamesBehind(east[0], east)).toBe('–');
    expect(gamesBehind(east[1], east)).toBe('1');
    expect(gamesBehind(east[2], east)).toBe('1,5');
    expect(gamesBehind(east[3], east)).toBe('2,5');
  });

  it('marca las zonas de playoffs y play-in', () => {
    expect(nbaZone(1)).toBe('playoff');
    expect(nbaZone(6)).toBe('playoff');
    expect(nbaZone(7)).toBe('playin');
    expect(nbaZone(10)).toBe('playin');
    expect(nbaZone(11)).toBeNull();
  });
});
