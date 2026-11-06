/** Torneo oficial: clasificación, partidos, cuotas, goleadores y cuadro. */
import type {
  Competition,
  GroupOdds,
  GroupStandings,
  LeagueStanding,
  Match,
  MatchRadar,
  PredictionData,
  TopScorer,
} from '../../types/api';
import { request, query } from '../http';

export const fetchStandings = () => request<GroupStandings>('/standings');

export const fetchMatches = (competitionId: number | null = null) =>
  request<Match[]>(`/matches${query({ competitionId })}`);

export const fetchMatchRadar = (competitionId: number | null = null) =>
  request<MatchRadar>(`/matches/radar${query({ competitionId })}`);

export const fetchTeamOdds = () => request<GroupOdds>('/teams/odds');

// Evita que el panel Pichichi se quede cargando indefinidamente si el backend no responde.
export const fetchTopScorers = () => request<TopScorer[]>('/scorers', { timeoutMs: 12_000 });

export const fetchCompetitionStandings = async (
  competitionId: number | null,
): Promise<LeagueStanding[]> =>
  competitionId ? request<LeagueStanding[]>(`/competitions/${competitionId}/standings`) : [];

let cachedCompetitions: Competition[] | null = null;
export async function fetchCompetitions(): Promise<Competition[]> {
  cachedCompetitions ??= await request<Competition[]>('/competitions');
  return cachedCompetitions;
}

/** Cuadro oficial. Se cachea como consulta de TanStack (`officialBracketQuery`). */
export const fetchOfficialBracket = () => request<PredictionData>('/standings/official-bracket');
