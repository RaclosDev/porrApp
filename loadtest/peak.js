// Prueba de carga de un pico de jornada con k6 (https://k6.io). No forma parte del build ni de CI.
//
// Lánzala contra staging, nunca contra producción:
//   k6 run -e BASE_URL=https://staging.example.com -e GROUP_ID=1 -e TOKENS=tok1,tok2,... loadtest/peak.js
//
// TOKENS son tokens de acceso de usuarios de prueba que pertenecen a la liga GROUP_ID.
// MATCH_IDS (opcional) son partidos aún abiertos de esa liga para guardar predicciones.
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL;
const GROUP_ID = __ENV.GROUP_ID;
const TOKENS = (__ENV.TOKENS || '').split(',').filter(Boolean);
const MATCH_IDS = (__ENV.MATCH_IDS || '').split(',').filter(Boolean).map(Number);

if (!BASE_URL || !GROUP_ID || TOKENS.length === 0) {
  throw new Error('Faltan BASE_URL, GROUP_ID o TOKENS');
}

export const options = {
  scenarios: {
    pico: {
      executor: 'ramping-vus',
      stages: [
        { duration: '1m', target: 300 },
        { duration: '3m', target: 500 },
        { duration: '1m', target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
  },
};

function headers() {
  const token = TOKENS[(__VU - 1) % TOKENS.length];
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

export default function () {
  // 70 % consulta la clasificación; 30 % guarda sus predicciones de la jornada.
  if (MATCH_IDS.length === 0 || Math.random() < 0.7) {
    const res = http.get(`${BASE_URL}/api/leaderboard?groupId=${GROUP_ID}`, {
      headers: headers(),
      tags: { name: 'clasificacion' },
    });
    check(res, { 'clasificación 200': (r) => r.status === 200 });
  } else {
    const predictions = MATCH_IDS.map((matchId) => ({
      matchId,
      homeScore: Math.floor(Math.random() * 4),
      awayScore: Math.floor(Math.random() * 4),
    }));
    const res = http.post(
      `${BASE_URL}/api/predictions/matchday`,
      JSON.stringify({ groupId: Number(GROUP_ID), predictions }),
      { headers: headers(), tags: { name: 'guardar_jornada' } },
    );
    check(res, { 'jornada guardada': (r) => r.status === 200 });
  }
  sleep(1 + Math.random() * 2);
}
