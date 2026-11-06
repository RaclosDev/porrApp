import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ConfirmDialog from '../../components/ConfirmDialog';
import { confirmAction } from '../../utils/confirmAction';

function ask() {
  let answer!: Promise<boolean>;
  act(() => {
    answer = confirmAction({
      title: '¿Eliminar «Amigos»?',
      message: 'No se puede deshacer.',
      confirmLabel: 'Eliminar liga',
    });
  });
  return answer;
}

describe('ConfirmDialog', () => {
  it('resuelve true al pulsar la acción y se cierra', async () => {
    render(<ConfirmDialog />);
    const answer = ask();

    const dialog = screen.getByRole('alertdialog', { name: '¿Eliminar «Amigos»?' });
    expect(dialog).toHaveAccessibleDescription('No se puede deshacer.');
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar liga' }));

    await expect(answer).resolves.toBe(true);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('resuelve false con Cancelar, con Escape y al pulsar fuera', async () => {
    render(<ConfirmDialog />);

    const cancelled = ask();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    await expect(cancelled).resolves.toBe(false);

    const escaped = ask();
    fireEvent.keyDown(document, { key: 'Escape' });
    await expect(escaped).resolves.toBe(false);

    const outside = ask();
    fireEvent.click(screen.getByRole('alertdialog').parentElement!);
    await expect(outside).resolves.toBe(false);
  });
});
