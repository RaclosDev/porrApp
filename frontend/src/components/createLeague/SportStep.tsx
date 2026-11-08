import {
  FIELD_IDS,
  SPORT_LABELS,
  competitionsOfSport,
  errorId,
  sportChoices,
  type SportChoice,
} from './leagueDraft';
import { FieldError, OptionCard } from './parts';
import type { StepProps } from './useLeagueDraft';

/** Qué competiciones oficiales tiene un deporte: las tres primeras y cuántas más. */
function sportDescription(sport: SportChoice, ctx: StepProps['ctx']) {
  if (sport === 'OTHER') {
    return 'Cualquier deporte o juego. Creas tú la competición y añades sus equipos, partidos y resultados.';
  }
  if (sport === 'TENNIS') {
    const open = [
      ...new Set(
        competitionsOfSport(ctx, sport)
          .filter((item) => !item.finished)
          .map((item) => item.tennis?.tournament ?? item.name),
      ),
    ];
    return open.length > 0
      ? `Grand Slams, Masters 1000, WTA 1000 y Finals. Ahora: ${open.slice(0, 3).join(', ')}.`
      : 'Grand Slams, Masters 1000, WTA 1000 y Finals, en cuanto haya uno por jugar.';
  }
  const names = competitionsOfSport(ctx, sport).map((item) => item.name);
  const shown = names.slice(0, 3).join(', ');
  return names.length > 3 ? `${shown} y ${names.length - 3} más.` : `${shown}.`;
}

/** Paso 1: el deporte. Filtra las competiciones del paso siguiente. */
export default function SportStep({ draft, update, errors, ctx }: StepProps) {
  return (
    <fieldset
      id={FIELD_IDS.sport}
      className="create-league-fieldset"
      aria-describedby={errors.sport ? errorId(FIELD_IDS.sport) : undefined}
    >
      <legend className="sr-only">Deporte</legend>
      <div className="create-league-options">
        {sportChoices(ctx).map((sport) => (
          <OptionCard
            key={sport}
            name="cl-sport"
            value={sport}
            checked={draft.sport === sport}
            // Al dejar «otro deporte» se vuelve a poder elegir una competición oficial.
            onChange={() => update(draft.sport === 'OTHER' ? { sport, custom: false } : { sport })}
            title={SPORT_LABELS[sport]}
            description={sportDescription(sport, ctx)}
          />
        ))}
      </div>
      <FieldError fieldId={FIELD_IDS.sport} message={errors.sport} />
    </fieldset>
  );
}
