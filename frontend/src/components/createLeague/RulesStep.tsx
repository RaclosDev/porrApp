import { RotateCcw } from 'lucide-react';
import ScoringRulesPanel from '../league/ScoringRulesPanel';
import type { LeagueScoring } from '../../types/api';
import { DEFAULT_SCORING_RULES, SCORING_MAX_POINTS, toDraft } from '../../utils/scoringRules';
import type { LockUnit } from '../groups/custom/lockModes';
import { FIELD_IDS, errorId, lockModesFor, pichichiApplies, scoringEditable } from './leagueDraft';
import { FieldError, OptionCard, StepSection } from './parts';
import type { StepProps } from './useLeagueDraft';

/** `YYYY-MM-DDTHH:mm` de ahora en la hora del dispositivo, para el mínimo del selector de fecha. */
const nowLocal = () => {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 16);
};

function LockSection({ draft, update, errors, ctx }: StepProps) {
  const modes = lockModesFor(draft, ctx);
  if (modes.length === 0) return null;
  return (
    <>
      <fieldset className="create-league-fieldset">
        <legend className="sr-only">Cuándo se cierran las predicciones</legend>
        <div className="create-league-options">
          {modes.map((item) => (
            <OptionCard
              key={item.value}
              name="cl-lock-mode"
              value={item.value}
              checked={draft.lockMode === item.value}
              onChange={() => update({ lockMode: item.value })}
              title={item.label}
              description={item.hint}
            />
          ))}
        </div>
      </fieldset>
      {draft.lockMode === 'FIXED_DATE' ? (
        <div className="create-league-field">
          <label htmlFor={FIELD_IDS.lockDate}>Fecha y hora de cierre</label>
          <input
            id={FIELD_IDS.lockDate}
            className="glass-input"
            type="datetime-local"
            min={nowLocal()}
            value={draft.lockDate}
            onChange={(event) => update({ lockDate: event.target.value })}
            aria-invalid={Boolean(errors.lockDate)}
            aria-describedby={errors.lockDate ? errorId(FIELD_IDS.lockDate) : undefined}
          />
          <FieldError fieldId={FIELD_IDS.lockDate} message={errors.lockDate} />
        </div>
      ) : (
        <div className="create-league-field">
          <label htmlFor={FIELD_IDS.lockAmount}>
            {draft.lockMode === 'PER_MATCH'
              ? 'Margen antes del partido'
              : 'Margen antes del primer partido'}
          </label>
          <div className="create-league-inline">
            <input
              id={FIELD_IDS.lockAmount}
              className="glass-input create-league-amount"
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              value={draft.lockAmount}
              onChange={(event) => update({ lockAmount: event.target.value })}
              aria-invalid={Boolean(errors.lockAmount)}
              aria-describedby={[
                'cl-lock-amount-hint',
                errors.lockAmount ? errorId(FIELD_IDS.lockAmount) : '',
              ]
                .filter(Boolean)
                .join(' ')}
            />
            <select
              className="glass-input"
              aria-label="Unidad del margen"
              value={draft.lockUnit}
              onChange={(event) => update({ lockUnit: event.target.value as LockUnit })}
            >
              <option value="minutes">minutos</option>
              <option value="hours">horas</option>
              <option value="days">días</option>
            </select>
          </div>
          <p id="cl-lock-amount-hint" className="create-league-hint">
            0 es justo cuando empieza. Máximo 30 días.
          </p>
          <FieldError fieldId={FIELD_IDS.lockAmount} message={errors.lockAmount} />
        </div>
      )}
    </>
  );
}

function ScoringSection({ draft, update, errors, ctx }: StepProps) {
  if (!scoringEditable(draft)) return null;
  const scoring: LeagueScoring = {
    poolFormat: draft.poolFormat,
    pichichi: draft.pichichi,
    editable: draft.customScoring,
    maxPoints: SCORING_MAX_POINTS,
    rules: DEFAULT_SCORING_RULES,
    defaults: DEFAULT_SCORING_RULES,
  };
  return (
    <div
      id={FIELD_IDS.scoring}
      aria-describedby={errors.scoring ? errorId(FIELD_IDS.scoring) : undefined}
    >
      {pichichiApplies(draft, ctx) && (
        <label className="create-league-check">
          <input
            type="checkbox"
            checked={draft.pichichi}
            onChange={(event) => update({ pichichi: event.target.checked })}
          />
          <span>
            Incluir la predicción del pichichi
            <span className="create-league-hint">
              Cada participante elige al máximo goleador del torneo.
            </span>
          </span>
        </label>
      )}
      <fieldset className="create-league-fieldset">
        <legend className="sr-only">Puntuación</legend>
        <div className="create-league-options is-row">
          <OptionCard
            name="cl-scoring"
            value="default"
            checked={!draft.customScoring}
            onChange={() => update({ customScoring: false })}
            title="La de siempre"
          />
          <OptionCard
            name="cl-scoring"
            value="custom"
            checked={draft.customScoring}
            onChange={() => update({ customScoring: true })}
            title={draft.poolFormat === 'SURVIVOR' ? 'Personalizar reglas' : 'Personalizar puntos'}
          />
        </div>
      </fieldset>
      <ScoringRulesPanel
        scoring={scoring}
        draft={draft.customScoring ? draft.scoring : null}
        onChange={(key, value) => update({ scoring: { ...draft.scoring, [key]: value } })}
      />
      {draft.customScoring && (
        <button
          type="button"
          className="glass-btn create-league-small-btn"
          onClick={() => update({ scoring: toDraft(DEFAULT_SCORING_RULES) })}
        >
          <RotateCcw size={14} aria-hidden="true" />
          Volver a los valores por defecto
        </button>
      )}
      <FieldError fieldId={FIELD_IDS.scoring} message={errors.scoring} />
    </div>
  );
}

/** Paso 3: cierre, puntuación, cuota y visibilidad. Todo se puede cambiar después en Administrar. */
export default function RulesStep(props: StepProps) {
  const { draft, update } = props;
  return (
    <>
      <StepSection id="cl-lock" title="Cierre de predicciones">
        <LockSection {...props} />
      </StepSection>
      <StepSection id="cl-scoring" title="Puntuación">
        <ScoringSection {...props} />
      </StepSection>
      <StepSection id="cl-fee" title="Cuota de inscripción">
        <label className="create-league-check">
          <input
            type="checkbox"
            checked={draft.entryFee}
            onChange={(event) => update({ entryFee: event.target.checked })}
          />
          <span>
            La liga tiene cuota
            <span className="create-league-hint">
              El pago se hace fuera de PorrApp. Tú apuntas quién ha pagado y la clasificación marca
              a quien no.
            </span>
          </span>
        </label>
      </StepSection>
      <StepSection id="cl-visibility" title="Visibilidad">
        <p className="create-league-hint">
          Privada: solo entra quien tenga el código o el enlace de invitación.
        </p>
      </StepSection>
    </>
  );
}
