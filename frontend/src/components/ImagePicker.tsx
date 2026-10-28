import { useRef, useState, useEffect } from 'react';
import { prepareImageForUpload, validateImageFile } from '../utils/image';

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
}) {
  const inputRef = useRef(null);
  const selectionId = useRef(0);
  const [pending, setPending] = useState(null); // { blob, url, processing }
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

  const handleFile = async (e) => {
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
      setError(err.message || 'No se pudo leer la imagen.');
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
      setError(err.message || 'No se pudo subir la imagen.');
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
      setError(err.message || 'No se pudo eliminar la imagen.');
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
    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
      <div
        data-testid={`${idPrefix}-preview`}
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}
      >
        {renderPreview(shownUrl)}
        {pending && (
          <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#00d2d3', textAlign: 'center' }}>
            Vista previa
          </span>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: 0 }}>
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept="image/*"
          onChange={handleFile}
          disabled={disabled || busy}
          style={{ display: 'none' }}
        />
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
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
        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
          JPG, PNG o WebP. Se recorta en cuadrado y se reduce automáticamente.
        </span>
        {error && (
          <span role="alert" style={{ fontSize: '0.78rem', color: '#ff6b7a' }}>
            {error}
          </span>
        )}
      </div>
    </div>
  );
}
