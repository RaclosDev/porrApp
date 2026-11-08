import { useMemo } from 'react';
import MatchSelectionPicker from '../matchSelection/MatchSelectionPicker';
import {
  ALL_MATCHES,
  addableCompetitions,
  groupByRound,
  leagueCompetitionIds,
} from '../matchSelection/matchSelection';
import { formatMatchDate } from '../../utils/matchday';
import { useSelectableCalendar } from '../matchSelection/useSelectableCalendar';
import {
  FIELD_IDS,
  errorId,
  formatsForSport,
  formatCopy,
  formatUnavailableReason,
  isFightNights,
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
 * UFC: la liga cubre todas las veladas desde hoy o una sola. Una velada se guarda como sus peleas
 * elegidas a mano; las que se añadan después a su cartelera entran solas.
 */
function FightNightsSection({ draft, update, errors }: StepProps) {
  const competitionId = draft.competitionId;
  const calendar = useSelectableCalendar(competitionId == null ? [] : [competitionId]);
  const nights = useMemo(
    () =>
      groupByRound(calendar.data?.matches ?? [])
        .filter((group) => !group.closed)
        .map((group) => ({
          round: group.round,
          date: group.matches.map((match) => match.date).find(Boolean) ?? null,
          ids: group.matches.map((match) => match.id),
        })),
    [calendar.data],
  );
  const single = draft.matches.mode !== 'ALL';
  const chosen =
    calendar.data?.matches.find((match) => draft.matches.included.includes(match.id))?.round ?? '';
  const choose = (round: string) =>
    update({
      matches: {
        ...ALL_MATCHES,
        mode: 'PICK',
        included: nights.find((night) => night.round === round)?.ids ?? [],
      },
    });
  return (
    <StepSection id="cl-matches" title="Veladas">
      <fieldset
        id={FIELD_IDS.matches}
        className="create-league-fieldset"
        aria-describedby={errors.matches ? errorId(FIELD_IDS.matches) : undefined}
      >
        <legend className="sr-only">Qué veladas cubre la liga</legend>
        <div className="create-league-options">
          <OptionCard
            name="cl-nights"
            value="all"
            checked={!single}
            onChange={() => update({ matches: ALL_MATCHES })}
            title="Todas las veladas"
            description="Desde hoy, todas las que vengan: las numeradas y las Fight Night."
          />
          <OptionCard
            name="cl-nights"
            value="one"
            checked={single}
            onChange={() => nights[0] && choose(nights[0].round)}
            title="Una sola velada"
            description="La liga dura una velada. Si cambia la cartelera, las peleas nuevas entran solas."
            disabledReason={
              calendar.isPending
                ? 'Cargando el calendario…'
                : nights.length === 0
                  ? 'No hay veladas anunciadas.'
                  : null
            }
          />
        </div>
      </fieldset>
      {single && nights.length > 0 && (
        <div className="create-league-field">
          <label htmlFor="cl-night">Velada</label>
          <select
            id="cl-night"
            className="glass-input"
            value={chosen}
            onChange={(event) => choose(event.target.value)}
          >
            {!chosen && <option value="">Elige una velada</option>}
            {nights.map((night) => (
              <option key={night.round} value={night.round}>
                {night.round}
                {night.date ? ` · ${formatMatchDate(night.date)}` : ''}
              </option>
            ))}
          </select>
        </div>
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
      {matchSelectionApplies(draft, ctx) &&
        (isFightNights(draft, ctx) ? (
          <FightNightsSection {...props} />
        ) : (
          <MatchesSection {...props} />
        ))}
    </>
  );
}
