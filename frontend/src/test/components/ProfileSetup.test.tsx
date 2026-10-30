import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, expect, it, vi } from 'vitest';
import ProfileSettingsModal from '../../components/ProfileSettingsModal';
import { useAppStore } from '../../store/useAppStore';
import { completeProfileSetup, updateMyProfile } from '../../services/api';
vi.mock('../../services/api', () => ({
  completeProfileSetup: vi.fn(),
  updateMyProfile: vi.fn(),
  uploadMyAvatar: vi.fn(),
  deleteMyAvatar: vi.fn(),
  endSession: vi.fn(),
  updateUserPreferences: vi.fn(),
}));
vi.mock('../../components/ImagePicker', () => ({ default: () => <p>Foto de perfil opcional</p> }));
const close = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  useAppStore.setState({ userName: 'Carlos', userId: '10', profileSetupCompleted: false });
  vi.mocked(completeProfileSetup).mockResolvedValue({ status: 'success' });
  vi.mocked(updateMyProfile).mockResolvedValue({
    status: 'success',
    participantName: 'Raclos',
    avatarUrl: null,
  });
});
function showSetup() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <ProfileSettingsModal onboarding onClose={close} />
    </QueryClientProvider>,
  );
}
it('permite omitir y recuerda la elección sin modificar el nombre', async () => {
  showSetup();
  fireEvent.click(screen.getByRole('button', { name: 'Ahora no' }));
  await waitFor(() => expect(close).toHaveBeenCalled());
  expect(completeProfileSetup).toHaveBeenCalledOnce();
  expect(updateMyProfile).not.toHaveBeenCalled();
  expect(useAppStore.getState().profileSetupCompleted).toBe(true);
});
it('guarda el nombre antes de completar la presentación', async () => {
  showSetup();
  fireEvent.change(screen.getByLabelText('Nombre público'), { target: { value: 'Raclos' } });
  fireEvent.click(screen.getByRole('button', { name: 'Guardar y continuar' }));
  await waitFor(() => expect(close).toHaveBeenCalled());
  expect(updateMyProfile).toHaveBeenCalledWith('Raclos');
  expect(useAppStore.getState().userName).toBe('Raclos');
  expect(useAppStore.getState().profileSetupCompleted).toBe(true);
});
it('permite reintentar si no se puede guardar la elección', async () => {
  vi.mocked(completeProfileSetup).mockRejectedValue(new Error('Sin conexión'));
  showSetup();
  fireEvent.click(screen.getByRole('button', { name: 'Ahora no' }));
  expect(await screen.findByRole('alert')).toBeInTheDocument();
  expect(close).not.toHaveBeenCalled();
  expect(useAppStore.getState().profileSetupCompleted).toBe(false);
});
it('no reabre por una respuesta atrasada y se reinicia al cambiar de cuenta', () => {
  useAppStore.getState().setProfileSetupCompleted(true);
  useAppStore.getState().setProfileSetupCompleted(false);
  expect(useAppStore.getState().profileSetupCompleted).toBe(true);
  useAppStore.getState().setUserId('11');
  expect(useAppStore.getState().profileSetupCompleted).toBeNull();
});
