import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Bracket from '../../pages/Bracket';
import Stats from '../../pages/Stats';
import Search from '../../pages/Search';
import PredictionViewer from '../../components/PredictionViewer';
import { useAppContext } from '../../context/AppContext';
import { appContext } from '../context/fixtures';

vi.mock('../../context/AppContext', () => ({ useAppContext: vi.fn() }));
// Las vistas del Mundial se sustituyen por una marca: aquí solo importa a cuál se llega.
vi.mock('../../hooks/useBracket', () => ({
  useBracket: () => {
    throw new Error('El editor del Mundial no debe abrirse');
  },
}));
vi.mock('../../components/insights/BracketStats', () => ({
  default: () => <p>Estadísticas del Mundial</p>,
}));
vi.mock('../../components/insights/BracketInsightsGate', () => ({
  default: () => <p>Estadísticas del Mundial</p>,
}));
vi.mock('../../hooks/useBracketInsights', () => ({
  useBracketInsights: () => ({ entries: [], loading: false, leagueName: 'Liga', official: {} }),
}));
vi.mock('../../components/insights/InsightsHeader', () => ({ default: () => null }));
vi.mock('../../hooks/useLeaguePredictions', () => ({
  useMyLeaguePrediction: () => null,
  useLeaguePredictions: () => [],
}));

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<p>Portada</p>} />
        <Route path="/jornadas" element={<p>Jornadas</p>} />
        <Route path="/prediction" element={<Bracket />} />
        <Route path="/stats" element={<Stats />} />
        <Route path="/search" element={<Search />} />
      </Routes>
    </MemoryRouter>,
  );

const league = (fields: Parameters<typeof appContext>[0]) =>
  appContext({ activeGroupId: '7', isAuthenticated: true, userName: 'Ana', ...fields });

describe('World Cup views only open for World Cup leagues', () => {
  beforeEach(() => vi.clearAllMocks());

  it.each([
    [
      'Fórmula 1',
      { activeGroupPoolFormat: 'GRAND_PRIX' as const, activeCompetitionFormatType: 'RACE' },
      'Portada',
    ],
    [
      'un torneo sin cuadro del Mundial',
      { activeGroupPoolFormat: 'FULL_BRACKET' as const, activeCompetitionFormatType: 'TOURNAMENT' },
      'Portada',
    ],
    [
      'una liga por jornadas',
      { activeGroupPoolFormat: 'MATCH_DAY' as const, activeCompetitionFormatType: 'LEAGUE' },
      'Jornadas',
    ],
  ])('Mi porra de %s no abre el formulario de grupos del Mundial', (_name, fields, landing) => {
    vi.mocked(useAppContext).mockReturnValue(league(fields as Parameters<typeof appContext>[0]));
    renderAt('/prediction');
    expect(screen.getByText(landing)).toBeInTheDocument();
  });

  it.each(['/stats', '/search'])(
    '%s de una liga que no es del Mundial vuelve al inicio',
    (path) => {
      vi.mocked(useAppContext).mockReturnValue(
        league({
          activeGroupPoolFormat: 'GRAND_PRIX',
          activeCompetitionFormatType: 'RACE',
          activeGroupWorldCup: false,
        }),
      );
      renderAt(path);
      expect(screen.getByText('Portada')).toBeInTheDocument();
      expect(screen.queryByText('Estadísticas del Mundial')).toBeNull();
    },
  );

  it('las estadísticas de cuadro siguen abriéndose en una liga del Mundial', () => {
    vi.mocked(useAppContext).mockReturnValue(
      league({
        activeGroupPoolFormat: 'FULL_BRACKET',
        activeCompetitionFormatType: 'TOURNAMENT',
        activeCompetitionExternalId: 'fifa.world',
        activeGroupWorldCup: true,
      }),
    );
    renderAt('/stats');
    expect(screen.queryByText('Portada')).toBeNull();
    expect(screen.getByText('Estadísticas del Mundial')).toBeInTheDocument();
  });

  it('el visor de porras no enseña el cuadro del Mundial en otra liga', () => {
    vi.mocked(useAppContext).mockReturnValue(
      league({
        activeGroupKnockoutDraw: true,
        activeGroupWorldCup: false,
        viewerPredictionId: 5,
      }),
    );
    const { container } = render(
      <MemoryRouter>
        <PredictionViewer />
      </MemoryRouter>,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
