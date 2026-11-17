import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { demoResponse, installDemoBackend, shiftDates, type DemoData } from '../../demo/backend';

const fixture = (matchId: number, extra: object = {}) => ({
  matchId,
  locked: false,
  finished: false,
  predHomeScore: null,
  predAwayScore: null,
  predSign: null,
  predMethod: null,
  predRound: null,
  ...extra,
});

function sample(): DemoData {
  return {
    recordedAt: '2026-11-17T03:00:00.000Z',
    exact: {
      '/users/me': { userId: 7, participantName: 'Marta', lastSelectedGroupId: 1 },
      '/groups/6/members': [
        { userId: 7, participantName: 'Marta', avatarUrl: null },
        { userId: 8, participantName: 'Nico', avatarUrl: null },
      ],
      '/leaderboard?groupId=6': [{ userId: 7, points: 144 }],
      '/leaderboard/matchdays?groupId=6': [{ label: 'Jornada 1' }, { label: 'Jornada 2' }],
      '/predictions/matchday?groupId=6&round=Jornada%201': [fixture(10, { finished: true })],
      '/predictions/matchday?groupId=6&round=Jornada%202': [fixture(20), fixture(21)],
      '/predictions/matchday?groupId=6&round=current': [fixture(20), fixture(21)],
      '/predictions/matchday/matches/10/predictions?groupId=6': [
        { userId: 7, isCaller: true, sign: '1', hasPredicted: true },
      ],
    },
    voters: { '6': { '10': { matchId: 10, total: 2 }, '20': { matchId: 20, total: 1 } } },
    participants: { '6': { '10': [{ userId: 7 }, { userId: 8 }], '20': [{ userId: 8 }] } },
  };
}

const body = (response: Response) => response.json();

describe('servidor de la demo', () => {
  beforeEach(() => localStorage.setItem('activeGroupId', '6'));
  afterEach(() => localStorage.clear());

  it('devuelve lo grabado y avisa de lo que no existe', async () => {
    const data = sample();
    expect(await body(demoResponse(data, 'GET', '/leaderboard?groupId=6'))).toEqual([
      { userId: 7, points: 144 },
    ]);
    expect(demoResponse(data, 'GET', '/no-existe').status).toBe(404);
  });

  it('el perfil apunta a la liga activa', async () => {
    const me = await body(demoResponse(sample(), 'GET', '/users/me'));
    expect(me).toMatchObject({ participantName: 'Marta', lastSelectedGroupId: 6 });
  });

  it('sin jornada devuelve todas, en orden', async () => {
    const all = await body(demoResponse(sample(), 'GET', '/predictions/matchday?groupId=6'));
    expect(all.map((item: { matchId: number }) => item.matchId)).toEqual([10, 20, 21]);
    expect(await body(demoResponse(sample(), 'GET', '/predictions/matchday?groupId=1'))).toEqual(
      [],
    );
  });

  it('compone votos y participantes de los partidos pedidos', async () => {
    const data = sample();
    const votes = '/predictions/matchday/stats/voters?groupId=6&matchIds=10%2C20%2C99';
    expect(await body(demoResponse(data, 'GET', votes))).toHaveLength(2);
    const people = '/predictions/matchday/stats/participants?groupId=6&matchIds=10%2C20';
    expect(await body(demoResponse(data, 'GET', people))).toEqual([{ userId: 7 }, { userId: 8 }]);
    const none = '/predictions/matchday/stats/participants?groupId=1';
    expect(await body(demoResponse(data, 'GET', none))).toEqual([]);
  });

  it('guarda las predicciones de partidos abiertos y las enseña después', async () => {
    const data = sample();
    const sent = JSON.stringify({
      groupId: 6,
      predictions: [
        { matchId: 20, homeScore: 2, awayScore: 1, sign: '1' },
        { matchId: 10, homeScore: 0, awayScore: 0, sign: 'X' },
      ],
    });
    const saved = await body(demoResponse(data, 'POST', '/predictions/matchday', sent));
    expect(saved).toMatchObject({ success: true, saved: 1 });

    const round = '/predictions/matchday?groupId=6&round=Jornada%202';
    expect((await body(demoResponse(data, 'GET', round)))[0]).toMatchObject({
      predHomeScore: 2,
      predSign: '1',
    });

    const picks = await body(
      demoResponse(data, 'GET', '/predictions/matchday/matches/20/predictions?groupId=6'),
    );
    expect(picks).toHaveLength(2);
    expect(picks[0]).toMatchObject({ isCaller: true, hasPredicted: true, sign: '1' });
    expect(picks[1]).toMatchObject({ isCaller: false, hasPredicted: false });
  });

  it('los partidos ya jugados enseñan lo grabado', async () => {
    const picks = await body(
      demoResponse(sample(), 'GET', '/predictions/matchday/matches/10/predictions?groupId=6'),
    );
    expect(picks).toEqual([{ userId: 7, isCaller: true, sign: '1', hasPredicted: true }]);
  });

  it('acepta la sesión y los avisos automáticos, y rechaza el resto de cambios', async () => {
    const data = sample();
    expect(await body(demoResponse(data, 'POST', '/auth/session/refresh'))).toEqual({
      token: 'demo',
    });
    expect(demoResponse(data, 'PUT', '/users/me/preferences').status).toBe(200);
    const refused = demoResponse(data, 'DELETE', '/groups/6');
    expect(refused.status).toBe(403);
    expect((await body(refused)).error).toContain('demo');
  });
});

describe('fechas de la demo', () => {
  it('adelanta la temporada en curso y deja el Mundial donde está', () => {
    const shifted = shiftDates(
      {
        liga: '2026-11-20T21:00:00+01:00',
        utc: ['2026-11-30T23:30:00.000Z'],
        mundial: '2026-06-11T21:00:00+02:00',
        texto: 'Jornada 13',
        nada: null,
      },
      3,
    );
    expect(shifted).toEqual({
      liga: '2026-11-23T21:00:00+01:00',
      utc: ['2026-12-03T23:30:00Z'],
      mundial: '2026-06-11T21:00:00+02:00',
      texto: 'Jornada 13',
      nada: null,
    });
    expect(shiftDates('2026-11-20T21:00:00-03:00', 1)).toBe('2026-11-21T21:00:00-03:00');
    expect(shiftDates('2026-11-20T21:00:00+01:00', 0)).toBe('2026-11-20T21:00:00+01:00');
  });
});

describe('instalación del servidor de la demo', () => {
  const realFetch = window.fetch;

  afterEach(() => {
    window.fetch = realFetch;
    vi.useRealTimers();
  });

  it('atiende /api con los datos de ejemplo y deja pasar lo demás', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-19T12:00:00Z'));
    const network = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) === '/demo-data.json') {
        return new Response(
          JSON.stringify({ ...sample(), exact: { '/x': { date: '2026-11-20T21:00:00+01:00' } } }),
        );
      }
      return new Response('fuera');
    });
    window.fetch = network as typeof window.fetch;
    installDemoBackend();

    expect(await (await fetch('/api/x')).json()).toEqual({ date: '2026-11-22T21:00:00+01:00' });
    const post = await fetch(new Request(window.location.origin + '/api/groups'), {
      method: 'post',
    });
    expect(post.status).toBe(403);
    expect(network).toHaveBeenCalledTimes(1);

    expect(await (await fetch('https://example.com/api/x')).text()).toBe('fuera');
    expect(await (await fetch('/sw.js')).text()).toBe('fuera');
  });
});
