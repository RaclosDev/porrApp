import { expect, test } from '@playwright/test';

test.use({ serviceWorkers: 'block', reducedMotion: 'reduce' });

for (const width of [390, 1440]) {
  test(`team options remain readable on paper at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.addInitScript(() => {
      localStorage.setItem('has_session', '1');
      localStorage.setItem('my_prediction_name', 'Auditor');
      localStorage.setItem('activeGroupId', '1');
      localStorage.setItem('activeCompetitionId', '2');
    });
    const group = {
      id: 1,
      name: 'Liga local',
      adminUserId: 7,
      competitionId: 2,
      competitionName: 'Mundial',
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
        '/api/groups/1': group,
        '/api/groups/mine': [group],
        '/api/teams/odds': {
          A: ['Mexico', 'Sudafrica', 'Chequia', 'Corea del Sur'].map((name, index) => ({
            id: index + 1,
            name,
            groupName: 'A',
            odds: 1,
            probability: 25,
          })),
        },
        '/api/standings': {},
        '/api/standings/official-bracket': {},
        '/api/matches/radar': { live: [], last: [], next: [] },
      };
      return route.fulfill({ json: responses[url.pathname] ?? [] });
    });
    await page.goto('/prediction');
    const select = page.getByRole('combobox').first();
    await expect(select).toBeVisible();
    await select.click();
    const listbox = page.getByRole('listbox');
    await expect(listbox).toBeVisible();
    const contrast = await listbox.evaluate((element) => {
      const rgb = (value: string) => (value.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
      const luminance = (channels: number[]) =>
        channels
          .map((channel) => {
            const value = channel / 255;
            return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
          })
          .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
      const background = luminance(rgb(getComputedStyle(element).backgroundColor));
      const option = element.querySelector('[role="option"]:last-child');
      if (!option) throw new Error('Missing team option');
      const foreground = luminance(rgb(getComputedStyle(option).color));
      return (Math.max(background, foreground) + 0.05) / (Math.min(background, foreground) + 0.05);
    });
    expect(contrast).toBeGreaterThanOrEqual(4.5);
    await page.getByRole('option').filter({ hasText: 'Mexico' }).click();
    await expect(listbox).toHaveCount(0);
    await expect(select).toContainText('Mexico');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}
