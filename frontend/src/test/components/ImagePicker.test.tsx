import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ImagePicker from '../../components/ImagePicker';

const prepare = vi.fn();
vi.mock('../../utils/image', async () => {
  const actual = await vi.importActual('../../utils/image');
  return { ...actual, prepareImageForUpload: (...a) => prepare(...a) };
});

const pngFile = () => new File([new Uint8Array([1, 2, 3])], 'foto.png', { type: 'image/png' });

describe('ImagePicker', () => {
  beforeEach(() => {
    prepare.mockReset();
    URL.createObjectURL = vi.fn(() => 'blob:preview');
    URL.revokeObjectURL = vi.fn();
  });

  const setup = (props = {}) => {
    const onUpload = vi.fn().mockResolvedValue(undefined);
    const onRemove = vi.fn().mockResolvedValue(undefined);
    const utils = render(
      <ImagePicker
        currentUrl={null}
        renderPreview={(url) => <div data-testid="shown">{url || 'sin-imagen'}</div>}
        onUpload={onUpload}
        onRemove={onRemove}
        {...props}
      />,
    );
    return { onUpload, onRemove, ...utils };
  };

  it('usa un input de archivo real que acepta imágenes (galería del móvil y explorador)', () => {
    const { container } = setup();
    const input = container.querySelector('input[type="file"]');
    expect(input).toHaveAttribute('accept', 'image/*');
  });

  it('muestra la foto inmediatamente mientras se prepara y solo sube al guardar', async () => {
    let finishPreparation: (blob: Blob) => void = () => {};
    const blob = new Blob(['x'], { type: 'image/jpeg' });
    prepare.mockImplementation(
      () =>
        new Promise((resolve) => {
          finishPreparation = resolve;
        }),
    );
    const { container, onUpload } = setup();

    fireEvent.change(container.querySelector('input[type="file"]'), {
      target: { files: [pngFile()] },
    });

    // La vista previa no debe esperar al recorte/compresión asíncronos.
    expect(screen.getByTestId('shown')).toHaveTextContent('blob:preview');
    expect(screen.getByRole('button', { name: /Preparando imagen/i })).toBeDisabled();
    expect(onUpload).not.toHaveBeenCalled();

    finishPreparation(blob);
    fireEvent.click(await screen.findByRole('button', { name: /Guardar imagen/i }));
    await waitFor(() => expect(onUpload).toHaveBeenCalledWith(blob));
  });

  it('rechaza archivos que no son imagen sin llamar a la subida', async () => {
    const { container, onUpload } = setup();
    const txt = new File(['hola'], 'nota.txt', { type: 'text/plain' });
    fireEvent.change(container.querySelector('input[type="file"]'), { target: { files: [txt] } });
    expect(await screen.findByRole('alert')).toHaveTextContent(/JPG, PNG o WebP/);
    expect(prepare).not.toHaveBeenCalled();
    expect(onUpload).not.toHaveBeenCalled();
  });

  it('muestra el error del servidor y conserva la vista previa para reintentar', async () => {
    prepare.mockResolvedValue(new Blob(['x']));
    const { container, onUpload } = setup();
    onUpload.mockRejectedValueOnce(
      new Error('Solo el administrador de la liga puede cambiar su imagen.'),
    );
    fireEvent.change(container.querySelector('input[type="file"]'), {
      target: { files: [pngFile()] },
    });
    fireEvent.click(await screen.findByRole('button', { name: /Guardar imagen/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/administrador/);
    expect(screen.getByRole('button', { name: /Guardar imagen/i })).toBeInTheDocument();
  });

  it('permite sustituir y quitar una imagen existente', async () => {
    const { onRemove } = setup({ currentUrl: '/api/groups/1/image?v=1' });
    expect(screen.getByTestId('shown')).toHaveTextContent('/api/groups/1/image?v=1');
    expect(screen.getByRole('button', { name: /Cambiar imagen/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Quitar/i }));
    await waitFor(() => expect(onRemove).toHaveBeenCalled());
  });
});
