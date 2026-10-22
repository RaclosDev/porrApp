/**
 * Servicio de API : Comunicación con el backend de Spring Boot
 * Centraliza todas las llamadas HTTP en un solo sitio.
 */
const API_BASE = '/api';

/**
 * Obtiene el token de administrador (o de autenticación) del localStorage.
 * @returns {string|null} Token JWT o null si no existe.
 */
export function getAdminToken() {
  return (
    localStorage.getItem('adminToken') || window.adminToken || localStorage.getItem('token') || null
  );
}

/**
 * Guarda el token de administrador en memoria y en localStorage.
 * @param {string|null} token - El token a guardar.
 */
export function setAdminToken(token) {
  window.adminToken = token;
  if (token) {
    localStorage.setItem('adminToken', token);
  } else {
    localStorage.removeItem('adminToken');
  }
}

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

export async function fetchMatches() {
  return fetchJson(`${API_BASE}/matches`);
}

export async function fetchMatchRadar() {
  return fetchJson(`${API_BASE}/matches/radar`);
}

export async function fetchOfficialBracket() {
  return fetchJson(`${API_BASE}/standings/official-bracket`);
}

export async function fetchBets(groupId = null) {
  const url = groupId ? `${API_BASE}/bets?groupId=${groupId}` : `${API_BASE}/bets`;
  return fetchJson(url);
}

export async function fetchMyBets() {
  return fetchJson(`${API_BASE}/bets/mine`);
}

export async function createBet(betData, groupId = null) {
  const url = groupId ? `${API_BASE}/bets?groupId=${groupId}` : `${API_BASE}/bets`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getAdminToken() || ''}`,
    },
    body: JSON.stringify(betData),
  });
  return res.json();
}

export async function deleteBet(key) {
  return fetch(`${API_BASE}/bets/${key}`, { method: 'DELETE' });
}

export async function updateBet(key, data) {
  return fetch(`${API_BASE}/bets/${key}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getAdminToken() || ''}`,
    },
    body: JSON.stringify(data),
  });
}

export async function acceptBet(key) {
  return fetch(`${API_BASE}/bets/${key}/pay`, { method: 'PUT' });
}

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

export async function acceptGroupBet(groupId, betId) {
  const token = getAdminToken();
  const res = await fetch(`${API_BASE}/groups/${groupId}/bets/${betId}/accept`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    },
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || 'Error al aceptar la apuesta');
  }
  return res.json();
}

export async function deleteGroupBet(groupId, betId) {
  const token = getAdminToken();
  const res = await fetch(`${API_BASE}/groups/${groupId}/bets/${betId}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    },
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || 'Error al eliminar la apuesta');
  }
  return res.json();
}

export async function fetchCompetitions() {
  return fetchJson(`${API_BASE}/competitions`);
}

export async function createGroup(name, competitionId, betMode, pichichi = true) {
  const res = await fetch(`${API_BASE}/groups`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getAdminToken() || ''}`,
    },
    body: JSON.stringify({ name, competitionId, betMode, pichichi }),
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
