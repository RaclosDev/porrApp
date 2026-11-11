import { expect, test, type Page } from '@playwright/test';

test.use({ serviceWorkers: 'block', reducedMotion: 'reduce' });

const ORIGIN = 'http://127.0.0.1:4173';

interface Game {
  id: number;
  name: string;
  unit: string;
  lowerWins: boolean;
  mode: 'POINTS' | 'WINS';
  sessions: number;
  rounds: number;
}

interface Session {
  id: number;
  number: number;
  gameId: number;
  dayId: number;
  playerIds: number[];
  startedAt: string;
  endedAt: string | null;
  plannedRounds: null;
}

interface Round {
  id: number;
  sessionId: number;
  number: number;
  note: null;
  createdAt: string;
  scores: Record<string, number>;
  recordedBy: string;
}

/** Un servidor de mentira con estado: lo justo para jugar un día entero desde la pantalla. */
function fakeLeague() {
  const players = [
    { id: 11, name: 'Ana' },
    { id: 12, name: 'Berto' },
    { id: 13, name: 'Carla' },
  ];
  const games: Game[] = [];
  const sessions: Session[] = [];
  const rounds: Round[] = [];
  const days: { id: number; startedAt: string; closedAt: string | null; playerIds: number[] }[] =
    [];
  let currentDayId: number | null = null;
  const now = '2026-11-10T18:00:00Z';

  const standings = (session: Session) => {
    const game = games.find((item) => item.id === session.gameId)!;
    const own = rounds.filter((round) => round.sessionId === session.id);
    const rows = session.playerIds.map((playerId) => {
      const name = players.find((player) => player.id === playerId)!.name;
      const scored = own.map((round) => round.scores[playerId]).filter((v) => v !== undefined);
      const total = scored.reduce((sum, value) => sum + value, 0);
      const roundsWon = own.filter((round) => {
        const values = Object.values(round.scores);
        const best = game.lowerWins ? Math.min(...values) : Math.max(...values);
        return round.scores[playerId] === best && (game.mode === 'POINTS' || best > 0);
      }).length;
      return { playerId, name, total, roundsWon, sessionsWon: 0, rank: 0 };
    });
    const key = (row: (typeof rows)[number]) =>
      game.mode === 'WINS' ? -row.roundsWon : game.lowerWins ? row.total : -row.total;
    rows.sort((a, b) => key(a) - key(b));
    rows.forEach((row) => (row.rank = rows.filter((other) => key(other) < key(row)).length + 1));
    return rows;
  };

  const snapshot = () => ({
    id: 9,
    name: 'Mus de los jueves',
    unit: 'puntos',
    lowerWins: false,
    owner: true,
    joinCode: 'MUS123',
    myPlayerId: 11,
    claimedPlayerIds: [11],
    currentSessionId: sessions.find((item) => !item.endedAt)?.id ?? null,
    currentDayId,
    players,
    games: games.map((game) => ({
      ...game,
      sessions: sessions.filter((item) => item.gameId === game.id).length,
      rounds: rounds.filter((round) =>
        sessions.some((item) => item.id === round.sessionId && item.gameId === game.id),
      ).length,
    })),
    days: days.map((day) => ({
      ...day,
      sessionIds: sessions.filter((item) => item.dayId === day.id).map((item) => item.id),
    })),
    sessions: sessions.map((session) => {
      const rows = standings(session);
      const played = rounds.filter((round) => round.sessionId === session.id).length;
      return {
        ...session,
        rounds: played,
        standings: rows,
        winners:
          session.endedAt && played > 0
            ? rows.filter((row) => row.rank === 1).map((row) => row.playerId)
            : [],
      };
    }),
    rounds,
    overall: [],
  });

  const handle = (method: string, path: string, body: Record<string, unknown>) => {
    if (method === 'POST' && path === '/days') {
      const id = days.length + 1;
      days.push({ id, startedAt: now, closedAt: null, playerIds: body.playerIds as number[] });
      currentDayId = id;
    } else if (method === 'POST' && path === '/games') {
      games.push({ ...(body as Omit<Game, 'id'>), id: games.length + 3, sessions: 0, rounds: 0 });
    } else if (method === 'POST' && path === '/sessions') {
      sessions
        .filter((item) => !item.endedAt)
        .forEach((item) => {
          item.endedAt = now;
        });
      sessions.push({
        id: sessions.length + 20,
        number: sessions.length + 1,
        gameId: body.gameId as number,
        dayId: currentDayId!,
        playerIds: body.playerIds as number[],
        startedAt: now,
        endedAt: null,
        plannedRounds: null,
      });
    } else if (method === 'POST' && /^\/sessions\/\d+\/end$/.test(path)) {
      sessions.find((item) => path.includes(`/${item.id}/`))!.endedAt = now;
    } else if (method === 'POST' && path === '/rounds') {
      const session = sessions.find((item) => item.id === body.sessionId)!;
      const winners = body.winners as number[] | undefined;
      const scores = winners
        ? Object.fromEntries(session.playerIds.map((id) => [id, winners.includes(id) ? 1 : 0]))
        : (body.scores as Record<string, number>);
      rounds.push({
        id: rounds.length + 40,
        sessionId: session.id,
        // Como el servidor: las rondas se numeran en toda la liga.
        number: rounds.length + 1,
        note: null,
        createdAt: now,
        scores,
        recordedBy: 'Ana',
      });
    }
    return snapshot();
  };

  return { handle, snapshot };
}

async function openLeague(page: Page) {
  const league = fakeLeague();
  const musGroup = {
    id: 9,
    name: 'Mus de los jueves',
    kind: 'SCOREBOARD',
    joinCode: 'MUS123',
    adminUserId: 7,
    adminParticipantName: 'Auditor',
    competitionId: null,
    competitionName: null,
    formatType: null,
    poolFormat: 'MATCH_DAY',
    pichichi: false,
    isLocked: false,
  };
  await page.addInitScript(() => {
    localStorage.setItem('has_session', '1');
    localStorage.setItem('my_prediction_name', 'Auditor');
    localStorage.setItem('userId', '7');
    localStorage.setItem('passkey_prompt_answered:7', '1');
  });
  await page.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin !== ORIGIN) {
      // Las fuentes se dejan pasar para que la captura salga como en el móvil.
      return /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)
        ? route.continue()
        : route.abort();
    }
    if (!url.pathname.startsWith('/api/')) return route.continue();
    if (url.pathname.startsWith('/api/trackers/9')) {
      const sub = url.pathname.slice('/api/trackers/9'.length);
      const body = (request.postDataJSON() ?? {}) as Record<string, unknown>;
      return route.fulfill({
        json: sub === '' ? league.snapshot() : league.handle(request.method(), sub, body),
      });
    }
    const responses: Record<string, unknown> = {
      '/api/auth/session/refresh': { token: 'local-fixture' },
      '/api/users/me': {
        userId: 7,
        participantName: 'Auditor',
        profileSetupCompleted: true,
        lastSelectedGroupId: null,
        avatarUrl: null,
      },
      '/api/groups/mine': [musGroup],
      '/api/groups/9': musGroup,
      '/api/trackers': [{ id: 9, name: 'Mus de los jueves', owner: true, players: 3, rounds: 0 }],
      '/api/matches/radar': { live: [], last: [], next: [] },
    };
    return route.fulfill({ json: responses[url.pathname] ?? [] });
  });
  // Su única liga es de juegos de mesa: es la activa y el inicio es su marcador.
  await page.goto('/?group=9');
  await expect(page.getByRole('heading', { name: 'Mus de los jueves' })).toBeVisible();
}

async function snap(page: Page, name: string) {
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `test-results/marcador-hoja-${name}.png`, fullPage: true });
}

test('un día de juego entero desde el móvil: quién viene, hoja por puntos y por victorias', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openLeague(page);

  // El inicio de la liga: sin día de juego, el botón para empezarlo lleva a Partida.
  const nav = page.getByRole('navigation', { name: 'Navegación principal móvil' });
  await expect(nav.getByRole('link')).toHaveText([
    'Inicio',
    'Partida',
    'Ranking',
    'Histórico',
    'Mis Ligas',
  ]);
  await expect(page.getByText('Ningún día de juego en curso.')).toBeVisible();
  await snap(page, '0-inicio');
  await page.getByRole('link', { name: 'Empezar día de juego' }).click();
  await expect(page).toHaveURL(`${ORIGIN}/partida`);

  // Quién ha venido: Carla no.
  await expect(page.getByRole('heading', { name: '¿Quién ha venido hoy?' })).toBeVisible();
  const attendees = page.getByRole('group', { name: 'Jugadores que han venido' });
  await attendees.getByRole('button', { name: /Carla/ }).click();
  await expect(attendees.getByRole('button', { name: /Carla/ })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  await snap(page, '1-asistentes');
  await page.getByRole('button', { name: 'Empezar día de juego' }).click();

  // Sin juegos todavía: se crea uno por puntos y empieza la partida.
  await expect(page.getByRole('heading', { name: '¿A qué jugáis?' })).toBeVisible();
  await page.getByLabel('Nombre del juego').fill('Catán');
  await page.getByRole('button', { name: 'Crear y jugar' }).click();

  await expect(page.getByRole('heading', { name: 'Catán · partida 1' })).toBeVisible();
  await expect(page.getByLabel('Carla')).toHaveCount(0);
  await page.getByLabel('Ana').fill('7');
  await page.getByLabel('Berto').fill('3');
  await page.getByRole('button', { name: 'Apuntar ronda' }).click();
  await expect(page.getByRole('heading', { name: 'Ronda 2' })).toBeVisible();
  await page.getByLabel('Berto').fill('9');
  await page.getByRole('button', { name: 'Apuntar ronda' }).click();
  await expect(page.locator('.tracker-sheet-total')).toContainText('12');
  await snap(page, '2-hoja-puntos');

  await page.getByRole('button', { name: 'Terminar partida' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Terminar partida' }).click();
  await expect(page.getByRole('heading', { name: 'Partida terminada' })).toBeVisible();
  await expect(page.locator('.tracker-result-winner')).toHaveText('Gana Berto');
  await snap(page, '3-resultado');

  // Otra partida, ahora a un juego por victorias.
  await page.getByRole('button', { name: 'Otra partida' }).click();
  await page.getByRole('button', { name: 'Otro juego nuevo' }).click();
  await page.getByLabel('Nombre del juego').fill('Mus');
  await page.getByRole('button', { name: 'Victorias por ronda' }).click();
  await page.getByRole('button', { name: 'Crear y jugar' }).click();

  await expect(page.getByRole('heading', { name: 'Mus · partida 2' })).toBeVisible();
  await page.getByRole('button', { name: 'Gana Ana' }).click();
  await expect(page.getByRole('heading', { name: 'Ronda 2' })).toBeVisible();
  await page.getByRole('button', { name: 'Gana Ana' }).click();
  await expect(page.locator('.tracker-sheet-total')).toContainText('Ganadas20');
  await snap(page, '4-hoja-victorias');

  // El inicio cuenta el día en curso y lleva de vuelta a la partida.
  await nav.getByRole('link', { name: 'Inicio' }).click();
  await expect(page.getByText(/Jugando a Mus · partida 2, 2 rondas./)).toBeVisible();
  await page.getByRole('link', { name: 'Ir a la partida' }).click();
  await expect(page.getByRole('heading', { name: 'Mus · partida 2' })).toBeVisible();

  // En el histórico queda el día con sus partidas; el dueño puede corregir rondas cerradas.
  await nav.getByRole('link', { name: 'Histórico' }).click();
  await expect(page).toHaveURL(`${ORIGIN}/historico`);
  const history = page.getByRole('region', { name: 'Días de juego' });
  await expect(history.getByText('Vinieron Ana, Berto')).toBeVisible();
  await expect(history.getByRole('button', { name: /Mus · partida 2/ })).toContainText('En juego');
  await history.getByRole('button', { name: /Catán · partida 1/ }).click();
  await expect(history.getByRole('table', { name: 'Hoja de la partida 1 de Catán' })).toBeVisible();
  await expect(history.getByText('Gana Berto')).toBeVisible();
  await expect(history.getByRole('button', { name: /Corregir/ })).toHaveCount(2);
  await history.getByRole('button', { name: 'Volver al histórico' }).scrollIntoViewIfNeeded();
  await snap(page, '5-historico');
});
