import MatchSelectionPicker from '../matchSelection/MatchSelectionPicker';
import { addableCompetitions, leagueCompetitionIds } from '../matchSelection/matchSelection';
import { useSelectableCalendar } from '../matchSelection/useSelectableCalendar';
import {
  FIELD_IDS,
  errorId,
  formatsForSport,
  formatCopy,
  formatUnavailableReason,
  matchSelectionApplies,
} from './leagueDraft';
import { FieldError, OptionCard, StepSection } from './parts';
import type { StepProps } from './useLeagueDraft';

/**
 * Qué partidos entran: todos, los de un equipo o elegidos a mano, también de otras competiciones
 * oficiales del mismo deporte.
 */
function MatchesSection({ draft, update, errors, ctx }: StepProps) {
  const competitionId = draft.competitionId;
  const calendar = useSelectableCalendar(leagueCompetitionIds(draft.matches, competitionId));
  const primary = ctx.competitions.find((item) => item.id === competitionId);
  const others =
    competitionId == null
      ? []
      : addableCompetitions(ctx.competitions, competitionId, draft.matches.competitionIds);
  return (
    <StepSection id="cl-matches" title="Partidos">
      {calendar.isPending ? (
        <p className="create-league-hint">Cargando el calendario…</p>
      ) : calendar.isError ? (
        <p className="create-league-hint">
          No se pudo cargar el calendario. Puedes crear la liga con todos los partidos y elegirlos
          después en Administrar.
        </p>
      ) : (
        <MatchSelectionPicker
          teams={calendar.data.teams}
          matches={calendar.data.matches}
          value={draft.matches}
          onChange={(matches) => update({ matches })}
          primaryCompetition={primary && { id: primary.id, name: primary.name }}
          otherCompetitions={others.map((item) => ({ id: item.id, name: item.name }))}
          loadingCalendar={calendar.isPlaceholderData}
          fieldId={FIELD_IDS.matches}
          errorId={errors.matches ? errorId(FIELD_IDS.matches) : undefined}
        />
      )}
      <FieldError fieldId={FIELD_IDS.matches} message={errors.matches} />
    </StepSection>
  );
}

/**
 * Paso 2: el modo de juego. Los que no encajan con la competición se ven, con el motivo. Por
 * jornadas sobre una competición oficial, además, qué partidos entran.
 */
export default function FormatStep(props: StepProps) {
  const { draft, update, errors, ctx } = props;
  return (
    <>
      <fieldset
        id={FIELD_IDS.poolFormat}
        className="create-league-fieldset"
        aria-describedby={errors.poolFormat ? errorId(FIELD_IDS.poolFormat) : undefined}
      >
        <legend className="sr-only">Modo de juego</legend>
        <div className="create-league-options">
          {formatsForSport(draft.sport).map((format) => (
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
      {matchSelectionApplies(draft, ctx) && <MatchesSection {...props} />}
    </>
  );
}
