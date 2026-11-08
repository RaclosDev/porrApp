import {
  CUSTOM_NAME_MAX,
  FIELD_IDS,
  competitionUnavailableReason,
  competitionsOfSport,
  errorId,
} from './leagueDraft';
import { FieldError, OptionCard } from './parts';
import TennisTournamentPicker from './TennisTournamentPicker';
import type { StepProps } from './useLeagueDraft';

const NAME = 'cl-competition';

/**
 * Paso 2: sobre qué se juega. Las oficiales del deporte elegido se agrupan por tipo; la personalizada,
 * aparte. Con «otro deporte» solo hay personalizada: se pide su nombre.
 */
export default function CompetitionStep({ draft, update, errors, ctx }: StepProps) {
  const official = competitionsOfSport(ctx, draft.sport);
  // La NFL y la NBA no tienen jornadas: tienen semanas.
  const basketball = draft.sport === 'BASKETBALL';
  const weeks = draft.sport === 'AMERICAN_FOOTBALL' || basketball;
  const groups = [
    {
      id: 'leagues',
      title: weeks ? 'Por semanas' : 'Por jornadas',
      hint: basketball
        ? 'Se juega semana a semana, de octubre a abril.'
        : weeks
          ? 'Se juega semana a semana, de septiembre a la Super Bowl.'
          : 'Se juegan jornada a jornada durante la temporada.',
      items: official.filter((item) => item.formatType === 'LEAGUE'),
    },
    {
      id: 'tournaments',
      title: 'Con cuadro',
      hint: basketball
        ? 'Eliminatorias al mejor de siete: se pronostica serie a serie.'
        : 'Torneos con eliminatorias: también se pueden jugar por jornadas.',
      items: official.filter((item) => item.formatType === 'TOURNAMENT'),
    },
    {
      id: 'events',
      title: 'Por veladas',
      hint: 'Cada velada es una cartelera de peleas: numeradas y Fight Night.',
      items: official.filter((item) => item.formatType === 'EVENTS'),
    },
    {
      id: 'races',
      title: 'Gran Premio a Gran Premio',
      hint: 'En cada Gran Premio se predicen el podio, la pole y la vuelta rápida.',
      items: official.filter((item) => item.formatType === 'RACE'),
    },
  ].filter((group) => group.items.length > 0);

  const nameField = (
    <div className="create-league-field">
      <label htmlFor={FIELD_IDS.customName}>Nombre de la competición</label>
      <input
        id={FIELD_IDS.customName}
        className="glass-input"
        value={draft.customName}
        maxLength={CUSTOM_NAME_MAX}
        autoComplete="off"
        placeholder="Ej.: Torneo de verano del barrio"
        onChange={(event) => update({ customName: event.target.value })}
        aria-invalid={Boolean(errors.customName)}
        aria-describedby={errors.customName ? errorId(FIELD_IDS.customName) : undefined}
      />
      <FieldError fieldId={FIELD_IDS.customName} message={errors.customName} />
    </div>
  );

  if (draft.sport === 'TENNIS') {
    return <TennisTournamentPicker draft={draft} update={update} errors={errors} ctx={ctx} />;
  }

  if (draft.sport === 'OTHER') {
    return (
      <>
        <p className="create-league-hint">
          Tu competición será personalizada: después de crear la liga añades tú los equipos, los
          partidos y los resultados.
        </p>
        {nameField}
      </>
    );
  }

  return (
    <>
      <fieldset
        id={FIELD_IDS.competition}
        className="create-league-fieldset"
        aria-describedby={errors.competition ? errorId(FIELD_IDS.competition) : undefined}
      >
        <legend className="sr-only">Competición</legend>
        {groups.map((group) => (
          <div key={group.id} className="create-league-group">
            <h3 className="create-league-section-title">{group.title}</h3>
            <p className="create-league-hint">{group.hint}</p>
            <div className="create-league-options">
              {group.items.map((competition) => (
                <OptionCard
                  key={competition.id}
                  name={NAME}
                  value={String(competition.id)}
                  checked={!draft.custom && draft.competitionId === competition.id}
                  onChange={() => update({ custom: false, competitionId: competition.id })}
                  title={competition.name}
                  disabledReason={competitionUnavailableReason(competition)}
                />
              ))}
            </div>
          </div>
        ))}
        <div className="create-league-group">
          <h3 className="create-league-section-title">Tu propia competición</h3>
          <div className="create-league-options">
            <OptionCard
              name={NAME}
              value="custom"
              checked={draft.custom}
              onChange={() => update({ custom: true })}
              title="Competición personalizada"
              description="El torneo del barrio, de la oficina o del pueblo. Después de crear la liga añades tú los equipos, los partidos y los resultados."
            />
          </div>
        </div>
        <FieldError fieldId={FIELD_IDS.competition} message={errors.competition} />
      </fieldset>

      {draft.custom && nameField}
    </>
  );
}
