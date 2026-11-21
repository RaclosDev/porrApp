import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import Login from '../../pages/Login';
import { useAppContext } from '../../context/AppContext';
import { appContext } from '../context/fixtures';

vi.mock('../../context/AppContext', () => ({ useAppContext: vi.fn() }));
vi.mock('../../services/api', () => ({
  loginWithGoogle: vi.fn(),
  loginWithApple: vi.fn(),
  whenSessionRestored: vi.fn(() => null),
  startPasskeyLogin: vi.fn(),
  loginWithPasskey: vi.fn(),
  loginWithPassword: vi.fn(),
  registerWithPassword: vi.fn(),
  confirmRegistration: vi.fn(),
  requestPasswordReset: vi.fn(),
  resetPassword: vi.fn(),
  setAuthToken: vi.fn(),
}));

function Where() {
  const { pathname, search } = useLocation();
  return <p data-testid="where">{pathname + search}</p>;
}

const renderAt = (url: string) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/registro" element={<Login intent="signup" />} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  localStorage.clear();
  vi.mocked(useAppContext).mockReturnValue(appContext({ isAuthenticated: false }));
});

it('shows the email form with password-manager friendly fields', () => {
  renderAt('/login');
  expect(screen.getByRole('heading', { name: 'Inicia sesión' })).toBeInTheDocument();
  expect(screen.getByLabelText(/^email$/i)).toHaveAttribute(
    'autocomplete',
    expect.stringContaining('username'),
  );
  expect(screen.getByLabelText(/^contraseña$/i)).toHaveAttribute(
    'autocomplete',
    'current-password',
  );
});

it('sends a signed-in user to the requested internal route', () => {
  vi.mocked(useAppContext).mockReturnValue(appContext({ isAuthenticated: true, userName: 'Ana' }));
  renderAt('/login?redirect=%2Fcrear-liga');
  expect(screen.getByTestId('where')).toHaveTextContent('/crear-liga');
});

it('ignores an external redirect', () => {
  vi.mocked(useAppContext).mockReturnValue(appContext({ isAuthenticated: true, userName: 'Ana' }));
  renderAt('/login?redirect=https%3A%2F%2Fevil.com');
  expect(screen.getByTestId('where')).toHaveTextContent('/');
});

it('prefers a pending invitation', () => {
  localStorage.setItem('pendingJoinCode', 'ABC');
  vi.mocked(useAppContext).mockReturnValue(appContext({ isAuthenticated: true, userName: 'Ana' }));
  renderAt('/login?redirect=%2Fcrear-liga');
  expect(screen.getByTestId('where')).toHaveTextContent('/join/ABC');
});

it('opens /registro on «Crea tu cuenta» and switches to /login keeping the destination', () => {
  renderAt('/registro?redirect=%2Fcrear-liga');
  expect(screen.getByRole('heading', { name: 'Crea tu cuenta' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Inicia sesión' }));
  expect(screen.getByRole('heading', { name: 'Inicia sesión' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Crea una gratis' }));
  expect(screen.getByRole('heading', { name: 'Crea tu cuenta' })).toBeInTheDocument();
});

it('sends a new account from /registro to create the league', () => {
  vi.mocked(useAppContext).mockReturnValue(appContext({ isAuthenticated: true, userName: 'Ana' }));
  renderAt('/registro?redirect=%2Fcrear-liga');
  expect(screen.getByTestId('where')).toHaveTextContent('/crear-liga');
});
