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
  limit: number;
  throughLevel: number;
}

export interface PokerSettings {
  buyInCents: number;
  startingChips: number;
  rebuy: PokerExtra | null;
  addOn: PokerExtra | null;
  prizeShares: number[];
  levels: BlindLevel[];
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

interface PokerResult extends PokerEntry {
  place: number;
  paidCents: number;
  prizeCents: number;
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
  myPlayerId: number | null;
  players: PokerPlayer[];
  current: PokerSession | null;
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
  | 'CLOSE'
  | 'CANCEL';

export const fetchPokerLeague = (id: string) => request<PokerLeagueData>(`/poker/${id}`);

export const fetchPokerHistory = (id: string) => request<PokerSession[]>(`/poker/${id}/history`);

export const createPokerLeague = (name: string, creationKey: string) =>
  request<PokerLeagueData>('/poker', { method: 'POST', json: { name, creationKey } });

export const addPokerGuest = (id: number, sessionId: number, name: string) =>
  request<PokerLeagueData>(`/poker/${id}/sessions/${sessionId}/guests`, {
    method: 'POST',
    json: { name },
  });

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
) =>
  request<PokerLeagueData>(`/poker/${id}/sessions/${session.id}/commands`, {
    method: 'POST',
    json: { action, revision: session.revision, playerId },
  });
