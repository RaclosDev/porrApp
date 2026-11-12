import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import PokerLive from '../../components/poker/PokerLive';
import { PokerHistory, PokerStatistics } from '../../components/poker/PokerHistory';
import PokerSettingsForm from '../../components/poker/PokerSettingsForm';
import PokerLeague from '../../pages/PokerLeague';
import type { PokerLeagueData, PokerSession, PokerSettings } from '../../services/endpoints/poker';
import { request } from '../../services/http';
import { confirmAction } from '../../utils/confirmAction';

vi.mock('../../services/http', () => ({ request: vi.fn() }));
vi.mock('../../utils/confirmAction', () => ({ confirmAction: vi.fn() }));
const api = vi.mocked(request);
const date = '2026-11-14';
const settings: PokerSettings = {
  buyInCents: 1000,
  startingChips: 10000,
  rebuy: null,
  addOn: null,
  prizeShares: [70, 30],
  levels: [
    { small: 25, big: 50, ante: 0, minutes: 15 },
    { small: 50, big: 100, ante: 0, minutes: 15 },
  ],
};
const entries = [
  { playerId: 1, name: 'Ana', rebuys: 0, addOns: 0 },
  { playerId: 2, name: 'Luis', rebuys: 1, addOns: 1 },
  { playerId: 3, name: 'Paz', rebuys: 0, addOns: 0 },
];
const session: PokerSession = {
  id: 13,
  revision: 2,
  date,
  settings,
  startedAt: null,
  closedAt: null,
  entries,
  eliminations: [],
  clock: null,
  potCents: 3000,
  prizes: [2100, 900],
  results: [],
};
const league: PokerLeagueData = {
  id: 8,
  name: 'Sábados',
  joinCode: 'P0KER8',
  owner: true,
  myPlayerId: 1,
  players: entries.map(({ playerId: id, name }) => ({ id, name, guest: id !== 1 })),
  current: session,
  serverNow: 1_000,
};

afterEach(() => {
  vi.resetAllMocks();
  vi.useRealTimers();
});

function click(name: string) {
  fireEvent.click(screen.getByRole('button', { name }));
}

function set(label: string, value: string, scope: Pick<typeof screen, 'getByLabelText'> = screen) {
  fireEvent.change(scope.getByLabelText(label, { exact: true }), { target: { value } });
}

function renderLeague() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <PokerLeague leagueId="8" view="table" />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

it('valida el reparto y guarda la estructura, los límites y los importes en céntimos', async () => {
  const save = vi.fn().mockResolvedValue(true);
  const cancel = vi.fn();
  render(
    <PokerSettingsForm
      date={date}
      settings={settings}
      editing={false}
      busy={false}
      onCancel={cancel}
      onSave={save}
    />,
  );
  set('Fecha', '2026-11-21');
  set('Entrada (€)', '12.45');
  set('Fichas iniciales', '8000');
  click('Añadir premio');
  click('Abrir inscripciones');
  expect(screen.getByRole('alert')).toHaveTextContent('debe sumar el 100 %');
  click('Quitar último premio');
  set('Puesto 1 (%)', '75');
  set('Puesto 2 (%)', '25');

  fireEvent.click(screen.getByText('Ciegas, recompras y add-on'));
  click('Añadir descanso');
  click('Abrir inscripciones');
  expect(screen.getByRole('alert')).toHaveTextContent('al principio y al final');
  click('Añadir nivel');
  const level = within(screen.getByRole('group', { name: 'Ciegas · nivel 4' }));
  set('Pequeña', '75', level);
  set('Grande', '150', level);
  fireEvent.click(screen.getByLabelText('Activar ante'));
  set('Ante', '10', level);
  set('Minutos', '20', level);
  fireEvent.click(screen.getByLabelText('Activar recompras'));
  fireEvent.click(screen.getByLabelText('Activar add-on'));
  const rebuy = within(screen.getByRole('group', { name: 'Permitir recompras' }));
  set('Importe (€)', '9.50', rebuy);
  set('Fichas', '6000', rebuy);
  set('Máximo por jugador', '2', rebuy);
  set('Hasta el final de', '3', rebuy);
  click('Quitar nivel 2');

  click('Abrir inscripciones');
  await waitFor(() =>
    expect(save).toHaveBeenCalledWith('2026-11-21', {
      buyInCents: 1245,
      startingChips: 8000,
      prizeShares: [75, 25],
      levels: [
        { ...settings.levels[0], ante: 50 },
        { small: 0, big: 0, ante: 0, minutes: 10 },
        { small: 75, big: 150, ante: 10, minutes: 20 },
      ],
      rebuy: { costCents: 950, chips: 6000, limit: 2, throughLevel: 2 },
      addOn: { costCents: 1245, chips: 8000, limit: 1, throughLevel: 3 },
    }),
  );
  click('Volver');
  expect(cancel).toHaveBeenCalledOnce();
});

it('actualiza el reloj, limita las compras y permite corregir movimientos antes del cierre', async () => {
  vi.useFakeTimers({ now: 1_000 });
  const onCommand = vi.fn().mockResolvedValue(undefined);
  vi.mocked(confirmAction).mockResolvedValue(true);
  const extra = { costCents: 500, chips: 5000, limit: 1, throughLevel: 1 };
  const active: PokerSession = {
    ...session,
    startedAt: 1_000,
    clock: { level: 0, endsAt: 2_000, remainingMs: 1_000 },
    settings: { ...settings, rebuy: extra, addOn: extra },
  };
  const live = (current: PokerSession) => (
    <PokerLive
      session={current}
      owner
      busy={false}
      serverNow={1_000}
      receivedAt={1_000}
      onCommand={onCommand}
    />
  );
  const { rerender } = render(live(active));
  expect(screen.getByRole('timer')).toHaveTextContent('00:01');
  click('Pausar');
  click('Siguiente nivel');
  click('Recompra de Ana');
  click('Add-on para Ana');
  expect(screen.queryByRole('button', { name: 'Recompra de Luis' })).toBeNull();
  click('Eliminar a Paz');
  fireEvent.click(screen.getByText('Corregir recompras y add-ons'));
  click('Quitar recompra (1)');
  click('Quitar add-on (1)');
  expect(onCommand.mock.calls).toEqual([
    ['PAUSE'],
    ['NEXT_LEVEL'],
    ['REBUY', 1],
    ['ADD_ON', 1],
    ['ELIMINATE', 3],
    ['UNDO_REBUY', 2],
    ['UNDO_ADD_ON', 2],
  ]);

  act(() => vi.advanceTimersByTime(1_000));
  expect(screen.getByText(/Nivel 2/)).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Recompra de Ana' })).toBeNull();
  rerender(live({ ...active, clock: { level: 0, endsAt: null, remainingMs: 500 } }));
  click('Reanudar');
  expect(onCommand).toHaveBeenLastCalledWith('RESUME');

  rerender(live({ ...active, eliminations: [3, 2] }));
  fireEvent.click(screen.getByText('Eliminados (2)'));
  click('Deshacer eliminación de Luis');
  expect(onCommand).toHaveBeenLastCalledWith('UNDO_ELIMINATION');
  click('Cerrar torneo');
  vi.useRealTimers();
  await waitFor(() => expect(onCommand).toHaveBeenLastCalledWith('CLOSE'));
});

it('guarda asistencia, edita con revisión y cancela un torneo abierto', async () => {
  api.mockResolvedValue(league);
  vi.mocked(confirmAction).mockResolvedValue(true);
  renderLeague();
  await screen.findByRole('heading', { name: 'Inscripciones abiertas' });
  click('Desapuntarme');
  await waitFor(() =>
    expect(api).toHaveBeenLastCalledWith('/poker/8/sessions/13/attendance', {
      method: 'PUT',
      json: { attending: false, playerId: undefined },
    }),
  );

  fireEvent.click(screen.getByRole('checkbox', { name: 'Paz (invitado)' }));
  await waitFor(() =>
    expect(api).toHaveBeenLastCalledWith('/poker/8/sessions/13/attendance', {
      method: 'PUT',
      json: { attending: false, playerId: 3 },
    }),
  );
  click('Añadir invitado sin cuenta');
  set('Nombre del jugador', 'Marta');
  click('Añadir');
  await waitFor(() =>
    expect(api).toHaveBeenLastCalledWith('/poker/8/sessions/13/guests', {
      method: 'POST',
      json: { name: 'Marta' },
    }),
  );

  click('Editar torneo');
  click('Guardar cambios');
  await screen.findByRole('heading', { name: 'Inscripciones abiertas' });
  expect(api).toHaveBeenLastCalledWith('/poker/8/sessions/13', {
    method: 'PUT',
    json: { date, settings, revision: 2 },
  });
  api.mockResolvedValueOnce({ ...league, current: null });
  click('Cancelar torneo');
  await screen.findByRole('heading', { name: 'Próximo torneo' });
  expect(api).toHaveBeenCalledWith('/poker/8/sessions/13/commands', {
    method: 'POST',
    json: { action: 'CANCEL', revision: 2, playerId: undefined },
  });
});

it('calcula porcentajes y neto por participante', () => {
  const won = { ...entries[0], place: 1, paidCents: 1000, prizeCents: 2100 };
  const third = { ...entries[1], place: 3, paidCents: 2000, prizeCents: 0 };
  const past = { ...session, closedAt: 5000, results: [won, third] };
  render(<PokerStatistics sessions={[past]} />);
  const row = within(screen.getByRole('row', { name: /Ana/ }));
  expect(row.getAllByText(/100\s*%/)).toHaveLength(2);
  expect(row.getByText(/11,00/)).toBeVisible();
});

it('recorre el histórico torneo a torneo', () => {
  const result = { ...entries[0], place: 1, paidCents: 1000, prizeCents: 1000 };
  const closed = (id: number, date: string) => ({
    ...session,
    id,
    date,
    closedAt: 5000,
    results: [result],
  });
  render(<PokerHistory sessions={[closed(22, '2026-07-18'), closed(21, '2026-07-04')]} />);
  const picker = screen.getByLabelText<HTMLSelectElement>('Seleccionar torneo');
  expect(picker.value).toBe('22');
  expect(screen.getByRole('button', { name: 'Torneo siguiente' })).toBeDisabled();
  click('Torneo anterior');
  expect(picker.value).toBe('21');
  expect(screen.getByText(/4 de julio de 2026/)).toBeVisible();
  expect(screen.getByRole('button', { name: 'Torneo anterior' })).toBeDisabled();
  fireEvent.change(picker, { target: { value: '22' } });
  expect(screen.getByText(/18 de julio de 2026/)).toBeVisible();
});

it('reutiliza las reglas del torneo anterior', async () => {
  api.mockImplementation(async (path) =>
    path.endsWith('/history')
      ? [
          { ...session, id: 12, closedAt: 5000, settings: { ...settings, buyInCents: 2500 } },
          { ...session, closedAt: 5000 },
        ]
      : { ...league, current: null },
  );
  renderLeague();
  await screen.findByRole('heading', { name: 'Próximo torneo' });
  click('Preparar torneo');
  await screen.findByLabelText('Entrada (€)');
  expect(screen.getByLabelText('Entrada (€)')).toHaveValue(10);
  expect(screen.getByLabelText('Puesto 1 (%)')).toHaveValue(70);
  click('Abrir inscripciones');
  await waitFor(() =>
    expect(api).toHaveBeenCalledWith('/poker/8/sessions', {
      method: 'POST',
      json: { date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/), settings },
    }),
  );
});

it('finaliza con las fichas de los supervivientes y exige cuadrar el total', async () => {
  const command = vi.fn().mockResolvedValue(undefined);
  vi.mocked(confirmAction).mockResolvedValue(true);
  render(
    <PokerLive
      session={{
        ...session,
        startedAt: 1,
        eliminations: [3],
        clock: { level: 0, endsAt: null, remainingMs: 1000 },
      }}
      owner
      busy={false}
      serverNow={1000}
      receivedAt={Date.now()}
      onCommand={command}
    />,
  );
  click('Finalizar torneo');
  expect(screen.getByRole('button', { name: 'Finalizar y guardar' })).toBeDisabled();
  set('Fichas de Ana', '20000');
  expect(screen.getByLabelText('Fichas de Luis', { exact: false })).toHaveValue(10000);
  set('Fichas de Luis', '5000');
  expect(screen.getByRole('button', { name: 'Finalizar y guardar' })).toBeDisabled();
  set('Fichas de Luis', '10000');
  click('Finalizar y guardar');
  await waitFor(() =>
    expect(command).toHaveBeenCalledWith('CLOSE', undefined, [
      { playerId: 1, chips: 20000 },
      { playerId: 2, chips: 10000 },
    ]),
  );
});

it('calcula el ultimo jugador y recalcula al corregir los otros importes', () => {
  render(
    <PokerLive
      session={{ ...session, startedAt: 1, clock: { level: 0, endsAt: null, remainingMs: 1000 } }}
      owner
      busy={false}
      serverNow={1000}
      receivedAt={Date.now()}
      onCommand={vi.fn()}
    />,
  );
  click('Finalizar torneo');
  set('Fichas de Ana', '12000');
  expect(screen.getByLabelText('Fichas de Paz')).toHaveValue(null);
  set('Fichas de Luis', '8000');
  expect(screen.getByLabelText('Fichas de Paz')).toHaveValue(10000);
  set('Fichas de Ana', '15000');
  expect(screen.getByLabelText('Fichas de Paz')).toHaveValue(7000);
  set('Fichas de Ana', '30000');
  expect(screen.getByLabelText('Fichas de Paz')).toHaveValue(null);
  expect(screen.getByRole('button', { name: 'Finalizar y guardar' })).toBeDisabled();
  set('Fichas de Ana', '22000');
  expect(screen.getByLabelText('Fichas de Paz')).toHaveValue(0);
  expect(screen.getByRole('button', { name: 'Finalizar y guardar' })).toBeEnabled();
});

it('abre las acciones desde la foto y respeta permisos y extras disponibles', () => {
  const command = vi.fn().mockResolvedValue(undefined);
  const live = {
    ...session,
    startedAt: 1,
    eliminations: [3],
    settings: {
      ...settings,
      rebuy: { costCents: 1000, chips: 10000, limit: 1, throughLevel: 1 },
      addOn: { costCents: 1000, chips: 10000, limit: 1, throughLevel: 1 },
    },
    clock: { level: 0, endsAt: null, remainingMs: 1000 },
  };
  const props = {
    session: live,
    owner: true,
    busy: false,
    serverNow: 1000,
    receivedAt: Date.now(),
    onCommand: command,
  };
  const { rerender } = render(<PokerLive {...props} />);
  expect(screen.queryByRole('button', { name: 'Acciones de Paz' })).not.toBeInTheDocument();
  click('Acciones de Ana');
  const actions = within(screen.getByRole('region', { name: 'Acciones de Ana' }));
  fireEvent.click(actions.getByRole('button', { name: 'Recompra' }));
  expect(command).toHaveBeenLastCalledWith('REBUY', 1);
  fireEvent.click(actions.getByRole('button', { name: 'Add-on' }));
  expect(command).toHaveBeenLastCalledWith('ADD_ON', 1);
  fireEvent.click(actions.getByRole('button', { name: 'Eliminar' }));
  expect(command).toHaveBeenLastCalledWith('ELIMINATE', 1);
  click('Acciones de Luis');
  const limited = within(screen.getByRole('region', { name: 'Acciones de Luis' }));
  expect(limited.queryByRole('button', { name: 'Recompra' })).not.toBeInTheDocument();
  expect(limited.queryByRole('button', { name: 'Add-on' })).not.toBeInTheDocument();
  rerender(<PokerLive {...props} owner={false} />);
  expect(screen.queryByRole('button', { name: 'Acciones de Ana' })).not.toBeInTheDocument();
  expect(screen.queryByRole('region', { name: 'Acciones de Luis' })).not.toBeInTheDocument();
});

it('desactiva el ante de todos los niveles al guardar y permite recuperarlo antes de guardar', async () => {
  const save = vi.fn().mockResolvedValue(true);
  render(
    <PokerSettingsForm
      date={date}
      settings={{ ...settings, levels: settings.levels.map((level) => ({ ...level, ante: 25 })) }}
      editing
      busy={false}
      onCancel={() => {}}
      onSave={save}
    />,
  );
  fireEvent.click(screen.getByText('Ciegas, recompras y add-on'));
  expect(screen.getByLabelText('Activar ante')).toBeChecked();
  fireEvent.click(screen.getByLabelText('Activar ante'));
  expect(screen.queryByLabelText('Ante')).not.toBeInTheDocument();
  fireEvent.click(screen.getByLabelText('Activar ante'));
  expect(
    screen.getAllByLabelText('Ante').map((input) => (input as HTMLInputElement).value),
  ).toEqual(['25', '25']);
  fireEvent.click(screen.getByLabelText('Activar ante'));
  click('Añadir descanso');
  click('Añadir nivel');
  click('Guardar cambios');
  await waitFor(() => expect(save).toHaveBeenCalledOnce());
  expect(save.mock.calls[0][1].levels.map((level: { ante: number }) => level.ante)).toEqual([
    0, 0, 0, 0,
  ]);
});

it('acumula recompras y add-ons por jugador entre torneos cerrados', () => {
  const first = {
    ...session,
    closedAt: 5000,
    results: [
      { ...entries[0], place: 1, paidCents: 1000, prizeCents: 2000, rebuys: 2, addOns: 1 },
      { ...entries[1], place: 2, paidCents: 1000, prizeCents: 0, rebuys: 0, addOns: 0 },
    ],
  };
  const second = { ...first, id: 14, results: [{ ...first.results[0], rebuys: 3, addOns: 1 }] };
  render(<PokerStatistics sessions={[second, first]} />);
  const headers = screen.getAllByRole('columnheader').map((header) => header.textContent);
  const ana = within(screen.getByRole('row', { name: /Ana/ })).getAllByRole('cell');
  const luis = within(screen.getByRole('row', { name: /Luis/ })).getAllByRole('cell');
  expect(ana[headers.indexOf('Recompras') - 1]).toHaveTextContent(/^5$/);
  expect(ana[headers.indexOf('Add-ons') - 1]).toHaveTextContent(/^2$/);
  expect(luis[headers.indexOf('Recompras') - 1]).toHaveTextContent(/^0$/);
  expect(luis[headers.indexOf('Add-ons') - 1]).toHaveTextContent(/^0$/);
});

it('ordena cada columna por su valor y alterna el sentido sin cambiar el podio', () => {
  const ana = { ...entries[0], place: 1, paidCents: 1000, prizeCents: 100, rebuys: 3, addOns: 2 };
  const luis = { ...entries[1], place: 2, paidCents: 100, prizeCents: 900, rebuys: 10, addOns: 0 };
  render(
    <PokerStatistics
      sessions={[
        { ...session, closedAt: 5000, results: [ana, luis] },
        {
          ...session,
          id: 14,
          closedAt: 6000,
          results: [{ ...ana, place: 4, prizeCents: 0, rebuys: 0, addOns: 0 }],
        },
      ]}
    />,
  );
  const podium = screen.getByRole('list', { name: 'Podio de la liga por victorias' }).textContent;
  const order = () =>
    screen
      .getAllByRole('rowheader')
      .map((cell) => cell.querySelector('.poker-player')?.lastChild?.textContent);
  const expected: [string, string[]][] = [
    ['Jugador', ['Ana', 'Luis']],
    ['Torneos', ['Ana', 'Luis']],
    ['Recompras', ['Luis', 'Ana']],
    ['Add-ons', ['Ana', 'Luis']],
    ['Victorias', ['Ana', 'Luis']],
    ['% victorias', ['Ana', 'Luis']],
    ['% con premio', ['Luis', 'Ana']],
    ['Puesto medio', ['Ana', 'Luis']],
    ['Premios', ['Luis', 'Ana']],
    ['Neto', ['Luis', 'Ana']],
  ];
  for (const [label, names] of expected) {
    click(label);
    expect(order()).toEqual(names);
    expect(screen.getByRole('columnheader', { name: label })).toHaveAttribute(
      'aria-sort',
      label === 'Jugador' ? 'ascending' : 'descending',
    );
    click(label);
    expect(order()).toEqual([...names].reverse());
  }
  click('Podios');
  expect(order()).toEqual(['Ana', 'Luis']);
  click('Podios');
  expect(order()).toEqual(['Ana', 'Luis']);
  expect(screen.getByRole('list', { name: 'Podio de la liga por victorias' }).textContent).toBe(
    podium,
  );
});
