import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import FeaturedMatchBanner from '../../../components/official/FeaturedMatchBanner';
import type { Match } from '../../../types/api';

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

  it('marca en juego un partido empezado sin terminar', () => {
    render(
      <FeaturedMatchBanner
        featuredMatch={match({ homeScore: 1, awayScore: 0, date: '2020-01-01T10:00:00Z' })}
      />,
    );

    expect(screen.getByText('En juego')).toBeInTheDocument();
    expect(screen.queryByText('VS')).toBeNull();
  });
});
