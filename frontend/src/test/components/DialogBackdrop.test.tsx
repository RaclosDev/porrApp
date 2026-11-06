import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import DialogBackdrop from '../../components/DialogBackdrop';

describe('DialogBackdrop', () => {
  it('closes on a click on the backdrop, not inside the panel', () => {
    const onDismiss = vi.fn();
    render(
      <DialogBackdrop className="overlay" onDismiss={onDismiss}>
        <div role="dialog" aria-label="Panel">
          <button type="button">Dentro</button>
        </div>
      </DialogBackdrop>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Dentro' }));
    fireEvent.click(screen.getByRole('dialog', { name: 'Panel' }));
    expect(onDismiss).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('presentation'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
