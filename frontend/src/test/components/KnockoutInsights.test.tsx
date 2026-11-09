import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import KnockoutInsightsGate from '../../components/insights/KnockoutInsightsGate';
import KnockoutSearch from '../../components/insights/KnockoutSearch';
import KnockoutStats from '../../components/insights/KnockoutStats';
import type { useKnockoutInsights } from '../../hooks/useKnockoutInsights';
import type { KnockoutRound, KnockoutTie } from '../../services/api';
import { fieldFromDraw, type KnockoutEntry } from '../../utils/knockoutStats';

const tie = (home: string, away: string, winner: string | null = null): KnockoutTie => ({
  home,
  away,
  winner,
  matchIds: [],
});
const round = (name: string, ties: KnockoutTie[], drawn = true): KnockoutRound => ({
  round: name,
  drawn,
  expectedTies: ties.length,
  ties,
});
const entry = (id: string, name: string, picks: (string | null)[][]): KnockoutEntry => ({
  id,
  name,
  userId: Number(id),
  picks,
});

/** Semifinales decididas (pasan Madrid e Inter) y final jugada: campeón, el Inter. */
const finished = fieldFromDraw([
  round('sf', [tie('Madrid', 'Bayern', 'Madrid'), tie('Inter', 'PSG', 'Inter')]),
  round('final', [tie('Madrid', 'Inter', 'Inter')]),
]);
const league = [
  entry('1', 'Ana', [['Madrid', 'Inter'], ['Madrid']]),
  entry('2', 'Berto', [['Bayern', 'Inter'], ['Inter']]),
  entry('3', 'Carla', [['Madrid', 'PSG'], ['Madrid']]),
];

const renderAt = (path: string, element: React.ReactNode) =>
  render(<MemoryRouter initialEntries={[path]}>{element}</MemoryRouter>);

describe('Más elegidos de un cuadro', () => {
  it('compara lo más elegido de cada ronda y el campeón con el cuadro real', () => {
    renderAt('/stats', <KnockoutStats entries={league} field={finished} logos={{}} />);

    const rounds = screen.getByRole('region', { name: 'Más elegidos por ronda' });
    expect(rounds).toHaveTextContent('Semifinales · 3 predicciones');
    const rows = within(rounds).getAllByRole('link');
    expect(rows[0]).toHaveTextContent('Inter');
    expect(rows[0]).toHaveTextContent('2 de 3');
    expect(rows[0]).toHaveTextContent('Pasó');
    expect(rows[0]).toHaveAttribute('href', '/search?team=Inter&round=0');
    expect(within(rounds).getByRole('link', { name: /Bayern/ })).toHaveTextContent('No pasó');
    expect(rounds).toHaveTextContent('cada predicción acertó 1,3 de 2 cruces decididos');

    const champion = screen.getByRole('region', { name: 'Campeón más elegido' });
    expect(champion).toHaveTextContent('Campeón: Inter. Lo acertó el 33 % de la liga.');
    const picks = within(champion).getAllByRole('link');
    expect(picks[0]).toHaveTextContent('Madrid');
    expect(picks[0]).toHaveTextContent('No fue campeón');
    expect(picks[0]).toHaveTextContent('Subcampeón');
    expect(picks[1]).toHaveAttribute('href', '/search?team=Inter&round=1');
  });

  it('con la final aún abierta solo sale la ronda cerrada', () => {
    const open = fieldFromDraw([
      round('sf', [tie('Madrid', 'Bayern'), tie('Inter', 'PSG')]),
      round('final', [], false),
    ]);
    const entries = [entry('1', 'Ana', [['Madrid', 'Inter']]), entry('2', 'Berto', [['Bayern']])];
    renderAt('/stats', <KnockoutStats entries={entries} field={open} logos={{}} />);

    expect(screen.queryByRole('region', { name: 'Campeón más elegido' })).toBeNull();
    const rounds = screen.getByRole('region', { name: 'Más elegidos por ronda' });
    // Berto no eligió en el Inter - PSG: el Inter se cuenta sobre quien sí lo hizo.
    expect(within(rounds).getByRole('link', { name: /Inter/ })).toHaveTextContent('1 de 1');
    expect(within(rounds).getByRole('link', { name: /Madrid/ })).toHaveTextContent('1 de 2');
  });
});

describe('Buscador de equipos de un cuadro', () => {
  const onOpen = vi.fn();
  const search = (path: string) =>
    renderAt(
      path,
      <KnockoutSearch
        entries={league}
        field={finished}
        logos={{}}
        leagueName="Champions"
        groupId="7"
        avatarByUserId={new Map()}
        onOpen={onOpen}
      />,
    );

  it('ofrece los equipos elegidos y los favoritos de atajo', () => {
    search('/search');

    const select = screen.getByLabelText('¿Quién de la liga pone a…?');
    expect(
      within(select)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['Elige un equipo', 'Bayern', 'Inter', 'Madrid', 'PSG']);
    expect(screen.getByText('Elige un equipo', { selector: 'p' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Madrid' }));
    expect(screen.getByRole('heading', { name: 'Madrid' })).toBeInTheDocument();
  });

  it('dice quién lleva al equipo a cada ronda y dónde lo deja fuera el resto', () => {
    search('/search?team=Madrid');

    expect(screen.getByText('Subcampeón')).toBeInTheDocument();
    // Sin ronda pedida, la más lejana a la que alguien lo lleva.
    expect(screen.getByRole('button', { name: /Campeón/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('heading', { name: 'Madrid · Campeón' })).toBeInTheDocument();
    expect(screen.getByText(/2 de 3 predicciones \(67 %\)/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ver el cuadro de Ana' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Ver el cuadro de Berto (Cae en semifinales)' }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Pasa de semifinales/ }));
    expect(
      screen.getByRole('heading', { name: 'Madrid · Pasa de semifinales' }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Ver el cuadro de Carla' }));
    expect(onOpen).toHaveBeenCalledWith('3');
  });

  it('ignora un equipo que nadie ha puesto', () => {
    search('/search?team=Oporto');

    expect(screen.getByLabelText('¿Quién de la liga pone a…?')).toHaveValue('');
  });
});

describe('Aviso antes de enseñar las estadísticas de un cuadro', () => {
  const insights = (over: Partial<ReturnType<typeof useKnockoutInsights>>) =>
    ({
      entries: league,
      field: finished,
      logos: {},
      sentCount: 3,
      nextLockAt: null,
      loading: false,
      error: false,
      hasLeague: true,
      groupId: '7',
      leagueName: 'Champions',
      avatarByUserId: new Map(),
      openPrediction: vi.fn(),
      ...over,
    }) as ReturnType<typeof useKnockoutInsights>;
  const gate = (over: Partial<ReturnType<typeof useKnockoutInsights>>) =>
    render(
      <KnockoutInsightsGate insights={insights(over)}>
        <p>Estadísticas</p>
      </KnockoutInsightsGate>,
    );

  it('sin nada cerrado no enseña lo que ha puesto nadie y dice cuándo se cierra', () => {
    gate({ entries: [], nextLockAt: '2026-11-28T21:00:00+01:00' });

    expect(screen.queryByText('Estadísticas')).toBeNull();
    expect(screen.getByText('Todavía no hay predicciones cerradas')).toBeInTheDocument();
    expect(screen.getByText(/El próximo cierre es el 28 de noviembre/)).toBeInTheDocument();
    expect(screen.getByText(/De momento hay 3 predicciones enviadas/)).toBeInTheDocument();
  });

  it('avisa sin liga o si falla la carga, y con algo cerrado enseña el contenido', () => {
    const { unmount } = gate({ hasLeague: false });
    expect(screen.getByText('No hay ninguna liga seleccionada')).toBeInTheDocument();
    unmount();

    const failed = gate({ error: true });
    expect(
      screen.getByText('No se han podido cargar las predicciones de la liga'),
    ).toBeInTheDocument();
    failed.unmount();

    gate({});
    expect(screen.getByText('Estadísticas')).toBeInTheDocument();
  });
});
