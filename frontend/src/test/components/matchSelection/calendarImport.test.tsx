import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, renderHook, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import CalendarImportNotice from '../../../components/matchSelection/CalendarImportNotice';
import { calendarImports, isImporting } from '../../../components/matchSelection/matchSelection';
import {
  IMPORT_POLL_MS,
  useSelectableCalendar,
} from '../../../components/matchSelection/useSelectableCalendar';
import { fetchSelectableMatchesOf } from '../../../services/api';
import type { MatchSelectionView } from '../../../types/api';

vi.mock('../../../services/api', async (original) => ({
  ...(await original<typeof import('../../../services/api')>()),
  fetchSelectableMatchesOf: vi.fn(),
}));

const competition = (id: number, name: string, patch = {}) => ({
  id,
  name,
  externalId: `x.${id}`,
  locked: false,
  ...patch,
});

const calendar = (competitions: MatchSelectionView['competitions']): MatchSelectionView => ({
  mode: 'ALL',
  competitionIds: competitions.map((item) => item.id),
  competitions,
  teamIds: [],
  includedMatchIds: [],
  excludedMatchIds: [],
  teams: [],
  matches: [],
  removedPredictions: 0,
  keptMatches: 0,
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('carga de competiciones sin importar', () => {
  it('separa las que se están cargando de las que han fallado', () => {
    const view = calendar([
      competition(1, 'LaLiga', { importing: true }),
      competition(2, 'Premier', { importError: 'ESPN ha fallado' }),
      competition(3, 'Champions'),
    ]);
    expect(calendarImports(view)).toEqual({ loading: ['LaLiga'], errors: ['ESPN ha fallado'] });
    expect(isImporting(view)).toBe(true);
    expect(isImporting(calendar([competition(3, 'Champions')]))).toBe(false);
    expect(isImporting(undefined)).toBe(false);
  });

  it('avisa de que carga los partidos y del error de ESPN', () => {
    render(
      <CalendarImportNotice
        calendar={calendar([
          competition(1, 'LaLiga', { importing: true }),
          competition(2, 'Premier', { importing: true }),
          competition(3, 'Copa', { importError: 'No se han podido cargar los partidos de Copa.' }),
        ])}
      />,
    );
    expect(screen.getByRole('status')).toHaveTextContent('Cargando partidos de LaLiga y Premier…');
    expect(screen.getByRole('alert')).toHaveTextContent(
      'No se han podido cargar los partidos de Copa.',
    );
  });

  it('vuelve a pedir el calendario mientras se carga y para cuando llegan los partidos', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.mocked(fetchSelectableMatchesOf)
      .mockResolvedValueOnce(calendar([competition(1, 'LaLiga', { importing: true })]))
      .mockResolvedValue(calendar([competition(1, 'LaLiga')]));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useSelectableCalendar([1]), { wrapper });
    await waitFor(() => expect(isImporting(result.current.data)).toBe(true));

    await vi.advanceTimersByTimeAsync(IMPORT_POLL_MS);
    await waitFor(() => expect(isImporting(result.current.data)).toBe(false));
    expect(fetchSelectableMatchesOf).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(IMPORT_POLL_MS * 2);
    expect(fetchSelectableMatchesOf).toHaveBeenCalledTimes(2);
    client.clear();
  });
});
