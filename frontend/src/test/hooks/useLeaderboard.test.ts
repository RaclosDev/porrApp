import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLeaderboard } from '../../hooks/useLeaderboard';
import * as AppContextModule from '../../context/AppContext';
import html2canvas from 'html2canvas';

vi.mock('html2canvas', () => ({ default: vi.fn() }));

vi.mock('../../context/AppContext', () => ({
  useAppContext: vi.fn(),
}));

const originalCreateObjectURL = URL.createObjectURL;

// El hook solo lee una parte del contexto; los mocks rellenan esa parte.
const mockAppContext = (value: Record<string, unknown>) =>
  vi
    .mocked(AppContextModule.useAppContext)
    .mockReturnValue(value as unknown as ReturnType<typeof AppContextModule.useAppContext>);

describe('useLeaderboard hook', () => {
  const mockLeaderboardData = [
    {
      id: 1,
      userId: 10,
      name: 'Carlos',
      predictionName: 'Porra Carlos',
      total: 100,
      matchPoints: 40,
      pending: false,
    },
    {
      id: 2,
      userId: 20,
      name: 'Elena',
      predictionName: 'Porra Elena',
      total: 120,
      matchPoints: 50,
      pending: false,
    },
    {
      id: 3,
      userId: 30,
      name: 'Moroso',
      predictionName: 'Porra Moroso',
      total: 150,
      matchPoints: 60,
      pending: true, // No pagado
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockAppContext({
      leaderboardData: mockLeaderboardData,
      loading: false,
      activeGroupName: 'Liga Amigos',
      activeGroupId: 10,
      activeGroupPichichi: true,
      activeGroupPoolFormat: 'FULL_BRACKET',
      activeGroupAdminId: 10,
      userId: 10,
      userName: 'Carlos',
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    if (originalCreateObjectURL) {
      Object.defineProperty(URL, 'createObjectURL', {
        configurable: true,
        value: originalCreateObjectURL,
      });
    } else {
      Reflect.deleteProperty(URL, 'createObjectURL');
    }
    document.body.replaceChildren();
  });

  it('ordena por total descendente y envía participantes pendientes de pago al final', () => {
    const { result } = renderHook(() => useLeaderboard());

    const { results } = result.current;
    expect(results).toHaveLength(3);

    // 1º Elena (120 pts, pagado)
    expect(results[0].name).toBe('Elena');
    expect(results[0].rank).toBe(1);
    expect(results[0].paid).toBe(true);

    // 2º Carlos (100 pts, pagado)
    expect(results[1].name).toBe('Carlos');
    expect(results[1].rank).toBe(2);
    expect(results[1].paid).toBe(true);

    // 3º Moroso (150 pts pero pending: true -> enviado al final sin rank)
    expect(results[2].name).toBe('Moroso');
    expect(results[2].paid).toBe(false);
  });

  it('permite cambiar la columna de ordenación', () => {
    const { result } = renderHook(() => useLeaderboard());

    act(() => {
      result.current.handleSort('matchPoints');
    });

    expect(result.current.sortColumn).toBe('matchPoints');
  });

  it('reconoce correctamente si el usuario activo es el administrador de la liga', () => {
    const { result } = renderHook(() => useLeaderboard());

    // activeGroupAdminId = 10, userId = 10 -> isLeagueAdmin = true
    expect(result.current.isLeagueAdmin).toBe(true);
  });

  it('carga los puntos de la jornada actual y permite navegar entre jornadas', () => {
    mockAppContext({
      leaderboardData: mockLeaderboardData,
      leaderboardMatchdays: [
        {
          label: 'Jornada 1',
          current: false,
          finished: true,
          matchCount: 2,
          pointsByPrediction: { 1: 1, 2: 2 },
        },
        {
          label: 'Jornada 2',
          current: true,
          finished: false,
          matchCount: 2,
          pointsByPrediction: { 1: 3, 2: 5 },
        },
      ],
      loading: false,
      activeGroupName: 'Liga Amigos',
      activeGroupId: 10,
      activeGroupPichichi: true,
      activeGroupPoolFormat: 'MATCH_DAY',
      activeGroupAdminId: 10,
      userId: 10,
      userName: 'Carlos',
    });

    const { result } = renderHook(() => useLeaderboard());

    expect(result.current.selectedMatchday).toBe('Jornada 2');
    expect(result.current.matchdayStats?.myPoints).toBe(3);
    expect(result.current.matchdayStats?.leader?.name).toBe('Elena');

    const carlos = result.current.results.find((row) => row.name === 'Carlos');
    expect(carlos?.points.matchday).toBe(3);

    act(() => {
      result.current.handleStepMatchday(-1);
    });

    expect(result.current.selectedMatchday).toBe('Jornada 1');

    const carlosJornada1 = result.current.results.find((row) => row.name === 'Carlos');
    expect(carlosJornada1?.points.matchday).toBe(1);
    const elenaJornada1 = result.current.results.find((row) => row.name === 'Elena');
    expect(elenaJornada1?.points.matchday).toBe(2);
  });

  it('al cambiar de jornada ordena por sus puntos y la general sigue disponible', () => {
    mockAppContext({
      leaderboardData: mockLeaderboardData,
      leaderboardMatchdays: [
        {
          label: 'Jornada 1',
          current: false,
          finished: true,
          matchCount: 2,
          pointsByPrediction: { 1: 6, 2: 2 },
        },
        {
          label: 'Jornada 2',
          current: true,
          finished: false,
          matchCount: 2,
          pointsByPrediction: { 1: 3, 2: 5 },
        },
      ],
      loading: false,
      activeGroupName: 'Liga Amigos',
      activeGroupId: 10,
      activeGroupPichichi: false,
      activeGroupPoolFormat: 'MATCH_DAY',
      activeGroupAdminId: 10,
      userId: 10,
      userName: 'Carlos',
    });

    const { result } = renderHook(() => useLeaderboard());
    const paidNames = () => result.current.validResults.map((row) => row.name);

    // Al entrar, la general: Elena (120) por delante de Carlos (100); Carlos va 2º en la jornada 2.
    expect(result.current.sortColumn).toBe('total');
    expect(paidNames()).toEqual(['Elena', 'Carlos']);
    expect(result.current.matchdayStats?.myRank).toBe(2);

    act(() => {
      result.current.handleStepMatchday(-1);
    });

    expect(result.current.sortColumn).toBe('matchday');
    expect(paidNames()).toEqual(['Carlos', 'Elena']);
    expect(result.current.validResults[0].rank).toBe(1);
    expect(result.current.matchdayStats?.myRank).toBe(1);
    // La imagen para compartir sigue con la general.
    expect(result.current.generalValidResults.map((row) => row.name)).toEqual(['Elena', 'Carlos']);

    act(() => {
      result.current.handleRankingView('general');
    });

    expect(paidNames()).toEqual(['Elena', 'Carlos']);
  });

  it('comparte la clasificación como archivo PNG sin convertirla a Base64', async () => {
    const template = document.createElement('div');
    template.id = 'share-image-template';
    document.body.append(template);

    const blob = new Blob(['png'], { type: 'image/png' });
    const canvas = document.createElement('canvas');
    const toBlob = vi.fn((callback: BlobCallback) => callback(blob));
    Object.defineProperty(canvas, 'toBlob', { configurable: true, value: toBlob });
    vi.mocked(html2canvas).mockResolvedValue(canvas);

    const canShare = vi.fn(() => true);
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: canShare });
    Object.defineProperty(navigator, 'share', { configurable: true, value: share });

    const { result } = renderHook(() => useLeaderboard());
    await act(async () => result.current.handleShare());

    expect(toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/png');
    expect(share).toHaveBeenCalledWith(
      expect.objectContaining({
        files: [expect.objectContaining({ name: 'Clasificacion_Porra.png' })],
      }),
    );
  });

  it('descarga la imagen si el navegador no permite compartir archivos', async () => {
    const template = document.createElement('div');
    template.id = 'share-image-template';
    document.body.append(template);

    const blob = new Blob(['png'], { type: 'image/png' });
    const canvas = document.createElement('canvas');
    Object.defineProperty(canvas, 'toBlob', {
      configurable: true,
      value: vi.fn((callback: BlobCallback) => callback(blob)),
    });
    vi.mocked(html2canvas).mockResolvedValue(canvas);

    Object.defineProperty(navigator, 'canShare', { configurable: true, value: vi.fn(() => false) });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const createObjectURL = vi.fn(() => 'blob:leaderboard');
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL });

    const { result } = renderHook(() => useLeaderboard());
    await act(async () => result.current.handleShare());

    expect(click).toHaveBeenCalledOnce();
    expect(createObjectURL).toHaveBeenCalledWith(blob);
  });

  it('descarga la imagen si falla la hoja nativa de compartir', async () => {
    const template = document.createElement('div');
    template.id = 'share-image-template';
    document.body.append(template);

    const blob = new Blob(['png'], { type: 'image/png' });
    const canvas = document.createElement('canvas');
    Object.defineProperty(canvas, 'toBlob', {
      configurable: true,
      value: vi.fn((callback: BlobCallback) => callback(blob)),
    });
    vi.mocked(html2canvas).mockResolvedValue(canvas);

    Object.defineProperty(navigator, 'canShare', { configurable: true, value: vi.fn(() => true) });
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: vi.fn().mockRejectedValue(new Error('No se pudo abrir el menú de compartir')),
    });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const createObjectURL = vi.fn(() => 'blob:leaderboard');
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL });

    const { result } = renderHook(() => useLeaderboard());
    await act(async () => result.current.handleShare());

    expect(click).toHaveBeenCalledOnce();
    expect(createObjectURL).toHaveBeenCalledWith(blob);
  });
});
