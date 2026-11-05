import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import ProfileSettingsModal from '../../components/ProfileSettingsModal';
import { deleteMyAccount, updateMyProfile } from '../../services/api';
import { useAppStore } from '../../store/useAppStore';
import type { ProfileResponse } from '../../types/api';

vi.mock('../../services/api', () => ({
  updateMyProfile: vi.fn(),
  uploadMyAvatar: vi.fn(),
  deleteMyAvatar: vi.fn(),
  completeProfileSetup: vi.fn(),
  deleteMyAccount: vi.fn(),
  fetchPushConfig: vi
    .fn()
    .mockResolvedValue({ publicKey: null, remindersEnabled: true, memberJoinedEnabled: true }),
  setPushPreferences: vi.fn(),
}));

it('blocks name editing and Escape while the profile update is pending', async () => {
  useAppStore.setState({ userName: 'Ana', userId: '1' });
  let finish!: (profile: ProfileResponse) => void;
  vi.mocked(updateMyProfile).mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  const onClose = vi.fn();
  render(
    <MemoryRouter>
      <QueryClientProvider client={new QueryClient()}>
        <ProfileSettingsModal onClose={onClose} />
      </QueryClientProvider>
    </MemoryRouter>,
  );
  const name = screen.getByLabelText('Nombre público');
  fireEvent.change(name, { target: { value: 'Ana nueva' } });
  fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
  expect(name).toBeDisabled();
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(onClose).not.toHaveBeenCalled();
  finish({ status: 'success', participantName: 'Ana nueva', avatarUrl: null });
  await waitFor(() => expect(name).toBeEnabled());
  expect(name).toHaveValue('Ana nueva');
});

it('borra la cuenta solo tras confirmar y cierra la sesión', async () => {
  useAppStore.setState({ userName: 'Ana', userId: '1' });
  vi.mocked(deleteMyAccount).mockResolvedValue({ status: 'success' });
  const logout = vi.fn();
  useAppStore.setState({ logout });
  const onClose = vi.fn();
  render(
    <MemoryRouter>
      <QueryClientProvider client={new QueryClient()}>
        <ProfileSettingsModal onClose={onClose} />
      </QueryClientProvider>
    </MemoryRouter>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Borrar mi cuenta' }));
  expect(deleteMyAccount).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Sí, borrar mi cuenta' }));
  await waitFor(() => expect(onClose).toHaveBeenCalled());
  expect(deleteMyAccount).toHaveBeenCalledTimes(1);
  expect(logout).toHaveBeenCalled();
});
