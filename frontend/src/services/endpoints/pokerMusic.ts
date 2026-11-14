import { request } from '../http';

export interface MusicTrack {
  videoId: string;
  title: string;
  channel: string;
}

interface QueuedTrack extends MusicTrack {
  id: number;
  addedBy: string;
  /** El organizador puede quitar cualquiera; cada jugador, solo las suyas. */
  removable: boolean;
}

export interface MusicQueue {
  organizer: boolean;
  /** False si el servidor no tiene configurada la búsqueda de YouTube. */
  searchAvailable: boolean;
  items: QueuedTrack[];
}

export interface MusicSearch {
  available: boolean;
  results: MusicTrack[];
}

export const fetchMusicQueue = (leagueId: string | number) =>
  request<MusicQueue>(`/poker/${leagueId}/music`);

export const searchMusic = (leagueId: string | number, query: string) =>
  request<MusicSearch>(`/poker/${leagueId}/music/search?q=${encodeURIComponent(query)}`);

export const addMusicTrack = (leagueId: string | number, track: MusicTrack) =>
  request<MusicQueue>(`/poker/${leagueId}/music`, { method: 'POST', json: track });

export const removeMusicTrack = (leagueId: string | number, itemId: number) =>
  request<MusicQueue>(`/poker/${leagueId}/music/${itemId}`, { method: 'DELETE' });
