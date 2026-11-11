import { expect, test, type Page } from '@playwright/test';
import type { Tracker } from '../src/services/endpoints/trackers';

test.use({ serviceWorkers: 'block', reducedMotion: 'reduce' });

async function mockLeague(page: Page, owner: boolean) {
  await page.addInitScript(() => {
    localStorage.setItem('has_session', '1');
    localStorage.setItem('my_prediction_name', 'Ana');
    localStorage.setItem('activeGroupId', '9');
    localStorage.setItem('passkey_prompt_answered:7', '1');
    localStorage.setItem('push_prompt_v2:7', String(Date.now()));
  });
  const tracker: Tracker = {
    id: 9,
    name: 'Jueves de juegos',
    unit: 'puntos',
    lowerWins: false,
    owner,
    joinCode: 'JUEVES',
    myPlayerId: owner ? 11 : null,
    claimedPlayerIds: [11],
    currentSessionId: null,
    currentDayId: null,
    players: [{ id: 11, name: 'Ana' }],
    games: [],
    days: [],
    sessions: [],
    rounds: [],
    overall: [],
  };
  const league = {
    id: 9,
    name: tracker.name,
    kind: 'SCOREBOARD',
    joinCode: 'JUEVES',
    adminUserId: owner ? 7 : 8,
    competitionId: null,
    poolFormat: 'MATCH_DAY',
  };
  const added: string[] = [];
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === '/api/trackers/9/players' && request.method() === 'POST') {
      const { name } = request.postDataJSON() as { name: string };
      added.push(name);
      tracker.players.push({ id: 12, name });
      return route.fulfill({ json: tracker });
    }
    const responses: Record<string, unknown> = {
      '/api/auth/session/refresh': { token: 'fixture' },
      '/api/users/me': {
        userId: 7,
        participantName: 'Ana',
        profileSetupCompleted: true,
        lastSelectedGroupId: 9,
      },
      '/api/groups/mine': [league],
      '/api/groups/9': league,
      '/api/trackers/9': tracker,
      '/api/trackers': [],
    };
    return route.fulfill({ json: responses[path] ?? [] });
  });
  return { tracker, added };
}

for (const width of [390, 1440]) {
  for (const owner of [true, false]) {
    test(`alta sin cuenta e invitación separadas: ${owner ? 'admin' : 'miembro'} a ${width}px`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize({ width, height: 900 });
      const { added } = await mockLeague(page, owner);
      await page.goto('/');
      await page.getByRole('button', { name: 'Añadir jugador', exact: true }).click();
      await page.getByLabel('Nombre del jugador', { exact: true }).fill(' Luis ');
      await page.getByRole('button', { name: 'Añadir', exact: true }).click();
      await expect(
        page.getByRole('status').filter({ hasText: 'Luis ya está en la liga.' }),
      ).toBeVisible();
      await expect(page.getByRole('list', { name: 'Jugadores', exact: true })).toContainText(
        'Luis',
      );
      expect(added).toEqual(['Luis']);
      await expect(page.getByLabel('Nombre del jugador', { exact: true })).toBeFocused();
      if (!owner) await expect(page.getByRole('button', { name: 'Editar a Luis' })).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await page.screenshot({ path: testInfo.outputPath('jugadores.png'), fullPage: true });
      await page.getByRole('button', { name: 'Cerrar formulario' }).click();
      await expect(page.getByRole('button', { name: 'Añadir jugador', exact: true })).toBeFocused();
      await page.getByRole('button', { name: 'Invitar con enlace' }).click();
      await expect(page.getByRole('button', { name: 'Copiar enlace' })).toBeVisible();
      await expect(page.getByLabel('Nombre del jugador', { exact: true })).toHaveCount(0);
    });
  }
}
