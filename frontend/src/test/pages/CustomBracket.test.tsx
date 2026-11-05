import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import CustomBracket from '../../pages/CustomBracket';
import * as api from '../../services/api';
import * as appContextModule from '../../context/AppContext';
import * as leaguePredictions from '../../hooks/useLeaguePredictions';
import { appContext } from '../context/fixtures';
import type { Match } from '../../types/api';

vi.mock('../../services/api');
vi.mock('../../context/AppContext');
vi.mock('react-hot-toast', () => ({ default: Object.assign(vi.fn(), { success: vi.fn() }) }));
vi.mock('../../hooks/useLeaguePredictions', () => ({ useMyLeaguePrediction: vi.fn() }));

const knockout = (id: number, home: string, away: string, fields: Partial<Match> = {}) =>
  ({
    id,
    home,
    away,
    home_team_id: id * 2,
    away_team_id: id * 2 + 1,
    round: 'bracket-1',
    finished: false,
    ...fields,
  }) as unknown as Match;

const renderBracket = () =>
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <CustomBracket />
    </QueryClientProvider>,
  );

/** Pulsa la casilla del equipo en el lienzo de escritorio. */
const pick = (name: string, index = 0) => {
  const board = screen.getAllByRole('button', { name: `Pasar a ${name}` });
  fireEvent.click(board[index]);
};

describe('CustomBracket', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(leaguePredictions.useMyLeaguePrediction).mockReturnValue(undefined);
    vi.mocked(appContextModule.useAppContext).mockReturnValue(
      appContext({
        activeGroupId: '10',
        activeGroupCustomCompetition: true,
        activeCompetitionId: null,
        activeGroupPoolFormat: 'KNOCKOUTS_ONLY',
        activeGroupName: 'LOL Worlds 2026',
        activeGroupIsLocked: false,
        activeGroupLockDate: '2026-11-07T00:00:00',
        userName: 'Tester',
      }),
    );
    vi.mocked(api.fetchCustomTeams).mockResolvedValue([]);
  });

  it('guarda automáticamente el cuadro completo sin botón al pie', async () => {
    vi.mocked(api.fetchCustomMatches).mockResolvedValue([
      knockout(1, 'T1', 'Gen.G'),
      knockout(2, 'HLE', 'DK'),
      knockout(3, 'BLG', 'TES'),
      knockout(4, 'WBG', 'LNG'),
    ]);
    vi.mocked(api.createPrediction).mockResolvedValue(undefined as never);
    vi.mocked(api.fetchCustomLockState).mockResolvedValue({
      mode: 'FIXED_DATE',
      offsetMinutes: 0,
      lockDate: '2026-11-07T00:00:00+01:00',
      lockedGroups: [],
      lockedPicks: [],
      anyLocked: false,
      fullyLocked: false,
      nextLockAt: '2026-11-07T00:00:00+01:00',
    });

    renderBracket();

    await waitFor(() => expect(api.fetchCustomMatches).toHaveBeenCalledWith(10));
    const left = within(await screen.findByRole('region', { name: 'Cruces del lado izquierdo' }));
    expect(left.getByRole('heading', { name: 'Cuartos' })).toBeInTheDocument();
    expect(screen.getAllByRole('tab', { name: 'Cuartos' })[0]).toBeInTheDocument();
    const center = within(screen.getByRole('region', { name: 'Semifinales y final' }));
    expect(center.getAllByText('Ganador C1').length).toBeGreaterThan(0);

    pick('T1');
    expect(screen.getAllByRole('button', { name: 'Pasar a T1' })[0]).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    pick('HLE');
    pick('BLG');
    pick('WBG');
    // Semifinales: T1 y BLG pasan a la final.
    fireEvent.click(center.getByRole('button', { name: 'Pasar a T1' }));
    fireEvent.click(center.getByRole('button', { name: 'Pasar a BLG' }));
    // Final.
    fireEvent.click(center.getAllByRole('button', { name: 'Pasar a T1' })[1]);

    // Solo hay un pronóstico por persona: no se pide nombre.
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Guardar pronóstico' })).toBeNull();

    await waitFor(() =>
      expect(api.createPrediction).toHaveBeenCalledWith(
        expect.objectContaining({
          prediction: 'Tester',
          customRounds: [['T1', 'HLE', 'BLG', 'WBG'], ['T1', 'BLG'], ['T1']],
          champion: 'T1',
        }),
        '10',
      ),
    );
    expect(await screen.findByText('✓ Guardado')).toBeInTheDocument();

    fireEvent.click(center.getAllByRole('button', { name: 'Pasar a BLG' })[1]);
    await waitFor(() =>
      expect(api.createPrediction).toHaveBeenLastCalledWith(
        expect.objectContaining({ champion: 'BLG' }),
        '10',
      ),
    );
    expect(api.createPrediction).toHaveBeenCalledTimes(2);

    // Repetir una elección no borra las rondas posteriores ya completadas.
    pick('T1');
    expect(center.getAllByRole('button', { name: 'Pasar a BLG' })[1]).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('en el cierre por partidos bloquea solo los cruces que ya han empezado', async () => {
    vi.mocked(leaguePredictions.useMyLeaguePrediction).mockReturnValue({
      key: '7',
      predictionName: 'Guardado',
      data: { customRounds: [['T1', 'HLE', 'BLG', 'WBG'], ['T1', 'BLG'], ['T1']] },
    } as unknown as ReturnType<typeof leaguePredictions.useMyLeaguePrediction>);
    vi.mocked(api.fetchCustomLockState).mockResolvedValue({
      mode: 'PER_MATCH',
      offsetMinutes: 0,
      lockDate: null,
      lockedGroups: [],
      lockedPicks: [[true, false, false, false], [false, false], [false]],
      anyLocked: true,
      fullyLocked: false,
      nextLockAt: null,
    });

    renderBracket();

    expect((await screen.findAllByRole('button', { name: 'Pasar a DK' })).length).toBeGreaterThan(
      0,
    );
    expect(screen.queryByText(/Lo que ya ha empezado/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Pasar a Gen.G' })).toBeNull();
    expect(screen.getAllByRole('button', { name: 'Pasar a DK' }).length).toBeGreaterThan(0);
  });

  it('no deja entrar a quien no tiene pronóstico cuando ya se ha cerrado algo', async () => {
    vi.mocked(api.fetchCustomLockState).mockResolvedValue({
      mode: 'PER_ROUND',
      offsetMinutes: 0,
      lockDate: null,
      lockedGroups: [],
      lockedPicks: [[true, true, true, true], [false, false], [false]],
      anyLocked: true,
      fullyLocked: false,
      nextLockAt: null,
    });

    renderBracket();

    expect(
      await screen.findByText('La competición ya ha empezado: no se admiten predicciones nuevas.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Guardar pronóstico' })).toBeNull();
  });

  it('marca aciertos y fallos del pronóstico guardado y pasa los descansos solos', async () => {
    vi.mocked(leaguePredictions.useMyLeaguePrediction).mockReturnValue({
      key: '7',
      predictionName: 'Guardado',
      data: { customRounds: [['Rayo', 'Club', 'Solo']] },
    } as unknown as ReturnType<typeof leaguePredictions.useMyLeaguePrediction>);
    vi.mocked(api.fetchCustomMatches).mockResolvedValue([
      knockout(1, 'Rayo', 'Barrio', { finished: true, winner: 'Rayo' }),
      knockout(2, 'Peña', 'Club', { finished: true, winner: 'Peña' }),
      knockout(3, 'Solo', '', { away_team_id: null }),
    ]);

    renderBracket();

    const left = within(await screen.findByRole('region', { name: 'Cruces del lado izquierdo' }));
    const right = within(screen.getByRole('region', { name: 'Cruces del lado derecho' }));
    // El equipo elegido se sombrea en verde o rojo y cada uno lleva su sello de clasificado o eliminado.
    const hit = left.getByText(/tu predicción, acertada/).closest('.team-slot');
    const miss = left.getByText(/tu predicción, fallada/).closest('.team-slot');
    expect(hit).toHaveClass('is-hit');
    expect(hit).toHaveTextContent('Rayo');
    expect(hit).toHaveTextContent('Clasificado');
    expect(miss).toHaveClass('is-miss');
    expect(miss).toHaveTextContent('Club');
    expect(miss).toHaveTextContent('Eliminado');
    expect(left.getByText('Peña').closest('.team-slot')).toHaveTextContent('Clasificado');
    expect(left.getByText('Barrio').closest('.team-slot')).toHaveClass('is-out');
    expect(screen.getByRole('list', { name: 'Leyenda del cuadro' })).toHaveTextContent(
      /Tu predicción.*Acertada.*Fallada/,
    );
    expect(right.getAllByText('Descanso').length).toBeGreaterThan(0);
    // El equipo que descansa no se elige: pasa solo a semifinales.
    expect(right.queryByRole('button', { name: 'Pasar a Solo' })).toBeNull();
    const center = within(screen.getByRole('region', { name: 'Semifinales y final' }));
    expect(center.getAllByText('Solo').length).toBeGreaterThan(0);
    // Al entrar con el pronóstico ya hecho no se muestra ningún aviso.
    expect(toast).not.toHaveBeenCalled();
    expect(screen.queryByText(/guardado/i)).toBeNull();
  });

  it('con el pronóstico completo abre en la ronda que aún tiene partidos por jugar', async () => {
    vi.mocked(leaguePredictions.useMyLeaguePrediction).mockReturnValue({
      key: '8',
      predictionName: 'Guardado',
      data: { customRounds: [['A', 'C', 'E', 'G'], ['A', 'E'], ['A']] },
    } as unknown as ReturnType<typeof leaguePredictions.useMyLeaguePrediction>);
    vi.mocked(api.fetchCustomMatches).mockResolvedValue([
      knockout(1, 'A', 'B', { finished: true, winner: 'A' }),
      knockout(2, 'C', 'D', { finished: true, winner: 'C' }),
      knockout(3, 'E', 'F'),
      knockout(4, 'G', 'H'),
    ]);

    renderBracket();

    const tabs = within(await screen.findByRole('tablist', { name: 'Rondas del cuadro' }));
    const [first] = tabs.getAllByRole('tab');
    expect(first).toHaveAttribute('aria-selected', 'true');
    expect(tabs.getByRole('tab', { name: /Semis y final/ })).toHaveAttribute(
      'aria-selected',
      'false',
    );
  });

  it('en un torneo oficial pronostica sobre los cruces reales con su estado de cierre', async () => {
    vi.mocked(appContextModule.useAppContext).mockReturnValue(
      appContext({
        activeGroupId: '10',
        activeGroupCustomCompetition: false,
        activeGroupOwnBracket: true,
        activeCompetitionExternalId: 'lol.worlds',
        activeGroupPoolFormat: 'FULL_BRACKET',
        activeGroupName: 'Worlds',
        activeGroupIsLocked: false,
        userName: 'Tester',
        allGames: [
          knockout(4, 'BLG', 'DK', { round: 'qf', date: '2026-11-02T10:00:00Z' }),
          knockout(2, 'IG', 'TOP', { round: 'qf', date: '2026-10-31T10:00:00Z' }),
          knockout(1, 'T1', 'KC', { round: 'qf', date: '2026-10-30T10:00:00Z' }),
          knockout(3, 'GEN', 'LYON', { round: 'qf', date: '2026-11-01T10:00:00Z' }),
          knockout(5, 'T1', 'IG', { round: 'group' }),
        ],
      }),
    );
    vi.mocked(api.createPrediction).mockResolvedValue({} as never);
    vi.mocked(api.fetchCustomLockState).mockResolvedValue({
      mode: 'FIXED_DATE',
      offsetMinutes: 0,
      lockDate: '2026-11-07T00:00:00+01:00',
      lockedGroups: [],
      lockedPicks: [],
      anyLocked: false,
      fullyLocked: false,
      nextLockAt: '2026-11-07T00:00:00+01:00',
    });
    renderBracket();

    expect(api.fetchCustomMatches).not.toHaveBeenCalled();
    expect((await screen.findAllByRole('button', { name: 'Pasar a T1' })).length).toBeGreaterThan(
      0,
    );
    expect(api.fetchCustomLockState).toHaveBeenCalledWith(10);
    pick('T1');
    pick('IG');
    pick('GEN');
    pick('BLG');
    const center = within(screen.getByRole('region', { name: 'Semifinales y final' }));
    fireEvent.click(center.getByRole('button', { name: 'Pasar a IG' }));
    fireEvent.click(center.getByRole('button', { name: 'Pasar a BLG' }));
    fireEvent.click(center.getAllByRole('button', { name: 'Pasar a IG' })[1]);

    await waitFor(() => expect(api.createPrediction).toHaveBeenCalled());
    expect(vi.mocked(api.createPrediction).mock.calls[0][0]).toMatchObject({
      customRounds: [['T1', 'IG', 'GEN', 'BLG'], ['IG', 'BLG'], ['IG']],
      champion: 'IG',
    });
  });
});
