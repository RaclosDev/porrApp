/**
 * Servicio de API : Comunicación con el backend de Spring Boot
 * Centraliza todas las llamadas HTTP en un solo sitio.
 */
const API_BASE = '/api';

/**
 * Obtiene el token de autenticación (usuario o administrador) del localStorage o memoria.
 * @returns {string|null} Token JWT o null si no existe.
 */
export function getAuthToken() {
  return (
    localStorage.getItem('token') || localStorage.getItem('adminToken') || window.adminToken || null
  );
}

/** Alias de compatibilidad hacia atrás */
export const getAdminToken = getAuthToken;

/**
 * Guarda el token de autenticación en memoria y en localStorage.
 * @param {string|null} token - El token a guardar.
 */
export function setAuthToken(token) {
  window.adminToken = token;
  if (token) {
    localStorage.setItem('token', token);
    localStorage.setItem('adminToken', token);
  } else {
    localStorage.removeItem('token');
    localStorage.removeItem('adminToken');
  }
}

/** Alias de compatibilidad hacia atrás */
export const setAdminToken = setAuthToken;

async function fetchJson(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      ...(getAdminToken() ? { Authorization: `Bearer ${getAdminToken()}` } : {}),
    },
  });
  if (!res.ok) {
    throw new Error(`HTTP error! status: ${res.status}`);
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

export async function fetchMatchRadar() {
  return fetchJson(`${API_BASE}/matches/radar`);
}

export async function fetchOfficialBracket() {
  return fetchJson(`${API_BASE}/standings/official-bracket`);
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
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getAdminToken() || ''}`,
    },
    body: JSON.stringify(predictionData),
  });
  return res.json();
}
export const createBet = createPrediction;

export async function deletePrediction(key) {
  const token = getAdminToken();
  return fetch(`${API_BASE}/predictions/${key}`, {
    method: 'DELETE',
    headers: {
      ...(token && {
        Authorization: `Bearer ${token}`,
        'X-Admin-Token': token,
      }),
    },
  });
}
export const deleteBet = deletePrediction;

export async function updatePrediction(key, data) {
  const token = getAdminToken();
  return fetch(`${API_BASE}/predictions/${key}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...(token && {
        Authorization: `Bearer ${token}`,
        'X-Admin-Token': token,
      }),
    },
    body: JSON.stringify(data),
  });
}
export const updateBet = updatePrediction;

export async function acceptPrediction(key) {
  const token = getAdminToken();
  return fetch(`${API_BASE}/predictions/${key}/pay`, {
    method: 'PUT',
    headers: {
      ...(token && {
        Authorization: `Bearer ${token}`,
        'X-Admin-Token': token,
      }),
    },
  });
}
export const acceptBet = acceptPrediction;

export async function fetchTeamOdds() {
  return fetchJson(`${API_BASE}/teams/odds`);
}

// Removed sendPresenceHeartbeat since it's handled by WebSockets now

export async function fetchPresence() {
  return fetchJson(`${API_BASE}/presence`);
}

export async function fetchConnectionHistory() {
  return fetchJson(`${API_BASE}/presence/history`);
}

export async function deleteConnectionLog(id) {
  return fetch(`${API_BASE}/presence/history/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${getAdminToken() || ''}` },
  });
}

export async function fetchTopScorers() {
  return fetchJson(`${API_BASE}/scorers`);
}

export async function fetchLeaderboard(groupId = null) {
  const url = groupId ? `${API_BASE}/leaderboard?groupId=${groupId}` : `${API_BASE}/leaderboard`;
  return fetchJson(url);
}

// Groups API
export async function fetchMyGroups() {
  return fetchJson(`${API_BASE}/groups/mine`);
}

export async function fetchGroup(id) {
  return fetchJson(`${API_BASE}/groups/${id}`);
}

export async function leaveGroup(id) {
  const token = getAdminToken();
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
  const token = getAdminToken();
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
  const token = getAdminToken();
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

export async function fetchCompetitions() {
  return fetchJson(`${API_BASE}/competitions`);
}

export async function createGroup(name, competitionId, poolFormat, pichichi = true) {
  const res = await fetch(`${API_BASE}/groups`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getAdminToken() || ''}`,
    },
    body: JSON.stringify({ name, competitionId, poolFormat, betMode: poolFormat, pichichi }),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || 'Error al crear la liga');
  }
  return res.json();
}

export async function updateGroup(id, name) {
  const res = await fetch(`${API_BASE}/groups/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getAdminToken() || ''}`,
    },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || 'Error al actualizar la liga');
  }
  return res.json();
}

export async function deleteGroup(id) {
  const res = await fetch(`${API_BASE}/groups/${id}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${getAdminToken() || ''}`,
    },
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || 'Error al borrar la liga');
  }
  return res.json();
}

export async function joinGroup(joinCode) {
  const res = await fetch(`${API_BASE}/groups/join`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getAdminToken() || ''}`,
    },
    body: JSON.stringify({ joinCode }),
  });
  if (res.ok) return res.json();
  const error = await res.json().catch(() => ({}));
  throw new Error(error.error || 'Grupo no encontrado o código inválido');
}

export async function fetchClaimedNames() {
  const res = await fetch(`${API_BASE}/auth/google/claimed-names`);
  if (res.ok) return await res.json();
  return [];
}

export async function fetchRegisteredUsers() {
  return fetchJson(`${API_BASE}/admin/users`);
}

export async function fetchMe() {
  return fetchJson(`${API_BASE}/users/me`);
}

export async function updateUserPreferences(preferences) {
  const token = getAdminToken();
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

export async function fetchSyncStatus() {
  return fetchJson(`${API_BASE}/admin/sync/status`);
}

export async function triggerAdminSync(competitionId = null) {
  const token = getAdminToken();
  const query = competitionId ? `?competitionId=${competitionId}` : '';
  const res = await fetch(`${API_BASE}/admin/sync${query}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    },
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || 'Error al ejecutar sincronización');
  }
  return res.json();
}

export async function overrideMatchResult(matchId, homeScore, awayScore, status = 'FINISHED') {
  const token = getAdminToken();
  const res = await fetch(`${API_BASE}/admin/matches/${matchId}/manual-result`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: JSON.stringify({
      homeScore: Number(homeScore),
      awayScore: Number(awayScore),
      status,
    }),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || 'Error al actualizar resultado manual');
  }
  return res.json();
}

export async function importCompetitionData(competitionId) {
  const token = getAdminToken();
  const res = await fetch(`${API_BASE}/admin/competitions/${competitionId}/import-data`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    },
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || `Error al importar datos deportivos: ${res.status}`);
  }
  return await res.json();
}
