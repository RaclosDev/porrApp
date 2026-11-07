import {
  FIELD_IDS,
  POOL_FORMAT_ORDER,
  errorId,
  formatCopy,
  formatUnavailableReason,
} from './leagueDraft';
import { FieldError, OptionCard } from './parts';
import type { StepProps } from './useLeagueDraft';

/** Paso 2: el modo de juego. Los que no encajan con la competición se ven, con el motivo. */
export default function FormatStep({ draft, update, errors, ctx }: StepProps) {
  return (
    <>
      <fieldset
        id={FIELD_IDS.poolFormat}
        className="create-league-fieldset"
        aria-describedby={errors.poolFormat ? errorId(FIELD_IDS.poolFormat) : undefined}
      >
        <legend className="sr-only">Modo de juego</legend>
        <div className="create-league-options">
          {POOL_FORMAT_ORDER.map((format) => (
            <OptionCard
              key={format}
              name="cl-format"
              value={format}
              checked={draft.poolFormat === format}
              onChange={() => update({ poolFormat: format })}
              title={formatCopy(format, draft, ctx).title}
              description={formatCopy(format, draft, ctx).text}
              disabledReason={formatUnavailableReason(format, draft, ctx)}
            />
          ))}
        </div>
        <FieldError fieldId={FIELD_IDS.poolFormat} message={errors.poolFormat} />
      </fieldset>
      {draft.custom && draft.poolFormat && (
        <p className="create-league-note">
          {draft.poolFormat === 'MATCH_DAY'
            ? 'Después de crear la liga añades los partidos de tu competición.'
            : 'Después de crear la liga añades los equipos y los cruces de tu competición.'}
        </p>
      )}
    </>
  );
}
