import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { RadarView, dayLabel } from '../../pages/Radar';
import type { Match, MatchRadar } from '../../types/api';

const match = (
  id: number,
  home: string,
  away: string,
  date: string,
  homeScore: number | null = null,
  awayScore: number | null = null,
) => ({ id, home, away, date, homeScore, awayScore, displayClock: null }) as unknown as Match;

const radar = (overrides: Partial<MatchRadar>) =>
  ({ live: [], next: [], last: [], ...overrides }) as MatchRadar;

describe('Radar', () => {
  it('nombra los días cercanos y pone el resto con fecha', () => {
    const now = new Date(2026, 10, 6, 12);
    expect(dayLabel(new Date(2026, 10, 6, 21), now)).toBe('Hoy');
    expect(dayLabel(new Date(2026, 10, 7, 14), now)).toBe('Mañana');
    expect(dayLabel(new Date(2026, 10, 5, 21), now)).toBe('Ayer');
    expect(dayLabel(new Date(2026, 10, 1, 21), now)).toMatch(/^Domingo.*1.*nov/);
  });

  it('agrupa los próximos partidos por día con su hora', () => {
    render(
      <RadarView
        matchRadar={radar({
          next: [
            match(1, 'Málaga', 'Racing Santander', '2030-03-09T14:00:00'),
            match(2, 'Espanyol', 'Deportivo', '2030-03-09T16:15:00'),
            match(3, 'Valencia', 'Real Madrid', '2030-03-10T21:00:00'),
          ],
        })}
      />,
    );

    const panel = screen.getByRole('tabpanel', { name: 'Próximos' });
    const days = within(panel).getAllByRole('region');
    expect(days).toHaveLength(2);
    expect(within(days[0]).getAllByRole('listitem')).toHaveLength(2);
    expect(within(days[0]).getByText('16:15')).toBeInTheDocument();
    expect(screen.queryByText('Abrir Sofascore (fútbol)')).not.toBeInTheDocument();
  });

  it('marca al ganador en los resultados', () => {
    render(
      <RadarView
        matchRadar={radar({
          last: [match(6, 'Racing Santander', 'Real Madrid', '2030-03-01T16:15:00', 0, 3)],
        })}
      />,
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Resultados' }));
    const panel = screen.getByRole('tabpanel', { name: 'Resultados' });
    expect(within(panel).getByText('Final')).toBeInTheDocument();
    expect(within(panel).getByText('Real Madrid').closest('.radar-match-team')).toHaveClass(
      'is-winner',
    );
    expect(within(panel).getByText('Racing Santander').closest('.radar-match-team')).toHaveClass(
      'is-loser',
    );
  });

  it('una pelea de la UFC lleva W y L en vez de marcador, y cómo acabó', () => {
    const fight = {
      ...match(7, 'Keiichiro Nakamura', 'Ollie Schmid', '2030-03-01T23:00:00', 0, 1),
      finished: true,
      fight: {
        eventId: '1',
        eventName: 'UFC Fight Night',
        segment: 'PRELIMS',
        order: 9,
        weightClass: 'Featherweight',
        scheduledRounds: 3,
        homeRecord: null,
        awayRecord: null,
        resultMethod: 'SUBMISSION',
        resultDetail: 'Submission - Rear Naked Choke',
        resultRound: 2,
        resultClock: '3:12',
        winner: '2',
      },
    } as Match;
    render(<RadarView matchRadar={radar({ last: [fight] })} />);

    fireEvent.click(screen.getByRole('tab', { name: 'Resultados' }));
    const panel = screen.getByRole('tabpanel', { name: 'Resultados' });
    expect(within(panel).queryByText('0')).not.toBeInTheDocument();
    expect(within(panel).queryByText('1')).not.toBeInTheDocument();
    expect(within(panel).getByTitle('Victoria')).toHaveTextContent('W');
    expect(within(panel).getByTitle('Derrota')).toHaveTextContent('L');
    expect(within(panel).getByText('Ollie Schmid').closest('.radar-match-team')).toHaveClass(
      'is-winner',
    );
    expect(within(panel).getByText('Sumisión (mataleón)')).toBeInTheDocument();
    expect(within(panel).getByText('Asalto 2')).toBeInTheDocument();
    expect(within(panel).getByText('3:12')).toBeInTheDocument();
  });
});
