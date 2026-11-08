import { useQuery } from '@tanstack/react-query';
import { fetchCompetitionStandings } from '../../services/api';
import { queryKeys } from '../../services/queryKeys';
import type { LeagueStanding, MatchdayFixture } from '../../types/api';

interface NflByeTeamsProps {
  competitionId: number | null;
  /** Semana elegida («Semana 9»). */
  round: string | null;
  /** Partidos de esa semana. */
  fixtures: MatchdayFixture[];
}

const REGULAR_SEASON_WEEK = /^Semana \d{1,2}$/;

/**
 * Equipos de la NFL que descansan en una semana: los 32 de la tabla que no juegan ninguno de sus
 * partidos. Solo en la temporada regular (en los playoffs no hay descansos, solo eliminados).
 */
export function byeTeams(
  standings: LeagueStanding[],
  round: string | null,
  fixtures: MatchdayFixture[],
): LeagueStanding[] {
  if (!round || !REGULAR_SEASON_WEEK.test(round) || fixtures.length === 0) return [];
  const playing = new Set(fixtures.flatMap((fixture) => [fixture.homeTeam, fixture.awayTeam]));
  // Si un nombre no coincide (la tabla y el calendario de ESPN no siempre los escriben igual) sería un
  // descanso inventado: mejor no decir nada.
  const teams = standings.filter((team) => !playing.has(team.teamName));
  return teams.length === standings.length - playing.size ? teams : [];
}

/** «Descansan: Bills y Jets»: quién no juega esta semana, para no buscarlo (ni elegirlo) en vano. */
export default function NflByeTeams({ competitionId, round, fixtures }: NflByeTeamsProps) {
  const { data } = useQuery({
    queryKey: queryKeys.competitionStandings(competitionId),
    queryFn: () => fetchCompetitionStandings(competitionId),
    enabled: competitionId != null,
    staleTime: 120_000,
  });
  const teams = byeTeams(Array.isArray(data) ? data : [], round, fixtures);
  if (teams.length === 0) return null;
  return (
    <div className="md-bye-teams">
      <span className="md-bye-title">
        {teams.length === 1 ? 'Descansa esta semana' : 'Descansan esta semana'}
      </span>
      <ul className="md-bye-list">
        {teams.map((team) => (
          <li key={team.teamName} className="md-bye-team">
            {team.teamLogo && (
              <img src={team.teamLogo} alt="" width={20} height={20} loading="lazy" />
            )}
            <span>{team.teamName}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
