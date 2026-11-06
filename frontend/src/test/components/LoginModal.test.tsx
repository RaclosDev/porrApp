import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import LoginModal from '../../components/layout/LoginModal';
import { loginWithPasskey, setAuthToken, startPasskeyLogin } from '../../services/api';
import { getPasskey, passkeysSupported } from '../../utils/webauthn';
import { useAppStore } from '../../store/useAppStore';

vi.mock('../../services/api', () => ({
  loginWithGoogle: vi.fn(),
  startPasskeyLogin: vi.fn(),
  loginWithPasskey: vi.fn(),
  setAuthToken: vi.fn(),
}));

vi.mock('../../utils/webauthn', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../utils/webauthn')>()),
  passkeysSupported: vi.fn(() => true),
  getPasskey: vi.fn(),
}));

const close = vi.fn();

const renderModal = () =>
  render(
    <MemoryRouter>
      <LoginModal
        exitDemoMode={vi.fn()}
        handleGoogleSuccess={vi.fn()}
        isDemo={false}
        navigate={vi.fn()}
        setShowMyPredictionModal={close}
        showMyPredictionModal
      />
    </MemoryRouter>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(passkeysSupported).mockReturnValue(true);
});

it('signs in with a passkey and closes', async () => {
  localStorage.setItem('activeGroupId', '4');
  vi.mocked(startPasskeyLogin).mockResolvedValue({
    requestId: 'req-1',
    options: { publicKey: { challenge: 'AA' } },
  });
  vi.mocked(getPasskey).mockResolvedValue({ id: 'abc' });
  vi.mocked(loginWithPasskey).mockResolvedValue({
    token: 'access',
    userId: 7,
    participantName: 'Ana',
    status: 'login_success',
    lastSelectedGroupId: -1,
    avatarUrl: '',
  });
  renderModal();

  fireEvent.click(screen.getByRole('button', { name: 'Entrar con llave de acceso' }));

  await waitFor(() => expect(close).toHaveBeenCalledWith(false));
  expect(loginWithPasskey).toHaveBeenCalledWith('req-1', { id: 'abc' });
  expect(setAuthToken).toHaveBeenCalledWith('access');
  expect(useAppStore.getState().userName).toBe('Ana');
});

it('stays open when the system dialog is cancelled', async () => {
  vi.mocked(startPasskeyLogin).mockResolvedValue({
    requestId: 'req-1',
    options: { publicKey: {} },
  });
  vi.mocked(getPasskey).mockRejectedValue(new DOMException('cancelado', 'NotAllowedError'));
  renderModal();

  fireEvent.click(screen.getByRole('button', { name: 'Entrar con llave de acceso' }));

  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Entrar con llave de acceso' })).toBeEnabled(),
  );
  expect(loginWithPasskey).not.toHaveBeenCalled();
  expect(close).not.toHaveBeenCalled();
});

it('has no passkey button where the browser cannot use them', () => {
  vi.mocked(passkeysSupported).mockReturnValue(false);
  renderModal();

  expect(screen.queryByRole('button', { name: 'Entrar con llave de acceso' })).toBeNull();
});
