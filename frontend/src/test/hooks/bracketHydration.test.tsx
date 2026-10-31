import { act, renderHook, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useBracket } from '../../hooks/useBracket';
import { useAppContext } from '../../context/AppContext';
import * as api from '../../services/api';
import { defaultBracketState, type BracketState } from '../../store/useAppStore';
import type { PredictionSummary } from '../../types/api';
import { readJsonDraft, writeDraft } from '../../utils/drafts';

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

const completedBracket = (): BracketState => {
  const state: BracketState = structuredClone(defaultBracketState);
  for (const side of ['left', 'right'] as const) {
    state.r32[side].forEach((match, i) => {
      match.home = { name: `${side}${i * 2}` };
      match.away = { name: `${side}${i * 2 + 1}` };
    });
    const rounds = [state.r32, state.r16, state.qf, state.sf];
    for (let round = 1; round < rounds.length; round++) {
      rounds[round][side].forEach((match, i) => {
        match.home = rounds[round - 1][side][i * 2].home;
        match.away = rounds[round - 1][side][i * 2 + 1].home;
      });
    }
  }
  state.final = { id: 'FINAL', home: state.sf.left[0].home, away: state.sf.right[0].home };
  state.thirdPlaceMatch = {
    id: 'THIRD',
    home: state.sf.left[0].away,
    away: state.sf.right[0].away,
  };
  state.champion = state.final.away;
  state.thirdPlaceWinner = state.thirdPlaceMatch.away;
  return state;
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

  it('no importa la única predicción si pertenece a otra liga', async () => {
    vi.mocked(api.fetchMyPredictions).mockResolvedValue([prediction(20, 'Brasil')]);
    const { result } = renderHook(() => useBracket(), { wrapper });
    await act(async () => {});
    expect(result.current.savedPredictionId).toBeNull();
    expect(result.current.predictionName).toBe('');
    expect(setBracketState).not.toHaveBeenCalled();
    expect(setTopScorer).not.toHaveBeenCalled();
    expect(readJsonDraft('groups', '10', '7')).toBeUndefined();
  });

  it('conserva la compatibilidad de la liga global con predicciones sin groupId', async () => {
    context.activeGroupId = '1';
    vi.mocked(api.fetchMyPredictions).mockResolvedValue([
      { ...prediction(1, 'Brasil'), groupId: null },
    ]);
    const { result } = renderHook(() => useBracket(), { wrapper });
    await waitFor(() => expect(result.current.savedPredictionId).toBe('p1'));
  });

  it('el fallback de participantes usa userId antes que un nombre compartido', async () => {
    context.participantsHashes = [
      { ...prediction(10, 'Francia'), key: 'ajena', userId: 8, participantName: 'Ana' },
      { ...prediction(10, 'Brasil'), key: 'propia', userId: 7, participantName: 'Ana' },
    ];
    vi.mocked(api.fetchMyPredictions).mockResolvedValue([]);
    const { result } = renderHook(() => useBracket(), { wrapper });
    await waitFor(() => expect(result.current.savedPredictionId).toBe('propia'));
  });

  it.each([false, true])(
    'respeta terceros vaciados antes de la respuesta remota (draft previo: %s)',
    async (beforeMount) => {
      const pending = deferred<PredictionSummary[]>();
      if (beforeMount) writeDraft('advancing', '10', '7', []);
      vi.mocked(api.fetchMyPredictions).mockReturnValue(pending.promise);
      const { result } = renderHook(() => useBracket(), { wrapper });
      if (!beforeMount) writeDraft('advancing', '10', '7', []);
      await act(async () =>
        pending.resolve([{ ...prediction(10, 'Brasil'), data: { thirds: ['Chequia'] } }]),
      );
      expect(readJsonDraft('advancing', '10', '7')).toEqual([]);
      expect(result.current.savedThirdsDraft ?? []).toEqual([]);
    },
  );

  it('hidrata terceros remotos cuando no existe un borrador local', async () => {
    vi.mocked(api.fetchMyPredictions).mockResolvedValue([
      { ...prediction(10, 'Brasil'), data: { thirds: ['Chequia'] } },
    ]);
    const { result } = renderHook(() => useBracket(), { wrapper });
    await waitFor(() => expect(result.current.savedThirdsDraft).toEqual(['Chequia']));
    expect(readJsonDraft('advancing', '10', '7')).toEqual(['Chequia']);
  });

  it('no recupera terceros del cuadro cuando el borrador local está vaciado', async () => {
    context.bracketState = completedBracket();
    writeDraft('advancing', '10', '7', []);
    vi.mocked(api.fetchMyPredictions).mockResolvedValue([]);
    const { result } = renderHook(() => useBracket(), { wrapper });
    await act(async () => {});
    expect(readJsonDraft('advancing', '10', '7')).toEqual([]);
    expect(result.current.savedThirdsDraft).toEqual([]);
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

  it.each([0, 1, 2])(
    'cambiar el ganador de ronda %s limpia solo su camino posterior',
    async (round) => {
      const original = completedBracket();
      context.bracketState = original;
      vi.mocked(api.fetchMyPredictions).mockResolvedValue([]);
      const { result } = renderHook(() => useBracket(), { wrapper });
      await act(async () => {});
      const source = [original.r32, original.r16, original.qf][round].left[0];
      act(() => result.current.advanceTeam(source.away, 'left', round, 0));
      const next = setBracketState.mock.lastCall?.[0] as BracketState;
      expect([next.r16, next.qf, next.sf][round].left[0].home).toEqual(source.away);
      for (const downstream of [next.qf, next.sf].slice(round)) {
        expect(downstream.left[0].home).toBeNull();
      }
      expect(next.final?.home).toBeNull();
      expect(next.thirdPlaceMatch?.home).toBeNull();
      expect(next.champion).toEqual(original.champion);
      expect(next.thirdPlaceWinner).toEqual(original.thirdPlaceWinner);
      expect(next.r16.right).toEqual(original.r16.right);
      expect(next.sf.right).toEqual(original.sf.right);
      expect(original.final?.home?.name).toBe('left0');
    },
  );

  it('cambiar una semifinal actualiza final/tercero sin borrar el podio elegido de la otra rama', async () => {
    const original = completedBracket();
    context.bracketState = original;
    vi.mocked(api.fetchMyPredictions).mockResolvedValue([]);
    const { result } = renderHook(() => useBracket(), { wrapper });
    await act(async () => {});
    act(() => result.current.advanceTeam(original.sf.left[0].away, 'left', 3, 0));
    const next = setBracketState.mock.lastCall?.[0] as BracketState;
    expect(next.final?.home).toEqual(original.sf.left[0].away);
    expect(next.thirdPlaceMatch?.home).toEqual(original.sf.left[0].home);
    expect(next.champion).toEqual(original.champion);
    expect(next.thirdPlaceWinner).toEqual(original.thirdPlaceWinner);
  });

  it('cambiar un participante R32 elimina sus avances pero conserva al ganador si era el rival', async () => {
    const original = completedBracket();
    context.bracketState = original;
    vi.mocked(api.fetchMyPredictions).mockResolvedValue([]);
    const { result } = renderHook(() => useBracket(), { wrapper });
    await act(async () => {});
    act(() => result.current.setR32Team('Nuevo', 'left', 0, false));
    const losingSlot = setBracketState.mock.lastCall?.[0] as BracketState;
    expect(losingSlot.final).toEqual(original.final);
    act(() => result.current.setR32Team('Nuevo', 'left', 0, true));
    const winningSlot = setBracketState.mock.lastCall?.[0] as BracketState;
    expect(winningSlot.r16.left[0].home).toBeNull();
    expect(winningSlot.final?.home).toBeNull();
    expect(winningSlot.champion).toEqual(original.champion);
  });

  it('repetir la selección de semifinal conserva el podio completo', async () => {
    const original = completedBracket();
    context.bracketState = original;
    vi.mocked(api.fetchMyPredictions).mockResolvedValue([]);
    const { result } = renderHook(() => useBracket(), { wrapper });
    await act(async () => {});
    act(() => result.current.advanceTeam(original.sf.left[0].home, 'left', 3, 0));
    expect(setBracketState.mock.lastCall?.[0]).toEqual(original);
  });
});
