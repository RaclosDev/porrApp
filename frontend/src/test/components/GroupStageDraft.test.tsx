import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import GroupStage from '../../components/GroupStage';
import { readJsonDraft, readThirdsDraft, writeDraft } from '../../utils/drafts';

const selections = { A: { first: 'México', second: 'Sudáfrica', third: 'Chequia' } };
const props = {
  groupOdds: {},
  onComplete: vi.fn(),
  activeGroupId: '10',
  userId: '7',
  initialSelections: selections,
};

describe('borrador de terceros', () => {
  beforeEach(() => localStorage.clear());

  it('distingue un borrador ausente de uno vaciado', () => {
    expect(readThirdsDraft('10', '7')).toBeUndefined();
    writeDraft('advancing', '10', '7', []);
    expect(readThirdsDraft('10', '7')).toEqual([]);
  });

  it('persiste desmarcar el último tercero y conserva el vacío frente a props anteriores', async () => {
    const first = render(<GroupStage {...props} initialThirds={['Chequia']} />);
    fireEvent.click(screen.getByRole('button', { name: 'Chequia' }));
    await waitFor(() => expect(readJsonDraft('advancing', '10', '7')).toEqual([]));
    first.unmount();
    render(<GroupStage {...props} initialThirds={['Chequia']} />);
    expect(screen.getByRole('button', { name: 'Chequia' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('no crea un vacío al montar y acepta datos remotos tardíos si no se ha editado', async () => {
    const { rerender } = render(<GroupStage {...props} />);
    expect(readJsonDraft('advancing', '10', '7')).toBeUndefined();
    rerender(<GroupStage {...props} initialThirds={['Chequia']} />);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Chequia' })).toHaveAttribute(
        'aria-pressed',
        'true',
      ),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Chequia' }));
    rerender(<GroupStage {...props} initialThirds={['Chequia']} />);
    expect(screen.getByRole('button', { name: 'Chequia' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('no copia selecciones al cambiar de usuario o liga', () => {
    const { rerender } = render(<GroupStage {...props} initialThirds={['Chequia']} />);
    rerender(<GroupStage {...props} activeGroupId="20" userId="8" initialSelections={{}} />);
    expect(screen.queryByRole('button', { name: 'Chequia' })).not.toBeInTheDocument();
    expect(readJsonDraft('advancing', '20', '8')).toBeUndefined();
    expect(readJsonDraft('groups', '20', '8')).toBeUndefined();
  });

  it('al remontar usa las posiciones locales para no ocultar los terceros editados', () => {
    writeDraft('groups', '10', '7', { A: { first: 'México', second: '', third: 'Noruega' } });
    writeDraft('advancing', '10', '7', ['Noruega']);
    render(<GroupStage {...props} initialThirds={['Chequia']} />);
    expect(screen.getByRole('button', { name: 'Noruega' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('button', { name: 'Chequia' })).not.toBeInTheDocument();
    expect(readJsonDraft('groups', '10', '7')).toEqual({
      A: { first: 'México', second: '', third: 'Noruega' },
    });
  });

  it('persistir mover un tercero al primer puesto también elimina su clasificación como tercero', () => {
    const groupOdds = {
      A: ['México', 'Sudáfrica', 'Chequia'].map((name) => ({
        name,
        win: null,
        qualify: null,
        outright: null,
      })),
    };
    render(<GroupStage {...props} groupOdds={groupOdds} initialThirds={['Chequia']} />);
    fireEvent.click(screen.getByRole('combobox', { name: 'Grupo A, 1º clasificado' }));
    fireEvent.click(screen.getByRole('option', { name: /Chequia/ }));
    expect(screen.queryByRole('button', { name: 'Chequia' })).not.toBeInTheDocument();
    expect(readJsonDraft('advancing', '10', '7')).toEqual([]);
  });
});
