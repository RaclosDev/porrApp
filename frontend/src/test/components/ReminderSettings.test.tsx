import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, expect, it, vi } from 'vitest';
import ReminderSettings from '../../components/ReminderSettings';
import { fetchPushConfig, setPushPreferences } from '../../services/api';
import { enablePush, needsIosInstall, notificationPermission, testPush } from '../../services/push';

vi.mock('../../services/api', () => ({ fetchPushConfig: vi.fn(), setPushPreferences: vi.fn() }));
vi.mock('../../services/push', () => ({
  enablePush: vi.fn(),
  testPush: vi.fn(),
  needsIosInstall: vi.fn(() => false),
  notificationPermission: vi.fn(() => 'granted'),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(enablePush).mockResolvedValue(true);
  vi.mocked(testPush).mockResolvedValue(undefined);
  vi.mocked(needsIosInstall).mockReturnValue(false);
  vi.mocked(notificationPermission).mockReturnValue('granted');
  vi.mocked(fetchPushConfig).mockResolvedValue({
    publicKey: 'KEY',
    remindersEnabled: true,
    memberJoinedEnabled: true,
    matchdayFinishedEnabled: true,
  });
  vi.mocked(setPushPreferences).mockResolvedValue(undefined);
});

it('tests only this device and distinguishes acceptance from display', async () => {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ReminderSettings />
    </QueryClientProvider>,
  );
  fireEvent.click(await screen.findByRole('button', { name: 'Probar notificaciones' }));
  expect(testPush).toHaveBeenCalledWith('KEY');
  expect(await screen.findByRole('status')).toHaveTextContent('Prueba aceptada');
  expect(screen.getByRole('status')).toHaveTextContent('Comprueba si aparece');
  expect(setPushPreferences).not.toHaveBeenCalled();
});

it('shows a test failure without claiming success', async () => {
  vi.mocked(testPush).mockRejectedValueOnce(new Error('El proveedor no ha aceptado la prueba'));
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ReminderSettings />
    </QueryClientProvider>,
  );
  fireEvent.click(await screen.findByRole('button', { name: 'Probar notificaciones' }));
  expect(await screen.findByRole('status')).toHaveTextContent('El proveedor no ha aceptado');
});

it.each(['default', 'granted'] as const)(
  'registers the device before saving an enabled preference with permission %s',
  async (permission) => {
    vi.mocked(notificationPermission).mockReturnValue(permission);
    vi.mocked(fetchPushConfig).mockResolvedValue({
      publicKey: 'KEY',
      remindersEnabled: true,
      memberJoinedEnabled: false,
      matchdayFinishedEnabled: true,
    });
    vi.mocked(enablePush).mockImplementationOnce(async () => {
      expect(setPushPreferences).not.toHaveBeenCalled();
      return true;
    });
    render(
      <QueryClientProvider client={new QueryClient()}>
        <ReminderSettings />
      </QueryClientProvider>,
    );
    const checkbox = await screen.findByRole('checkbox', {
      name: 'Avisarme cuando alguien se una a mis ligas',
    });
    fireEvent.click(checkbox);
    expect(enablePush).toHaveBeenCalledWith('KEY');
    await waitFor(() => expect(checkbox).toBeChecked());
    expect(setPushPreferences).toHaveBeenCalledWith({ memberJoinedEnabled: true });
  },
);

it.each(['denied', 'registration failure'])(
  'does not mark an alert as enabled after %s',
  async (failure) => {
    vi.mocked(fetchPushConfig).mockResolvedValue({
      publicKey: 'KEY',
      remindersEnabled: true,
      memberJoinedEnabled: false,
      matchdayFinishedEnabled: true,
    });
    if (failure === 'denied') vi.mocked(enablePush).mockResolvedValueOnce(false);
    else
      vi.mocked(enablePush).mockRejectedValueOnce(new Error('No se pudo registrar el dispositivo'));
    render(
      <QueryClientProvider client={new QueryClient()}>
        <ReminderSettings />
      </QueryClientProvider>,
    );
    const checkbox = await screen.findByRole('checkbox', {
      name: 'Avisarme cuando alguien se una a mis ligas',
    });
    fireEvent.click(checkbox);
    await waitFor(() => expect(checkbox).not.toBeDisabled());
    expect(checkbox).not.toBeChecked();
    expect(setPushPreferences).not.toHaveBeenCalled();
  },
);

it('repairs this device without changing the account preferences', async () => {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ReminderSettings />
    </QueryClientProvider>,
  );
  fireEvent.click(
    await screen.findByRole('button', { name: 'Activar avisos en este dispositivo' }),
  );
  expect(enablePush).toHaveBeenCalledWith('KEY');
  expect(await screen.findByRole('status')).toHaveTextContent('Dispositivo registrado');
  expect(setPushPreferences).not.toHaveBeenCalled();
});

it('shows a registration failure and allows another attempt', async () => {
  vi.mocked(enablePush).mockRejectedValueOnce(new Error('Sin conexión'));
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ReminderSettings />
    </QueryClientProvider>,
  );
  const button = await screen.findByRole('button', { name: 'Activar avisos en este dispositivo' });
  fireEvent.click(button);
  expect(await screen.findByRole('status')).toHaveTextContent('Sin conexión');
  fireEvent.click(button);
  await waitFor(() =>
    expect(screen.getByRole('status')).toHaveTextContent('Dispositivo registrado'),
  );
});

it('explains the installation requirement instead of offering registration in an iPhone tab', async () => {
  vi.mocked(needsIosInstall).mockReturnValue(true);
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ReminderSettings />
    </QueryClientProvider>,
  );
  expect(await screen.findByText(/En iPhone y iPad llegan solo/)).toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'Activar avisos en este dispositivo' }),
  ).not.toBeInTheDocument();
});

it('turns off only the new member alert', async () => {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ReminderSettings />
    </QueryClientProvider>,
  );
  const memberJoined = await screen.findByRole('checkbox', {
    name: 'Avisarme cuando alguien se una a mis ligas',
  });
  const reminders = screen.getByRole('checkbox', {
    name: 'Recordarme las predicciones pendientes',
  });

  fireEvent.click(memberJoined);

  await waitFor(() => expect(memberJoined).not.toBeChecked());
  expect(setPushPreferences).toHaveBeenCalledWith({ memberJoinedEnabled: false });
  expect(reminders).toBeChecked();
});

it('turns off only the matchday finished alert', async () => {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ReminderSettings />
    </QueryClientProvider>,
  );
  const matchdayFinished = await screen.findByRole('checkbox', {
    name: 'Avisarme cuando termine una jornada, con el ranking',
  });

  fireEvent.click(matchdayFinished);

  await waitFor(() => expect(matchdayFinished).not.toBeChecked());
  expect(setPushPreferences).toHaveBeenCalledWith({ matchdayFinishedEnabled: false });
  expect(
    screen.getByRole('checkbox', { name: 'Recordarme las predicciones pendientes' }),
  ).toBeChecked();
});

it('sin claves de push en el servidor, la sección dice que no hay avisos', async () => {
  vi.mocked(fetchPushConfig).mockResolvedValue({
    publicKey: null,
    remindersEnabled: true,
    memberJoinedEnabled: true,
    matchdayFinishedEnabled: true,
  });
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ReminderSettings />
    </QueryClientProvider>,
  );

  expect(screen.getByRole('region', { name: 'Avisos' })).toBeInTheDocument();
  expect(
    await screen.findByText('Los avisos no están disponibles ahora mismo.'),
  ).toBeInTheDocument();
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
});
