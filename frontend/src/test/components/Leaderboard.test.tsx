import { appContext, participantScore } from '../context/fixtures';
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
    vi.mocked(useAppContext).mockReturnValue(
      appContext({
        leaderboardData: sampleLeaderboard.map(participantScore),
        loading: false,
        activeGroupName: 'Liga Santander',
        activeGroupId: '1',
        activeGroupPichichi: false,
        activeGroupPoolFormat: 'MATCH_DAY',
        leagueKind: 'matchday',
        activeGroupAdminId: 1,
        userId: '10',
        userName: 'Carlos',
      }),
    );

    render(
      <MemoryRouter>
        <Leaderboard />
      </MemoryRouter>,
    );

    const headers = screen.getAllByRole('columnheader');
    expect(
      screen.queryByRole('tablist', { name: 'Vista de la clasificación' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Compartir clasificación' })).toBeVisible();
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

  it('incluye los tres primeros como cromos en la imagen y deja el resto en la lista', () => {
    const leaderboard = [
      participantScore({ id: 1, userId: 10, name: 'Carlos', total: 150 }),
      participantScore({ id: 2, userId: 20, name: 'Elena', total: 120 }),
      participantScore({ id: 3, userId: 30, name: 'Jokin', total: 100 }),
      participantScore({ id: 4, userId: 40, name: 'Marta', total: 40 }),
    ];
    vi.mocked(useAppContext).mockReturnValue(
      appContext({
        activeGroupId: '1',
        leaderboardData: leaderboard,
        activeGroupPoolFormat: 'FULL_BRACKET',
        activeGroupName: 'Liga Santander',
        loading: false,
      }),
    );

    const { container } = render(
      <MemoryRouter>
        <Leaderboard />
      </MemoryRouter>,
    );

    const shareImage = container.querySelector('#share-image-template');
    const stickers = Array.from(shareImage?.querySelectorAll('.share-image-podium-card') ?? []);
    const remainingRows = shareImage?.querySelectorAll('.share-image-ranking-row');

    expect(stickers).toHaveLength(3);
    expect(stickers.map((sticker) => sticker.textContent)).toEqual([
      expect.stringContaining('Carlos'),
      expect.stringContaining('Elena'),
      expect.stringContaining('Jokin'),
    ]);
    expect(remainingRows).toHaveLength(1);
    expect(remainingRows?.[0]).toHaveTextContent('Marta');
  });

  it('agrupa los empates del podio de jornadas como en la vista móvil', () => {
    const leaderboard = [
      participantScore({ id: 1, userId: 10, name: 'Carlos', total: 150 }),
      participantScore({ id: 2, userId: 20, name: 'Elena', total: 120 }),
      participantScore({ id: 3, userId: 30, name: 'Jokin', total: 120 }),
      participantScore({ id: 4, userId: 40, name: 'Marta', total: 80 }),
      participantScore({ id: 5, userId: 50, name: 'Pablo', total: 40 }),
    ];
    vi.mocked(useAppContext).mockReturnValue(
      appContext({
        activeGroupId: '1',
        leaderboardData: leaderboard,
        activeGroupPoolFormat: 'MATCH_DAY',
        leagueKind: 'matchday',
        activeGroupName: 'Liga Santander',
        loading: false,
      }),
    );

    const { container } = render(
      <MemoryRouter>
        <Leaderboard />
      </MemoryRouter>,
    );

    const shareImage = container.querySelector('#share-image-template');
    const stickers = shareImage?.querySelectorAll('.share-image-podium-card');

    expect(stickers).toHaveLength(3);
    expect(stickers?.[1]).toHaveTextContent('Empate');
    expect(stickers?.[1]).toHaveTextContent('Elena · Jokin');
    expect(shareImage?.querySelectorAll('.share-image-ranking-row')).toHaveLength(1);
    expect(shareImage?.querySelector('.share-image-ranking-row')).toHaveTextContent('Pablo');
  });

  it('en la NFL habla de la semana actual', () => {
    vi.mocked(useAppContext).mockReturnValue(
      appContext({
        leaderboardData: sampleLeaderboard.map(participantScore),
        leaderboardMatchdays: [
          {
            date: null,
            label: 'Semana 9',
            current: true,
            finished: false,
            matchCount: 15,
            pointsByPrediction: {},
          },
        ],
        loading: false,
        activeGroupName: 'NFL Pick em',
        activeGroupId: '1',
        activeGroupPichichi: false,
        activeGroupPoolFormat: 'MATCH_DAY',
        leagueKind: 'matchday',
        activeGroupAdminId: 1,
        userId: '10',
        userName: 'Carlos',
      }),
    );

    render(
      <MemoryRouter>
        <Leaderboard />
      </MemoryRouter>,
    );

    expect(screen.getByText('Semana actual')).toBeInTheDocument();
  });

  it('muestra la jornada actual y permite navegar por las jornadas', () => {
    vi.mocked(useAppContext).mockReturnValue(
      appContext({
        leaderboardData: sampleLeaderboard.map(participantScore),
        leaderboardMatchdays: [
          {
            date: null,
            label: 'Jornada 1',
            current: false,
            finished: true,
            matchCount: 2,
            pointsByPrediction: { 1: 3 },
          },
          {
            date: null,
            label: 'Jornada 2',
            current: true,
            finished: false,
            matchCount: 2,
            pointsByPrediction: { 1: 4 },
          },
        ],
        loading: false,
        activeGroupName: 'Liga Santander',
        activeGroupId: '1',
        activeGroupPichichi: false,
        activeGroupPoolFormat: 'MATCH_DAY',
        leagueKind: 'matchday',
        activeGroupAdminId: 1,
        userId: '10',
        userName: 'Carlos',
      }),
    );

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

    vi.mocked(useAppContext).mockReturnValue(
      appContext({
        leaderboardData: twoParticipants.map(participantScore),
        leaderboardMatchdays: [
          {
            date: null,
            label: 'Jornada 1',
            current: false,
            finished: true,
            matchCount: 2,
            pointsByPrediction: { 1: 3, 2: 1 },
          },
          {
            date: null,
            label: 'Jornada 2',
            current: true,
            finished: false,
            matchCount: 2,
            pointsByPrediction: { 1: 4, 2: 8 },
          },
        ],
        loading: false,
        activeGroupName: 'Liga Santander',
        activeGroupId: '1',
        activeGroupPichichi: false,
        activeGroupPoolFormat: 'MATCH_DAY',
        leagueKind: 'matchday',
        activeGroupAdminId: 1,
        userId: '10',
        userName: 'Carlos',
      }),
    );

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
    vi.mocked(useAppContext).mockReturnValue(
      appContext({
        leaderboardData: [participantScore({ ...sampleLeaderboard[0], pending: true })],
        leaderboardMatchdays: [],
        loading: false,
        activeGroupName: 'Liga Santander',
        activeGroupId: '1',
        activeGroupPichichi: false,
        activeGroupPoolFormat: 'MATCH_DAY',
        leagueKind: 'matchday',
        activeGroupAdminId: 1,
        userId: '20',
        userName: 'Otro',
      }),
    );

    render(
      <MemoryRouter>
        <Leaderboard />
      </MemoryRouter>,
    );

    expect(screen.getByText('Sin pagar')).toBeInTheDocument();
    expect(screen.queryByText(/Pendiente/)).not.toBeInTheDocument();
  });

  it('muestra las columnas del cuadro eliminatorio en modalidad FULL_BRACKET', () => {
    vi.mocked(useAppContext).mockReturnValue(
      appContext({
        leaderboardData: sampleLeaderboard.map(participantScore),
        loading: false,
        activeGroupName: 'Mundial 2026',
        activeGroupId: '2',
        activeGroupPichichi: true,
        activeGroupPoolFormat: 'FULL_BRACKET',
        activeGroupAdminId: 1,
        userId: '10',
        userName: 'Carlos',
      }),
    );

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

  it('sin liga ni sesión invita a iniciar sesión en vez de mostrar una tabla vacía', () => {
    vi.mocked(useAppContext).mockReturnValue(
      appContext({ activeGroupId: undefined, userName: undefined, loading: false }),
    );

    render(
      <MemoryRouter>
        <Leaderboard />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: 'Iniciar sesión' })).toHaveAttribute('href', '/');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('muestra la carga mientras el ranking no ha llegado, sin podio a cero', () => {
    vi.mocked(useAppContext).mockReturnValue(
      appContext({ activeGroupId: '1', loadingLeaderboard: true, loading: false }),
    );

    render(
      <MemoryRouter>
        <Leaderboard />
      </MemoryRouter>,
    );

    expect(screen.queryByText(/0 pts/)).not.toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});
