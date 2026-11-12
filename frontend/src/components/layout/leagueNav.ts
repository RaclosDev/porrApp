import {
  ChartNoAxesColumn,
  Calendar,
  Dices,
  Flag,
  History,
  Home,
  LayoutGrid,
  ListOrdered,
  Spade,
  Pencil,
  Swords,
  Trophy,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { BRACKET_KINDS, type LeagueKind } from '../../context/leagueKind';
import { pokerRoutes } from '../poker/pokerRoutes';

/** Sección de la navegación principal (escritorio y móvil). */
export interface LeagueNavItem {
  to: string;
  label: string;
  /** Texto en la barra inferior del móvil, si es distinto. */
  mobileLabel?: string;
  icon: LucideIcon;
  end?: boolean;
  /** Solo en la demo (en móvil no cabe una sexta pestaña). */
  demoOnly?: boolean;
}

const HOME: LeagueNavItem = { to: '/', label: 'Inicio', icon: Home, end: true };
const MY_BRACKET: LeagueNavItem = { to: '/prediction', label: 'Mi Porra', icon: Pencil };
const RESULTS: LeagueNavItem = { to: '/bracket', label: 'Resultados', icon: Swords };
const RANKING: LeagueNavItem = { to: '/ranking', label: 'Ranking', icon: Trophy };
const MY_LEAGUES: LeagueNavItem = { to: '/mis-ligas', label: 'Mis Ligas', icon: Users };
const MATCHDAYS: LeagueNavItem = { to: '/jornadas', label: 'Jornadas', icon: Calendar };
const TABLE: LeagueNavItem = { to: '/tabla', label: 'Tabla', icon: ListOrdered };
const FIGHT_CARD: LeagueNavItem = { to: '/tabla', label: 'Cartelera', icon: ListOrdered };
const TENNIS_DRAW: LeagueNavItem = { to: '/tabla', label: 'Cuadro', icon: ListOrdered };
const F1_STANDINGS: LeagueNavItem = { to: '/tabla', label: 'Mundial', icon: ListOrdered };
const GROUP_STAGE_GROUPS: LeagueNavItem = {
  to: '/grupos',
  label: 'Grupos',
  icon: LayoutGrid,
  demoOnly: true,
};
const RACE_PICKS: LeagueNavItem = { to: '/jornadas', label: 'Predicciones', icon: Flag };

const SCOREBOARD_PLAY: LeagueNavItem = { to: '/partida', label: 'Partida', icon: Dices };
const SCOREBOARD_HISTORY: LeagueNavItem = { to: '/historico', label: 'Histórico', icon: History };

const BRACKET_NAV = [HOME, MY_BRACKET, RESULTS, RANKING, MY_LEAGUES];
const MATCHDAY_NAV = [HOME, MATCHDAYS, RANKING, TABLE, MY_LEAGUES];

/**
 * Secciones de cada clase de liga. Es la única tabla de la navegación: la de escritorio, la barra
 * del móvil y el botón «Rellenar mi porra» salen de aquí. `null`: aún no se sabe qué secciones lleva.
 */
const LEAGUE_NAV: Record<LeagueKind, readonly LeagueNavItem[] | null> = {
  loading: null,
  error: [HOME, MY_LEAGUES],
  none: [HOME, MY_LEAGUES],
  unknown: [HOME, RANKING, MY_LEAGUES],
  groupStage: [HOME, MY_BRACKET, RESULTS, GROUP_STAGE_GROUPS, RANKING, MY_LEAGUES],
  customBracket: BRACKET_NAV,
  ownBracket: BRACKET_NAV,
  knockoutDraw: BRACKET_NAV,
  matchday: MATCHDAY_NAV,
  fightCard: [HOME, MATCHDAYS, RANKING, FIGHT_CARD, MY_LEAGUES],
  tennisDraw: [HOME, MATCHDAYS, RANKING, TENNIS_DRAW, MY_LEAGUES],
  grandPrix: [HOME, RACE_PICKS, RANKING, F1_STANDINGS, MY_LEAGUES],
  // Juegos de mesa: la hoja de la partida, su ranking y el histórico por días.
  scoreboard: [HOME, SCOREBOARD_PLAY, RANKING, SCOREBOARD_HISTORY, MY_LEAGUES],
  tournament: [HOME, MY_LEAGUES],
  poker: [
    HOME,
    { ...pokerRoutes.table, icon: Spade },
    { ...pokerRoutes.history, icon: History },
    { ...pokerRoutes.statistics, icon: ChartNoAxesColumn },
    MY_LEAGUES,
  ],
};

/** Secciones que se enseñan; en la demo el inicio es /demo y no hay Mis Ligas. */
export function leagueNavItems(kind: LeagueKind, demo: boolean): readonly LeagueNavItem[] | null {
  const items = LEAGUE_NAV[kind];
  if (!items) return null;
  if (!demo) return items.filter((item) => !item.demoOnly);
  return items
    .filter((item) => item.to !== MY_LEAGUES.to)
    .map((item) => (item.to === HOME.to ? { ...item, to: '/demo', end: false } : item));
}

/** El botón «Rellenar mi porra» de la cabecera: solo en las ligas que se juegan sobre un cuadro. */
export const showsFillBracketButton = (kind: LeagueKind) => BRACKET_KINDS[kind];
