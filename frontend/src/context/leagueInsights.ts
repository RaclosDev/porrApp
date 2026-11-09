import type { LeagueKind } from './leagueKind';

/** Pantallas de estadísticas que tiene una clase de liga. */
export interface LeagueInsights {
  /** Nombre del enlace a Estadísticas (/stats); null si la clase no las tiene. */
  stats: string | null;
  /** Nombre corto para la pestaña de la cabecera, si el del enlace no cabe junto al Buscador. */
  tab?: string;
  /** Tiene Buscador (/search). */
  search: boolean;
}

const NO_INSIGHTS: LeagueInsights = { stats: null, search: false };
/** Lo más elegido por la liga y quién pone a cada equipo o piloto, comparado con lo real. */
const MOST_PICKED: LeagueInsights = { stats: 'Más elegidos', search: true };
/** Reparto de predicciones de cada partido ya empezado. */
const BY_MATCH: LeagueInsights = { stats: 'Estadísticas por partido', search: false };
/** Lo mismo y, además, en qué partidos del cuadro pone la liga a cada jugador. */
const BY_MATCH_AND_PLAYER: LeagueInsights = { ...BY_MATCH, tab: 'Por partido', search: true };

/**
 * Qué enlaces de estadísticas salen en cada clase de liga. Las páginas (`pages/Stats`,
 * `pages/Search`) deciden qué pintan; esto solo dice dónde hay algo que enlazar.
 */
export const LEAGUE_INSIGHTS: Record<LeagueKind, LeagueInsights> = {
  groupStage: MOST_PICKED,
  grandPrix: MOST_PICKED,
  matchday: BY_MATCH,
  fightCard: BY_MATCH,
  tennisDraw: BY_MATCH_AND_PLAYER,
  customBracket: MOST_PICKED,
  ownBracket: MOST_PICKED,
  knockoutDraw: MOST_PICKED,
  loading: NO_INSIGHTS,
  error: NO_INSIGHTS,
  none: NO_INSIGHTS,
  unknown: NO_INSIGHTS,
};
