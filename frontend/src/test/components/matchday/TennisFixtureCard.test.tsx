import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import FixtureCard from '../../../components/matchday/FixtureCard';
import { matchdayFixture } from '../../context/fixtures';
import type { MatchdayFixture } from '../../../types/api';
import type { DraftPrediction } from '../../../utils/matchday';

const EMPTY: DraftPrediction = { homeScore: '', awayScore: '', sign: '' };

const renderCard = (
  fixture: Partial<MatchdayFixture>,
  prediction: DraftPrediction = EMPTY,
  locked = false,
) => {
  const onTennisPick = vi.fn();
  render(
    <FixtureCard
      fixture={matchdayFixture({
        homeTeam: 'Jannik Sinner',
        awayTeam: 'Carlos Alcaraz',
        setsToWin: 3,
        ...fixture,
      })}
      prediction={prediction}
      locked={locked}
      onQuickSign={vi.fn()}
      onShowFriends={vi.fn()}
      onTennisPick={onTennisPick}
    />,
  );
  return onTennisPick;
};

describe('FixtureCard de tenis', () => {
  it('elige quién gana, sin empate, y después los sets', () => {
    const onPick = renderCard({});

    expect(screen.queryByRole('button', { name: /Predecir X/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: /En cuántos sets/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Gana Carlos Alcaraz' }));
    expect(onPick).toHaveBeenLastCalledWith(expect.any(Number), {
      homeScore: '',
      awayScore: '',
      sign: '2',
    });
  });

  it('ofrece los resultados al mejor de cinco y los guarda desde el ganador', () => {
    const onPick = renderCard({}, { homeScore: '', awayScore: '', sign: '2' });

    const sets = screen.getByRole('group', { name: 'En cuántos sets gana Carlos Alcaraz' });
    expect(sets).toHaveTextContent('3-03-13-2');

    fireEvent.click(screen.getByRole('button', { name: 'Carlos Alcaraz gana 3-1' }));
    expect(onPick).toHaveBeenLastCalledWith(expect.any(Number), {
      homeScore: '1',
      awayScore: '3',
      sign: '2',
    });
  });

  it('volver a pulsar los sets los quita y deja el ganador', () => {
    const onPick = renderCard({ setsToWin: 2 }, { homeScore: '2', awayScore: '1', sign: '1' });

    const chosen = screen.getByRole('button', { name: 'Jannik Sinner gana 2-1' });
    expect(chosen).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(chosen);
    expect(onPick).toHaveBeenLastCalledWith(expect.any(Number), {
      homeScore: '',
      awayScore: '',
      sign: '1',
    });
  });

  it('marca el ganador real de un W.O. aunque no haya marcador', () => {
    renderCard(
      {
        finished: true,
        actualHomeScore: null,
        actualAwayScore: null,
        winnerSign: '2',
        pointsAwarded: 10,
      },
      { homeScore: '', awayScore: '', sign: '2' },
      true,
    );

    expect(screen.getByText('Final · retirada o W.O.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Gana Carlos Alcaraz' })).toHaveClass(
      'is-result',
      'is-active',
    );
    expect(screen.getByText('+10 pts')).toBeInTheDocument();
  });

  it('muestra los sets de un partido en juego', () => {
    renderCard({ status: 'LIVE', actualHomeScore: 1, actualAwayScore: 0 }, EMPTY, true);

    expect(screen.getByText('En juego · 1-0')).toBeInTheDocument();
  });
});
