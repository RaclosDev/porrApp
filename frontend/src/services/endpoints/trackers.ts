/** Marcadores de juegos de mesa o de cartas: partidas apuntadas, sesiones y clasificación acumulada. */
import { request } from '../http';

export interface TrackerPlayer {
  id: number;
  name: string;
}

/** Posición con empates (1, 1, 3…); `sessionsWon` solo viene en la clasificación acumulada. */
export interface TrackerStanding {
  playerId: number;
  name: string;
  total: number;
  rank: number;
  roundsWon: number;
  sessionsWon: number;
}

export interface TrackerSession {
  id: number;
  number: number;
  startedAt: string;
  rounds: number;
  standings: TrackerStanding[];
  winners: number[];
}

export interface TrackerRound {
  id: number;
  sessionId: number;
  number: number;
  note: string | null;
  createdAt: string;
  /** Puntos por id de jugador. */
  scores: Record<string, number>;
}

export interface Tracker {
  id: number;
  name: string;
  unit: string;
  lowerWins: boolean;
  /** Solo quien lo creó apunta partidas; el resto lo ve en directo. */
  owner: boolean;
  joinCode: string;
  currentSessionId: number | null;
  players: TrackerPlayer[];
  sessions: TrackerSession[];
  rounds: TrackerRound[];
  overall: TrackerStanding[];
}

export interface TrackerSummary {
  id: number;
  name: string;
  owner: boolean;
  players: number;
  rounds: number;
}

export interface TrackerDraft {
  name: string;
  unit: string;
  lowerWins: boolean;
  players: string[];
}

export const fetchTrackers = () => request<TrackerSummary[]>('/trackers');

export const fetchTracker = (id: number | string) => request<Tracker>(`/trackers/${id}`);

export const createTracker = (draft: TrackerDraft) =>
  request<Tracker>('/trackers', {
    method: 'POST',
    json: draft,
    fallbackError: 'No se pudo crear el marcador',
  });

export const joinTracker = (code: string) =>
  request<Tracker>('/trackers/join', {
    method: 'POST',
    json: { code },
    fallbackError: 'No se pudo entrar al marcador',
  });

export const addTrackerRound = (
  id: number,
  round: { note: string; scores: Record<string, number> },
) =>
  request<Tracker>(`/trackers/${id}/rounds`, {
    method: 'POST',
    json: round,
    fallbackError: 'No se pudo apuntar la partida',
  });

export const deleteTrackerRound = (id: number, roundId: number) =>
  request<Tracker>(`/trackers/${id}/rounds/${roundId}`, {
    method: 'DELETE',
    fallbackError: 'No se pudo borrar la partida',
  });

export const startTrackerSession = (id: number) =>
  request<Tracker>(`/trackers/${id}/sessions`, {
    method: 'POST',
    fallbackError: 'No se pudo empezar la sesión',
  });

export const addTrackerPlayer = (id: number, name: string) =>
  request<Tracker>(`/trackers/${id}/players`, {
    method: 'POST',
    json: { name },
    fallbackError: 'No se pudo añadir al jugador',
  });

export const deleteTracker = (id: number) =>
  request<void>(`/trackers/${id}`, {
    method: 'DELETE',
    fallbackError: 'No se pudo borrar el marcador',
  });

export const leaveTracker = (id: number) =>
  request<void>(`/trackers/${id}/membership`, {
    method: 'DELETE',
    fallbackError: 'No se pudo salir del marcador',
  });
