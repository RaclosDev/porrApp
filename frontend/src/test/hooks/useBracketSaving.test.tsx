import { act, renderHook, waitFor } from '@testing-library/react';
import toast from 'react-hot-toast';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppContext, useBracketDraft } from '../../context/AppContext';
import { useTournamentData } from '../../context/leagueData';
import { useBracket } from '../../hooks/useBracket';
import * as api from '../../services/api';
import {
  defaultBracketState,
  getDefaultBracketState,
  type BracketState,
} from '../../store/useAppStore';
import type { GroupOdds, PredictionSummary, TournamentFormat } from '../../types/api';
import { buildR32FromGroups } from '../../utils/bracketDraft';
import { readGroupsDraft, readThirdsDraft } from '../../utils/drafts';
import { standing } from '../fixtures';

const navigate = vi.fn();

vi.mock('../../context/AppContext', () => ({ useAppContext: vi.fn(), useBracketDraft: vi.fn() }));
vi.mock('../../context/leagueData', () => ({ useTournamentData: vi.fn() }));
vi.mock('../../services/api', () => ({
  createPrediction: vi.fn(),
  fetchMyPredictions: vi.fn(),
  getAuthToken: vi.fn(),
}));
vi.mock('react-hot-toast', () => ({ default: { error: vi.fn(), success: vi.fn() } }));
vi.mock(import('react-router-dom'), async (original) => ({
  ...(await original()),
  useNavigate: () => navigate,
}));

/** Cuadro del Mundial relleno hasta el campeón. */
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
  state.champion = state.final.home;
  state.thirdPlaceWinner = state.thirdPlaceMatch.away;
  return state;
};

const saved = (fields: Partial<PredictionSummary>): PredictionSummary => ({
  key: 'p10',
  hash: 'p10',
  paid: true,
  participantName: 'Ana',
  userId: 7,
  predictionName: 'Porra guardada',
  groupId: 10,
  data: null,
  ...fields,
});

const groupNames = 'ABCDEFGHIJKL'.split('');
const odds = Object.fromEntries(
  groupNames.map((g) => [g, [1, 2, 3].map((pos) => ({ name: `${g}${pos}` }))]),
) as unknown as GroupOdds;

const wrapper = ({ children }: { children: ReactNode }) => <MemoryRouter>{children}</MemoryRouter>;

let context: Record<string, unknown>;
let tournament: Record<string, unknown>;
const setBracketState = vi.fn();
const setTopScorer = vi.fn();
const setUserName = vi.fn();
const fetchData = vi.fn();

const lastBracket = () =>
  setBracketState.mock.calls[setBracketState.mock.calls.length - 1][0] as BracketState;

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  context = {
    bracketState: completedBracket(),
    setBracketState,
    userName: 'Ana',
    setUserName,
    userId: '7',
    topScorer: 'Mbappé',
    setTopScorer,
    isAuthenticated: true,
    activeGroupId: '10',
    fetchData,
    activeGroupPoolFormat: 'FULL_BRACKET',
    activeGroupPichichi: true,
    activeGroupIsLocked: false,
    activeGroupLockDate: null,
    participantsHashes: [],
  };
  tournament = { groupOdds: {}, groupStandings: {} };
  vi.mocked(useAppContext).mockImplementation(
    () => context as unknown as ReturnType<typeof useAppContext>,
  );
  vi.mocked(useBracketDraft).mockImplementation(
    () => context as unknown as ReturnType<typeof useBracketDraft>,
  );
  vi.mocked(useTournamentData).mockImplementation(
    () => tournament as unknown as ReturnType<typeof useTournamentData>,
  );
  vi.mocked(api.getAuthToken).mockReturnValue(null);
  vi.mocked(api.fetchMyPredictions).mockResolvedValue([]);
  vi.mocked(api.createPrediction).mockResolvedValue(undefined as never);
});

afterEach(() => {
  vi.restoreAllMocks();
});

const editor = () => renderHook(() => useBracket(), { wrapper });

/** Editor con la porra ya nombrada, lista para guardar. */
const namedEditor = () => {
  const hook = editor();
  act(() => hook.result.current.setPredictionName('Mi porra'));
  return hook;
};

describe('useBracket: guardar la porra', () => {
  it('envía el cuadro a la liga, avisa y deja de marcar cambios sin guardar', async () => {
    const { result } = namedEditor();
    expect(result.current.hasUnsavedChanges).toBe(true);

    await act(() => result.current.generatePredictionData());

    expect(api.createPrediction).toHaveBeenCalledTimes(1);
    const [payload, groupId] = vi.mocked(api.createPrediction).mock.calls[0];
    expect(groupId).toBe('10');
    expect(payload).toMatchObject({
      user: 'Ana',
      prediction: 'Mi porra',
      scorer: 'Mbappé',
      champion: 'left0',
      final: ['left0', 'right0'],
      thirdPlaceWinner: 'right8',
    });
    expect(toast.success).toHaveBeenCalledWith('Porra guardada.');
    expect(fetchData).toHaveBeenCalledTimes(1);
    expect(result.current.hasUnsavedChanges).toBe(false);
  });

  it('no envía nada sin nombre de porra', async () => {
    const { result } = editor();
    act(() => result.current.setPredictionName('   '));

    await act(() => result.current.generatePredictionData());

    expect(toast.error).toHaveBeenCalledWith('Ponle nombre a tu porra.');
    expect(api.createPrediction).not.toHaveBeenCalled();
  });

  it('a un invitado le exige su nombre y el cuadro completo hasta el campeón', async () => {
    context.isAuthenticated = false;
    context.bracketState = { ...completedBracket(), champion: null };
    const { result } = namedEditor();

    await act(() => result.current.generatePredictionData());

    expect(toast.error).toHaveBeenCalledWith(
      'Pon tu nombre y completa el cuadro hasta el campeón.',
    );
    expect(api.createPrediction).not.toHaveBeenCalled();
  });

  it('con sesión deja guardar un cuadro a medias', async () => {
    context.bracketState = { ...completedBracket(), champion: null };
    const { result } = namedEditor();

    await act(() => result.current.generatePredictionData());

    expect(vi.mocked(api.createPrediction).mock.calls[0][0].champion).toBeNull();
  });

  it('pide el pichichi solo en las ligas que lo puntúan', async () => {
    context.topScorer = '';
    const { result, rerender } = namedEditor();

    await act(() => result.current.generatePredictionData());
    expect(toast.error).toHaveBeenCalledWith('Falta el pichichi.');
    expect(api.createPrediction).not.toHaveBeenCalled();

    context = { ...context, activeGroupPichichi: false };
    rerender();
    await act(() => result.current.generatePredictionData());
    expect(api.createPrediction).toHaveBeenCalledTimes(1);
  });

  it('en una liga solo de eliminatorias exige todos los equipos de la primera ronda', async () => {
    const bracket = completedBracket();
    bracket.r32.left[0].away = { name: '3º A/B/C/D/F' };
    context.bracketState = bracket;
    context.activeGroupPoolFormat = 'KNOCKOUTS_ONLY';
    const { result } = namedEditor();

    await act(() => result.current.generatePredictionData());

    expect(toast.error).toHaveBeenCalledWith('Rellena todos los equipos de la primera ronda.');
    expect(api.createPrediction).not.toHaveBeenCalled();
  });

  it('una liga solo de eliminatorias no envía grupos ni terceros', async () => {
    context.activeGroupPoolFormat = 'KNOCKOUTS_ONLY';
    localStorage.setItem(
      'draft_groups_u7_g10',
      JSON.stringify({ A: { first: 'A1', second: 'A2', third: 'A3' } }),
    );
    localStorage.setItem('draft_advancing_u7_g10', JSON.stringify(['A3']));
    const { result } = namedEditor();

    await act(() => result.current.generatePredictionData());

    expect(vi.mocked(api.createPrediction).mock.calls[0][0]).toMatchObject({
      groups: {},
      thirds: [],
    });
  });

  it('envía los grupos y terceros del borrador en una liga de cuadro completo', async () => {
    localStorage.setItem(
      'draft_groups_u7_g10',
      JSON.stringify({ A: { first: 'A1', second: 'A2', third: 'A3' } }),
    );
    localStorage.setItem('draft_advancing_u7_g10', JSON.stringify(['A3']));
    const { result } = namedEditor();

    await act(() => result.current.generatePredictionData());

    expect(vi.mocked(api.createPrediction).mock.calls[0][0]).toMatchObject({
      groups: { A: ['A1', 'A2', 'A3'] },
      thirds: ['A3'],
    });
  });

  it('no envía nada con el plazo de la liga cerrado', async () => {
    context.activeGroupIsLocked = true;
    const { result } = namedEditor();

    await act(() => result.current.generatePredictionData());

    expect(toast.error).toHaveBeenCalledWith(
      'El plazo para enviar o modificar porras en esta liga ha finalizado.',
    );
    expect(api.createPrediction).not.toHaveBeenCalled();
  });

  it('si el servidor la rechaza enseña su motivo y mantiene los cambios como pendientes', async () => {
    vi.mocked(api.createPrediction).mockRejectedValue(new Error('La liga está completa'));
    const { result } = namedEditor();

    await act(() => result.current.generatePredictionData());

    expect(toast.error).toHaveBeenCalledWith('La liga está completa');
    expect(toast.success).not.toHaveBeenCalled();
    expect(fetchData).not.toHaveBeenCalled();
    expect(result.current.hasUnsavedChanges).toBe(true);
  });

  it('sin motivo del servidor da un mensaje genérico', async () => {
    vi.mocked(api.createPrediction).mockRejectedValue('fallo');
    const { result } = namedEditor();

    await act(() => result.current.generatePredictionData());

    expect(toast.error).toHaveBeenCalledWith('No se pudo guardar la porra. Inténtalo de nuevo.');
  });
});

describe('useBracket: estado del editor', () => {
  it('sin liga ni sesión manda a elegir o crear una liga', () => {
    context.activeGroupId = '';
    context.isAuthenticated = false;

    editor();

    expect(toast.error).toHaveBeenCalledWith(
      'Debes seleccionar o crear una liga antes de rellenar tu porra.',
    );
    expect(navigate).toHaveBeenCalledWith('/mis-ligas');
  });

  it('con sesión no redirige aunque todavía no haya liga elegida', () => {
    context.activeGroupId = '';

    editor();

    expect(navigate).not.toHaveBeenCalled();
    expect(api.fetchMyPredictions).not.toHaveBeenCalled();
  });

  it('marca cambios sin guardar al tocar el pichichi o un cruce', () => {
    const { result } = editor();
    expect(result.current.hasUnsavedChanges).toBe(false);

    act(() => result.current.setTopScorer('Lamine Yamal'));

    expect(setTopScorer).toHaveBeenCalledWith('Lamine Yamal');
    expect(result.current.hasUnsavedChanges).toBe(true);
  });

  it('cambiar un equipo de la primera ronda actualiza el cuadro y lo marca sin guardar', () => {
    const { result } = editor();

    act(() => result.current.setR32Team('Uruguay', 'left', 0, true));

    expect(lastBracket().r32.left[0].home?.name).toBe('Uruguay');
    expect(result.current.hasUnsavedChanges).toBe(true);
  });

  it('en una liga solo de eliminatorias coloca a los clasificados que ya son seguros', () => {
    context.bracketState = defaultBracketState;
    context.activeGroupPoolFormat = 'KNOCKOUTS_ONLY';
    tournament = {
      groupOdds: { E: [{ name: 'Bosnia y Her.' }, { name: 'Italia' }] },
      groupStandings: {
        E: { 'Bosnia y Her': standing({ status: 1 }), Italia: standing({ status: 0 }) },
      },
    };

    const { result } = editor();

    const names = [...lastBracket().r32.left, ...lastBracket().r32.right].flatMap((match) => [
      match.home?.name,
      match.away?.name,
    ]);
    expect(names).toContain('Bosnia y Her.');
    expect(names).not.toContain('1º Grupo E');
    expect(names).toContain('2º Grupo E');
    expect(result.current.isKnockoutsOnly).toBe(true);
    expect(result.current.isInitialState).toBe(false);
  });

  it('en una liga de cuadro completo no adelanta clasificados: los elige el usuario', () => {
    context.bracketState = defaultBracketState;
    tournament = {
      groupOdds: { E: [{ name: 'Italia' }] },
      groupStandings: { E: { Italia: standing({ status: 1 }) } },
    };

    const { result } = editor();

    expect(setBracketState).not.toHaveBeenCalled();
    expect(result.current.isInitialState).toBe(true);
    expect(result.current.allTeams).toEqual(['Italia']);
    expect(result.current.getTeamStatus('Italia')).toBe(1);
    expect(result.current.getTeamStatus('Francia')).toBe(0);
    expect(result.current.getTeamStatus(null)).toBe(0);
  });

  it('cambia el cuadro vacío por el del torneo de la liga en cuanto conoce su forma', () => {
    const format: TournamentFormat = {
      groups: ['A', 'B'],
      bestThirds: 0,
      thirdPlaceMatch: false,
      firstRound: 'sf',
      firstKnockoutRound: [
        ['1A', '2B'],
        ['1B', '2A'],
      ],
    };
    context.bracketState = defaultBracketState;
    tournament = { groupOdds: {}, groupStandings: {}, format, loadingFormat: true };
    const { result, rerender } = editor();

    // Mientras se carga la forma no se toca el cuadro ni se vuelca la porra guardada.
    expect(result.current.shapePending).toBe(true);
    expect(setBracketState).not.toHaveBeenCalled();
    expect(api.fetchMyPredictions).not.toHaveBeenCalled();

    tournament = { ...tournament, loadingFormat: false };
    rerender();

    expect(setBracketState).toHaveBeenCalledWith(getDefaultBracketState(2, format));
    expect(api.fetchMyPredictions).toHaveBeenCalledTimes(1);
  });

  it('no cambia de forma un cuadro que el usuario ya ha empezado a rellenar', () => {
    const format: TournamentFormat = {
      groups: ['A', 'B'],
      bestThirds: 0,
      thirdPlaceMatch: false,
      firstRound: 'sf',
      firstKnockoutRound: [
        ['1A', '2B'],
        ['1B', '2A'],
      ],
    };
    tournament = { groupOdds: {}, groupStandings: {}, format };

    const { result } = editor();

    expect(setBracketState).not.toHaveBeenCalled();
    expect(result.current.shapePending).toBe(true);
  });

  it('al cambiar de liga olvida el nombre y la porra guardada de la anterior', async () => {
    vi.mocked(api.fetchMyPredictions).mockResolvedValue([saved({})]);
    const { result, rerender } = editor();
    await waitFor(() => expect(result.current.savedPredictionId).toBe('p10'));
    expect(result.current.predictionName).toBe('Porra guardada');

    context = { ...context, activeGroupId: '11' };
    rerender();

    expect(result.current.savedPredictionId).toBeNull();
    expect(result.current.predictionName).toBe('');
    expect(result.current.hasUnsavedChanges).toBe(false);
  });
});

describe('useBracket: porra guardada de la liga', () => {
  it('deduce grupos y terceros de una porra que solo guardó los dieciseisavos', async () => {
    const groups = Object.fromEntries(groupNames.map((g) => [g, [`${g}1`, `${g}2`, `${g}3`]]));
    const thirds = groupNames.slice(0, 8).map((g) => `${g}3`);
    const r32 = buildR32FromGroups(groups, thirds, 2) as string[][];
    context.bracketState = defaultBracketState;
    tournament = { groupOdds: odds, groupStandings: {} };
    vi.mocked(api.fetchMyPredictions).mockResolvedValue([
      saved({ data: { topologyVersion: 2, r32 } }),
    ]);

    const { result } = editor();
    await waitFor(() => expect(result.current.savedGroupsDraft.A).toBeDefined());

    expect(result.current.savedGroupsDraft.A).toEqual({ first: 'A1', second: 'A2', third: 'A3' });
    expect(readGroupsDraft('10', '7').K).toMatchObject({ first: 'K1', second: 'K2' });
    expect([...(readThirdsDraft('10', '7') ?? [])].sort()).toEqual(thirds);
    expect([...(result.current.savedThirdsDraft ?? [])].sort()).toEqual(thirds);
    expect(lastBracket().r32.left[0].home?.name).toBe('E1');
  });

  it('una porra aún sin cuadro solo recupera su nombre', async () => {
    context.bracketState = defaultBracketState;
    context.userName = '';
    context.topScorer = '';
    vi.mocked(api.fetchMyPredictions).mockResolvedValue([saved({ participantName: 'Ana M.' })]);

    const { result } = editor();
    await waitFor(() => expect(result.current.savedPredictionId).toBe('p10'));

    expect(setUserName).toHaveBeenCalledWith('Ana M.');
    expect(result.current.predictionName).toBe('Porra guardada');
    expect(setBracketState).not.toHaveBeenCalled();
    expect(setTopScorer).not.toHaveBeenCalled();
  });

  it('no cambia el nombre ni el pichichi que el usuario ya tiene puestos', async () => {
    context.bracketState = defaultBracketState;
    vi.mocked(api.fetchMyPredictions).mockResolvedValue([
      saved({ participantName: 'Otro nombre', data: { scorer: 'Haaland', champion: 'Brasil' } }),
    ]);

    const { result } = editor();
    await waitFor(() => expect(result.current.savedPredictionId).toBe('p10'));

    expect(setUserName).not.toHaveBeenCalled();
    expect(setTopScorer).not.toHaveBeenCalled();
  });

  it('a un invitado con token le encuentra su porra por el nombre, sin distinguir mayúsculas', async () => {
    context.isAuthenticated = false;
    context.userId = '';
    context.userName = 'ana';
    context.participantsHashes = [
      saved({ key: 'ana', userId: null, groupId: null }),
      saved({ key: 'registrada', userId: 3, groupId: null }),
      saved({ key: 'luis', userId: null, groupId: null, participantName: 'Luis' }),
    ];
    vi.mocked(api.getAuthToken).mockReturnValue('jwt');

    const { result } = editor();

    await waitFor(() => expect(result.current.savedPredictionId).toBe('ana'));
  });

  it('con dos invitados del mismo nombre no adivina cuál es su porra', async () => {
    context.isAuthenticated = false;
    context.userId = '';
    context.participantsHashes = [
      saved({ key: 'ana-1', userId: null, groupId: null }),
      saved({ key: 'ana-2', userId: null, groupId: null }),
    ];
    vi.mocked(api.getAuthToken).mockReturnValue('jwt');

    const { result } = editor();
    await waitFor(() => expect(api.fetchMyPredictions).toHaveBeenCalled());
    await act(async () => {});

    expect(result.current.savedPredictionId).toBeNull();
  });

  it('si falla la petición lo intenta de nuevo en vez de dar la liga por volcada', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    context.bracketState = defaultBracketState;
    vi.mocked(api.fetchMyPredictions).mockRejectedValueOnce(new Error('sin red'));
    vi.mocked(api.fetchMyPredictions).mockResolvedValue([saved({ data: { champion: 'Brasil' } })]);
    const { result, rerender } = editor();
    await waitFor(() => expect(logged).toHaveBeenCalled());
    expect(result.current.savedPredictionId).toBeNull();

    // Llega la sesión confirmada: el efecto vuelve a ejecutarse para la misma liga.
    context = { ...context, setTopScorer: vi.fn() };
    rerender();

    await waitFor(() => expect(result.current.savedPredictionId).toBe('p10'));
    expect(api.fetchMyPredictions).toHaveBeenCalledTimes(2);
    expect(lastBracket().champion?.name).toBe('Brasil');
  });
});
