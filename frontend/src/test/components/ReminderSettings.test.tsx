import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, expect, it, vi } from 'vitest';
import ReminderSettings from '../../components/ReminderSettings';
import { fetchPushConfig, setPushPreferences } from '../../services/api';

vi.mock('../../services/api', () => ({ fetchPushConfig: vi.fn(), setPushPreferences: vi.fn() }));
vi.mock('../../services/push', () => ({
  enablePush: vi.fn(),
  needsIosInstall: vi.fn(() => false),
  notificationPermission: vi.fn(() => 'granted'),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(fetchPushConfig).mockResolvedValue({
    publicKey: 'KEY',
    remindersEnabled: true,
    memberJoinedEnabled: true,
    matchdayFinishedEnabled: true,
  });
  vi.mocked(setPushPreferences).mockResolvedValue(undefined);
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
