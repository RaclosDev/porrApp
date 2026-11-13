import { expect, test } from '@playwright/test';
import { withLeagueKind } from './leagueKind';

test.use({ serviceWorkers: 'block', reducedMotion: 'reduce' });

const ORIGIN = 'http://127.0.0.1:4173';

const pool = withLeagueKind('matchday', {
  id: 1,
  name: 'Los del barrio',
  joinCode: 'BARRIO',
  adminUserId: 7,
  adminParticipantName: 'Auditor',
  competitionId: 40,
  competitionName: 'LaLiga',
  formatType: 'LEAGUE',
  poolFormat: 'MATCH_DAY',
  pichichi: false,
  isLocked: false,
});

/** Una liga de juegos de mesa tal como la manda `/api/groups/mine`: sin competición. */
const scoreboardLeague = {
  id: 9,
  name: 'Mus de los jueves',
  kind: 'SCOREBOARD',
  joinCode: 'MUS123',
  adminUserId: 7,
  adminParticipantName: 'Auditor',
  competitionId: null,
  competitionName: null,
  formatType: null,
  poolFormat: 'MATCH_DAY',
  pichichi: false,
  isLocked: false,
};

const scoreboard = {
  id: 9,
  name: 'Mus de los jueves',
  unit: 'puntos',
  lowerWins: false,
  owner: true,
  joinCode: 'MUS123',
  myPlayerId: null,
  claimedPlayerIds: [],
  currentSessionId: null,
  players: [],
  sessions: [],
  rounds: [],
  overall: [],
};

for (const width of [390, 1440]) {
  test(`una liga de juegos de mesa es una liga más y su inicio es el marcador a ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    // El dispositivo y el servidor recuerdan la liga de juegos de mesa como la última abierta.
    await page.addInitScript(() => {
      localStorage.setItem('has_session', '1');
      localStorage.setItem('my_prediction_name', 'Auditor');
      localStorage.setItem('userId', '7');
      localStorage.setItem('activeGroupId', '9');
      localStorage.setItem('passkey_prompt_answered:7', '1');
    });
    const requested: string[] = [];
    await page.route('**/*', (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.origin !== ORIGIN) return route.abort();
      if (!url.pathname.startsWith('/api/')) return route.continue();
      requested.push(`${url.pathname}${url.search}`);
      const responses: Record<string, unknown> = {
        '/api/auth/session/refresh': { token: 'local-fixture' },
        '/api/users/me': {
          userId: 7,
          participantName: 'Auditor',
          profileSetupCompleted: true,
          lastSelectedGroupId: 9,
          avatarUrl: null,
        },
        '/api/groups/1': pool,
        '/api/groups/9': scoreboardLeague,
        '/api/groups/mine': [pool, scoreboardLeague],
        '/api/trackers': [
          { id: 9, name: 'Mus de los jueves', owner: true, players: 4, rounds: 12 },
        ],
        '/api/trackers/9': scoreboard,
        '/api/matches/radar': { live: [], last: [], next: [] },
      };
      return route.fulfill({ json: responses[url.pathname] ?? [] });
    });

    await page.goto('/');

    // Sigue siendo la liga activa y su inicio es el marcador.
    const selector = page.locator('#btn-active-league-dropdown');
    await expect(selector).toContainText('Mus de los jueves');
    await expect(page.getByRole('heading', { name: 'Mus de los jueves' })).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('activeGroupId'))).toBe('9');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );

    // El menú de ligas abierto cabe entero en la pantalla.
    await selector.click();
    const menu = page.locator('.active-league-menu');
    await expect(menu).toBeVisible();
    const box = await menu.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { left: r.left, right: r.right, bottom: r.bottom, vw: innerWidth, vh: innerHeight };
    });
    expect(box.left).toBeGreaterThanOrEqual(0);
    expect(box.right).toBeLessThanOrEqual(box.vw);
    expect(box.bottom).toBeLessThanOrEqual(box.vh);
    await selector.click();
    await expect(menu).toBeHidden();

    // En Mis ligas sale una sola vez, con su tarjeta de juego de mesa.
    await page.goto('/mis-ligas');
    const card = page.getByRole('link', { name: 'Abrir el marcador Mus de los jueves' });
    await expect(card).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'Abrir Los del barrio' })).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'Abrir Mus de los jueves' })).toHaveCount(0);

    // Se cambia a la porra y se vuelve al marcador desde su tarjeta.
    await page.getByRole('button', { name: 'Abrir Los del barrio' }).click();
    await expect(selector).toContainText('Los del barrio');
    await page.goto('/mis-ligas');
    await card.click();
    await expect(page).toHaveURL(new RegExp(`^${ORIGIN}/$`));
    await expect(selector).toContainText('Mus de los jueves');
    await expect(page.getByRole('heading', { name: 'Mus de los jueves' })).toBeVisible();

    // Los enlaces antiguos de los marcadores: el de una liga va a Mis ligas y el QR, a la invitación.
    await page.goto('/marcador/4');
    await expect(page).toHaveURL(`${ORIGIN}/mis-ligas`);
    await page.goto('/marcador/unirse/MUS123');
    await expect(page).toHaveURL(`${ORIGIN}/join/MUS123`);

    // Nada pide predicciones ni ranking de una liga que no tiene competición.
    expect(requested.filter((path) => /groupId=9\b/.test(path))).toEqual([]);
  });
}
