import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import FixtureCard from '../../../components/matchday/FixtureCard';
import { matchdayFixture } from '../../context/fixtures';
import type { MatchdayFixture } from '../../../types/api';
import type { DraftPrediction } from '../../../utils/matchday';

const EMPTY: DraftPrediction = { homeScore: '', awayScore: '', sign: '' };

const renderCard = (fixture: Partial<MatchdayFixture>, prediction: DraftPrediction = EMPTY) => {
  const onTennisPick = vi.fn();
  render(
    <FixtureCard
      fixture={matchdayFixture({
        homeTeam: 'T1',
        awayTeam: 'BILIBILI GAMING',
        sport: 'LEAGUE_OF_LEGENDS',
        ...fixture,
      })}
      prediction={prediction}
      locked={false}
      onQuickSign={vi.fn()}
      onShowFriends={vi.fn()}
      onTennisPick={onTennisPick}
    />,
  );
  return onTennisPick;
};

describe('FixtureCard de una serie del LoL', () => {
  it('al mejor de cinco elige el ganador y después el resultado en partidas', () => {
    const onPick = renderCard(
      { bestOf: 5, setsToWin: 3 },
      { homeScore: '', awayScore: '', sign: '1' },
    );

    expect(screen.getByText('Al mejor de 5')).toBeInTheDocument();
    const games = screen.getByRole('group', { name: 'Con qué resultado gana T1 la serie' });
    expect(games).toHaveTextContent('Partidas3-03-13-2');

    fireEvent.click(screen.getByRole('button', { name: 'T1 gana 3-2' }));
    expect(onPick).toHaveBeenLastCalledWith(expect.any(Number), {
      homeScore: '3',
      awayScore: '2',
      sign: '1',
    });
  });

  it('al mejor de uno solo se elige quién gana', () => {
    renderCard({ bestOf: 1, setsToWin: null });

    expect(screen.getByText('Al mejor de 1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Predecir que gana T1/ })).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: /En cuántos/ })).not.toBeInTheDocument();
  });

  it('una serie terminada enseña su resultado', () => {
    renderCard({
      bestOf: 3,
      setsToWin: 2,
      finished: true,
      status: 'FINISHED',
      actualHomeScore: 2,
      actualAwayScore: 1,
      winnerSign: '1',
    });

    expect(screen.getByText('Final 2 - 1')).toBeInTheDocument();
  });
});
