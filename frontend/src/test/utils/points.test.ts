import { describe, it, expect } from 'vitest';
import { compareTeams } from '../../utils/points';

describe('compareTeams in points.ts', () => {
  const teamA = { name: 'España' };
  const teamB = { name: 'Alemania' };

  it('ordena por puntos totales cuando no hay empate', () => {
    const officialPoints = {
      'Grupo A': {
        España: { pts: 6, diff: 2, gls: 4, fp: 0 },
        Alemania: { pts: 3, diff: 0, gls: 2, fp: 0 },
      },
    };

    // a = España, b = Alemania -> ptsB (3) - ptsA (6) < 0 -> a queda antes
    const result = compareTeams(teamA, teamB, 'Grupo A', officialPoints, [], {});
    expect(result).toBeLessThan(0);
  });

  it('desempata por diferencia de goles si los puntos son iguales', () => {
    const officialPoints = {
      'Grupo A': {
        España: { pts: 4, diff: +3, gls: 5, fp: 0 },
        Alemania: { pts: 4, diff: +1, gls: 3, fp: 0 },
      },
    };

    const result = compareTeams(teamA, teamB, 'Grupo A', officialPoints, [], {});
    expect(result).toBeLessThan(0);
  });

  it('desempata por goles a favor si puntos y diferencia son iguales', () => {
    const officialPoints = {
      'Grupo A': {
        España: { pts: 4, diff: +2, gls: 6, fp: 0 },
        Alemania: { pts: 4, diff: +2, gls: 4, fp: 0 },
      },
    };

    const result = compareTeams(teamA, teamB, 'Grupo A', officialPoints, [], {});
    expect(result).toBeLessThan(0);
  });

  it('desempata por Fair Play cuando todo lo demás está empatado', () => {
    const officialPoints = {
      'Grupo A': {
        España: { pts: 4, diff: +2, gls: 4, fp: -1 },
        Alemania: { pts: 4, diff: +2, gls: 4, fp: -3 },
      },
    };

    // fpA (-1) > fpB (-3) -> España tiene mejor fairplay (menos tarjetas)
    const result = compareTeams(teamA, teamB, 'Grupo A', officialPoints, [], {});
    expect(result).toBeLessThan(0);
  });

  it('desempata por enfrentamiento directo (Head-to-Head) si existe partido', () => {
    const officialPoints = {
      'Grupo A': {
        España: { pts: 3, diff: 0, gls: 2, fp: 0 },
        Alemania: { pts: 3, diff: 0, gls: 2, fp: 0 },
      },
    };

    const nameToId = { España: 1, Alemania: 2 };
    const allGames = [
      {
        home_team_id: 1,
        away_team_id: 2,
        home_score: '2',
        away_score: '1',
      },
    ];

    const result = compareTeams(teamA, teamB, 'Grupo A', officialPoints, allGames, nameToId);
    expect(result).toBeLessThan(0);
  });
});
