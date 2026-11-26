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

/** Más de una semana: así ni una semana de la NBA ni una jornada de jueves a lunes dejan rezagados. */
const LATE_GAP_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Partido aplazado que vuelve con fecha nueva: está por jugar y cae más de una semana después del
 * último partido ya jugado de su jornada (el Rayo-Athletic de la jornada 8 jugado en diciembre).
 */
const isLateIn = (match: Match, round: Match[]) => {
  if (!isPlayableMatch(match) || !match.date) return false;
  const played = round.filter((other) => other.finished && other.date).map(timeOf);
  return played.length > 0 && timeOf(match) - Math.max(...played) > LATE_GAP_MS;
};

const matchdayNumber = (label: string): number | null => {
  const match = /^(?:jornada|semana)\s+(\d+)$/i.exec(label.trim());
  return match ? Number(match[1]) : null;
};

/**
 * Jornada actual de una liga: la primera con partidos por jugar en su fecha (o la última si ya acabó
 * todo), con todos sus partidos, también los ya finalizados, y los aplazados que se juegan con ella.
 * `serverRound`: la lista ya es la jornada actual del servidor, y lo de jornadas anteriores, aplazados.
 */
export function currentRoundMatches(
  matches: Match[],
  now = Date.now(),
  serverRound = false,
): {
  round: string | null;
  matches: Match[];
  /** Los mismos partidos con los dos bloques cambiados de sitio; vacío si solo hay un bloque. */
  flipped: Match[];
  /** Aplazados de otra jornada que se juegan en esta, con la jornada a la que pertenecen. */
  lateRounds: Map<Match['id'], string>;
} {
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
  if (rounds.length === 0) return { round: null, matches: [], flipped: [], lateRounds: new Map() };

  const lastNumber = Math.max(...rounds.map((label) => matchdayNumber(label) ?? -Infinity));
  const late = new Set(
    rounds.flatMap((label) => {
      const round = byRound.get(label) ?? [];
      const earlier = serverRound && (matchdayNumber(label) ?? Infinity) < lastNumber;
      return round.filter((match) => isPlayableMatch(match) && (earlier || isLateIn(match, round)));
    }),
  );
  // Un aplazado no retiene la jornada: manda la primera con algún partido por jugar en su fecha.
  let index = rounds.findIndex((label) =>
    (byRound.get(label) ?? []).some((match) => isPlayableMatch(match) && !late.has(match)),
  );
  if (index === -1)
    index = rounds.findIndex((label) => (byRound.get(label) ?? []).some(isPlayableMatch));
  if (index === -1) index = rounds.length - 1;
  const round = rounds[index];
  const own = byRound.get(round) ?? [];

  // Los aplazados que se juegan antes de que acabe esta jornada van con ella.
  const end = Math.max(...own.map(timeOf));
  const lateRounds = new Map<Match['id'], string>();
  const extra = matches.filter((match) => {
    const label = roundLabelFor(match);
    if (label === round || !late.has(match) || timeOf(match) > end) return false;
    lateRounds.set(match.id, label);
    return true;
  });
  return { round, ...aroundNow([...own, ...extra].sort(byDate), now), lateRounds };
}

/** Partidos que enseña la portada de una jornada larga (una semana de la NBA trae unos 50). */
const LONG_ROUND_SHOWN = 10;
/** Hueco que una jornada larga guarda siempre para los últimos resultados. */
const RESULTS_KEPT = 3;

/**
 * A mitad de jornada la portada va en dos bloques: lo que queda por jugar, por orden de horario, y
 * los resultados, el último primero. Arriba va el bloque más cercano a ahora: los resultados si el
 * último partido queda más cerca que el siguiente y no hay nada en juego; si no, lo pendiente. Una
 * jornada sin empezar o ya acabada va entera en su orden, y una larga se corta por los dos lados.
 */
function aroundNow(round: Match[], now: number): { matches: Match[]; flipped: Match[] } {
  const pending = round.filter((match) => !match.finished);
  const played = round.filter((match) => match.finished).reverse();
  if (!round.some(isPlayableMatch) || played.length === 0) {
    const whole =
      pending.length > 0 ? round.slice(0, LONG_ROUND_SHOWN) : round.slice(-LONG_ROUND_SHOWN);
    return { matches: whole, flipped: [] };
  }
  const results = played.slice(0, Math.max(RESULTS_KEPT, LONG_ROUND_SHOWN - pending.length));
  const upcoming = pending.slice(0, LONG_ROUND_SHOWN - results.length);
  const resultsFirst =
    !pending.some(isLiveMatch) && now - timeOf(results[0]) < timeOf(upcoming[0]) - now;
  const pendingFirst = [...upcoming, ...results];
  const resultsOnTop = [...results, ...upcoming];
  return resultsFirst
    ? { matches: resultsOnTop, flipped: pendingFirst }
    : { matches: pendingFirst, flipped: resultsOnTop };
}

/** Un resultado de hace más de tres meses es de la temporada pasada, no un «último resultado». */
const PAST_SEASON_MS = 90 * 24 * 60 * 60 * 1000;

/**
 * Próximos partidos de un torneo con cuadro: los que están en juego primero y después los siguientes
 * por fecha. Si ya no queda ninguno, los últimos resultados, salvo que sean de una temporada pasada:
 * entre unas eliminatorias y las siguientes (los playoffs de la NBA) pasan meses.
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
  const played = defined
    .filter((match) => match.finished && (!match.date || timeOf(match) >= now - PAST_SEASON_MS))
    .sort((a, b) => byDate(b, a));
  return { finished: true, matches: played.slice(0, limit) };
}

/** Grupo del próximo partido de fase de grupos, o null si ya no quedan partidos de grupos. */
export function nextGroupName(matches: Match[]): string | null {
  const next = matches.filter((match) => match.groupName && isPlayableMatch(match)).sort(byDate)[0];
  return next?.groupName ?? null;
}
