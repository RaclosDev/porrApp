import { render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import RaceClassificationSheet, {
  detailText,
  resultText,
} from '../../components/grandPrix/RaceClassificationSheet';
import type { GrandPrix, RaceClassificationRow } from '../../types/api';

const fetchClassification = vi.hoisted(() => vi.fn());
vi.mock('../../services/api', () => ({ fetchGrandPrixClassification: fetchClassification }));

const row = (overrides: Partial<RaceClassificationRow>): RaceClassificationRow => ({
  position: 1,
  driverId: 1,
  name: 'Max Verstappen',
  team: 'Red Bull',
  teamColor: '00327D',
  number: '3',
  grid: 5,
  laps: 71,
  time: null,
  gap: null,
  lapsBehind: null,
  status: 'FINISHED',
  points: null,
  fastestLap: false,
  ...overrides,
});

const mexico = { id: 125, name: 'GP de México' } as GrandPrix;

const renderSheet = () =>
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <RaceClassificationSheet gp={mexico} groupId={7} onClose={() => {}} />
    </QueryClientProvider>,
  );

describe('Clasificación completa de un Gran Premio', () => {
  it('da el tiempo del ganador, la diferencia, las vueltas perdidas y los abandonos', async () => {
    fetchClassification.mockResolvedValue({
      available: true,
      rows: [
        row({ time: '2:20:28.772', points: 25 }),
        row({
          position: 2,
          name: 'Lewis Hamilton',
          team: 'Ferrari',
          grid: 1,
          gap: '+0.799',
          points: 18,
          fastestLap: true,
        }),
        row({ position: 20, name: 'Sergio Pérez', team: 'Cadillac', grid: null, lapsBehind: 1 }),
        row({ position: 22, name: 'Fernando Alonso', grid: 17, laps: 5, status: 'RETIRED' }),
      ],
    });
    renderSheet();

    const rows = within(await screen.findByRole('table')).getAllByRole('row');
    expect(fetchClassification).toHaveBeenCalledWith(7, 125);
    expect(rows[1]).toHaveTextContent('1Max VerstappenRed Bull · Salió 5.º2:20:28.77225');
    expect(within(rows[2]).getByLabelText('Vuelta rápida')).toBeInTheDocument();
    expect(rows[2]).toHaveTextContent('+0.799');
    expect(rows[3]).toHaveTextContent('Salió del pit lane');
    expect(rows[3]).toHaveTextContent('+1 vuelta');
    expect(rows[4]).toHaveTextContent('—Fernando AlonsoRed Bull · Salió 17.º · 5 vueltasAbandono');
  });

  it('avisa si ESPN aún no la ha publicado', async () => {
    fetchClassification.mockResolvedValue({ available: false, rows: [] });
    renderSheet();
    expect(await screen.findByText(/aún no está publicada/)).toBeInTheDocument();
  });

  it('ofrece reintentar si falla', async () => {
    fetchClassification.mockRejectedValue(new Error('503'));
    renderSheet();
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo cargar');
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
  });

  it('traduce los demás estados', () => {
    expect(resultText(row({ status: 'DISQUALIFIED' }))).toBe('Descalificado');
    expect(resultText(row({ status: 'DID_NOT_START' }))).toBe('No salió');
    expect(resultText(row({ lapsBehind: 3 }))).toBe('+3 vueltas');
    expect(resultText(row({}))).toBe('—');
    expect(detailText(row({ team: null, grid: null, status: 'DID_NOT_START' }))).toBe('');
  });
});
