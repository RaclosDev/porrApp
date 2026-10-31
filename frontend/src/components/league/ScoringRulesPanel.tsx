import type { LeagueScoring, ScoringRuleKey } from '../../types/api';
import { scoringSections, scoringValueError, type ScoringDraft } from '../../utils/scoringRules';

/**
 * Cuánto da cada acierto según el formato de la liga. Con `draft` y `onChange` cada valor es un
 * campo numérico que edita el administrador; sin ellos es una tabla de solo lectura.
 */
export default function ScoringRulesPanel({
  scoring,
  draft,
  onChange,
}: {
  scoring: LeagueScoring;
  draft?: ScoringDraft | null;
  onChange?: (key: ScoringRuleKey, value: string) => void;
}) {
  const editing = Boolean(draft && onChange);
  const sections = scoringSections(scoring.poolFormat, scoring.pichichi);

  return (
    <div className="scoring-panel">
      {sections.map((section) => (
        <section
          key={section.id}
          className="scoring-section"
          aria-labelledby={`scoring-${section.id}`}
        >
          <h4 id={`scoring-${section.id}`}>{section.title}</h4>
          <dl className="scoring-rows">
            {section.fields.map(({ key, label, hint }) => {
              const inputId = `scoring-input-${key}`;
              const value = draft?.[key] ?? String(scoring.rules[key]);
              const error = editing ? scoringValueError(value, scoring.maxPoints) : null;
              const defaultValue = scoring.defaults[key];
              const changedFromDefault = editing && !error && Number(value) !== defaultValue;
              return (
                <div key={key} className="scoring-row">
                  <dt className="scoring-row-text">
                    {editing ? (
                      <label htmlFor={inputId} className="scoring-row-label">
                        {label}
                      </label>
                    ) : (
                      <span className="scoring-row-label">{label}</span>
                    )}
                    <span className="scoring-row-hint">{hint}</span>
                    {error && (
                      <span className="scoring-row-error" id={`${inputId}-error`}>
                        {error}
                      </span>
                    )}
                    {changedFromDefault && (
                      <span className="scoring-row-default">Por defecto: {defaultValue}</span>
                    )}
                  </dt>
                  <dd className="scoring-row-value">
                    {editing ? (
                      <span className="scoring-input-wrap">
                        <input
                          id={inputId}
                          className="glass-input scoring-input"
                          type="number"
                          inputMode="numeric"
                          min={0}
                          max={scoring.maxPoints}
                          step={1}
                          value={value}
                          aria-invalid={Boolean(error)}
                          aria-describedby={error ? `${inputId}-error` : undefined}
                          onChange={(event) => onChange?.(key, event.target.value)}
                        />
                        <span aria-hidden="true">pts</span>
                      </span>
                    ) : (
                      <span className="scoring-points">
                        {scoring.rules[key]} <span>pts</span>
                      </span>
                    )}
                  </dd>
                </div>
              );
            })}
          </dl>
        </section>
      ))}
    </div>
  );
}
