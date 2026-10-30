/**
 * Puntos que el visor pinta en cada hueco del cuadro, en cada ronda y en cada equipo de grupo.
 * Funciones puras: reciben el pronóstico, los puntos y los datos oficiales.
 */
import { isMatchInRound, matchWinner } from './bracketBuilder';
import type { ViewerPrediction } from './predictionData';
import {
  flatTeams,
  isPlaceholderTeam,
  isTeamEliminated,
  isTeamImpossibleForRound,
  sameTeam,
  teamAlias,
  type RoundRef,
  type ViewerPoints,
  type ViewerRound,
} from './predictionViewer';
import type { GroupOdds, GroupStandings, Match, PredictionData, ScoreLogEntry } from '../types/api';

export interface SlotContext {
  part: ViewerPrediction | null;
  points: ViewerPoints;
  officialBracket: PredictionData | null;
  officialPoints: GroupStandings | null | undefined;
  allGames: Match[] | null | undefined;
}

export interface SlotDetails {
  /** El equipo pasa de ronda en el pronóstico. */
  isWinner: boolean;
  /** Puntos del hueco ("+3" o "0"), o `null` si aún no se sabe. */
  slotPoints: string | null;
}

/** Fase del registro de puntos que premia pasar de cada ronda del lienzo. */
const LOG_STAGE: Record<number, string> = { 0: 'r32', 1: 'r16', 2: 'qf', 3: 'sf' };

/** Huecos con equipo real que tiene cada ronda del cuadro oficial cuando está completa. */
const EXPECTED_SIZE: Record<string, number> = {
  0: 16,
  1: 8,
  2: 4,
  3: 2,
  final: 2,
  champion: 1,
  thirdPlaceMatch: 2,
};

/** Igual que `sameTeam`, pero sin distinguir mayúsculas ni espacios. */
const looseSameTeam = (a: string | null | undefined, b: string | null | undefined) =>
  Boolean(a && b && (sameTeam(a, b) || a.trim().toLowerCase() === b.trim().toLowerCase()));

const mentions = (entry: ScoreLogEntry, name: string) =>
  entry.msg.includes(name) || entry.msg.includes(teamAlias(name));

const findLog = (points: ViewerPoints, stage: string, name: string, extra?: string) =>
  (points.log || []).find(
    (l) => l && l.stage === stage && mentions(l, name) && (!extra || l.msg.includes(extra)),
  );

/** Equipos que pasan de cada ronda del pronóstico. */
function winnersOf(part: ViewerPrediction | null, roundIndex: RoundRef, name: string): boolean {
  switch (roundIndex) {
    case 0:
      return flatTeams(part?.r16).includes(name);
    case 1:
      return flatTeams(part?.qf).includes(name);
    case 2:
      return flatTeams(part?.sf).includes(name);
    case 3:
      return (part?.final || []).filter(Boolean).includes(name);
    case 4:
    case 'final':
    case 'champion':
      return part?.champion === name;
    case 5:
    case 'thirdPlaceMatch':
      return part?.thirdPlaceWinner === name;
    default:
      return false;
  }
}

/** Entrada del registro que puntúa este hueco. */
function slotLog(name: string, roundIndex: RoundRef, { part, points }: SlotContext) {
  if (typeof roundIndex === 'number') {
    const stage = LOG_STAGE[roundIndex];
    return stage ? findLog(points, stage, name) : undefined;
  }
  if (roundIndex === 'final') {
    const isRunnerUp = part?.final?.some((t) => t === name && name !== part?.champion);
    return findLog(points, 'finals', name, isRunnerUp ? 'Subcampeón' : 'Campeón');
  }
  if (roundIndex === 'champion') return findLog(points, 'finals', name, 'Campeón');
  const isThird = part?.thirdPlaceWinner === name;
  return findLog(points, 'finals', name, isThird ? 'Tercer puesto' : 'Cuarto puesto');
}

/** Equipos de la ronda siguiente del cuadro oficial, donde tendría que estar el equipo. */
function officialTeamsFor(roundIndex: RoundRef, official: PredictionData): (string | null)[] {
  switch (roundIndex) {
    case 0:
      return flatTeams(official.r16);
    case 1:
      return flatTeams(official.qf);
    case 2:
      return flatTeams(official.sf);
    case 3:
    case 'final':
      return official.final || [];
    case 'champion':
      return [official.champion ?? null];
    case 'thirdPlaceMatch':
      return official.thirdPlaceMatch || [];
    default:
      return [];
  }
}

/** Perdió su semifinal: va al tercer puesto aunque cuente como eliminado. */
const lostSemifinal = (name: string, allGames: Match[] | null | undefined) =>
  Boolean(
    allGames?.some((game) => {
      if (game.round !== 'sf' || !game.finished) return false;
      if (!looseSameTeam(game.home, name) && !looseSameTeam(game.away, name)) return false;
      const w = matchWinner(game);
      return Boolean(w && !looseSameTeam(w, name));
    }),
  );

/**
 * Acierto y puntos de un hueco del cuadro. Si el registro de puntos lo cubre, se usan esos
 * puntos; si no, el hueco vale 0 cuando ya es imposible acertarlo.
 */
export function slotDetails(
  name: string | null | undefined,
  roundIndex: RoundRef,
  ctx: SlotContext,
): SlotDetails {
  const known = Boolean(name && name !== '???');
  const isWinner = known && winnersOf(ctx.part, roundIndex, name as string);
  const { officialBracket } = ctx;
  if (!officialBracket || !known) return { isWinner, slotPoints: null };
  const team = name as string;

  const log = slotLog(team, roundIndex, ctx);
  if (log) return { isWinner, slotPoints: log.amount > 0 ? `+${log.amount}` : '0' };

  const isCenter =
    roundIndex === 'final' || roundIndex === 'champion' || roundIndex === 'thirdPlaceMatch';
  if (!isWinner && !isCenter) return { isWinner, slotPoints: null };

  const official = officialTeamsFor(roundIndex, officialBracket);
  if (official.some((t) => looseSameTeam(t, team))) return { isWinner, slotPoints: null };

  const isFullyPopulated =
    official.filter((t) => !isPlaceholderTeam(t)).length === EXPECTED_SIZE[roundIndex];
  let eliminated = isTeamEliminated(team, ctx.officialPoints, ctx.allGames);
  if (eliminated && roundIndex === 'thirdPlaceMatch' && lostSemifinal(team, ctx.allGames)) {
    eliminated = false;
  }
  const lost =
    isFullyPopulated ||
    eliminated ||
    isTeamImpossibleForRound(team, roundIndex, officialBracket, ctx.allGames);
  return { isWinner, slotPoints: lost ? '0' : null };
}

/** Puntos de una columna del cuadro: los de los equipos que el pronóstico hace pasar. */
export function roundFooterTotal(
  matches: ViewerRound | undefined,
  roundIndex: number,
  part: ViewerPrediction | null,
  points: ViewerPoints,
): number {
  const stage = LOG_STAGE[roundIndex];
  if (!matches || matches.length === 0 || !stage) return 0;
  let total = 0;
  matches.forEach((m) => {
    [m.home, m.away].forEach((name) => {
      if (!name || name === '???' || !winnersOf(part, roundIndex, name)) return;
      const l = findLog(points, stage, name);
      if (l) total += l.amount;
    });
  });
  return total;
}

/** Puntos de la final, el campeón y el tercer puesto. */
export function centerPointsTotal(points: ViewerPoints): number {
  if (typeof points.finals === 'number' && points.finals > 0) return points.finals;
  return (points.log || [])
    .filter((l) => l.stage === 'finals')
    .reduce((sum, l) => sum + (l.amount || 0), 0);
}

export interface GroupTeamData {
  /** Verde si acertó la posición, azul si solo acertó que pasa, rojo si falló. */
  color: string;
  mp: number;
  status: number;
}

/** Color y estado oficial de un equipo en la tabla de grupo del pronóstico. */
export function groupTeamData(
  groupName: string,
  teamName: string,
  expectedPos: number,
  points: ViewerPoints,
  officialPoints: GroupStandings | null | undefined,
  groupOdds: GroupOdds | null | undefined,
): GroupTeamData {
  if (!officialPoints || !officialPoints[groupName] || !groupOdds)
    return { color: 'inherit', mp: 0, status: 0 };

  const officialData = officialPoints[groupName][teamName.replace(/[.#$[\]]/g, '')];
  const hasData = typeof officialData === 'object' && officialData !== null;
  const mp = hasData ? officialData.mp || 0 : 0;
  const status = hasData ? officialData.status || 0 : 0;

  let color = 'inherit';
  if (mp > 0) {
    const groupKey = groupName.toUpperCase();
    const isExact =
      points.exactMatches &&
      (points.exactMatches[groupKey] || points.exactMatches[groupName]) &&
      (points.exactMatches[groupKey]?.[expectedPos] ||
        points.exactMatches[groupName]?.[expectedPos]);
    const isPassed =
      points.passedTeams &&
      (points.passedTeams[teamName] || points.passedTeams[teamAlias(teamName)]);
    if (isExact) color = '#2ecc71';
    else if (isPassed) color = '#3498db';
    else color = '#e74c3c';
  }
  return { color, mp, status };
}

/** Puntos de fase de grupos que suma un equipo en su grupo. */
export function groupTeamPoints(points: ViewerPoints, groupName: string, teamName: string) {
  return (points?.log || [])
    .filter(
      (l) =>
        l.stage === 'r1' &&
        (l.msg.includes(`Grupo ${groupName}`) ||
          l.msg.includes(`Grupo ${groupName.toUpperCase()}`)),
    )
    .reduce((sum, l) => (mentions(l, teamName) ? sum + l.amount : sum), 0);
}

/** Resalte de un hueco: el partido de eliminatorias que viene (o se está jugando). */
export function featuredSlot(
  featuredMatch: Match | null,
  name: string | null | undefined,
  roundIndex: RoundRef,
  now: Date = new Date(),
): { isFeatured: boolean; isLive: boolean } {
  if (!featuredMatch || isPlaceholderTeam(name) || !isMatchInRound(featuredMatch, roundIndex)) {
    return { isFeatured: false, isLive: false };
  }
  if (featuredMatch.home !== name && featuredMatch.away !== name) {
    return { isFeatured: false, isLive: false };
  }
  return {
    isFeatured: true,
    isLive: Boolean(featuredMatch.date && new Date(featuredMatch.date) <= now),
  };
}
