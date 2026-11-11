import { expect, test, type Page } from '@playwright/test';
import { withLeagueKind } from './leagueKind';

test.use({ serviceWorkers: 'block', reducedMotion: 'reduce' });

const league = withLeagueKind('matchday', {
  id: 1,
  name: 'Liga de prueba',
  adminUserId: 7,
  competitionId: 2,
  competitionName: 'LaLiga',
  formatType: 'LEAGUE',
  poolFormat: 'MATCH_DAY',
  pichichi: false,
  isLocked: false,
});

/** Sesión iniciada en una liga por jornadas, con la API simulada. */
async function signedIn(page: Page, extra: Record<string, unknown> = {}) {
  await page.addInitScript(() => {
    localStorage.setItem('has_session', '1');
    localStorage.setItem('my_prediction_name', 'Auditor');
    localStorage.setItem('userId', '7');
    localStorage.setItem('activeGroupId', '1');
    localStorage.setItem('activeCompetitionId', '2');
    // El aviso de la llave de acceso, ya contestado: no es de estas pruebas y tapa los botones.
    localStorage.setItem('passkey_prompt_answered:7', '1');
    localStorage.setItem('push_prompt_v2:7', String(Date.now()));
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
      '/api/push/config': {
        publicKey: 'clave-de-prueba',
        remindersEnabled: true,
        memberJoinedEnabled: true,
        matchdayFinishedEnabled: false,
      },
      '/api/matches/radar': { live: [], last: [], next: [] },
      ...extra,
    };
    return route.fulfill({ json: responses[url.pathname] ?? [] });
  });
}

test('en una jornada terminada el filtro cuenta los partidos que lista', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signedIn(page, {
    '/api/predictions/matchday': Array.from({ length: 9 }, (_, index) => ({
      matchId: index + 1,
      homeTeam: `Local ${index + 1}`,
      awayTeam: `Visitante ${index + 1}`,
      round: 'Jornada 1',
      matchDate: '2026-11-01T18:00:00Z',
      finished: true,
      locked: true,
      actualHomeScore: 2,
      actualAwayScore: 1,
      predSign: index % 2 ? '1' : null,
      pointsAwarded: index % 2 ? 3 : null,
      isCorrectSign: index % 2 ? true : null,
    })),
  });
  await page.goto('/jornadas');

  await expect(page.getByRole('tab', { name: 'Finalizados 9' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(page.getByText(/^Local \d$/)).toHaveCount(9);
  await expect(page.getByRole('tab', { name: /Todos/ })).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('jornada-terminada.png') });

  await page.getByRole('tab', { name: 'Por jugar 0' }).click();
  await expect(page.getByRole('tab', { name: 'Por jugar 0' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(page.getByText(/^Local \d$/)).toHaveCount(0);
  await expect(page.getByText('No queda nada por jugar.')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('por-jugar-vacio.png') });
});

for (const width of [390, 1440]) {
  test(`«Avisos» del menú de cuenta abre los ajustes en los avisos a ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 700 });
    await signedIn(page);
    await page.goto('/mis-ligas');

    await page.getByRole('button', { name: 'Menú de usuario' }).click();
    await expect(page.getByRole('button', { name: 'Ajustes de cuenta' })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`menu-de-cuenta-${width}.png`) });
    await page.getByRole('button', { name: 'Avisos', exact: true }).click();

    const dialog = page.getByRole('dialog', { name: 'Ajustes de cuenta' });
    const reminders = dialog.getByRole('region', { name: 'Avisos' });
    await expect(reminders).toBeFocused();
    await expect(reminders.getByRole('heading', { name: 'Avisos' })).toBeInViewport();
    await expect(
      reminders.getByRole('checkbox', { name: 'Recordarme las predicciones pendientes' }),
    ).toBeChecked();
    await expect(
      reminders.getByRole('checkbox', {
        name: 'Avisarme cuando termine una jornada, con el ranking',
      }),
    ).not.toBeChecked();
    await page.screenshot({ path: testInfo.outputPath(`avisos-${width}.png`) });
  });
}

test('recupera los avisos desde ajustes tras fallar el registro del dispositivo', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 700 });
  await page.addInitScript(() => {
    Object.defineProperty(Notification, 'permission', { get: () => 'granted' });
    const subscription = {
      endpoint: 'https://fcm.googleapis.com/fcm/send/test-device',
      options: {},
      toJSON: () => ({
        endpoint: 'https://fcm.googleapis.com/fcm/send/test-device',
        keys: { p256dh: 'test-key', auth: 'test-auth' },
      }),
    };
    Object.defineProperty(navigator.serviceWorker, 'ready', {
      value: Promise.resolve({
        pushManager: { getSubscription: () => Promise.resolve(subscription) },
      }),
    });
  });
  await signedIn(page);
  let registrations = 0;
  await page.route('**/api/push/subscriptions', (route) => {
    registrations++;
    return route.fulfill({
      status: registrations === 1 ? 503 : 200,
      json: registrations === 1 ? { message: 'Sin conexión' } : { success: true },
    });
  });
  await page.goto('/mis-ligas');
  await expect.poll(() => registrations).toBe(1);
  await page.getByRole('button', { name: 'Menú de usuario' }).click();
  await page.getByRole('button', { name: 'Avisos', exact: true }).click();
  const reminders = page.getByRole('region', { name: 'Avisos' });
  await reminders.getByRole('button', { name: 'Activar avisos en este dispositivo' }).click();
  await expect(reminders.getByRole('status')).toContainText('Dispositivo registrado');
  await expect.poll(() => registrations).toBe(2);
  let testedEndpoint: unknown;
  await page.route('**/api/push/test', (route) => {
    testedEndpoint = route.request().postDataJSON().endpoint;
    return route.fulfill({ json: { success: true } });
  });
  await reminders.getByRole('button', { name: 'Probar notificaciones' }).click();
  await expect(reminders.getByRole('status')).toContainText('Prueba aceptada');
  expect(testedEndpoint).toBe('https://fcm.googleapis.com/fcm/send/test-device');
  await expect(
    reminders.getByRole('checkbox', { name: 'Avisarme cuando alguien se una a mis ligas' }),
  ).toBeChecked();
  await expect(
    reminders.getByRole('checkbox', {
      name: 'Avisarme cuando termine una jornada, con el ranking',
    }),
  ).not.toBeChecked();
  await page.screenshot({ path: testInfo.outputPath('avisos-recuperados.png') });
});

test('el asistente enseña a una competición propia de LoL sus reglas, no las series oficiales', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signedIn(page, {
    '/api/competitions': [
      { id: 2, name: 'LaLiga', externalId: 'esp.1', formatType: 'LEAGUE', sport: 'FOOTBALL' },
      {
        id: 3,
        name: 'LEC',
        externalId: 'lol.lec',
        formatType: 'LEAGUE',
        sport: 'LEAGUE_OF_LEGENDS',
      },
    ],
    '/api/competitions/3/selectable-matches': {
      mode: 'ALL',
      competitionIds: [3],
      competitions: [],
      teamIds: [],
      includedMatchIds: [],
      excludedMatchIds: [],
      teams: [],
      matches: [],
      removedPredictions: 0,
    },
  });
  await page.goto('/crear-liga');
  const next = () => page.getByRole('button', { name: 'Siguiente' }).click();

  await page.getByRole('radio', { name: 'League of Legends' }).check();
  await next();
  await page.getByRole('radio', { name: 'Competición personalizada' }).check();
  await page.getByLabel('Nombre de la competición').fill('Liga del barrio');
  await next();

  const matchday = page.getByRole('radio', { name: 'Por jornadas' });
  await expect(matchday).toHaveAccessibleDescription(
    'Predices quién gana cada partido, jornada a jornada.',
  );
  await matchday.check();
  await page.screenshot({ path: testInfo.outputPath('lol-propia-modo.png'), fullPage: true });
  await next();

  await expect(page.getByRole('heading', { level: 4, name: 'Cada partido' })).toBeVisible();
  await expect(page.getByText('Aciertas quién gana el partido.')).toBeVisible();
  await expect(page.getByText(/serie|1X2|goles|NFL/i)).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('lol-propia-reglas.png'), fullPage: true });

  // La liga oficial de LoL sí se explica con sus series.
  await page.getByRole('button', { name: 'Atrás' }).click();
  await page.getByRole('button', { name: 'Atrás' }).click();
  await page.getByRole('radio', { name: 'LEC' }).check();
  await next();
  await page.getByRole('radio', { name: 'Por jornadas' }).check();
  await next();
  await expect(page.getByRole('heading', { level: 4, name: 'Cada serie' })).toBeVisible();
  await expect(page.getByText('Resultado de la serie')).toBeVisible();
});
