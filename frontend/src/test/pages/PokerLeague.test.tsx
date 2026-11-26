import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import PokerHome from '../../components/poker/PokerHome';
import PokerLive from '../../components/poker/PokerLive';
import PokerLateEntry from '../../components/poker/PokerLateEntry';
import { PokerHistory, PokerStatistics } from '../../components/poker/PokerHistory';
import PokerSettingsForm from '../../components/poker/PokerSettingsForm';
import { PokerProfiles } from '../../components/poker/PokerPlayerCard';
import PokerLeague from '../../pages/PokerLeague';
import type { PokerLeagueData, PokerSession, PokerSettings } from '../../services/endpoints/poker';
import { request } from '../../services/http';
import { confirmAction } from '../../utils/confirmAction';
import { euros } from '../../components/poker/pokerFormat';
import { getSelectMenu, optionLabels, chooseOption, setValue } from '../selectMenu';

/** Importe como lo deja toHaveTextContent, que normaliza el espacio no separable. */
const money = (cents: number) => euros(cents).replace(/\s/g, ' ');

vi.mock('../../services/http', () => ({ request: vi.fn() }));
vi.mock('../../utils/confirmAction', () => ({ confirmAction: vi.fn() }));
const api = vi.mocked(request);
const onAttend = vi.fn();
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
  admin: true,
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
  setValue(scope.getByLabelText(label, { exact: true }), value);
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
  // Las fechas anteriores a hoy no se pueden elegir.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 10, 10));
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
  expect(screen.getByRole('button', { name: 'Torneo' })).toHaveAttribute('aria-current', 'step');
  fireEvent.click(screen.getByRole('button', { name: /^Fecha: / }));
  expect(screen.getByRole('button', { name: 'lunes, 9 de noviembre' })).toBeDisabled();
  click('sábado, 21 de noviembre');
  expect(screen.getByRole('button', { name: /^Fecha: / })).toHaveAccessibleName(
    'Fecha: sábado, 21 de noviembre',
  );
  set('Entrada (€)', '12.45');
  set('Fichas iniciales', '8000');
  click('Siguiente');

  click('Añadir descanso');
  click('Siguiente');
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
  const rebuy = within(screen.getByRole('group', { name: 'Recompras' }));
  set('Importe (€)', '9.50', rebuy);
  set('Fichas', '6000', rebuy);
  expect(getSelectMenu('Recompras por jugador')).toHaveAccessibleName(
    'Recompras por jugador: Sin límite',
  );
  chooseOption(getSelectMenu('Recompras por jugador'), '2');
  chooseOption(rebuy.getByRole('button', { name: /^Hasta el final de/ }), '3');
  click('Quitar nivel 2');
  click('Siguiente');

  // Un premio nuevo empieza en 0 y no deja abrir inscripciones hasta cuadrar el 100 %.
  click('Añadir premio');
  expect(screen.getByLabelText('Puesto 3 (%)')).toHaveValue(0);
  click('Quitar premio');
  set('Puesto 1 (%)', '80');
  click('Abrir inscripciones');
  expect(screen.getByRole('alert')).toHaveTextContent('debe sumar el 100 %');
  set('Puesto 1 (%)', '75');
  set('Puesto 2 (%)', '25');
  click('Abrir inscripciones');
  await waitFor(() =>
    expect(save).toHaveBeenCalledWith('2026-11-21', {
      buyInCents: 1245,
      startingChips: 8000,
      prizeShares: [75, 25],
      prizeAmounts: null,
      levels: [
        { ...settings.levels[0], ante: 50 },
        { small: 0, big: 0, ante: 0, minutes: 10 },
        { small: 75, big: 150, ante: 10, minutes: 20 },
      ],
      rebuy: { costCents: 950, chips: 6000, limit: 2, throughLevel: 2 },
      addOn: { costCents: 1245, chips: 8000, limit: 1, throughLevel: 3 },
    }),
  );
  click('Atrás');
  click('Atrás');
  click('Volver');
  expect(cancel).toHaveBeenCalledOnce();
});

it('sienta a quien llega tarde con la mesa empezada', async () => {
  api.mockResolvedValue(league);
  const change = vi.fn(async (send: () => Promise<PokerLeagueData>) => {
    await send();
    return true;
  });
  const started = { ...session, startedAt: 1 };
  const players = [...league.players, { id: 4, name: 'Bea', guest: false }];
  const { rerender } = render(
    <PokerLateEntry
      league={{ ...league, players }}
      session={started}
      busy={false}
      change={change}
    />,
  );
  click('Añadir jugador');
  click('Sentar a Bea');
  await waitFor(() =>
    expect(api).toHaveBeenLastCalledWith('/poker/8/sessions/13/attendance', {
      method: 'PUT',
      json: { attending: true, playerId: 4 },
    }),
  );
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

  rerender(
    <PokerLateEntry
      league={{ ...league, owner: false, myPlayerId: 4, players }}
      session={started}
      busy={false}
      change={change}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: /Unirme a la mesa/ }));
  await waitFor(() =>
    expect(api).toHaveBeenLastCalledWith('/poker/8/sessions/13/attendance', {
      method: 'PUT',
      json: { attending: true, playerId: undefined },
    }),
  );
  rerender(
    <PokerLateEntry
      league={{ ...league, owner: false }}
      session={started}
      busy={false}
      change={change}
    />,
  );
  expect(screen.queryByRole('button', { name: /Unirme a la mesa/ })).toBeNull();
});

it('añade un descanso tras el corte de recompras para comprar en él', async () => {
  const save = vi.fn().mockResolvedValue(true);
  const three = {
    ...settings,
    levels: [...settings.levels, { ...settings.levels[1], small: 75, big: 150 }],
  };
  render(
    <PokerSettingsForm
      date={date}
      settings={{ ...three, addOn: { costCents: 500, chips: 5000, limit: 1, throughLevel: 2 } }}
      editing={false}
      busy={false}
      onCancel={vi.fn()}
      onSave={save}
    />,
  );
  click('Siguiente');
  fireEvent.click(screen.getByLabelText('Activar recompras'));
  chooseOption(
    within(screen.getByRole('group', { name: 'Recompras' })).getByRole('button', {
      name: /^Hasta el final de/,
    }),
    '1',
  );
  click('Siguiente');
  click('Abrir inscripciones');
  const pause = { small: 0, big: 0, ante: 0, minutes: 10 };
  await waitFor(() =>
    expect(save).toHaveBeenCalledWith(
      date,
      expect.objectContaining({
        levels: [three.levels[0], pause, three.levels[1], pause, three.levels[2]],
        rebuy: expect.objectContaining({ throughLevel: 1 }),
        addOn: expect.objectContaining({ throughLevel: 3 }),
      }),
    ),
  );
});

it('deja comprar en el descanso que sigue al corte', () => {
  const pause = { small: 0, big: 0, ante: 0, minutes: 10 };
  const extra = { costCents: 500, chips: 5000, limit: null, throughLevel: 1 };
  render(
    <PokerLive
      session={{
        ...session,
        startedAt: 1,
        clock: { level: 1, endsAt: null, remainingMs: 60_000 },
        settings: {
          ...settings,
          rebuy: extra,
          levels: [settings.levels[0], pause, settings.levels[1]],
        },
      }}
      owner
      busy={false}
      serverNow={1_000}
      receivedAt={Date.now()}
      onCommand={vi.fn()}
    />,
  );
  expect(screen.getByRole('button', { name: 'Recompra de Ana' })).toBeEnabled();
  expect(screen.getByText(/Hasta el nivel 1 y el descanso/)).toBeInTheDocument();
});

it('marca en la mesa las recompras, los extras y al último ganador', () => {
  const { container } = render(
    <PokerLive
      session={{
        ...session,
        startedAt: 1_000,
        clock: { level: 0, endsAt: null, remainingMs: 1_000 },
      }}
      owner={false}
      busy={false}
      serverNow={1_000}
      receivedAt={1_000}
      lastWinnerIds={[3]}
      onCommand={vi.fn()}
    />,
  );
  const seats = [...container.querySelectorAll('.poker-seats li')];
  expect(seats.map((seat) => Boolean(seat.querySelector('.poker-seat-bullet')))).toEqual([
    false,
    true,
    false,
  ]);
  expect(seats.map((seat) => Boolean(seat.querySelector('.poker-seat-bag')))).toEqual([
    false,
    true,
    false,
  ]);
  expect(seats.map((seat) => Boolean(seat.querySelector('.poker-seat-crown')))).toEqual([
    false,
    false,
    true,
  ]);
});

it('corona en inicio al último ganador y marca compras en los cromos del histórico', () => {
  const closed: PokerSession = {
    ...session,
    id: 12,
    startedAt: 500,
    closedAt: 900,
    results: entries.map((entry, index) => ({
      ...entry,
      place: index === 2 ? 1 : index + 2,
      paidCents: 1000,
      prizeCents: index === 2 ? 2100 : 0,
    })),
  };
  const { container, unmount } = render(
    <MemoryRouter>
      <PokerHome
        league={league}
        current={league.current}
        sessions={[closed]}
        loading={false}
        busy={false}
        onAttend={onAttend}
        onRetry={vi.fn()}
        onInvite={vi.fn()}
      />
    </MemoryRouter>,
  );
  const faces = [...container.querySelectorAll('.poker-faces li')];
  expect(faces.map((face) => Boolean(face.querySelector('.poker-seat-crown')))).toEqual([
    false,
    false,
    true,
  ]);
  unmount();

  const history = render(<PokerHistory sessions={[closed]} />);
  const stickers = [...history.container.querySelectorAll('.poker-podium li')];
  const luis = stickers.find((sticker) => sticker.textContent?.includes('Luis'));
  expect(luis?.querySelector('.poker-seat-bullet')).not.toBeNull();
  expect(luis?.querySelector('.poker-seat-bag')).not.toBeNull();
  expect(stickers.filter((sticker) => sticker.querySelector('.poker-seat-bullet'))).toHaveLength(1);
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
  expect(screen.getByLabelText('Recompras y add-on: quedan 00:01')).toBeInTheDocument();
  click('Pausar');
  click('Siguiente nivel');
  click('Recompra de Ana');
  click('Add-on para Ana');
  expect(screen.queryByRole('button', { name: 'Recompra de Luis' })).toBeNull();
  click('Eliminar a Paz');
  fireEvent.click(screen.getByText('Corregir'));
  click('Quitar una recompra a Luis (1)');
  click('Quitar un add-on a Luis (1)');
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
  expect(screen.getByText('Nivel 2')).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Recompra de Ana' })).toBeNull();
  rerender(live({ ...active, clock: { level: 0, endsAt: null, remainingMs: 500 } }));
  click('Reanudar');
  expect(onCommand).toHaveBeenLastCalledWith('RESUME');

  rerender(live({ ...active, eliminations: [3, 2] }));
  const names = Array.from(
    document.querySelectorAll('.poker-roster .poker-roster-name strong'),
  ).map((item) => item.textContent);
  expect(names.slice(0, 3)).toEqual(['Ana', 'Luis', 'Paz']);
  click('Quitar la eliminación de Paz');
  expect(onCommand).toHaveBeenLastCalledWith('UNDO_ELIMINATION', 3);
  click('Cerrar torneo');
  vi.useRealTimers();
  const dialog = screen.getByRole('dialog', { name: '¿Cerrar el torneo?' });
  expect(within(dialog).getByLabelText('Dinero para 1.º Ana')).toHaveValue(21);
  expect(within(dialog).getByLabelText('Puntos para 2.º Luis')).toHaveValue(4);
  expect(within(dialog).getByRole('status')).toHaveTextContent('Sobran0,00 €Puntos9');
  click('Cerrar y guardar');
  await waitFor(() =>
    expect(onCommand).toHaveBeenLastCalledWith('CLOSE', undefined, {
      prizeShares: [70, 30],
      payouts: [
        { playerId: 1, prizeCents: 2100, points: 5 },
        { playerId: 2, prizeCents: 900, points: 4 },
        { playerId: 3, prizeCents: 0, points: 0 },
      ],
    }),
  );
});

it('con varios torneos programados los enseña en inicio y deja apuntarse al elegido', async () => {
  const wednesday: PokerSession = { ...session, id: 21, date: '2026-11-25', entries: [] };
  const saturday: PokerSession = { ...session, id: 22, date: '2026-11-28', entries: [] };
  const two = { ...league, current: wednesday, upcoming: [wednesday, saturday] };
  const home = render(
    <MemoryRouter>
      <PokerHome
        league={two}
        current={saturday}
        sessions={[]}
        loading={false}
        busy={false}
        onAttend={onAttend}
        onRetry={vi.fn()}
        onInvite={vi.fn()}
      />
    </MemoryRouter>,
  );
  expect(screen.getByRole('heading', { name: /^Próximo torneo: / })).toBeInTheDocument();
  const tabs = within(screen.getByRole('navigation', { name: 'Torneos programados' }));
  expect(tabs.getAllByRole('link')).toHaveLength(2);
  expect(tabs.getAllByRole('link')[1]).toHaveAttribute('aria-current', 'page');
  fireEvent.click(screen.getByRole('button', { name: 'Apuntarme al torneo' }));
  expect(onAttend).toHaveBeenCalledWith(saturday, true);
  expect(screen.getByRole('link', { name: 'Ir a la mesa' })).toHaveAttribute(
    'href',
    '/poker/mesa?torneo=22',
  );
  home.unmount();

  api.mockResolvedValue(two);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/poker/mesa?torneo=22']}>
        <PokerLeague leagueId="8" view="table" />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  await screen.findByRole('heading', { name: /Inscripciones abiertas/ });
  click('Apuntarme al torneo');
  await waitFor(() =>
    expect(api).toHaveBeenLastCalledWith('/poker/8/sessions/22/attendance', {
      method: 'PUT',
      json: { attending: true, playerId: undefined },
    }),
  );
  // Programar otro torneo se hace desde Inicio, no desde la mesa.
  expect(screen.queryByRole('button', { name: 'Programar otro torneo' })).toBeNull();
});

it('el organizador programa otro torneo desde inicio', async () => {
  const home = render(
    <MemoryRouter>
      <PokerHome
        league={league}
        current={league.current}
        sessions={[]}
        loading={false}
        busy={false}
        onAttend={onAttend}
        onRetry={vi.fn()}
        onInvite={vi.fn()}
      />
    </MemoryRouter>,
  );
  expect(screen.getByRole('link', { name: 'Programar otro torneo' })).toHaveAttribute(
    'href',
    '/poker/mesa?nuevo=1',
  );
  home.rerender(
    <MemoryRouter>
      <PokerHome
        league={{ ...league, owner: false }}
        current={league.current}
        sessions={[]}
        loading={false}
        busy={false}
        onAttend={onAttend}
        onRetry={vi.fn()}
        onInvite={vi.fn()}
      />
    </MemoryRouter>,
  );
  expect(screen.queryByRole('link', { name: 'Programar otro torneo' })).not.toBeInTheDocument();
  home.unmount();

  api.mockImplementation((url: string) => Promise.resolve(url.endsWith('/history') ? [] : league));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/poker/mesa?nuevo=1']}>
        <PokerLeague leagueId="8" view="table" />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  expect(await screen.findByRole('heading', { name: 'Preparar torneo' })).toBeInTheDocument();
});

it('guarda asistencia, edita con revisión y cancela un torneo abierto', async () => {
  api.mockResolvedValue(league);
  vi.mocked(confirmAction).mockResolvedValue(true);
  renderLeague();
  await screen.findByRole('heading', { name: /Inscripciones abiertas/ });
  click('Desapuntarme');
  await waitFor(() =>
    expect(api).toHaveBeenLastCalledWith('/poker/8/sessions/13/attendance', {
      method: 'PUT',
      json: { attending: false, playerId: undefined },
    }),
  );

  fireEvent.click(screen.getByRole('button', { name: 'Jugadores' }));
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
  await screen.findByRole('heading', { name: /Inscripciones abiertas/ });
  expect(api).toHaveBeenLastCalledWith('/poker/8/sessions/13', {
    method: 'PUT',
    json: { date, settings: { ...settings, prizeAmounts: null }, revision: 2 },
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

it('al desplazar la clasificación, la columna fija se queda en la foto', () => {
  const past = {
    ...session,
    closedAt: 5000,
    results: [{ ...entries[0], place: 1, paidCents: 1000, prizeCents: 1000 }],
  };
  render(<PokerStatistics sessions={[past]} />);
  const table = screen.getByRole('region', { name: 'Clasificación de la liga de póker' });
  const scrollTo = (left: number) => {
    table.scrollLeft = left;
    fireEvent.scroll(table);
  };
  scrollTo(40);
  expect(table).toHaveClass('is-scrolled');
  scrollTo(10);
  expect(table).toHaveClass('is-scrolled');
  scrollTo(0);
  expect(table).not.toHaveClass('is-scrolled');
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
  const picker = getSelectMenu('Seleccionar torneo');
  expect(picker).toHaveAttribute('data-value', '22');
  expect(screen.getByRole('button', { name: 'Torneo siguiente' })).toBeDisabled();
  click('Torneo anterior');
  expect(picker).toHaveAttribute('data-value', '21');
  expect(screen.getByRole('region', { name: /sábado, 4 de julio/ })).toBeVisible();
  expect(screen.getByRole('button', { name: 'Torneo anterior' })).toBeDisabled();
  chooseOption(picker, '22');
  expect(screen.getByRole('region', { name: /sábado, 18 de julio/ })).toBeVisible();
});

it('en los pagos recuerda lo que sobró del bote', () => {
  const closed = {
    ...session,
    id: 23,
    closedAt: 5000,
    leftoverCents: 200,
    results: [
      { ...entries[0], place: 1, paidCents: 1000, prizeCents: 1800 },
      { ...entries[2], place: 2, paidCents: 1000, prizeCents: 0 },
    ],
  };
  render(<PokerHistory sessions={[closed]} />);
  click('Quién paga a quién · 2 pagos');
  // Paz debe 10 €: 8 € a Ana y 2 € al sobrante, para que los pagos cuadren con el bote.
  const [toAna, toLeftover, ...rest] = within(
    screen.getByRole('list', { name: 'Pagos para saldar el torneo' }),
  ).getAllByRole('listitem');
  expect(rest).toEqual([]);
  expect(toAna).toHaveTextContent(`Paz paga a Ana${money(800)}`);
  expect(toLeftover).toHaveTextContent(`Paz paga al sobrante${money(200)}`);
  expect(screen.getByText(/del bote sin repartir/)).toHaveTextContent(`Sobran ${money(200)}`);
  // Con el sobrante repartido, Ana cuenta los 20 € enteros en las estadísticas.
  fireEvent.click(
    within(screen.getByRole('dialog')).getByRole('button', { name: 'Cuánto cuenta para cada uno' }),
  );
  expect(screen.getByText(/Con el sobrante repartido/)).toHaveTextContent(`Ana ${money(2000)}`);
});

it('abre los pagos en una hoja y deja a la administración corregir o borrar', async () => {
  const closed = {
    ...session,
    id: 22,
    closedAt: 5000,
    results: [
      { ...entries[0], place: 1, paidCents: 1000, prizeCents: 2000 },
      { ...entries[2], place: 2, paidCents: 1000, prizeCents: 0 },
    ],
  };
  const onEdit = vi.fn().mockResolvedValue(true);
  const onDelete = vi.fn().mockResolvedValue(true);
  const { rerender } = render(<PokerHistory sessions={[closed]} />);
  expect(screen.queryByRole('button', { name: 'Editar' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Borrar' })).toBeNull();
  click('Quién paga a quién · 1 pago');
  const payments = screen.getByRole('list', { name: 'Pagos para saldar el torneo' });
  expect(payments).toHaveTextContent(`Paz paga a Ana${money(1000)}`);
  click('Cerrar');

  rerender(<PokerHistory sessions={[closed]} admin onEdit={onEdit} onDelete={onDelete} />);
  click('Editar');
  click('Bajar a Ana');
  click('Guardar cambios');
  await waitFor(() =>
    expect(onEdit).toHaveBeenCalledWith(closed, {
      date: closed.date,
      buyInCents: 1000,
      rebuyCostCents: undefined,
      addOnCostCents: undefined,
      standings: [
        { playerId: 3, rebuys: 0, addOns: 0, prizeCents: 2000, points: 0 },
        { playerId: 1, rebuys: 0, addOns: 0, prizeCents: 0, points: 0 },
      ],
    }),
  );
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

  vi.mocked(confirmAction).mockResolvedValueOnce(true);
  click('Borrar');
  await waitFor(() => expect(onDelete).toHaveBeenCalledWith(closed));
});

it('solo muestra el año de los torneos de otros años', () => {
  const result = { ...entries[0], place: 1, paidCents: 1000, prizeCents: 1000 };
  const year = new Date().getFullYear();
  render(
    <PokerHistory
      sessions={[
        { ...session, id: 22, date: `${year}-07-18`, closedAt: 5000, results: [result] },
        { ...session, id: 21, date: `${year - 1}-07-04`, closedAt: 5000, results: [result] },
      ]}
    />,
  );
  const options = optionLabels(getSelectMenu('Seleccionar torneo'));
  expect(options).toEqual([`Torneo 1 · 4 jul ${year - 1}`, 'Torneo 2 · 18 jul']);
  expect(screen.getByRole('region', { name: /, 18 de julio$/ })).toBeVisible();
});

it('reutiliza las reglas del torneo anterior', async () => {
  api.mockImplementation(async (path) =>
    path.endsWith('/history')
      ? [
          { ...session, id: 12, closedAt: 5000, settings: { ...settings, buyInCents: 2500 } },
          // Las cantidades fijas dependían del bote de aquel torneo: no se heredan.
          { ...session, closedAt: 5000, settings: { ...settings, prizeAmounts: [5000, 3000] } },
        ]
      : { ...league, current: null },
  );
  renderLeague();
  const empty = await screen.findByRole('region', { name: 'Próximo torneo' });
  // La mesa libre solo lleva al crupier, el título y el botón.
  expect(empty.querySelector('.crupier')).toBeInTheDocument();
  expect(empty.querySelector('ol')).not.toBeInTheDocument();
  click('Preparar torneo');
  await screen.findByLabelText('Entrada (€)');
  expect(screen.getByLabelText('Entrada (€)')).toHaveValue(10);
  click('Siguiente');
  click('Siguiente');
  expect(screen.getByLabelText('Puesto 1 (%)')).toHaveValue(70);
  click('Abrir inscripciones');
  await waitFor(() =>
    expect(api).toHaveBeenCalledWith('/poker/8/sessions', {
      method: 'POST',
      json: {
        date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        settings: { ...settings, prizeAmounts: null },
      },
    }),
  );
});

it('finaliza con las fichas de los supervivientes y deja ajustar el reparto antes de guardar', async () => {
  const command = vi.fn().mockResolvedValue(undefined);
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
  // La mesa se aparta: solo quedan los pasos del cierre y el formulario de fichas.
  expect(screen.getByRole('list', { name: 'Pasos para finalizar' })).toBeVisible();
  expect(screen.queryByRole('list', { name: 'Jugadores en la mesa' })).toBeNull();
  expect(screen.queryByRole('timer')).toBeNull();
  click('Contando fichas');
  expect(screen.getByRole('button', { name: 'Revisar premios y finalizar' })).toBeDisabled();
  set('Fichas de Ana', '20000');
  expect(screen.getByLabelText('Fichas de Luis', { exact: false })).toHaveValue(10000);
  set('Fichas de Luis', '5000');
  expect(screen.getByRole('button', { name: 'Revisar premios y finalizar' })).toBeDisabled();
  set('Fichas de Luis', '10000');
  click('Revisar premios y finalizar');

  const dialog = screen.getByRole('dialog', { name: '¿Finalizar el torneo?' });
  const status = () => within(dialog).getByRole('status');
  // Pacto entre Ana (20.000) y Luis (10.000): ICM sugiere más dinero a quien tiene más fichas y los
  // puntos, por defecto, a partes iguales.
  expect(within(dialog).getByLabelText('Dinero para 1.º Ana')).toHaveValue(17);
  expect(within(dialog).getByLabelText('Dinero para 2.º Luis')).toHaveValue(13);
  expect(within(dialog).getByLabelText('Puntos para 1.º Ana')).toHaveValue(4.5);
  click('A partes iguales');
  expect(within(dialog).getByLabelText('Dinero para 1.º Ana')).toHaveValue(15);
  set('Dinero para 2.º Luis', '14', within(dialog));
  expect(status()).toHaveTextContent(`Sobran${money(100)}`);
  set('Dinero para 2.º Luis', '16', within(dialog));
  expect(status()).toHaveTextContent(`Te pasas${money(100)}`);
  set('Dinero para 2.º Luis', '14', within(dialog));
  click('Finalizar y guardar');
  await waitFor(() =>
    expect(command).toHaveBeenCalledWith('CLOSE', undefined, {
      finalStacks: [
        { playerId: 1, chips: 20000 },
        { playerId: 2, chips: 10000 },
      ],
      prizeShares: [70, 30],
      payouts: [
        { playerId: 1, prizeCents: 1500, points: 4.5 },
        { playerId: 2, prizeCents: 1400, points: 4.5 },
        { playerId: 3, prizeCents: 0, points: 0 },
      ],
    }),
  );
});

it('sin contar fichas, los que siguen comparten el primer puesto a partes iguales', async () => {
  const command = vi.fn().mockResolvedValue(undefined);
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
  expect(screen.getByRole('button', { name: 'Sin contar fichas' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  expect(screen.queryByLabelText('Fichas de Ana')).toBeNull();
  click('Revisar premios y finalizar');
  const dialog = screen.getByRole('dialog', { name: '¿Finalizar el torneo?' });
  expect(within(dialog).queryByRole('button', { name: 'Según fichas (ICM)' })).toBeNull();
  expect(within(dialog).getByLabelText('Dinero para 1.º Ana')).toHaveValue(15);
  expect(within(dialog).getByLabelText('Dinero para 1.º Luis')).toHaveValue(15);
  // Solo se ven los que siguen; el siguiente clasificado se añade si se acuerda darle algo.
  expect(within(dialog).queryByLabelText('Dinero para 3.º Paz')).toBeNull();
  click('Añadir siguiente clasificado');
  expect(within(dialog).getByLabelText('Dinero para 3.º Paz')).toHaveValue(0);
  expect(screen.queryByRole('button', { name: 'Añadir siguiente clasificado' })).toBeNull();
  // Una casilla vacía cuenta como 0 y deja guardar.
  set('Puntos para 1.º Luis', '', within(dialog));
  click('Finalizar y guardar');
  await waitFor(() =>
    expect(command).toHaveBeenCalledWith('CLOSE', undefined, {
      prizeShares: [70, 30],
      payouts: [
        { playerId: 1, prizeCents: 1500, points: 4.5 },
        { playerId: 2, prizeCents: 1500, points: 0 },
        { playerId: 3, prizeCents: 0, points: 0 },
      ],
    }),
  );
});

it('reparte en cantidades fijas durante el juego y avisa del resto', async () => {
  const command = vi.fn().mockResolvedValue(undefined);
  render(
    <PokerLive
      session={{ ...session, startedAt: 1, clock: { level: 0, endsAt: null, remainingMs: 1000 } }}
      owner
      busy={false}
      serverNow={1000}
      receivedAt={Date.now()}
      onCommand={command}
    />,
  );
  click('Cambiar reparto');
  click('Cantidad (€)');
  expect(screen.getByRole('button', { name: 'Cantidad (€)' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  set('Puesto 1 (€)', '15');
  expect(screen.getByText(/Reparto total/)).toHaveTextContent(
    `sobran ${money(600)}, que se suman al 1.º puesto`,
  );
  expect(screen.getByText(/Quedaría/)).toHaveTextContent(`1.º ${money(2100)} · 2.º ${money(900)}`);
  set('Puesto 2 (€)', '20');
  expect(screen.getByRole('button', { name: 'Guardar reparto' })).toBeDisabled();
  set('Puesto 2 (€)', '9.5');
  click('Guardar reparto');
  await waitFor(() =>
    expect(command).toHaveBeenCalledWith('SET_PRIZES', undefined, { prizeAmounts: [1500, 950] }),
  );
});

it('cambia el reparto de premios en juego y muestra cómo quedaría', async () => {
  const command = vi.fn().mockResolvedValue(undefined);
  render(
    <PokerLive
      session={{ ...session, startedAt: 1, clock: { level: 0, endsAt: null, remainingMs: 1000 } }}
      owner
      busy={false}
      serverNow={1000}
      receivedAt={Date.now()}
      onCommand={command}
    />,
  );
  click('Cambiar reparto');
  set('Puesto 1 (%)', '50');
  expect(screen.getByRole('button', { name: 'Guardar reparto' })).toBeDisabled();
  click('Añadir premio');
  set('Puesto 2 (%)', '30');
  set('Puesto 3 (%)', '20');
  expect(screen.getByText(/Quedaría/)).toHaveTextContent('1.º 15,00 € · 2.º 9,00 € · 3.º 6,00 €');
  expect(screen.getByRole('button', { name: 'Añadir premio' })).toBeDisabled();
  click('Guardar reparto');
  await waitFor(() =>
    expect(command).toHaveBeenCalledWith('SET_PRIZES', undefined, { prizeShares: [50, 30, 20] }),
  );
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Cambiar reparto' })).toBeVisible(),
  );
});

it('no deja cambiar el reparto a quien no organiza', () => {
  render(
    <PokerLive
      session={{ ...session, startedAt: 1, clock: { level: 0, endsAt: null, remainingMs: 1000 } }}
      owner={false}
      busy={false}
      serverNow={1000}
      receivedAt={Date.now()}
      onCommand={vi.fn()}
    />,
  );
  expect(screen.queryByRole('button', { name: 'Cambiar reparto' })).toBeNull();
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
  click('Contando fichas');
  set('Fichas de Ana', '12000');
  expect(screen.getByLabelText('Fichas de Paz')).toHaveValue(null);
  set('Fichas de Luis', '8000');
  expect(screen.getByLabelText('Fichas de Paz')).toHaveValue(10000);
  set('Fichas de Ana', '15000');
  expect(screen.getByLabelText('Fichas de Paz')).toHaveValue(7000);
  set('Fichas de Ana', '30000');
  expect(screen.getByLabelText('Fichas de Paz')).toHaveValue(null);
  expect(screen.getByRole('button', { name: 'Revisar premios y finalizar' })).toBeDisabled();
  set('Fichas de Ana', '22000');
  expect(screen.getByLabelText('Fichas de Paz')).toHaveValue(0);
  expect(screen.getByRole('button', { name: 'Revisar premios y finalizar' })).toBeEnabled();
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
  // Cada acción cierra el panel del jugador: para la siguiente hay que volver a abrirlo.
  const act = (player: string, action: string) => {
    click(`Acciones de ${player}`);
    const panel = within(screen.getByRole('region', { name: `Acciones de ${player}` }));
    fireEvent.click(panel.getByRole('button', { name: action }));
    expect(screen.queryByRole('region', { name: `Acciones de ${player}` })).not.toBeInTheDocument();
  };
  act('Ana', 'Recompra de Ana');
  expect(command).toHaveBeenLastCalledWith('REBUY', 1);
  act('Ana', 'Add-on para Ana');
  expect(command).toHaveBeenLastCalledWith('ADD_ON', 1);
  act('Ana', 'Eliminar a Ana');
  expect(command).toHaveBeenLastCalledWith('ELIMINATE', 1);
  click('Acciones de Luis');
  const limited = within(screen.getByRole('region', { name: 'Acciones de Luis' }));
  expect(limited.queryByRole('button', { name: 'Recompra de Luis' })).not.toBeInTheDocument();
  expect(limited.queryByRole('button', { name: 'Add-on para Luis' })).not.toBeInTheDocument();
  click('Acciones de Paz');
  const out = within(screen.getByRole('region', { name: 'Acciones de Paz' }));
  expect(out.queryByRole('button', { name: 'Eliminar a Paz' })).not.toBeInTheDocument();
  expect(out.queryByRole('button', { name: 'Add-on para Paz' })).not.toBeInTheDocument();
  click('Acciones de Paz');
  act('Paz', 'Recompra de Paz');
  expect(command).toHaveBeenLastCalledWith('REBUY', 3);
  act('Paz', 'Quitar la eliminación de Paz');
  expect(command).toHaveBeenLastCalledWith('UNDO_ELIMINATION', 3);
  // Un jugador sin permisos de organizador también apunta recompras y eliminaciones.
  rerender(<PokerLive {...props} owner={false} />);
  act('Ana', 'Eliminar a Ana');
  expect(command).toHaveBeenLastCalledWith('ELIMINATE', 1);
  expect(screen.queryByRole('button', { name: 'Pausar' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Reanudar' })).not.toBeInTheDocument();
});

it('deja elegir los puntos de liga de cada puesto y los guarda con el torneo', async () => {
  const save = vi.fn().mockResolvedValue(true);
  render(
    <PokerSettingsForm
      date={date}
      settings={settings}
      editing
      busy={false}
      onCancel={vi.fn()}
      onSave={save}
    />,
  );
  click('Premios');
  expect(screen.queryByLabelText('Puntos de liga del 1.º puesto')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('switch', { name: /^Puntos de liga/ }));
  expect(screen.getByLabelText('Puntos de liga del 1.º puesto')).toHaveValue(5);
  expect(screen.getByLabelText('Puntos de liga del 2.º puesto')).toHaveValue(4);
  set('Puntos de liga del 1.º puesto', '10');
  click('Añadir premio');
  expect(screen.getByLabelText('Puntos de liga del 3.º puesto')).toHaveValue(0);
  click('Quitar premio');
  click('Guardar cambios');
  await waitFor(() =>
    expect(save).toHaveBeenCalledWith(date, expect.objectContaining({ prizePoints: [10, 4] })),
  );
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
  click('Ciegas');
  expect(screen.getByLabelText('Activar ante')).toBeChecked();
  fireEvent.click(screen.getByLabelText('Activar ante'));
  expect(screen.queryByRole('spinbutton', { name: 'Ante' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByLabelText('Activar ante'));
  expect(
    screen
      .getAllByRole('spinbutton', { name: 'Ante' })
      .map((input) => (input as HTMLInputElement).value),
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

it('acumula recompras, add-ons y aplausos por jugador entre torneos cerrados', () => {
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
  // La primera fila de la cabecera agrupa columnas; la segunda trae una por columna.
  const headers = within(screen.getAllByRole('row')[1])
    .getAllByRole('columnheader')
    .map((header) => header.textContent);
  const ana = within(screen.getByRole('row', { name: /Ana/ })).getAllByRole('cell');
  const luis = within(screen.getByRole('row', { name: /Luis/ })).getAllByRole('cell');
  expect(ana[headers.indexOf('Recompras') - 1]).toHaveTextContent(/^5$/);
  expect(ana[headers.indexOf('Add-ons') - 1]).toHaveTextContent(/^2$/);
  expect(luis[headers.indexOf('Recompras') - 1]).toHaveTextContent(/^0$/);
  expect(luis[headers.indexOf('Add-ons') - 1]).toHaveTextContent(/^0$/);
  // Solo cobra el primero: el segundo se lleva el aplauso.
  expect(luis[headers.indexOf('Aplausos') - 1]).toHaveTextContent(/^1$/);
  expect(ana[headers.indexOf('Aplausos') - 1]).toHaveTextContent(/^0$/);
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
  const podium = screen.getByRole('list', { name: 'Podio de la liga por puntos' }).textContent;
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
    ['Puesto medio', ['Luis', 'Ana']],
    ['Premios', ['Luis', 'Ana']],
    ['Neto', ['Luis', 'Ana']],
  ];
  for (const [label, names] of expected) {
    click(label);
    expect(order()).toEqual(names);
    expect(screen.getByRole('columnheader', { name: label })).toHaveAttribute(
      'aria-sort',
      label === 'Jugador' || label === 'Puesto medio' ? 'ascending' : 'descending',
    );
    click(label);
    expect(order()).toEqual([...names].reverse());
  }
  click('Podios');
  expect(order()).toEqual(['Ana', 'Luis']);
  click('Podios');
  expect(order()).toEqual(['Ana', 'Luis']);
  expect(screen.getByRole('list', { name: 'Podio de la liga por puntos' }).textContent).toBe(
    podium,
  );
});

it('al cerrar el torneo ofrece una propina para el crupier con las formas de apoyar', async () => {
  const live: PokerSession = { ...session, startedAt: 1_000, eliminations: [3, 2] };
  let closed = false;
  api.mockImplementation((url: string, options?: { method?: string }) => {
    if (url === '/poker/8/history')
      return Promise.resolve(
        closed ? [{ ...live, closedAt: 2_000, results: [], leftoverCents: 1_000 }] : [],
      );
    if (options?.method === 'POST') closed = true;
    if (url === '/poker/8/music')
      return Promise.resolve({ organizer: true, searchAvailable: true, items: [] });
    if (options?.method === 'POST') return Promise.resolve({ ...league, current: null });
    return Promise.resolve({ ...league, current: live });
  });
  vi.mocked(confirmAction).mockResolvedValue(true);
  // Como en App: cada sección monta su propia página, así que el aviso tiene que sobrevivir al cambio.
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <MemoryRouter initialEntries={['/poker/mesa']}>
        <Routes>
          <Route
            path="/poker/mesa"
            element={<PokerLeague key="table" leagueId="8" view="table" />}
          />
          <Route
            path="/poker/historico"
            element={<PokerLeague key="history" leagueId="8" view="history" />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  fireEvent.click(await screen.findByRole('button', { name: 'Cerrar torneo' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Cerrar y guardar' }));

  const dialog = await screen.findByRole('dialog', { name: '¿Propina para el crupier?' });
  expect(await within(dialog).findByText('Os han sobrado del bote')).toBeVisible();
  expect(within(dialog).getByText(money(1000))).toBeVisible();
  expect(within(dialog).getByRole('link', { name: /Revolut/ })).toHaveAttribute(
    'href',
    'https://revolut.me/raclos',
  );
  fireEvent.click(within(dialog).getByRole('button', { name: 'Cerrar' }));
  expect(screen.queryByRole('dialog')).toBeNull();
});

it('sin torneos cerrados guía los primeros pasos y explica cada sección vacía', () => {
  const onInvite = vi.fn();
  const { unmount } = render(
    <MemoryRouter>
      <PokerHome
        league={{ ...league, current: null, players: [league.players[0]] }}
        current={null}
        sessions={[]}
        loading={false}
        busy={false}
        onAttend={onAttend}
        onRetry={vi.fn()}
        onInvite={onInvite}
      />
    </MemoryRouter>,
  );
  expect(screen.getByRole('region', { name: 'Próximo torneo' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Preparar torneo' })).toHaveAttribute(
    'href',
    '/poker/mesa?nuevo=1',
  );
  expect(screen.getByRole('heading', { name: 'Primeros pasos' })).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Podio de la liga' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Invitar' }));
  expect(onInvite).toHaveBeenCalledTimes(1);
  unmount();

  render(
    <MemoryRouter>
      <PokerHistory sessions={[]} />
      <PokerStatistics sessions={[]} />
    </MemoryRouter>,
  );
  expect(screen.getByText('Aún no hay torneos cerrados')).toBeInTheDocument();
  expect(screen.getByText('Sin estadísticas todavía')).toBeInTheDocument();
  expect(screen.getAllByRole('link', { name: 'Ir a la mesa' })).toHaveLength(2);
});

it('en el último torneo muestra a todos los empatados en cabeza, primero quien más neto ganó', () => {
  const tied = {
    ...session,
    closedAt: 5000,
    results: [
      { ...entries[0], place: 1, paidCents: 1000, prizeCents: 1500 },
      { ...entries[1], place: 1, paidCents: 1000, prizeCents: 3000 },
      { ...entries[2], place: 1, paidCents: 2000, prizeCents: 2500 },
    ],
  };
  render(
    <MemoryRouter>
      <PokerHome
        league={league}
        current={league.current}
        sessions={[tied]}
        loading={false}
        busy={false}
        onAttend={onAttend}
        onRetry={vi.fn()}
        onInvite={vi.fn()}
      />
    </MemoryRouter>,
  );
  expect(screen.getByText(/^Ganaron/)).toHaveTextContent('Ganaron Luis, Ana y Paz');
});

it('al pulsar un cromo del podio abre el perfil del jugador con sus números en la liga', () => {
  const closed: PokerSession = {
    ...session,
    id: 12,
    startedAt: 500,
    closedAt: 900,
    results: entries.map((entry, index) => ({
      ...entry,
      place: index + 1,
      paidCents: 1000,
      prizeCents: index === 0 ? 2100 : index === 1 ? 900 : 0,
      points: index === 0 ? 5 : index === 1 ? 4 : 0,
    })),
  };
  render(
    <PokerProfiles sessions={[closed]}>
      <PokerStatistics sessions={[closed]} />
    </PokerProfiles>,
  );
  click('Ver el perfil de Ana: 1.º, 5 puntos · 1 victoria');
  const card = screen.getByRole('dialog', { name: 'Perfil de Ana' });
  expect(card).toHaveTextContent('1.º de la liga · 1 victoria');
  expect(within(card).getByText('Neto').nextElementSibling).toHaveTextContent('+11');
  expect(
    within(card).getByRole('list', { name: /Puestos en los últimos torneos/ }),
  ).toHaveTextContent('1.º');
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.queryByRole('dialog')).toBeNull();

  // La foto y el nombre abren el mismo perfil.
  fireEvent.click(screen.getAllByRole('button', { name: 'Ver el perfil de Paz' })[0]);
  expect(screen.getByRole('dialog', { name: 'Perfil de Paz' })).toHaveTextContent('3.º de la liga');
});
