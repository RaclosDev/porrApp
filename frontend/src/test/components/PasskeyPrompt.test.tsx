import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import toast from 'react-hot-toast';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import PasskeyPrompt from '../../components/layout/PasskeyPrompt';
import { addPasskeyOnThisDevice, passkeyPromptAnswered } from '../../utils/passkeyPrompt';

vi.mock('../../utils/passkeyPrompt', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../utils/passkeyPrompt')>()),
  addPasskeyOnThisDevice: vi.fn(),
}));

vi.mock('react-hot-toast', () => {
  const toastFn = Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() });
  return { default: toastFn };
});

const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)';
const onDone = vi.fn();

beforeEach(() => {
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(IPHONE_UA);
  localStorage.clear();
});

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

it('offers Face ID on an iPhone and adds the key', async () => {
  vi.mocked(addPasskeyOnThisDevice).mockResolvedValue({
    id: 1,
    name: 'iPhone',
    createdAt: '2026-11-06T18:00:00Z',
    lastUsedAt: null,
  });
  render(<PasskeyPrompt userId="7" onDone={onDone} />);

  expect(screen.getByText(/Entrar la próxima vez con Face ID/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Activar' }));

  await waitFor(() => expect(onDone).toHaveBeenCalled());
  expect(toast.success).toHaveBeenCalledWith('Listo: la próxima vez entra con Face ID.');
  expect(passkeyPromptAnswered('7')).toBe(true);
});

it('«Más tarde» does not ask again and points to the profile', () => {
  render(<PasskeyPrompt userId="7" onDone={onDone} />);

  fireEvent.click(screen.getByRole('button', { name: 'Más tarde' }));

  expect(onDone).toHaveBeenCalled();
  expect(passkeyPromptAnswered('7')).toBe(true);
  expect(toast).toHaveBeenCalledWith(expect.stringContaining('desde tu perfil'));
});

it('keeps asking if the system dialog is cancelled', async () => {
  vi.mocked(addPasskeyOnThisDevice).mockRejectedValue(
    new DOMException('cancelado', 'NotAllowedError'),
  );
  render(<PasskeyPrompt userId="7" onDone={onDone} />);

  fireEvent.click(screen.getByRole('button', { name: 'Activar' }));

  await waitFor(() => expect(screen.getByRole('button', { name: 'Activar' })).toBeEnabled());
  expect(onDone).not.toHaveBeenCalled();
  expect(passkeyPromptAnswered('7')).toBe(false);
  expect(toast.error).not.toHaveBeenCalled();
});

it('stops asking when this device already had a key', async () => {
  vi.mocked(addPasskeyOnThisDevice).mockRejectedValue(
    new DOMException('ya existe', 'InvalidStateError'),
  );
  render(<PasskeyPrompt userId="7" onDone={onDone} />);

  fireEvent.click(screen.getByRole('button', { name: 'Activar' }));

  await waitFor(() => expect(onDone).toHaveBeenCalled());
  expect(passkeyPromptAnswered('7')).toBe(true);
});
