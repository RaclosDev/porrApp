import type { Match } from '../types/api';

const LIVE_STATUSES = new Set(['LIVE', 'PAUSED', 'IN_PLAY', 'IN_PROGRESS']);
const VOID_STATUSES = new Set(['CANCELLED', 'POSTPONED', 'ABANDONED', 'SUSPENDED']);

const timeOf = (match: Match) => (match.date ? new Date(match.date).getTime() || 0 : 0);
const byDate = (a: Match, b: Match) => timeOf(a) - timeOf(b);

export const isLiveMatch = (match: Match) =>
  !match.finished && LIVE_STATUSES.has((match.status || '').toUpperCase());

/** Partido que aún se jugará: no ha terminado ni se ha cancelado o aplazado. */
export const isPlayableMatch = (match: Match) =>
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
): { finished: boolean; matches: Match[] } {
  const defined = matches.filter((match) => match.home && match.away);
  const pending = defined.filter(isPlayableMatch).sort(byDate);
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
