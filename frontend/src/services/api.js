/**
 * Servicio de API — Comunicación con el backend de Spring Boot
 * Centraliza todas las llamadas HTTP en un solo sitio.
 */
const API_BASE = '/api';

export function getAdminToken() {
  return window.adminToken || null;
}

export function setAdminToken(token) {
  window.adminToken = token;
}

async function fetchJson(url, options = {}) {
  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'X-Admin-Token': getAdminToken() || ''
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

export async function fetchBets() {
  return fetchJson(`${API_BASE}/bets`);
}

export async function createBet(participantName, hash) {
  const res = await fetch(`${API_BASE}/bets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ participantName, hash }),
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
    headers: { 'X-Admin-Token': getAdminToken() || '' }
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

export async function fetchTopScorers() {
  return fetchJson(`${API_BASE}/scorers`);
}
