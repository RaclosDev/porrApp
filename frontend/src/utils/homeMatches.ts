import type { Match, MatchdayFixture } from '../types/api';

const LIVE_STATUSES = new Set(['LIVE', 'PAUSED', 'IN_PLAY', 'IN_PROGRESS']);
const VOID_STATUSES = new Set(['CANCELLED', 'POSTPONED', 'ABANDONED', 'SUSPENDED']);

const timeOf = (match: Match) => (match.date ? new Date(match.date).getTime() || 0 : 0);
const byDate = (a: Match, b: Match) => timeOf(a) - timeOf(b);

const PLACEHOLDER_TEAMS = new Set(['', 'por definir', 'tbd', '???']);

/** Equipo real: ni vacío ni un hueco «Por definir» (una carrera o un cruce aún sin rivales). */
const isDefinedTeam = (name: string | null | undefined) =>
  !PLACEHOLDER_TEAMS.has((name ?? '').trim().toLowerCase());

/**
 * En directo solo si el proveedor (ESPN) lo marca así, nunca por la hora, y con dos equipos reales:
 * un evento sin rivales (un Gran Premio, un cruce por definir) no es un partido en juego.
 */
export const isLiveMatch = (match: Match) =>
  !match.finished &&
  LIVE_STATUSES.has((match.status || '').toUpperCase()) &&
  isDefinedTeam(match.home) &&
  isDefinedTeam(match.away);

/** Marcador que se puede enseñar: el partido ha terminado o está en juego (antes, nada de 0-0). */
export const hasShownScore = (match: Match) =>
  (match.finished || isLiveMatch(match)) && match.home_score != null && match.away_score != null;

/** Partido que aún se jugará: no ha terminado ni se ha cancelado o aplazado. */
const isPlayableMatch = (match: Match) =>
  !match.finished && !VOID_STATUSES.has((match.status || '').toUpperCase());

function roundLabelFor(match: Match) {
  if (match.groupName) return `Grupo ${match.groupName}`;
  if (match.round && match.round.toLowerCase() !== 'group') return match.round;
  if (match.date) return `Fecha ${match.date.slice(0, 10)}`;
  return '';
}

/**
 * Jornada actual de una liga: la primera ronda con partidos por jugar (o la última si ya acabó todo),
 * con todos sus partidos, también los ya finalizados.
 */
/** Partido de la jornada de una liga (`/predictions/matchday`) con la forma de los de la competición. */
export const fixtureAsMatch = (fixture: MatchdayFixture): Match => ({
  id: fixture.matchId,
  home: fixture.homeTeam,
  away: fixture.awayTeam,
  home_team_id: fixture.homeTeamId,
  away_team_id: fixture.awayTeamId,
  homeLogo: fixture.homeTeamLogo,
  awayLogo: fixture.awayTeamLogo,
  homeTeamLogo: fixture.homeTeamLogo,
  awayTeamLogo: fixture.awayTeamLogo,
  homeScore: fixture.actualHomeScore ?? null,
  awayScore: fixture.actualAwayScore ?? null,
  home_score: fixture.actualHomeScore ?? null,
  away_score: fixture.actualAwayScore ?? null,
  date: fixture.matchDate,
  finished: Boolean(fixture.finished),
  round: fixture.round ?? '',
  groupName: fixture.groupName,
  winner: null,
  displayClock: fixture.displayClock ?? null,
  isStartingSoon: false,
  status: fixture.status ?? 'SCHEDULED',
  fight: fixture.fight ?? null,
});

export function currentRoundMatches(matches: Match[]): { round: string | null; matches: Match[] } {
  const rounds: string[] = [];
  const byRound = new Map<string, Match[]>();
  [...matches].sort(byDate).forEach((match) => {
    const label = roundLabelFor(match);
    if (!label) return;
    if (!byRound.has(label)) {
      byRound.set(label, []);
      rounds.push(label);
    }
    byRound.get(label)!.push(match);
  });
  if (rounds.length === 0) return { round: null, matches: [] };

  let index = rounds.findIndex((label) => (byRound.get(label) ?? []).some(isPlayableMatch));
  if (index === -1) index = rounds.length - 1;
  return { round: rounds[index], matches: byRound.get(rounds[index]) ?? [] };
}

/**
 * Próximos partidos de un torneo con cuadro: los que están en juego primero y después los siguientes
 * por fecha. Si ya no queda ninguno, los últimos resultados.
 */
export function upcomingMatches(
  matches: Match[],
  limit = 6,
  now: number = Date.now(),
): { finished: boolean; matches: Match[] } {
  const defined = matches.filter((match) => isDefinedTeam(match.home) && isDefinedTeam(match.away));
  // Un partido cuya hora ya ha pasado sin que el proveedor lo dé por empezado no es «próximo».
  const pending = defined
    .filter((match) => isPlayableMatch(match) && (isLiveMatch(match) || timeOf(match) >= now))
    .sort(byDate);
  if (pending.length > 0) {
    return {
      finished: false,
      matches: [...pending.filter(isLiveMatch), ...pending.filter((m) => !isLiveMatch(m))].slice(
        0,
        limit,
      ),
    };
  }
  const played = defined.filter((match) => match.finished).sort((a, b) => byDate(b, a));
  return { finished: true, matches: played.slice(0, limit) };
}

/** Grupo del próximo partido de fase de grupos, o null si ya no quedan partidos de grupos. */
export function nextGroupName(matches: Match[]): string | null {
  const next = matches.filter((match) => match.groupName && isPlayableMatch(match)).sort(byDate)[0];
  return next?.groupName ?? null;
}
