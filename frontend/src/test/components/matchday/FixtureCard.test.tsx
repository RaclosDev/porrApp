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

  it('en la NFL se elige quién gana, sin X', () => {
    renderCard({ homeTeam: 'Ravens', awayTeam: 'Jaguars', sport: 'AMERICAN_FOOTBALL' }, '2');

    expect(screen.queryByRole('button', { name: /Predecir X/ })).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Predecir que gana Jaguars en Ravens - Jaguars' }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Gana Ravens')).toBeInTheDocument();
  });

  it('dice que un partido terminado sin predicción no suma', () => {
    renderCard({ finished: true, actualHomeScore: 1, actualAwayScore: 2, pointsAwarded: null });

    expect(screen.getByText(/Sin predicción/)).toBeInTheDocument();
    expect(screen.getByText('0 pts')).toBeInTheDocument();
  });
});

describe('MatchdayHeader', () => {
  const header = (isLoading: boolean) =>
    render(
      <MatchdayHeader
        title="Liga"
        isLocked={false}
        isLoading={isLoading}
        predicted={3}
        total={3}
        saveStatus="idle"
        errorMsg=""
        onRetry={vi.fn()}
      />,
    );

  it('no muestra un «0/0» falso mientras cargan los partidos', () => {
    header(true);
    expect(screen.queryByText(/predicciones/)).not.toBeInTheDocument();
  });

  it('muestra el progreso y ningún botón de guardar fijo', () => {
    header(false);
    expect(screen.getByText('3/3 predicciones')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Guardar/ })).not.toBeInTheDocument();
  });
});
