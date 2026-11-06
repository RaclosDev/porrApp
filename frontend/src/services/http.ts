/**
 * Transporte HTTP del backend y sesión. Todas las llamadas pasan por {@link request}, que añade el
 * access token, lo renueva una vez si el servidor responde 401 y convierte los errores en
 * excepciones con el mensaje del servidor. Los endpoints viven en `endpoints/`.
 */
import type { LoginResponse } from '../types/api';
import type { BrowserOptions } from '../utils/webauthn';
import { ApiError, NETWORK_ERROR_MESSAGE, TIMEOUT_ERROR_MESSAGE } from './apiError';
import {
  hasStoredSession,
  LEGACY_TOKEN_KEY,
  SESSION_HINT_KEY,
  SESSION_REVISION_KEY,
} from './sessionHint';

const API_BASE = '/api';

// --- Sesión ---
// El access token (JWT de 15 minutos) vive solo en memoria. Lo que mantiene la sesión es el
// refresh token, en una cookie HttpOnly que el navegador manda solo a /api/auth/session. En
// localStorage queda solo una marca, sin valor secreto, de que este dispositivo tiene sesión.

const SESSION_PATH = '/auth/session';

/** Resultado de recuperar la sesión al cargar la aplicación. */
export type SessionRestore = 'restored' | 'none' | 'unreachable' | 'superseded';

let accessToken: string | null = null;
let sessionRestore: Promise<SessionRestore> | null = null;
let restoring = false;
let pendingRefresh: { epoch: number; promise: Promise<string | null> } | null = null;
/** Cambia al sustituir la sesión; rotar su access token conserva la generación. */
let sessionEpoch = 0;
let boundRevision = localStorage.getItem(SESSION_REVISION_KEY);
let localSessionQueue: Promise<void> | null = null;

function currentSession(epoch: number): boolean {
  return epoch === sessionEpoch && boundRevision === localStorage.getItem(SESSION_REVISION_KEY);
}

function ensureSession(epoch: number): void {
  if (!currentSession(epoch))
    throw new ApiError(401, 'La sesión ha cambiado. Vuelve a intentarlo.');
}

function publishSessionChange(): void {
  boundRevision = crypto.randomUUID();
  localStorage.setItem(SESSION_REVISION_KEY, boundRevision);
}

export function getAuthToken(): string | null {
  return accessToken;
}

export function setAuthToken(token: string | null): void {
  const changed = token !== accessToken;
  if (changed) sessionEpoch++;
  storeAuthToken(token);
  if (changed) publishSessionChange();
  else if (token === null) boundRevision = localStorage.getItem(SESSION_REVISION_KEY);
}

function storeAuthToken(token: string | null): void {
  accessToken = token;
  if (token) {
    localStorage.setItem(SESSION_HINT_KEY, '1');
  } else {
    localStorage.removeItem(SESSION_HINT_KEY);
  }
}

/**
 * Recupera la sesión al arrancar rotando el refresh token de la cookie. Las peticiones que
 * salgan mientras tanto esperan a que acabe.
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
  const epoch = sessionEpoch;
  // El JWT de antes de la v5 ya no se acepta: no se deja en localStorage.
  localStorage.removeItem(LEGACY_TOKEN_KEY);
  if (!hasStoredSession()) return redeemHandoff(epoch);
  try {
    const refreshed = await refreshSession();
    if (!currentSession(epoch)) return 'superseded';
    return refreshed ? 'restored' : 'none';
  } catch {
    return currentSession(epoch) ? 'unreachable' : 'superseded';
  }
}

/** Ya se intentó canjear el traspaso de sesión en esta app instalada. */
const HANDOFF_CHECKED_KEY = 'session_handoff_checked';

/** App abierta desde la pantalla de inicio de un iPhone o iPad (`standalone` solo existe en iOS). */
function isIosHomeScreenApp(): boolean {
  return (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/**
 * Primera apertura de la app instalada en iPhone. iOS le copia las cookies de Safari pero no el
 * localStorage, así que aquí no hay marca de sesión. Si Safari dejó un código de traspaso en su
 * cookie ({@link prepareSessionHandoff}), se canjea por una sesión propia de la app. Un código
 * gastado o caducado solo deja la app sin sesión, como antes. Se intenta una vez por instalación.
 */
async function redeemHandoff(epoch: number): Promise<SessionRestore> {
  if (!isIosHomeScreenApp() || localStorage.getItem(HANDOFF_CHECKED_KEY)) return 'none';
  redeemingHandoff = true;
  try {
    const token = await withSessionLock(async () => {
      const res = await send(`${SESSION_PATH}/handoff`, { method: 'POST' }, null);
      if (res.status !== 200 && res.status !== 401) throw new ApiError(res.status, 'handoff');
      localStorage.setItem(HANDOFF_CHECKED_KEY, '1');
      if (res.status === 401 || !currentSession(epoch)) return null;
      const body = (await res.json()) as { token: string };
      storeAuthToken(body.token);
      return body.token;
    });
    if (!currentSession(epoch)) return 'superseded';
    return token ? 'restored' : 'none';
  } catch {
    return currentSession(epoch) ? 'unreachable' : 'superseded';
  } finally {
    redeemingHandoff = false;
  }
}

let redeemingHandoff = false;

/**
 * La app instalada está canjeando el traspaso de sesión al arrancar: aún no se sabe si hay cuenta,
 * así que no conviene enseñar la portada de visitante. Acaba cuando resuelve {@link initSession}.
 */
export function isRedeemingHandoff(): boolean {
  return redeemingHandoff;
}

/**
 * En Safari de iPhone, con sesión iniciada: el servidor deja en una cookie HttpOnly un código de un
 * solo uso que iOS copiará a la app al añadirla a la pantalla de inicio. Resuelve true si lo dejó.
 */
export async function prepareSessionHandoff(): Promise<boolean> {
  try {
    await request<unknown>('/auth/handoff', { method: 'POST' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Rota el refresh token y guarda el access token nuevo, uno a la vez por pestaña.
 * Resuelve null si la sesión ha terminado; falla si no se ha podido hablar con el servidor.
 */
function refreshSession(): Promise<string | null> {
  const epoch = sessionEpoch;
  if (!pendingRefresh || pendingRefresh.epoch !== epoch) {
    const promise = withSessionLock(async () => {
      if (!currentSession(epoch)) return null;
      const token = await requestSessionToken();
      if (!currentSession(epoch)) return null;
      storeAuthToken(token);
      return token;
    }).finally(() => {
      if (pendingRefresh?.epoch === epoch) pendingRefresh = null;
    });
    pendingRefresh = { epoch, promise };
  }
  return pendingRefresh.promise;
}

/**
 * Las pestañas comparten la cookie: si dos rotaran a la vez el mismo refresh token, la segunda
 * parecería una reutilización y el servidor cerraría la sesión. Web Locks las pone en fila.
 */
function withSessionLock<T>(task: () => Promise<T>): Promise<T> {
  if (typeof navigator !== 'undefined' && 'locks' in navigator) {
    return navigator.locks.request('porrapp-session', task);
  }
  const result = localSessionQueue ? localSessionQueue.then(task) : task();
  const settled = result.then(
    () => {},
    () => {},
  );
  localSessionQueue = settled;
  void settled.then(() => {
    if (localSessionQueue === settled) localSessionQueue = null;
  });
  return result;
}

/** POST a /api/auth/session/refresh: el access token nuevo, o null si la sesión ha terminado. */
async function requestSessionToken(): Promise<string | null> {
  const res = await send(`${SESSION_PATH}/refresh`, { method: 'POST' }, null);
  if (res.status === 401) return null;
  if (!res.ok) throw new ApiError(res.status, `HTTP error! status: ${res.status}`);
  const body = (await res.json()) as { token: string };
  return body.token;
}

/** Cierra la sesión de este dispositivo: olvida el token y revoca el refresh en el servidor. */
export function endSession(): Promise<void> {
  sessionEpoch++;
  storeAuthToken(null);
  localStorage.removeItem(LEGACY_TOKEN_KEY);
  publishSessionChange();
  // Serializar también logout evita que un Set-Cookie anterior reabra la sesión.
  return withSessionLock(async () => {
    await fetch(`${API_BASE}${SESSION_PATH}/logout`, {
      method: 'POST',
      keepalive: true,
      signal: requestSignal(undefined, DEFAULT_TIMEOUT_MS),
    });
  }).catch(() => {});
}

/** Token con el que repetir una petición rechazada con 401, o null si no hay sesión. */
async function tokenAfter401(rejected: string | null, epoch: number): Promise<string | null> {
  if (!currentSession(epoch)) return null;
  const current = getAuthToken();
  // Otra petición ya lo renovó (o se cerró la sesión) mientras esta iba en camino.
  if (current !== rejected) return current;
  try {
    const token = await refreshSession();
    if (!token && currentSession(epoch)) window.dispatchEvent(new Event('auth-expired'));
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
  /** Cabeceras adicionales (p. ej. `Idempotency-Key`). */
  headers?: Record<string, string>;
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
  const headers: Record<string, string> = { ...options.headers };
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

export async function request<T>(
  path: string,
  options: RequestOptions = {},
  waitForSession = true,
): Promise<T> {
  const epoch = sessionEpoch;
  const ensureCurrentSession = () => {
    if (!currentSession(epoch))
      throw new ApiError(401, 'La sesión ha cambiado. Vuelve a intentarlo.');
  };
  if (waitForSession && restoring && sessionRestore) await sessionRestore;
  ensureCurrentSession();
  const sentToken = getAuthToken();
  let res = await send(path, options, sentToken);
  ensureCurrentSession();

  // Access token caducado: se renueva una vez y se repite la petición. En el login y en las rutas
  // de la cookie no, porque ahí un 401 (p. ej. una credencial de Google inválida) no es del token.
  if (
    res.status === 401 &&
    !path.startsWith('/auth/google/') &&
    !path.startsWith(`${SESSION_PATH}/`) &&
    (sentToken !== null || hasStoredSession())
  ) {
    const token = await tokenAfter401(sentToken, epoch);
    if (token && currentSession(epoch)) res = await send(path, options, token);
  }
  ensureCurrentSession();

  if (!res.ok) {
    const body = await res.json?.().catch(() => ({}));
    ensureCurrentSession();
    throw new ApiError(
      res.status,
      body?.error || body?.message || options.fallbackError || `Error del servidor (${res.status})`,
    );
  }
  const body = await res.json();
  ensureCurrentSession();
  return body;
}

export const query = (params: Record<string, string | number | null | undefined>): string => {
  const entries = Object.entries(params).filter(
    ([, v]) => v !== null && v !== undefined && v !== '',
  );
  if (entries.length === 0) return '';
  return '?' + entries.map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&');
};

export const imageForm = (blob: Blob): FormData => {
  const form = new FormData();
  form.append('file', blob, blob.type === 'image/png' ? 'image.png' : 'image.jpg');
  return form;
};

/** Inicia sesión con la credencial de Google y guarda el access token. */
export function loginWithGoogle(credential: string): Promise<LoginResponse> {
  return login('/auth/google/login', { credential }, 'Error al iniciar sesión con Google');
}

/** Reto para entrar con una llave de acceso: el dispositivo ofrecerá las que tenga guardadas. */
export function startPasskeyLogin(): Promise<{ requestId: string; options: BrowserOptions }> {
  return request(
    '/auth/passkeys/login/options',
    { method: 'POST', fallbackError: 'No se pudo preparar el acceso con llave' },
    false,
  );
}

/** Inicia sesión con la firma de una llave de acceso y guarda el access token. */
export function loginWithPasskey(requestId: string, credential: unknown): Promise<LoginResponse> {
  return login(
    '/auth/passkeys/login',
    { requestId, credential },
    'No se ha podido entrar con esta llave de acceso',
  );
}

async function login(path: string, json: unknown, fallbackError: string): Promise<LoginResponse> {
  const epoch = sessionEpoch;
  // La restauración necesita este mismo cerrojo: esperarla dentro lo bloquearía.
  if (restoring && sessionRestore) await sessionRestore;
  ensureSession(epoch);
  return withSessionLock(async () => {
    ensureSession(epoch);
    const data = await request<LoginResponse>(path, { method: 'POST', json, fallbackError }, false);
    ensureSession(epoch);
    setAuthToken(data.token);
    return data;
  });
}
