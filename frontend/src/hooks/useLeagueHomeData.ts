import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAppContext } from '../context/AppContext';
import { fetchCompetitionStandings, fetchCustomStandings, fetchCustomTeams } from '../services/api';
import { queryKeys } from '../services/queryKeys';
import { computeCustomGroupTables } from '../utils/customBracket';
import { computeSwissStandings } from '../utils/officialTournament';
import { normalizeCountryName } from '../utils/constants';
import { currentRoundMatches, nextGroupName, upcomingMatches } from '../utils/homeMatches';
import { displayRoundLabel } from '../utils/matchday';
import { useSortedGroups } from './useSortedGroups';
import type { Match } from '../types/api';

/** Competición del cuadro oficial con grupos, terceros y cruces. */
const WORLD_CUP_EXTERNAL_ID = 'fifa.world';
const MINI_TABLE_SIZE = 5;

type LeagueHomeFormat = 'matchday' | 'custom' | 'worldcup' | 'official';

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
}

/** Formato de la liga activa, que decide de dónde salen los partidos y la tabla de la portada. */
export function useLeagueHomeFormat(): LeagueHomeFormat {
  const {
    activeGroupPoolFormat,
    activeCompetitionFormatType,
    activeGroupCustomCompetition,
    activeCompetitionExternalId,
  } = useAppContext();
  if (activeGroupPoolFormat === 'MATCH_DAY' || activeCompetitionFormatType === 'LEAGUE')
    return 'matchday';
  if (activeGroupCustomCompetition) return 'custom';
  if (activeCompetitionExternalId && activeCompetitionExternalId !== WORLD_CUP_EXTERNAL_ID)
    return 'official';
  return 'worldcup';
}

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
 * Datos de la portada de una liga en cualquier formato: los partidos que tocan y una tabla corta de
 * equipos. Cada formato solo cambia de dónde salen; la portada los pinta siempre igual.
 */
export function useLeagueHomeData(): LeagueHomeData {
  const format = useLeagueHomeFormat();
  const { allGames, activeCompetitionId, activeGroupId, activeGroupCustomCompetition } =
    useAppContext();
  const groupId = activeGroupId ? Number(activeGroupId) : null;
  const sortedGroups = useSortedGroups();

  const { data: leagueStandings } = useQuery({
    queryKey: queryKeys.competitionStandings(activeCompetitionId),
    queryFn: () =>
      activeGroupCustomCompetition && groupId != null
        ? fetchCustomStandings(groupId)
        : fetchCompetitionStandings(activeCompetitionId),
    enabled: format === 'matchday' && Boolean(activeCompetitionId),
    staleTime: 120_000,
  });
  const { data: customTeams } = useQuery({
    queryKey: queryKeys.customTeams(activeGroupId),
    queryFn: () => fetchCustomTeams(groupId!),
    enabled: format === 'custom' && groupId != null,
  });

  return useMemo<LeagueHomeData>(() => {
    const logos = logosOf(allGames);

    if (format === 'matchday') {
      const { round, matches } = currentRoundMatches(allGames);
      return {
        subtitle: 'Predicciones por jornada',
        matches: {
          // «Jornada 12» se explica sola; las jornadas por fecha siguen como «Partidos Sáb 7 nov».
          title: !round
            ? 'Partidos'
            : displayRoundLabel(round) === round
              ? round
              : `Partidos ${displayRoundLabel(round)}`,
          items: matches,
          to: '/jornadas',
          action: 'hacer tu predicción',
          allTo: '/radar',
          empty: 'No hay partidos programados para esta jornada.',
        },
        standings: leagueStandings?.length
          ? {
              title: 'Tabla',
              to: '/tabla',
              rows: leagueStandings.slice(0, MINI_TABLE_SIZE).map((team) => ({
                team: team.teamName,
                rank: team.rank,
                name: team.teamName,
                logo: team.teamLogo,
                detail: `${team.gamesPlayed} PJ`,
                value: `${team.points} pts`,
              })),
            }
          : null,
      };
    }

    const { finished, matches } = upcomingMatches(allGames);
    const groupName = nextGroupName(allGames);
    let standings: LeagueHomeData['standings'] = null;

    if (format === 'worldcup' && groupName && sortedGroups[groupName]) {
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
    } else if (format === 'official') {
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
  }, [format, allGames, leagueStandings, sortedGroups, customTeams]);
}
