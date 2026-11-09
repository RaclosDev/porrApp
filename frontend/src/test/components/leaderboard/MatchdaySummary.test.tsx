import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MatchdaySummary from '../../../components/leaderboard/MatchdaySummary';
import type { MatchdayPoints } from '../../../types/api';
import { LEAGUE_INSIGHTS } from '../../../context/leagueInsights';
import type { LeagueKind } from '../../../context/leagueKind';

const matchday = {
  label: 'Jornada 12',
  current: true,
  finished: false,
  matchCount: 10,
  pointsByPrediction: {},
} as unknown as MatchdayPoints;

function renderSummary(myRank: number | null, fightCard = false, kind: LeagueKind = 'matchday') {
  render(
    <MemoryRouter>
      <MatchdaySummary
        matchday={matchday}
        selected={matchday}
        matchdays={[matchday]}
        selectedLabel="Jornada 12"
        myPoints={7}
        myRank={myRank}
        canGoPrev={false}
        canGoNext={false}
        onSelect={vi.fn()}
        onStep={vi.fn()}
        fightCard={fightCard}
        insights={LEAGUE_INSIGHTS[kind]}
      />
    </MemoryRouter>,
  );
}

describe('MatchdaySummary', () => {
  it('resume tus puntos y tu puesto junto al título y deja las estadísticas en un icono', () => {
    renderSummary(3);

    expect(screen.getByLabelText('Tus puntos en esta jornada: 7, puesto 3')).toHaveTextContent(
      '7 pts3º',
    );
    expect(screen.getByRole('link', { name: 'Estadísticas por partido' })).toHaveAttribute(
      'href',
      '/stats',
    );
    expect(screen.queryByRole('link', { name: 'Buscador' })).toBeNull();
    expect(screen.queryByText(/Tus puntos en esta jornada/)).toBeNull();
  });

  it('en la Fórmula 1 enlaza con Más elegidos y con el Buscador', () => {
    renderSummary(3, false, 'grandPrix');

    expect(screen.getByRole('link', { name: 'Más elegidos' })).toHaveAttribute('href', '/stats');
    expect(screen.getByRole('link', { name: 'Buscador' })).toHaveAttribute('href', '/search');
  });

  it('sin pantallas de estadísticas no hay enlaces', () => {
    renderSummary(3, false, 'unknown');

    expect(screen.queryByRole('link')).toBeNull();
  });

  it('no muestra puesto mientras nadie ha puntuado', () => {
    renderSummary(null);

    expect(screen.getByLabelText('Tus puntos en esta jornada: 7')).not.toHaveTextContent('º');
  });

  it('en la UFC habla de veladas y peleas, no de jornadas y partidos', () => {
    renderSummary(3, true);

    expect(screen.getByText('Velada actual')).toBeInTheDocument();
    expect(screen.getByText('10 peleas')).toBeInTheDocument();
    expect(screen.getByLabelText('Seleccionar velada')).toBeInTheDocument();
    expect(screen.getByLabelText('Tus puntos en esta velada: 7, puesto 3')).toBeInTheDocument();
  });
});
