import { expect, test, type Page } from '@playwright/test';

test.use({ serviceWorkers: 'block', reducedMotion: 'reduce' });

const ORIGIN = 'http://127.0.0.1:4173';

const session = {
  token: 'local-fixture',
  userId: 7,
  participantName: 'Ana',
  status: 'login_success',
  lastSelectedGroupId: 0,
  avatarUrl: null,
};

/** API simulada: sin sesión hasta que se entra con email; después, una cuenta sin ligas. */
async function mockApi(page: Page) {
  let signedIn = false;
  await page.addInitScript(() => localStorage.setItem('passkey_prompt_answered:7', '1'));
  await page.route('**/*', (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin !== ORIGIN) return route.abort();
    if (!url.pathname.startsWith('/api/')) return route.continue();
    if (
      request.method() === 'POST' &&
      ['/api/auth/password/register', '/api/auth/password/login'].includes(url.pathname)
    ) {
      signedIn = true;
      return route.fulfill({ json: session });
    }
    if (url.pathname === '/api/auth/session/refresh') {
      return signedIn ? route.fulfill({ json: session }) : route.fulfill({ status: 401, json: {} });
    }
    if (url.pathname === '/api/users/me') {
      return route.fulfill({
        json: { userId: 7, participantName: 'Ana', profileSetupCompleted: true, avatarUrl: null },
      });
    }
    if (url.pathname === '/api/groups/join-info/BARRIO') {
      return route.fulfill({ json: { name: 'Los del barrio', competitionName: 'LaLiga' } });
    }
    return route.fulfill({ json: [] });
  });
}

for (const width of [390, 1440]) {
  test(`«Crear mi liga gratis» crea la cuenta en /registro y sigue a crear la liga a ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await mockApi(page);
    await page.goto('/');
    await page.getByRole('link', { name: 'Crear mi liga gratis', exact: true }).first().click();
    await expect(page).toHaveURL(/\/registro\?redirect=%2Fcrear-liga$/);
    await page.getByLabel('Email', { exact: true }).fill('ana@example.test');
    await page.locator('input[type="password"]').fill('una-clave-larga');
    await page.getByRole('button', { name: 'Crear cuenta', exact: true }).click();
    await expect(page).toHaveURL(/\/crear-liga$/);
  });
}

test('la cabecera lleva a /login y una invitación pendiente vuelve a la invitación', async ({
  page,
}) => {
  await mockApi(page);
  await page.addInitScript(() => localStorage.setItem('pendingJoinCode', 'BARRIO'));
  await page.goto('/');
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel('Email', { exact: true }).fill('ana@example.test');
  await page.locator('input[type="password"]').fill('una-clave-larga');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page).toHaveURL(/\/join\/BARRIO$/);
});
