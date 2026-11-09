import { expect, test } from '@playwright/test';
import { withLeagueKind } from './leagueKind';

test.use({ serviceWorkers: 'block', reducedMotion: 'reduce' });

for (const viewport of [
  { width: 390, height: 844 },
  { width: 1440, height: 900 },
]) {
  test(`el ranking muestra el pronóstico custom a ${viewport.width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(viewport);
    await page.addInitScript(() => {
      localStorage.setItem('has_session', '1');
      localStorage.setItem('userId', '7');
      localStorage.setItem('activeGroupId', '1');
      localStorage.setItem('activeCompetitionId', '2');
      // La oferta de llave de acceso ya contestada: sale por encima de todo y taparía el botón.
      localStorage.setItem('passkey_prompt_answered:7', '1');
    });
    const league = withLeagueKind('customBracket', {
      id: 1,
      name: 'Liga de prueba',
      adminUserId: 7,
      competitionId: 2,
      competitionName: 'Torneo de barrio',
      customCompetition: true,
      formatType: 'TOURNAMENT',
      poolFormat: 'FULL_BRACKET',
      pichichi: false,
      isLocked: false,
    });
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
        '/api/leaderboard': [
          {
            id: 21,
            userId: 8,
            name: 'Ana',
            total: 28,
            pending: false,
            log: [],
          },
        ],
        '/api/predictions/21': {
          user: 'Ana',
          groups: { A: ['Rayo', 'Barrio', 'Sur', 'Norte'], B: ['Club', 'Peña'] },
          customRounds: [['Rayo', 'Club', 'Sur', 'Peña'], ['Rayo', null], ['Rayo']],
          champion: 'Rayo',
        },
        '/api/competitions/2/tournament/standings': {},
        '/api/competitions/2/tournament/official-bracket': {},
        '/api/competitions/2/tournament/group-odds': {},
        '/api/matches/radar': { live: [], last: [], next: [] },
      };
      return route.fulfill({ json: responses[url.pathname] ?? [] });
    });

    await page.goto('/ranking');
    await page.getByRole('button', { name: 'Ver porra' }).click();
    const dialog = page.getByRole('dialog', { name: 'Visor de porra' });
    await expect(dialog.getByRole('heading', { name: 'Porra de Ana' })).toBeVisible();
    await expect(dialog.getByText('Campeón elegido')).toBeVisible();
    await expect(dialog.getByRole('heading', { name: 'Grupo A' })).toBeVisible();
    await expect(dialog.getByRole('heading', { name: 'Semifinales' })).toBeVisible();
    await expect(dialog.getByText('Aún oculto')).toBeVisible();
    expect(
      await dialog.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return rect.width <= innerWidth && rect.height <= innerHeight;
      }),
    ).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`custom-viewer-${viewport.width}.png`) });
    await dialog.getByRole('button', { name: 'Cerrar' }).click();
    await expect(dialog).toHaveCount(0);
  });
}
