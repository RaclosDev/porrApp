import { request } from '../http';

interface TournamentParticipant {
  id: string;
  name: string;
}
export interface TournamentMatch {
  id: string;
  round: number;
  position: number;
  homeId: string | null;
  awayId: string | null;
  scheduledAt: string | null;
  venue: string | null;
  homeScore: number | null;
  awayScore: number | null;
  outcome: 'HOME' | 'AWAY' | 'DRAW' | null;
  bye: boolean;
}
interface TournamentStanding {
  participantId: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  scored: number;
  conceded: number;
  points: number;
}
export interface OrganizedTournament {
  id: number;
  name: string;
  activity: string;
  participantType: 'INDIVIDUAL' | 'TEAM' | 'PAIR';
  format: 'MANUAL' | 'LEAGUE' | 'KNOCKOUT';
  published: boolean;
  publicId: string;
  revision: number;
  winPoints: number;
  drawPoints: number;
  lossPoints: number;
  participants: TournamentParticipant[];
  matches: TournamentMatch[];
  standings: TournamentStanding[];
}
export const tournamentKey = (id: string, publicView: boolean) =>
  ['organizedTournament', publicView ? 'public' : 'admin', id] as const;
export const fetchOrganizedTournament = (id: string, publicView: boolean) =>
  request<OrganizedTournament>(
    `/tournaments/${publicView ? 'public/' : ''}${encodeURIComponent(id)}`,
  );
export const createOrganizedTournament = (draft: {
  name: string;
  activity: string;
  participantType: string;
  creationKey: string;
}) => request<OrganizedTournament>('/tournaments', { method: 'POST', json: draft });
export const changeTournament = (
  id: number,
  path: string,
  method: 'POST' | 'PUT' | 'DELETE',
  json?: object,
) => request<OrganizedTournament>(`/tournaments/${id}/${path}`, { method, json });
