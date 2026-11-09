import { expect, test } from '@playwright/test';
import type { Group, TournamentFormat } from '../src/types/api';
import { withLeagueKind } from './leagueKind';

/** Liga de un torneo con grupos que no es el Mundial: lo dice el servidor, no su identificador. */
const euroLeague: Group = withLeagueKind('groupStage', {
  id: 1,
  name: 'Porra de la Eurocopa',
  joinCode: null,
  adminParticipantName: null,
  adminUserId: null,
  createdAt: null,
  competitionId: 20,
  competitionName: 'Eurocopa 2024',
  competitionExternalId: 'uefa.euro',
  groupTournament: true,
  formatType: 'TOURNAMENT',
  poolFormat: 'FULL_BRACKET',
  pichichi: false,
  lockDate: null,
  isLocked: false,
  rules: null,
  imageUrl: null,
});

const euroFormat: TournamentFormat = {
  groups: ['A', 'B', 'C', 'D', 'E', 'F'],
  bestThirds: 4,
  thirdPlaceMatch: false,
  firstRound: 'r16',
  firstKnockoutRound: [
    ['1B', '3ADEF'],
    ['1A', '2C'],
    ['1F', '3ABC'],
    ['2D', '2E'],
    ['1C', '3DEF'],
    ['2A', '2B'],
    ['1E', '3ABCD'],
    ['1D', '2F'],
  ],
};

test.use({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' });

test.beforeEach(async ({ page }) => {
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== 'http://127.0.0.1:4173') return route.abort();
    if (!url.pathname.startsWith('/api/')) return route.continue();

    const responses: Record<string, unknown> = {
      '/api/groups/1': euroLeague,
      '/api/groups/featured': euroLeague,
      '/api/competitions/20/tournament/format': euroFormat,
      '/api/competitions/20/tournament/standings': {},
      '/api/competitions/20/tournament/official-bracket': {},
      '/api/competitions/20/tournament/group-odds': {},
      '/api/matches/radar': { live: [], last: [], next: [] },
    };
    return route.fulfill({ json: responses[url.pathname] ?? [] });
  });
});

test('the official bracket of a tournament that starts in the round of 16 has no earlier round nor third place', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/demo');
  await expect(page.getByText('Modo demo:', { exact: true })).toBeVisible();
  await page.goto('/bracket');

  const rounds = page.locator('.bracket-round-title');
  await expect(rounds.first()).toBeVisible();
  // Octavos, cuartos y semis a cada lado: ni rastro de los dieciseisavos del Mundial.
  await expect(rounds.filter({ hasText: 'Octavos' })).toHaveCount(2);
  await expect(rounds.filter({ hasText: '16avos' })).toHaveCount(0);
  const board = page.locator('.bracket-paper-board');
  await expect(board.getByText('1º Grupo B', { exact: true })).toBeVisible();
  await expect(board.getByText('3º A/D/E/F', { exact: true })).toBeVisible();
  await expect(page.getByText('Tercer puesto', { exact: true })).toHaveCount(0);
  expect(errors).toEqual([]);
});
