import { Component, type ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Bracket from '../../pages/Bracket';
import Stats from '../../pages/Stats';
import Search from '../../pages/Search';
import OfficialBracket from '../../pages/OfficialBracket';
import Home from '../../pages/Home';
import LeagueStandings from '../../pages/LeagueStandings';
import MatchdayPredictor from '../../pages/MatchdayPredictor';
import Leaderboard from '../../pages/Leaderboard';
import PredictionViewer from '../../components/PredictionViewer';
import { useAppContext } from '../../context/AppContext';
import { LEAGUE_KINDS, type LeagueKind } from '../../context/leagueKind';
import { LEAGUE_INSIGHTS } from '../../context/leagueInsights';
import { appContext, participantScore } from '../context/fixtures';

/** Lo que enseña una vista del Mundial: aquí ninguna llega a pintarse, solo se ve si se abre. */
const WORLD_CUP = 'Vista del Mundial';

vi.mock('../../context/AppContext', () => ({
  useAppContext: vi.fn(),
  useBracketDraft: () => ({}),
}));
// Todas las vistas del Mundial piden sus datos: si alguna se abre, lo dice.
vi.mock(import('../../context/leagueData'), async (original) => ({
  ...(await original()),
  useTournamentData: () => {
    throw new Error(WORLD_CUP);
  },
}));
vi.mock('../../hooks/useMatchdayPredictor', () => ({
  useMatchdayPredictor: () => {
    throw new Error('Jornadas de la liga');
  },
}));
vi.mock('../../hooks/useLeaguePredictions', () => ({
  useMyLeaguePrediction: () => null,
  useLeaguePredictions: () => [],
}));
vi.mock('../../pages/CustomBracket', () => ({ default: () => <p>Cuadro propio</p> }));
vi.mock('../../pages/KnockoutDrawPredictor', () => ({
  default: () => <p>Eliminatorias sorteadas</p>,
}));
vi.mock('../../pages/CustomTournamentHome', () => ({
  default: () => <p>Resultados de la competición personalizada</p>,
}));
vi.mock('../../pages/OfficialTournamentHome', () => ({
  default: () => <p>Resultados del torneo</p>,
}));
vi.mock('../../pages/KnockoutDrawResults', () => ({
  default: () => <p>Resultados de las eliminatorias</p>,
}));
vi.mock('../../components/Home/LeagueHomeDashboard', () => ({
  default: () => <p>Portada de la liga</p>,
}));
vi.mock('../../components/grandPrix/GrandPrixPage', () => ({
  default: () => <p>Grandes Premios</p>,
}));
vi.mock('../../components/grandPrix/GrandPrixHome', () => ({
  default: () => <p>Portada de carreras</p>,
}));
vi.mock('../../components/grandPrix/FormulaOneStandings', () => ({
  default: () => <p>Mundial de F1</p>,
}));
vi.mock('../../components/fightCard/UfcCardBoard', () => ({
  default: () => <p>Cartelera</p>,
}));
vi.mock('../../components/tennisDraw/TennisDrawBoard', () => ({
  default: () => <p>Cuadro del torneo</p>,
}));
vi.mock('../../components/insights/MatchdayStatsView', () => ({
  default: () => <p>Estadísticas por partido</p>,
}));
vi.mock('../../components/insights/InsightsHeader', () => ({ default: () => null }));
vi.mock('../../hooks/useGrandPrixInsights', () => ({
  useGrandPrixInsights: () => ({ races: [], drivers: new Map(), leagueName: 'Liga', groupId: '7' }),
}));
vi.mock('../../components/insights/GrandPrixInsightsGate', () => ({
  default: ({ children }: { children: ReactNode }) => children,
}));
vi.mock('../../components/insights/GrandPrixStats', () => ({
  default: () => <p>Más elegidos de la Fórmula 1</p>,
}));
vi.mock('../../components/insights/GrandPrixSearch', () => ({
  default: () => <p>Buscador de pilotos</p>,
}));
vi.mock('../../hooks/useKnockoutInsights', () => ({
  useKnockoutInsights: () => ({ entries: [], leagueName: 'Liga', groupId: '7' }),
}));
vi.mock('../../components/insights/KnockoutInsightsGate', () => ({
  default: ({ children }: { children: ReactNode }) => children,
}));
vi.mock('../../components/insights/KnockoutStats', () => ({
  default: () => <p>Más elegidos del cuadro</p>,
}));
vi.mock('../../components/insights/KnockoutSearch', () => ({
  default: () => <p>Buscador de equipos del cuadro</p>,
}));
vi.mock('../../components/insights/TennisSearch', () => ({
  default: () => <p>Buscador de jugadores</p>,
}));
vi.mock('../../pages/TrackerHome', () => ({ default: () => <p>Marcador de la liga</p> }));
vi.mock('../../pages/TrackerRanking', () => ({ default: () => <p>Ranking del marcador</p> }));
vi.mock('../../components/CustomPredictionViewer', () => ({
  default: () => <p>Visor del cuadro propio</p>,
}));
vi.mock('../../services/api', async (original) => ({
  ...(await original<typeof import('../../services/api')>()),
  fetchCompetitionStandings: vi.fn(async () => []),
}));

/** Pinta el mensaje del error: así se ve qué vista se ha intentado abrir. */
class Opened extends Component<{ children: ReactNode }, { opened: string | null }> {
  state = { opened: null as string | null };
  static getDerivedStateFromError(error: Error) {
    return { opened: error.message };
  }
  render() {
    return this.state.opened ? <p>{this.state.opened}</p> : this.props.children;
  }
}

/** Marca de cada ruta a la que puede mandar una pantalla. */
const ROUTES: Record<string, string> = {
  '/': 'Ruta: inicio',
  '/jornadas': 'Ruta: jornadas',
  '/prediction': 'Ruta: mi porra',
  '/bracket': 'Ruta: resultados',
  '/stats': 'Ruta: estadísticas',
  '/tabla': 'Ruta: tabla',
};

const LOADING = 'Cargando liga';
const ERROR = 'No hemos podido abrir la liga';
const UNKNOWN = 'Esta liga no se puede abrir aquí';

const renderScreen = (kind: LeagueKind, path: string, screenElement: ReactNode) => {
  vi.mocked(useAppContext).mockReturnValue(
    appContext({
      leagueKind: kind,
      activeGroupId: kind === 'none' ? '' : '7',
      groupError: kind === 'error' ? new Error('caída') : null,
      isAuthenticated: true,
      userName: 'Ana',
      viewerPredictionId: 5,
    }),
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Opened>
          <Routes>
            {Object.entries(ROUTES)
              .filter(([route]) => route !== path)
              .map(([route, text]) => (
                <Route key={route} path={route} element={<p>{text}</p>} />
              ))}
            <Route path={path} element={screenElement} />
          </Routes>
        </Opened>
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

interface ScreenCase {
  name: string;
  path: string;
  element: ReactNode;
  expected: Record<LeagueKind, string>;
}

const SCREENS: ScreenCase[] = [
  {
    name: 'Mi porra',
    path: '/prediction',
    element: <Bracket />,
    expected: {
      loading: LOADING,
      error: ERROR,
      none: 'Mi porra',
      unknown: UNKNOWN,
      groupStage: WORLD_CUP,
      customBracket: 'Cuadro propio',
      ownBracket: 'Cuadro propio',
      knockoutDraw: 'Eliminatorias sorteadas',
      matchday: ROUTES['/jornadas'],
      fightCard: ROUTES['/jornadas'],
      tennisDraw: ROUTES['/jornadas'],
      grandPrix: ROUTES['/jornadas'],
      scoreboard: ROUTES['/'],
    },
  },
  {
    name: 'Estadísticas',
    path: '/stats',
    element: <Stats />,
    expected: {
      loading: LOADING,
      error: ERROR,
      none: 'Estadísticas',
      unknown: UNKNOWN,
      groupStage: WORLD_CUP,
      customBracket: 'Más elegidos del cuadro',
      ownBracket: 'Más elegidos del cuadro',
      knockoutDraw: 'Más elegidos del cuadro',
      matchday: 'Estadísticas por partido',
      fightCard: 'Estadísticas por partido',
      tennisDraw: 'Estadísticas por partido',
      grandPrix: 'Más elegidos de la Fórmula 1',
      scoreboard: ROUTES['/'],
    },
  },
  {
    name: 'Buscador',
    path: '/search',
    element: <Search />,
    expected: {
      loading: LOADING,
      error: ERROR,
      none: 'Buscar',
      unknown: UNKNOWN,
      groupStage: WORLD_CUP,
      customBracket: 'Buscador de equipos del cuadro',
      ownBracket: 'Buscador de equipos del cuadro',
      knockoutDraw: 'Buscador de equipos del cuadro',
      matchday: ROUTES['/stats'],
      fightCard: ROUTES['/stats'],
      tennisDraw: 'Buscador de jugadores',
      grandPrix: 'Buscador de pilotos',
      scoreboard: ROUTES['/'],
    },
  },
  {
    name: 'Resultados',
    path: '/bracket',
    element: <OfficialBracket />,
    expected: {
      loading: LOADING,
      error: ERROR,
      none: 'Resultados',
      unknown: UNKNOWN,
      groupStage: WORLD_CUP,
      customBracket: 'Resultados de la competición personalizada',
      ownBracket: 'Resultados del torneo',
      knockoutDraw: 'Resultados de las eliminatorias',
      matchday: ROUTES['/tabla'],
      fightCard: ROUTES['/tabla'],
      tennisDraw: ROUTES['/tabla'],
      grandPrix: ROUTES['/'],
      scoreboard: ROUTES['/'],
    },
  },
  {
    name: 'Inicio',
    path: '/',
    element: <Home />,
    expected: {
      loading: LOADING,
      error: ERROR,
      none: 'Inicio',
      unknown: UNKNOWN,
      groupStage: 'Portada de la liga',
      customBracket: 'Portada de la liga',
      ownBracket: 'Portada de la liga',
      knockoutDraw: 'Portada de la liga',
      matchday: 'Portada de la liga',
      fightCard: 'Portada de la liga',
      tennisDraw: 'Portada de la liga',
      grandPrix: 'Portada de carreras',
      scoreboard: 'Marcador de la liga',
    },
  },
  {
    name: 'Grupos',
    path: '/grupos',
    element: <Home defaultMode="groups" />,
    expected: {
      loading: LOADING,
      error: ERROR,
      none: 'Inicio',
      unknown: UNKNOWN,
      groupStage: WORLD_CUP,
      customBracket: 'Resultados de la competición personalizada',
      ownBracket: 'Resultados del torneo',
      knockoutDraw: 'Resultados de las eliminatorias',
      matchday: 'Portada de la liga',
      fightCard: 'Portada de la liga',
      tennisDraw: 'Portada de la liga',
      grandPrix: 'Portada de carreras',
      scoreboard: 'Marcador de la liga',
    },
  },
  {
    name: 'Tabla',
    path: '/tabla',
    element: <LeagueStandings />,
    expected: {
      loading: LOADING,
      error: ERROR,
      none: 'Tabla',
      unknown: UNKNOWN,
      groupStage: ROUTES['/bracket'],
      customBracket: ROUTES['/bracket'],
      ownBracket: ROUTES['/bracket'],
      knockoutDraw: ROUTES['/bracket'],
      matchday: 'Tabla de equipos',
      fightCard: 'Cartelera',
      tennisDraw: 'Cuadro del torneo',
      grandPrix: 'Mundial de F1',
      scoreboard: ROUTES['/'],
    },
  },
  {
    name: 'Jornadas',
    path: '/jornadas',
    element: <MatchdayPredictor />,
    expected: {
      loading: LOADING,
      error: ERROR,
      none: 'Mi porra',
      unknown: UNKNOWN,
      groupStage: ROUTES['/prediction'],
      customBracket: ROUTES['/prediction'],
      ownBracket: ROUTES['/prediction'],
      knockoutDraw: ROUTES['/prediction'],
      matchday: 'Jornadas de la liga',
      fightCard: 'Jornadas de la liga',
      tennisDraw: 'Jornadas de la liga',
      grandPrix: 'Grandes Premios',
      scoreboard: ROUTES['/'],
    },
  },
];

describe.each(SCREENS)('$name para cada clase de liga', ({ path, element, expected }) => {
  beforeEach(() => vi.clearAllMocks());

  it.each(LEAGUE_KINDS)('%s', async (kind) => {
    renderScreen(kind, path, element);
    expect(await screen.findByText(expected[kind])).toBeInTheDocument();
    // Ninguna clase que no sea el Mundial abre una vista del Mundial.
    if (kind !== 'groupStage') expect(screen.queryByText(WORLD_CUP)).not.toBeInTheDocument();
  });
});

describe('Enlaces a Estadísticas y al Buscador', () => {
  const screenOf = (name: string) => SCREENS.find((screen) => screen.name === name)!.expected;
  // Lo que se ve cuando la clase no tiene esa pantalla: un aviso o la ruta a la que manda.
  const noScreen = [LOADING, ERROR, UNKNOWN, 'Estadísticas', 'Buscar', ...Object.values(ROUTES)];

  it.each(LEAGUE_KINDS)('%s: solo salen donde la pantalla existe', (kind) => {
    const { stats, search } = LEAGUE_INSIGHTS[kind];
    expect(Boolean(stats)).toBe(!noScreen.includes(screenOf('Estadísticas')[kind]));
    expect(search).toBe(!noScreen.includes(screenOf('Buscador')[kind]));
  });
});

describe('Visor de porras para cada clase de liga', () => {
  const expected: Record<LeagueKind, string | null> = {
    groupStage: WORLD_CUP,
    customBracket: 'Visor del cuadro propio',
    ownBracket: 'Visor del cuadro propio',
    knockoutDraw: 'Visor del cuadro propio',
    matchday: null,
    fightCard: null,
    tennisDraw: null,
    grandPrix: null,
    loading: null,
    error: null,
    none: null,
    unknown: null,
    scoreboard: null,
  };

  it.each(LEAGUE_KINDS)('%s', (kind) => {
    const { container } = renderScreen(kind, '/visor', <PredictionViewer />);
    const text = expected[kind];
    if (text) expect(screen.getByText(text)).toBeInTheDocument();
    else expect(container).toBeEmptyDOMElement();
  });
});

describe('Ranking para cada clase de liga', () => {
  const opens: Record<LeagueKind, 'viewer' | string | null> = {
    groupStage: 'viewer',
    customBracket: 'viewer',
    ownBracket: 'viewer',
    knockoutDraw: 'viewer',
    matchday: ROUTES['/jornadas'],
    fightCard: ROUTES['/jornadas'],
    tennisDraw: ROUTES['/jornadas'],
    // Las predicciones de cada uno se ven en cada Gran Premio; abrir la fila llevaría a las propias.
    grandPrix: null,
    loading: null,
    error: null,
    none: null,
    unknown: null,
    // Sin ranking de predicciones: su ranking son las partidas ganadas.
    scoreboard: null,
  };

  it.each(LEAGUE_KINDS)('%s', (kind) => {
    const setViewerPredictionId = vi.fn();
    vi.mocked(useAppContext).mockReturnValue(
      appContext({
        leagueKind: kind,
        activeGroupId: '7',
        activeGroupName: 'Liga',
        userId: '10',
        userName: 'Carlos',
        setViewerPredictionId,
        leaderboardData: [participantScore({ id: 3, userId: 10, name: 'Carlos', total: 20 })],
      }),
    );
    render(
      <MemoryRouter initialEntries={['/ranking']}>
        <Routes>
          <Route path="/ranking" element={<Leaderboard />} />
          <Route path="/jornadas" element={<p>{ROUTES['/jornadas']}</p>} />
          <Route path="/" element={<p>{ROUTES['/']}</p>} />
        </Routes>
      </MemoryRouter>,
    );
    if (kind === 'scoreboard') {
      expect(screen.getByText('Ranking del marcador')).toBeInTheDocument();
      return;
    }
    // Cada enlace sale solo donde su pantalla existe.
    const { stats, search } = LEAGUE_INSIGHTS[kind];
    expect(
      screen.queryAllByRole('link', { name: /Más elegidos|Estadísticas por partido/ }),
    ).toHaveLength(stats ? 1 : 0);
    if (stats) expect(screen.getByRole('link', { name: stats })).toHaveAttribute('href', '/stats');
    expect(Boolean(screen.queryByRole('link', { name: 'Buscador' }))).toBe(search);

    fireEvent.click(screen.getByRole('row', { name: /Carlos/ }));
    const target = opens[kind];
    if (target === 'viewer') expect(setViewerPredictionId).toHaveBeenCalledWith(3);
    else expect(setViewerPredictionId).not.toHaveBeenCalled();
    if (target && target !== 'viewer') expect(screen.getByText(target)).toBeInTheDocument();
    if (!target) expect(screen.getByRole('row', { name: /Carlos/ })).toBeInTheDocument();
  });
});
