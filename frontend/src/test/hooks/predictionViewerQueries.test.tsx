import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { usePredictionViewerData } from '../../hooks/usePredictionViewerData';
import { queryKeys } from '../../services/queryKeys';
import * as api from '../../services/api';
import type { ParticipantScore, PredictionData } from '../../types/api';

vi.mock('../../services/api', () => ({
  fetchPrediction: vi.fn(),
  fetchOfficialBracket: vi.fn(),
  fetchPredictionScore: vi.fn(),
}));

const part = { user: 'Ana', r32: [] } as unknown as PredictionData;

describe('usePredictionViewerData con TanStack Query', () => {
  let client: QueryClient;
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const render = () =>
    renderHook(() => usePredictionViewerData('5', {}, [], {}, [], part), { wrapper });

  beforeEach(() => {
    vi.clearAllMocks();
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    vi.mocked(api.fetchOfficialBracket).mockResolvedValue({ r32: [] } as PredictionData);
    vi.mocked(api.fetchPredictionScore).mockResolvedValue({
      id: 5,
      total: 3,
      log: [],
    } as unknown as ParticipantScore);
  });

  it('vuelve a pedir el cuadro oficial y los puntos cuando se invalidan', async () => {
    const { result } = render();
    await waitFor(() => expect(result.current.points.total).toBe(3));
    expect(api.fetchOfficialBracket).toHaveBeenCalledTimes(1);
    expect(api.fetchPredictionScore).toHaveBeenCalledTimes(1);

    vi.mocked(api.fetchPredictionScore).mockResolvedValue({
      id: 5,
      total: 7,
      log: [],
    } as unknown as ParticipantScore);
    await act(async () => {
      await client.invalidateQueries({ queryKey: queryKeys.officialBracket() });
      await client.invalidateQueries({ queryKey: queryKeys.predictionScore() });
    });

    expect(api.fetchOfficialBracket).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(result.current.points.total).toBe(7));
  });

  it('reutiliza la caché entre visores en lugar de una caché de módulo', async () => {
    const first = render();
    await waitFor(() => expect(first.result.current.loading).toBe(false));
    first.unmount();
    const second = render();
    expect(second.result.current.loading).toBe(false);
    expect(api.fetchOfficialBracket).toHaveBeenCalledTimes(1);
  });

  it('usa un cuadro vacío si el oficial no se puede cargar', async () => {
    vi.mocked(api.fetchOfficialBracket).mockRejectedValue(new Error('caído'));
    const { result } = render();
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeNull();
  });
});
