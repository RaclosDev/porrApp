import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { usePaperTapeAngles } from '../../hooks/usePaperTapeAngles';

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

it('keeps random tape angles bounded and stable as content updates', async () => {
  vi.spyOn(Math, 'random').mockReturnValueOnce(0).mockReturnValueOnce(0.999);
  const sheet = document.createElement('div');
  sheet.className = 'landing-tape';
  document.body.append(sheet);
  const { unmount } = renderHook(() => usePaperTapeAngles());
  expect(sheet.style.getPropertyValue('--tape-angle')).toBe('-6.00deg');

  const card = document.createElement('div');
  card.className = 'group-card album-sheet';
  act(() => document.body.append(card));
  await waitFor(() => expect(card.style.getPropertyValue('--tape-angle')).toBe('5.99deg'));
  act(() => {
    sheet.textContent = 'Updated';
  });
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(sheet.style.getPropertyValue('--tape-angle')).toBe('-6.00deg');
  unmount();
  const later = document.createElement('div');
  later.className = 'landing-tape';
  document.body.append(later);
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(later.style.getPropertyValue('--tape-angle')).toBe('');
});
