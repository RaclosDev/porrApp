import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import InstallAppButton from '../../components/layout/InstallAppButton';
import NotificationBell from '../../components/layout/NotificationBell';
import {
  fetchPushConfig,
  fetchRecentPushNotifications,
  setPushPreferences,
} from '../../services/api';
import * as push from '../../services/push';
import * as install from '../../services/installPrompt';

vi.mock('../../services/api', () => ({
  fetchPushConfig: vi.fn(),
  fetchRecentPushNotifications: vi.fn(),
  setPushPreferences: vi.fn(() => Promise.resolve()),
}));
vi.mock('../../services/push', () => ({
  bellAction: vi.fn(),
  enablePush: vi.fn(),
}));
vi.mock('../../services/installPrompt', () => ({
  installState: vi.fn(),
  promptInstall: vi.fn(() => Promise.resolve('accepted')),
  subscribeInstallState: vi.fn(() => () => {}),
}));

const wrap = (ui: React.ReactNode) =>
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );

describe('InstallAppButton', () => {
  it('opens the browser install dialog with a single tap', () => {
    vi.mocked(install.installState).mockReturnValue('native');
    wrap(<InstallAppButton />);

    fireEvent.click(screen.getByRole('button', { name: 'Instalar porrApp' }));

    expect(install.promptInstall).toHaveBeenCalledTimes(1);
  });

  it('explains the Share → Add to Home Screen steps on iPhone', () => {
    vi.mocked(install.installState).mockReturnValue('ios');
    wrap(<InstallAppButton />);

    fireEvent.click(screen.getByRole('button', { name: 'Instalar porrApp' }));

    const dialog = screen.getByRole('dialog', { name: 'Instala porrApp en tu iPhone' });
    expect(within(dialog).getByText('Compartir')).toBeInTheDocument();
    expect(within(dialog).getByText('Añadir a pantalla de inicio')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Entendido' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it.each(['installed', 'unavailable'] as const)('is hidden when %s', (state) => {
    vi.mocked(install.installState).mockReturnValue(state);
    wrap(<InstallAppButton />);

    expect(screen.queryByRole('button', { name: 'Instalar porrApp' })).toBeNull();
  });
});

describe('NotificationBell', () => {
  const onOpenSettings = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchPushConfig).mockResolvedValue({
      publicKey: 'KEY',
      remindersEnabled: true,
      memberJoinedEnabled: true,
    });
  });

  it('enables notifications with one tap when they are off', async () => {
    vi.mocked(push.bellAction).mockReturnValue('enable');
    vi.mocked(push.enablePush).mockResolvedValue(true);
    wrap(<NotificationBell onOpenSettings={onOpenSettings} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Activar avisos' }));

    await waitFor(() => expect(push.enablePush).toHaveBeenCalledWith('KEY'));
    expect(setPushPreferences).not.toHaveBeenCalled();
  });

  it('also turns the account preferences on if they were off', async () => {
    vi.mocked(fetchPushConfig).mockResolvedValue({
      publicKey: 'KEY',
      remindersEnabled: false,
      memberJoinedEnabled: false,
    });
    vi.mocked(push.bellAction).mockReturnValue('enable');
    vi.mocked(push.enablePush).mockResolvedValue(true);
    wrap(<NotificationBell onOpenSettings={onOpenSettings} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Activar avisos' }));

    await waitFor(() =>
      expect(setPushPreferences).toHaveBeenCalledWith({
        remindersEnabled: true,
        memberJoinedEnabled: true,
      }),
    );
  });

  it('on an iPhone browser tab, offers to install the app first', async () => {
    vi.mocked(push.bellAction).mockReturnValue('install-first');
    wrap(<NotificationBell onOpenSettings={onOpenSettings} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Activar avisos' }));

    expect(screen.getByRole('dialog', { name: 'Instala porrApp en tu iPhone' })).toHaveTextContent(
      'los avisos solo llegan con porrApp instalada',
    );
    expect(push.enablePush).not.toHaveBeenCalled();
  });

  it('shows the last notifications and links to their league', async () => {
    vi.mocked(push.bellAction).mockReturnValue('recent');
    vi.mocked(fetchRecentPushNotifications).mockResolvedValue([
      {
        title: 'Te faltan 2 predicciones',
        body: 'Tebas League · la primera cierra a las 21:00',
        url: '/jornadas?group=5',
        sentAt: new Date(Date.now() - 2 * 3_600_000).toISOString(),
      },
      {
        title: 'Pepe se ha unido a Los del barrio',
        body: 'Ya sois 4 en la liga.',
        url: 'https://evil.example/',
        sentAt: new Date(Date.now() - 3 * 86_400_000).toISOString(),
      },
    ]);
    wrap(<NotificationBell onOpenSettings={onOpenSettings} />);

    const bell = await screen.findByRole('button', { name: 'Últimos avisos' });
    expect(bell).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(bell);
    expect(bell).toHaveAttribute('aria-expanded', 'true');

    const panel = screen.getByRole('dialog', { name: 'Últimos avisos' });
    const link = await within(panel).findByRole('link', { name: /Te faltan 2 predicciones/ });
    expect(link).toHaveAttribute('href', '/jornadas?group=5');
    expect(within(panel).getByText('hace 2 horas')).toBeInTheDocument();
    // Un enlace externo no se sigue: se muestra como texto.
    expect(within(panel).getAllByRole('link')).toHaveLength(1);
    expect(within(panel).getByText('Pepe se ha unido a Los del barrio')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(bell).toHaveFocus();
  });

  it('says so when nothing has been sent yet and links to the settings', async () => {
    vi.mocked(push.bellAction).mockReturnValue('recent');
    vi.mocked(fetchRecentPushNotifications).mockResolvedValue([]);
    wrap(<NotificationBell onOpenSettings={onOpenSettings} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Últimos avisos' }));

    expect(await screen.findByText(/Aún no te ha llegado ningún aviso/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ajustes de avisos' }));
    expect(onOpenSettings).toHaveBeenCalled();
  });

  it('is hidden when the server has no push keys or the browser cannot receive them', async () => {
    vi.mocked(push.bellAction).mockReturnValue(null);
    const { unmount } = wrap(<NotificationBell onOpenSettings={onOpenSettings} />);
    await waitFor(() => expect(fetchPushConfig).toHaveBeenCalled());
    expect(screen.queryByRole('button')).toBeNull();
    unmount();

    vi.mocked(push.bellAction).mockReturnValue('enable');
    vi.mocked(fetchPushConfig).mockResolvedValue({
      publicKey: null,
      remindersEnabled: true,
      memberJoinedEnabled: true,
    });
    wrap(<NotificationBell onOpenSettings={onOpenSettings} />);
    await waitFor(() => expect(fetchPushConfig).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole('button')).toBeNull();
  });
});
