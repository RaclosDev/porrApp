import { expect, test, type Page } from '@playwright/test';

test.use({ serviceWorkers: 'block', reducedMotion: 'reduce' });

const day = (offset: number) =>
  new Date(Date.UTC(2026, 10, 20) - offset * 86_400_000).toISOString().slice(0, 10);

const overview = {
  generatedAt: '2026-11-20T10:00:00Z',
  totals: {
    users: 1284,
    newUsers24h: 12,
    newUsers7d: 61,
    newUsers30d: 240,
    active24h: 318,
    active7d: 702,
    leagues: 156,
    publicLeagues: 14,
    newLeagues7d: 9,
    memberships: 2210,
    leaguesByKind: { POOL: 120, SCOREBOARD: 21, TOURNAMENT: 9, POKER: 6 },
  },
  signupsByDay: Array.from({ length: 30 }, (_, index) => ({
    day: day(29 - index),
    count: [3, 5, 2, 8, 6, 4, 9, 12, 7, 5][index % 10],
  })),
  recentUsers: [
    ['Marta Gómez', 'marta.gomez@example.com', 'google'],
    ['Luis Pérez', 'luis@example.com', 'email'],
    ['Ana Belén Rodríguez Santamaría', 'ana.belen.rodriguez.santamaria@example.com', 'apple'],
    ['Jorge', 'jorge@example.com', 'google'],
  ].map(([name, email, method], index) => ({
    id: index + 1,
    name,
    email,
    method,
    joinedAt: `2026-11-${20 - index}T08:30:00Z`,
    lastActiveAt: '2026-11-20T09:15:00Z',
    leagues: index + 1,
  })),
  leagues: [
    ['Porra de la oficina', 'POOL', false, 'Marta Gómez', 18],
    ['Mundial con los primos', 'POOL', true, 'Luis Pérez', 42],
    ['Catan de los jueves', 'SCOREBOARD', false, 'Jorge', 5],
    ['Torneo de pádel del barrio', 'TOURNAMENT', false, null, 16],
    ['Timba del viernes', 'POKER', false, 'Ana Belén Rodríguez Santamaría', 7],
  ].map(([name, kind, isPublic, owner, members], index) => ({
    id: index + 10,
    name,
    kind,
    isPublic,
    owner,
    members,
    createdAt: `2026-11-${19 - index}T18:00:00Z`,
  })),
};

async function openPanel(page: Page, width: number, section?: string) {
  await page.setViewportSize({ width, height: 900 });
  await page.addInitScript(() => {
    localStorage.setItem('has_session', '1');
    localStorage.setItem('passkey_prompt_answered:7', '1');
  });
  await page.route('**/*', (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
      return route.continue();
    }
    if (url.origin !== 'http://127.0.0.1:4173') return route.abort();
    if (!url.pathname.startsWith('/api/')) return route.continue();
    if (url.pathname === '/api/admin/announcements') {
      return route.fulfill({
        json: { leagues: 2, members: 58, devices: 31, sent: 27, retrying: 2, failed: 2 },
      });
    }
    const responses: Record<string, unknown> = {
      '/api/auth/session/refresh': { token: 'local-fixture' },
      '/api/users/me': {
        userId: 7,
        participantName: 'Admin',
        profileSetupCompleted: true,
        lastSelectedGroupId: null,
        avatarUrl: null,
      },
      '/api/admin/overview': overview,
      // Sin ninguna liga la app solo deja crear o unirse a una.
      '/api/groups/mine': [{ id: 1, name: 'Porra de la oficina', adminUserId: 7 }],
    };
    return route.fulfill({ json: responses[url.pathname] ?? [] });
  });
  await page.goto(section ? `/gestion-7k2q?seccion=${section}` : '/gestion-7k2q');
  await expect(page.getByRole('heading', { name: 'Panel de gestión' })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

const hasNoHorizontalScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

for (const width of [390, 1440]) {
  test(`admin panel sections fit and work at ${width}px`, async ({ page }, testInfo) => {
    await openPanel(page, width);
    await expect(page.getByText('1284', { exact: true })).toBeVisible();
    expect(await hasNoHorizontalScroll(page)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`resumen-${width}.png`), fullPage: true });

    await page.getByRole('tab', { name: /Cuentas/ }).click();
    await expect(page).toHaveURL(/seccion=cuentas/);
    await expect(page.getByText('marta.gomez@example.com')).toBeVisible();
    expect(await hasNoHorizontalScroll(page)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`cuentas-${width}.png`), fullPage: true });

    await page.getByRole('tab', { name: /Ligas/ }).click();
    await page.getByRole('button', { name: 'Póker' }).click();
    await expect(page.getByText('Timba del viernes')).toBeVisible();
    await expect(page.getByText('Porra de la oficina')).toBeHidden();
    await page.getByRole('button', { name: 'Todas' }).click();
    expect(await hasNoHorizontalScroll(page)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`ligas-${width}.png`), fullPage: true });
  });

  test(`admin sends a notice after confirming at ${width}px`, async ({ page }, testInfo) => {
    await openPanel(page, width, 'avisos');
    const send = page.getByRole('button', { name: /Mandar aviso/ });
    await expect(send).toBeDisabled();

    await page.getByRole('checkbox', { name: /Porra de la oficina/ }).check();
    await page.getByRole('checkbox', { name: /Mundial con los primos/ }).check();
    await page.getByLabel('Título').fill('Nueva jornada disponible');
    await page
      .getByLabel('Texto')
      .fill('Ya podéis hacer vuestras predicciones de la jornada 12. ¡Suerte!');
    expect(await hasNoHorizontalScroll(page)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`avisos-${width}.png`), fullPage: true });

    await send.click();
    const dialog = page.getByRole('alertdialog').or(page.getByRole('dialog'));
    await expect(dialog).toContainText('Porra de la oficina');
    await page.screenshot({ path: testInfo.outputPath(`avisos-confirmar-${width}.png`) });
    await dialog.getByRole('button', { name: 'Mandar aviso' }).click();

    const result = page.getByRole('status').filter({ hasText: 'Aviso enviado' });
    await expect(result).toContainText('31');
    await expect(page.getByLabel('Título')).toHaveValue('');
    await result.scrollIntoViewIfNeeded();
    await page.screenshot({
      path: testInfo.outputPath(`avisos-resultado-${width}.png`),
      fullPage: true,
    });
  });
}
