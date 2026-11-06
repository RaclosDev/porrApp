import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import PasskeySettings from '../../components/PasskeySettings';
import {
  deletePasskey,
  fetchPasskeys,
  finishPasskeyRegistration,
  startPasskeyRegistration,
} from '../../services/api';
import { createPasskey, passkeysSupported } from '../../utils/webauthn';

vi.mock('../../services/api', () => ({
  fetchPasskeys: vi.fn(),
  startPasskeyRegistration: vi.fn(),
  finishPasskeyRegistration: vi.fn(),
  deletePasskey: vi.fn(),
}));

vi.mock('../../utils/webauthn', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../utils/webauthn')>()),
  passkeysSupported: vi.fn(() => true),
  createPasskey: vi.fn(),
  deviceName: () => 'iPhone',
}));

const IPHONE = { id: 1, name: 'iPhone', createdAt: '2026-11-01T10:00:00Z', lastUsedAt: null };

const renderSettings = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <PasskeySettings />
    </QueryClientProvider>,
  );

beforeEach(() => {
  vi.mocked(passkeysSupported).mockReturnValue(true);
  vi.mocked(fetchPasskeys).mockResolvedValue([]);
});

afterEach(() => {
  vi.clearAllMocks();
});

it('hides itself where the browser has no passkeys', () => {
  vi.mocked(passkeysSupported).mockReturnValue(false);
  const { container } = renderSettings();

  expect(container).toBeEmptyDOMElement();
  expect(fetchPasskeys).not.toHaveBeenCalled();
});

it('adds a key on this device, named after it', async () => {
  vi.mocked(startPasskeyRegistration).mockResolvedValue({
    requestId: 'req-1',
    options: { publicKey: { challenge: 'AA' } },
  });
  vi.mocked(createPasskey).mockResolvedValue({ id: 'abc' });
  vi.mocked(finishPasskeyRegistration).mockResolvedValue(IPHONE);
  renderSettings();

  fireEvent.click(await screen.findByRole('button', { name: 'Añadir llave en este dispositivo' }));

  expect(await screen.findByText('iPhone')).toBeInTheDocument();
  expect(finishPasskeyRegistration).toHaveBeenCalledWith('req-1', { id: 'abc' }, 'iPhone');
});

it('says nothing when the system dialog is cancelled', async () => {
  vi.mocked(startPasskeyRegistration).mockResolvedValue({
    requestId: 'req-1',
    options: { publicKey: {} },
  });
  vi.mocked(createPasskey).mockRejectedValue(new DOMException('cancelado', 'NotAllowedError'));
  renderSettings();

  fireEvent.click(await screen.findByRole('button', { name: 'Añadir llave en este dispositivo' }));

  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Añadir llave en este dispositivo' })).toBeEnabled(),
  );
  expect(finishPasskeyRegistration).not.toHaveBeenCalled();
});

it('lists the keys and deletes one', async () => {
  vi.mocked(fetchPasskeys).mockResolvedValue([IPHONE]);
  vi.mocked(deletePasskey).mockResolvedValue([]);
  renderSettings();

  fireEvent.click(await screen.findByRole('button', { name: 'Borrar la llave iPhone' }));

  await waitFor(() => expect(screen.queryByText('iPhone')).toBeNull());
  expect(deletePasskey).toHaveBeenCalledWith(1);
});
