import type { ReactNode } from 'react';
import { appContext, group } from '../context/fixtures';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import JoinRedirect from '../../components/JoinRedirect';
import { useAppContext } from '../../context/AppContext';
import { fetchGroupInvitationPreview, fetchMyGroups, joinGroup } from '../../services/api';

const signIn = vi.hoisted(() => vi.fn());
const emailSignIn = vi.hoisted(() => vi.fn());
const changeGroup = vi.hoisted(() => vi.fn());
vi.mock('../../context/AppContext', () => ({ useAppContext: vi.fn() }));
vi.mock('../../hooks/useGoogleSignIn', () => ({
  useGoogleSignIn: () => signIn,
  useAppleSignIn: () => vi.fn(),
  useEmailSignIn: () => emailSignIn,
}));
vi.mock('../../hooks/usePasskeyAutoSignIn', () => ({ usePasskeyAutoSignIn: vi.fn() }));
vi.mock('@react-oauth/google', () => ({
  GoogleOAuthProvider: ({ children }: { children: ReactNode }) => children,
  GoogleLogin: ({ onSuccess }: { onSuccess: (response: { credential: string }) => void }) => (
    <button onClick={() => onSuccess({ credential: 'test' })}>Continuar con Google</button>
  ),
}));
vi.mock('../../services/api', () => ({
  fetchGroupInvitationPreview: vi.fn(),
  fetchMyGroups: vi.fn(),
  joinGroup: vi.fn(),
}));
const league = group({ id: 42, name: 'Tebas League', poolFormat: 'MATCH_DAY' });

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  vi.mocked(useAppContext).mockReturnValue(
    appContext({
      isAuthenticated: false,
      userName: '',
      changeGroup,
    }),
  );
  vi.mocked(fetchGroupInvitationPreview).mockResolvedValue(league);
  vi.mocked(fetchMyGroups).mockResolvedValue([]);
  vi.mocked(joinGroup).mockResolvedValue(league);
  signIn.mockResolvedValue(true);
  emailSignIn.mockResolvedValue(undefined);
});

function showInvitation() {
  return render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <MemoryRouter initialEntries={['/join/abc123']}>
        <Routes>
          <Route path="/join/:code" element={<JoinRedirect />} />
          <Route path="/jornadas" element={<p>Tu jornada</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

it('mantiene la invitación y se une tras Google sin pasar por Mis ligas', async () => {
  showInvitation();
  expect(await screen.findByRole('heading', { name: 'Tebas League' })).toBeInTheDocument();
  expect(joinGroup).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Continuar con Google' }));
  expect(await screen.findByText('Tu jornada')).toBeInTheDocument();
  expect(joinGroup).toHaveBeenCalledExactlyOnceWith('ABC123');
  expect(changeGroup).toHaveBeenCalledWith('42');
  expect(localStorage.getItem('pendingJoinCode')).toBeNull();
});

it('no se une si falla el inicio de sesión y conserva el enlace', async () => {
  signIn.mockResolvedValue(false);
  showInvitation();
  fireEvent.click(await screen.findByRole('button', { name: 'Continuar con Google' }));
  await waitFor(() => expect(signIn).toHaveBeenCalled());
  expect(joinGroup).not.toHaveBeenCalled();
  expect(localStorage.getItem('pendingJoinCode')).toBe('ABC123');
});

it('se une tras crear una cuenta con email', async () => {
  showInvitation();
  fireEvent.click(await screen.findByRole('button', { name: 'Continuar con email' }));
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'nuevo@test.com' } });
  fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'una-clave-larga' } });
  fireEvent.click(screen.getAllByRole('button', { name: 'Crear cuenta' })[1]);
  expect(await screen.findByText('Tu jornada')).toBeInTheDocument();
  expect(emailSignIn).toHaveBeenCalledWith('register', 'nuevo@test.com', 'una-clave-larga');
  expect(joinGroup).toHaveBeenCalledExactlyOnceWith('ABC123');
});

it('permite aceptar con sesión ya iniciada', async () => {
  vi.mocked(useAppContext).mockReturnValue(
    appContext({
      isAuthenticated: true,
      userName: 'Carlos',
      changeGroup,
    }),
  );
  showInvitation();
  const button = await screen.findByRole('button', { name: 'Unirme a la liga' });
  await waitFor(() => expect(button).not.toBeDisabled());
  expect(joinGroup).not.toHaveBeenCalled();
  fireEvent.click(button);
  expect(await screen.findByText('Tu jornada')).toBeInTheDocument();
});

it('abre directamente la liga de quien ya es miembro', async () => {
  vi.mocked(useAppContext).mockReturnValue(
    appContext({
      isAuthenticated: true,
      userName: 'Carlos',
      changeGroup,
    }),
  );
  vi.mocked(fetchMyGroups).mockResolvedValue([league]);
  showInvitation();
  expect(await screen.findByText('Tu jornada')).toBeInTheDocument();
  expect(joinGroup).not.toHaveBeenCalled();
});

it('muestra una invitación inválida sin ofrecer acceso ni alta', async () => {
  vi.mocked(fetchGroupInvitationPreview).mockRejectedValue(new Error('No existe'));
  showInvitation();
  expect(await screen.findByRole('alert')).toHaveTextContent('Esta invitación no está disponible');
  expect(screen.queryByRole('button', { name: 'Continuar con Google' })).not.toBeInTheDocument();
  expect(joinGroup).not.toHaveBeenCalled();
});
