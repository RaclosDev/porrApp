/** Clasificación de una liga y su evolución. */
import type { MatchdayPoints, ParticipantScore, ScoreLogEntry } from '../../types/api';
import { request, query } from '../http';

export const fetchLeaderboard = (groupId: number | string | null = null) =>
  request<ParticipantScore[]>(`/leaderboard${query({ groupId })}`);

/** Registro de puntos de cada pronóstico de la liga (id -> entradas), para la evolución por partidos. */
export const fetchLeaderboardLogs = (groupId: number | string) =>
  request<Record<string, ScoreLogEntry[]>>(`/leaderboard/logs${query({ groupId })}`);

export const fetchLeaderboardMatchdays = (groupId: number | string | null = null) =>
  request<MatchdayPoints[]>(`/leaderboard/matchdays${query({ groupId })}`);
