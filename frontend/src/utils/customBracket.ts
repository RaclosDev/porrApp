export type CustomPair = [string, string | null];

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
