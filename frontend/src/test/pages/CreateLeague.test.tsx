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
    {
      id: 3,
      name: 'Worlds',
      externalId: 'lol.worlds',
      formatType: 'TOURNAMENT',
      sport: 'LEAGUE_OF_LEGENDS',
    },
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

const next = () => fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));

it('crea una liga por jornadas paso a paso y deja el código para invitar', async () => {
  vi.mocked(createGroup).mockResolvedValue(
    group({ id: 7, name: 'Amigos', joinCode: 'AMIGOS7', poolFormat: 'MATCH_DAY' }),
  );
  renderAt();

  fireEvent.click(await screen.findByRole('radio', { name: 'Fútbol' }));
  next();
  // Solo las del deporte elegido.
  expect(screen.queryByRole('radio', { name: 'Worlds' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('radio', { name: 'LaLiga' }));
  next();

  expect(screen.getByRole('heading', { level: 2, name: 'Elige el modo de juego' })).toHaveFocus();
  // En una liga regular no hay cuadro que rellenar: ni se ofrece.
  expect(screen.queryByRole('radio', { name: 'Cuadro completo' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('radio', { name: 'Por jornadas' }));
  next();

  fireEvent.click(screen.getByRole('radio', { name: 'Por días' }));
  fireEvent.click(screen.getByRole('checkbox', { name: /La liga tiene cuota/ }));
  next();

  fireEvent.change(screen.getByLabelText('Nombre de la liga'), { target: { value: 'Amigos' } });
  next();

  expect(screen.getByText('LaLiga')).toBeInTheDocument();
  expect(screen.getByText('Por días')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Crear liga' }));

  expect(await screen.findByRole('heading', { name: 'Liga creada' })).toBeInTheDocument();
  expect(screen.getByText('AMIGOS7')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Hacer mis predicciones' })).toHaveAttribute(
    'href',
    '/jornadas',
  );
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

it('no avanza sin elegir deporte y lleva el foco al campo', async () => {
  renderAt();
  await screen.findByRole('radio', { name: 'Fútbol' });
  next();

  expect(screen.getByText('Elige un deporte.')).toBeInTheDocument();
  expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Elige deporte');
  await waitFor(() => expect(screen.getByRole('radio', { name: 'Fútbol' })).toHaveFocus());
});

it('recupera el borrador al recargar y no deja saltarse pasos pendientes', async () => {
  storeDraft({
    ...emptyDraft(),
    competitionId: 2,
    poolFormat: 'FULL_BRACKET',
    lockMode: 'PER_ROUND',
  });
  // Pide el resumen, pero falta el nombre: se queda en Identidad. El borrador es de antes del paso de
  // deporte: lo toma de su competición.
  renderAt('/crear-liga?paso=6');

  expect(
    await screen.findByRole('heading', { level: 2, name: 'Ponle nombre' }),
  ).toBeInTheDocument();
  expect(screen.getByText('Paso 5 de 6')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Atrás' }));
  expect(screen.getByRole('radio', { name: 'Por rondas' })).toBeChecked();
  // El pichichi se juega con los goleadores del Mundial: la Champions no lo ofrece.
  expect(screen.queryByRole('checkbox', { name: /pichichi/ })).not.toBeInTheDocument();
});

it('enseña el error del servidor y conserva el borrador para reintentar con la misma clave', async () => {
  vi.mocked(createGroup).mockRejectedValueOnce(
    new Error('Con ese margen el cierre ya habría pasado'),
  );
  storeDraft({
    ...emptyDraft(),
    sport: 'OTHER',
    custom: true,
    customName: 'Torneo',
    poolFormat: 'KNOCKOUTS_ONLY',
    lockMode: 'FIRST_MATCH',
    name: 'Barrio',
  });
  renderAt('/crear-liga?paso=6');

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
