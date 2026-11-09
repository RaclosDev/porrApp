import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import TennisSearch from '../../components/insights/TennisSearch';
import { useMatchdayStats } from '../../hooks/useMatchdayStats';
import { useMatchVoters } from '../../hooks/useMatchVoters';
import { ApiError } from '../../services/apiError';
import type { MatchStats, MatchVoters } from '../../types/api';

vi.mock('../../hooks/useMatchdayStats', () => ({ useMatchdayStats: vi.fn() }));
vi.mock('../../hooks/useMatchVoters', () => ({ useMatchVoters: vi.fn() }));

const match = (over: Partial<MatchStats> & Pick<MatchStats, 'matchId'>): MatchStats => ({
  round: 'Semifinales',
  matchDate: '2026-11-07T18:00:00Z',
  homeTeam: 'Alcaraz',
  awayTeam: 'Sinner',
  homeTeamLogo: null,
  awayTeamLogo: null,
  finished: false,
  live: false,
  homeScore: null,
  awayScore: null,
  predictions: 0,
  homeWins: 0,
  draws: 0,
  awayWins: 0,
  topScores: [],
  exactHits: null,
  signHits: null,
  ...over,
});

const matches = [
  match({
    matchId: 1,
    round: 'Cuartos de final',
    homeTeam: 'Alcaraz',
    awayTeam: 'Zverev',
    finished: true,
    homeScore: 2,
    awayScore: 0,
    homeWins: 2,
    awayWins: 1,
  }),
  match({ matchId: 2, homeTeam: 'Sinner', awayTeam: 'Alcaraz', homeWins: 1, awayWins: 2 }),
];
const voter = (userId: number, name: string) => ({ userId, name, avatarUrl: null });
const voters = new Map<number, MatchVoters>([
  [
    1,
    { matchId: 1, home: [voter(1, 'Ana'), voter(2, 'Berto')], draw: [], away: [voter(3, 'Carla')] },
  ],
  [
    2,
    { matchId: 2, home: [voter(3, 'Carla')], draw: [], away: [voter(1, 'Ana'), voter(2, 'Berto')] },
  ],
]);

const stats = (over: object) =>
  vi.mocked(useMatchdayStats).mockReturnValue({
    data: { members: 3, matches },
    isPending: false,
    error: null,
    ...over,
  } as unknown as ReturnType<typeof useMatchdayStats>);

const search = (path = '/search') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <TennisSearch groupId="7" leagueName="Finales ATP" />
    </MemoryRouter>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  stats({});
  vi.mocked(useMatchVoters).mockReturnValue(voters);
});

describe('Buscador de jugadores de tenis', () => {
  it('ofrece los jugadores de los partidos ya empezados y los favoritos de atajo', () => {
    search();

    const select = screen.getByLabelText('¿Quién de la liga pone a…?');
    expect(
      within(select)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['Elige un jugador', 'Alcaraz', 'Sinner', 'Zverev']);
    expect(screen.getByText('Elige un jugador', { selector: 'p' })).toBeInTheDocument();
    // Sin jugador elegido no se pide quién ha puesto qué.
    expect(useMatchVoters).toHaveBeenCalledWith('7', []);

    fireEvent.click(screen.getByRole('button', { name: 'Alcaraz' }));
    expect(screen.getByRole('heading', { name: 'Alcaraz' })).toBeInTheDocument();
  });

  it('dice quién da ganador al jugador en cada partido y quién a su rival', () => {
    search('/search?player=Alcaraz');

    // Sin partido pedido, el último del jugador.
    expect(screen.getByRole('button', { name: /Semifinales: gana a Sinner/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(useMatchVoters).toHaveBeenLastCalledWith('7', [2]);
    expect(screen.getByRole('heading', { name: 'Alcaraz gana a Sinner' })).toBeInTheDocument();
    expect(screen.getByText(/Semifinales · 2 de 3 predicciones \(67 %\)\./)).toBeInTheDocument();
    const yes = screen.getByRole('heading', { name: /Lo ponen ganador/ }).parentElement!;
    const chosen = within(yes).getAllByRole('listitem');
    expect(chosen).toHaveLength(2);
    expect(chosen[0]).toHaveTextContent('Ana');
    expect(chosen[1]).toHaveTextContent('Berto');
    const no = screen.getByRole('heading', { name: /Ponen a Sinner/ }).parentElement!;
    expect(within(no).getByRole('listitem')).toHaveTextContent('Carla');

    fireEvent.click(screen.getByRole('button', { name: /Cuartos de final: gana a Zverev/ }));
    expect(screen.getByRole('heading', { name: 'Alcaraz gana a Zverev' })).toBeInTheDocument();
    expect(screen.getByText(/Ganó 2-0\./)).toBeInTheDocument();
    expect(useMatchVoters).toHaveBeenLastCalledWith('7', [1]);
  });

  it('enseña dónde cayó un jugador eliminado', () => {
    search('/search?player=Zverev&match=1');

    expect(screen.getByText('Cayó en cuartos de final')).toBeInTheDocument();
    expect(screen.getByText(/1 de 3 predicciones \(33 %\)\. Perdió 0-2\./)).toBeInTheDocument();
  });

  it('ignora un jugador que no está en los partidos visibles', () => {
    search('/search?player=Rune');

    expect(screen.getByLabelText('¿Quién de la liga pone a…?')).toHaveValue('');
  });

  it('comparte la búsqueda por WhatsApp con el enlace al partido', () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    search('/search?player=Alcaraz');

    fireEvent.click(screen.getByRole('button', { name: /Compartir búsqueda/ }));
    const url = decodeURIComponent(String(open.mock.calls[0][0]));
    expect(url).toContain('Alcaraz gana a Sinner (Semifinales): lo pone el 67 % de "Finales ATP"');
    expect(url).toContain('/search?group=7&player=Alcaraz&match=2');
    open.mockRestore();
  });

  it('avisa mientras carga, si falla y cuando aún no ha empezado ningún partido', () => {
    stats({ data: undefined, isPending: true });
    const loading = search();
    expect(screen.getByText('Cargando el buscador')).toBeInTheDocument();
    loading.unmount();

    stats({ data: undefined, error: new ApiError(403, 'Prohibido') });
    const forbidden = search();
    expect(screen.getByText('Solo los miembros de la liga pueden verlas.')).toBeInTheDocument();
    forbidden.unmount();

    stats({ data: undefined, error: new Error('red') });
    const failed = search();
    expect(screen.getByText('Comprueba la conexión e inténtalo de nuevo.')).toBeInTheDocument();
    failed.unmount();

    stats({ data: { members: 3, matches: [] } });
    search();
    expect(screen.getByText('Todavía no hay partidos que mostrar')).toBeInTheDocument();
  });
});
