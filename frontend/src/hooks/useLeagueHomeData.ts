import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAppContext } from '../context/AppContext';
import {
  fetchCompetitionStandings,
  fetchCustomStandings,
  fetchCustomTeams,
  fetchMatchdayFixtures,
} from '../services/api';
import { queryKeys } from '../services/queryKeys';
import { computeCustomGroupTables } from '../utils/customBracket';
import { KNOCKOUT_ROUNDS, computeSwissStandings } from '../utils/officialTournament';
import { groupStandings, isLolCompetition } from '../utils/standingsGroups';
import { isNbaRegularSeason } from '../utils/nbaPlayoffs';
import { normalizeCountryName } from '../utils/constants';
import {
  currentRoundMatches,
  fixtureAsMatch,
  nextGroupName,
  upcomingMatches,
} from '../utils/homeMatches';
import { displayRoundLabel, sortFightCard } from '../utils/matchday';
import { useSortedGroups } from './useSortedGroups';
import { nflOverall, nflRecord } from '../utils/nflStandings';
import type { Match } from '../types/api';
import type { LeagueKind } from '../context/leagueKind';

const MINI_TABLE_SIZE = 5;

/** De dónde salen los partidos y la tabla de la portada; `null`: la clase no tiene esta portada. */
type LeagueHomeSource = 'matchday' | 'custom' | 'worldCup' | 'official' | null;

const HOME_SOURCE: Record<LeagueKind, LeagueHomeSource> = {
  matchday: 'matchday',
  fightCard: 'matchday',
  tennisDraw: 'matchday',
  customBracket: 'custom',
  worldCup: 'worldCup',
  ownBracket: 'official',
  knockoutDraw: 'official',
  grandPrix: null,
  loading: null,
  error: null,
  none: null,
  unknown: null,
};

export interface MiniStandingRow {
  /** Nombre original del equipo: identifica la fila y su escudo. */
  team: string;
  rank: number;
  name: string;
  logo?: string | null;
  detail?: string;
  value: string;
}

interface LeagueHomeData {
  subtitle: string;
  matches: {
    title: string;
    items: Match[];
    /** Página a la que lleva cada partido y su verbo para lectores de pantalla. */
    to: string;
    action: string;
    allTo: string;
    empty: string;
  };
  standings: { title: string; to: string; rows: MiniStandingRow[] } | null;
  /** Aún falta la tabla de equipos (o los equipos de la competición personalizada). */
  loading: boolean;
}

const NO_HOME: Omit<LeagueHomeData, 'loading'> = {
  subtitle: '',
  matches: { title: '', items: [], to: '/', action: '', allTo: '/', empty: '' },
  standings: null,
};

const logosOf = (matches: Match[]) => {
  const logos: Record<string, string> = {};
  for (const match of matches) {
    const home = match.homeLogo || match.homeTeamLogo;
    const away = match.awayLogo || match.awayTeamLogo;
    if (home) logos[match.home] = home;
    if (away) logos[match.away] = away;
  }
  return logos;
};

/**
 * Título de la ronda de tenis en la portada: con el torneo delante («Masters de París · Final»). En una
 * liga de varios torneos la ronda ya lo trae («Masters de París 2026 · Final»).
 */
const tennisRoundTitle = (label: string, tournament: string | null) =>
  label.includes(' · ') || !tournament ? label : `${tournament} · ${label}`;

/**
 * Datos de la portada de una liga en cualquier formato: los partidos que tocan y una tabla corta de
 * equipos. Cada formato solo cambia de dónde salen; la portada los pinta siempre igual.
 */
export function useLeagueHomeData(): LeagueHomeData {
  const {
    leagueKind,
    allGames: competitionGames,
    activeCompetitionId,
    activeGroupId,
    activeGroupCustomCompetition,
    activeGroupPicksMatches,
    activeGroupMultiCompetition,
    activeCompetitionExternalId,
    activeCompetitionName,
  } = useAppContext();
  const format = HOME_SOURCE[leagueKind];
  const knockoutDraw = leagueKind === 'knockoutDraw';
  // En la UFC no hay tabla de equipos (los «equipos» son luchadores): su tabla es la cartelera.
  const ufc = leagueKind === 'fightCard';
  // La NFL y la NBA no dan puntos: se enseña el balance de victorias y derrotas.
  const winLoss =
    activeCompetitionExternalId === 'nfl' || isNbaRegularSeason(activeCompetitionExternalId);
  const lol = isLolCompetition(activeCompetitionExternalId);
  // En el tenis, igual: su tabla es el cuadro del torneo.
  const tennis = leagueKind === 'tennisDraw';
  // En unas eliminatorias (Champions…) la fase de liga no se pronostica: la portada enseña los cruces.
  const allGames = useMemo(
    () =>
      knockoutDraw
        ? competitionGames.filter(
            // En los playoffs de la NBA el play-in también se pronostica.
            (match) => KNOCKOUT_ROUNDS.includes(match.round) || match.round === 'playin',
          )
        : competitionGames,
    [competitionGames, knockoutDraw],
  );
  const groupId = activeGroupId ? Number(activeGroupId) : null;
  const sortedGroups = useSortedGroups();
  // Una liga que elige sus partidos (o los junta de varias competiciones) enseña los suyos, no la
  // jornada oficial de la competición.
  const ownMatches = format === 'matchday' && activeGroupPicksMatches && groupId != null;
  const { data: leagueFixtures, isLoading: loadingLeagueFixtures } = useQuery({
    queryKey: queryKeys.leagueMatches(groupId),
    queryFn: () => fetchMatchdayFixtures(groupId!),
    enabled: ownMatches,
    staleTime: 60_000,
  });
  const leagueGames = useMemo(
    () => (leagueFixtures ? leagueFixtures.map(fixtureAsMatch) : null),
    [leagueFixtures],
  );

  const { data: leagueStandings, isLoading: loadingLeagueStandings } = useQuery({
    queryKey: queryKeys.competitionStandings(activeCompetitionId),
    queryFn: () =>
      activeGroupCustomCompetition && groupId != null
        ? fetchCustomStandings(groupId)
        : fetchCompetitionStandings(activeCompetitionId),
    // Con partidos de varias competiciones, la tabla de una sola no dice nada de la liga.
    enabled:
      format === 'matchday' &&
      Boolean(activeCompetitionId) &&
      !activeGroupMultiCompetition &&
      !ufc &&
      !tennis,
    staleTime: 120_000,
  });
  const { data: customTeams, isLoading: loadingCustomTeams } = useQuery({
    queryKey: queryKeys.customTeams(activeGroupId),
    queryFn: () => fetchCustomTeams(groupId!),
    enabled: format === 'custom' && groupId != null,
  });

  const loading =
    loadingLeagueStandings || loadingCustomTeams || (ownMatches && loadingLeagueFixtures);

  const data = useMemo<Omit<LeagueHomeData, 'loading'>>(() => {
    const logos = logosOf(allGames);
    // Con varias tablas (grupos de la Libertadores, fases del LoL) la portada enseña una: la primera, o
    // en el LoL la fase más reciente.
    // La NFL llega por divisiones: la portada enseña los mejores balances de toda la liga.
    const tables =
      winLoss && leagueStandings?.length
        ? [{ title: null, rows: nflOverall(leagueStandings) }]
        : groupStandings(leagueStandings ?? []);
    const miniTable = lol ? tables[tables.length - 1] : tables[0];

    if (format === 'matchday') {
      const current = currentRoundMatches(ownMatches ? (leagueGames ?? []) : allGames);
      const round = current.round;
      // UFC: la velada en el orden de su cartelera, con la pelea estelar arriba, no por hora.
      const matches = ufc ? sortFightCard(current.matches) : current.matches;
      const label = round ? displayRoundLabel(round) : null;
      return {
        subtitle: 'Predicciones por jornada',
        matches: {
          // «Jornada 12» y «Semana del 9 nov» se explican solas; las jornadas por fecha siguen como
          // «Partidos Sáb 7 nov».
          title:
            !round || !label
              ? 'Partidos'
              : tennis
                ? tennisRoundTitle(label, activeCompetitionName)
                : label === round || label.startsWith('Semana')
                  ? label
                  : `Partidos ${label}`,
          items: matches,
          to: '/jornadas',
          action: 'hacer tu predicción',
          allTo: ownMatches ? '/jornadas' : '/radar',
          empty:
            tennis && !round
              ? 'El cuadro aún no está publicado: los partidos aparecerán en cuanto ESPN lo publique.'
              : ownMatches
                ? 'Esta liga aún no tiene partidos por jugar.'
                : 'No hay partidos programados para esta jornada.',
        },
        standings:
          !activeGroupMultiCompetition && miniTable
            ? {
                title: miniTable.title ? `Tabla · ${miniTable.title}` : 'Tabla',
                to: '/tabla',
                rows: miniTable.rows.slice(0, MINI_TABLE_SIZE).map((team) => ({
                  team: team.teamName,
                  rank: team.rank,
                  name: team.teamName,
                  logo: team.teamLogo,
                  detail: `${team.gamesPlayed} PJ`,
                  // En la NFL y el LoL no hay puntos: se enseña el balance de victorias y derrotas.
                  value: winLoss || lol ? nflRecord(team) : `${team.points} pts`,
                })),
              }
            : null,
      };
    }

    // Sin portada de partidos (Fórmula 1, sin liga o aún cargando): nada que enseñar.
    if (format === null) return NO_HOME;

    const { finished, matches } = upcomingMatches(allGames);
    const groupName = nextGroupName(allGames);
    let standings: LeagueHomeData['standings'] = null;

    if (format === 'worldCup' && groupName && sortedGroups[groupName]) {
      standings = {
        title: `Grupo ${groupName}`,
        to: '/grupos',
        rows: sortedGroups[groupName].map((team, index) => ({
          team: team.name,
          rank: index + 1,
          name: normalizeCountryName(team.name),
          detail: `${team.stats.mp} PJ`,
          value: `${team.stats.pts} pts`,
        })),
      };
    } else if (format === 'custom' && groupName && customTeams) {
      const table = computeCustomGroupTables(customTeams, allGames)[groupName] ?? [];
      const teamLogos = Object.fromEntries(
        customTeams.filter((team) => team.logoUrl).map((team) => [team.name, team.logoUrl]),
      );
      if (table.length > 0)
        standings = {
          title: `Grupo ${groupName}`,
          to: '/bracket',
          rows: table.map((row, index) => ({
            team: row.team,
            rank: index + 1,
            name: row.team,
            logo: teamLogos[row.team] ?? logos[row.team],
            detail: `${row.played} PJ`,
            value: `${row.points} pts`,
          })),
        };
    } else if (format === 'official' && !knockoutDraw) {
      const swiss = computeSwissStandings(allGames);
      if (swiss.length > 0)
        standings = {
          title: 'Fase suiza',
          to: '/bracket',
          rows: swiss.slice(0, MINI_TABLE_SIZE).map((row, index) => ({
            team: row.team,
            rank: index + 1,
            name: row.team,
            logo: logos[row.team],
            value: `${row.wins}-${row.losses}`,
          })),
        };
    }

    return {
      subtitle: 'Predicciones del cuadro',
      matches: {
        title: finished ? 'Últimos resultados' : 'Próximos partidos',
        items: matches,
        to: '/bracket',
        action: 'ver resultados',
        allTo: '/bracket',
        empty: 'Aún no hay partidos programados.',
      },
      standings,
    };
  }, [
    format,
    allGames,
    leagueGames,
    ownMatches,
    leagueStandings,
    sortedGroups,
    customTeams,
    knockoutDraw,
    activeGroupMultiCompetition,
    winLoss,
    lol,
    tennis,
    activeCompetitionName,
    ufc,
  ]);

  return useMemo(() => ({ ...data, loading }), [data, loading]);
}
