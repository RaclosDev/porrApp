/** Marcadores de juegos de mesa o de cartas: partidas apuntadas, sesiones y clasificación acumulada. */
import { request } from '../http';

export interface TrackerPlayer {
  id: number;
  name: string;
}

/**
 * Posición con empates (1, 1, 3…). `sessionsWon` y `sessionsPlayed` solo cuentan en las
 * clasificaciones acumuladas.
 */
export interface TrackerStanding {
  playerId: number;
  name: string;
  total: number;
  rank: number;
  roundsWon: number;
  sessionsWon: number;
  sessionsPlayed?: number;
}

/** Forma de puntuar un juego: sumando puntos en cada ronda o contando quién gana cada una. */
export type TrackerGameMode = 'POINTS' | 'WINS';

export interface TrackerGame {
  id: number;
  name: string;
  unit: string;
  lowerWins: boolean;
  sessions: number;
  rounds: number;
  mode: TrackerGameMode;
}

/** Día de juego: quién vino y sus partidas en orden; `closedAt` vacío mientras sigue. */
export interface TrackerDay {
  id: number;
  startedAt: string;
  closedAt: string | null;
  playerIds: number[];
  sessionIds: number[];
}

/** Partida de un juego en un día, con quién la juega; `endedAt` vacío mientras está abierta. */
export interface TrackerSession {
  id: number;
  number: number;
  gameId: number | null;
  startedAt: string;
  rounds: number;
  standings: TrackerStanding[];
  winners: number[];
  dayId: number | null;
  playerIds: number[];
  endedAt: string | null;
  plannedRounds: number | null;
}

export interface TrackerRound {
  id: number;
  sessionId: number;
  number: number;
  note: string | null;
  createdAt: string;
  /** Puntos por id de jugador, solo de quienes jugaron la ronda (en victorias, 1 quien ganó). */
  scores: Record<string, number>;
  recordedBy: string | null;
}

export interface Tracker {
  id: number;
  name: string;
  /** Unidad y sentido del juego de la última partida. */
  unit: string;
  lowerWins: boolean;
  /** Quien administra la liga: el único que renombra o borra juegos y borra la liga. */
  owner: boolean;
  joinCode: string;
  /** Jugador que soy yo (con mi cuenta), si ya me he apuntado a uno. */
  myPlayerId: number | null;
  /** Jugadores ya reclamados por alguien con cuenta. */
  claimedPlayerIds: number[];
  currentSessionId: number | null;
  currentGameId?: number | null;
  games?: TrackerGame[];
  players: TrackerPlayer[];
  sessions: TrackerSession[];
  rounds: TrackerRound[];
  overall: TrackerStanding[];
  byGame?: { gameId: number; standings: TrackerStanding[] }[];
  /** Día de juego en curso, si lo hay. */
  currentDayId?: number | null;
  days?: TrackerDay[];
}

/** Lo que se apunta en una ronda: puntos de quienes la jugaron o, en victorias, quién ganó. */
export interface TrackerRoundDraft {
  note?: string;
  scores?: Record<string, number>;
  winners?: number[];
  sessionId?: number;
}

export interface TrackerGameDraft {
  name: string;
  unit: string;
  lowerWins: boolean;
  mode: TrackerGameMode;
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
}

export const fetchTrackers = () => request<TrackerSummary[]>('/trackers');

export const fetchTracker = (id: number | string) => request<Tracker>(`/trackers/${id}`);

export const createTracker = (draft: TrackerDraft) =>
  request<Tracker>('/trackers', {
    method: 'POST',
    json: draft,
    fallbackError: 'No se pudo crear el marcador',
  });

export const addTrackerRound = (id: number, round: TrackerRoundDraft) =>
  request<Tracker>(`/trackers/${id}/rounds`, {
    method: 'POST',
    json: round,
    fallbackError: 'No se pudo apuntar la ronda',
  });

export const editTrackerRound = (id: number, roundId: number, round: TrackerRoundDraft) =>
  request<Tracker>(`/trackers/${id}/rounds/${roundId}`, {
    method: 'PUT',
    json: round,
    fallbackError: 'No se pudo corregir la ronda',
  });

export const deleteTrackerRound = (id: number, roundId: number) =>
  request<Tracker>(`/trackers/${id}/rounds/${roundId}`, {
    method: 'DELETE',
    fallbackError: 'No se pudo borrar la ronda',
  });

export const startTrackerSession = (
  id: number,
  session: { gameId?: number; playerIds?: number[]; plannedRounds?: number } = {},
) =>
  request<Tracker>(`/trackers/${id}/sessions`, {
    method: 'POST',
    json: session,
    fallbackError: 'No se pudo empezar la partida',
  });

export const endTrackerSession = (id: number, sessionId: number) =>
  request<Tracker>(`/trackers/${id}/sessions/${sessionId}/end`, {
    method: 'POST',
    fallbackError: 'No se pudo terminar la partida',
  });

export const reopenTrackerSession = (id: number, sessionId: number) =>
  request<Tracker>(`/trackers/${id}/sessions/${sessionId}/reopen`, {
    method: 'POST',
    fallbackError: 'No se pudo reabrir la partida',
  });

export const startTrackerDay = (id: number, playerIds: number[]) =>
  request<Tracker>(`/trackers/${id}/days`, {
    method: 'POST',
    json: { playerIds },
    fallbackError: 'No se pudo empezar el día de juego',
  });

export const closeTrackerDay = (id: number, dayId: number) =>
  request<Tracker>(`/trackers/${id}/days/${dayId}/close`, {
    method: 'POST',
    fallbackError: 'No se pudo cerrar el día de juego',
  });

export const addTrackerGame = (id: number, game: TrackerGameDraft) =>
  request<Tracker>(`/trackers/${id}/games`, {
    method: 'POST',
    json: game,
    fallbackError: 'No se pudo crear el juego',
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

export const claimTrackerPlayer = (id: number, playerId: number) =>
  request<Tracker>(`/trackers/${id}/me`, {
    method: 'PUT',
    json: { playerId },
    fallbackError: 'No se pudo apuntarte a ese jugador',
  });

export const releaseTrackerPlayer = (id: number) =>
  request<Tracker>(`/trackers/${id}/me`, {
    method: 'DELETE',
    fallbackError: 'No se pudo quitarte del jugador',
  });

export const renameTrackerPlayer = (id: number, playerId: number, name: string) =>
  request<Tracker>(`/trackers/${id}/players/${playerId}`, {
    method: 'PUT',
    json: { name },
    fallbackError: 'No se pudo cambiar el nombre',
  });

export const deleteTrackerPlayer = (id: number, playerId: number) =>
  request<Tracker>(`/trackers/${id}/players/${playerId}`, {
    method: 'DELETE',
    fallbackError: 'No se pudo quitar el jugador',
  });

/** Junta `playerId` con `intoPlayerId`: sus rondas pasan al segundo y el primero desaparece. */
export const mergeTrackerPlayer = (id: number, playerId: number, intoPlayerId: number) =>
  request<Tracker>(`/trackers/${id}/players/${playerId}/merge`, {
    method: 'POST',
    json: { intoPlayerId },
    fallbackError: 'No se pudieron juntar los jugadores',
  });

export const editTrackerGame = (id: number, gameId: number, game: { name: string; unit: string }) =>
  request<Tracker>(`/trackers/${id}/games/${gameId}`, {
    method: 'PUT',
    json: game,
    fallbackError: 'No se pudo cambiar el juego',
  });

export const deleteTrackerGame = (id: number, gameId: number) =>
  request<Tracker>(`/trackers/${id}/games/${gameId}`, {
    method: 'DELETE',
    fallbackError: 'No se pudo borrar el juego',
  });

export const deleteTrackerDay = (id: number, dayId: number) =>
  request<Tracker>(`/trackers/${id}/days/${dayId}`, {
    method: 'DELETE',
    fallbackError: 'No se pudo borrar el día',
  });

/** Pone a un día de juego cerrado la fecha (AAAA-MM-DD) en que se jugó. */
export const moveTrackerDay = (id: number, dayId: number, date: string) =>
  request<Tracker>(`/trackers/${id}/days/${dayId}/date`, {
    method: 'PUT',
    json: { date },
    fallbackError: 'No se pudo cambiar la fecha',
  });
