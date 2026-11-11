import { expect, test, type Page } from '@playwright/test';
import type { OrganizedTournament } from '../src/services/endpoints/organizedTournaments';

test.use({ serviceWorkers: 'block', reducedMotion: 'reduce' });

function tournament(): OrganizedTournament {
  return {
    id: 42,
    name: 'Torneo de la plaza',
    activity: 'Petanca',
    participantType: 'TEAM',
    format: 'MANUAL',
    published: false,
    publicId: '742048c5-c4b6-4bcc-ab10-2ebcc48e91cf',
    revision: 0,
    winPoints: 3,
    drawPoints: 1,
    lossPoints: 0,
    participants: [],
    matches: [],
    standings: [],
  };
}

async function mockTournament(page: Page, state: OrganizedTournament, authenticated = true) {
  if (authenticated)
    await page.addInitScript(() => {
      localStorage.setItem('has_session', '1');
      localStorage.setItem('my_prediction_name', 'Ana');
      localStorage.setItem('passkey_prompt_answered:7', '1');
      localStorage.setItem('push_prompt_v2:7', String(Date.now()));
    });
  const writes: string[] = [];
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path.startsWith('/api/tournaments/public/')) {
      return state.published
        ? route.fulfill({ json: state })
        : route.fulfill({ status: 404, json: { error: 'Este torneo no está publicado.' } });
    }
    if (path.startsWith('/api/tournaments')) {
      if (request.method() === 'GET') return route.fulfill({ json: state });
      writes.push(path);
      const input: Record<string, unknown> = request.postDataJSON() as Record<string, unknown>;
      if (path === '/api/tournaments') {
        state.name = String(input.name);
        state.activity = String(input.activity);
        return route.fulfill({ status: 201, json: state });
      }
      if (input.revision !== state.revision)
        return route.fulfill({
          status: 409,
          json: { error: 'El torneo ha cambiado. Actualiza la página antes de guardar.' },
        });
      if (path.endsWith('/participants'))
        state.participants.push({
          id: String(state.participants.length + 1),
          name: String(input.name),
        });
      if (path.endsWith('/schedule')) {
        state.format = 'KNOCKOUT';
        state.matches = [
          {
            id: 'final',
            round: 1,
            position: 0,
            homeId: '1',
            awayId: '2',
            homeScore: null,
            awayScore: null,
            outcome: null,
            bye: false,
            venue: null,
            scheduledAt: null,
          },
        ];
      }
      if (path.endsWith('/result')) {
        state.matches[0].homeScore = Number(input.homeScore);
        state.matches[0].awayScore = Number(input.awayScore);
        state.matches[0].outcome = 'HOME';
      }
      if (path.endsWith('/publication')) state.published = input.published === true;
      state.revision++;
      return route.fulfill({ json: state });
    }
    const responses: Record<string, unknown> = {
      '/api/auth/session/refresh': { token: 'fixture' },
      '/api/users/me': { userId: 7, participantName: 'Ana', profileSetupCompleted: true },
      '/api/groups/mine': [],
      '/api/groups/public': [],
      '/api/trackers': [],
    };
    return route.fulfill({ json: responses[path] ?? [] });
  });
  return writes;
}

test('organizer creates, generates, scores and shares a tournament on mobile', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const state = tournament();
  await mockTournament(page, state);
  await page.goto('/torneos/nuevo');
  await page.getByLabel('Nombre del torneo').fill(state.name);
  await page.getByLabel('Deporte o juego').fill(state.activity);
  await page.getByRole('button', { name: 'Crear torneo', exact: true }).click();
  await expect(page).toHaveURL(/\/torneos\/42$/);
  await page.getByRole('button', { name: 'Preparar torneo', exact: true }).click();
  for (const name of ['Las Encinas', 'Los Olivos']) {
    await page.getByLabel('Nombre del participante', { exact: true }).fill(name);
    await page.getByRole('button', { name: 'Añadir', exact: true }).click();
    await expect(page.getByRole('button', { name: `Guardar nombre de ${name}` })).toBeVisible();
  }
  await page.getByRole('combobox', { name: 'Formato', exact: true }).selectOption('KNOCKOUT');
  await page.getByRole('combobox', { name: 'Crear cuadro', exact: true }).selectOption('MANUAL');
  await page.getByRole('button', { name: 'Generar cuadro' }).click();
  await expect(page.getByRole('button', { name: 'Borrar calendario y recolocar' })).toBeVisible();
  await page.getByRole('button', { name: 'Resultados y cuadro' }).click();
  await page.getByRole('button', { name: /Editar encuentro\s*:\s*Las Encinas/ }).click();
  await expect(page.getByRole('heading', { name: 'Las Encinas — Los Olivos' })).toBeFocused();
  await page.getByLabel('Marcador de Las Encinas').fill('13');
  await page.getByLabel('Marcador de Los Olivos').fill('8');
  await page.getByRole('button', { name: 'Guardar resultado' }).click();
  await expect(page.getByText('Ganador del torneo:')).toContainText('Las Encinas');
  await page.getByRole('button', { name: 'Publicar torneo' }).click();
  await page.getByText('Compartir enlace y QR', { exact: true }).click();
  await expect(page.getByLabel('Enlace público')).toHaveValue(new RegExp(`/t/${state.publicId}$`));
  await page.getByRole('link', { name: 'Ver página pública' }).click();
  await expect(page.getByRole('button', { name: /Editar encuentro/ })).toHaveCount(0);
  await expect(page.getByText('Ganador del torneo:')).toContainText('Las Encinas');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({
    path: testInfo.outputPath('mobile-public-tournament.png'),
    fullPage: true,
  });
});

test('anonymous visitors see a league without joining or editing', async ({ page }, testInfo) => {
  const state = tournament();
  state.published = true;
  state.format = 'LEAGUE';
  state.participants = [
    { id: '1', name: 'Las Encinas' },
    { id: '2', name: 'Los Olivos' },
  ];
  state.matches = [
    {
      id: 'm1',
      round: 1,
      position: 0,
      homeId: '1',
      awayId: '2',
      homeScore: 13,
      awayScore: 8,
      outcome: 'HOME',
      bye: false,
      venue: 'Plaza del pueblo',
      scheduledAt: null,
    },
  ];
  state.standings = [
    {
      participantId: '1',
      played: 1,
      won: 1,
      drawn: 0,
      lost: 0,
      scored: 13,
      conceded: 8,
      points: 3,
    },
    {
      participantId: '2',
      played: 1,
      won: 0,
      drawn: 0,
      lost: 1,
      scored: 8,
      conceded: 13,
      points: 0,
    },
  ];
  const writes = await mockTournament(page, state, false);
  await page.goto(`/t/${state.publicId}`);
  await expect(page.getByRole('heading', { name: state.name })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Clasificación', exact: true })).toBeVisible();
  await expect(page.getByRole('row', { name: /Las Encinas/ })).toContainText('13');
  await expect(
    page.getByRole('button', { name: /Editar|Publicar|Unirme|Iniciar sesión/i }),
  ).toHaveCount(0);
  expect(writes).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath('desktop-public-league.png'), fullPage: true });
});

test('draft link does not reveal the tournament', async ({ page }) => {
  const state = tournament();
  await mockTournament(page, state, false);
  await page.goto(`/t/${state.publicId}`);
  await expect(page.getByRole('heading', { name: 'Torneo no disponible' })).toBeVisible();
  await expect(page.getByText(state.name, { exact: true })).toHaveCount(0);
});

test('stale edits show the conflict and reload the latest participants', async ({ page }) => {
  const state = tournament();
  await mockTournament(page, state);
  await page.goto('/torneos/42');
  await page.getByRole('button', { name: 'Preparar torneo', exact: true }).click();
  state.revision++;
  state.participants.push({ id: 'external', name: 'Equipo añadido desde otro móvil' });
  await page.getByLabel('Nombre del participante', { exact: true }).fill('Mi equipo');
  await page.getByRole('button', { name: 'Añadir', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('El torneo ha cambiado');
  await page.getByRole('button', { name: 'Actualizar datos' }).click();
  await expect(
    page.getByRole('button', { name: /Guardar nombre de Equipo añadido/ }),
  ).toBeVisible();
  await expect(page.getByLabel('Nombre del participante', { exact: true })).toHaveValue(
    'Mi equipo',
  );
});
