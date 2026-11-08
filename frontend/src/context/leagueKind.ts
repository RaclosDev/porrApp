import type { Group, PoolFormat } from '../types/api';
import { isTennisCompetition } from '../utils/tennisDraw';

/**
 * Clase de la liga activa: decide qué enseña cada pantalla. Se calcula solo aquí (`leagueKindOf`) y
 * cada pantalla declara qué muestra para cada clase con un `Record<LeagueKind, …>` o un `switch`
 * exhaustivo: una clase nueva no compila hasta que alguien decide qué enseña en cada sitio.
 *
 * - `loading`: aún se elige la liga o llegan sus datos.
 * - `error`: no se ha podido cargar la liga.
 * - `none`: no hay liga activa.
 * - `worldCup`: cuadro del Mundial (grupos, terceros, cruces y pichichi oficiales).
 * - `customBracket`: cuadro de una competición personalizada de la liga.
 * - `ownBracket`: cuadro fijo de un torneo oficial que no es el Mundial (Worlds de LoL…).
 * - `knockoutDraw`: eliminatorias sorteadas ronda a ronda (Champions, Copa del Rey, playoffs de la NBA).
 * - `matchday`: partido a partido por jornadas o semanas, también superviviente y varias competiciones.
 * - `fightCard`: velada a velada (UFC); su tabla es la cartelera.
 * - `tennisDraw`: partido a partido de tenis; su tabla es el cuadro del torneo.
 * - `grandPrix`: Gran Premio a Gran Premio (Fórmula 1).
 * - `unknown`: una combinación que esta versión no reconoce; no se enseña nada de otra clase.
 */
export type LeagueKind =
  | 'loading'
  | 'error'
  | 'none'
  | 'worldCup'
  | 'customBracket'
  | 'ownBracket'
  | 'knockoutDraw'
  | 'matchday'
  | 'fightCard'
  | 'tennisDraw'
  | 'grandPrix'
  | 'unknown';

const KINDS: Record<LeagueKind, true> = {
  loading: true,
  error: true,
  none: true,
  worldCup: true,
  customBracket: true,
  ownBracket: true,
  knockoutDraw: true,
  matchday: true,
  fightCard: true,
  tennisDraw: true,
  grandPrix: true,
  unknown: true,
};

/** Todas las clases de liga, para recorrerlas (tests y tablas). */
export const LEAGUE_KINDS = Object.keys(KINDS) as LeagueKind[];

/** Competición del Mundial en el proveedor de datos. */
const WORLD_CUP_EXTERNAL_ID = 'fifa.world';

export const isWorldCupCompetition = (externalId: string | null | undefined) =>
  externalId === WORLD_CUP_EXTERNAL_ID;

/** Lo que hace falta saber de la liga para clasificarla. */
export type LeagueFacts = Pick<
  Partial<Group>,
  | 'poolFormat'
  | 'formatType'
  | 'knockoutDraw'
  | 'customCompetition'
  | 'competitionExternalId'
  | 'multiCompetition'
>;

export interface LeagueKindInput {
  hasLeague: boolean;
  loading: boolean;
  error: boolean;
  league: LeagueFacts | undefined;
}

/** Un formato que no está en `PoolFormat` (servidor más nuevo que la app) no es de ninguna clase. */
const unrecognised = (_format: never): LeagueKind => 'unknown';

function bracketKind(league: LeagueFacts): LeagueKind {
  if (league.knockoutDraw) return 'knockoutDraw';
  if (league.customCompetition) return 'customBracket';
  // Un cuadro junta los cruces de una sola competición.
  if (league.multiCompetition) return 'unknown';
  if (isWorldCupCompetition(league.competitionExternalId)) return 'worldCup';
  if (league.formatType === 'TOURNAMENT' && league.competitionExternalId) return 'ownBracket';
  return 'unknown';
}

/** Clase de la liga activa. Es el único sitio que mira formato, competición y modo para decidirla. */
export function leagueKindOf({ hasLeague, loading, error, league }: LeagueKindInput): LeagueKind {
  if (!hasLeague) return 'none';
  if (error) return 'error';
  if (loading || !league) return 'loading';
  const format: PoolFormat | null | undefined = league.poolFormat;
  switch (format) {
    case 'GRAND_PRIX':
      return 'grandPrix';
    case 'MATCH_DAY':
    case 'SURVIVOR':
      if (league.formatType === 'EVENTS') return 'fightCard';
      return isTennisCompetition(league.competitionExternalId) ? 'tennisDraw' : 'matchday';
    case 'FULL_BRACKET':
    case 'KNOCKOUTS_ONLY':
      return bracketKind(league);
    case null:
    case undefined:
      return 'unknown';
    default:
      return unrecognised(format);
  }
}

/** La liga se juega sobre un cuadro: su porra se rellena en «Mi porra» y sus resultados están en /bracket. */
export const BRACKET_KINDS = {
  worldCup: true,
  customBracket: true,
  ownBracket: true,
  knockoutDraw: true,
  matchday: false,
  fightCard: false,
  tennisDraw: false,
  grandPrix: false,
  loading: false,
  error: false,
  none: false,
  unknown: false,
} as const satisfies Record<LeagueKind, boolean>;

/** La liga se predice partido a partido sobre un calendario (jornadas o veladas). */
export const MATCH_KINDS = {
  matchday: true,
  fightCard: true,
  tennisDraw: true,
  worldCup: false,
  customBracket: false,
  ownBracket: false,
  knockoutDraw: false,
  grandPrix: false,
  loading: false,
  error: false,
  none: false,
  unknown: false,
} as const satisfies Record<LeagueKind, boolean>;
