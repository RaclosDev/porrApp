import { useState } from 'react';
import { ArrowRight, CalendarClock, CheckCircle2, Circle, Info, ListChecks } from 'lucide-react';
import { setCustomLockDate } from '../../../services/api';
import type { CustomTeam } from '../../../services/api';
import type { Group, Match } from '../../../types/api';
import { formatMatchDate, isBye, type CustomTab, type SaveAction } from './customCompetition';

interface Step {
  done: boolean;
  label: string;
  hint: string;
  tab: CustomTab;
}

/** Estado de la competición, cierre de pronósticos y lo que falta por configurar. */
export default function CustomSummaryTab({
  group,
  teams,
  matches,
  lockDate,
  onLockDateSaved,
  save,
  goTo,
}: {
  group: Group;
  teams: CustomTeam[];
  matches: Match[];
  lockDate: string | null;
  onLockDateSaved: (lockDate: string) => void;
  save: SaveAction;
  goTo: (tab: CustomTab) => void;
}) {
  const [draft, setDraft] = useState(lockDate?.slice(0, 16) ?? '');
  const matchDay = group.poolFormat === 'MATCH_DAY';
  const played = matches.filter((match) => !isBye(match));
  const finished = played.filter((match) => match.finished).length;
  const [now] = useState(() => Date.now());
  const overdue = played.filter(
    (match) => !match.finished && match.date && new Date(match.date).getTime() < now,
  ).length;

  const steps: Step[] = [];
  if (!matchDay) {
    steps.push({
      done: Boolean(lockDate),
      label: 'Fija el cierre de pronósticos',
      hint: 'Hazlo antes de compartir la liga: tras el primer pronóstico ya no se puede cambiar.',
      tab: 'summary',
    });
  }
  steps.push({
    done: teams.length >= 2,
    label: 'Añade al menos dos equipos',
    hint:
      group.poolFormat === 'FULL_BRACKET'
        ? 'Cada equipo va en un grupo; el escudo es opcional.'
        : 'El escudo es opcional y se puede cambiar en cualquier momento.',
    tab: 'teams',
  });
  if (group.poolFormat === 'FULL_BRACKET') {
    steps.push({
      done: matches.some((match) => match.round === 'group'),
      label: 'Crea los partidos de grupos',
      hint: 'Cada partido enfrenta a dos equipos del mismo grupo.',
      tab: 'matches',
    });
  }
  if (matchDay) {
    steps.push({
      done: matches.length > 0,
      label: 'Crea los partidos de cada jornada',
      hint: 'Cada partido necesita fecha y hora.',
      tab: 'matches',
    });
  } else {
    steps.push({
      done: matches.some((match) => match.round === 'bracket-1'),
      label: 'Crea los cruces de la primera ronda',
      hint: 'En el orden en que deben aparecer en el cuadro. Usa «Descanso» si un equipo pasa directo.',
      tab: 'matches',
    });
  }
  const pendingSteps = steps.filter((step) => !step.done).length;

  return (
    <>
      <section className="league-admin-card">
        <div className="league-admin-card-head">
          <h3>
            <ListChecks size={14} aria-hidden="true" />
            Estado
          </h3>
          <span className="league-admin-card-meta">
            {pendingSteps === 0 ? 'Lista para jugar' : `Faltan ${pendingSteps} pasos`}
          </span>
        </div>
        <div className="league-admin-stats">
          <div className="league-admin-stat">
            <span>Equipos</span>
            <strong>{teams.length}</strong>
          </div>
          <div className="league-admin-stat">
            <span>Partidos</span>
            <strong>{played.length}</strong>
          </div>
          <div className={`league-admin-stat ${overdue ? 'is-pending' : 'is-paid'}`}>
            <span>Resultados</span>
            <strong>
              {finished}/{played.length}
            </strong>
          </div>
        </div>
        {overdue > 0 && (
          <button
            type="button"
            className="league-admin-btn custom-admin-overdue"
            onClick={() => goTo('results')}
          >
            {overdue === 1
              ? '1 partido ya jugado espera resultado'
              : `${overdue} partidos ya jugados esperan resultado`}
            <ArrowRight size={14} aria-hidden="true" />
          </button>
        )}
      </section>

      <section className="league-admin-card">
        <div className="league-admin-card-head">
          <h3>
            <CheckCircle2 size={14} aria-hidden="true" />
            Qué falta configurar
          </h3>
        </div>
        <ol className="custom-admin-steps">
          {steps.map((step) => (
            <li key={step.label} className={step.done ? 'is-done' : ''}>
              {step.done ? (
                <CheckCircle2 size={18} aria-label="Hecho" />
              ) : (
                <Circle size={18} aria-label="Pendiente" />
              )}
              <div>
                <strong>{step.label}</strong>
                <span>{step.hint}</span>
              </div>
              {!step.done && step.tab !== 'summary' && (
                <button
                  type="button"
                  className="league-admin-text-btn"
                  onClick={() => goTo(step.tab)}
                >
                  Ir
                  <ArrowRight size={13} aria-hidden="true" />
                </button>
              )}
            </li>
          ))}
        </ol>
      </section>

      {!matchDay && (
        <section className="league-admin-card">
          <div className="league-admin-card-head">
            <h3>
              <CalendarClock size={14} aria-hidden="true" />
              Cierre de pronósticos
            </h3>
            <span className="league-admin-card-meta">
              {lockDate ? formatMatchDate(lockDate) : 'Sin fijar'}
            </span>
          </div>
          <p className="league-admin-muted">
            Hasta esta fecha los participantes pueden rellenar su porra. Solo se puede cambiar antes
            del primer pronóstico.
          </p>
          <form
            className="custom-admin-form"
            onSubmit={(event) => {
              event.preventDefault();
              void save(async () => {
                await setCustomLockDate(group.id, draft);
                onLockDateSaved(draft);
              }, 'Cierre de pronósticos guardado');
            }}
          >
            <div className="league-admin-field">
              <label htmlFor="custom-admin-lock-date">Fecha y hora de cierre</label>
              <input
                id="custom-admin-lock-date"
                className="glass-input"
                type="datetime-local"
                required
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
              />
            </div>
            <button
              type="submit"
              className="league-admin-btn is-primary"
              disabled={!draft || draft === lockDate?.slice(0, 16)}
            >
              Guardar cierre
            </button>
          </form>
        </section>
      )}

      <p className="league-admin-muted custom-admin-note">
        <Info size={13} aria-hidden="true" />
        {matchDay
          ? 'Tras el primer pronóstico ya no se pueden cambiar los equipos. Los escudos y los resultados sí.'
          : 'Tras el primer pronóstico ya no se pueden cambiar los equipos ni los cruces de la primera ronda. Los escudos y los resultados sí.'}
      </p>
    </>
  );
}
