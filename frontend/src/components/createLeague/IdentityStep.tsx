import { useRef, useState, type ChangeEvent } from 'react';
import { LeagueAvatar } from '../Avatar';
import { prepareImageForUpload, validateImageFile } from '../../utils/image';
import { errorMessage } from '../../utils/errors';
import { FIELD_IDS, NAME_MAX, RULES_MAX, errorId } from './leagueDraft';
import { FieldError, StepSection } from './parts';
import type { StepProps } from './useLeagueDraft';

const blobToDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('No se pudo leer la imagen.'));
    reader.readAsDataURL(blob);
  });

/** Imagen de la liga: se recorta y se guarda en el borrador; se sube al crear la liga. */
function LeagueImageField({ draft, update }: Pick<StepProps, 'draft' | 'update'>) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const problem = validateImageFile(file);
    if (problem) {
      setError(problem);
      return;
    }
    setError('');
    setBusy(true);
    try {
      update({ image: await blobToDataUrl(await prepareImageForUpload(file)) });
    } catch (reason) {
      setError(errorMessage(reason, 'No se pudo leer la imagen.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="create-league-image">
      <LeagueAvatar url={draft.image} name={draft.name} size={72} />
      <div className="create-league-image-actions">
        <input
          ref={inputRef}
          id="cl-image"
          className="sr-only"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFile}
          tabIndex={-1}
          aria-hidden="true"
        />
        <div className="create-league-inline">
          <button
            type="button"
            className="glass-btn create-league-small-btn"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            aria-describedby="cl-image-hint"
          >
            {busy ? 'Preparando imagen…' : draft.image ? 'Cambiar imagen' : 'Elegir imagen'}
          </button>
          {draft.image && !busy && (
            <button
              type="button"
              className="glass-btn create-league-small-btn"
              onClick={() => update({ image: null })}
            >
              Quitar
            </button>
          )}
        </div>
        <p id="cl-image-hint" className="create-league-hint">
          Opcional. JPG, PNG o WebP; se recorta en cuadrado. Sin imagen, la liga lleva su inicial.
        </p>
        {error && (
          <p className="create-league-error" role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

/** Paso 4: cómo se llama la liga, su imagen y sus normas. */
export default function IdentityStep({ draft, update, errors }: StepProps) {
  return (
    <>
      <div className="create-league-field">
        <label htmlFor={FIELD_IDS.name}>Nombre de la liga</label>
        <input
          id={FIELD_IDS.name}
          className="glass-input"
          value={draft.name}
          maxLength={NAME_MAX}
          autoComplete="off"
          placeholder="Ej.: Amigos del barrio, Porra de la oficina"
          onChange={(event) => update({ name: event.target.value })}
          aria-invalid={Boolean(errors.name)}
          aria-describedby={['cl-name-count', errors.name ? errorId(FIELD_IDS.name) : '']
            .filter(Boolean)
            .join(' ')}
        />
        <p id="cl-name-count" className="create-league-hint">
          {draft.name.length}/{NAME_MAX} caracteres
        </p>
        <FieldError fieldId={FIELD_IDS.name} message={errors.name} />
      </div>

      <StepSection id="cl-image-section" title="Imagen">
        <LeagueImageField draft={draft} update={update} />
      </StepSection>

      <StepSection id="cl-rules-section" title="Normas de la liga">
        <div className="create-league-field">
          <label htmlFor={FIELD_IDS.rules} className="create-league-hint">
            Opcional. Plazos, desempates o premios; las ven todos los participantes.
            {draft.entryFee && ' Apunta aquí cuánto es la cuota y cómo se paga.'}
          </label>
          <textarea
            id={FIELD_IDS.rules}
            className="glass-input create-league-textarea"
            value={draft.rules}
            maxLength={RULES_MAX}
            rows={5}
            placeholder="Ej.: Cuota de 10 € por Bizum a Ana antes del primer partido. Premios: 60 % al primero, 30 % al segundo y 10 % al tercero."
            onChange={(event) => update({ rules: event.target.value })}
            aria-invalid={Boolean(errors.rules)}
            aria-describedby={errors.rules ? errorId(FIELD_IDS.rules) : undefined}
          />
          <p className="create-league-hint">
            {draft.rules.length}/{RULES_MAX} caracteres
          </p>
          <FieldError fieldId={FIELD_IDS.rules} message={errors.rules} />
        </div>
      </StepSection>
    </>
  );
}
