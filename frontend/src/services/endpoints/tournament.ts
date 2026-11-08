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

export const fetchWorldCupStandings = () => request<GroupStandings>('/world-cup/standings');

export const fetchMatches = (competitionId: number) =>
  request<Match[]>(`/matches${query({ competitionId })}`);

export const fetchMatchRadar = (competitionId: number) =>
  request<MatchRadar>(`/matches/radar${query({ competitionId })}`);

export const fetchWorldCupGroupOdds = () => request<GroupOdds>('/world-cup/group-odds');

// Evita que el panel Pichichi se quede cargando indefinidamente si el backend no responde.
export const fetchWorldCupTopScorers = () =>
  request<TopScorer[]>('/world-cup/scorers', { timeoutMs: 12_000 });

export const fetchCompetitionStandings = async (
  competitionId: number | null,
): Promise<LeagueStanding[]> =>
  competitionId ? request<LeagueStanding[]>(`/competitions/${competitionId}/standings`) : [];

let cachedCompetitions: Competition[] | null = null;
export async function fetchCompetitions(): Promise<Competition[]> {
  cachedCompetitions ??= await request<Competition[]>('/competitions');
  return cachedCompetitions;
}

/** Cuadro oficial. Se cachea como consulta de TanStack (`worldCupOfficialBracketQuery`). */
export const fetchWorldCupOfficialBracket = () =>
  request<PredictionData>('/world-cup/official-bracket');
