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
  TournamentFormat,
} from '../../types/api';
import { request, query } from '../http';

/** Datos oficiales de un torneo con fase de grupos (grupos, cuotas, goleadores y cuadro). */
const tournament = (competitionId: number, read: string) =>
  `/competitions/${competitionId}/tournament/${read}`;

export const fetchTournamentFormat = (competitionId: number) =>
  request<TournamentFormat>(tournament(competitionId, 'format'));

export const fetchTournamentStandings = (competitionId: number) =>
  request<GroupStandings>(tournament(competitionId, 'standings'));

export const fetchMatches = (competitionId: number) =>
  request<Match[]>(`/matches${query({ competitionId })}`);

export const fetchMatchRadar = (competitionId: number) =>
  request<MatchRadar>(`/matches/radar${query({ competitionId })}`);

export const fetchTournamentGroupOdds = (competitionId: number) =>
  request<GroupOdds>(tournament(competitionId, 'group-odds'));

// Evita que el panel Pichichi se quede cargando indefinidamente si el backend no responde.
export const fetchTournamentTopScorers = (competitionId: number) =>
  request<TopScorer[]>(tournament(competitionId, 'scorers'), { timeoutMs: 12_000 });

export const fetchCompetitionStandings = async (
  competitionId: number | null,
): Promise<LeagueStanding[]> =>
  competitionId ? request<LeagueStanding[]>(`/competitions/${competitionId}/standings`) : [];

let cachedCompetitions: Competition[] | null = null;
export async function fetchCompetitions(): Promise<Competition[]> {
  cachedCompetitions ??= await request<Competition[]>('/competitions');
  return cachedCompetitions;
}

/** Cuadro oficial. Se cachea como consulta de TanStack (`tournamentOfficialBracketQuery`). */
export const fetchTournamentOfficialBracket = (competitionId: number) =>
  request<PredictionData>(tournament(competitionId, 'official-bracket'));
