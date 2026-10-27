/**
 * Servicio de API: Comunicación con el backend de Spring Boot.
 * Centraliza todas las llamadas HTTP de la aplicación.
 */
const API_BASE = '/api';

/**
 * Obtiene el token JWT de autenticación del usuario desde localStorage.
 * @returns {string|null} Token JWT o null si no existe.
 */
export function getAuthToken() {
  return localStorage.getItem('token') || null;
}

/**
 * Guarda o elimina el token JWT de autenticación en localStorage.
 * @param {string|null} token - El token a guardar (o null para borrarlo).
 */
export function setAuthToken(token) {
  if (token) {
    localStorage.setItem('token', token);
  } else {
    localStorage.removeItem('token');
  }
}

async function fetchJson(url, options = {}) {
  const currentToken = getAuthToken();
  const res = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      ...(currentToken ? { Authorization: `Bearer ${currentToken}` } : {}),
    },
  });
  if (!res.ok) {
    if (res.status === 401 && currentToken && getAuthToken() === currentToken) {
      setAuthToken(null);
      localStorage.removeItem('token');
      localStorage.removeItem('my_prediction_name');
      localStorage.removeItem('my_bet_name');
      localStorage.removeItem('my_user_id');
      window.dispatchEvent(new Event('auth-expired'));
    }
    const error = await res.json?.().catch(() => ({}));
    throw new Error(error?.error || error?.message || `HTTP error! status: ${res.status}`);
  }
  return await res.json();
}

export async function fetchStandings() {
  return fetchJson(`${API_BASE}/standings`);
}

export async function fetchMatches(competitionId = null) {
  const url = competitionId
    ? `${API_BASE}/matches?competitionId=${competitionId}`
    : `${API_BASE}/matches`;
  return fetchJson(url);
}

export async function fetchMatchRadar(competitionId = null) {
  const url = competitionId
    ? `${API_BASE}/matches/radar?competitionId=${competitionId}`
    : `${API_BASE}/matches/radar`;
  return fetchJson(url);
}

const OFFICIAL_BRACKET_TTL = 60_000;
let officialBracketCache = null;
let officialBracketCachedAt = 0;
let officialBracketRequest = null;

/**
 * Devuelve el cuadro oficial reutilizando la última respuesta durante 60 s.
 * Evita repetir la petición cada vez que se abre una porra.
 *
 * @param {Object} [options]
 * @param {boolean} [options.force] - Ignora la caché y vuelve a pedir los datos.
 * @returns {Promise<Object>} Cuadro oficial de eliminatorias.
 */
export async function fetchOfficialBracket({ force = false } = {}) {
  const now = Date.now();
  if (!force && officialBracketCache && now - officialBracketCachedAt < OFFICIAL_BRACKET_TTL) {
    return officialBracketCache;
  }
  if (!force && officialBracketRequest) {
    return officialBracketRequest;
  }
  officialBracketRequest = fetchJson(`${API_BASE}/standings/official-bracket`)
    .then((data) => {
      officialBracketCache = data;
      officialBracketCachedAt = Date.now();
      return data;
    })
    .finally(() => {
      officialBracketRequest = null;
    });
  return officialBracketRequest;
}

const PREDICTION_SCORE_TTL = 60_000;
const predictionScoreCache = new Map();

/**
 * Desglose detallado de puntos de una porra. Se cachea 60 s porque el cálculo es costoso
 * y el visor puede abrirse varias veces seguidas.
 *
 * @param {string|number} id - ID de la porra.
 * @returns {Promise<Object|null>} Puntuación detallada o null.
 */
export async function fetchPredictionScore(id) {
  if (id == null) return null;
  const key = String(id);
  const cached = predictionScoreCache.get(key);
  if (cached && Date.now() - cached.at < PREDICTION_SCORE_TTL) {
    return cached.data;
  }
  const data = await fetchJson(`${API_BASE}/predictions/${key}/score`);
  if (predictionScoreCache.size > 100) predictionScoreCache.clear();
  predictionScoreCache.set(key, { data, at: Date.now() });
  return data;
}

export async function fetchPredictions(groupId = null) {
  const url = groupId ? `${API_BASE}/predictions?groupId=${groupId}` : `${API_BASE}/predictions`;
  return fetchJson(url);
}
export const fetchBets = fetchPredictions;

export async function fetchMyPredictions() {
  return fetchJson(`${API_BASE}/predictions/mine`);
}
export const fetchMyBets = fetchMyPredictions;

export async function createPrediction(predictionData, groupId = null) {
  const url = groupId ? `${API_BASE}/predictions?groupId=${groupId}` : `${API_BASE}/predictions`;
  const token = getAuthToken();
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(predictionData),
  });
  return res.json();
}
export const createBet = createPrediction;

export async function deletePrediction(key) {
  const token = getAuthToken();
  return fetch(`${API_BASE}/predictions/${key}`, {
    method: 'DELETE',
    headers: {
      ...(token && { Authorization: `Bearer ${token}` }),
    },
  });
}
export const deleteBet = deletePrediction;

export async function updatePrediction(key, data) {
  const token = getAuthToken();
  return fetch(`${API_BASE}/predictions/${key}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: JSON.stringify(data),
  });
}
export const updateBet = updatePrediction;

export async function acceptPrediction(key) {
  const token = getAuthToken();
  return fetch(`${API_BASE}/predictions/${key}/pay`, {
    method: 'PUT',
    headers: {
      ...(token && { Authorization: `Bearer ${token}` }),
    },
  });
}
export const acceptBet = acceptPrediction;

export async function fetchTeamOdds() {
  return fetchJson(`${API_BASE}/teams/odds`);
}

export async function fetchTopScorers() {
  // Evita que el panel Pichichi permanezca cargando indefinidamente si el backend no responde.
  return fetchJson(`${API_BASE}/scorers`, { signal: AbortSignal.timeout(12_000) });
}

export async function fetchLeaderboard(groupId = null) {
  const url = groupId ? `${API_BASE}/leaderboard?groupId=${groupId}` : `${API_BASE}/leaderboard`;
  return fetchJson(url);
}

export async function fetchCompetitionStandings(competitionId) {
  if (!competitionId) return [];
  return fetchJson(`${API_BASE}/competitions/${competitionId}/standings`);
}

// Groups API
export async function fetchMyGroups() {
  return fetchJson(`${API_BASE}/groups/mine`);
}

export async function fetchGroup(id) {
  return fetchJson(`${API_BASE}/groups/${id}`);
}

export async function leaveGroup(id) {
  const token = getAuthToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}/groups/${id}/leave`, {
    method: 'DELETE',
    headers,
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || 'Error al abandonar el grupo');
  }
  return res.json();
}

export async function acceptGroupPrediction(groupId, predictionId) {
  const token = getAuthToken();
  const res = await fetch(`${API_BASE}/groups/${groupId}/predictions/${predictionId}/accept`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    },
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || 'Error al confirmar la porra');
  }
  return res.json();
}
export const acceptGroupBet = acceptGroupPrediction;

export async function deleteGroupPrediction(groupId, predictionId) {
  const token = getAuthToken();
  const res = await fetch(`${API_BASE}/groups/${groupId}/predictions/${predictionId}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    },
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || 'Error al eliminar la porra');
  }
  return res.json();
}
export const deleteGroupBet = deleteGroupPrediction;

let cachedCompetitions = null;
export async function fetchCompetitions() {
  if (cachedCompetitions) return cachedCompetitions;
  const data = await fetchJson(`${API_BASE}/competitions`);
  cachedCompetitions = data;
  return data;
}

export async function createGroup(name, competitionId, poolFormat, pichichi = true) {
  const token = getAuthToken();
  const res = await fetch(`${API_BASE}/groups`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ name, competitionId, poolFormat, betMode: poolFormat, pichichi }),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || 'Error al crear la liga');
  }
  return res.json();
}

export async function updateGroup(id, name, rules) {
  const token = getAuthToken();
  const res = await fetch(`${API_BASE}/groups/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ name, rules }),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || 'Error al actualizar la liga');
  }
  return res.json();
}

export async function deleteGroup(id) {
  const token = getAuthToken();
  const res = await fetch(`${API_BASE}/groups/${id}`, {
    method: 'DELETE',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || 'Error al borrar la liga');
  }
  return res.json();
}

export async function joinGroup(joinCode) {
  const token = getAuthToken();
  const res = await fetch(`${API_BASE}/groups/join`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ joinCode }),
  });
  if (res.ok) return res.json();
  const error = await res.json().catch(() => ({}));
  throw new Error(error.error || 'Grupo no encontrado o código inválido');
}

export async function fetchMe() {
  return fetchJson(`${API_BASE}/users/me`);
}

export async function updateUserPreferences(preferences) {
  const token = getAuthToken();
  const res = await fetch(`${API_BASE}/users/me/preferences`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: JSON.stringify(preferences),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || 'Error al actualizar preferencias');
  }
  return res.json();
}

export async function fetchRules() {
  return fetchJson(`${API_BASE}/rules`);
}

export async function fetchRulePreview(predHome, predAway, actualHome, actualAway) {
  return fetchJson(
    `${API_BASE}/rules/preview?predHome=${predHome}&predAway=${predAway}&actualHome=${actualHome}&actualAway=${actualAway}`,
  );
}

export async function fetchMatchdayFixtures(groupId, round = '') {
  const query = round
    ? `groupId=${groupId}&round=${encodeURIComponent(round)}`
    : `groupId=${groupId}`;
  return fetchJson(`${API_BASE}/predictions/matchday?${query}`);
}

export async function submitMatchdayPredictions(groupId, predictions) {
  const token = getAuthToken();
  const res = await fetch(`${API_BASE}/predictions/matchday`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: JSON.stringify({ groupId: Number(groupId), predictions }),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || 'Error al guardar pronósticos de jornada');
  }
  return res.json();
}

export async function fetchMatchdayFriendBets(groupId, matchId) {
  const token = getAuthToken();
  return fetchJson(`${API_BASE}/predictions/matchday/matches/${matchId}/bets?groupId=${groupId}`, {
    headers: {
      ...(token && { Authorization: `Bearer ${token}` }),
    },
  });
}

export async function fetchGroupMembers(groupId) {
  const token = getAuthToken();
  return fetchJson(`${API_BASE}/groups/${groupId}/members`, {
    headers: {
      ...(token && { Authorization: `Bearer ${token}` }),
    },
  });
}

export async function toggleGroupMemberPayment(groupId, userId, status) {
  const token = getAuthToken();
  const res = await fetch(`${API_BASE}/groups/${groupId}/members/${userId}/payment`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || 'Error al actualizar estado de pago');
  }
  return res.json();
}

export async function kickGroupMember(groupId, userId) {
  const token = getAuthToken();
  const res = await fetch(`${API_BASE}/groups/${groupId}/members/${userId}`, {
    method: 'DELETE',
    headers: {
      ...(token && { Authorization: `Bearer ${token}` }),
    },
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || 'Error al expulsar al miembro');
  }
  return res.json();
}

export async function regenerateGroupJoinCode(groupId) {
  const token = getAuthToken();
  const res = await fetch(`${API_BASE}/groups/${groupId}/regenerate-code`, {
    method: 'POST',
    headers: {
      ...(token && { Authorization: `Bearer ${token}` }),
    },
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || 'Error al regenerar código');
  }
  return res.json();
}

export async function fetchMissingRoundUsers(groupId, round = '') {
  const token = getAuthToken();
  const query = round ? `?round=${encodeURIComponent(round)}` : '';
  return fetchJson(`${API_BASE}/groups/${groupId}/missing-users${query}`, {
    headers: {
      ...(token && { Authorization: `Bearer ${token}` }),
    },
  });
}
