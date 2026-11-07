import { matchdayFixture, friendPrediction } from '../context/fixtures';
import type { MatchdayFixture } from '../../types/api';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import MatchFriendsPredictionsModal from '../../components/MatchFriendsPredictionsModal';
import { fetchMatchdayFriendPredictions } from '../../services/api';

vi.mock('../../services/api', () => ({
  fetchMatchdayFriendPredictions: vi.fn(),
}));

const match = matchdayFixture({
  matchId: 99,
  homeTeam: 'Athletic Club',
  awayTeam: 'Real Sociedad',
  homeTeamLogo: '/logos/athletic.png',
  awayTeamLogo: '/logos/sociedad.png',
  matchDate: '2026-10-28T09:16:00',
  round: 'Jornada 12',
  finished: false,
  locked: false,
});

function renderModal(overrides: Partial<MatchdayFixture> = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MatchFriendsPredictionsModal
        groupId="1"
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
    vi.mocked(fetchMatchdayFriendPredictions).mockResolvedValue(
      [
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
      ].map(friendPrediction),
    );

    renderModal();

    expect(await screen.findByText('Toto')).toBeInTheDocument();
    expect(screen.getByText('Jornada 12')).toBeInTheDocument();
    expect(screen.getByText('2/3 con predicción')).toBeInTheDocument();

    const avatarSources = screen
      .getAllByTestId('avatar-image')
      .map((avatar) => avatar.querySelector('img')?.getAttribute('src'));
    // Sin foto no se pide /avatar (daría 404): se genera el avatar en el cliente.
    expect(avatarSources).toEqual(['/api/users/1/avatar?v=10']);
    expect(screen.getAllByTestId('avatar-generated')).toHaveLength(2);

    expect(screen.getByText('Oculto')).toBeInTheDocument();
    expect(screen.getByText('Pendiente')).toBeInTheDocument();
    // Liga 1X2: se ve el signo, no el marcador guardado.
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.queryByText('2 - 1')).not.toBeInTheDocument();
    expect(screen.getByText('Tú')).toBeInTheDocument();
  });

  it('marca como sin pronóstico los partidos ya bloqueados', async () => {
    vi.mocked(fetchMatchdayFriendPredictions).mockResolvedValue(
      [
        {
          userId: 2,
          participantName: 'Raclos',
          avatarUrl: null,
          hasPredicted: false,
          scoringDetails: '❌ Sin pronóstico (0 pts)',
          isCaller: true,
          updatedAt: null,
        },
      ].map(friendPrediction),
    );

    renderModal({ locked: true });

    expect(await screen.findByText('Sin predicción')).toBeInTheDocument();
    expect(screen.queryByText('Pendiente')).not.toBeInTheDocument();
  });

  it('agrupa por signo un partido finalizado y muestra las predicciones sin marcador', async () => {
    vi.mocked(fetchMatchdayFriendPredictions).mockResolvedValue(
      [
        { userId: 1, participantName: 'Toto', hasPredicted: true, sign: '1', pointsAwarded: 0 },
        { userId: 2, participantName: 'Vitty', hasPredicted: true, sign: 'X', pointsAwarded: 3 },
        {
          userId: 3,
          participantName: 'Raclos',
          hasPredicted: true,
          homeScore: 2,
          awayScore: 1,
          sign: '1',
          pointsAwarded: 0,
          isCaller: true,
          updatedAt: '2026-11-06T21:03:00',
        },
        { userId: 4, participantName: 'Saul', hasPredicted: false },
      ].map(friendPrediction),
    );

    renderModal({ finished: true, locked: true, actualHomeScore: 0, actualAwayScore: 0 });

    expect(await screen.findByRole('region', { name: '1 · Gana Athletic Club' })).toHaveTextContent(
      /Toto.*Raclos/,
    );
    expect(screen.getByRole('region', { name: 'X · Empate' })).toHaveTextContent(/Vitty.*\+3 pts/);
    expect(screen.getByRole('region', { name: '2 · Gana Real Sociedad' })).toHaveTextContent(
      'Nadie',
    );
    expect(screen.getByRole('region', { name: '– · Sin predicción' })).toHaveTextContent('Saul');
    expect(screen.queryByText('Oculto')).not.toBeInTheDocument();
    expect(screen.queryByText('2 - 1')).not.toBeInTheDocument();
    // Tras el cierre la hora cambia al puntuar: no se enseña.
    expect(screen.queryByText(/21:03/)).not.toBeInTheDocument();
    expect(screen.queryByText(/se ven al empezar/)).not.toBeInTheDocument();
  });
});
