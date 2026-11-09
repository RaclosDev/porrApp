/**
 * Buscador de jugadores de una liga de tenis: en qué partidos del cuadro ha puesto la liga a un
 * jugador de ganador y quién. Parte de las estadísticas por partido, que solo traen los partidos
 * cuyas predicciones ya se ven. Todo es puro.
 */
import type { MatchStats, MatchVoter, MatchVoters } from '../types/api';
import { percent, type RealStatus } from './bracketStats';
import { displayRoundLabel } from './matchday';
import { GROUP_STAGE, splitRound } from './tennisDraw';

const PLACEHOLDER = 'Por definir';
const FINAL = 'Final';

const byName = (a: string, b: string) => a.localeCompare(b, 'es');
const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);
const isPlayer = (name: string | null | undefined): name is string =>
  Boolean(name && name.trim() && name !== PLACEHOLDER);

type Side = 'home' | 'away';

/** Un partido del jugador con lo que ha puesto la liga y lo que pasó. */
export interface PlayerMatch {
  matchId: number;
  side: Side;
  rival: string;
  /** Ronda del cuadro: «Semifinales». */
  round: string;
  /** Torneo, solo en las ligas que siguen varios. */
  tournament: string | null;
  /** Predicciones que lo dan ganador, sobre las que eligen ganador en ese partido. */
  count: number;
  total: number;
  percent: number;
  /** Si ganó de verdad; `pending` mientras no hay marcador. */
  status: RealStatus;
  /** Marcador en sets visto desde el jugador: «2-1». */
  score: string | null;
}

const sideOf = (match: MatchStats, player: string): Side | null => {
  if (match.homeTeam === player) return 'home';
  return match.awayTeam === player ? 'away' : null;
};

/** Jugadores de los partidos ya visibles, por orden alfabético. */
export function searchablePlayers(matches: MatchStats[]): string[] {
  const names = new Set<string>();
  for (const match of matches) {
    if (isPlayer(match.homeTeam)) names.add(match.homeTeam);
    if (isPlayer(match.awayTeam)) names.add(match.awayTeam);
  }
  return [...names].sort(byName);
}

/** Foto o bandera de cada jugador, la que traiga alguno de sus partidos. */
export function playerLogos(matches: MatchStats[]): Record<string, string | null> {
  const logos: Record<string, string | null> = {};
  for (const match of matches) {
    logos[match.homeTeam] ??= match.homeTeamLogo;
    logos[match.awayTeam] ??= match.awayTeamLogo;
  }
  return logos;
}

/** Los jugadores a los que más veces ha dado ganador la liga. */
export function favouritePlayers(matches: MatchStats[], limit: number): string[] {
  const wins = new Map<string, number>();
  const add = (name: string, count: number) => {
    if (isPlayer(name) && count > 0) wins.set(name, (wins.get(name) ?? 0) + count);
  };
  for (const match of matches) {
    add(match.homeTeam, match.homeWins);
    add(match.awayTeam, match.awayWins);
  }
  return [...wins]
    .sort(([a, x], [b, y]) => y - x || byName(a, b))
    .slice(0, limit)
    .map(([name]) => name);
}

/** Partidos del jugador en el orden en que se jugaron. */
export function playerMatches(matches: MatchStats[], player: string): PlayerMatch[] {
  return matches.flatMap((match) => {
    const side = sideOf(match, player);
    if (!side) return [];
    const home = side === 'home';
    const count = home ? match.homeWins : match.awayWins;
    const total = match.homeWins + match.awayWins;
    const own = home ? match.homeScore : match.awayScore;
    const other = home ? match.awayScore : match.homeScore;
    const decided = match.finished && own != null && other != null && own !== other;
    const { tournament, round } = splitRound(match.round ?? '');
    return [
      {
        matchId: match.matchId,
        side,
        rival: home ? match.awayTeam : match.homeTeam,
        round: displayRoundLabel(round),
        tournament,
        count,
        total,
        percent: percent(count, total),
        status: decided ? (own > other ? 'yes' : 'no') : 'pending',
        score: own != null && other != null ? `${own}-${other}` : null,
      } satisfies PlayerMatch,
    ];
  });
}

/** Lo que se sabe seguro del jugador: campeón o la ronda en la que cayó. */
export function playerSituation(rows: PlayerMatch[]): string | null {
  const last = rows[rows.length - 1];
  if (!last || last.status === 'pending' || last.round === GROUP_STAGE) return null;
  if (last.status === 'yes') return last.round === FINAL ? 'Campeón' : null;
  return last.round === FINAL ? 'Subcampeón' : `Cayó en ${lowerFirst(last.round)}`;
}

/** Quién da ganador al jugador en un partido y quién a su rival. */
export function matchPickers(
  voters: MatchVoters | undefined,
  side: Side,
): { yes: MatchVoter[]; no: MatchVoter[] } {
  if (!voters) return { yes: [], no: [] };
  const sort = (list: MatchVoter[]) => [...list].sort((a, b) => byName(a.name, b.name));
  return side === 'home'
    ? { yes: sort(voters.home), no: sort(voters.away) }
    : { yes: sort(voters.away), no: sort(voters.home) };
}
