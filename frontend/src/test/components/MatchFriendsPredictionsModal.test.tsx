import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import MatchFriendsPredictionsModal from '../../components/MatchFriendsPredictionsModal';
import { fetchMatchdayFriendPredictions } from '../../services/api';

vi.mock('../../services/api', () => ({
  fetchMatchdayFriendPredictions: vi.fn(),
}));

const match = {
  matchId: 99,
  homeTeam: 'Athletic Club',
  awayTeam: 'Real Sociedad',
  homeTeamLogo: '/logos/athletic.png',
  awayTeamLogo: '/logos/sociedad.png',
  matchDate: '2026-10-28T09:16:00',
  round: 'Jornada 12',
  finished: false,
  locked: false,
};

function renderModal(overrides = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MatchFriendsPredictionsModal
        groupId={1}
        match={{ ...match, ...overrides }}
        onClose={() => {}}
      />
    </QueryClientProvider>,
  );
}

describe('MatchFriendsPredictionsModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('muestra los avatares y diferencia pronósticos ocultos de pendientes', async () => {
    fetchMatchdayFriendPredictions.mockResolvedValue([
      {
        userId: 1,
        participantName: 'Toto',
        avatarUrl: '/api/users/1/avatar?v=10',
        hasPredicted: true,
        scoringDetails: '🔒 Pronóstico oculto hasta el pitido inicial',
        isCaller: false,
        updatedAt: '2026-10-28T13:59:00',
      },
      {
        userId: 2,
        participantName: 'Raclos',
        avatarUrl: null,
        hasPredicted: false,
        scoringDetails: '⏳ Pendiente de pronosticar',
        isCaller: true,
        updatedAt: null,
      },
      {
        userId: 3,
        participantName: 'Giorgi - Winamax',
        avatarUrl: null,
        hasPredicted: true,
        homeScore: 2,
        awayScore: 1,
        sign: '1',
        isCaller: false,
        updatedAt: '2026-10-28T09:16:00',
      },
    ]);

    renderModal();

    expect(await screen.findByText('Toto')).toBeInTheDocument();
    expect(screen.getByText('Jornada 12')).toBeInTheDocument();
    expect(screen.getByText('2/3 con pronóstico')).toBeInTheDocument();

    const avatarSources = screen
      .getAllByTestId('avatar-image')
      .map((avatar) => avatar.querySelector('img')?.getAttribute('src'));
    // Sin foto no se pide /avatar (daría 404): se genera el avatar en el cliente.
    expect(avatarSources).toEqual(['/api/users/1/avatar?v=10']);
    expect(screen.getAllByTestId('avatar-generated')).toHaveLength(2);

    expect(screen.getByText('🔒 Oculto')).toBeInTheDocument();
    expect(screen.getByText('Sin pronosticar')).toBeInTheDocument();
    expect(screen.getByText('2 - 1')).toBeInTheDocument();
    expect(screen.getByText('Tú')).toBeInTheDocument();
  });

  it('marca como sin pronóstico los partidos ya bloqueados', async () => {
    fetchMatchdayFriendPredictions.mockResolvedValue([
      {
        userId: 2,
        participantName: 'Raclos',
        avatarUrl: null,
        hasPredicted: false,
        scoringDetails: '❌ Sin pronóstico (0 pts)',
        isCaller: true,
        updatedAt: null,
      },
    ]);

    renderModal({ locked: true });

    expect(await screen.findByText('Sin pronóstico')).toBeInTheDocument();
    expect(screen.queryByText('Sin pronosticar')).not.toBeInTheDocument();
  });
});
