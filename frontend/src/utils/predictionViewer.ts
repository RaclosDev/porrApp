/**
 * Lógica pura del visor de porras: puntos que se muestran, rondas del cuadro y qué equipos
 * ya no pueden sumar en una ronda.
 */
import { matchWinner } from './bracketBuilder';
import { teamKey } from './teamKey';
import {
  WORLD_CUP_2026_FIRST_ROUND,
  WORLD_CUP_2026_FORMAT,
  firstRoundLabels,
} from './firstKnockoutRound';
import {
  buildR32FromGroups,
  hasValidGroupSelections,
  extractGroupsFromR32,
  storedFirstRound,
} from './bracketDraft';
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
  TournamentFormat,
} from '../types/api';
import { isMathematicallyEliminated } from './groupStatus';

/** Cuadro vacío que se muestra si no se puede obtener el oficial. */
export const EMPTY_OFFICIAL_BRACKET: PredictionData = {
  topologyVersion: 2,
  r32: firstRoundLabels(WORLD_CUP_2026_FIRST_ROUND),
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
  const rows = leaderboard || [];
  if (predictionId != null && predictionId !== '') {
    return rows.find((row) => String(row.id) === String(predictionId)) || EMPTY_POINTS;
  }
  const named = rows.filter((row) => user && row.name.toLowerCase() === user.toLowerCase());
  return named.length === 1 ? named[0] : EMPTY_POINTS;
}

/**
 * Dieciseisavos del pronóstico: los guardados o, si no hay, los que salen de los grupos. Un torneo
 * que empieza más tarde no los tiene.
 */
export function r32Source(
  part: ViewerPrediction | null,
  format: TournamentFormat = WORLD_CUP_2026_FORMAT,
): TeamPair[] | null {
  if (format.firstRound !== 'r32') return [];
  if (Array.isArray(part?.r32) && part.r32.length >= 16) return part.r32;
  if (Array.isArray(part?.r1) && part.r1.length >= 16) return part.r1;
  if (part?.groups && hasValidGroupSelections(part.groups)) {
    return buildR32FromGroups(part.groups, part.thirds, part.topologyVersion, format);
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
  // La ronda que el torneo no juega llega vacía y el lienzo la omite.
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
    const safeKey1 = teamKey(teamName);
    const safeKey2 = teamKey(resolvedName);
    for (const group of Object.values(officialPoints)) {
      const entry = group[safeKey1] ?? group[safeKey2];
      if (entry && isMathematicallyEliminated(entry.status)) return true;
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
export function advancingThirds(
  part: ViewerPrediction | null,
  groupOdds: GroupOdds,
  format: TournamentFormat = WORLD_CUP_2026_FORMAT,
): string[] {
  if (Array.isArray(part?.thirds) && part.thirds.length > 0) return part.thirds;
  const firstRound = part ? storedFirstRound(part, format) : undefined;
  if (part && firstRound) {
    return extractGroupsFromR32(firstRound, groupOdds, part.topologyVersion, format).thirds || [];
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
