import { useRef, useState, useEffect, type ChangeEvent, type ReactNode } from 'react';
import { prepareImageForUpload, validateImageFile } from '../utils/image';
import { errorMessage } from '../utils/errors';

interface ImagePickerProps {
  currentUrl: string | null | undefined;
  renderPreview: (url: string | null | undefined) => ReactNode;
  onUpload: (blob: Blob) => Promise<unknown>;
  onRemove: () => Promise<unknown>;
  disabled?: boolean;
  idPrefix?: string;
}

/** Imagen elegida y aún sin subir; `blob` llega cuando termina el recorte. */
interface PendingImage {
  blob: Blob | null;
  url: string;
  processing: boolean;
}

/**
 * Selector de imagen con vista previa local inmediata.
 * La selección y la previsualización son locales; la subida solo ocurre al guardar.
 */
export default function ImagePicker({
  currentUrl,
  renderPreview,
  onUpload,
  onRemove,
  disabled = false,
  idPrefix = 'image-picker',
}: ImagePickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const selectionId = useRef(0);
  const [pending, setPending] = useState<PendingImage | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // La URL solo se revoca cuando cambia la selección, se descarta o se desmonta.
  // No depender del objeto pending completo: actualizar el blob tras procesar
  // la imagen no debe invalidar la URL que está usando el <img>.
  useEffect(() => {
    const url = pending?.url;
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [pending?.url]);

  const handleFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // permite volver a elegir el mismo archivo
    if (!file) return;

    const currentSelection = ++selectionId.current;
    setError('');
    const problem = validateImageFile(file);
    if (problem) {
      setPending(null);
      setError(problem);
      return;
    }

    // Mostrar el archivo original inmediatamente, sin esperar al recorte/compresión.
    const previewUrl = URL.createObjectURL(file);
    setPending({ blob: null, url: previewUrl, processing: true });

    try {
      const blob = await prepareImageForUpload(file);
      // Si se ha elegido otra imagen mientras se procesaba esta, ignorar el resultado antiguo.
      if (selectionId.current !== currentSelection) return;
      setPending((previous) =>
        previous?.url === previewUrl ? { ...previous, blob, processing: false } : previous,
      );
    } catch (err) {
      if (selectionId.current !== currentSelection) return;
      setPending((previous) => (previous?.url === previewUrl ? null : previous));
      setError(errorMessage(err, 'No se pudo leer la imagen.'));
    }
  };

  const save = async () => {
    if (!pending?.blob || pending.processing || busy) return;
    setBusy(true);
    setError('');
    try {
      await onUpload(pending.blob);
      setPending(null);
    } catch (err) {
      setError(errorMessage(err, 'No se pudo subir la imagen.'));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    setError('');
    try {
      await onRemove();
      setPending(null);
    } catch (err) {
      setError(errorMessage(err, 'No se pudo eliminar la imagen.'));
    } finally {
      setBusy(false);
    }
  };

  const discard = () => {
    selectionId.current += 1;
    setPending(null);
    setError('');
  };

  const shownUrl = pending ? pending.url : currentUrl;
  const inputId = `${idPrefix}-input`;
  const btn = {
    padding: '6px 12px',
    fontSize: '0.8rem',
    fontWeight: 700,
    borderRadius: '8px',
    cursor: disabled || busy ? 'not-allowed' : 'pointer',
  };

  return (
    <div className="flex items-center gap-3.5 flex-wrap">
      <div className="flex flex-col items-center gap-1.5" data-testid={`${idPrefix}-preview`}>
        {renderPreview(shownUrl)}
        {pending && (
          <span className="text-[0.68rem] font-bold text-[#00d2d3] text-center">Vista previa</span>
        )}
      </div>

      <div className="flex flex-col gap-2 min-w-0">
        <input
          className="hidden"
          ref={inputRef}
          id={inputId}
          type="file"
          accept="image/*"
          onChange={handleFile}
          disabled={disabled || busy}
        />
        <div className="flex gap-2 flex-wrap">
          <button
            type="button"
            className="glass-btn"
            onClick={() => inputRef.current?.click()}
            disabled={disabled || busy}
            style={btn}
          >
            {currentUrl || pending ? 'Cambiar imagen' : 'Elegir imagen'}
          </button>
          {pending && (
            <>
              <button
                type="button"
                className="glass-btn"
                onClick={save}
                disabled={disabled || busy || pending.processing || !pending.blob}
                style={{
                  ...btn,
                  background: 'rgba(0, 210, 211, 0.15)',
                  border: '1px solid rgba(0, 210, 211, 0.45)',
                  color: '#00d2d3',
                }}
              >
                {busy ? 'Subiendo…' : pending.processing ? 'Preparando imagen…' : 'Guardar imagen'}
              </button>
              <button
                type="button"
                className="glass-btn"
                onClick={discard}
                disabled={busy}
                style={btn}
              >
                Descartar
              </button>
            </>
          )}
          {!pending && currentUrl && (
            <button
              type="button"
              className="glass-btn"
              onClick={remove}
              disabled={disabled || busy}
              style={{ ...btn, color: '#ff6b7a', border: '1px solid rgba(255, 71, 87, 0.4)' }}
            >
              Quitar
            </button>
          )}
        </div>
        <span className="text-[0.72rem] text-muted">
          JPG, PNG o WebP. Se recorta en cuadrado y se reduce automáticamente.
        </span>
        {error && (
          <span className="text-[0.78rem] text-[#ff6b7a]" role="alert">
            {error}
          </span>
        )}
      </div>
    </div>
  );
}
