/**
 * Cliente HTTP del backend. Todas las llamadas pasan por {@link request}, que añade el access
 * token, lo renueva una vez si el servidor responde 401 y convierte los errores en excepciones
 * con el mensaje del servidor.
 */
import type {
  Competition,
  FriendPrediction,
  Group,
  GroupMember,
  GroupOdds,
  GroupStandings,
  JoinCodeResponse,
  LeagueScoring,
  LoginResponse,
  LeagueImageResponse,
  LeagueStanding,
  Match,
  MatchRadar,
  MatchdayFixture,
  MatchdayPoints,
  MatchdayPredictionInput,
  MatchdayStats,
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
  ScoringRules,
  StatusResponse,
  TopScorer,
  UserPreferences,
} from '../types/api';
import { ApiError, NETWORK_ERROR_MESSAGE, TIMEOUT_ERROR_MESSAGE } from './apiError';
import { hasStoredSession, LEGACY_TOKEN_KEY, SESSION_HINT_KEY } from './sessionHint';

const API_BASE = '/api';

// --- Sesión ---
// El access token (JWT de 15 minutos) vive solo en memoria. Lo que mantiene la sesión es el
// refresh token, en una cookie HttpOnly que el navegador manda solo a /api/auth/session. En
// localStorage queda solo una marca, sin valor secreto, de que este dispositivo tiene sesión.

const SESSION_PATH = '/auth/session';

/** Resultado de recuperar la sesión al cargar la aplicación. */
export type SessionRestore = 'restored' | 'none' | 'unreachable';

let accessToken: string | null = null;
let sessionRestore: Promise<SessionRestore> | null = null;
let restoring = false;
let pendingRefresh: Promise<string | null> | null = null;
/** Cambia al cerrar sesión, para que un refresco que ya iba en camino no la reabra. */
let sessionEpoch = 0;

export function getAuthToken(): string | null {
  return accessToken;
}

export function setAuthToken(token: string | null): void {
  accessToken = token;
  if (token) {
    localStorage.setItem(SESSION_HINT_KEY, '1');
  } else {
    localStorage.removeItem(SESSION_HINT_KEY);
  }
}

/**
 * Recupera la sesión al arrancar: canjea el JWT antiguo si queda alguno y, si no, rota el
 * refresh token de la cookie. Las peticiones que salgan mientras tanto esperan a que acabe.
 */
export function initSession(): Promise<SessionRestore> {
  restoring = true;
  sessionRestore = restoreSession().finally(() => {
    restoring = false;
  });
  return sessionRestore;
}

/** La recuperación lanzada por {@link initSession}, o null si no se ha lanzado. */
export function whenSessionRestored(): Promise<SessionRestore> | null {
  return sessionRestore;
}

async function restoreSession(): Promise<SessionRestore> {
  if (!hasStoredSession()) return 'none';
  try {
    if (await withSessionLock(exchangeLegacyToken)) return 'restored';
    return (await refreshSession()) ? 'restored' : 'none';
  } catch {
    return 'unreachable';
  }
}

/** Canjea el JWT de 7 días de la versión anterior, si queda, por una sesión con cookie. */
async function exchangeLegacyToken(): Promise<boolean> {
  // Se lee dentro del cerrojo: otra pestaña puede haberlo canjeado ya.
  const legacyToken = localStorage.getItem(LEGACY_TOKEN_KEY);
  if (!legacyToken) return false;
  const token = await requestSessionToken('exchange', legacyToken);
  localStorage.removeItem(LEGACY_TOKEN_KEY);
  if (token) setAuthToken(token);
  return token !== null;
}

/**
 * Rota el refresh token y guarda el access token nuevo, uno a la vez por pestaña.
 * Resuelve null si la sesión ha terminado; falla si no se ha podido hablar con el servidor.
 */
function refreshSession(): Promise<string | null> {
  if (!pendingRefresh) {
    const epoch = sessionEpoch;
    pendingRefresh = withSessionLock(() => requestSessionToken('refresh'))
      .then((token) => {
        if (epoch !== sessionEpoch) return null;
        setAuthToken(token);
        return token;
      })
      .finally(() => {
        pendingRefresh = null;
      });
  }
  return pendingRefresh;
}

/**
 * Las pestañas comparten la cookie: si dos rotaran a la vez el mismo refresh token, la segunda
 * parecería una reutilización y el servidor cerraría la sesión. Web Locks las pone en fila.
 */
function withSessionLock<T>(task: () => Promise<T>): Promise<T> {
  if (typeof navigator !== 'undefined' && 'locks' in navigator) {
    return navigator.locks.request('porrapp-session', task);
  }
  return task();
}

/** POST a /api/auth/session/*: el access token nuevo, o null si el servidor rechaza la sesión. */
async function requestSessionToken(
  action: 'refresh' | 'exchange',
  bearer: string | null = null,
): Promise<string | null> {
  const res = await send(`${SESSION_PATH}/${action}`, { method: 'POST' }, bearer);
  if (res.status === 401) return null;
  if (!res.ok) throw new ApiError(res.status, `HTTP error! status: ${res.status}`);
  const body = (await res.json()) as { token: string };
  return body.token;
}

/** Cierra la sesión de este dispositivo: olvida el token y revoca el refresh en el servidor. */
export function endSession(): void {
  sessionEpoch++;
  setAuthToken(null);
  localStorage.removeItem(LEGACY_TOKEN_KEY);
  // keepalive: la petición sale aunque la página se cierre o recargue justo después.
  fetch(`${API_BASE}${SESSION_PATH}/logout`, { method: 'POST', keepalive: true }).catch(() => {});
}

/** Token con el que repetir una petición rechazada con 401, o null si no hay sesión. */
async function tokenAfter401(rejected: string | null): Promise<string | null> {
  const current = getAuthToken();
  // Otra petición ya lo renovó (o se cerró la sesión) mientras esta iba en camino.
  if (current !== rejected) return current;
  const epoch = sessionEpoch;
  try {
    const token = await refreshSession();
    if (!token && epoch === sessionEpoch) window.dispatchEvent(new Event('auth-expired'));
    return token;
  } catch {
    // Sin respuesta del servidor: se mantiene la sesión y se devuelve el 401.
    return null;
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

/** Una petición HTTP; los fallos de red y de tiempo se convierten en {@link ApiError}. */
async function send(
  path: string,
  options: RequestOptions,
  token: string | null,
): Promise<Response> {
  const {
    method = 'GET',
    json,
    form,
    signal,
    timeoutMs = form ? UPLOAD_TIMEOUT_MS : DEFAULT_TIMEOUT_MS,
  } = options;
  const headers: Record<string, string> = {};
  if (json !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  try {
    return await fetch(`${API_BASE}${path}`, {
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
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  if (restoring && sessionRestore) await sessionRestore;
  const sentToken = getAuthToken();
  let res = await send(path, options, sentToken);

  // Access token caducado: se renueva una vez y se repite la petición. En /auth/ no, porque
  // ahí un 401 (p. ej. una credencial de Google inválida) no es de la sesión.
  if (
    res.status === 401 &&
    !path.startsWith('/auth/') &&
    (sentToken !== null || hasStoredSession())
  ) {
    const token = await tokenAfter401(sentToken);
    if (token) res = await send(path, options, token);
  }

  if (!res.ok) {
    const body = await res.json?.().catch(() => ({}));
    throw new ApiError(
      res.status,
      body?.error || body?.message || options.fallbackError || `HTTP error! status: ${res.status}`,
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

/** Reglas de puntuación de la liga, las de por defecto y si quien consulta puede cambiarlas. */
export const fetchLeagueScoring = (groupId: number | string) =>
  request<LeagueScoring>(`/groups/${groupId}/scoring`);

/** Cambia la puntuación de la liga; el servidor recalcula los puntos. Solo el administrador. */
export const updateLeagueScoring = (groupId: number | string, rules: ScoringRules) =>
  request<LeagueScoring>(`/groups/${groupId}/scoring`, {
    method: 'PUT',
    json: rules,
    fallbackError: 'No se pudo guardar la puntuación',
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

// --- Estadísticas ---

/** Reparto 1X2 y marcadores más repetidos de los partidos ya empezados de una liga por jornadas. */
export const fetchMatchdayStats = (groupId: number | string) =>
  request<MatchdayStats>(`/predictions/matchday/stats${query({ groupId })}`);
