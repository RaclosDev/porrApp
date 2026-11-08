import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import LoginModal from '../../components/layout/LoginModal';
import {
  loginWithPasskey,
  loginWithPassword,
  registerWithPassword,
  requestPasswordReset,
  setAuthToken,
  startPasskeyLogin,
} from '../../services/api';
import { getPasskey, passkeysSupported } from '../../utils/webauthn';
import { useAppStore } from '../../store/useAppStore';
import type { LoginResponse } from '../../types/api';

vi.mock('../../services/api', () => ({
  loginWithGoogle: vi.fn(),
  loginWithApple: vi.fn(),
  whenSessionRestored: vi.fn(() => null),
  startPasskeyLogin: vi.fn(),
  loginWithPasskey: vi.fn(),
  loginWithPassword: vi.fn(),
  registerWithPassword: vi.fn(),
  requestPasswordReset: vi.fn(),
  resetPassword: vi.fn(),
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
  localStorage.clear();
  useAppStore.setState({ isAuthenticated: false, userName: '' });
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

const session: LoginResponse = {
  token: 'access',
  userId: 9,
  participantName: 'marta',
  status: 'login_success',
  lastSelectedGroupId: -1,
  avatarUrl: '',
};

const openEmailForm = () => {
  renderModal();
  fireEvent.click(screen.getByRole('button', { name: 'Continuar con email' }));
};

const fill = (email: string, password: string) => {
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: email } });
  fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: password } });
};

it('creates an account with email and password and closes', async () => {
  vi.mocked(registerWithPassword).mockResolvedValue(session);
  openEmailForm();

  fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));
  fill(' marta@test.com ', 'una-clave-larga');
  fireEvent.click(screen.getAllByRole('button', { name: 'Crear cuenta' })[1]);

  await waitFor(() => expect(close).toHaveBeenCalledWith(false));
  expect(registerWithPassword).toHaveBeenCalledWith('marta@test.com', 'una-clave-larga');
  expect(setAuthToken).toHaveBeenCalledWith('access');
  expect(useAppStore.getState().userName).toBe('marta');
});

it('does not send a password that is too short when registering', () => {
  openEmailForm();

  fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));
  fill('marta@test.com', 'corta');
  fireEvent.click(screen.getAllByRole('button', { name: 'Crear cuenta' })[1]);

  expect(screen.getByRole('alert')).toHaveTextContent('al menos 8 caracteres');
  expect(registerWithPassword).not.toHaveBeenCalled();
});

it('asks for the reset link with the email already typed and says the same whatever the account', async () => {
  vi.mocked(requestPasswordReset).mockResolvedValue({ message: 'ok' });
  openEmailForm();

  fill(' marta@test.com ', '');
  fireEvent.click(screen.getByRole('button', { name: '¿Has olvidado la contraseña?' }));
  fireEvent.click(screen.getByRole('button', { name: 'Mandar enlace' }));

  expect(await screen.findByRole('status')).toHaveTextContent('te llegará un enlace');
  expect(requestPasswordReset).toHaveBeenCalledWith('marta@test.com');

  fireEvent.click(screen.getByRole('button', { name: 'Volver' }));
  expect(screen.getByRole('button', { name: 'Entrar' })).toBeInTheDocument();
});

it('shows why the reset link could not be sent', async () => {
  vi.mocked(requestPasswordReset).mockRejectedValue(
    new Error('Ahora mismo no se puede recuperar la contraseña por correo.'),
  );
  openEmailForm();

  fireEvent.click(screen.getByRole('button', { name: '¿Has olvidado la contraseña?' }));
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'marta@test.com' } });
  fireEvent.click(screen.getByRole('button', { name: 'Mandar enlace' }));

  expect(await screen.findByRole('alert')).toHaveTextContent('no se puede recuperar');
});

it('shows the server error next to the form when the password is wrong', async () => {
  vi.mocked(loginWithPassword).mockRejectedValue(new Error('Email o contraseña incorrectos.'));
  openEmailForm();

  fill('marta@test.com', 'otra-clave');
  fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));

  expect(await screen.findByRole('alert')).toHaveTextContent('Email o contraseña incorrectos.');
  expect(loginWithPassword).toHaveBeenCalledWith('marta@test.com', 'otra-clave');
  expect(close).not.toHaveBeenCalled();
});

it('asks for the passkey on its own when this device already signed in with one', async () => {
  localStorage.setItem('passkey_on_device', '1');
  vi.mocked(startPasskeyLogin).mockResolvedValue({
    requestId: 'req-2',
    options: { publicKey: { challenge: 'AA' } },
  });
  vi.mocked(getPasskey).mockResolvedValue({ id: 'abc' });
  vi.mocked(loginWithPasskey).mockResolvedValue(session);

  renderModal();

  await waitFor(() => expect(close).toHaveBeenCalledWith(false));
  expect(startPasskeyLogin).toHaveBeenCalledOnce();
});

it('stops asking on its own after the automatic passkey is cancelled twice', async () => {
  localStorage.setItem('passkey_on_device', '1');
  vi.mocked(startPasskeyLogin).mockResolvedValue({
    requestId: 'req-3',
    options: { publicKey: {} },
  });
  vi.mocked(getPasskey).mockRejectedValue(new DOMException('cancelado', 'NotAllowedError'));

  for (let attempt = 1; attempt <= 3; attempt++) {
    const { unmount } = renderModal();
    await waitFor(() => expect(getPasskey).toHaveBeenCalledTimes(Math.min(attempt, 2)));
    unmount();
  }

  expect(startPasskeyLogin).toHaveBeenCalledTimes(2);
  expect(close).not.toHaveBeenCalled();
});

it('does not ask for a passkey on its own on a device that never used one', async () => {
  renderModal();

  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(startPasskeyLogin).not.toHaveBeenCalled();
});
