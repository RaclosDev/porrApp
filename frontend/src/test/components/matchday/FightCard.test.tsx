import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import FightCard from '../../../components/matchday/FightCard';
import { matchdayFixture } from '../../context/fixtures';
import type { FightInfo, MatchdayFixture } from '../../../types/api';
import type { DraftPrediction } from '../../../utils/matchday';

const fight = (overrides: Partial<FightInfo> = {}): FightInfo => ({
  eventId: '600061420',
  eventName: 'UFC Fight Night: Moicano vs. Nolan',
  segment: 'MAIN',
  order: 1,
  weightClass: 'Lightweight',
  scheduledRounds: 5,
  homeRecord: '20-7-1',
  awayRecord: '12-1-0',
  resultMethod: null,
  resultDetail: null,
  resultRound: null,
  resultClock: null,
  winner: null,
  ...overrides,
});

const renderCard = (
  fixture: Partial<MatchdayFixture> = {},
  prediction: Partial<DraftPrediction> = {},
  locked = false,
) => {
  const onPick = vi.fn();
  render(
    <FightCard
      fixture={matchdayFixture({
        homeTeam: 'Renato Moicano',
        awayTeam: 'Tom Nolan',
        fight: fight(),
        ...fixture,
      })}
      prediction={{ homeScore: '', awayScore: '', sign: '', ...prediction }}
      locked={locked}
      onPick={onPick}
      onShowFriends={vi.fn()}
    />,
  );
  return onPick;
};

describe('FightCard', () => {
  it('muestra la pelea estelar con el peso, los asaltos y el récord de cada luchador', () => {
    renderCard();

    expect(screen.getByText('Pelea estelar')).toBeInTheDocument();
    expect(screen.getByText('Peso ligero')).toBeInTheDocument();
    expect(screen.getByText('5 asaltos')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Gana Tom Nolan (12-1-0)' })).toBeInTheDocument();
    // Sin ganador elegido aún no se pregunta el método.
    expect(screen.queryByText('KO/TKO')).not.toBeInTheDocument();
  });

  it('elegir un luchador guarda solo el ganador', () => {
    const onPick = renderCard();

    fireEvent.click(screen.getByRole('button', { name: 'Gana Tom Nolan (12-1-0)' }));

    expect(onPick).toHaveBeenCalledWith(1, {
      homeScore: '',
      awayScore: '',
      sign: '2',
      method: '',
      round: '',
    });
  });

  it('con un KO/TKO deja elegir el asalto, y con decisión lo quita', () => {
    const onPick = renderCard({}, { sign: '2', method: 'KO_TKO', round: '' });

    const rounds = screen.getByRole('group', { name: 'Asalto (opcional)' });
    expect(rounds.querySelectorAll('button')).toHaveLength(5);
    fireEvent.click(screen.getByRole('button', { name: 'Asalto 3' }));
    expect(onPick).toHaveBeenLastCalledWith(
      1,
      expect.objectContaining({ method: 'KO_TKO', round: '3' }),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Decisión' }));
    expect(onPick).toHaveBeenLastCalledWith(
      1,
      expect.objectContaining({ sign: '2', method: 'DECISION', round: '' }),
    );
  });

  it('al acabar marca el resultado real y el desglose de puntos', () => {
    renderCard(
      {
        finished: true,
        status: 'FINISHED',
        pointsAwarded: 7,
        scoringDetails: 'Ganador +3 · Método +2 · Asalto +2 (7 pts)',
        fight: fight({
          resultMethod: 'KO_TKO',
          resultDetail: 'KO/TKO - Elbows',
          resultRound: 3,
          resultClock: '1:28',
          winner: '2',
        }),
      },
      { sign: '2', method: 'KO_TKO', round: '3' },
      true,
    );

    expect(screen.getByRole('button', { name: /Gana Tom Nolan .*ganador/ })).toHaveClass(
      'is-result',
      'is-active',
    );
    expect(screen.getByRole('button', { name: 'Asalto 3' })).toHaveClass('is-result');
    expect(
      screen.getByText('Gana Tom Nolan por KO/TKO (Elbows) en el asalto 3 (1:28)'),
    ).toBeInTheDocument();
    expect(screen.getByText(/Ganador \+3 · Método \+2 · Asalto \+2/)).toBeInTheDocument();
    expect(screen.getByText('+7 pts')).toBeInTheDocument();
  });

  it('una pelea cancelada lo dice y no muestra puntos', () => {
    renderCard(
      { status: 'CANCELLED', locked: true, lockReason: 'Pelea cancelada: no puntúa' },
      { sign: '1' },
      true,
    );

    expect(screen.getByText('Cancelada')).toBeInTheDocument();
    expect(screen.getByText('Pelea cancelada: no puntúa')).toBeInTheDocument();
    expect(screen.queryByText(/pts/)).not.toBeInTheDocument();
  });
});
