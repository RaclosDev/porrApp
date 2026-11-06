import type { Match, PredictionData } from '../types/api';
import { customMatchWinner, pairWinners, type CustomPair } from './customBracket';

interface NamedTeam {
  name: string;
  groupName: string | null;
}

/** Equipos de cada grupo, con los grupos en orden alfabético. */
export function teamsByGroup(teams: NamedTeam[]): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const team of teams) {
    if (team.groupName) (result[team.groupName] ??= []).push(team.name);
  }
  return Object.fromEntries(
    Object.entries(result).sort(([left], [right]) => left.localeCompare(right, 'es')),
  );
}

/** Cruces de la primera ronda. Los oficiales ya llegan en el orden en que se pintan. */
export function firstRoundPairs(matches: Match[], official: boolean): CustomPair[] {
  return matches
    .filter((match) => match.round === 'bracket-1')
    .sort((left, right) => (official ? 0 : left.id - right.id))
    .map((match) => [match.home, match.away_team_id ? match.away : null]);
}

export interface BracketResults {
  /** Ganadores reales de cada ronda, para marcar aciertos y fallos. */
  realWinners: Set<string>[];
  /** Ronda en la que cayó cada equipo, para marcarlo eliminado desde ahí en adelante. */
  eliminatedAt: Map<string, number>;
  /** Rondas en las que ya se han jugado todos los cruces (los pases directos cuentan como jugados). */
  decidedRounds: boolean[];
}

/** Lo que ya ha pasado en el cuadro real, ronda a ronda («bracket-N»). */
export function bracketResults(matches: Match[]): BracketResults {
  const realWinners: Set<string>[] = [];
  const eliminatedAt = new Map<string, number>();
  const decidedRounds: boolean[] = [];
  for (const match of matches) {
    const found = /^bracket-(\d+)$/.exec(match.round ?? '');
    if (!found) continue;
    const index = Number(found[1]) - 1;
    decidedRounds[index] =
      (decidedRounds[index] ?? true) && (!match.away_team_id || match.finished);
    const winner = match.away_team_id ? customMatchWinner(match) : null;
    if (!winner) continue;
    (realWinners[index] ??= new Set()).add(winner);
    const loser = winner === match.home ? match.away : match.home;
    if (loser) eliminatedAt.set(loser, index);
  }
  return { realWinners, eliminatedAt, decidedRounds };
}

interface PredictionInput {
  firstRound: CustomPair[];
  picks: string[][];
  groups: Record<string, string[]>;
  teamsByGroup: Record<string, string[]>;
  /** Cuadro completo: también hay que ordenar los grupos. */
  isFullBracket: boolean;
  userName: string;
  predictionName: string;
}

/** El pronóstico listo para guardar, o null si falta algún grupo o algún cruce por elegir. */
export function completeCustomPrediction({
  firstRound,
  picks,
  groups,
  teamsByGroup: groupTeams,
  isFullBracket,
  userName,
  predictionName,
}: PredictionInput): PredictionData | null {
  if (!firstRound.length) return null;
  const orderedGroups: Record<string, string[]> = {};
  if (isFullBracket) {
    for (const [group, members] of Object.entries(groupTeams)) {
      const order = groups[group] ?? [];
      if (
        order.length !== members.length ||
        new Set(order).size !== members.length ||
        order.some((name) => !members.includes(name))
      ) {
        return null;
      }
      orderedGroups[group] = order;
    }
  }
  const completed: string[][] = [];
  let current = firstRound;
  while (current.length > 0) {
    const winners = pairWinners(current, picks[completed.length] ?? []);
    if (!winners) return null;
    completed.push(winners);
    if (winners.length === 1) break;
    const next: CustomPair[] = [];
    for (let slot = 0; slot < winners.length; slot += 2) {
      next.push([winners[slot], winners[slot + 1] ?? null]);
    }
    current = next;
  }
  const champion = completed[completed.length - 1]?.[0];
  if (!champion) return null;
  return {
    user: userName,
    prediction: predictionName.trim() || userName || 'Mi predicción',
    groups: orderedGroups,
    customRounds: completed,
    r16: [],
    champion,
  };
}
