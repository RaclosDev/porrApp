import { useRef, useState, useEffect } from 'react';
import { prepareImageForUpload, validateImageFile } from '../utils/image';

/**
 * Selector de imagen con archivo real (galería del móvil o explorador de Windows), vista previa,
 * sustitución y eliminación. La subida solo ocurre al pulsar "Guardar".
 *
 * Props:
 *  - currentUrl: imagen guardada actualmente (o null)
 *  - renderPreview(url): dibuja la vista previa (avatar de usuario o de liga)
 *  - onUpload(blob): sube la imagen; debe lanzar un Error con mensaje si falla
 *  - onRemove(): elimina la imagen guardada
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
  const [pending, setPending] = useState(null); // { blob, url }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    return () => {
      if (pending?.url) URL.revokeObjectURL(pending.url);
    };
  }, [pending]);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // permite volver a elegir el mismo archivo
    if (!file) return;
    setError('');
    const problem = validateImageFile(file);
    if (problem) {
      setError(problem);
      return;
    }
    try {
      const blob = await prepareImageForUpload(file);
      setPending({ blob, url: URL.createObjectURL(blob) });
    } catch (err) {
      setError(err.message || 'No se pudo leer la imagen.');
    }
  };

  const save = async () => {
    if (!pending) return;
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
      <div data-testid={`${idPrefix}-preview`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>{renderPreview(shownUrl)}{pending && <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#00d2d3', textAlign: 'center' }}>Vista previa</span>}</div>

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
                disabled={busy}
                style={{
                  ...btn,
                  background: 'rgba(0, 210, 211, 0.15)',
                  border: '1px solid rgba(0, 210, 211, 0.45)',
                  color: '#00d2d3',
                }}
              >
                {busy ? 'Subiendo…' : 'Guardar imagen'}
              </button>
              <button
                type="button"
                className="glass-btn"
                onClick={() => {
                  setPending(null);
                  setError('');
                }}
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
