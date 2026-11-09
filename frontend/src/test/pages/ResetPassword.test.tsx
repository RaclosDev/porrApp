import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import ResetPassword from '../../pages/ResetPassword';
import { resetPassword } from '../../services/api';
import { useAppStore } from '../../store/useAppStore';

vi.mock('../../services/api', () => ({
  resetPassword: vi.fn(),
  setAuthToken: vi.fn(),
}));

const renderPage = (hash: string) => {
  window.history.replaceState(null, '', `/restablecer-contrasena${hash}`);
  return render(
    <MemoryRouter initialEntries={['/restablecer-contrasena']}>
      <Routes>
        <Route path="/restablecer-contrasena" element={<ResetPassword />} />
        <Route path="/" element={<p>Portada</p>} />
      </Routes>
    </MemoryRouter>,
  );
};

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  useAppStore.setState({ isAuthenticated: false, userName: '' });
});

it('sets the new password with the token from the link and goes in', async () => {
  vi.mocked(resetPassword).mockResolvedValue({
    token: 'access',
    participantName: 'marta',
    status: 'login_success',
    userId: 9,
    lastSelectedGroupId: -1,
    avatarUrl: '',
  });
  renderPage('#token=abc_123');

  expect(window.location.hash).toBe('');
  fireEvent.change(screen.getByLabelText('Contraseña nueva'), {
    target: { value: 'clave-nueva-larga' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Guardar y entrar' }));

  expect(await screen.findByText('Portada')).toBeInTheDocument();
  expect(resetPassword).toHaveBeenCalledWith('abc_123', 'clave-nueva-larga');
  expect(useAppStore.getState().userName).toBe('marta');
});

it('does not send a short password', () => {
  renderPage('#token=abc_123');

  fireEvent.change(screen.getByLabelText('Contraseña nueva'), { target: { value: 'corta' } });
  fireEvent.click(screen.getByRole('button', { name: 'Guardar y entrar' }));

  expect(screen.getByRole('alert')).toHaveTextContent('al menos 8 caracteres');
  expect(resetPassword).not.toHaveBeenCalled();
});

it('shows the server error when the link has expired', async () => {
  vi.mocked(resetPassword).mockRejectedValue(new Error('El enlace ha caducado o ya se ha usado.'));
  renderPage('#token=viejo');

  fireEvent.change(screen.getByLabelText('Contraseña nueva'), {
    target: { value: 'clave-nueva-larga' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Guardar y entrar' }));

  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('caducado'));
});

it('explains that a link without token is not valid', () => {
  renderPage('');

  expect(screen.getByRole('alert')).toHaveTextContent('no es válido');
  expect(screen.queryByLabelText('Contraseña nueva')).not.toBeInTheDocument();
});
