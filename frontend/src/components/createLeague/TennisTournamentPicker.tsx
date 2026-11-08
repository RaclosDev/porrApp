import type { Competition, TennisInfo } from '../../types/api';
import {
  FIELD_IDS,
  TENNIS_DRAW_LABELS,
  competitionsOfSport,
  errorId,
  tennisDrawChoices,
} from './leagueDraft';
import { FieldError, OptionCard } from './parts';
import type { StepProps } from './useLeagueDraft';

const LEVELS: { level: TennisInfo['level']; title: string }[] = [
  { level: 'GRAND_SLAM', title: 'Grand Slam' },
  { level: 'MASTERS_1000', title: 'Masters 1000' },
  { level: 'FINALS', title: 'Finales de temporada' },
];

const DAY = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' });
const DAY_YEAR = new Intl.DateTimeFormat('es-ES', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

/** «18 ene – 1 feb 2027»: las fechas de la edición que se va a jugar. */
function tennisDates(info: TennisInfo): string | null {
  if (!info.startDate || !info.endDate) return null;
  const start = new Date(info.startDate);
  // ESPN da el fin a medianoche de Nueva York: el último día es el anterior en hora peninsular.
  const end = new Date(Date.parse(info.endDate) - 6 * 60 * 60 * 1000);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  return `${DAY.format(start)} – ${DAY_YEAR.format(end)}`.replace(/\./g, '');
}

/** Un torneo por id con sus cuadros abiertos; en el orden en que llegan (por nombre). */
function tournaments(competitions: Competition[]) {
  const byId = new Map<number, { info: TennisInfo; draws: Set<TennisInfo['draw']> }>();
  competitions.forEach((competition) => {
    const info = competition.tennis;
    if (!info || competition.finished) return;
    const entry = byId.get(info.tournamentId) ?? { info, draws: new Set() };
    entry.draws.add(info.draw);
    byId.set(info.tournamentId, entry);
  });
  return [...byId.values()];
}

/**
 * Paso 2 con el tenis: el torneo (Grand Slams, Masters 1000, ATP Finals) y después el cuadro
 * (masculino, femenino o los dos). Solo salen los torneos que aún no han terminado.
 */
export default function TennisTournamentPicker({ draft, update, errors, ctx }: StepProps) {
  const available = tournaments(competitionsOfSport(ctx, 'TENNIS'));
  const selected = ctx.competitions.find((item) => item.id === draft.competitionId)?.tennis;
  const choices = selected ? tennisDrawChoices(ctx, selected.tournamentId) : [];

  const choose = (tournamentId: number) => {
    const first = ctx.competitions.find(
      (item) => item.tennis?.tournamentId === tournamentId && !item.finished,
    );
    if (first) update({ custom: false, competitionId: first.id });
  };

  return (
    <>
      <fieldset
        id={FIELD_IDS.competition}
        className="create-league-fieldset"
        aria-describedby={errors.competition ? errorId(FIELD_IDS.competition) : undefined}
      >
        <legend className="sr-only">Torneo</legend>
        {available.length === 0 && (
          <p className="create-league-hint">
            Ahora mismo no hay ningún torneo por jugar. Aparecerán en cuanto ESPN publique la
            próxima edición.
          </p>
        )}
        {LEVELS.map(({ level, title }) => {
          const items = available.filter(({ info }) => info.level === level);
          if (items.length === 0) return null;
          return (
            <div key={level} className="create-league-group">
              <h3 className="create-league-section-title">{title}</h3>
              <div className="create-league-options">
                {items.map(({ info, draws }) => (
                  <OptionCard
                    key={info.tournamentId}
                    name="cl-tennis-tournament"
                    value={String(info.tournamentId)}
                    checked={!draft.custom && selected?.tournamentId === info.tournamentId}
                    onChange={() => choose(info.tournamentId)}
                    title={info.tournament}
                    description={[
                      tennisDates(info),
                      draws.size > 1 ? 'Cuadro masculino y femenino' : 'Cuadro masculino',
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  />
                ))}
              </div>
            </div>
          );
        })}
        <div className="create-league-group">
          <h3 className="create-league-section-title">Tu propia competición</h3>
          <div className="create-league-options">
            <OptionCard
              name="cl-tennis-tournament"
              value="custom"
              checked={draft.custom}
              onChange={() => update({ custom: true })}
              title="Competición personalizada"
              description="El torneo del club o de los amigos. Después de crear la liga añades tú los partidos y los resultados."
            />
          </div>
        </div>
        <FieldError fieldId={FIELD_IDS.competition} message={errors.competition} />
      </fieldset>

      {selected && !draft.custom && choices.length > 1 && (
        <fieldset className="create-league-fieldset">
          <legend className="create-league-section-title">Cuadro</legend>
          <div className="create-league-options is-row">
            {choices.map((draw) => (
              <OptionCard
                key={draw}
                name="cl-tennis-draw"
                value={draw}
                checked={draft.tennisDraw === draw}
                onChange={() => update({ tennisDraw: draw })}
                title={TENNIS_DRAW_LABELS[draw]}
              />
            ))}
          </div>
        </fieldset>
      )}
    </>
  );
}
