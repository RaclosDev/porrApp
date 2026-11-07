import { expect, test } from '@playwright/test';

test.use({ serviceWorkers: 'block', reducedMotion: 'reduce' });

const names = [
  'Giorgi - Winamax',
  'ASB',
  'Jaime López',
  'Jokin',
  'Neglaso',
  'Raclos',
  'Toto',
  'Vitty',
];
const voter = (index: number) => ({ userId: index + 7, name: names[index], avatarUrl: null });

test('a started match on the league home opens who picked each option, with filters', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem('has_session', '1');
    localStorage.setItem('my_prediction_name', 'Auditor');
    localStorage.setItem('userId', '7');
    localStorage.setItem('activeGroupId', '1');
    localStorage.setItem('activeCompetitionId', '2');
    // La oferta de llave de acceso ya contestada: sale por encima de todo y taparía la hoja.
    localStorage.setItem('passkey_prompt_answered:7', '1');
  });
  const league = {
    id: 1,
    name: 'Tebas League',
    adminUserId: 7,
    competitionId: 2,
    competitionName: 'LaLiga',
    formatType: 'LEAGUE',
    poolFormat: 'MATCH_DAY',
    pichichi: false,
    isLocked: false,
  };
  const day = (offset: number) => new Date(Date.now() + offset * 3_600_000).toISOString();
  const match = (id: number, home: string, away: string, date: string, finished: boolean) => ({
    id,
    home,
    away,
    date,
    finished,
    round: 'Jornada 12',
    status: finished ? 'FINISHED' : 'TIMED',
    home_score: finished ? 2 : null,
    away_score: finished ? 1 : null,
    homeScore: finished ? 2 : null,
    awayScore: finished ? 1 : null,
  });
  await page.route('**/*', (route) => {
    const url = new URL(route.request().url());
    if (['fonts.googleapis.com', 'fonts.gstatic.com'].includes(url.hostname))
      return route.continue();
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
      '/api/matches': [
        match(1, 'Deportivo', 'Osasuna', day(-3), true),
        match(2, 'Sevilla', 'Alavés', day(20), false),
      ],
      '/api/predictions/matchday/stats/voters': [
        {
          matchId: 1,
          home: [0, 1, 2, 3, 4].map(voter),
          draw: [voter(5)],
          away: [voter(6), voter(7)],
        },
      ],
      '/api/matches/radar': { live: [], last: [], next: [] },
    };
    return route.fulfill({ json: responses[url.pathname] ?? [] });
  });

  await page.goto('/');
  // En la zona de la fecha: en el centro están las caras del empate, que abren su propia lista.
  await page
    .getByRole('button', { name: 'Deportivo contra Osasuna, ver quién ha elegido cada opción' })
    .click({ position: { x: 24, y: 12 } });

  const sheet = page.getByRole('dialog', { name: 'Deportivo 2 - 1 Osasuna' });
  await expect(sheet.locator('.match-voters-score')).toHaveText('2 - 1');
  await expect(sheet.locator('.match-voters-status')).toHaveText('Final');
  await expect(sheet.getByRole('region', { name: '1 · Gana Deportivo' })).toContainText('5 · 63%');

  await sheet.getByRole('button', { name: 'Empate (1)' }).click();
  await expect(sheet.getByRole('region')).toHaveCount(1);
  await expect(sheet).toContainText('Raclos');

  await sheet.getByRole('button', { name: 'Todos (8)' }).click();
  await sheet.getByRole('searchbox', { name: 'Buscar participante' }).fill('lopez');
  await expect(sheet.getByRole('region')).toHaveCount(1);
  await expect(sheet).toContainText('Jaime López');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

  await sheet.getByRole('button', { name: 'Cerrar' }).click();
  await page
    .getByRole('button', { name: 'Sevilla contra Alavés, hacer tu predicción' })
    .click({ position: { x: 24, y: 12 } });
  await expect(page).toHaveURL(/\/jornadas/);
  expect(errors).toEqual([]);
});
