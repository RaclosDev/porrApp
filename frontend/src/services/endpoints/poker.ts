import { request } from '../http';

export interface BlindLevel {
  minutes: number;
  small: number;
  big: number;
  ante: number;
}

export interface PokerExtra {
  costCents: number;
  chips: number;
  /** Máximo por jugador; null si no tiene límite. */
  limit: number | null;
  throughLevel: number;
}

export interface PokerSettings {
  buyInCents: number;
  startingChips: number;
  rebuy: PokerExtra | null;
  addOn: PokerExtra | null;
  prizeShares: number[];
  /** Cantidades fijas por puesto en céntimos; null o ausente si el reparto va por porcentajes. */
  prizeAmounts?: number[] | null;
  levels: BlindLevel[];
  /** Cómo se sugieren los puntos si los que siguen en la mesa pactan; por defecto, a partes iguales. */
  pactPoints?: PactPoints | null;
  /** Redondeo del dinero sugerido al cerrar, en céntimos; por defecto, 1 €. */
  roundingCents?: number | null;
  /** Puntos de liga enteros por puesto; null o ausente usa la escala de siempre (5-3-1). */
  prizePoints?: number[] | null;
}

export type PactPoints = 'EQUAL' | 'ICM';

/** Lo que se lleva un jugador al cerrar: dinero en céntimos y puntos con hasta dos decimales. */
export interface PokerPayout {
  playerId: number;
  prizeCents: number;
  points: number;
}

interface PokerEntry {
  playerId: number;
  name: string;
  rebuys: number;
  addOns: number;
}

export interface BlindClock {
  level: number;
  endsAt: number | null;
  remainingMs: number;
}

interface FinalStack {
  playerId: number;
  chips: number;
}

interface PokerResult extends PokerEntry {
  finalChips?: number | null;
  place: number;
  paidCents: number;
  prizeCents: number;
  /** Puntos de la liga en este torneo; puede tener decimales si hubo pacto. */
  points?: number;
}

export interface PokerSession {
  id: number;
  revision: number;
  date: string;
  startedAt: number | null;
  closedAt: number | null;
  settings: PokerSettings;
  entries: PokerEntry[];
  eliminations: number[];
  clock: BlindClock | null;
  potCents: number;
  prizes: number[];
  results: PokerResult[];
  /** Bote menos lo repartido al cerrar; negativo si se repartió de más. */
  leftoverCents?: number;
}

export interface PokerPlayer {
  id: number;
  name: string;
  guest: boolean;
  userId?: number | null;
  avatarUrl?: string | null;
}

export interface PokerLeagueData {
  id: number;
  name: string;
  joinCode: string;
  owner: boolean;
  /** Creador o administrador: puede corregir y borrar torneos del histórico. */
  admin: boolean;
  /** Todos los miembros preparan, editan y dirigen los torneos (el histórico sigue en la administración). */
  everyoneOrganizes?: boolean;
  myPlayerId: number | null;
  players: PokerPlayer[];
  /** El que está en juego o el más próximo; el mismo que encabeza `upcoming`. */
  current: PokerSession | null;
  /** Todos los torneos abiertos: primero el que está en juego y después por fecha. */
  upcoming?: PokerSession[];
  serverNow: number;
}

export type PokerAction =
  | 'START'
  | 'PAUSE'
  | 'RESUME'
  | 'NEXT_LEVEL'
  | 'REBUY'
  | 'ADD_ON'
  | 'UNDO_REBUY'
  | 'UNDO_ADD_ON'
  | 'ELIMINATE'
  | 'UNDO_ELIMINATION'
  | 'SET_PRIZES'
  | 'CLOSE'
  | 'CANCEL';

/** Datos opcionales de una orden: fichas al cerrar o el nuevo reparto de premios. */
export interface PokerCommandExtra {
  finalStacks?: FinalStack[];
  prizeShares?: number[];
  prizeAmounts?: number[];
  payouts?: PokerPayout[];
}

export const fetchPokerLeague = (id: string) => request<PokerLeagueData>(`/poker/${id}`);

export const fetchPokerHistory = (id: string) => request<PokerSession[]>(`/poker/${id}/history`);

interface PokerResultEdit {
  playerId: number;
  rebuys: number;
  addOns: number;
  /** Con premio y puntos se fijan a mano; sin ellos se calculan por el puesto. */
  prizeCents?: number;
  points?: number;
}

/** Corrección completa de un torneo cerrado: lo que llegue sin precio se queda como estaba. */
export interface PokerResultsEdit {
  date: string;
  standings: PokerResultEdit[];
  buyInCents?: number;
  rebuyCostCents?: number;
  addOnCostCents?: number;
  /** Quita las fichas finales: los que seguían en la mesa quedan como en un pacto sin contarlas. */
  clearChips?: boolean;
}

export const editPokerResult = (id: number, session: PokerSession, edit: PokerResultsEdit) =>
  request<PokerSession[]>(`/poker/${id}/history/${session.id}`, {
    method: 'PUT',
    json: { ...edit, revision: session.revision },
  });

export const deletePokerResult = (id: number, sessionId: number) =>
  request<PokerSession[]>(`/poker/${id}/history/${sessionId}`, { method: 'DELETE' });

export const createPokerLeague = (name: string, creationKey: string) =>
  request<PokerLeagueData>('/poker', { method: 'POST', json: { name, creationKey } });

export const setPokerOrganizing = (id: number, everyoneOrganizes: boolean) =>
  request<PokerLeagueData>(`/poker/${id}/organizing`, {
    method: 'PUT',
    json: { everyoneOrganizes },
  });

export const addPokerGuest = (id: number, sessionId: number, name: string) =>
  request<PokerLeagueData>(`/poker/${id}/sessions/${sessionId}/guests`, {
    method: 'POST',
    json: { name },
  });

/** Quita a un invitado sin cuenta; el histórico conserva su nombre. */
export const removePokerGuest = (id: number, playerId: number) =>
  request<PokerLeagueData>(`/poker/${id}/players/${playerId}`, { method: 'DELETE' });

export const savePokerSession = (
  id: number,
  date: string,
  settings: PokerSettings,
  session?: PokerSession,
) =>
  request<PokerLeagueData>(
    session ? `/poker/${id}/sessions/${session.id}` : `/poker/${id}/sessions`,
    {
      method: session ? 'PUT' : 'POST',
      json: { date, settings, ...(session && { revision: session.revision }) },
    },
  );

export const setPokerAttendance = (
  id: number,
  sessionId: number,
  attending: boolean,
  playerId?: number,
) =>
  request<PokerLeagueData>(`/poker/${id}/sessions/${sessionId}/attendance`, {
    method: 'PUT',
    json: { attending, playerId },
  });

export const pokerCommand = (
  id: number,
  session: PokerSession,
  action: PokerAction,
  playerId?: number,
  extra: PokerCommandExtra = {},
) =>
  request<PokerLeagueData>(`/poker/${id}/sessions/${session.id}/commands`, {
    method: 'POST',
    json: { action, revision: session.revision, playerId, ...extra },
  });
