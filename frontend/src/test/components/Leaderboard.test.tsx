import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Leaderboard from '../../pages/Leaderboard';
import { useAppContext } from '../../context/AppContext';

vi.mock('../../context/AppContext', () => ({
  useAppContext: vi.fn(),
}));

describe('Leaderboard Component', () => {
  const sampleLeaderboard = [
    {
      id: 1,
      userId: 10,
      name: 'Carlos',
      predictionName: 'Porra 1',
      total: 25,
      matchPoints: 25,
      r1: 0,
      r32: 0,
      r16: 0,
      qf: 0,
      sf: 0,
      finals: 0,
      scorer: 0,
      pending: false,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('alinea exactamente los encabezados y celdas en modalidad MATCH_DAY', () => {
    useAppContext.mockReturnValue({
      leaderboardData: sampleLeaderboard,
      loading: false,
      activeGroupName: 'Liga Santander',
      activeGroupId: 1,
      activeGroupPichichi: false,
      activeGroupPoolFormat: 'MATCH_DAY',
      activeGroupPoolFormat: 'MATCH_DAY',
      activeGroupAdminId: 1,
      userId: 10,
      userName: 'Carlos',
    });

    render(
      <MemoryRouter>
        <Leaderboard />
      </MemoryRouter>,
    );

    const headers = screen.getAllByRole('columnheader');
    expect(
      screen.queryByRole('tablist', { name: 'Vista de la clasificación' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Compartir en WhatsApp' })).not.toBeInTheDocument();
    expect(headers.map((h) => h.textContent?.replace(/[▼▲\s]/g, ''))).toEqual([
      'Pos',
      'Participante',
      'Total',
      'Puntosdejornada',
    ]);

    const row = screen.getByRole('row', { name: /Carlos/ });
    const cells = row.querySelectorAll('td');
    expect(cells.length).toBe(headers.length);
  });

  it('muestra la jornada actual y permite navegar por las jornadas', () => {
    useAppContext.mockReturnValue({
      leaderboardData: sampleLeaderboard,
      leaderboardMatchdays: [
        {
          label: 'Jornada 1',
          current: false,
          finished: true,
          matchCount: 2,
          pointsByPrediction: { 1: 3 },
        },
        {
          label: 'Jornada 2',
          current: true,
          finished: false,
          matchCount: 2,
          pointsByPrediction: { 1: 4 },
        },
      ],
      loading: false,
      activeGroupName: 'Liga Santander',
      activeGroupId: 1,
      activeGroupPichichi: false,
      activeGroupPoolFormat: 'MATCH_DAY',
      activeGroupPoolFormat: 'MATCH_DAY',
      activeGroupAdminId: 1,
      userId: 10,
      userName: 'Carlos',
    });

    render(
      <MemoryRouter>
        <Leaderboard />
      </MemoryRouter>,
    );

    const select = screen.getByLabelText('Seleccionar jornada');
    expect(select).toHaveValue('Jornada 2');
    expect(screen.getByText('Jornada actual')).toBeInTheDocument();

    const headers = screen.getAllByRole('columnheader');
    expect(headers.map((h) => h.textContent?.replace(/[▼▲\s]/g, ''))).toEqual([
      'Pos',
      'Participante',
      'Total',
      'J2',
    ]);

    const row = screen.getByRole('row', { name: /Carlos/ });
    expect(row.querySelectorAll('td')[3]).toHaveTextContent('4');

    fireEvent.change(select, { target: { value: 'Jornada 1' } });

    expect(select).toHaveValue('Jornada 1');
    expect(row.querySelectorAll('td')[3]).toHaveTextContent('3');
    expect(screen.getByText('Finalizada')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Jornada anterior' })).toBeDisabled();
  });

  it('ordena por la jornada seleccionada al pulsar su columna', () => {
    const twoParticipants = [
      ...sampleLeaderboard,
      {
        id: 2,
        userId: 20,
        name: 'Laura',
        predictionName: 'Porra 2',
        total: 10,
        matchPoints: 10,
        r1: 0,
        r32: 0,
        r16: 0,
        qf: 0,
        sf: 0,
        finals: 0,
        scorer: 0,
        pending: false,
      },
    ];

    useAppContext.mockReturnValue({
      leaderboardData: twoParticipants,
      leaderboardMatchdays: [
        {
          label: 'Jornada 1',
          current: false,
          finished: true,
          matchCount: 2,
          pointsByPrediction: { 1: 3, 2: 1 },
        },
        {
          label: 'Jornada 2',
          current: true,
          finished: false,
          matchCount: 2,
          pointsByPrediction: { 1: 4, 2: 8 },
        },
      ],
      loading: false,
      activeGroupName: 'Liga Santander',
      activeGroupId: 1,
      activeGroupPichichi: false,
      activeGroupPoolFormat: 'MATCH_DAY',
      activeGroupPoolFormat: 'MATCH_DAY',
      activeGroupAdminId: 1,
      userId: 10,
      userName: 'Carlos',
    });

    render(
      <MemoryRouter>
        <Leaderboard />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByTitle('Ordenar por Jornada 2'));

    const rows = screen.getAllByRole('row').slice(1);
    expect(rows[0]).toHaveTextContent('Laura');
    expect(rows[1]).toHaveTextContent('Carlos');
  });

  it('muestra "Sin pagar" en participantes con el pago pendiente', () => {
    useAppContext.mockReturnValue({
      leaderboardData: [{ ...sampleLeaderboard[0], pending: true }],
      leaderboardMatchdays: [],
      loading: false,
      activeGroupName: 'Liga Santander',
      activeGroupId: 1,
      activeGroupPichichi: false,
      activeGroupPoolFormat: 'MATCH_DAY',
      activeGroupPoolFormat: 'MATCH_DAY',
      activeGroupAdminId: 1,
      userId: 20,
      userName: 'Otro',
    });

    render(
      <MemoryRouter>
        <Leaderboard />
      </MemoryRouter>,
    );

    expect(screen.getByText('Sin pagar')).toBeInTheDocument();
    expect(screen.queryByText(/Pendiente/)).not.toBeInTheDocument();
  });

  it('muestra las columnas del cuadro eliminatorio en modalidad FULL_BRACKET', () => {
    useAppContext.mockReturnValue({
      leaderboardData: sampleLeaderboard,
      loading: false,
      activeGroupName: 'Mundial 2026',
      activeGroupId: 2,
      activeGroupPichichi: true,
      activeGroupPoolFormat: 'FULL_BRACKET',
      activeGroupPoolFormat: 'FULL_BRACKET',
      activeGroupAdminId: 1,
      userId: 10,
      userName: 'Carlos',
    });

    render(
      <MemoryRouter>
        <Leaderboard />
      </MemoryRouter>,
    );

    const headers = screen.getAllByRole('columnheader');
    expect(headers.map((h) => h.textContent?.replace(/[▼▲\s]/g, ''))).toContain('Dieciseisavos');
    expect(headers.map((h) => h.textContent?.replace(/[▼▲\s]/g, ''))).toContain('Octavos');
    expect(headers.map((h) => h.textContent?.replace(/[▼▲\s]/g, ''))).toContain('Pichichi');

    const row = screen.getByRole('row', { name: /Carlos/ });
    const cells = row.querySelectorAll('td');
    expect(cells.length).toBe(headers.length);
  });
});
