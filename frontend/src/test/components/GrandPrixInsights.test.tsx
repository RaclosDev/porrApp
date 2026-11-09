import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import GrandPrixStats from '../../components/insights/GrandPrixStats';
import GrandPrixSearch from '../../components/insights/GrandPrixSearch';
import type { GrandPrix, GrandPrixMemberPick, GrandPrixPicks, RaceDriver } from '../../types/api';
import type { RaceEntry } from '../../utils/grandPrixStats';

const driver = (id: number, name: string, team: string): RaceDriver => ({
  id,
  name,
  shortName: name.replace(/^(\w)\w* /, '$1. '),
  country: null,
  flagUrl: null,
  team,
  teamColor: 'ff8000',
  number: null,
});
const drivers = new Map(
  [
    driver(1, 'Lando Norris', 'McLaren'),
    driver(2, 'Oscar Piastri', 'McLaren'),
    driver(3, 'Max Verstappen', 'Red Bull'),
    driver(4, 'Charles Leclerc', 'Ferrari'),
  ].map((d) => [d.id, d]),
);

const picks = (
  first: number | null,
  second: number | null,
  third: number | null,
  pole: number | null,
  fastestLap: number | null = null,
): GrandPrixPicks => ({ first, second, third, pole, fastestLap });

const gp = (id: number, name: string, result: GrandPrixPicks | null): GrandPrix => ({
  id,
  name,
  circuit: null,
  city: null,
  country: null,
  sprint: false,
  lockAt: null,
  raceAt: null,
  status: 'FINISHED',
  locked: true,
  gridIds: [],
  result,
  pick: null,
  points: null,
  details: null,
});

const member = (userId: number, name: string, pick: GrandPrixPicks): GrandPrixMemberPick => ({
  userId,
  name,
  avatarUrl: null,
  mine: userId === 10,
  pick,
  points: null,
  details: null,
});

const races: RaceEntry[] = [
  {
    gp: gp(1, 'GP de España', picks(1, 2, 3, 1, 3)),
    picks: [
      member(10, 'Ana', picks(1, 2, 4, 1, 3)),
      member(11, 'Berto', picks(3, 1, 2, 3)),
      member(12, 'Carla', picks(1, 3, 2, 2)),
    ],
  },
  {
    gp: gp(2, 'GP de Mónaco', picks(null, null, null, 3)),
    picks: [member(10, 'Ana', picks(3, 1, 2, 3)), member(11, 'Berto', picks(1, 3, 4, 1))],
  },
];

const renderAt = (path: string, element: React.ReactNode) =>
  render(<MemoryRouter initialEntries={[path]}>{element}</MemoryRouter>);

describe('Más elegidos de la Fórmula 1', () => {
  it('abre el último Gran Premio cerrado y deja pasar a los anteriores', () => {
    renderAt('/stats', <GrandPrixStats races={races} drivers={drivers} />);

    expect(screen.getByLabelText('Gran Premio')).toHaveValue('2');
    expect(screen.getByText(/^2 predicciones/)).toBeInTheDocument();
    // Con la clasificación hecha solo se sabe la pole.
    const pole = screen.getByRole('region', { name: 'Pole más elegida' });
    expect(pole).toHaveTextContent('Pole de M. Verstappen. Lo acertó el 50 % de la liga.');
    expect(screen.getByRole('region', { name: 'Ganador más elegido' })).toHaveTextContent(
      'Aún sin resultado',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Gran Premio anterior' }));
    expect(screen.getByLabelText('Gran Premio')).toHaveValue('1');
    expect(screen.getByRole('button', { name: 'Gran Premio anterior' })).toBeDisabled();
  });

  it('compara lo más elegido con el resultado y enlaza cada piloto con el buscador', () => {
    renderAt('/stats?gp=1', <GrandPrixStats races={races} drivers={drivers} />);

    const winner = screen.getByRole('region', { name: 'Ganador más elegido' });
    expect(winner).toHaveTextContent('Ganó L. Norris. Lo acertó el 67 % de la liga.');
    const rows = within(winner).getAllByRole('link');
    expect(rows[0]).toHaveTextContent('L. Norris');
    expect(rows[0]).toHaveTextContent('2 de 3');
    expect(rows[0]).toHaveTextContent('Ganó');
    expect(rows[0]).toHaveAttribute('href', '/search?driver=1&slot=first');
    expect(rows[1]).toHaveTextContent('No ganó');

    const podium = screen.getByRole('region', { name: 'Más elegidos para el podio' });
    expect(podium).toHaveTextContent('Podio: L. Norris, O. Piastri y M. Verstappen.');
    expect(podium).toHaveTextContent('cada predicción acertó 2,7 de 3 pilotos del podio');
    // Leclerc, que no subió al podio.
    expect(within(podium).getByRole('link', { name: /Leclerc/ })).toHaveTextContent(
      'Fuera del podio',
    );

    // Carla no eligió vuelta rápida: una de tres.
    expect(screen.getByRole('region', { name: 'Vuelta rápida más elegida' })).toHaveTextContent(
      '1 de 3',
    );
  });

  it('avisa cuando nadie predijo el Gran Premio', () => {
    renderAt(
      '/stats',
      <GrandPrixStats races={[{ gp: races[0].gp, picks: [] }]} drivers={drivers} />,
    );

    expect(screen.getByText('Nadie hizo predicción en este Gran Premio')).toBeInTheDocument();
  });
});

describe('Buscador de pilotos', () => {
  const search = (path: string) =>
    renderAt(
      path,
      <GrandPrixSearch races={races} drivers={drivers} leagueName="Paddock" groupId="7" />,
    );

  it('ofrece los pilotos elegidos por escudería y los favoritos de atajo', () => {
    search('/search');

    const select = screen.getByLabelText('¿Quién de la liga pone a…?');
    expect(within(select).getByRole('group', { name: 'McLaren' })).toBeInTheDocument();
    expect(
      within(select)
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['Elige un piloto', 'C. Leclerc', 'L. Norris', 'O. Piastri', 'M. Verstappen']);
    expect(screen.getByText('Elige un piloto', { selector: 'p' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'M. Verstappen' }));
    expect(screen.getByRole('heading', { name: 'Max Verstappen' })).toBeInTheDocument();
  });

  it('dice quién puso al piloto en cada Gran Premio y en qué puesto', () => {
    search('/search?driver=3');

    // Sin puesto pedido: en cualquiera. Las cinco predicciones de la temporada lo tienen.
    expect(screen.getByRole('button', { name: /En cualquier puesto/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByText(/5 de 5 predicciones de la temporada \(100 %\)/)).toBeInTheDocument();

    const monaco = screen.getByRole('heading', { name: /GP de Mónaco/ }).closest('li')!;
    expect(monaco).toHaveTextContent('Resultado: Pole');
    expect(within(monaco).getByText('Ana (tú)').closest('li')).toHaveTextContent(
      '1.º · Pole (acierto)',
    );
    const spain = screen.getByRole('heading', { name: /GP de España/ }).closest('li')!;
    expect(spain).toHaveTextContent('Resultado: 3.º · Vuelta rápida');
    expect(within(spain).getByText('Carla').closest('li')).toHaveTextContent('2.º');
  });

  it('al elegir un puesto deja solo a quienes lo ponen ahí', () => {
    search('/search?driver=3&slot=pole');

    expect(screen.getByRole('heading', { name: 'M. Verstappen · Pole' })).toBeInTheDocument();
    expect(screen.getByText(/2 de 5 predicciones de la temporada/)).toBeInTheDocument();
    const spain = screen.getByRole('heading', { name: /GP de España/ }).closest('li')!;
    expect(within(spain).getByText('Berto')).toBeInTheDocument();
    expect(within(spain).queryByText('Carla')).toBeNull();
    expect(within(spain).getByText('No se cumplió')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Ganador/ }));
    expect(screen.getByRole('heading', { name: 'M. Verstappen · Ganador' })).toBeInTheDocument();
  });

  it('ignora un piloto que nadie ha puesto', () => {
    search('/search?driver=99');

    expect(screen.getByLabelText('¿Quién de la liga pone a…?')).toHaveValue('');
  });
});
