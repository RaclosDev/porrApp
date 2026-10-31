import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test.use({ serviceWorkers: 'block', reducedMotion: 'reduce' });

for (const width of [390, 1440]) {
  test(`ranking chart and image sharing are reachable at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.addInitScript(() => {
      localStorage.setItem('has_session', '1');
      localStorage.setItem('my_prediction_name', 'Auditor');
      localStorage.setItem('userId', '7');
      localStorage.setItem('activeGroupId', '1');
      localStorage.setItem('activeCompetitionId', '2');
      Object.defineProperty(navigator, 'canShare', { configurable: true, value: undefined });
    });
    const league = {
      id: 1,
      name: 'Liga de prueba',
      adminUserId: 7,
      competitionId: 2,
      competitionName: 'Mundial 2026',
      formatType: 'TOURNAMENT',
      poolFormat: 'FULL_BRACKET',
      pichichi: false,
      isLocked: false,
    };
    await page.route('**/*', (route) => {
      const url = new URL(route.request().url());
      if (url.origin !== 'http://127.0.0.1:4173') return route.abort();
      if (!url.pathname.startsWith('/api/')) return route.continue();
      const responses: Record<string, unknown> = {
        '/api/auth/session/refresh': { token: 'local-fixture' },
        '/api/users/me': {
          userId: 7,
          participantName: 'Auditor',
          profileSetupCompleted: true,
          lastSelectedGroupId: 1,
          avatarUrl: null,
        },
        '/api/groups/1': league,
        '/api/groups/mine': [league],
        '/api/groups/1/members': [
          { userId: 7, participantName: 'Auditor', paid: true },
          { userId: 8, participantName: 'Ana', paid: true },
        ],
        '/api/leaderboard': [
          {
            id: 1,
            userId: 7,
            name: 'Auditor',
            total: 30,
            r1: 10,
            r32: 10,
            r16: 5,
            qf: 5,
            sf: 0,
            finals: 0,
            scorer: 0,
            matchPoints: 0,
            pending: false,
            log: [],
          },
          {
            id: 2,
            userId: 8,
            name: 'Ana',
            total: 20,
            r1: 8,
            r32: 8,
            r16: 4,
            qf: 0,
            sf: 0,
            finals: 0,
            scorer: 0,
            matchPoints: 0,
            pending: false,
            log: [],
          },
        ],
        '/api/standings': {},
        '/api/standings/official-bracket': {},
        '/api/teams/odds': {},
        '/api/matches/radar': { live: [], last: [], next: [] },
      };
      return route.fulfill({ json: responses[url.pathname] ?? [] });
    });

    await page.goto('/ranking');
    const ranking = page.getByRole('tab', { name: 'Ranking', exact: true });
    const chart = page.getByRole('tab', { name: 'Gráfica', exact: true });
    const share = page.getByRole('button', { name: 'Compartir clasificación', exact: true });
    await expect(ranking).toBeVisible();
    await expect(chart).toBeVisible();
    await expect(share).toBeVisible();
    await expect(ranking).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('tabpanel', { name: 'Ranking', exact: true })).toContainText(
      'Auditor',
    );
    await page.screenshot({ path: testInfo.outputPath(`ranking-${width}.png`), fullPage: true });

    await chart.click();
    await expect(chart).toHaveAttribute('aria-selected', 'true');
    await expect(
      page.getByRole('heading', { name: 'Evolución de la clasificación' }),
    ).toBeVisible();
    await expect(
      page.getByRole('tabpanel', { name: 'Gráfica', exact: true }).locator('svg').first(),
    ).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: testInfo.outputPath(`chart-${width}.png`), fullPage: true });

    await ranking.click();
    await expect(ranking).toHaveAttribute('aria-selected', 'true');
    await ranking.press('ArrowRight');
    await expect(chart).toBeFocused();
    await expect(chart).toHaveAttribute('aria-selected', 'true');
    await chart.press('ArrowLeft');
    await expect(ranking).toBeFocused();
    await ranking.press('End');
    await expect(chart).toBeFocused();
    await chart.press('Home');
    await expect(ranking).toBeFocused();
    await expect(ranking).toHaveAttribute('aria-selected', 'true');

    const downloadPromise = page.waitForEvent('download');
    await share.click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.png$/);
    const imagePath = testInfo.outputPath(`shared-ranking-${width}.png`);
    await download.saveAs(imagePath);
    const png = await readFile(imagePath);
    expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
    expect(png.readUInt32BE(16)).toBeGreaterThan(0);
    expect(png.readUInt32BE(20)).toBeGreaterThan(0);
    expect(png.length).toBeGreaterThan(1000);
    await expect(share).toBeEnabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    expect(errors).toEqual([]);
  });
}
