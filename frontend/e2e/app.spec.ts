import { expect, test } from '@playwright/test';
import type { Group } from '../src/types/api';
import { withLeagueKind } from './leagueKind';

const demoLeague: Group = withLeagueKind('worldCup', {
  id: 1,
  name: 'Porra Global',
  joinCode: null,
  adminParticipantName: null,
  adminUserId: null,
  createdAt: null,
  competitionId: 2,
  competitionName: 'FIFA World Cup 2026',
  competitionExternalId: 'fifa.world',
  formatType: 'TOURNAMENT',
  poolFormat: 'FULL_BRACKET',
  pichichi: true,
  lockDate: null,
  isLocked: false,
  rules: null,
  imageUrl: null,
});

for (const viewport of [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
]) {
  test.describe(viewport.name, () => {
    test.use({ viewport, serviceWorkers: 'block' });

    test.beforeEach(async ({ page }) => {
      // These UI smoke tests use local fixtures; OAuth and public sports feeds are not exercised.
      await page.route('**/*', async (route) => {
        const url = new URL(route.request().url());
        if (url.origin !== 'http://127.0.0.1:4173') return route.abort();
        if (!url.pathname.startsWith('/api/')) return route.continue();

        const responses: Record<string, unknown> = {
          '/api/groups/1': demoLeague,
          '/api/groups/featured': demoLeague,
          '/api/world-cup/standings': {},
          '/api/world-cup/official-bracket': {},
          '/api/world-cup/group-odds': {},
          '/api/matches/radar': { live: [], last: [], next: [] },
          '/api/auth/session/logout': { status: 'success' },
        };
        return route.fulfill({ json: responses[url.pathname] ?? [] });
      });
    });

    test('opens login from the landing page and closes it with Escape', async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.goto('/');
      await expect(page.getByRole('heading', { level: 1 })).toContainText(
        'La porra de toda la vida',
      );

      await page.getByRole('button', { name: 'Crear mi liga gratis', exact: true }).first().click();
      const dialog = page.getByRole('dialog', { name: 'Iniciar sesión' });
      await expect(dialog).toBeVisible();
      const panel = dialog.locator('.modal-content');
      expect(
        await panel.evaluate((element) => {
          const style = getComputedStyle(element);
          return { x: style.overflowX, y: style.overflowY };
        }),
      ).toEqual({ x: 'visible', y: 'visible' });
      await page.setViewportSize({ width: viewport.width, height: 240 });
      const back = dialog.getByRole('button', { name: 'Volver al inicio' });
      await back.scrollIntoViewIfNeeded();
      await expect(back).toBeInViewport();

      await page.keyboard.press('Escape');
      await expect(dialog).toBeHidden();
      expect(errors).toEqual([]);
    });

    test('opens the public demo and returns to the landing page', async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.goto('/');
      await page
        .getByRole('link', { name: 'Ver una porra de ejemplo', exact: true })
        .first()
        .click();
      await expect(page).toHaveURL('/demo');
      await expect(page.getByText('Modo demo:', { exact: true })).toBeVisible();
      await expect(
        page.getByRole('button', { name: 'Guardar predicción', exact: true }),
      ).toHaveCount(0);

      await page.getByRole('button', { name: 'Salir', exact: true }).click();
      await expect(page).toHaveURL('/');
      await expect(page.getByText('Modo demo:', { exact: true })).toHaveCount(0);
      await expect(page.getByRole('heading', { level: 1 })).toContainText(
        'La porra de toda la vida',
      );
      expect(errors).toEqual([]);
    });

    test('shows the plain landing to a visitor who left the demo without exiting', async ({
      page,
    }) => {
      await page.goto('/demo');
      await expect(page.getByText('Modo demo:', { exact: true })).toBeVisible();

      await page.goto('/');
      await expect(page.getByRole('heading', { level: 1 })).toContainText(
        'La porra de toda la vida',
      );
      await expect(page.getByText('Modo demo:', { exact: true })).toHaveCount(0);
      await expect(page.getByRole('link', { name: 'Resultados' })).toHaveCount(0);
    });
  });
}
