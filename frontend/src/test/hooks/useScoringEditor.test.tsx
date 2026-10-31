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
