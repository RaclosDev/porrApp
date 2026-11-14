import { fireEvent, render, screen, within } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import HeaderActions from '../../components/layout/HeaderActions';

vi.mock('../../components/layout/InstallAppButton', () => ({ default: () => null }));
vi.mock('../../components/layout/NotificationBell', () => ({
  default: ({ onOpenSettings }: { onOpenSettings: () => void }) => (
    <button type="button" onClick={onOpenSettings}>
      Ajustes de avisos
    </button>
  ),
}));

const setup = (isAdmin = false) => {
  const onOpenSettings = vi.fn();
  const setShowProfileMenu = vi.fn();
  const navigate = vi.fn();
  render(
    <HeaderActions
      enterDemoMode={vi.fn()}
      isLanding={false}
      isUserLoggedIn
      navigate={navigate}
      onLogout={vi.fn()}
      setShowLoginModal={vi.fn()}
      setShowProfileMenu={setShowProfileMenu}
      onOpenSettings={onOpenSettings}
      showProfileMenu
      showNotificationBell
      userAvatarUrl=""
      isAdmin={isAdmin}
      userId="1"
      userName="Ana"
    />,
  );
  return { onOpenSettings, setShowProfileMenu, navigate };
};

it('el menú de cuenta tiene «Avisos», que abre los ajustes en esa sección', () => {
  const { onOpenSettings, setShowProfileMenu } = setup();

  fireEvent.click(screen.getByRole('button', { name: 'Avisos' }));

  expect(onOpenSettings).toHaveBeenCalledWith('reminders');
  expect(setShowProfileMenu).toHaveBeenCalledWith(false);
});

it('«Ajustes de cuenta» abre los ajustes por arriba y la campana, en los avisos', () => {
  const { onOpenSettings } = setup();

  fireEvent.click(screen.getByRole('button', { name: 'Ajustes de cuenta' }));
  expect(onOpenSettings).toHaveBeenLastCalledWith('account');

  fireEvent.click(screen.getByRole('button', { name: 'Ajustes de avisos' }));
  expect(onOpenSettings).toHaveBeenLastCalledWith('reminders');
});

it('el botón de apoyar abre una ventana con Ko-fi, Revolut y PayPal en otra pestaña', () => {
  setup();
  expect(screen.queryByRole('dialog')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Apoya el proyecto' }));

  const dialog = screen.getByRole('dialog', { name: 'Invítanos a un café' });
  const expected = {
    'Ko-fi': 'https://ko-fi.com/O3E42AJYOP',
    Revolut: 'https://revolut.me/raclos',
    PayPal: 'https://www.paypal.com/paypalme/raclos',
  };
  for (const [name, href] of Object.entries(expected)) {
    const link = within(dialog).getByRole('link', { name: new RegExp(`^${name}`) });
    expect(link).toHaveAttribute('href', href);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  }

  fireEvent.click(within(dialog).getByRole('button', { name: 'Cerrar' }));
  expect(screen.queryByRole('dialog')).toBeNull();
});

it('solo la cuenta de administrador ve «Panel de gestión» y lleva al panel', () => {
  setup();
  expect(screen.queryByRole('button', { name: 'Panel de gestión' })).toBeNull();
});

it('el administrador abre el panel desde el menú', () => {
  const { navigate, setShowProfileMenu } = setup(true);

  fireEvent.click(screen.getByRole('button', { name: 'Panel de gestión' }));

  expect(navigate).toHaveBeenCalledWith('/gestion-7k2q');
  expect(setShowProfileMenu).toHaveBeenCalledWith(false);
});
