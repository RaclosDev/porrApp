import type { ReactNode } from 'react';
import {
  describeCompetitions,
  describeSelection,
  isMultiCompetition,
  leagueCompetitionIds,
} from '../matchSelection/matchSelection';
import { useSelectableCalendar } from '../matchSelection/useSelectableCalendar';
import { LeagueAvatar } from '../Avatar';
import { describeLockOffset } from '../groups/custom/lockModes';
import {
  LEAGUE_STEPS,
  SPORT_LABELS,
  customScoringRules,
  formatCopy,
  isFightNights,
  lockModesFor,
  lockOffsetMinutes,
  matchSelectionApplies,
  pichichiApplies,
  selectedCompetition,
  type DraftContext,
  type LeagueDraft,
  type LeagueStepId,
} from './leagueDraft';

function describeLock(draft: LeagueDraft, ctx: DraftContext) {
  const mode = lockModesFor(draft, ctx).find((item) => item.value === draft.lockMode);
  if (!mode) return 'Cada elección, al empezar su partido';
  if (mode.value === 'FIXED_DATE') {
    const date = new Date(draft.lockDate);
    return `${mode.label}: ${date.toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })}`;
  }
  const margin = describeLockOffset(lockOffsetMinutes(draft));
  return margin ? `${mode.label}, ${margin}` : mode.label;
}

function describeScoring(draft: LeagueDraft, ctx: DraftContext) {
  const rules = customScoringRules(draft);
  if (draft.poolFormat === 'SURVIVOR') {
    // En superviviente lo que importa son las vidas y el empate, más que los puntos.
    const points = rules?.survivorRoundPoints ?? 1;
    const lives = rules?.survivorLives ?? 1;
    return [
      `${points} ${points === 1 ? 'punto' : 'puntos'} por jornada superada`,
      lives === 1 ? 'eliminado al primer fallo' : `${lives} vidas`,
      rules?.survivorDrawSurvives === 1 ? 'el empate salva' : 'el empate elimina',
    ].join(', ');
  }
  const base = rules ? 'Personalizada' : 'La de siempre';
  return pichichiApplies(draft, ctx) && draft.pichichi ? `${base}, con pichichi` : base;
}

const excerpt = (text: string, max = 160) =>
  text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;

/** Paso 5: todo lo elegido, con un acceso a cada paso para cambiarlo, y el botón de crear. */
export default function SummaryStep({
  draft,
  ctx,
  goTo,
}: {
  draft: LeagueDraft;
  ctx: DraftContext;
  goTo: (step: LeagueStepId) => void;
}) {
  const competition = selectedCompetition(draft, ctx);
  const picksMatches = matchSelectionApplies(draft, ctx);
  // El calendario ya está en caché desde el paso del modo de juego.
  const calendar = useSelectableCalendar(
    leagueCompetitionIds(draft.matches, draft.competitionId),
    picksMatches && draft.matches.mode !== 'ALL',
  );
  const selectionText =
    draft.matches.mode === 'ALL' || !calendar.data
      ? draft.matches.mode === 'ALL'
        ? 'Todos los partidos'
        : 'Elegidos por ti'
      : describeSelection(draft.matches, calendar.data.teams, calendar.data.matches);
  const competitionNames = draft.matches.competitionIds.map(
    (id) => ctx.competitions.find((item) => item.id === id)?.name ?? '',
  );
  const fightNights = isFightNights(draft, ctx);
  const chosenNight = calendar.data?.matches.find((match) =>
    draft.matches.included.includes(match.id),
  )?.round;
  const matchesText = fightNights
    ? draft.matches.mode === 'ALL'
      ? 'Todas, desde hoy'
      : (chosenNight ?? 'Una sola velada')
    : isMultiCompetition(draft.matches)
      ? `${selectionText} de ${describeCompetitions(competitionNames)}, por semanas`
      : selectionText;
  // Visibilidad no tiene paso: toda liga nueva es privada.
  const rows: { label: string; value: ReactNode; step: LeagueStepId | null }[] = [
    { label: 'Deporte', value: draft.sport ? SPORT_LABELS[draft.sport] : '', step: 'sport' },
    {
      label: 'Competición',
      value: draft.custom ? `${draft.customName.trim()} (personalizada)` : competition?.name,
      step: 'competition',
    },
    {
      label: 'Modo de juego',
      value: draft.poolFormat ? formatCopy(draft.poolFormat, draft, ctx).title : '',
      step: 'format',
    },
    ...(picksMatches
      ? [
          {
            label: fightNights ? 'Veladas' : 'Partidos',
            value: matchesText,
            step: 'format' as LeagueStepId,
          },
        ]
      : []),
    { label: 'Cierre', value: describeLock(draft, ctx), step: 'rules' },
    { label: 'Puntuación', value: describeScoring(draft, ctx), step: 'rules' },
    { label: 'Cuota', value: draft.entryFee ? 'Sí' : 'Sin cuota', step: 'rules' },
    { label: 'Visibilidad', value: 'Privada, con invitación', step: null },
    {
      label: 'Nombre',
      value: (
        <span className="create-league-summary-name">
          <LeagueAvatar url={draft.image} name={draft.name} size={32} />
          {draft.name.trim()}
        </span>
      ),
      step: 'identity',
    },
    {
      label: 'Normas',
      value: draft.rules.trim() ? excerpt(draft.rules.trim()) : 'Sin normas',
      step: 'identity',
    },
  ];
  const stepLabel = (step: LeagueStepId) =>
    LEAGUE_STEPS.find((item) => item.id === step)?.label ?? '';

  return (
    <dl className="create-league-summary">
      {rows.map((row) => (
        <div key={row.label} className="create-league-summary-row">
          <dt>{row.label}</dt>
          <dd>{row.value}</dd>
          {row.step && (
            <dd className="create-league-summary-edit">
              <button
                type="button"
                className="create-league-link"
                onClick={() => row.step && goTo(row.step)}
                aria-label={`Cambiar ${row.label.toLowerCase()} (paso ${stepLabel(row.step)})`}
              >
                Cambiar
              </button>
            </dd>
          )}
        </div>
      ))}
    </dl>
  );
}
