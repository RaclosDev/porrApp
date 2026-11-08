import { describe, expect, it } from 'vitest';
import { byeTeams } from '../../../components/matchday/NflByeTeams';
import type { LeagueStanding } from '../../../types/api';
import { matchdayFixture } from '../../context/fixtures';

const team = (teamName: string): LeagueStanding =>
  ({ rank: 1, teamName, points: 0, gamesPlayed: 8, wins: 0, ties: 0, losses: 0 }) as LeagueStanding;

const standings = ['Bills', 'Jets', 'Chiefs', 'Raiders', 'Bears', 'Lions'].map(team);
const week = [
  matchdayFixture({ homeTeam: 'Chiefs', awayTeam: 'Raiders' }),
  matchdayFixture({ homeTeam: 'Bears', awayTeam: 'Lions' }),
];

describe('byeTeams', () => {
  it('da los equipos de la tabla que no juegan en la semana', () => {
    expect(byeTeams(standings, 'Semana 9', week).map((t) => t.teamName)).toEqual(['Bills', 'Jets']);
  });

  it('en los playoffs no hay descansos, solo eliminados', () => {
    expect(byeTeams(standings, 'Ronda divisional', week)).toEqual([]);
  });

  it('no se inventa descansos si un nombre del calendario no está en la tabla', () => {
    const renamed = [week[0], matchdayFixture({ homeTeam: 'Chicago', awayTeam: 'Lions' })];
    expect(byeTeams(standings, 'Semana 9', renamed)).toEqual([]);
    expect(byeTeams(standings, 'Semana 9', [])).toEqual([]);
  });
});
