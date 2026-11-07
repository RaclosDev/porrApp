import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import CreateLeague from '../../pages/CreateLeague';
import { useAppContext } from '../../context/AppContext';
import { createGroup, fetchCompetitions, uploadGroupImage } from '../../services/api';
import { emptyDraft, storeDraft } from '../../components/createLeague/leagueDraft';
import { appContext, group } from '../context/fixtures';

vi.mock('../../context/AppContext', () => ({ useAppContext: vi.fn() }));
vi.mock('../../services/api', async (original) => ({
  ...(await original<typeof import('../../services/api')>()),
  fetchCompetitions: vi.fn(),
  createGroup: vi.fn(),
  uploadGroupImage: vi.fn(),
}));

const changeGroup = vi.fn();

beforeEach(() => {
  vi.mocked(useAppContext).mockReturnValue(
    appContext({ isAuthenticated: true, userId: '1', userName: 'Ana', changeGroup }),
  );
  vi.mocked(fetchCompetitions).mockResolvedValue([
    { id: 1, name: 'LaLiga', externalId: 'esp.1', formatType: 'LEAGUE' },
    { id: 2, name: 'Champions', externalId: 'uefa.champions', formatType: 'TOURNAMENT' },
  ]);
});

afterEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

const renderAt = (path = '/crear-liga') =>
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <MemoryRouter initialEntries={[path]}>
        <CreateLeague />
      </MemoryRouter>
    </QueryClientProvider>,
  );

const next = (label: string) =>
  fireEvent.click(screen.getByRole('button', { name: `Siguiente: ${label}` }));

it('crea una liga por jornadas paso a paso y deja el código para invitar', async () => {
  vi.mocked(createGroup).mockResolvedValue(
    group({ id: 7, name: 'Amigos', joinCode: 'AMIGOS7', poolFormat: 'MATCH_DAY' }),
  );
  renderAt();

  fireEvent.click(await screen.findByRole('radio', { name: 'LaLiga' }));
  next('Modo de juego');

  expect(screen.getByRole('heading', { level: 2, name: '¿Cómo se juega?' })).toHaveFocus();
  // En una liga regular no hay cuadro que rellenar.
  expect(screen.getByRole('radio', { name: 'Cuadro completo' })).toBeDisabled();
  fireEvent.click(screen.getByRole('radio', { name: 'Por jornadas' }));
  next('Reglas');

  fireEvent.click(screen.getByRole('radio', { name: 'Por días' }));
  fireEvent.click(screen.getByRole('checkbox', { name: /La liga tiene cuota/ }));
  next('Identidad');

  fireEvent.change(screen.getByLabelText('Nombre de la liga'), { target: { value: 'Amigos' } });
  next('Resumen');

  expect(screen.getByText('LaLiga')).toBeInTheDocument();
  expect(screen.getByText('Por días')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Crear liga' }));

  expect(await screen.findByRole('heading', { name: '¡Tu liga está lista!' })).toBeInTheDocument();
  expect(screen.getByText('AMIGOS7')).toBeInTheDocument();
  expect(
    screen.getByRole('link', { name: 'Hacer mis predicciones de la jornada' }),
  ).toHaveAttribute('href', '/jornadas');
  const [request, key] = vi.mocked(createGroup).mock.calls[0];
  expect(request).toEqual({
    name: 'Amigos',
    competitionId: 1,
    poolFormat: 'MATCH_DAY',
    pichichi: false,
    entryFee: true,
    lockMode: 'PER_DAY',
    lockOffsetMinutes: 0,
  });
  expect(key).toEqual(expect.any(String));
  expect(changeGroup).toHaveBeenCalledWith('7');
  expect(uploadGroupImage).not.toHaveBeenCalled();
  // El borrador se borra al crear la liga.
  expect(localStorage.getItem('createLeagueDraft')).toBeNull();
});

it('no avanza sin elegir competición y lleva el foco al campo', async () => {
  renderAt();
  await screen.findByRole('radio', { name: 'LaLiga' });
  next('Modo de juego');

  expect(screen.getByText('Elige una competición.')).toBeInTheDocument();
  expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('¿Sobre qué competición');
  await waitFor(() => expect(screen.getByRole('radio', { name: 'LaLiga' })).toHaveFocus());
});

it('recupera el borrador al recargar y no deja saltarse pasos pendientes', async () => {
  storeDraft({
    ...emptyDraft(),
    competitionId: 2,
    poolFormat: 'FULL_BRACKET',
    lockMode: 'PER_ROUND',
  });
  // Pide el resumen, pero falta el nombre: se queda en Identidad.
  renderAt('/crear-liga?paso=5');

  expect(
    await screen.findByRole('heading', { level: 2, name: 'Nombre, imagen y normas' }),
  ).toBeInTheDocument();
  expect(screen.getByText('Paso 4 de 5')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Atrás' }));
  expect(screen.getByRole('radio', { name: 'Por rondas' })).toBeChecked();
  expect(screen.getByRole('checkbox', { name: /pichichi/ })).not.toBeChecked();
});

it('enseña el error del servidor y conserva el borrador para reintentar con la misma clave', async () => {
  vi.mocked(createGroup).mockRejectedValueOnce(
    new Error('Con ese margen el cierre ya habría pasado'),
  );
  storeDraft({
    ...emptyDraft(),
    custom: true,
    customName: 'Torneo',
    poolFormat: 'KNOCKOUTS_ONLY',
    lockMode: 'FIRST_MATCH',
    name: 'Barrio',
  });
  renderAt('/crear-liga?paso=5');

  fireEvent.click(await screen.findByRole('button', { name: 'Crear liga' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('ya habría pasado');
  fireEvent.click(screen.getByRole('button', { name: 'Crear liga' }));
  await waitFor(() => expect(createGroup).toHaveBeenCalledTimes(2));
  const keys = vi.mocked(createGroup).mock.calls.map(([, key]) => key);
  expect(keys[0]).toBe(keys[1]);
  expect(vi.mocked(createGroup).mock.calls[0][0]).toMatchObject({
    competitionId: null,
    customCompetitionName: 'Torneo',
  });
});
