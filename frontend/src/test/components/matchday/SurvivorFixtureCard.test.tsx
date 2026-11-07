import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import FixtureCard, { type SurvivorOptions } from '../../../components/matchday/FixtureCard';
import SurvivorStatusBar from '../../../components/matchday/SurvivorStatusBar';
import { matchdayFixture } from '../../context/fixtures';
import type { MatchdayFixture } from '../../../types/api';

const renderCard = (
  fixture: Partial<MatchdayFixture>,
  sign = '',
  options: Partial<SurvivorOptions> = {},
  locked = false,
) => {
  const onPick = vi.fn();
  render(
    <FixtureCard
      fixture={matchdayFixture({
        homeTeam: 'Sevilla',
        awayTeam: 'Betis',
        homeTeamId: 7,
        awayTeamId: 8,
        ...fixture,
      })}
      prediction={{ homeScore: '', awayScore: '', sign }}
      locked={locked}
      onQuickSign={vi.fn()}
      onShowFriends={vi.fn()}
      survivor={{ usedTeams: new Map(), eliminated: false, onPick, ...options }}
    />,
  );
  return onPick;
};

describe('FixtureCard en superviviente', () => {
  it('elige un equipo que gane, sin opción de empate', () => {
    const onPick = renderCard({});

    expect(screen.queryByRole('button', { name: /Predecir X/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Gana Betis' }));

    expect(onPick).toHaveBeenCalledWith(expect.any(Number), '2');
  });

  it('no deja repetir un equipo usado en otra jornada', () => {
    renderCard({}, '', { usedTeams: new Map([[7, 'Jornada 3']]) });

    const used = screen.getByRole('button', { name: /Gana Sevilla/ });
    expect(used).toBeDisabled();
    expect(used).toHaveTextContent('Usado en Jornada 3');
    expect(screen.getByRole('button', { name: 'Gana Betis' })).toBeEnabled();
  });

  it('un eliminado ya no puede elegir', () => {
    renderCard({}, '', { eliminated: true });

    expect(screen.getByRole('button', { name: 'Gana Sevilla' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Gana Betis' })).toBeDisabled();
  });

  it('tacha la elección cuando su equipo empata y no muestra puntos en los demás partidos', () => {
    renderCard(
      {
        finished: true,
        actualHomeScore: 1,
        actualAwayScore: 1,
        pointsAwarded: 0,
        scoringDetails: 'Sevilla no gana: eliminado',
      },
      '1',
      {},
      true,
    );

    expect(screen.getByRole('button', { name: 'Gana Sevilla' })).toHaveClass('is-miss');
    expect(screen.getByText(/Sevilla no gana: eliminado/)).toBeInTheDocument();
    expect(screen.queryByText(/pts/)).not.toBeInTheDocument();
  });

  it('en un partido sin elección no pinta balance', () => {
    renderCard(
      { finished: true, actualHomeScore: 2, actualAwayScore: 0, pointsAwarded: null },
      '',
      {},
      true,
    );

    expect(screen.queryByText(/Sin predicción/)).not.toBeInTheDocument();
  });
});

describe('SurvivorStatusBar', () => {
  it('dice si sigue vivo y qué equipos ha usado', () => {
    render(
      <SurvivorStatusBar
        status={{
          eliminated: false,
          survived: 2,
          picks: [
            {
              matchId: 1,
              round: 'Jornada 1',
              teamId: 7,
              teamName: 'Sevilla',
              teamLogo: null,
              result: 'WON',
            },
            {
              matchId: 2,
              round: 'Jornada 2',
              teamId: 8,
              teamName: 'Betis',
              teamLogo: null,
              result: 'WON',
            },
          ],
        }}
      />,
    );

    expect(screen.getByText('Sigues vivo')).toBeInTheDocument();
    expect(screen.getByText('2 jornadas superadas')).toBeInTheDocument();
    expect(screen.getByText('Equipos usados: Sevilla, Betis')).toBeInTheDocument();
  });

  it('dice en qué jornada cayó', () => {
    render(
      <SurvivorStatusBar
        status={{
          eliminated: true,
          survived: 0,
          picks: [
            {
              matchId: 1,
              round: 'Jornada 4',
              teamId: 7,
              teamName: 'Sevilla',
              teamLogo: null,
              result: 'LOST',
            },
          ],
        }}
      />,
    );

    expect(screen.getByText('Eliminado en Jornada 4')).toBeInTheDocument();
  });
});
