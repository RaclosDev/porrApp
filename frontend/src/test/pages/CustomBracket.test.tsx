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

  it('se rellena en el cuadro oficial pulsando equipos y guarda todas las rondas', async () => {
    vi.mocked(api.fetchCustomMatches).mockResolvedValue([
      knockout(1, 'T1', 'Gen.G'),
      knockout(2, 'HLE', 'DK'),
      knockout(3, 'BLG', 'TES'),
      knockout(4, 'WBG', 'LNG'),
    ]);
    vi.mocked(api.createPrediction).mockResolvedValue(undefined as never);

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
    fireEvent.click(screen.getByRole('button', { name: 'Guardar pronóstico' }));

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
    expect(left.getByTitle('Acertado')).toHaveTextContent('✓ Acertado');
    expect(left.getByTitle('Fallado').closest('.team-slot')).toHaveTextContent('Club');
    expect(left.getByTitle('Acertado').closest('.team-slot')).toHaveTextContent('Rayo');
    expect(right.getAllByText('Descanso').length).toBeGreaterThan(0);
    // El equipo que descansa no se elige: pasa solo a semifinales.
    expect(right.queryByRole('button', { name: 'Pasar a Solo' })).toBeNull();
    const center = within(screen.getByRole('region', { name: 'Semifinales y final' }));
    expect(center.getAllByText('Solo').length).toBeGreaterThan(0);
    // El aviso de pronóstico guardado es una notificación temporal, no un bloque fijo.
    expect(toast).toHaveBeenCalledOnce();
    expect(toast).toHaveBeenCalledWith(
      'Ya tienes un pronóstico guardado. Puedes cambiarlo hasta el cierre.',
      expect.anything(),
    );
    expect(screen.queryByText(/Ya tienes un pronóstico guardado/)).toBeNull();
  });
});
