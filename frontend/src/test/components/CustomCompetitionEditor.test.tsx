import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import CustomCompetitionEditor from '../../components/groups/CustomCompetitionEditor';
import type { Group, Match, PoolFormat } from '../../types/api';

const api = vi.hoisted(() => ({
  fetchCustomTeams: vi.fn(),
  fetchCustomMatches: vi.fn(),
  addCustomTeam: vi.fn(),
  setCustomTeamLogo: vi.fn(),
  deleteCustomTeam: vi.fn(),
  addCustomMatch: vi.fn(),
  setCustomResult: vi.fn(),
  setCustomMatchDate: vi.fn(),
  deleteCustomMatch: vi.fn(),
  setCustomLockDate: vi.fn(),
  fetchCustomLockState: vi.fn(),
  setCustomLockConfig: vi.fn(),
  fetchCompetitions: vi.fn(),
  linkOfficialCompetition: vi.fn(),
}));

const LOCK_STATE = {
  mode: 'FIXED_DATE',
  offsetMinutes: 0,
  lockDate: null,
  lockedGroups: [],
  lockedPicks: [],
  anyLocked: false,
  fullyLocked: false,
  nextLockAt: null,
};

vi.mock('../../services/api', () => api);

const TEAMS = [
  { id: 1, name: 'Leones', groupName: 'A', logoUrl: null },
  { id: 2, name: 'Tigres', groupName: 'A', logoUrl: 'https://example.com/tigres.png' },
  { id: 3, name: 'Osos', groupName: 'B', logoUrl: null },
];

const match = (overrides: Partial<Match>): Match => ({
  id: 10,
  home: 'Leones',
  away: 'Tigres',
  home_team_id: 1,
  away_team_id: 2,
  homeLogo: null,
  awayLogo: null,
  homeTeamLogo: null,
  awayTeamLogo: null,
  homeScore: null,
  awayScore: null,
  home_score: null,
  away_score: null,
  date: '2026-12-01T18:00:00',
  finished: false,
  round: 'group',
  groupName: 'A',
  winner: null,
  displayClock: null,
  isStartingSoon: false,
  status: 'SCHEDULED',
  ...overrides,
});

const group = (poolFormat: PoolFormat, lockDate: string | null = null): Group => ({
  id: 7,
  name: 'Torneo del barrio',
  joinCode: 'ABC',
  adminParticipantName: 'Raclos',
  adminUserId: 1,
  createdAt: null,
  competitionId: 99,
  customCompetition: true,
  competitionName: 'Copa del barrio',
  formatType: null,
  poolFormat,
  pichichi: false,
  lockDate,
  isLocked: false,
  rules: null,
  imageUrl: null,
});

describe('CustomCompetitionEditor', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    Object.values(api).forEach((fn) => fn.mockReset().mockResolvedValue(undefined));
    api.fetchCustomTeams.mockResolvedValue(TEAMS);
    api.fetchCustomMatches.mockResolvedValue([]);
    api.fetchCustomLockState.mockResolvedValue(LOCK_STATE);
    api.fetchCompetitions.mockResolvedValue([
      { id: 4, name: 'LaLiga EA Sports', externalId: 'esp.1', formatType: 'LEAGUE' },
      { id: 10, name: 'Copa del Rey', externalId: 'esp.copa_del_rey', formatType: 'TOURNAMENT' },
      {
        id: 19,
        name: 'Worlds de League of Legends',
        externalId: 'lol.worlds',
        formatType: 'TOURNAMENT',
      },
    ]);
    api.setCustomLockConfig.mockImplementation((_id: number, config: object) => {
      const state = { ...LOCK_STATE, ...config };
      api.fetchCustomLockState.mockResolvedValue(state);
      return Promise.resolve(state);
    });
  });

  const setup = (poolFormat: PoolFormat = 'FULL_BRACKET', lockDate: string | null = null) => {
    const onClose = vi.fn();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    render(
      <QueryClientProvider client={queryClient}>
        <CustomCompetitionEditor group={group(poolFormat, lockDate)} onClose={onClose} />
      </QueryClientProvider>,
    );
    return { onClose, invalidate };
  };

  const openTab = async (name: RegExp) => {
    fireEvent.click(await screen.findByRole('tab', { name }));
  };

  it('abre un diálogo por secciones con el resumen de lo que falta', async () => {
    setup();

    expect(screen.getByRole('dialog', { name: 'Copa del barrio' })).toBeInTheDocument();
    expect(await screen.findByText('Elige cuándo se cierran las predicciones')).toBeInTheDocument();
    expect(screen.getByText('Crea los partidos de grupos')).toBeInTheDocument();
    expect(screen.getByText('Faltan 3 pasos')).toBeInTheDocument();
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      'Resumen',
      'Equipos3',
      'Partidos0',
      'Resultados0',
    ]);
  });

  it('cambia de sección con las flechas y cierra con Escape', async () => {
    const { onClose } = setup();
    const summary = await screen.findByRole('tab', { name: /Resumen/ });

    fireEvent.keyDown(summary, { key: 'ArrowRight' });
    const teams = screen.getByRole('tab', { name: /Equipos/ });
    expect(teams).toHaveAttribute('aria-selected', 'true');
    expect(teams).toHaveFocus();
    fireEvent.keyDown(teams, { key: 'End' });
    expect(screen.getByRole('tab', { name: /Resultados/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('guarda el cierre de pronósticos y refresca la liga', async () => {
    const { invalidate } = setup();

    fireEvent.change(await screen.findByLabelText('Fecha y hora de cierre'), {
      target: { value: '2026-12-01T12:00' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cierre' }));

    await waitFor(() =>
      expect(api.setCustomLockConfig).toHaveBeenCalledWith(7, {
        mode: 'FIXED_DATE',
        offsetMinutes: 0,
        lockDate: '2026-12-01T12:00',
      }),
    );
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ['group', '7'] }));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['myGroups'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['customTeams', '7'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['customMatches', '7'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['customLockState', '7'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['leaderboard', '7'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['leaderboardMatchdays', '7'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['predictionScore'] });
  });

  it('cierra por partidos con un margen en horas', async () => {
    setup();

    expect(
      await screen.findByText(/Puedes cambiar el criterio aunque ya haya predicciones/),
    ).toBeInTheDocument();
    fireEvent.click(await screen.findByRole('radio', { name: 'Por partidos' }));
    fireEvent.change(screen.getByLabelText('Margen antes del partido'), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cierre' }));

    await waitFor(() =>
      expect(api.setCustomLockConfig).toHaveBeenCalledWith(7, {
        mode: 'PER_MATCH',
        offsetMinutes: 120,
        lockDate: null,
      }),
    );
    expect(await screen.findByText(/Por partidos · 2 horas antes/)).toBeInTheDocument();
  });

  it('no pide cierre en las ligas por jornadas', async () => {
    setup('MATCH_DAY');

    expect(await screen.findByText('Crea los partidos de cada jornada')).toBeInTheDocument();
    expect(screen.queryByLabelText('Fecha y hora de cierre')).not.toBeInTheDocument();
  });

  it('añade equipos con grupo y escudo y muestra el error del servidor', async () => {
    setup();
    await openTab(/Equipos/);

    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: ' Lobos ' } });
    fireEvent.change(screen.getByLabelText('Grupo'), { target: { value: 'B' } });
    fireEvent.change(screen.getByLabelText('Escudo (opcional)'), {
      target: { value: 'https://example.com/lobos.png' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Añadir equipo' }));
    await waitFor(() =>
      expect(api.addCustomTeam).toHaveBeenCalledWith(
        7,
        'Lobos',
        'B',
        'https://example.com/lobos.png',
      ),
    );
    await waitFor(() => expect(screen.getByLabelText('Nombre')).toHaveValue(''));
    expect(screen.getByLabelText('Grupo')).toHaveValue('B');

    api.addCustomTeam.mockRejectedValueOnce(
      new Error('No se pueden cambiar los equipos después de la primera predicción'),
    );
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Linces' } });
    fireEvent.click(screen.getByRole('button', { name: 'Añadir equipo' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No se pueden cambiar los equipos después de la primera predicción',
    );
    expect(screen.getByLabelText('Nombre')).toHaveValue('Linces');
  });

  it('agrupa los equipos y permite cambiar el escudo o borrarlos', async () => {
    setup();
    await openTab(/Equipos/);

    expect(screen.getByRole('heading', { name: 'Grupo A' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Grupo B' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Cambiar el escudo de Tigres' }));
    const logo = screen.getByLabelText('Dirección del escudo de Tigres');
    expect(logo).toHaveValue('https://example.com/tigres.png');
    fireEvent.change(logo, { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar escudo' }));
    await waitFor(() => expect(api.setCustomTeamLogo).toHaveBeenCalledWith(7, 2, null));

    fireEvent.click(screen.getByRole('button', { name: 'Eliminar equipo Osos' }));
    expect(api.deleteCustomTeam).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Sí' }));
    await waitFor(() => expect(api.deleteCustomTeam).toHaveBeenCalledWith(7, 3));
  });

  it('en grupos solo ofrece rivales del mismo grupo', async () => {
    setup();
    await openTab(/Partidos/);

    fireEvent.change(screen.getByLabelText('Local'), { target: { value: '1' } });
    const away = screen.getByLabelText('Visitante');
    expect(
      within(away)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['Elige equipo', 'Tigres']);
    fireEvent.change(away, { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('Fecha y hora'), {
      target: { value: '2026-12-01T18:00' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Añadir partido' }));

    await waitFor(() =>
      expect(api.addCustomMatch).toHaveBeenCalledWith(7, 1, 2, '2026-12-01T18:00', 'group'),
    );
  });

  it('crea cruces con descanso en el cuadro', async () => {
    setup('KNOCKOUTS_ONLY');
    await openTab(/Partidos/);

    expect(screen.queryByLabelText('Fase')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Ronda')).toHaveAttribute('max', '1');
    fireEvent.change(screen.getByLabelText('Local'), { target: { value: '3' } });
    expect(screen.getByLabelText('Visitante')).toHaveDisplayValue('Descanso (pasa directo)');
    fireEvent.click(screen.getByRole('button', { name: 'Añadir partido' }));

    await waitFor(() =>
      expect(api.addCustomMatch).toHaveBeenCalledWith(7, 3, null, null, 'bracket-1'),
    );
  });

  it('lista los partidos por fase y los borra tras confirmar', async () => {
    api.fetchCustomMatches.mockResolvedValue([
      match({ id: 11 }),
      match({
        id: 12,
        round: 'bracket-1',
        groupName: null,
        away: '',
        away_team_id: null,
        date: null,
      }),
    ]);
    setup();
    await openTab(/Partidos/);

    expect(screen.getByRole('heading', { name: 'Grupo A' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Ronda 1' })).toBeInTheDocument();
    expect(screen.getByText('Descanso')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Eliminar el partido Leones – descanso' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sí' }));
    await waitFor(() => expect(api.deleteCustomMatch).toHaveBeenCalledWith(7, 12));
  });

  it('permite poner fecha a un cruce ya creado sin cambiar sus equipos', async () => {
    api.fetchCustomMatches.mockResolvedValue([
      match({ id: 20, round: 'bracket-1', groupName: null, date: null }),
    ]);
    setup('KNOCKOUTS_ONLY');
    await openTab(/Partidos/);

    fireEvent.click(
      await screen.findByRole('button', { name: 'Cambiar fecha de Leones – Tigres' }),
    );
    fireEvent.change(screen.getByLabelText('Fecha de Leones – Tigres'), {
      target: { value: '2026-12-02T20:00' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() =>
      expect(api.setCustomMatchDate).toHaveBeenCalledWith(7, 20, '2026-12-02T20:00'),
    );
  });

  it('pide el ganador del desempate en una eliminatoria empatada', async () => {
    api.fetchCustomMatches.mockResolvedValue([
      match({ id: 20, round: 'bracket-1', groupName: null }),
      match({ id: 21, round: 'bracket-1', groupName: null, away: '', away_team_id: null }),
    ]);
    setup('KNOCKOUTS_ONLY');
    await openTab(/Resultados/);

    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    fireEvent.change(screen.getByLabelText('Goles de Leones'), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText('Goles de Tigres'), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText('Ganador del desempate'), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar resultado de Leones – Tigres' }));

    await waitFor(() => expect(api.setCustomResult).toHaveBeenCalledWith(7, 20, 1, 1, 2));
  });

  it('separa los resultados pendientes de los ya metidos', async () => {
    api.fetchCustomMatches.mockResolvedValue([
      match({ id: 30 }),
      match({ id: 31, home: 'Osos', finished: true, homeScore: 2, awayScore: 0 }),
    ]);
    setup();
    await openTab(/Resultados/);

    expect(screen.getByRole('button', { name: 'Pendientes (1)' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByText('Leones')).toBeInTheDocument();
    expect(screen.queryByText('Osos')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Con resultado' }));
    expect(screen.getByLabelText('Goles de Osos')).toHaveValue(2);
    expect(
      screen.getByRole('button', { name: 'Guardar resultado de Osos – Tigres' }),
    ).toBeDisabled();
  });

  it('pasa la liga a una competición oficial tras confirmarlo', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { invalidate } = setup('KNOCKOUTS_ONLY');

    fireEvent.click(
      await screen.findByRole('button', { name: 'Pasar a Worlds de League of Legends' }),
    );

    await waitFor(() => expect(api.linkOfficialCompetition).toHaveBeenCalledWith(7, 19));
    expect(confirm).toHaveBeenCalled();
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith());
    confirm.mockRestore();
  });
});
