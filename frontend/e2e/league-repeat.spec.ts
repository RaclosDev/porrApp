import { expect, test } from '@playwright/test';
import { withLeagueKind } from './leagueKind';

test.use({ serviceWorkers: 'block', reducedMotion: 'reduce' });

const ORIGIN = 'http://127.0.0.1:4173';

const league = (fields: Record<string, unknown>) =>
  withLeagueKind('matchday', {
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
    ...fields,
  });

for (const width of [390, 1440]) {
  test(`una liga terminada se repite para la temporada nueva a ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.addInitScript(() => {
      localStorage.setItem('has_session', '1');
      localStorage.setItem('my_prediction_name', 'Auditor');
      localStorage.setItem('userId', '7');
      localStorage.setItem('activeGroupId', '1');
      localStorage.setItem('passkey_prompt_answered:7', '1');
    });
    const ended = league({
      season: '2025/26',
      seasonEnded: true,
      canRepeat: true,
      nextSeason: '2026/27',
    });
    const repeated = league({ id: 2, joinCode: 'NUEVA2', competitionId: 41, season: '2026/27' });
    let done = false;
    const writes: string[] = [];
    await page.route('**/*', (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.origin !== ORIGIN) return route.abort();
      if (!url.pathname.startsWith('/api/')) return route.continue();
      if (request.method() === 'POST' && url.pathname === '/api/groups/1/repeat') {
        writes.push(url.pathname);
        done = true;
        return route.fulfill({ json: repeated });
      }
      const old = done ? { ...ended, canRepeat: false, nextLeagueId: 2 } : ended;
      const responses: Record<string, unknown> = {
        '/api/auth/session/refresh': { token: 'local-fixture' },
        '/api/users/me': {
          userId: 7,
          participantName: 'Auditor',
          profileSetupCompleted: true,
          lastSelectedGroupId: 1,
          avatarUrl: null,
        },
        '/api/groups/1': old,
        '/api/groups/2': repeated,
        '/api/groups/mine': done ? [old, repeated] : [old],
        '/api/matches/radar': { live: [], last: [], next: [] },
      };
      return route.fulfill({ json: responses[url.pathname] ?? [] });
    });

    await page.goto('/mis-ligas');
    await expect(page.getByText('Terminada')).toBeVisible();
    await expect(page.getByText(/Ya hay temporada 2026\/27/)).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );

    await page.getByRole('button', { name: 'Repetir liga' }).click();
    const dialog = page.getByRole('alertdialog').or(page.getByRole('dialog'));
    await expect(dialog).toContainText('con los mismos miembros y ajustes');
    await dialog.getByRole('button', { name: 'Repetir liga' }).click();

    await expect(
      page.getByRole('button', { name: 'Ir a la liga de la temporada nueva' }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Repetir liga' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Abrir Los del barrio' })).toHaveCount(2);
    expect(writes).toEqual(['/api/groups/1/repeat']);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}
