import { act, renderHook, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useBracket } from '../../hooks/useBracket';
import { useAppContext } from '../../context/AppContext';
import * as api from '../../services/api';
import {
  defaultBracketState,
  getDefaultBracketState,
  type BracketState,
} from '../../store/useAppStore';
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

  it('keeps the historical layout when restarting an unversioned prediction from groups', () => {
    const scroll = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    context.bracketState = { ...getDefaultBracketState(1), topologyVersion: undefined };
    vi.mocked(api.fetchMyPredictions).mockResolvedValue([]);
    const { result } = renderHook(() => useBracket(), { wrapper });
    act(() => result.current.handleResetToGroupStage());
    const reset = setBracketState.mock.calls[
      setBracketState.mock.calls.length - 1
    ][0] as BracketState;
    expect(reset.topologyVersion).toBe(1);
    expect(reset.r32.left[3].home?.name).toBe('1º Grupo C');
    expect(reset.r32.right[0].home?.name).toBe('2º Grupo K');
    scroll.mockRestore();
  });

  it.each([1, 2] as const)(
    'applies group positions and third-place slots using version %s',
    (version) => {
      const scroll = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
      context.bracketState = getDefaultBracketState(version);
      vi.mocked(api.fetchMyPredictions).mockResolvedValue([]);
      const { result } = renderHook(() => useBracket(), { wrapper });
      const groups = Object.fromEntries(
        'ABCDEFGHIJKL'
          .split('')
          .map((g) => [g, { first: `${g}1`, second: `${g}2`, third: `${g}3` }]),
      );
      const thirds = 'ABCDEFGH'.split('').map((g) => `${g}3`);
      act(() => result.current.handleGroupStageComplete(groups, thirds));
      const state = setBracketState.mock.calls[
        setBracketState.mock.calls.length - 1
      ][0] as BracketState;
      expect(state.topologyVersion).toBe(version);
      const a = version === 2 ? state.r32.right[2] : state.r32.left[6];
      const d = version === 2 ? state.r32.left[6] : state.r32.right[2];
      expect(a.home?.name).toBe('A1');
      expect(d.home?.name).toBe('D1');
      expect(['C3', 'E3', 'F3', 'H3']).toContain(a.away?.name);
      expect(['B3', 'E3', 'F3']).toContain(d.away?.name);
      scroll.mockRestore();
    },
  );

  it.each([undefined, 1, 2] as const)(
    'saves and hydrates topology %s without reinterpreting its branches',
    async (version) => {
      const state = completedBracket();
      state.topologyVersion = version;
      context.bracketState = state;
      context.activeGroupPichichi = false;
      vi.mocked(api.fetchMyPredictions).mockResolvedValue([]);
      const { result } = renderHook(() => useBracket(), { wrapper });
      act(() => result.current.setPredictionName('Versionada'));
      await act(() => result.current.generatePredictionData());
      const payload = vi.mocked(api.createPrediction).mock.calls[0][0];
      expect(payload.topologyVersion).toBe(version ?? 1);
      expect(payload.r32?.[0]).toEqual(['left0', 'left1']);
      expect(payload.r32?.[8]).toEqual(['right0', 'right1']);
    },
  );

  it.each([undefined, 2] as const)(
    'hydrates saved version %s without defaulting to the newest version',
    async (version) => {
      const saved = prediction(10, 'Brasil');
      saved.data!.topologyVersion = version;
      vi.mocked(api.fetchMyPredictions).mockResolvedValue([saved]);
      renderHook(() => useBracket(), { wrapper });
      await waitFor(() => expect(setBracketState).toHaveBeenCalledTimes(1));
      expect(setBracketState.mock.calls[0][0].topologyVersion).toBe(version ?? 1);
    },
  );

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
