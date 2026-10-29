/**
 * Cliente HTTP del backend. Todas las llamadas pasan por {@link request}, que añade el token,
 * convierte los errores en excepciones con el mensaje del servidor y cierra la sesión si el
 * token actual ha caducado.
 */
import type {
  Competition,
  FriendPrediction,
  Group,
  GroupMember,
  GroupOdds,
  GroupStandings,
  JoinCodeResponse,
  LoginResponse,
  LeagueImageResponse,
  LeagueStanding,
  Match,
  MatchRadar,
  MatchdayFixture,
  MatchdayPoints,
  MatchdayPredictionInput,
  MatchdaySubmissionResult,
  Me,
  ParticipantScore,
  PaymentStatus,
  PaymentStatusResponse,
  PoolFormat,
  PredictionData,
  PredictionSaved,
  PredictionSummary,
  ProfileResponse,
  StatusResponse,
  TopScorer,
  UserPreferences,
} from '../types/api';
import { ApiError, NETWORK_ERROR_MESSAGE, TIMEOUT_ERROR_MESSAGE } from './apiError';

const API_BASE = '/api';

export function getAuthToken(): string | null {
  return localStorage.getItem('token') || null;
}

export function setAuthToken(token: string | null): void {
  if (token) {
    localStorage.setItem('token', token);
  } else {
    localStorage.removeItem('token');
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  /** Se envía como JSON. */
  json?: unknown;
  /** Se envía como multipart (el navegador pone el boundary). */
  form?: FormData;
  signal?: AbortSignal;
  /** Tiempo máximo de espera; por defecto {@link DEFAULT_TIMEOUT_MS}. */
  timeoutMs?: number;
  /** Mensaje si el servidor no explica el error. */
  fallbackError?: string;
}

const DEFAULT_TIMEOUT_MS = 20_000;
const UPLOAD_TIMEOUT_MS = 60_000;

/** Señal que se aborta al agotarse el tiempo o cuando lo pide quien llama. */
function requestSignal(
  signal: AbortSignal | undefined,
  timeoutMs: number,
): AbortSignal | undefined {
  if (typeof AbortSignal.timeout !== 'function') return signal;
  const timeout = AbortSignal.timeout(timeoutMs);
  if (!signal) return timeout;
  return typeof AbortSignal.any === 'function' ? AbortSignal.any([signal, timeout]) : signal;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const {
    method = 'GET',
    json,
    form,
    signal,
    fallbackError,
    timeoutMs = form ? UPLOAD_TIMEOUT_MS : DEFAULT_TIMEOUT_MS,
  } = options;
  const token = getAuthToken();
  const headers: Record<string, string> = {};
  if (json !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: form ?? (json !== undefined ? JSON.stringify(json) : undefined),
      signal: requestSignal(signal, timeoutMs),
    });
  } catch (err) {
    // Una cancelación pedida por quien llama (p. ej. TanStack Query) se propaga tal cual.
    if (signal?.aborted) throw err;
    if (err instanceof DOMException && err.name === 'TimeoutError') {
      throw new ApiError(0, TIMEOUT_ERROR_MESSAGE);
    }
    throw new ApiError(0, NETWORK_ERROR_MESSAGE);
  }

  if (!res.ok) {
    // Un 401 de una petición lanzada con un token anterior no debe cerrar la sesión nueva.
    if (res.status === 401 && token && getAuthToken() === token) {
      setAuthToken(null);
      localStorage.removeItem('my_prediction_name');
      localStorage.removeItem('my_user_id');
      localStorage.removeItem('my_avatar_url');
      window.dispatchEvent(new Event('auth-expired'));
    }
    const body = await res.json?.().catch(() => ({}));
    throw new ApiError(
      res.status,
      body?.error || body?.message || fallbackError || `HTTP error! status: ${res.status}`,
    );
  }
  return res.json();
}

const query = (params: Record<string, string | number | null | undefined>): string => {
  const entries = Object.entries(params).filter(
    ([, v]) => v !== null && v !== undefined && v !== '',
  );
  if (entries.length === 0) return '';
  return '?' + entries.map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&');
};

const imageForm = (blob: Blob): FormData => {
  const form = new FormData();
  form.append('file', blob, blob.type === 'image/png' ? 'image.png' : 'image.jpg');
  return form;
};

// --- Torneo y partidos ---

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

// --- Pronósticos de cuadro completo ---

export const fetchPrediction = (id: number | string) =>
  request<PredictionData>(`/predictions/${id}`, { fallbackError: 'Error al cargar la porra' });

/** Desglose de puntos de un pronóstico. Se cachea como consulta (`predictionScoreQuery`). */
export const fetchPredictionScore = (id: number | string) =>
  request<ParticipantScore>(`/predictions/${id}/score`);

export const fetchPredictions = (groupId: number | string | null = null) =>
  request<PredictionSummary[]>(`/predictions${query({ groupId })}`);

export const fetchMyPredictions = () => request<PredictionSummary[]>('/predictions/mine');

export const createPrediction = (
  predictionData: PredictionData,
  groupId: number | string | null = null,
) =>
  request<PredictionSaved>(`/predictions${query({ groupId })}`, {
    method: 'POST',
    json: predictionData,
    fallbackError: 'Hubo un error al guardar la porra.',
  });

// --- Clasificación ---

export const fetchLeaderboard = (groupId: number | string | null = null) =>
  request<ParticipantScore[]>(`/leaderboard${query({ groupId })}`);

export const fetchLeaderboardMatchdays = (groupId: number | string | null = null) =>
  request<MatchdayPoints[]>(`/leaderboard/matchdays${query({ groupId })}`);

// --- Ligas ---

export const fetchMyGroups = () => request<Group[]>('/groups/mine');

export const fetchGroup = (id: number | string) => request<Group>(`/groups/${id}`);

/** Metadatos públicos de una invitación, sin unirse a la liga. */
export const fetchGroupInvitationPreview = (joinCode: string) =>
  request<Group>(`/groups/preview/${encodeURIComponent(joinCode)}`);

export const createGroup = (
  name: string,
  competitionId: number | string,
  poolFormat: PoolFormat,
  pichichi = true,
) =>
  request<Group>('/groups', {
    method: 'POST',
    json: { name, competitionId, poolFormat, pichichi },
    fallbackError: 'Error al crear la liga',
  });

export const updateGroup = (
  id: number | string,
  name: string | undefined,
  rules: string | undefined,
) =>
  request<Group>(`/groups/${id}`, {
    method: 'PUT',
    json: { name, rules },
    fallbackError: 'Error al actualizar la liga',
  });

export const deleteGroup = (id: number | string) =>
  request<StatusResponse>(`/groups/${id}`, {
    method: 'DELETE',
    fallbackError: 'Error al borrar la liga',
  });

export const joinGroup = (joinCode: string) =>
  request<Group>('/groups/join', {
    method: 'POST',
    json: { joinCode },
    fallbackError: 'Grupo no encontrado o código inválido',
  });

export const leaveGroup = (id: number | string) =>
  request<StatusResponse>(`/groups/${id}/leave`, {
    method: 'DELETE',
    fallbackError: 'Error al abandonar el grupo',
  });

export const acceptGroupPrediction = (groupId: number | string, predictionId: number | string) =>
  request<StatusResponse>(`/groups/${groupId}/predictions/${predictionId}/accept`, {
    method: 'PUT',
    fallbackError: 'Error al confirmar la porra',
  });

export const deleteGroupPrediction = (groupId: number | string, predictionId: number | string) =>
  request<StatusResponse>(`/groups/${groupId}/predictions/${predictionId}`, {
    method: 'DELETE',
    fallbackError: 'Error al eliminar la porra',
  });

export const fetchGroupMembers = (groupId: number | string) =>
  request<GroupMember[]>(`/groups/${groupId}/members`);

export const toggleGroupMemberPayment = (
  groupId: number | string,
  userId: number,
  status: PaymentStatus,
) =>
  request<PaymentStatusResponse>(`/groups/${groupId}/members/${userId}/payment`, {
    method: 'PUT',
    json: { status },
    fallbackError: 'Error al actualizar estado de pago',
  });

export const kickGroupMember = (groupId: number | string, userId: number) =>
  request<StatusResponse>(`/groups/${groupId}/members/${userId}`, {
    method: 'DELETE',
    fallbackError: 'Error al expulsar al miembro',
  });

export const regenerateGroupJoinCode = (groupId: number | string) =>
  request<JoinCodeResponse>(`/groups/${groupId}/regenerate-code`, {
    method: 'POST',
    fallbackError: 'Error al regenerar código',
  });

export const uploadGroupImage = (groupId: number | string, blob: Blob) =>
  request<LeagueImageResponse>(`/groups/${groupId}/image`, {
    method: 'PUT',
    form: imageForm(blob),
  });

export const deleteGroupImage = (groupId: number | string) =>
  request<LeagueImageResponse>(`/groups/${groupId}/image`, { method: 'DELETE' });

// --- Pronósticos por jornada ---

export const fetchMatchdayFixtures = (groupId: number | string, round = '') =>
  request<MatchdayFixture[]>(`/predictions/matchday${query({ groupId, round })}`);

export const submitMatchdayPredictions = (
  groupId: number | string,
  predictions: MatchdayPredictionInput[],
) =>
  request<MatchdaySubmissionResult>('/predictions/matchday', {
    method: 'POST',
    json: { groupId: Number(groupId), predictions },
    fallbackError: 'Error al guardar pronósticos de jornada',
  });

export const fetchMatchdayFriendPredictions = (groupId: number | string, matchId: number) =>
  request<FriendPrediction[]>(
    `/predictions/matchday/matches/${matchId}/predictions${query({ groupId })}`,
  );

// --- Usuario ---

export const loginWithGoogle = (credential: string) =>
  request<LoginResponse>('/auth/google/login', {
    method: 'POST',
    json: { credential },
    fallbackError: 'Error al iniciar sesión con Google',
  });

export const fetchMe = () => request<Me>('/users/me');

export const updateUserPreferences = (preferences: UserPreferences) =>
  request<StatusResponse>('/users/me/preferences', {
    method: 'PUT',
    json: preferences,
    fallbackError: 'Error al actualizar preferencias',
  });

export const updateMyProfile = (participantName: string) =>
  request<ProfileResponse>('/users/me/profile', { method: 'PUT', json: { participantName } });

export const uploadMyAvatar = (blob: Blob) =>
  request<ProfileResponse>('/users/me/avatar', { method: 'PUT', form: imageForm(blob) });

export const deleteMyAvatar = () =>
  request<ProfileResponse>('/users/me/avatar', { method: 'DELETE' });
