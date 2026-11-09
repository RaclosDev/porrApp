import { podiumPlaces } from '../components/MatchdayPodium';
import type { LeaderboardRow } from '../hooks/useLeaderboard';

/** Un escalón del podio final: su puesto, sus puntos y quienes lo comparten. */
interface ClosingPlace {
  rank: number;
  score: number;
  names: string[];
}

/** Cómo ha quedado el usuario en la clasificación final. */
export interface ClosingResult {
  rank: number;
  points: number;
  participants: number;
}

/** Cierre de una liga terminada: campeón (o campeones, si empatan), podio y resultado del usuario. */
export interface LeagueClosingData {
  champions: string[];
  places: ClosingPlace[];
  me: ClosingResult | null;
}

/** «Ana», «Ana y Luis», «Ana, Luis y Eva». */
export function joinNames(names: string[]) {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`;
}

/**
 * Cierre de la liga a partir de su clasificación general (solo quienes cuentan, ya ordenados y con
 * su puesto). Sin podio si nadie ha puntuado.
 */
export function leagueClosing(
  rows: LeaderboardRow[],
  userId: string | number | null | undefined,
): LeagueClosingData {
  const places = podiumPlaces(rows).map(({ score, leaders }, index) => ({
    rank: index + 1,
    score,
    names: leaders.map((row) => row.name),
  }));
  const mine =
    userId == null || userId === ''
      ? undefined
      : rows.find((row) => row.userId != null && String(row.userId) === String(userId));
  return {
    champions: places[0]?.names ?? [],
    places,
    me:
      mine && typeof mine.rank === 'number'
        ? { rank: mine.rank, points: mine.points.total || 0, participants: rows.length }
        : null,
  };
}

/** Titular del cierre: quién gana la liga. */
export function closingHeadline(champions: string[], leagueName: string) {
  if (champions.length === 0) return `${leagueName} ha terminado`;
  return `${joinNames(champions)} ${champions.length === 1 ? 'gana' : 'ganan'} ${leagueName}`;
}

/** Resultado del usuario en una frase. */
export function closingResultText({ rank, points, participants }: ClosingResult) {
  return `Has quedado ${rank}.º de ${participants} con ${points} pts`;
}

/**
 * Resumen para compartir fuera de la app: solo lo que ya se ve en la clasificación (nombres en la liga
 * y puntos), sin correos ni identificadores.
 */
export function closingShareText(
  { champions, places, me }: LeagueClosingData,
  leagueName: string,
  competitionName?: string | null,
) {
  const competition =
    competitionName && competitionName.trim().toLowerCase() !== leagueName.trim().toLowerCase()
      ? ` (${competitionName})`
      : '';
  const lines = [`🏆 ${closingHeadline(champions, `«${leagueName}»`)}${competition}`];
  for (const place of places) {
    lines.push(`${place.rank}.º ${joinNames(place.names)} · ${place.score} pts`);
  }
  if (me) lines.push(`Yo: ${me.rank}.º de ${me.participants} · ${me.points} pts`);
  return lines.join('\n');
}

/** Enlace a la liga: solo la abre quien es miembro. */
export const closingLink = (groupId: string | number) =>
  `${window.location.origin}/?group=${encodeURIComponent(String(groupId))}`;
