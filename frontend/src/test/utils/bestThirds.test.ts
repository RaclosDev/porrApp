import { describe, expect, it } from 'vitest';
import type { TeamStanding } from '../../types/api';
import { rankBestThirds } from '../../utils/bestThirds';

const row = (pos: number, pts: number, diff = 0, gls = 0, fp = 0): TeamStanding => ({
  pts,
  diff,
  gls,
  mp: 3,
  fp,
  pos,
  status: 0,
});

describe('rankBestThirds', () => {
  it('takes the team the backend placed third in each group', () => {
    const thirds = rankBestThirds({
      A: { España: row(1, 9), Japón: row(3, 3), Marruecos: row(2, 6) },
      B: { Brasil: row(1, 7), Suiza: row(2, 5), Ghana: row(4, 0), Serbia: row(3, 4) },
    });

    expect(thirds.map((t) => [t.group, t.name])).toEqual([
      ['B', 'Serbia'],
      ['A', 'Japón'],
    ]);
  });

  it('breaks ties by goal difference, goals scored, fair play and name', () => {
    const thirds = rankBestThirds({
      A: { Alfa: row(3, 4, 1, 3, -2) },
      B: { Beta: row(3, 4, 2, 1) },
      C: { Gamma: row(3, 4, 1, 4) },
      D: { Delta: row(3, 4, 1, 3, 0) },
      E: { Épsilon: row(3, 4, 1, 3, 0) },
    });

    expect(thirds.map((t) => t.name)).toEqual(['Beta', 'Gamma', 'Delta', 'Épsilon', 'Alfa']);
  });

  it('follows the order among thirds the backend worked out with the tournament rules', () => {
    // Eurocopa: con los mismos puntos y goles, la UEFA mira las victorias antes que las tarjetas,
    // y eso no se deduce de estas columnas. Manda el puesto que llega en `third`.
    const thirds = rankBestThirds({
      A: { 'Tres empates': { ...row(3, 3, 0, 2, -1), third: 2 } },
      B: { 'Una victoria': { ...row(3, 3, 0, 2, -5), third: 1 } },
      C: { 'Menos puntos': { ...row(3, 2, 0, 2), third: 3 } },
    });

    expect(thirds.map((t) => t.name)).toEqual(['Una victoria', 'Tres empates', 'Menos puntos']);
  });

  it('skips groups without a materialized third place', () => {
    expect(rankBestThirds({ A: { España: row(0, 0), Japón: row(0, 0) } })).toEqual([]);
    expect(rankBestThirds(null)).toEqual([]);
  });
});
