import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import CustomTournamentHome from '../../pages/CustomTournamentHome';
import * as api from '../../services/api';
import * as appContextModule from '../../context/AppContext';
import { appContext } from '../context/fixtures';
import type { Match } from '../../types/api';

vi.mock('../../services/api');
vi.mock('../../context/AppContext');
vi.mock('../../hooks/useLeaguePredictions', () => ({ useMyLeaguePrediction: () => undefined }));

const knockout = (fields: Partial<Match>) =>
  ({ away_team_id: 2, home_team_id: 1, finished: false, round: 'bracket-1', ...fields }) as Match;

const renderHome = () =>
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <MemoryRouter>
        <CustomTournamentHome />
      </MemoryRouter>
    </QueryClientProvider>,
  );

describe('CustomTournamentHome', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(appContextModule.useAppContext).mockReturnValue(
      appContext({
        activeGroupId: '10',
        activeGroupName: 'LOL Worlds 2026',
        activeCompetitionName: 'Worlds 2026',
        activeGroupLockDate: '2026-11-07T00:00:00+01:00',
      }),
    );
  });

  it('pinta el cuadro real en el lienzo del cuadro oficial con el ganador de cada cruce', async () => {
    vi.mocked(api.fetchCustomTeams).mockResolvedValue([
      { id: 1, name: 'T1', groupName: null, logoUrl: 'https://cdn.example.com/t1.png' },
    ]);
    vi.mocked(api.fetchCustomMatches).mockResolvedValue([
      knockout({
        id: 1,
        home: 'T1',
        away: 'Gen.G',
        finished: true,
        homeScore: 3,
        awayScore: 1,
        winner: 'T1',
      }),
      knockout({ id: 2, home: 'HLE', away: 'DK', date: '2099-11-10T18:00:00Z' }),
    ]);

    renderHome();

    const center = within(await screen.findByRole('region', { name: 'Semifinales y final' }));
    expect(screen.getByRole('heading', { name: 'Worlds 2026' }).closest('section')).toHaveClass(
      'view-section',
      'active',
    );
    // Sin rondas previas a semifinales no hay hojas laterales.
    expect(screen.queryByRole('region', { name: 'Cruces del lado izquierdo' })).toBeNull();
    expect(center.getByRole('heading', { name: 'Semifinal 1' })).toBeInTheDocument();
    const winner = center.getAllByText('Clasificado')[0].closest('.team-slot');
    expect(winner).toHaveClass('is-won');
    expect(winner).toHaveTextContent(/T1.*3/);
    expect(center.getAllByText('Eliminado')[0].closest('.team-slot')).toHaveTextContent(
      /Gen\.G.*1/,
    );
    expect(center.getByText('Ganador semifinal 2')).toBeInTheDocument();
    // El escudo sale también en la final, donde el cruce aún no existe.
    expect(center.getAllByRole('img', { name: 'T1' })).toHaveLength(2);
    expect(screen.getByRole('region', { name: 'Próximo partido del cuadro' })).toHaveTextContent(
      /Semifinales.*HLE.*VS.*DK/,
    );
    expect(screen.getByRole('tab', { name: 'Cuadro' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByRole('tab', { name: 'Grupos' })).toBeNull();
    expect(screen.queryByText(/Pronósticos abiertos/)).toBeNull();
    expect(screen.queryByRole('link', { name: /pronóstico/ })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Partidos' }));
    const dialog = within(screen.getByRole('dialog', { name: 'Partidos en directo' }));
    expect(dialog.getByText('HLE')).toBeInTheDocument();
    expect(dialog.queryByRole('button', { name: /Sofascore/ })).toBeNull();
  });

  it('muestra los descansos y la clasificación de los grupos', async () => {
    vi.mocked(api.fetchCustomTeams).mockResolvedValue([
      { id: 1, name: 'Rayo', groupName: 'A', logoUrl: null },
      { id: 2, name: 'Atlético Barrio', groupName: 'A', logoUrl: null },
    ]);
    vi.mocked(api.fetchCustomMatches).mockResolvedValue([
      knockout({
        id: 1,
        round: 'group',
        groupName: 'A',
        home: 'Rayo',
        away: 'Atlético Barrio',
        finished: true,
        homeScore: 2,
        awayScore: 0,
      }),
      knockout({ id: 2, home: 'Rayo', away: 'Atlético Barrio' }),
      knockout({ id: 3, home: 'Peña', away: 'Club' }),
      knockout({ id: 4, home: 'Solo', away: '', away_team_id: null }),
    ]);

    renderHome();

    const left = within(await screen.findByRole('region', { name: 'Cruces del lado izquierdo' }));
    const right = within(screen.getByRole('region', { name: 'Cruces del lado derecho' }));
    expect(left.getByText('Rayo')).toBeInTheDocument();
    expect(right.getByText('Solo')).toBeInTheDocument();
    expect(right.getByText('Pasa directo')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Grupos' }));
    const card = within(screen.getByRole('button', { name: 'Ver detalles del Grupo A' }));
    expect(card.getByText('+2')).toBeInTheDocument();
    expect(card.getByText('3')).toBeInTheDocument();
    expect(card.queryByText('FP')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Ver detalles del Grupo A' }));
    const dialog = within(screen.getByRole('dialog', { name: 'Partidos del Grupo A' }));
    expect(dialog.getByText('2 - 0')).toBeInTheDocument();
  });
});
