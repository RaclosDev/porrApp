import { act, renderHook, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useBracket } from '../../hooks/useBracket';
import { useAppContext } from '../../context/AppContext';
import * as api from '../../services/api';
import { defaultBracketState, type BracketState } from '../../store/useAppStore';
import type { PredictionSummary } from '../../types/api';

vi.mock('../../context/AppContext', () => ({ useAppContext: vi.fn() }));
vi.mock('../../services/api', () => ({
  createPrediction: vi.fn(),
  fetchMyPredictions: vi.fn(),
  getAuthToken: () => 'jwt',
}));

const prediction = (groupId: number, champion: string) =>
  ({
    key: `p${groupId}`,
    groupId,
    predictionName: `Porra ${groupId}`,
    data: { champion, scorer: 'Goleador' },
  }) as unknown as PredictionSummary;

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
};

describe('useBracket: hidratación desde fetchMyPredictions', () => {
  let context: Record<string, unknown>;
  const setBracketState = vi.fn();
  const setTopScorer = vi.fn();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter>{children}</MemoryRouter>
  );

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    context = {
      bracketState: defaultBracketState,
      setBracketState,
      userName: 'Ana',
      setUserName: vi.fn(),
      userId: '7',
      topScorer: '',
      setTopScorer,
      isAuthenticated: true,
      activeGroupId: '10',
      fetchData: vi.fn(),
      groupOdds: {},
      activeGroupPoolFormat: 'FULL_BRACKET',
      officialPoints: {},
      activeGroupPichichi: true,
      participantsHashes: [],
    };
    vi.mocked(useAppContext).mockImplementation(
      () => context as unknown as ReturnType<typeof useAppContext>,
    );
  });

  const champion = (call: unknown[]) => (call[0] as BracketState).champion?.name;

  it('hidrata una sola vez por liga aunque cambien sus dependencias', async () => {
    vi.mocked(api.fetchMyPredictions).mockResolvedValue([prediction(10, 'Brasil')]);
    const { result, rerender } = renderHook(() => useBracket(), { wrapper });

    await waitFor(() => expect(setBracketState).toHaveBeenCalledTimes(1));
    expect(champion(setBracketState.mock.calls[0])).toBe('Brasil');
    expect(result.current.predictionName).toBe('Porra 10');

    // El usuario edita y llegan datos nuevos del contexto: no se vuelve a pedir ni a pisar.
    context = {
      ...context,
      bracketState: { ...defaultBracketState, champion: { name: 'España' } },
      participantsHashes: [{ key: 'x' }],
      groupOdds: { A: [] },
    };
    rerender();
    await act(async () => {});
    expect(api.fetchMyPredictions).toHaveBeenCalledTimes(1);
    expect(setBracketState).toHaveBeenCalledTimes(1);
  });

  it('no pisa un borrador local distinto', async () => {
    context.bracketState = { ...defaultBracketState, champion: { name: 'España' } };
    vi.mocked(api.fetchMyPredictions).mockResolvedValue([prediction(10, 'Brasil')]);
    const { result } = renderHook(() => useBracket(), { wrapper });

    await waitFor(() => expect(result.current.savedPredictionId).toBe('p10'));
    expect(setBracketState).not.toHaveBeenCalled();
  });

  it('descarta la respuesta si la liga activa cambia mientras llega', async () => {
    const first = deferred<PredictionSummary[]>();
    vi.mocked(api.fetchMyPredictions).mockReturnValueOnce(first.promise).mockResolvedValueOnce([]);
    const { result, rerender } = renderHook(() => useBracket(), { wrapper });

    context = { ...context, activeGroupId: '20' };
    rerender();
    await act(async () => {
      first.resolve([prediction(10, 'Brasil'), prediction(30, 'Francia')]);
    });

    expect(api.fetchMyPredictions).toHaveBeenCalledTimes(2);
    expect(setBracketState).not.toHaveBeenCalled();
    expect(setTopScorer).not.toHaveBeenCalled();
    expect(result.current.predictionName).toBe('');
    expect(result.current.savedPredictionId).toBeNull();
  });

  it('vuelve a hidratar al entrar en otra liga', async () => {
    vi.mocked(api.fetchMyPredictions).mockResolvedValue([
      prediction(10, 'Brasil'),
      prediction(20, 'Francia'),
    ]);
    const { rerender } = renderHook(() => useBracket(), { wrapper });
    await waitFor(() => expect(setBracketState).toHaveBeenCalledTimes(1));

    context = { ...context, activeGroupId: '20' };
    rerender();
    await waitFor(() => expect(setBracketState).toHaveBeenCalledTimes(2));
    expect(champion(setBracketState.mock.calls[1])).toBe('Francia');
  });
});
