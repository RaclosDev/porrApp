import { fireEvent, render as rtlRender, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import FeaturedMatchBanner from '../../../components/official/FeaturedMatchBanner';
import type { Match } from '../../../types/api';

const fetchMatchVoters = vi.fn();
vi.mock('../../../services/api', () => ({
  fetchMatchVoters: (...args: unknown[]) => fetchMatchVoters(...args),
}));

const render = (ui: ReactElement) =>
  rtlRender(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      {ui}
    </QueryClientProvider>,
  );

const match = (fields: Partial<Match>) =>
  ({
    id: 1,
    home: 'Top Esports',
    away: 'Invictus Gaming',
    homeLogo: null,
    awayLogo: null,
    homeTeamLogo: null,
    awayTeamLogo: null,
    homeScore: null,
    awayScore: null,
    date: '2099-11-03T22:00:00Z',
    finished: false,
    displayClock: null,
    ...fields,
  }) as Match;

describe('FeaturedMatchBanner', () => {
  it('muestra ronda, escudos de los dos equipos y la fecha legible', () => {
    render(
      <FeaturedMatchBanner
        featuredMatch={match({ homeLogo: 'https://cdn.example.com/tes.png' })}
        roundTitle="Cuartos de final"
        awayLogo="https://cdn.example.com/ig.png"
      />,
    );

    const banner = screen.getByRole('region', { name: 'Próximo partido del cuadro' });
    expect(banner).toHaveTextContent('Cuartos de final');
    expect(screen.getByRole('img', { name: 'Top Esports' })).toHaveAttribute(
      'src',
      'https://cdn.example.com/tes.png',
    );
    expect(screen.getByRole('img', { name: 'Invictus Gaming' })).toHaveAttribute(
      'src',
      'https://cdn.example.com/ig.png',
    );
    expect(banner).toHaveTextContent('VS');
    expect(banner).toHaveTextContent(/nov/);
  });

  it('enseña el marcador de un partido terminado y las banderas del cuadro oficial', () => {
    render(
      <FeaturedMatchBanner
        featuredMatch={match({
          home: 'España',
          away: 'Argentina',
          homeScore: 3,
          awayScore: 1,
          finished: true,
          date: null,
        })}
      />,
    );

    const banner = screen.getByRole('region', { name: 'Próximo partido del cuadro' });
    expect(screen.getByRole('img', { name: 'España' })).toHaveAttribute('src', '/flags/es.svg');
    expect(banner).toHaveTextContent('3 - 1');
    expect(banner).toHaveTextContent('Final');
    expect(banner).toHaveTextContent('Fecha por confirmar');
  });

  it('no da por en juego un partido solo porque haya pasado su hora', () => {
    render(
      <FeaturedMatchBanner
        featuredMatch={match({ date: '2020-01-01T10:00:00Z', status: 'SCHEDULED' })}
      />,
    );

    expect(screen.getByRole('region', { name: 'Próximo partido del cuadro' })).toBeInTheDocument();
    expect(screen.queryByText(/En directo/)).toBeNull();
  });

  it('marca en juego un partido que ESPN da en directo', () => {
    render(
      <FeaturedMatchBanner
        featuredMatch={match({
          homeScore: 1,
          awayScore: 0,
          date: '2020-01-01T10:00:00Z',
          status: 'LIVE',
        })}
      />,
    );

    // El título ya lo dice: no se repite con un sello «En juego».
    expect(screen.getByRole('region', { name: 'En directo en el cuadro' })).toBeInTheDocument();
    expect(screen.queryByText('En juego')).toBeNull();
    expect(screen.queryByText('VS')).toBeNull();
  });

  it('en una competición personalizada pide el resultado después de la hora del partido', () => {
    render(
      <FeaturedMatchBanner featuredMatch={match({ date: '2020-01-01T10:00:00Z' })} manualResults />,
    );

    expect(
      screen.getByRole('region', { name: 'Partido pendiente de resultado' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('En juego')).toBeNull();
  });

  it('con el cruce cerrado muestra bajo cada equipo quién lo da por ganador, sin empate', async () => {
    fetchMatchVoters.mockResolvedValue([
      {
        matchId: 1,
        home: [{ userId: 1, name: 'Ana', avatarUrl: null }],
        draw: [],
        away: [{ userId: 2, name: 'Bea', avatarUrl: null }],
      },
    ]);
    render(<FeaturedMatchBanner featuredMatch={match({})} groupId={5} />);

    const home = await screen.findByRole('button', {
      name: 'Ver quién ha votado Top Esports en Top Esports - Invictus Gaming (1)',
    });
    expect(fetchMatchVoters).toHaveBeenCalledWith(5, [1]);
    expect(screen.queryByRole('button', { name: /votado X/ })).toBeNull();
    // Las fotos van dentro de la columna de cada equipo.
    expect(home.closest('div')).toHaveTextContent('Top Esports');

    fireEvent.click(home);
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Gana Top Esports')).toBeInTheDocument();
    expect(within(dialog).getByText('Bea')).toBeInTheDocument();
    expect(within(dialog).queryByText('Empate')).toBeNull();
  });

  it('sin liga no pide votantes', () => {
    fetchMatchVoters.mockClear();
    render(<FeaturedMatchBanner featuredMatch={match({})} />);
    expect(fetchMatchVoters).not.toHaveBeenCalled();
  });
});
