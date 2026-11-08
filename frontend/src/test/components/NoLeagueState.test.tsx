import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RequireLeague } from '../../components/NoLeagueState';
import { useAppContext } from '../../context/AppContext';
import { appContext, group } from '../context/fixtures';

vi.mock('../../context/AppContext', () => ({ useAppContext: vi.fn() }));
vi.mock('../../components/LeagueLoadState', () => ({
  default: () => <p>Cargando liga</p>,
}));

const show = () =>
  render(
    <MemoryRouter>
      <RequireLeague title="Mi porra" what="las predicciones">
        <p>Formulario de la liga</p>
      </RequireLeague>
    </MemoryRouter>,
  );

describe('RequireLeague', () => {
  beforeEach(() => vi.clearAllMocks());

  it('without leagues, invites to join or create one instead of any competition', () => {
    vi.mocked(useAppContext).mockReturnValue(
      appContext({ isAuthenticated: true, userName: 'Ana', activeGroupId: '', userGroups: [] }),
    );
    show();
    expect(screen.queryByText('Formulario de la liga')).toBeNull();
    expect(
      screen.getByText('Únete a una liga o crea la tuya para ver las predicciones.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ir a Mis ligas' })).toHaveAttribute(
      'href',
      '/mis-ligas',
    );
    expect(screen.getByRole('link', { name: 'Crear liga' })).toHaveAttribute('href', '/crear-liga');
  });

  it('while the most recent league is being opened, waits instead of showing the empty state', () => {
    vi.mocked(useAppContext).mockReturnValue(
      appContext({
        isAuthenticated: true,
        userName: 'Ana',
        activeGroupId: '',
        userGroups: [group({ id: 2 })],
      }),
    );
    show();
    expect(screen.getByText('Cargando liga')).toBeInTheDocument();
    expect(screen.queryByText(/Únete a una liga/)).toBeNull();
  });

  it('asks a visitor to sign in', () => {
    vi.mocked(useAppContext).mockReturnValue(
      appContext({ isAuthenticated: false, userName: '', activeGroupId: '' }),
    );
    show();
    expect(
      screen.getByText('Inicia sesión para ver las predicciones de tus ligas.'),
    ).toBeInTheDocument();
  });

  it('shows the screen when there is an active league', () => {
    vi.mocked(useAppContext).mockReturnValue(
      appContext({ isAuthenticated: true, userName: 'Ana', activeGroupId: '2' }),
    );
    show();
    expect(screen.getByText('Formulario de la liga')).toBeInTheDocument();
  });
});
