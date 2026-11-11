import { expect, test, type Page } from '@playwright/test';
import type { Tracker } from '../src/services/endpoints/trackers';

test.use({ serviceWorkers: 'block', reducedMotion: 'reduce' });

async function mockLeague(page: Page, owner: boolean) {
  await page.addInitScript(() => {
    localStorage.setItem('has_session', '1');
    localStorage.setItem('my_prediction_name', 'Ana');
    localStorage.setItem('activeGroupId', '9');
    localStorage.setItem('passkey_prompt_answered:7', '1');
    localStorage.setItem('push_prompt_v2:7', String(Date.now()));
  });
  const tracker: Tracker = {
    id: 9,
    name: 'Jueves de juegos',
    unit: 'puntos',
    lowerWins: false,
    owner,
    joinCode: 'JUEVES',
    myPlayerId: owner ? 11 : null,
    claimedPlayerIds: [11],
    currentSessionId: null,
    currentDayId: null,
    players: [{ id: 11, name: 'Ana' }],
    games: [],
    days: [],
    sessions: [],
    rounds: [],
    overall: [],
  };
  const league = {
    id: 9,
    name: tracker.name,
    kind: 'SCOREBOARD',
    joinCode: 'JUEVES',
    adminUserId: owner ? 7 : 8,
    competitionId: null,
    poolFormat: 'MATCH_DAY',
  };
  const added: string[] = [];
  const changedPlayers: number[][] = [];
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === '/api/trackers/9/players' && request.method() === 'POST') {
      const { name } = request.postDataJSON() as { name: string };
      added.push(name);
      tracker.players.push({
        id: Math.max(0, ...tracker.players.map((player) => player.id)) + 1,
        name,
      });
      return route.fulfill({ json: tracker });
    }
    if (path === '/api/trackers/9/sessions/1/players' && request.method() === 'PUT') {
      const { playerIds } = request.postDataJSON() as { playerIds: number[] };
      changedPlayers.push(playerIds);
      tracker.sessions[0].playerIds = playerIds;
      return route.fulfill({ json: tracker });
    }
    if (path === '/api/trackers/9/sessions/1/end' && request.method() === 'POST') {
      tracker.sessions[0].endedAt = '2026-11-11T18:00:00Z';
      tracker.currentSessionId = null;
      return route.fulfill({ json: tracker });
    }
    if (path === '/api/trackers/9/days/1/close' && request.method() === 'POST') {
      tracker.days = [];
      tracker.sessions = [];
      tracker.currentDayId = null;
      tracker.currentSessionId = null;
      return route.fulfill({ json: tracker });
    }
    const responses: Record<string, unknown> = {
      '/api/auth/session/refresh': { token: 'fixture' },
      '/api/users/me': {
        userId: 7,
        participantName: 'Ana',
        profileSetupCompleted: true,
        lastSelectedGroupId: 9,
      },
      '/api/groups/mine': [league],
      '/api/groups/9': league,
      '/api/trackers/9': tracker,
      '/api/trackers': [],
    };
    return route.fulfill({ json: responses[path] ?? [] });
  });
  return { tracker, added, changedPlayers };
}

function prepareDay(tracker: Tracker, rounds: number | null) {
  const now = '2026-11-11T17:00:00Z';
  tracker.currentDayId = 1;
  tracker.days = [
    {
      id: 1,
      startedAt: now,
      closedAt: null,
      playerIds: [11, 12],
      sessionIds: rounds === null ? [] : [1],
    },
  ];
  tracker.players.push({ id: 12, name: 'Berto' });
  tracker.games = [
    {
      id: 3,
      name: 'Catán',
      mode: 'POINTS',
      unit: 'puntos',
      lowerWins: false,
      sessions: 1,
      rounds: rounds ?? 0,
    },
  ];
  if (rounds !== null) {
    tracker.currentSessionId = 1;
    tracker.sessions = [
      {
        id: 1,
        number: 1,
        gameId: 3,
        dayId: 1,
        startedAt: now,
        endedAt: null,
        playerIds: [11, 12],
        plannedRounds: null,
        rounds,
        winners: [],
        standings: [],
      },
    ];
    if (rounds > 0)
      tracker.rounds = [
        {
          id: 1,
          sessionId: 1,
          number: 1,
          createdAt: now,
          note: null,
          recordedBy: 'Ana',
          revision: 0,
          scores: { 11: 7 },
        },
      ];
  }
}

for (const width of [390, 1440]) {
  test(`corregir una hoja larga lleva al formulario y permite volver a ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    const { tracker } = await mockLeague(page, true);
    prepareDay(tracker, 20);
    tracker.rounds = Array.from({ length: 20 }, (_, index) => ({
      ...tracker.rounds[0],
      id: index + 1,
      number: index + 1,
    }));
    await page.goto('/partida');
    const edit = page.getByRole('button', { name: 'Corregir la ronda 1', exact: true });
    await expect(edit).toContainText('Editar');
    await edit.click();
    const title = page.getByRole('heading', { name: 'Corregir la ronda 1', exact: true });
    await expect(title).toBeFocused();
    await expect(title).toBeInViewport();
    await expect(page.getByLabel('Ana', { exact: true })).toHaveValue('7');
    await page.screenshot({ path: testInfo.outputPath('corregir-ronda.png'), fullPage: false });
    await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
    await expect(edit).toBeFocused();
    await expect(edit).toBeInViewport();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  });

  test(`cambiar jugadores conserva los resultados y añade a quien llega después a ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    const { tracker, changedPlayers } = await mockLeague(page, false);
    prepareDay(tracker, 1);
    await page.goto('/partida');
    await page.getByLabel('Ana', { exact: true }).fill('9');
    await page.getByRole('button', { name: 'Cambiar jugadores' }).click();
    const panel = page.getByRole('region', { name: 'Cambiar jugadores de la partida' });
    await expect(panel.getByRole('button', { name: 'Ana', exact: true })).toBeDisabled();
    await panel.getByRole('button', { name: 'Berto', exact: true }).click();
    await panel.getByLabel('Nombre del jugador nuevo').fill('Luis');
    await panel.getByRole('button', { name: 'Añadir', exact: true }).click();
    await expect(panel.getByRole('button', { name: 'Luis', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await page.screenshot({ path: testInfo.outputPath('cambiar-jugadores.png'), fullPage: true });
    await panel.getByRole('button', { name: 'Guardar jugadores' }).click();
    await expect(page.getByRole('columnheader', { name: 'Luis', exact: true })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Berto', exact: true })).toHaveCount(0);
    expect(changedPlayers).toEqual([[11, 13]]);
    await expect(page.getByRole('cell', { name: '7', exact: true })).toBeVisible();
    await expect(page.getByLabel('Ana', { exact: true })).toHaveValue('9');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });

  test(`cerrar un día vacío y terminar una partida sin resultados a ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const { tracker } = await mockLeague(page, true);
    prepareDay(tracker, null);
    await page.goto('/partida');
    await page.getByRole('button', { name: 'Ana', exact: true }).click();
    await page.getByRole('button', { name: 'Berto', exact: true }).click();
    await expect(page.getByRole('button', { name: /Catán/ })).toBeDisabled();
    await page.getByRole('button', { name: 'Otro juego nuevo' }).click();
    await page.getByLabel('Nombre del juego').fill('Mus');
    await expect(page.getByRole('button', { name: 'Crear y jugar' })).toBeDisabled();
    await page.getByRole('button', { name: 'Cerrar el día de juego', exact: true }).click();
    await expect(page.getByRole('alertdialog')).toContainText('Se descartará este día vacío');
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: 'Cerrar el día', exact: true })
      .click();
    await expect(page.getByRole('heading', { name: '¿Quién ha venido hoy?' })).toBeVisible();
    prepareDay(tracker, 0);
    await page.reload();
    await page.getByRole('button', { name: 'Terminar partida', exact: true }).click();
    await expect(page.getByRole('alertdialog')).toContainText('Esta partida no sumará resultados');
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: 'Terminar partida', exact: true })
      .click();
    await expect(page.getByRole('heading', { name: '¿A qué jugáis?' })).toBeVisible();
    await page.getByRole('button', { name: 'Cerrar el día de juego', exact: true }).click();
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: 'Cerrar el día', exact: true })
      .click();
    await expect(page.getByRole('heading', { name: '¿Quién ha venido hoy?' })).toBeVisible();
  });

  for (const owner of [true, false]) {
    test(`alta sin cuenta e invitación separadas: ${owner ? 'admin' : 'miembro'} a ${width}px`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize({ width, height: 900 });
      const { added } = await mockLeague(page, owner);
      await page.goto('/');
      await page.getByRole('button', { name: 'Añadir jugador', exact: true }).click();
      await page.getByLabel('Nombre del jugador', { exact: true }).fill(' Luis ');
      await page.getByRole('button', { name: 'Añadir', exact: true }).click();
      await expect(
        page.getByRole('status').filter({ hasText: 'Luis ya está en la liga.' }),
      ).toBeVisible();
      await expect(page.getByRole('list', { name: 'Jugadores', exact: true })).toContainText(
        'Luis',
      );
      expect(added).toEqual(['Luis']);
      await expect(page.getByLabel('Nombre del jugador', { exact: true })).toBeFocused();
      if (!owner) await expect(page.getByRole('button', { name: 'Editar a Luis' })).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await page.screenshot({ path: testInfo.outputPath('jugadores.png'), fullPage: true });
      await page.getByRole('button', { name: 'Cerrar formulario' }).click();
      await expect(page.getByRole('button', { name: 'Añadir jugador', exact: true })).toBeFocused();
      await page.getByRole('button', { name: 'Invitar con enlace' }).click();
      await expect(page.getByRole('button', { name: 'Copiar enlace' })).toBeVisible();
      await expect(page.getByLabel('Nombre del jugador', { exact: true })).toHaveCount(0);
    });
  }
}

for (const owner of [true, false]) {
  test(`reabrir una partida respeta los permisos de ${owner ? 'administrador' : 'miembro'}`, async ({
    page,
  }) => {
    const { tracker } = await mockLeague(page, owner);
    prepareDay(tracker, 1);
    tracker.sessions[0].endedAt = '2026-11-11T18:00:00Z';
    tracker.currentSessionId = null;
    await page.goto('/partida');
    await expect(page.getByRole('button', { name: 'Otra partida', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reabrir para corregir' })).toHaveCount(
      owner ? 1 : 0,
    );
    await page.goto('/historico');
    await page.getByRole('button', { name: /Catán · partida 1/ }).click();
    await expect(page.getByRole('button', { name: 'Volver al histórico' })).toBeInViewport();
    await expect(page.getByRole('button', { name: 'Corregir la ronda 1' })).toHaveCount(
      owner ? 1 : 0,
    );
    await page.getByRole('button', { name: 'Volver al histórico' }).click();
    await expect(page.getByRole('button', { name: /Catán · partida 1/ })).toBeVisible();
  });
}

test('histórico y ranking sin resultados permiten empezar a jugar', async ({ page }) => {
  await mockLeague(page, false);
  for (const path of ['/historico', '/ranking']) {
    await page.goto(path);
    await page.getByRole('link', { name: 'Empezar día de juego' }).click();
    await expect(page).toHaveURL(/\/partida$/);
    await expect(page.getByRole('button', { name: 'Empezar día de juego' })).toBeVisible();
  }
});

test('una ronda pendiente impide cambiar jugadores, terminar o cerrar una partida vacía', async ({
  page,
}) => {
  const { tracker } = await mockLeague(page, true);
  prepareDay(tracker, 0);
  await page.addInitScript(() => {
    localStorage.setItem(
      'porrapp.tracker.7.9.round.pending',
      JSON.stringify({
        round: { sessionId: 1, clientRequestId: 'pending', scores: { 11: 3 } },
        createdAt: Date.now(),
        problem: 'Pendiente de revisión',
      }),
    );
  });
  await page.goto('/partida');
  await expect(page.getByText(/1 ronda pendiente/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Cambiar jugadores' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Cambiar de juego' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Terminar partida' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Cerrar el día de juego' })).toBeDisabled();
});
