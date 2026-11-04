import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import OfficialTournamentHome from '../../pages/OfficialTournamentHome';
import * as appContextModule from '../../context/AppContext';
import { appContext } from '../context/fixtures';
import type { Match } from '../../types/api';

vi.mock('../../context/AppContext');

let id = 1;
const series = (fields: Partial<Match>) =>
  ({
    id: id++,
    home_team_id: 1,
    away_team_id: 2,
    finished: true,
    winner: null,
    homeScore: null,
    awayScore: null,
    date: '2026-10-20T10:00:00Z',
    ...fields,
  }) as Match;

const games = [
  series({ home: 'T1', away: 'G2', homeScore: 2, awayScore: 0, round: 'group' }),
  series({ home: 'Gen.G', away: 'FNC', homeScore: 2, awayScore: 1, round: 'playin' }),
  series({ home: 'IG', away: 'TOP', homeScore: 3, awayScore: 2, round: 'qf' }),
  series({ home: 'Gen.G', away: 'LYON', homeScore: 3, awayScore: 0, round: 'qf' }),
  series({ home: 'DK', away: 'BLG', homeScore: 1, awayScore: 3, round: 'qf' }),
  series({
    home: 'T1',
    away: 'KC',
    homeScore: 2,
    awayScore: 1,
    finished: false,
    round: 'qf',
    date: '2026-11-02T10:00:00Z',
  }),
];

const renderHome = () =>
  render(
    <MemoryRouter>
      <OfficialTournamentHome />
    </MemoryRouter>,
  );

describe('OfficialTournamentHome', () => {
  beforeEach(() => {
    vi.mocked(appContextModule.useAppContext).mockReturnValue(
      appContext({
        activeCompetitionName: 'Worlds',
        activeCompetitionExternalId: 'lol.worlds',
        allGames: games,
      }),
    );
  });

  it('monta el cuadro con los equipos reales de la competición', () => {
    renderHome();

    expect(screen.getByRole('heading', { name: 'Próximo partido del cuadro' })).toBeTruthy();
    for (const team of ['IG', 'TOP', 'LYON', 'DK', 'BLG', 'KC']) {
      expect(screen.getAllByText(team).length).toBeGreaterThan(0);
    }
    expect(screen.queryByText(/mejores terceros/i)).toBeNull();
  });

  it('muestra la fase suiza con victorias y derrotas, sin el Play-In', () => {
    renderHome();
    fireEvent.click(screen.getByRole('tab', { name: 'Fase suiza' }));

    expect(screen.getByRole('heading', { name: 'Fase suiza' })).toBeTruthy();
    const rows = screen.getAllByRole('listitem').map((row) => row.textContent);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toContain('T1');
    expect(rows[1]).toContain('G2');
  });
});
