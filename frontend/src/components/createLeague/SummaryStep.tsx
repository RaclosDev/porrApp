import type { ReactNode } from 'react';
import { LeagueAvatar } from '../Avatar';
import { describeLockOffset } from '../groups/custom/lockModes';
import {
  FORMAT_COPY,
  LEAGUE_STEPS,
  customScoringRules,
  lockModesFor,
  lockOffsetMinutes,
  pichichiApplies,
  scoringEditable,
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
  if (!scoringEditable(draft)) return 'Fija: 1 por jornada superada';
  const base = customScoringRules(draft) ? 'Personalizada' : 'La de siempre';
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
  // Visibilidad no tiene paso: toda liga nueva es privada.
  const rows: { label: string; value: ReactNode; step: LeagueStepId | null }[] = [
    {
      label: 'Competición',
      value: draft.custom ? `${draft.customName.trim()} (personalizada)` : competition?.name,
      step: 'competition',
    },
    {
      label: 'Modo de juego',
      value: draft.poolFormat ? FORMAT_COPY[draft.poolFormat].title : '',
      step: 'format',
    },
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
