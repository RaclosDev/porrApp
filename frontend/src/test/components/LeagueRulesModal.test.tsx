import { fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import LeagueRulesModal from '../../components/LeagueRulesModal';
import { DEFAULT_SCORING, leagueScoring } from '../fixtures';

const api = vi.hoisted(() => ({ fetchLeagueScoring: vi.fn() }));
vi.mock('../../services/api', () => api);

describe('LeagueRulesModal', () => {
  beforeEach(() => {
    api.fetchLeagueScoring.mockReset().mockResolvedValue(leagueScoring());
  });

  const setup = (group: Parameters<typeof LeagueRulesModal>[0]['group']) =>
    render(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <LeagueRulesModal group={group} onClose={vi.fn()} />
      </QueryClientProvider>,
    );

  const pointsOf = (label: string) =>
    within(screen.getByText(label).closest('.scoring-row') as HTMLElement).getByText(/\d+/)
      .textContent;

  it('abre en Puntuación con la tabla del cuadro completo, sin campos editables', async () => {
    setup({ id: 7, name: 'Los del barrio', rules: 'Cuota de 10 €' });

    expect(await screen.findByText('Fase de grupos')).toBeInTheDocument();
    expect(api.fetchLeagueScoring).toHaveBeenCalledWith(7);
    expect(screen.getByRole('tab', { name: 'Puntuación' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(pointsOf('Dieciseisavos')).toContain('25');
    expect(pointsOf('Campeón')).toContain('200');
    expect(screen.getByText('Pichichi')).toBeInTheDocument();
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
    expect(screen.queryByText('Cuota de 10 €')).not.toBeInTheDocument();
  });

  it('enseña solo las reglas de cada formato', async () => {
    api.fetchLeagueScoring.mockResolvedValue(
      leagueScoring({
        poolFormat: 'MATCH_DAY',
        pichichi: false,
        rules: { ...DEFAULT_SCORING, exactScorePoints: 8 },
      }),
    );
    setup({ id: 7, name: 'Jornadas' });

    expect(await screen.findByText('Resultado exacto')).toBeInTheDocument();
    expect(screen.getByText(/Provisionalmente solo puntúa/)).toBeInTheDocument();
    expect(screen.getAllByText('Pausado')).toHaveLength(2);
    expect(
      screen.getByText('Signo 1X2').closest('.scoring-row')?.querySelector('.scoring-points'),
    ).toHaveTextContent('3 pts');
    expect(screen.queryByText('Campeón')).not.toBeInTheDocument();
    expect(screen.queryByText('Pichichi')).not.toBeInTheDocument();
  });

  it('las porras de solo eliminatorias no muestran la fase de grupos', async () => {
    api.fetchLeagueScoring.mockResolvedValue(leagueScoring({ poolFormat: 'KNOCKOUTS_ONLY' }));
    setup({ id: 7, name: 'Cruces' });

    expect(await screen.findByText('Dieciseisavos')).toBeInTheDocument();
    expect(screen.queryByText('Fase de grupos')).not.toBeInTheDocument();
  });

  it('muestra las normas en su pestaña', async () => {
    setup({ id: 7, name: 'Los del barrio', rules: 'Cuota de 10 € por Bizum' });

    fireEvent.click(screen.getByRole('tab', { name: 'Normas' }));

    expect(screen.getByText('Cuota de 10 € por Bizum')).toBeInTheDocument();
    expect(screen.queryByText('Fase de grupos')).not.toBeInTheDocument();
  });

  it('sin liga activa no pide la puntuación', () => {
    setup({ id: '', name: 'Ninguna' });

    expect(screen.getByText('Elige una liga para ver su puntuación.')).toBeInTheDocument();
    expect(api.fetchLeagueScoring).not.toHaveBeenCalled();
  });
});
