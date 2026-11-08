import type { ReactNode } from 'react';
import { errorId } from './leagueDraft';

/** Mensaje de error de un campo; el campo lo enlaza con `aria-describedby={errorId(id)}`. */
export function FieldError({ fieldId, message }: { fieldId: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={errorId(fieldId)} className="create-league-error">
      {message}
    </p>
  );
}

/**
 * Opción de una lista de radios con aspecto de ficha. El radio es nativo: las flechas recorren el
 * grupo y el lector anuncia el título como nombre y el texto como descripción.
 */
export function OptionCard({
  name,
  value,
  checked,
  onChange,
  title,
  description,
  disabledReason,
}: {
  name: string;
  value: string;
  checked: boolean;
  onChange: () => void;
  title: ReactNode;
  description?: ReactNode;
  /** Por qué no se puede elegir; sin él, se puede. */
  disabledReason?: string | null;
}) {
  const id = `${name}-${value}`;
  const described = [description && `${id}-text`, disabledReason && `${id}-reason`]
    .filter(Boolean)
    .join(' ');
  return (
    <label
      htmlFor={id}
      className={`create-league-option${disabledReason ? ' is-disabled' : ''}${checked ? ' is-checked' : ''}${described ? '' : ' is-compact'}`}
    >
      <input
        type="radio"
        id={id}
        name={name}
        value={value}
        checked={checked}
        disabled={Boolean(disabledReason)}
        onChange={onChange}
        aria-labelledby={`${id}-title`}
        aria-describedby={described || undefined}
      />
      <span className="create-league-option-body">
        <span id={`${id}-title`} className="create-league-option-title">
          {title}
        </span>
        {description && (
          <span id={`${id}-text`} className="create-league-option-text">
            {description}
          </span>
        )}
        {disabledReason && (
          <span id={`${id}-reason`} className="create-league-option-reason">
            {disabledReason}
          </span>
        )}
      </span>
    </label>
  );
}

/** Bloque con título dentro de un paso. */
export function StepSection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="create-league-section" aria-labelledby={`${id}-title`}>
      <h3 id={`${id}-title`} className="create-league-section-title">
        {title}
      </h3>
      {children}
    </section>
  );
}
