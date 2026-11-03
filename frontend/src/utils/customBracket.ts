export type CustomPair = [string, string | null];

export interface CustomBracketMatchSlot {
  home: string | null;
  away: string | null;
  homePlaceholder: string;
  awayPlaceholder: string;
  isBye: boolean;
}

export interface CustomBracketDisplayRound {
  roundIndex: number;
  title: string;
  matches: CustomBracketMatchSlot[];
}

export function pairWinners(pairs: CustomPair[], picks: string[]): string[] | null {
  const winners: string[] = [];
  for (let index = 0; index < pairs.length; index++) {
    const [home, away] = pairs[index];
    const pick = picks[index] || (!away ? home : '');
    if (pick !== home && pick !== away) return null;
    winners.push(pick);
  }
  return winners;
}

export function getCustomRoundTitle(roundIndex: number, totalRounds: number): string {
  const distance = totalRounds - 1 - roundIndex;
  switch (distance) {
    case 0:
      return 'Final';
    case 1:
      return 'Semifinales';
    case 2:
      return 'Cuartos de final';
    case 3:
      return 'Octavos de final';
    case 4:
      return 'Dieciseisavos de final';
    default:
      return `Ronda ${roundIndex + 1}`;
  }
}

export function getTotalRounds(firstRoundCount: number): number {
  if (firstRoundCount <= 0) return 0;
  let count = firstRoundCount;
  let total = 0;
  while (count > 0) {
    total++;
    if (count === 1) break;
    count = Math.ceil(count / 2);
  }
  return total;
}

/**
 * Calcula todas las rondas de un cuadro eliminatorio desde los cruces de la primera ronda
 * hasta la final, rellenando con nombres reales o descripciones según las elecciones.
 */
export function computeCustomBracketRounds(
  firstRound: CustomPair[],
  picks: string[][],
): CustomBracketDisplayRound[] {
  if (!firstRound.length) return [];

  const totalRounds = getTotalRounds(firstRound.length);
  const result: CustomBracketDisplayRound[] = [];
  let currentPairs: (string | null)[][] = firstRound.map(([h, a]) => [h, a]);

  for (let roundIndex = 0; roundIndex < totalRounds; roundIndex++) {
    const title = getCustomRoundTitle(roundIndex, totalRounds);
    const roundPicks = picks[roundIndex] ?? [];
    const matches: CustomBracketMatchSlot[] = [];
    const resolvedWinners: (string | null)[] = [];

    for (let m = 0; m < currentPairs.length; m++) {
      const [h, a] = currentPairs[m];
      const isBye = a === null && roundIndex === 0 && firstRound[m]?.[1] === null;
      const homePlaceholder = h || (roundIndex === 0 ? 'Equipo' : `Ganador C${m * 2 + 1}`);
      const awayPlaceholder =
        a || (isBye ? 'Descanso' : roundIndex === 0 ? 'Equipo' : `Ganador C${m * 2 + 2}`);

      matches.push({
        home: h,
        away: a,
        homePlaceholder,
        awayPlaceholder,
        isBye,
      });

      // Ganador de este cruce
      if (isBye && h) {
        resolvedWinners.push(h);
      } else {
        const pick = roundPicks[m];
        if (pick && (pick === h || pick === a)) {
          resolvedWinners.push(pick);
        } else {
          resolvedWinners.push(null);
        }
      }
    }

    result.push({ roundIndex, title, matches });

    // Preparar parejas de la siguiente ronda
    if (roundIndex < totalRounds - 1) {
      const nextPairs: (string | null)[][] = [];
      for (let slot = 0; slot < resolvedWinners.length; slot += 2) {
        const homeWinner = resolvedWinners[slot] ?? null;
        const awayWinner =
          slot + 1 < resolvedWinners.length ? (resolvedWinners[slot + 1] ?? null) : null;
        nextPairs.push([homeWinner, awayWinner]);
      }
      currentPairs = nextPairs;
    }
  }

  return result;
}
