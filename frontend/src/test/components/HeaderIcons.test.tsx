import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
  PREDICTION_SAVED_EVENT: 'prediction-saved',
  fetchPushConfig: vi.fn(),
  fetchRecentPushNotifications: vi.fn(),
  setPushPreferences: vi.fn(() => Promise.resolve()),
}));
vi.mock('../../services/push', () => ({
  bellAction: vi.fn(),
  enablePush: vi.fn(),
  isIos: vi.fn(() => true),
}));
vi.mock('../../services/installPrompt', () => ({
  installState: vi.fn(),
  promptInstall: vi.fn(() => Promise.resolve('accepted')),
  shareButtonPlace: vi.fn(() => 'bottom'),
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

const GUIDE = 'Añade porrApp a tu pantalla de inicio';

describe('InstallAppButton', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(install.shareButtonPlace).mockReturnValue('bottom');
  });

  it('opens the browser install dialog with a single tap', () => {
    vi.mocked(install.installState).mockReturnValue('native');
    wrap(<InstallAppButton />);

    fireEvent.click(screen.getByRole('button', { name: 'Instalar porrApp' }));

    expect(install.promptInstall).toHaveBeenCalledTimes(1);
  });

  it('on iPhone, points at Share and then Add to Home Screen', () => {
    vi.mocked(install.installState).mockReturnValue('ios');
    wrap(<InstallAppButton />);

    fireEvent.click(screen.getByRole('button', { name: 'Instalar porrApp' }));

    const dialog = screen.getByRole('dialog', { name: GUIDE });
    expect(dialog).toHaveTextContent('Toca Compartir en la barra de abajo.');
    expect(dialog).toHaveTextContent('Elige Añadir a pantalla de inicio y toca Añadir.');
    expect(screen.getByTestId('install-guide-arrow')).toHaveClass('self-center');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Entendido' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it.each([
    ['bottom-menu', 'abajo a la derecha y luego Compartir', 'self-end'],
    ['top-right', 'Compartir arriba a la derecha', 'self-end'],
  ] as const)('adapts the first step and the arrow to %s', (place, text, arrowClass) => {
    vi.mocked(install.installState).mockReturnValue('ios');
    vi.mocked(install.shareButtonPlace).mockReturnValue(place);
    wrap(<InstallAppButton />);

    fireEvent.click(screen.getByRole('button', { name: 'Instalar porrApp' }));

    expect(screen.getByRole('dialog', { name: GUIDE })).toHaveTextContent(text);
    expect(screen.getByTestId('install-guide-arrow')).toHaveClass(arrowClass);
  });

  it('inside another app’s browser, asks to open Safari and copies the link', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    vi.mocked(install.installState).mockReturnValue('in-app');
    wrap(<InstallAppButton />);

    fireEvent.click(screen.getByRole('button', { name: 'Instalar porrApp' }));
    const dialog = screen.getByRole('dialog', { name: 'Ábrela en Safari' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Copiar enlace' }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(window.location.href));
  });

  it('offers the guide by itself after saving a prediction, then not again for a while', () => {
    vi.mocked(install.installState).mockReturnValue('ios');
    wrap(<InstallAppButton />);
    expect(screen.queryByRole('dialog')).toBeNull();

    act(() => {
      window.dispatchEvent(new Event('prediction-saved'));
    });
    fireEvent.click(screen.getByRole('button', { name: 'Entendido' }));

    act(() => {
      window.dispatchEvent(new Event('prediction-saved'));
    });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('does not interrupt after saving where the browser has its own install dialog', () => {
    vi.mocked(install.installState).mockReturnValue('native');
    wrap(<InstallAppButton />);

    act(() => {
      window.dispatchEvent(new Event('prediction-saved'));
    });

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
    vi.mocked(install.installState).mockReturnValue('ios');
    wrap(<NotificationBell onOpenSettings={onOpenSettings} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Activar avisos' }));

    expect(screen.getByRole('dialog', { name: GUIDE })).toHaveTextContent(
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
