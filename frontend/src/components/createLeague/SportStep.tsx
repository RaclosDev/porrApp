import { Link } from 'react-router-dom';
import { FIELD_IDS, SPORT_LABELS, errorId, sportChoices } from './leagueDraft';
import { FieldError, OptionCard } from './parts';
import type { StepProps } from './useLeagueDraft';

/** Paso 1: el deporte. Filtra las competiciones del paso siguiente. */
export default function SportStep({ draft, update, errors, ctx }: StepProps) {
  return (
    <fieldset
      id={FIELD_IDS.sport}
      className="create-league-fieldset"
      aria-describedby={errors.sport ? errorId(FIELD_IDS.sport) : undefined}
    >
      <legend className="sr-only">Deporte</legend>
      <div className="create-league-options is-tiles">
        {sportChoices(ctx).map((sport) => (
          <OptionCard
            key={sport}
            name="cl-sport"
            value={sport}
            checked={draft.sport === sport}
            // Al dejar «otro deporte» se vuelve a poder elegir una competición oficial.
            onChange={() => update(draft.sport === 'OTHER' ? { sport, custom: false } : { sport })}
            title={SPORT_LABELS[sport]}
            // Otro deporte: la competición la montas tú.
            description={sport === 'OTHER' ? 'Tú pones los partidos y los resultados.' : undefined}
          />
        ))}
        {/* No es un deporte ni lleva predicciones: abre el marcador en vez de elegir una opción. */}
        <Link to="/marcador/nuevo" className="create-league-option is-link">
          <span className="create-league-option-body">
            <span className="create-league-option-title">Juego de mesa o de cartas</span>
            <span className="create-league-option-text">
              Sin predicciones: un marcador para llevar la cuenta de las partidas con tus amigos.
            </span>
          </span>
        </Link>
      </div>
      <FieldError fieldId={FIELD_IDS.sport} message={errors.sport} />
    </fieldset>
  );
}
