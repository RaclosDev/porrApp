import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { expect, it, vi } from 'vitest';
import { useScoringEditor } from '../../hooks/useScoringEditor';
import { fetchLeagueScoring, updateLeagueScoring } from '../../services/api';
import { leagueScoring, DEFAULT_SCORING } from '../fixtures';
import type { LeagueScoring } from '../../types/api';
import type { ReactNode } from 'react';

vi.mock('../../services/api', () => ({
  fetchLeagueScoring: vi.fn(),
  updateLeagueScoring: vi.fn(),
}));

it('keeps a newer scoring draft when an older request resolves', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  vi.mocked(fetchLeagueScoring).mockResolvedValue(leagueScoring());
  let finish!: (saved: LeagueScoring) => void;
  vi.mocked(updateLeagueScoring).mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(() => useScoringEditor(1, true), { wrapper });
  await waitFor(() => expect(result.current.draft).not.toBeNull());
  act(() => result.current.setValue('championPoints', '300'));
  let saving!: Promise<LeagueScoring>;
  act(() => {
    saving = result.current.save();
  });
  await waitFor(() => expect(result.current.isSaving).toBe(true));
  act(() => result.current.setValue('championPoints', '400'));
  await act(async () => {
    finish(leagueScoring({ rules: { ...DEFAULT_SCORING, championPoints: 300 } }));
    await saving;
  });
  expect(result.current.draft?.championPoints).toBe('400');
  expect(result.current.isDirty).toBe(true);
});

/** Reglas de una liga creada con los valores del Mundial 2026, antes de los generales. */
const DEFAULT_THIRD_PLACE_RULES = {
  ...DEFAULT_SCORING,
  groupQualifierPoints: 10,
  groupExactPositionPoints: 10,
  roundOf32Points: 25,
  roundOf16Points: 30,
  quarterFinalPoints: 40,
  semiFinalPoints: 60,
  championPoints: 200,
  runnerUpPoints: 150,
  thirdPlacePoints: 100,
  fourthPlacePoints: 75,
  topScorerPoints: 200,
};

async function editorFor(scoring: LeagueScoring) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  vi.mocked(fetchLeagueScoring).mockResolvedValue(scoring);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(() => useScoringEditor(1, true), { wrapper });
  await waitFor(() => expect(result.current.draft).not.toBeNull());
  return result;
}

it('una liga por jornadas anterior no cuenta como personalizada por reglas que no usa', async () => {
  const result = await editorFor(
    leagueScoring({ poolFormat: 'MATCH_DAY', pichichi: false, rules: DEFAULT_THIRD_PLACE_RULES }),
  );

  // Sus tres reglas (resultado, signo y diferencia) son las de por defecto: no hay nada que restaurar.
  expect(result.current.isDefault).toBe(true);
  expect(result.current.isDirty).toBe(false);
  // Lo guardado se enseña tal cual, sin pasar a los valores generales.
  expect(result.current.draft?.championPoints).toBe('200');
});

it('un cuadro anterior conserva sus valores hasta que su administrador restaura los de por defecto', async () => {
  const result = await editorFor(
    leagueScoring({ rules: { ...DEFAULT_THIRD_PLACE_RULES, nbaFinalsPoints: 77 } }),
  );
  expect(result.current.draft?.championPoints).toBe('200');
  expect(result.current.isDefault).toBe(false);

  act(() => result.current.restoreDefaults());

  expect(result.current.draft).toMatchObject({
    groupQualifierPoints: '5',
    roundOf32Points: '10',
    semiFinalPoints: '30',
    championPoints: '50',
    runnerUpPoints: '30',
    topScorerPoints: '30',
  });
  // Las reglas de otros deportes no son de esta liga: se quedan como estaban.
  expect(result.current.draft?.nbaFinalsPoints).toBe('77');
  expect(result.current.isDefault).toBe(true);
  expect(result.current.isDirty).toBe(true);
});
