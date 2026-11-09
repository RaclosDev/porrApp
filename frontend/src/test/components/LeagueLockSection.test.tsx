import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import LeagueLockSection from '../../components/groups/LeagueLockSection';
import type { Group } from '../../types/api';

const api = vi.hoisted(() => ({
  fetchCustomLockState: vi.fn(),
  setCustomLockConfig: vi.fn(),
}));

vi.mock('../../services/api', () => api);

const LOCK_STATE = {
  mode: 'FIXED_DATE',
  offsetMinutes: 0,
  lockDate: '2026-11-10T09:00:00',
  lockedGroups: [],
  lockedPicks: [],
  anyLocked: false,
  fullyLocked: false,
  nextLockAt: null,
};

const group = (externalId: string, overrides: Partial<Group> = {}): Group => ({
  id: 8,
  name: 'LOL Worlds 2026',
  joinCode: 'XYZ',
  adminParticipantName: 'Raclos',
  adminUserId: 1,
  createdAt: null,
  competitionId: 19,
  competitionExternalId: externalId,
  customCompetition: false,
  competitionName: 'Worlds',
  formatType: 'TOURNAMENT',
  poolFormat: 'KNOCKOUTS_ONLY',
  pichichi: false,
  lockDate: '2026-11-10T09:00:00',
  isLocked: false,
  rules: null,
  imageUrl: null,
  ...overrides,
});

describe('LeagueLockSection', () => {
  beforeEach(() => {
    api.fetchCustomLockState.mockReset().mockResolvedValue(LOCK_STATE);
    api.setCustomLockConfig
      .mockReset()
      .mockImplementation((_id: number, config: object) =>
        Promise.resolve({ ...LOCK_STATE, ...config }),
      );
  });

  const setup = (externalId: string, overrides: Partial<Group> = {}) =>
    render(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <LeagueLockSection group={group(externalId, overrides)} />
      </QueryClientProvider>,
    );

  it('una liga oficial con cuadro propio puede cerrar por partidos', async () => {
    setup('lol.worlds');

    fireEvent.click(await screen.findByRole('radio', { name: 'Por partidos' }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cierre' }));

    await waitFor(() =>
      expect(api.setCustomLockConfig).toHaveBeenCalledWith(8, {
        mode: 'PER_MATCH',
        offsetMinutes: 0,
        lockDate: null,
      }),
    );
  });

  it('el Mundial solo ofrece cerrar en una fecha o en el primer partido', async () => {
    setup('fifa.world', { groupTournament: true });

    expect(
      await screen.findByRole('radio', { name: 'Al empezar el primer partido' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: 'Por partidos' })).not.toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: 'Por rondas' })).not.toBeInTheDocument();
  });

  it('una liga por jornadas cierra cada día la víspera', async () => {
    api.fetchCustomLockState.mockResolvedValue({
      ...LOCK_STATE,
      mode: 'PER_MATCH',
      lockDate: null,
    });
    setup('esp.1', { formatType: 'LEAGUE', poolFormat: 'MATCH_DAY', lockDate: null });

    fireEvent.click(await screen.findByRole('radio', { name: 'Por días' }));
    expect(screen.getByRole('radio', { name: 'Por jornadas' })).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: 'En una fecha fija' })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Margen antes del primer partido'), {
      target: { value: '1' },
    });
    fireEvent.change(screen.getByLabelText('Unidad del margen'), { target: { value: 'days' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cierre' }));

    await waitFor(() =>
      expect(api.setCustomLockConfig).toHaveBeenCalledWith(8, {
        mode: 'PER_DAY',
        offsetMinutes: 1440,
        lockDate: null,
      }),
    );
  });
});
