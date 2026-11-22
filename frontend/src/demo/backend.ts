/**
 * Servidor de la demo: responde a las peticiones de /api con los datos de ejemplo de
 * /demo-data.json. Las predicciones de jornada se guardan en memoria; el resto de cambios se rechaza.
 */

import { withAvatars } from './avatars';

interface DemoFixture {
  matchId: number;
  locked: boolean;
  finished: boolean;
  predHomeScore: number | null;
  predAwayScore: number | null;
  predSign: string | null;
  predMethod: string | null;
  predRound: number | null;
}

interface DemoPick {
  matchId: number;
  homeScore: number | null;
  awayScore: number | null;
  sign: string | null;
  method?: string | null;
  round?: number | null;
}

interface DemoVoter {
  userId: number;
}

/** Lo que ha puesto cada participante en un partido; lo ajeno va oculto hasta que empieza. */
interface DemoMatchPick {
  userId: number;
  participantName: string;
  avatarUrl: string | null;
  homeScore: number | null;
  awayScore: number | null;
  sign: string | null;
  method: string | null;
  round: number | null;
  pointsAwarded: number | null;
  isExactScore: boolean | null;
  isCorrectSign: boolean | null;
  scoringDetails: string | null;
  updatedAt: string | null;
  isCaller: boolean;
  hasPredicted: boolean;
}

export interface DemoData {
  recordedAt: string;
  exact: Record<string, unknown>;
  voters: Record<string, Record<string, unknown>>;
  participants: Record<string, Record<string, DemoVoter[]>>;
}

const DAY_MS = 24 * 3600 * 1000;
const ISO_DATE = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.\d+)?(Z|[+-]\d{2}:\d{2})$/;
/** El Mundial ya se jugó y conserva sus fechas; lo posterior acompaña al calendario. */
const SHIFT_FROM = Date.parse('2026-08-01T00:00:00Z');
const READ_ONLY = 'Estás en la demo: aquí no se guardan los cambios.';
/** Avisos al servidor que la aplicación manda sola: se aceptan sin hacer nada. */
const SILENT_WRITES = [
  '/auth/session/logout',
  '/push/device-state',
  '/push/receipts',
  '/client-errors',
  '/users/me/preferences',
];

function shiftDate(value: string, days: number): string {
  const match = ISO_DATE.exec(value);
  const time = Date.parse(value);
  if (!match || Number.isNaN(time) || time < SHIFT_FROM) return value;
  const zone = match[2];
  const offsetMinutes =
    zone === 'Z'
      ? 0
      : (zone.startsWith('-') ? -1 : 1) * (Number(zone.slice(1, 3)) * 60 + Number(zone.slice(4)));
  const local = new Date(time + days * DAY_MS + offsetMinutes * 60_000);
  return local.toISOString().slice(0, 19) + zone;
}

/** Mueve las fechas de la temporada en curso los días pasados desde que se prepararon los datos. */
export function shiftDates<T>(value: T, days: number): T {
  if (days === 0) return value;
  if (typeof value === 'string') return shiftDate(value, days) as T;
  if (Array.isArray(value)) return value.map((item) => shiftDates(item, days)) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, shiftDates(item, days)]),
    ) as T;
  }
  return value;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const fixturesKey = (groupId: string, round: string) =>
  `/predictions/matchday?groupId=${groupId}&round=${encodeURIComponent(round)}`;

/** Todas las jornadas de una liga, que es lo que devuelve el servidor cuando no se pide ninguna. */
function allFixtures(data: DemoData, groupId: string): DemoFixture[] {
  const days = (data.exact[`/leaderboard/matchdays?groupId=${groupId}`] ?? []) as {
    label: string;
  }[];
  return days.flatMap(
    (day) => (data.exact[fixturesKey(groupId, day.label)] ?? []) as DemoFixture[],
  );
}

function savePicks(data: DemoData, groupId: string, picks: DemoPick[]): number {
  const byMatch = new Map(picks.map((pick) => [pick.matchId, pick]));
  const current = (data.exact[fixturesKey(groupId, 'current')] ?? []) as DemoFixture[];
  let saved = 0;
  for (const fixture of [...allFixtures(data, groupId), ...current]) {
    const pick = byMatch.get(fixture.matchId);
    if (!pick || fixture.locked || fixture.finished) continue;
    fixture.predHomeScore = pick.homeScore;
    fixture.predAwayScore = pick.awayScore;
    fixture.predSign = pick.sign;
    fixture.predMethod = pick.method ?? null;
    fixture.predRound = pick.round ?? null;
    byMatch.delete(fixture.matchId);
    saved++;
  }
  return saved;
}

/** Quién ha predicho un partido: lo grabado o, si nadie lo ha hecho aún, todos pendientes. */
function matchPicks(
  data: DemoData,
  groupId: string,
  matchId: number,
  key: string,
): DemoMatchPick[] {
  const me = (data.exact['/users/me'] as { userId: number }).userId;
  const members = (data.exact[`/groups/${groupId}/members`] ?? []) as DemoMatchPick[];
  const rows =
    (data.exact[key] as DemoMatchPick[] | undefined) ??
    members.map((member) => ({
      userId: member.userId,
      participantName: member.participantName,
      avatarUrl: member.avatarUrl,
      homeScore: null,
      awayScore: null,
      sign: null,
      method: null,
      round: null,
      pointsAwarded: null,
      isExactScore: null,
      isCorrectSign: null,
      scoringDetails: 'Predicción pendiente',
      updatedAt: null,
      isCaller: member.userId === me,
      hasPredicted: false,
    }));
  const mine = allFixtures(data, groupId).find((fixture) => fixture.matchId === matchId);
  if (!mine || mine.locked || mine.finished) return rows;
  // Mientras el partido sigue abierto, la fila propia refleja lo último guardado en la demo.
  return rows.map((row) =>
    row.isCaller
      ? {
          ...row,
          homeScore: mine.predHomeScore,
          awayScore: mine.predAwayScore,
          sign: mine.predSign,
          method: mine.predMethod,
          round: mine.predRound,
          hasPredicted: mine.predSign !== null || mine.predHomeScore !== null,
          scoringDetails: null,
        }
      : row,
  );
}

/** Respuesta de la demo a una petición de /api (`path` va sin el prefijo /api). */
export function demoResponse(
  data: DemoData,
  method: string,
  path: string,
  body?: unknown,
): Response {
  const url = new URL(path, 'http://demo.local');
  const groupId = url.searchParams.get('groupId') ?? '';

  if (method !== 'GET') {
    if (url.pathname === '/auth/session/refresh') return json({ token: 'demo' });
    if (SILENT_WRITES.includes(url.pathname)) return json({});
    if (method === 'POST' && url.pathname === '/predictions/matchday') {
      const sent = JSON.parse(String(body)) as { groupId: number; predictions: DemoPick[] };
      const saved = savePicks(data, String(sent.groupId), sent.predictions);
      return json({ success: true, saved, message: 'Predicciones guardadas en la demo' });
    }
    return json({ error: READ_ONLY }, 403);
  }

  if (url.pathname.startsWith('/predictions/matchday/stats/')) {
    const ids = (url.searchParams.get('matchIds') ?? '').split(',');
    if (url.pathname.endsWith('/voters')) {
      return json(ids.map((id) => data.voters[groupId]?.[id]).filter(Boolean));
    }
    const people = new Map<number, DemoVoter>();
    ids.forEach((id) =>
      data.participants[groupId]?.[id]?.forEach((voter) => people.set(voter.userId, voter)),
    );
    return json([...people.values()]);
  }

  if (url.pathname === '/predictions/matchday' && !url.searchParams.get('round')) {
    return json(allFixtures(data, groupId));
  }

  const picksOf = /^\/predictions\/matchday\/matches\/(\d+)\/predictions$/.exec(url.pathname);
  if (picksOf) {
    return json(matchPicks(data, groupId, Number(picksOf[1]), url.pathname + url.search));
  }

  if (url.pathname === '/users/me') {
    const me = data.exact['/users/me'] as object;
    return json({ ...me, lastSelectedGroupId: Number(localStorage.getItem('activeGroupId')) });
  }

  const found = data.exact[url.pathname + url.search];
  return found === undefined ? json({ error: 'No disponible en la demo' }, 404) : json(found);
}

/** Atiende /api desde la demo; el resto de peticiones sigue saliendo a la red. */
export function installDemoBackend(): void {
  const realFetch = window.fetch.bind(window);
  let loading: Promise<DemoData> | null = null;
  const load = () => {
    loading ??= realFetch('/demo-data.json')
      .then((res) => {
        if (!res.ok) throw new Error(`demo-data.json: ${res.status}`);
        return res.json() as Promise<DemoData>;
      })
      .then((data) => {
        const days = Math.floor((Date.now() - Date.parse(data.recordedAt)) / DAY_MS);
        return { ...data, exact: withAvatars(shiftDates(data.exact, Math.max(0, days))) };
      })
      .catch((error: unknown) => {
        // Una descarga fallida no se recuerda: «Reintentar» vuelve a pedir los datos.
        loading = null;
        throw error;
      });
    return loading;
  };

  window.fetch = async (input, init) => {
    const target = input instanceof Request ? input.url : String(input);
    const url = new URL(target, window.location.origin);
    if (url.origin !== window.location.origin || !url.pathname.startsWith('/api/')) {
      return realFetch(input, init);
    }
    let data: DemoData;
    try {
      data = await load();
    } catch {
      return json({ error: 'No se han podido cargar los datos de la demo' }, 503);
    }
    return demoResponse(
      data,
      (init?.method ?? 'GET').toUpperCase(),
      url.pathname.slice('/api'.length) + url.search,
      init?.body,
    );
  };
}
