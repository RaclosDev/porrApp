import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import FixtureCard from '../../../components/matchday/FixtureCard';
import MatchdayHeader from '../../../components/matchday/MatchdayHeader';
import { matchdayFixture } from '../../context/fixtures';
import type { MatchdayFixture } from '../../../types/api';

const renderCard = (fixture: Partial<MatchdayFixture>, sign = '') =>
  render(
    <FixtureCard
      fixture={matchdayFixture({ homeTeam: 'Sevilla', awayTeam: 'Betis', ...fixture })}
      prediction={{ homeScore: '', awayScore: '', sign }}
      locked
      disabled={false}
      onQuickSign={vi.fn()}
      onShowFriends={vi.fn()}
    />,
  );

describe('FixtureCard', () => {
  it('marca el signo real y los puntos de un acierto', () => {
    renderCard({ finished: true, actualHomeScore: 2, actualAwayScore: 0, pointsAwarded: 3 }, '1');

    const result = screen.getByRole('button', {
      name: 'Predecir 1 en Sevilla - Betis (resultado final)',
    });
    expect(result).toHaveClass('is-result', 'is-active');
    expect(screen.getByText('+3 pts')).toBeInTheDocument();
  });

  it('tacha la predicción fallada y muestra 0 pts', () => {
    renderCard({ finished: true, actualHomeScore: 0, actualAwayScore: 0, pointsAwarded: 0 }, '2');

    expect(screen.getByRole('button', { name: 'Predecir 2 en Sevilla - Betis' })).toHaveClass(
      'is-miss',
    );
    expect(screen.getByRole('button', { name: /Predecir X .*resultado final/ })).toHaveClass(
      'is-result',
    );
    expect(screen.getByText('0 pts')).toBeInTheDocument();
  });

  it('dice que un partido terminado sin predicción no suma', () => {
    renderCard({ finished: true, actualHomeScore: 1, actualAwayScore: 2, pointsAwarded: null });

    expect(screen.getByText(/Sin predicción/)).toBeInTheDocument();
    expect(screen.getByText('0 pts')).toBeInTheDocument();
  });
});

describe('MatchdayHeader', () => {
  const header = (canEdit: boolean) =>
    render(
      <MatchdayHeader
        title="Liga"
        isLocked={false}
        canEdit={canEdit}
        predicted={3}
        total={3}
        isSaving={false}
        onSave={vi.fn()}
        successMsg=""
        errorMsg=""
      />,
    );

  it('oculta «Guardar» si no queda ningún partido abierto', () => {
    header(false);
    expect(screen.queryByRole('button', { name: 'Guardar' })).not.toBeInTheDocument();
  });

  it('muestra «Guardar» con partidos abiertos', () => {
    header(true);
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeEnabled();
  });
});
