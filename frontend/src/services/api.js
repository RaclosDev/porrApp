/**
 * Servicio de API — Comunicación con el backend de Spring Boot
 * Centraliza todas las llamadas HTTP en un solo sitio.
 */
const API_BASE = '/api';

export function getAdminToken() {
  return localStorage.getItem('adminToken') || window.adminToken || null;
}

export function setAdminToken(token) {
  window.adminToken = token;
  if (token) {
    localStorage.setItem('adminToken', token);
  } else {
    localStorage.removeItem('adminToken');
  }
}

async function fetchJson(url, options = {}) {
  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        ...(getAdminToken() ? { 'Authorization': `Bearer ${getAdminToken()}` } : {})
      }
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    console.error(`Error fetching ${url}:`, e);
    return null;
  }
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

export async function fetchBets(groupId = null) {
  const url = groupId ? `${API_BASE}/bets?groupId=${groupId}` : `${API_BASE}/bets`;
  return fetchJson(url);
}

export async function fetchMyBets() {
  return fetchJson(`${API_BASE}/bets/mine`);
}

export async function createBet(participantName, hash, groupId = null) {
  const res = await fetch(`${API_BASE}/bets`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getAdminToken() || ''}`
    },
    body: JSON.stringify({ participantName, hash, groupId: groupId ? groupId.toString() : null }),
  });
  return res.json();
}

export async function deleteBet(key) {
  return fetch(`${API_BASE}/bets/${key}`, { method: 'DELETE' });
}

export async function updateBet(key, data) {
  return fetch(`${API_BASE}/bets/${key}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function acceptBet(key) {
  return fetch(`${API_BASE}/bets/${key}/pay`, { method: 'PUT' });
}

export async function fetchTeamOdds() {
  return fetchJson(`${API_BASE}/teams/odds`);
}

export async function fetchTiebreakers() {
  return fetchJson(`${API_BASE}/admin/tiebreakers`) || {};
}

export async function bumpTeam(teamName) {
  const res = await fetch(`${API_BASE}/admin/bump-up?teamName=${encodeURIComponent(teamName)}`, { 
    method: 'POST',
    headers: { 'Authorization': `Bearer ${getAdminToken() || ''}` }
  });
  return res.text();
}

export async function sendPresenceHeartbeat(name) {
  return fetch(`${API_BASE}/presence`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  }).catch(() => {});
}

export async function fetchPresence() {
  return fetchJson(`${API_BASE}/presence`);
}

export async function fetchConnectionHistory() {
  return fetchJson(`${API_BASE}/presence/history`);
}

export async function deleteConnectionLog(id) {
  return fetch(`${API_BASE}/presence/history/${id}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${getAdminToken() || ''}` }
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
    headers
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
      ...(token && { 'Authorization': `Bearer ${token}` })
    }
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
      ...(token && { 'Authorization': `Bearer ${token}` })
    }
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || 'Error al eliminar la apuesta');
  }
  return res.json();
}

export async function createGroup(name) {
  const res = await fetch(`${API_BASE}/groups`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getAdminToken() || ''}`
    },
    body: JSON.stringify({ name }),
  });
  return res.json();
}

export async function joinGroup(joinCode) {
  const res = await fetch(`${API_BASE}/groups/join`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getAdminToken() || ''}`
    },
    body: JSON.stringify({ joinCode }),
  });
  if (res.ok) return res.json();
  throw new Error('Grupo no encontrado o código inválido');
}

export async function fetchClaimedNames() {
  const res = await fetch(`${API_BASE}/auth/google/claimed-names`);
  if (res.ok) return await res.json();
  return [];
}

export async function fetchRegisteredUsers() {
  return fetchJson(`${API_BASE}/admin/users`);
}
