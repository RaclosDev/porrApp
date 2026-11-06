import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MatchdaySummary from '../../../components/leaderboard/MatchdaySummary';
import type { MatchdayPoints } from '../../../types/api';

const matchday = {
  label: 'Jornada 12',
  current: true,
  finished: false,
  matchCount: 10,
  pointsByPrediction: {},
} as unknown as MatchdayPoints;

function renderSummary(myRank: number | null) {
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
    expect(screen.queryByText(/Tus puntos en esta jornada/)).toBeNull();
  });

  it('no muestra puesto mientras nadie ha puntuado', () => {
    renderSummary(null);

    expect(screen.getByLabelText('Tus puntos en esta jornada: 7')).not.toHaveTextContent('º');
  });
});
