import { useMemo, useState } from 'react';
import type { KnockoutRound, KnockoutTie } from '../../services/api';
import type { Match } from '../../types/api';
import { TeamSlot } from '../BracketCanvas';
import BracketTeamStatus from '../BracketTeamStatus';
import {
  defaultKnockoutRound,
  knockoutRoundTitle,
  tieAggregate,
  type KnockoutPicks,
} from '../../utils/knockoutDraw';

const SPAIN = 'Europe/Madrid';
const DATE = new Intl.DateTimeFormat('es-ES', {
  timeZone: SPAIN,
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

const formatDate = (iso: string | null | undefined) =>
  iso ? DATE.format(new Date(iso)).replace(',', '') : 'Fecha por confirmar';

/** Texto para el lector de pantalla del equipo elegido. */
const PICK_LABELS = {
  picked: ' · tu predicción',
  hit: ' · tu predicción, acertada',
  miss: ' · tu predicción, fallada',
} as const;

interface Props {
  rounds: KnockoutRound[];
  matches: Match[];
  logos: Record<string, string | null | undefined>;
  /** Elecciones que se muestran (las tuyas o las de otro participante); sin ellas, solo resultados. */
  picks?: KnockoutPicks;
  /** Si se pasa, cada cruce abierto se puede elegir pulsando un equipo (y deselegir pulsándolo otra vez). */
  onPick?: (round: number, tie: number, team: string | null) => void;
  isLocked?: (round: number, tie: number) => boolean;
  /** Quién elige: «tu predicción» o la de otra persona. */
  ownPicks?: boolean;
}

/**
 * Eliminatorias sorteadas ronda a ronda (Champions, Copa del Rey…): una pestaña por ronda y una
 * tarjeta por cruce con sus partidos. A ida y vuelta se elige quién pasa, no cada partido.
 */
export default function KnockoutDrawBoard({
  rounds,
  matches,
  logos,
  picks,
  onPick,
  isLocked = () => false,
  ownPicks = true,
}: Props) {
  const [selected, setSelected] = useState<number | null>(null);
  const active = Math.min(selected ?? defaultKnockoutRound(rounds), Math.max(0, rounds.length - 1));
  const byId = useMemo(() => new Map(matches.map((match) => [match.id, match])), [matches]);
  const round = rounds[active];
  if (!round) return null;

  // Los cruces se guardan en orden de importación; se enseñan por fecha.
  const order = round.ties
    .map((tie, index) => ({ tie, index, date: byId.get(tie.matchIds[0])?.date ?? null }))
    .sort((left, right) => (left.date ?? '￿').localeCompare(right.date ?? '￿'));
  const roundLocked = round.drawn && round.ties.every((_, index) => isLocked(active, index));
  const firstDate = order[0]?.date ?? null;

  let status: string;
  if (!round.drawn) {
    status =
      round.ties.length > 0
        ? 'Faltan cruces por sortear: podrás elegir cuando estén todos.'
        : 'Por sortear: los cruces se conocerán tras el sorteo.';
  } else if (round.ties.every((tie) => tie.winner)) {
    status = 'Ronda terminada.';
  } else if (roundLocked) {
    status = 'Cerrada: ya ha empezado.';
  } else if (onPick) {
    status = `Abierta: se cierra al empezar el primer partido (${formatDate(firstDate)}).`;
  } else {
    status = `Empieza el ${formatDate(firstDate)}.`;
  }

  const renderTeam = (tie: KnockoutTie, index: number, side: 'home' | 'away') => {
    const name = tie[side];
    const pick = picks?.[active]?.[index] ?? null;
    const picked = Boolean(name && pick === name);
    const qualified = Boolean(name && tie.winner === name);
    const eliminated = Boolean(name && tie.winner && tie.winner !== name);
    const outcome = !picked ? null : tie.winner ? (qualified ? 'hit' : 'miss') : 'picked';
    const aggregate = tieAggregate(tie, byId);
    const goals = aggregate ? aggregate[side] : null;
    const open = Boolean(onPick && round.drawn && name && !isLocked(active, index));
    return (
      <TeamSlot
        name={name ?? 'Por sortear'}
        logo={name ? logos[name] : null}
        placeholder={!name}
        pressed={picked}
        className={[outcome ? `is-${outcome}` : '', eliminated ? 'is-out' : '']
          .filter(Boolean)
          .join(' ')}
        onClick={open ? () => onPick?.(active, index, picked ? null : name) : undefined}
        rightContent={
          <>
            {outcome && (
              <span className="sr-only">
                {ownPicks ? PICK_LABELS[outcome] : PICK_LABELS[outcome].replace('tu ', 'su ')}
              </span>
            )}
            {goals != null && <span className="knockout-tie-goals">{goals}</span>}
            <BracketTeamStatus
              outcome={qualified ? 'qualified' : eliminated ? 'eliminated' : null}
            />
          </>
        }
      />
    );
  };

  return (
    <div className="knockout-draw">
      <div className="paper-tabs" role="tablist" aria-label="Rondas">
        {rounds.map((item, index) => (
          <button
            key={item.round}
            type="button"
            role="tab"
            id={`knockout-tab-${item.round}`}
            aria-selected={index === active}
            aria-controls="knockout-round-panel"
            className={`paper-tab${index === active ? ' is-active' : ''}`}
            onClick={() => setSelected(index)}
          >
            {knockoutRoundTitle(item.round)}
          </button>
        ))}
      </div>

      <section
        id="knockout-round-panel"
        role="tabpanel"
        aria-labelledby={`knockout-tab-${round.round}`}
        className="knockout-round"
      >
        <p className="knockout-round-status" role="status">
          {status}
        </p>
        {order.length > 0 && (
          <ol className="knockout-ties">
            {order.map(({ tie, index }) => {
              const legs = tie.matchIds.map((id) => byId.get(id)).filter(Boolean) as Match[];
              return (
                <li key={tie.matchIds.join('-')} className="knockout-tie">
                  <p className="knockout-tie-legs">
                    {legs.length > 1
                      ? legs.map((leg, legIndex) => (
                          <span key={leg.id}>
                            {legIndex === 0 ? 'Ida' : 'Vuelta'} {formatDate(leg.date)}
                          </span>
                        ))
                      : legs[0] && <span>{formatDate(legs[0].date)}</span>}
                    {round.drawn && isLocked(active, index) && !tie.winner && (
                      <span className="knockout-tie-closed">Cerrado</span>
                    )}
                  </p>
                  <div className="knockout-tie-teams">
                    {renderTeam(tie, index, 'home')}
                    {renderTeam(tie, index, 'away')}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </div>
  );
}
