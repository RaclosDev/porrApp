import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import SheetDialog from '../../components/SheetDialog';

function swipe(element: HTMLElement, fromY: number, toY: number) {
  fireEvent.touchStart(element, { touches: [{ clientY: fromY }] });
  fireEvent.touchMove(element, { touches: [{ clientY: (fromY + toY) / 2 }] });
  fireEvent.touchMove(element, { touches: [{ clientY: toY }] });
  fireEvent.touchEnd(element, { changedTouches: [{ clientY: toY }] });
}

function renderSheet(onClose = vi.fn()) {
  render(
    <SheetDialog title="Participantes" subtitle="Tebas League" onClose={onClose}>
      <div className="sheet-dialog-body">
        <p>Lista</p>
      </div>
    </SheetDialog>,
  );
  return { onClose, dialog: screen.getByRole('dialog', { name: 'Participantes' }) };
}

describe('SheetDialog', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('muestra título y subtítulo y se cierra con la X', () => {
    const { onClose, dialog } = renderSheet();

    expect(dialog).toHaveTextContent('Tebas League');
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('se cierra al deslizarla hacia abajo', () => {
    vi.useFakeTimers();
    const { onClose, dialog } = renderSheet();

    swipe(dialog, 100, 400);
    expect(dialog.style.transform).toMatch(/translateY/);
    act(() => {
      vi.runAllTimers();
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('vuelve a su sitio si el gesto es corto', () => {
    vi.useFakeTimers();
    const { onClose, dialog } = renderSheet();

    swipe(dialog, 100, 120);
    act(() => {
      vi.runAllTimers();
    });

    expect(onClose).not.toHaveBeenCalled();
    expect(dialog.style.transform).toBe('');
  });

  it('no se mueve al arrastrar hacia arriba', () => {
    const { onClose, dialog } = renderSheet();

    swipe(dialog, 400, 100);

    expect(onClose).not.toHaveBeenCalled();
    expect(dialog.style.transform).toBe('');
  });
});
