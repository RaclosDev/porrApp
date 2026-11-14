import { expect, test, type Page } from '@playwright/test';
import type {
  PokerAction,
  PokerLeagueData,
  PokerSession,
  PokerSettings,
} from '../src/services/endpoints/poker';

test.use({ serviceWorkers: 'block', reducedMotion: 'reduce' });

async function mockLeague(page: Page, owner = true, existing = true) {
  let created = existing;
  await page.addInitScript(() => {
    localStorage.setItem('has_session', '1');
    localStorage.setItem('my_prediction_name', 'Ana');
    localStorage.setItem('activeGroupId', '9');
    localStorage.setItem('passkey_prompt_answered:7', '1');
    localStorage.setItem('push_prompt_v2:7', String(Date.now()));
  });
  const group = {
    id: 9,
    name: 'Póker de los sábados',
    kind: 'POKER',
    joinCode: 'POKER9',
    adminUserId: owner ? 7 : 8,
  };
  const league: PokerLeagueData = {
    id: group.id,
    name: group.name,
    joinCode: group.joinCode,
    owner,
    myPlayerId: 11,
    players: [{ id: 11, name: 'Ana', guest: false }],
    current: null,
    serverNow: Date.now(),
  };
  const history: PokerSession[] = [];
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const method = request.method();
    const base = '/api/poker/9';
    const current = league.current;
    league.serverNow = Date.now();

    if (path === `${base}/music`) {
      return route.fulfill({ json: { organizer: true, searchAvailable: true, items: [] } });
    }

    if (path === '/api/poker' && method === 'POST') {
      const { name } = request.postDataJSON() as { name: string };
      group.name = name;
      league.name = name;
      created = true;
      return route.fulfill({ json: league });
    }

    if (path === `${base}/sessions` && method === 'POST') {
      const { date, settings } = request.postDataJSON() as {
        date: string;
        settings: PokerSettings;
      };
      league.current = {
        id: history.length + 1,
        revision: 0,
        date,
        settings,
        startedAt: null,
        closedAt: null,
        entries: [],
        eliminations: [],
        clock: null,
        potCents: 0,
        prizes: [0, 0, 0],
        results: [],
      };
    }
    if (path === `${base}/sessions/${current?.id}/attendance` && method === 'PUT' && current) {
      const { attending, playerId = 11 } = request.postDataJSON() as {
        attending: boolean;
        playerId?: number;
      };
      const player = league.players.find(({ id }) => id === playerId)!;
      current.entries = current.entries.filter((entry) => entry.playerId !== playerId);
      if (attending) current.entries.push({ playerId, name: player.name, rebuys: 0, addOns: 0 });
    }
    if (path === `${base}/sessions/${current?.id}/guests` && method === 'POST' && current) {
      const { name } = request.postDataJSON() as { name: string };
      const id = 11 + league.players.length;
      league.players.push({ id, name, guest: true });
      current.entries.push({ playerId: id, name, rebuys: 0, addOns: 0 });
    }
    if (current) {
      current.potCents = current.entries.length * current.settings.buyInCents;
      current.prizes = current.settings.prizeShares.map(
        (share) => (current.potCents * share) / 100,
      );
    }
    if (path === `${base}/sessions/${current?.id}/commands` && method === 'POST' && current) {
      const { action, playerId } = request.postDataJSON() as {
        action: PokerAction;
        playerId: number;
      };
      if (action === 'START') {
        current.startedAt = league.serverNow;
        current.clock = { level: 0, endsAt: league.serverNow + 900_000, remainingMs: 900_000 };
      }
      if (action === 'PAUSE') current.clock = { level: 0, endsAt: null, remainingMs: 899_000 };
      if (action === 'ELIMINATE') current.eliminations.push(playerId);
      if (action === 'CLOSE') {
        current.closedAt = league.serverNow;
        current.results = current.entries
          .map((entry) => {
            const index = current.eliminations.indexOf(entry.playerId);
            const place = index < 0 ? 1 : current.entries.length - index;
            return {
              ...entry,
              place,
              paidCents: current.settings.buyInCents,
              prizeCents: current.prizes[place - 1] ?? 0,
            };
          })
          .sort((a, b) => a.place - b.place);
        history.unshift(current);
        league.current = null;
      }
    }

    const responses: Record<string, unknown> = {
      '/api/auth/session/refresh': { token: 'fixture' },
      '/api/users/me': {
        userId: 7,
        participantName: 'Ana',
        profileSetupCompleted: true,
        lastSelectedGroupId: 9,
      },
      '/api/groups/mine': created ? [group] : [],
      '/api/groups/9': group,
      [base]: league,
      [`${base}/history`]: history,
    };
    return route.fulfill({
      json: path.startsWith(`${base}/sessions`) ? league : (responses[path] ?? []),
    });
  });
  return league;
}

test('prepara la mesa, apunta invitados y conserva los resultados para el siguiente sábado', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockLeague(page, true, false);
  await page.goto('/crear-liga');
  await page.getByRole('link', { name: /Liga de póker/ }).click();
  await page.getByLabel('Nombre de la liga').fill('Póker de los sábados');
  await page.getByRole('button', { name: 'Crear liga', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Póker de los sábados' })).toBeVisible();
  const nav = page.getByRole('navigation', { name: 'Navegación principal móvil' });
  await expect(nav.getByRole('link')).toHaveText([
    'Inicio',
    'Mesa',
    'Histórico',
    'Estadísticas',
    'Mis Ligas',
  ]);
  await expect(page.getByText('Sin torneo a la vista')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Primeros pasos' })).toBeVisible();
  // Invitar abre el panel con el código, a la altura de la etiqueta de la liga.
  await page.getByRole('button', { name: 'Invitar', exact: true }).first().click();
  await expect(page.getByRole('heading', { name: 'Invitar a la liga' })).toBeVisible();
  await nav.getByRole('link', { name: 'Mis Ligas' }).click();
  await page.getByRole('button', { name: 'Más opciones de Póker de los sábados' }).click();
  await expect(
    page.getByRole('button', { name: 'Administrar Póker de los sábados' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Abrir Póker de los sábados' }).click();
  await page.getByRole('link', { name: 'Preparar torneo' }).click();
  await expect(nav.getByRole('link', { name: 'Mesa', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );

  await page.getByRole('button', { name: 'Preparar torneo' }).click();
  await page.getByLabel('Fecha').fill('2026-11-14');
  await page.getByLabel('Entrada (€)').fill('10');
  await page.getByRole('button', { name: 'Abrir inscripciones' }).click();
  await page.getByRole('button', { name: 'Apuntarme', exact: true }).click();
  await expect(page.getByText('Asistencia confirmada')).toBeVisible();
  await page.getByRole('button', { name: 'Añadir invitado sin cuenta' }).click();
  const guest = page.getByRole('textbox', { name: 'Nombre del jugador' });
  for (const name of ['Marta', 'Luis']) {
    await guest.fill(name);
    await page.getByRole('button', { name: 'Añadir', exact: true }).click();
    await expect(page.getByRole('checkbox', { name: new RegExp(name) })).toBeChecked();
  }
  await page.getByRole('button', { name: 'Empezar torneo' }).click();
  await expect(page.getByRole('timer')).toBeVisible();
  await page.getByRole('button', { name: 'Pausar' }).click();
  await expect(page.getByText('Reloj en pausa')).toBeVisible();
  await page.getByRole('button', { name: 'Eliminar a Luis' }).click();
  await page.getByRole('button', { name: 'Eliminar a Marta' }).click();
  await page.getByRole('button', { name: 'Cerrar torneo' }).click();
  await page.getByRole('button', { name: 'Cerrar y guardar' }).click();

  await expect(page.getByRole('heading', { name: 'Histórico de torneos' })).toBeVisible();
  await expect(page).toHaveURL('/poker/historico');
  const winner = page.getByRole('row', { name: /Ana/ });
  await expect(winner).toContainText('18,00');
  const tip = page.getByRole('dialog', { name: /Propina para el crupier/ });
  await expect(tip).toBeVisible();
  await tip.getByRole('button', { name: 'Cerrar' }).click();
  await expect(tip).toBeHidden();
  await nav.getByRole('link', { name: 'Estadísticas' }).click();
  await expect(winner).toContainText('100');
  await expect(page.getByRole('row', { name: /Luis/ })).toContainText('3,00');

  await nav.getByRole('link', { name: 'Inicio' }).click();
  await expect(page.getByText(/Ganó Ana/)).toBeVisible();
  await expect(page.getByText('1.º Ana')).toBeVisible();
  await page.getByRole('link', { name: 'Ver histórico' }).click();
  await expect(page).toHaveURL('/poker/historico');
  await page.goBack();
  await expect(nav.getByRole('link', { name: 'Inicio' })).toHaveAttribute('aria-current', 'page');
  await nav.getByRole('link', { name: 'Mesa', exact: true }).click();
  await page.getByRole('button', { name: 'Preparar torneo' }).click();
  await expect(page.getByLabel('Entrada (€)')).toHaveValue('10');
  await page.getByLabel('Fecha').fill('2026-11-21');
  await page.getByRole('button', { name: 'Abrir inscripciones' }).click();
  await expect(page.getByRole('checkbox', { name: /Marta/ })).not.toBeChecked();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
});

test('un miembro confirma su asistencia desde la liga sin controles de organizador', async ({
  page,
}) => {
  const league = await mockLeague(page, false);
  league.current = {
    id: 1,
    revision: 0,
    date: '2026-11-14',
    startedAt: null,
    closedAt: null,
    settings: {
      buyInCents: 1000,
      startingChips: 10000,
      prizeShares: [100],
      levels: [{ minutes: 15, small: 25, big: 50, ante: 0 }],
      rebuy: null,
      addOn: null,
    },
    entries: [],
    eliminations: [],
    clock: null,
    potCents: 0,
    prizes: [0],
    results: [],
  };
  await page.goto('/?group=9');
  const nav = page.getByRole('navigation').filter({
    has: page.getByRole('link', { name: 'Mesa', exact: true }),
  });
  await expect(nav.getByRole('link')).toHaveText([
    'Inicio',
    'Mesa',
    'Histórico',
    'Estadísticas',
    'Mis Ligas',
  ]);
  await expect(page.getByRole('heading', { name: 'Próximo torneo' })).toBeVisible();
  await expect(page.getByText('Jugadores confirmados')).toBeVisible();
  await page.getByRole('link', { name: 'Apuntarme al torneo' }).click();
  await page.reload();
  await expect(nav.getByRole('link', { name: 'Mesa', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await page.getByRole('button', { name: 'Apuntarme', exact: true }).click();
  await expect(page.getByText('Asistencia confirmada')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Empezar torneo' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Desapuntarme', exact: true }).click();
  await expect(page.getByText('Aún no hay confirmaciones.')).toBeVisible();
});

test('el creador asigna y retira permisos desde los miembros de la liga', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockLeague(page);
  await page.route('**/api/groups/9/scoring', (route) =>
    route.fulfill({ status: 404, json: { message: 'La liga no tiene una edición activa' } }),
  );
  const members = [
    { userId: 7, participantName: 'Ana', role: 'ADMIN', creator: true, isAdmin: true },
    { userId: 8, participantName: 'Bruno', role: 'MEMBER', creator: false, isAdmin: false },
  ];
  await page.route('**/api/groups/9/members**', async (route) => {
    if (route.request().method() === 'PUT') {
      members[1].role = (route.request().postDataJSON() as { role: string }).role;
      return route.fulfill({ json: { message: 'Permisos actualizados' } });
    }
    return route.fulfill({ json: members });
  });
  await page.goto('/mis-ligas');
  await page
    .getByRole('button', { name: 'Más opciones de Póker de los sábados', exact: true })
    .click();
  await page.getByRole('button', { name: 'Administrar Póker de los sábados', exact: true }).click();
  await expect(page.getByText('Creador · Admin', { exact: true })).toBeVisible();
  const permissions = page.getByRole('combobox', { name: 'Permisos de Bruno' });
  for (const role of ['ADMIN', 'ORGANIZER', 'MEMBER']) {
    await permissions.selectOption(role);
    await expect(permissions).toHaveValue(role);
    await expect(permissions).toBeEnabled();
  }
  await expect(page.getByRole('combobox', { name: 'Permisos de Ana' })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});
