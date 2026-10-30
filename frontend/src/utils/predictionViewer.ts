/**
 * Lógica pura del visor de porras: puntos que se muestran, rondas del cuadro y qué equipos
 * ya no pueden sumar en una ronda.
 */
import { matchWinner } from './bracketBuilder';
import { buildR32FromGroups, hasValidGroupSelections, extractGroupsFromR32 } from './bracketDraft';
import type { ViewerPrediction } from './predictionData';
import type { CanvasMatch } from '../components/BracketCanvas';
import { getTeamVal } from '../components/prediction/viewerTypes';
import type {
  GroupOdds,
  GroupStandings,
  Match,
  ParticipantScore,
  PredictionData,
  TeamPair,
} from '../types/api';

/** Cuadro vacío que se muestra si no se puede obtener el oficial. */
export const EMPTY_OFFICIAL_BRACKET: PredictionData = {
  r32: [
    ['1º Grupo E', '3º A/B/C/D/F'],
    ['1º Grupo I', '3º C/D/F/G/H'],
    ['2º Grupo A', '2º Grupo B'],
    ['1º Grupo F', '2º Grupo C'],
    ['2º Grupo K', '2º Grupo L'],
    ['1º Grupo H', '2º Grupo J'],
    ['1º Grupo D', '3º B/E/F/I/J'],
    ['1º Grupo G', '3º A/E/H/I/J'],
    ['1º Grupo C', '2º Grupo F'],
    ['2º Grupo E', '2º Grupo I'],
    ['1º Grupo A', '3º C/E/F/H/I'],
    ['1º Grupo L', '3º E/H/I/J/K'],
    ['1º Grupo J', '2º Grupo H'],
    ['2º Grupo D', '2º Grupo G'],
    ['1º Grupo B', '3º E/F/G/I/J'],
    ['1º Grupo K', '3º D/E/I/J/L'],
  ],
  r16: Array(8).fill([null, null]),
  qf: Array(4).fill([null, null]),
  sf: Array(2).fill([null, null]),
  final: [],
  thirdPlaceMatch: [],
};

/** Puntos del pronóstico que usa el visor. */
export type ViewerPoints = Pick<
  ParticipantScore,
  | 'total'
  | 'r1'
  | 'r32'
  | 'r16'
  | 'qf'
  | 'sf'
  | 'finals'
  | 'scorer'
  | 'log'
  | 'exactMatches'
  | 'passedTeams'
> &
  Partial<Pick<ParticipantScore, 'userId' | 'avatarUrl'>>;

/** Ronda de un hueco: índice del lienzo o uno de los huecos centrales. */
export type RoundRef = number | 'final' | 'champion' | 'thirdPlaceMatch';

export type ViewerRound = CanvasMatch<string | null>[];

const EMPTY_POINTS: ViewerPoints = {
  total: 0,
  r1: 0,
  r32: 0,
  r16: 0,
  qf: 0,
  sf: 0,
  finals: 0,
  scorer: 0,
  log: [],
  exactMatches: {},
  passedTeams: {},
};

/** EEUU y Estados Unidos son el mismo equipo según la fuente. */
export const teamAlias = (name: string) =>
  name === 'EEUU' ? 'Estados Unidos' : name === 'Estados Unidos' ? 'EEUU' : name;

/** Mismo equipo, contando el alias de EEUU. */
export const sameTeam = (a: string | null | undefined, b: string | null | undefined) =>
  Boolean(a && b && (a === b || teamAlias(a) === b));

/** Hueco sin equipo real: vacío, "???", "Por definir" o una posición de grupo ("1º Grupo A"). */
export const isPlaceholderTeam = (name: string | null | undefined): boolean =>
  !name || name === '???' || name === 'Por definir' || name.includes('º');

/** Equipos de una lista de cruces, sin huecos vacíos. */
export const flatTeams = (pairs: TeamPair[] | undefined): string[] =>
  pairs ? pairs.flat().filter((t): t is string => Boolean(t)) : [];

/**
 * Puntos que se muestran: el desglose detallado si ya llegó; si no, la fila del ranking de esa
 * porra (por id o por nombre); si no hay ninguna, todo a cero.
 */
export function selectViewerPoints(
  detailed: ParticipantScore | null,
  leaderboard: ParticipantScore[] | null | undefined,
  predictionId: string | number | null,
  user: string | undefined,
): ViewerPoints {
  if (detailed && Array.isArray(detailed.log)) return detailed;
  const found = (leaderboard || []).find((lb) => {
    if (!lb) return false;
    if (predictionId && String(lb.id) === String(predictionId)) return true;
    return Boolean(user && lb.name && lb.name.toLowerCase() === user.toLowerCase());
  });
  return found || EMPTY_POINTS;
}

/** Dieciseisavos del pronóstico: los guardados o, si no hay, los que salen de los grupos. */
export function r32Source(part: ViewerPrediction | null): TeamPair[] | null {
  if (Array.isArray(part?.r32) && part.r32.length >= 16) return part.r32;
  if (Array.isArray(part?.r1) && part.r1.length >= 16) return part.r1;
  if (part?.groups && hasValidGroupSelections(part.groups)) {
    return buildR32FromGroups(part.groups, part.thirds);
  }
  return [];
}

const toMatches = (arr: TeamPair[] | undefined): ViewerRound =>
  (arr || []).map((m) => ({ home: m?.[0] || null, away: m?.[1] || null }));

/** Las dos mitades del cuadro, de dieciseisavos a semifinales. */
export function bracketSides(
  r32: TeamPair[] | null,
  part: ViewerPrediction | null,
): { leftRounds: ViewerRound[]; rightRounds: ViewerRound[] } {
  return {
    leftRounds: [
      toMatches(r32?.slice(0, 8)),
      toMatches(part?.r16?.slice(0, 4)),
      toMatches(part?.qf?.slice(0, 2)),
      toMatches(part?.sf?.slice(0, 1)),
    ],
    rightRounds: [
      toMatches(r32?.slice(8, 16)),
      toMatches(part?.r16?.slice(4, 8)),
      toMatches(part?.qf?.slice(2, 4)),
      toMatches(part?.sf?.slice(1, 2)),
    ],
  };
}

/** El equipo ha quedado fuera: eliminado en su grupo o perdedor de una eliminatoria. */
export function isTeamEliminated(
  teamName: string | null | undefined,
  officialPoints: GroupStandings | null | undefined,
  allGames: Match[] | null | undefined,
): boolean {
  if (!teamName || isPlaceholderTeam(teamName)) return false;
  const resolvedName = teamAlias(teamName);

  if (officialPoints) {
    const safeKey1 = teamName.replace(/[.#$[\]]/g, '');
    const safeKey2 = resolvedName.replace(/[.#$[\]]/g, '');
    for (const group of Object.values(officialPoints)) {
      const entry = group[safeKey1] ?? group[safeKey2];
      if (entry && (entry.status === 4 || entry.status === -1)) return true;
    }
  }

  return (allGames || []).some((game) => {
    if (game.round === 'group' || game.round === 'third' || !game.finished) return false;
    if (![game.home, game.away].some((t) => t === teamName || t === resolvedName)) return false;
    const winner = matchWinner(game);
    return Boolean(winner && winner !== teamName && winner !== resolvedName);
  });
}

/** Resultado de las semifinales jugadas para un equipo: `won`, `lost` o `null` si no la jugó. */
function semifinalResult(teamName: string, allGames: Match[] | null | undefined) {
  for (const game of allGames || []) {
    if (game.round !== 'sf' || !game.finished) continue;
    if (game.home !== teamName && game.away !== teamName) continue;
    const winner = matchWinner(game);
    if (winner) return winner === teamName ? 'won' : 'lost';
  }
  return null;
}

/**
 * El equipo no puede estar en esa ronda por lo que ya ha pasado: quien juega la final no juega
 * el tercer puesto y quien juega el tercer puesto no puede ser finalista ni campeón.
 */
export function isTeamImpossibleForRound(
  teamName: string | null | undefined,
  roundIndex: RoundRef,
  officialBracket: PredictionData | null | undefined,
  allGames: Match[] | null | undefined,
): boolean {
  if (!teamName || isPlaceholderTeam(teamName)) return false;
  if (!officialBracket) return false;

  const isInOfficialFinal = (officialBracket.final || []).some((t) => sameTeam(t, teamName));
  const isInOfficialThird = (officialBracket.thirdPlaceMatch || []).some((t) =>
    sameTeam(t, teamName),
  );

  if (roundIndex === 'thirdPlaceMatch') {
    if (isInOfficialFinal || sameTeam(officialBracket.champion, teamName)) return true;
    return semifinalResult(teamName, allGames) === 'won';
  }
  if (roundIndex === 'final' || roundIndex === 'champion') {
    if (isInOfficialThird) return true;
    return semifinalResult(teamName, allGames) === 'lost';
  }
  return false;
}

/** Mejores terceros elegidos: los guardados o los que se deducen de los dieciseisavos. */
export function advancingThirds(part: ViewerPrediction | null, groupOdds: GroupOdds): string[] {
  if (Array.isArray(part?.thirds) && part.thirds.length > 0) return part.thirds;
  if (part?.r32 || part?.r1) {
    return extractGroupsFromR32(part.r32 || part.r1, groupOdds).thirds || [];
  }
  return [];
}

/** Tercero elegido en cada grupo, por orden de grupo. */
export function thirdPlacedTeams(part: ViewerPrediction | null): { group: string; team: string }[] {
  const groups = part?.groups;
  if (!groups) return [];
  return Object.keys(groups)
    .sort()
    .flatMap((group) => {
      const team = getTeamVal(groups[group], 2, 'third');
      return team ? [{ group, team }] : [];
    });
}
