import type { LeagueScoring, ScoringRuleKey } from '../../types/api';
import { scoringFieldError, scoringSections, type ScoringDraft } from '../../utils/scoringRules';
import { allowsDraw } from '../../utils/matchday';

/** Cómo se juega superviviente con las vidas y la regla del empate de esta liga. */
function survivorRules(lives: number, drawSurvives: boolean) {
  const survive = drawSurvives
    ? 'Si gana o empata, superas la jornada'
    : 'Si gana, superas la jornada; si empata o pierde, fallas';
  const fail =
    lives > 1
      ? `Cada fallo te quita una vida y con la última quedas eliminado: empiezas con ${lives}.`
      : 'Al primer fallo quedas eliminado.';
  return `Superviviente: en cada jornada eliges un equipo que gane, y no puedes repetir equipo en toda la temporada. ${survive}. ${fail} Elegir es obligatorio: si empiezan todos los partidos de una jornada sin que hayas elegido, cuenta como fallo. Gana quien supere más jornadas.`;
}

/**
 * Cuánto da cada acierto según el formato de la liga. Con `draft` y `onChange` cada valor es un
 * campo que edita el administrador; sin ellos es una tabla de solo lectura.
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
  const signOnly = scoring.matchSignOnly ?? true;
  const winnerOnly = !allowsDraw(scoring.sport);
  const sections = scoringSections(
    scoring.poolFormat,
    scoring.pichichi,
    scoring.knockoutDraw,
    scoring.nbaSeries,
    winnerOnly,
    scoring.fights,
  );
  const current = (key: ScoringRuleKey) =>
    draft?.[key] ?? String(scoring.rules[key] ?? scoring.defaults[key]);

  return (
    <div className="scoring-panel">
      {scoring.poolFormat === 'SURVIVOR' && (
        <p className="scoring-row-hint">
          {survivorRules(
            Number(current('survivorLives')) || 1,
            current('survivorDrawSurvives') === '1',
          )}
        </p>
      )}
      {scoring.poolFormat === 'MATCH_DAY' && scoring.fights && (
        <p className="scoring-row-hint">
          Un empate o una pelea sin resultado no dan puntos a nadie. Una pelea cancelada no cuenta
          y, si cambia un rival, la predicción de esa pelea se anula y se avisa.
        </p>
      )}
      {scoring.poolFormat === 'MATCH_DAY' && signOnly && !winnerOnly && (
        <p className="scoring-row-hint">
          Provisionalmente solo puntúa el signo 1X2. El resultado exacto y la diferencia de goles
          están pausados; sus valores se conservan para reactivarlos más adelante.
        </p>
      )}
      {sections.map((section) => (
        <section
          key={section.id}
          className="scoring-section"
          aria-labelledby={`scoring-${section.id}`}
        >
          <h4 id={`scoring-${section.id}`}>{section.title}</h4>
          <dl className="scoring-rows">
            {section.fields.map(({ key, label, hint, kind = 'points' }) => {
              const paused =
                signOnly && (key === 'exactScorePoints' || key === 'goalDiffBonusPoints');
              const inputId = `scoring-input-${key}`;
              const value = current(key);
              const error = editing ? scoringFieldError(key, value, scoring.maxPoints) : null;
              const defaultValue = scoring.defaults[key];
              const changedFromDefault = editing && !error && Number(value) !== defaultValue;
              const shown = (raw: number | string) =>
                kind === 'toggle' ? (Number(raw) === 1 ? 'Sí' : 'No') : String(raw);
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
                    <span className="scoring-row-hint" id={`${inputId}-hint`}>
                      {paused ? `Pausado temporalmente. ${hint}` : hint}
                    </span>
                    {error && (
                      <span className="scoring-row-error" id={`${inputId}-error`}>
                        {error}
                      </span>
                    )}
                    {changedFromDefault && (
                      <span className="scoring-row-default">
                        Por defecto: {shown(defaultValue)}
                      </span>
                    )}
                  </dt>
                  <dd className="scoring-row-value">
                    {editing && kind === 'toggle' ? (
                      <input
                        id={inputId}
                        className="scoring-toggle"
                        type="checkbox"
                        checked={value === '1'}
                        aria-describedby={`${inputId}-hint`}
                        onChange={(event) => onChange?.(key, event.target.checked ? '1' : '0')}
                      />
                    ) : editing ? (
                      <span className="scoring-input-wrap">
                        <input
                          id={inputId}
                          className="glass-input scoring-input"
                          type="number"
                          disabled={paused}
                          inputMode="numeric"
                          min={kind === 'count' ? 1 : 0}
                          max={kind === 'count' ? 10 : scoring.maxPoints}
                          step={1}
                          value={value}
                          aria-invalid={Boolean(error)}
                          aria-describedby={error ? `${inputId}-error` : undefined}
                          onChange={(event) => onChange?.(key, event.target.value)}
                        />
                        {kind === 'points' && <span aria-hidden="true">pts</span>}
                      </span>
                    ) : (
                      <span className="scoring-points">
                        {paused ? (
                          'Pausado'
                        ) : kind === 'points' ? (
                          <>
                            {scoring.rules[key]} <span>pts</span>
                          </>
                        ) : (
                          shown(scoring.rules[key] ?? scoring.defaults[key])
                        )}
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
