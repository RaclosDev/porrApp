import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchCustomMatches, fetchCustomTeams } from '../services/api';
import { queryKeys } from '../services/queryKeys';
import { officialBracketMatches } from '../utils/officialTournament';
import type { Match } from '../types/api';

/**
 * Equipos y partidos del cuadro que se pronostica: los de la competición personalizada de la liga
 * o, en un torneo oficial con cuadro propio, los de sus partidos sincronizados.
 */
export function useCustomBracketData(
  activeGroupId: string | number | null,
  official: boolean,
  allGames: Match[],
) {
  const groupId = activeGroupId ? Number(activeGroupId) : null;
  const teamsQuery = useQuery({
    queryKey: queryKeys.customTeams(activeGroupId),
    queryFn: () => fetchCustomTeams(groupId!),
    enabled: groupId != null && !official,
  });
  const matchesQuery = useQuery({
    queryKey: queryKeys.customMatches(activeGroupId),
    queryFn: () => fetchCustomMatches(groupId!),
    enabled: groupId != null && !official,
  });

  const teams = useMemo(
    () =>
      official
        ? [...new Set(allGames.flatMap((match) => [match.home, match.away]))]
            .filter(Boolean)
            .map((name) => ({
              name,
              groupName: null,
              logoUrl:
                allGames.find((match) => match.home === name)?.homeLogo ||
                allGames.find((match) => match.away === name)?.awayLogo ||
                null,
            }))
        : (teamsQuery.data ?? []),
    [official, allGames, teamsQuery.data],
  );
  const matches = useMemo(
    () => (official ? officialBracketMatches(allGames) : (matchesQuery.data ?? [])),
    [official, allGames, matchesQuery.data],
  );
  const logos = useMemo(
    () => Object.fromEntries(teams.map((team) => [team.name, team.logoUrl] as const)),
    [teams],
  );

  return {
    teams,
    matches,
    logos,
    loading: !official && (teamsQuery.isPending || matchesQuery.isPending),
    error: official ? null : (teamsQuery.error ?? matchesQuery.error),
  };
}
