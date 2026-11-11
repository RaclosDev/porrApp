import { expect, test } from '@playwright/test';
import type {
  Tracker,
  TrackerGameDraft,
  TrackerStanding,
} from '../src/services/endpoints/trackers';

test.use({ serviceWorkers: 'block', reducedMotion: 'reduce' });
const now = '2026-11-05T18:00:00Z';
const league = {
  id: 9,
  name: 'Gym',
  kind: 'SCOREBOARD',
  joinCode: 'GYM123',
  adminUserId: 7,
  competitionId: null,
  competitionName: null,
  formatType: null,
  poolFormat: 'MATCH_DAY',
};
const standing = (
  playerId: number,
  name: string,
  total: number,
  roundsWon: number,
  sessionsWon = 0,
  rank = 1,
): TrackerStanding => ({ playerId, name, total, roundsWon, sessionsWon, rank });

for (const width of [390, 1440]) {
  test(`un día con un juego libre por rondas y otro de ganador directo a ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.addInitScript(() => {
      localStorage.setItem('has_session', '1');
      localStorage.setItem('my_prediction_name', 'Ana');
      localStorage.setItem('userId', '7');
      localStorage.setItem('activeGroupId', '9');
      localStorage.setItem('passkey_prompt_answered:7', '1');
    });
    const state: Tracker = {
      id: 9,
      name: 'Gym',
      unit: 'puntos',
      lowerWins: false,
      owner: true,
      joinCode: 'GYM123',
      myPlayerId: 11,
      claimedPlayerIds: [11],
      currentSessionId: null,
      currentDayId: null,
      players: [
        { id: 11, name: 'Ana' },
        { id: 12, name: 'Berto' },
        { id: 13, name: 'Carla' },
      ],
      games: [],
      sessions: [],
      days: [],
      rounds: [],
      overall: [],
      byGame: [],
    };
    const createdGames: TrackerGameDraft[] = [];
    const requests: { path: string; body: unknown }[] = [];
    await page.route('**/*', async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (['fonts.googleapis.com', 'fonts.gstatic.com'].includes(url.hostname))
        return route.continue();
      if (url.origin !== 'http://127.0.0.1:4173') return route.abort();
      if (!url.pathname.startsWith('/api/')) return route.continue();
      const path = url.pathname;
      if (request.method() === 'POST' && path.startsWith('/api/trackers/9/')) {
        requests.push({ path, body: request.postData() ? request.postDataJSON() : null });
        if (path.endsWith('/days')) {
          const body: { playerIds: number[] } = request.postDataJSON();
          state.days = [
            { id: 1, startedAt: now, closedAt: null, playerIds: body.playerIds, sessionIds: [] },
          ];
          state.currentDayId = 1;
        } else if (path.endsWith('/games')) {
          const body: TrackerGameDraft = request.postDataJSON();
          createdGames.push(body);
          state.games?.push({ ...body, id: createdGames.length, sessions: 0, rounds: 0 });
        } else if (path.endsWith('/sessions')) {
          const body: { gameId: number; playerIds: number[] } = request.postDataJSON();
          const id = state.sessions.length + 1;
          state.sessions.push({
            id,
            number: id,
            gameId: body.gameId,
            dayId: 1,
            playerIds: body.playerIds,
            startedAt: now,
            endedAt: null,
            rounds: 0,
            standings: [],
            winners: [],
            plannedRounds: null,
          });
          state.currentSessionId = id;
          state.days?.[0].sessionIds.push(id);
          const game = state.games?.find((item) => item.id === body.gameId);
          if (game) game.sessions = 1;
        } else if (path.endsWith('/rounds')) {
          const session = state.sessions.at(-1)!;
          const count = ++session.rounds;
          const direct = session.gameId === 2;
          const ended = direct || count === 5;
          session.standings = direct
            ? [standing(12, 'Berto', 1, 1), standing(11, 'Ana', 0, 0, 0, 2)]
            : [standing(11, 'Ana', 10 * count, count), standing(12, 'Berto', count, 0, 0, 2)];
          session.winners = ended ? [direct ? 12 : 11] : [];
          session.endedAt = ended ? now : null;
          const body: { scores?: Record<string, number> } = request.postDataJSON();
          state.rounds.push({
            id: state.rounds.length + 1,
            sessionId: session.id,
            number: state.rounds.length + 1,
            createdAt: now,
            note: null,
            recordedBy: 'Ana',
            revision: 0,
            scores: body.scores ?? { 11: 0, 12: 1 },
          });
          const game = state.games?.find((item) => item.id === session.gameId);
          if (game) game.rounds = count;
          if (ended) {
            const rows = session.standings.map((row) => ({
              ...row,
              sessionsWon: row.rank === 1 ? 1 : 0,
              sessionsPlayed: 1,
            }));
            state.byGame?.push({ gameId: session.gameId!, standings: rows });
            state.overall = direct
              ? [standing(11, 'Ana', 50, 5, 1), standing(12, 'Berto', 6, 1, 1)]
              : rows;
          }
        } else if (path.endsWith('/close')) {
          if (state.days?.[0]) state.days[0].closedAt = now;
          state.currentDayId = null;
          state.currentSessionId = null;
        }
        return route.fulfill({ json: state });
      }
      const responses: Record<string, unknown> = {
        '/api/auth/session/refresh': { token: 'local-fixture' },
        '/api/users/me': {
          userId: 7,
          participantName: 'Ana',
          profileSetupCompleted: true,
          lastSelectedGroupId: 9,
        },
        '/api/groups/mine': [league],
        '/api/groups/9': league,
        '/api/trackers/9': state,
        '/api/trackers': [{ id: 9, name: 'Gym', owner: true, players: 3, rounds: 0 }],
      };
      return route.fulfill({ json: responses[path] ?? [] });
    });

    await page.goto('/partida');
    await page.getByRole('button', { name: 'Carla', exact: true }).click();
    await page.getByRole('button', { name: 'Empezar día de juego' }).click();
    await expect(page.getByRole('heading', { name: '¿A qué jugáis?' })).toBeVisible();
    expect(requests[0].body).toEqual({ playerIds: [11, 12] });
    await page.getByLabel('Nombre del juego').fill('Inventado del Gym');
    await page.getByRole('button', { name: 'Puntos por ronda', exact: true }).click();
    await page.getByLabel('Rondas que hay que ganar (opcional)').fill('5');
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({
      path: testInfo.outputPath('juego-libre.png'),
      fullPage: true,
      animations: 'disabled',
    });
    await page.getByRole('button', { name: 'Crear y jugar' }).click();
    await expect(page.getByText('Objetivo: ganar 5 rondas.', { exact: false })).toBeVisible();
    for (let round = 1; round <= 5; round++) {
      await page.getByLabel('Ana', { exact: true }).fill('10');
      await page.getByLabel('Berto', { exact: true }).fill('1');
      await page.getByRole('button', { name: 'Apuntar ronda', exact: true }).click();
      if (round < 5) await expect(page.getByLabel('Ana', { exact: true })).toHaveValue('');
    }
    await expect(page.getByRole('heading', { name: 'Partida terminada' })).toBeVisible();
    await expect(page.getByText('Gana Ana', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Otra partida' }).click();
    await page.getByRole('button', { name: 'Otro juego nuevo' }).click();
    await page.getByRole('button', { name: 'Polilla tramposa', exact: true }).click();
    await page.getByRole('button', { name: 'Crear y jugar' }).click();
    await page.getByRole('button', { name: 'Gana Berto', exact: true }).click();
    await page.getByRole('button', { name: 'Guardar resultado y terminar partida' }).click();
    await expect(page.getByText('Gana Berto', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Cerrar el día', exact: true }).click();
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: 'Cerrar el día', exact: true })
      .click();
    await expect(page.getByRole('heading', { name: '¿Quién ha venido hoy?' })).toBeVisible();

    expect(createdGames).toEqual([
      {
        name: 'Inventado del Gym',
        mode: 'ROUNDS',
        unit: 'puntos',
        lowerWins: false,
        targetWins: 5,
      },
      { name: 'Polilla tramposa', mode: 'DIRECT', unit: 'victorias', lowerWins: false },
    ]);
    expect(requests.filter((item) => item.path.endsWith('/rounds'))).toHaveLength(6);
    await page.goto('/historico');
    await expect(page.getByText('Vinieron Ana, Berto', { exact: true })).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Inventado del Gym · partida 1 Gana Ana' }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Polilla tramposa · partida 2 Gana Berto' }),
    ).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({
      path: testInfo.outputPath('historico.png'),
      fullPage: true,
      animations: 'disabled',
    });
    await page.getByRole('button', { name: 'Inventado del Gym · partida 1 Gana Ana' }).click();
    await expect(page.getByRole('row', { name: /Total puntos/ })).toContainText('50');
    await page.goto('/ranking');
    await page.getByRole('button', { name: 'Inventado del Gym', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Quien más lo gana' })).toContainText(
      'Ana (1)',
    );
    await page.getByRole('button', { name: 'Polilla tramposa', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Quien más lo gana' })).toContainText(
      'Berto (1)',
    );
    await page.screenshot({
      path: testInfo.outputPath('ranking.png'),
      fullPage: true,
      animations: 'disabled',
    });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.goto('/marcador/nuevo');
    await expect(page.getByRole('heading', { name: 'Marcadores de juegos' })).toBeVisible();
    await page.getByLabel('Nombre', { exact: true }).fill('Los del viernes');
    await expect(page.getByLabel('Nombre del juego')).toHaveCount(0);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({
      path: testInfo.outputPath('crear-grupo.png'),
      fullPage: true,
      animations: 'disabled',
    });
  });
}
