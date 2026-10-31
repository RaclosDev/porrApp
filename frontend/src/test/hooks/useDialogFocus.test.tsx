import { useRef, useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { useDialogFocus } from '../../hooks/useDialogFocus';

function Dialog({ onEscape }: { onEscape: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useDialogFocus(ref, { onEscape });
  return (
    <div role="dialog" aria-label="Prueba" ref={ref} tabIndex={-1}>
      <button type="button">Primero</button>
      <button type="button">Último</button>
    </div>
  );
}

function Harness({ onEscape = () => {} }: { onEscape?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Abrir
      </button>
      <button type="button" onClick={() => setOpen(false)}>
        Fuera
      </button>
      {open && (
        <Dialog
          onEscape={() => {
            onEscape();
            setOpen(false);
          }}
        />
      )}
    </>
  );
}

// jsdom no calcula layout: offsetParent siempre es null.
const original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetParent');
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'offsetParent', {
    configurable: true,
    get() {
      return this.parentNode;
    },
  });
});
afterAll(() => {
  if (original) Object.defineProperty(HTMLElement.prototype, 'offsetParent', original);
});

describe('useDialogFocus', () => {
  it('focuses the dialog, closes on Escape and returns focus to the opener', () => {
    const onEscape = vi.fn();
    render(<Harness onEscape={onEscape} />);
    const opener = screen.getByRole('button', { name: 'Abrir' });
    opener.focus();
    fireEvent.click(opener);

    expect(screen.getByRole('dialog')).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onEscape).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it('keeps Tab inside the dialog', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Abrir' }));
    const first = screen.getByRole('button', { name: 'Primero' });
    const last = screen.getByRole('button', { name: 'Último' });

    last.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(first).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(last).toHaveFocus();

    screen.getByRole('button', { name: 'Fuera' }).focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(first).toHaveFocus();
  });
});
