import { Fragment, useMemo, useState, type ReactNode } from 'react';
import type { KnockoutRound, KnockoutTie } from '../../services/api';
import type { Match } from '../../types/api';
import { TeamSlot } from '../BracketCanvas';
import BracketTeamStatus from '../BracketTeamStatus';
import {
  defaultKnockoutRound,
  knockoutRoundTitle,
  tieAggregate,
  type KnockoutPicks,
  type SeriesGames,
} from '../../utils/knockoutDraw';
import {
  CONFERENCE_LABELS,
  isSeriesRound,
  seriesLengths,
  seriesScore,
  seriesWins,
} from '../../utils/nbaPlayoffs';

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
  /** En la NBA, en cuántos partidos se gana cada serie elegida. */
  games?: SeriesGames;
  /** Si se pasa, en cada serie abierta con ganador elegido se puede elegir en cuántos partidos. */
  onGames?: (round: number, tie: number, games: number | null) => void;
  isLocked?: (round: number, tie: number) => boolean;
  /** Quién elige: «tu predicción» o la de otra persona. */
  ownPicks?: boolean;
}

/** Estado de una ronda, encima de sus cruces. */
function roundStatus(
  round: KnockoutRound,
  roundLocked: boolean,
  firstDate: string | null,
  editable: boolean,
): string {
  const series = isSeriesRound(round);
  if (series && round.ties.length === 0) {
    return round.round === 'playin' || round.round === 'r16'
      ? 'Por decidir: los cruces se conocen al acabar la temporada regular.'
      : 'Por decidir: las series se conocen al acabar la ronda anterior.';
  }
  if (!round.drawn) {
    return round.ties.length > 0
      ? 'Faltan cruces por sortear: podrás elegir cuando estén todos.'
      : 'Por sortear: los cruces se conocerán tras el sorteo.';
  }
  const pending = Math.max(0, round.expectedTies - round.ties.length);
  if (pending === 0 && round.ties.every((tie) => tie.winner)) return 'Ronda terminada.';
  if (roundLocked) return 'Cerrada: ya ha empezado.';
  if (series) {
    const missing = pending > 0 ? ` Faltan ${pending} por decidir.` : '';
    return editable
      ? `Abierta: cada ${round.bestOf === 1 ? 'partido' : 'serie'} se cierra al empezar.${missing}`
      : `Empieza el ${formatDate(firstDate)}.${missing}`;
  }
  return editable
    ? `Abierta: se cierra al empezar el primer partido (${formatDate(firstDate)}).`
    : `Empieza el ${formatDate(firstDate)}.`;
}

/**
 * Eliminatorias sorteadas ronda a ronda (Champions, Copa del Rey, playoffs de la NBA): una pestaña por
 * ronda y una tarjeta por cruce. A ida y vuelta se elige quién pasa, no cada partido; en una serie de la
 * NBA, quién la gana y en cuántos partidos.
 */
export default function KnockoutDrawBoard({
  rounds,
  matches,
  logos,
  picks,
  onPick,
  games,
  onGames,
  isLocked = () => false,
  ownPicks = true,
}: Props) {
  const [selected, setSelected] = useState<number | null>(null);
  const active = Math.min(selected ?? defaultKnockoutRound(rounds), Math.max(0, rounds.length - 1));
  const byId = useMemo(() => new Map(matches.map((match) => [match.id, match])), [matches]);
  const round = rounds[active];
  if (!round) return null;
  const series = isSeriesRound(round);

  // Los cruces se guardan en orden de importación; se enseñan por fecha (en la NBA, por conferencia).
  const order = round.ties
    .map((tie, index) => ({ tie, index, date: byId.get(tie.matchIds[0])?.date ?? null }))
    .sort(
      (left, right) =>
        (series ? (left.tie.conference ?? '').localeCompare(right.tie.conference ?? '') : 0) ||
        (left.date ?? '￿').localeCompare(right.date ?? '￿'),
    );
  const roundLocked = round.drawn && round.ties.every((_, index) => isLocked(active, index));
  const status = roundStatus(round, roundLocked, order[0]?.date ?? null, Boolean(onPick));

  const renderTeam = (tie: KnockoutTie, index: number, side: 'home' | 'away') => {
    const name = tie[side];
    const pick = picks?.[active]?.[index] ?? null;
    const picked = Boolean(name && pick === name);
    const qualified = Boolean(name && tie.winner === name);
    const eliminated = Boolean(name && tie.winner && tie.winner !== name);
    const outcome = !picked ? null : tie.winner ? (qualified ? 'hit' : 'miss') : 'picked';
    let score: number | null = null;
    if (series) {
      const wins = seriesWins(tie, byId);
      score = wins.played > 0 && (round.bestOf ?? 0) > 1 ? wins[side] : null;
    } else {
      const aggregate = tieAggregate(tie, byId);
      score = aggregate ? aggregate[side] : null;
    }
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
            {score != null && <span className="knockout-tie-goals">{score}</span>}
            <BracketTeamStatus
              outcome={qualified ? 'qualified' : eliminated ? 'eliminated' : null}
            />
          </>
        }
      />
    );
  };

  /** En cuántos partidos gana la serie el elegido: botones si está abierta, texto si no. */
  const renderGames = (tie: KnockoutTie, index: number) => {
    const bestOf = round.bestOf ?? 0;
    const pick = picks?.[active]?.[index] ?? null;
    if (bestOf < 2 || !pick) return null;
    const chosen = games?.[active]?.[index] ?? null;
    const lengths = seriesLengths(bestOf);
    const editable = Boolean(onGames && !isLocked(active, index) && !tie.winner);
    const played = seriesWins(tie, byId).played;
    const exact = tie.winner === pick && chosen === played;
    if (!editable) {
      if (chosen == null) return null;
      return (
        <p className={`knockout-series-games is-static${exact ? ' is-hit' : ''}`}>
          {ownPicks ? 'Tu resultado' : 'Su resultado'}: {pick} {seriesScore(chosen, bestOf)}
          {exact && <span className="sr-only">, acertado</span>}
        </p>
      );
    }
    return (
      <fieldset className="knockout-series-games">
        <legend>¿En cuántos partidos gana {pick}?</legend>
        <div className="knockout-series-options">
          {lengths.map((length) => (
            <button
              key={length}
              type="button"
              className={`knockout-series-option${chosen === length ? ' is-active' : ''}`}
              aria-pressed={chosen === length}
              aria-label={`${pick} gana ${seriesScore(length, bestOf)}, en ${length} partidos`}
              onClick={() => onGames?.(active, index, chosen === length ? null : length)}
            >
              {seriesScore(length, bestOf)}
            </button>
          ))}
        </div>
      </fieldset>
    );
  };

  /** Fecha del cruce: ida y vuelta, partido único o, en una serie, su primer partido y cómo va. */
  const renderLegs = (tie: KnockoutTie, index: number) => {
    const legs = tie.matchIds.map((id) => byId.get(id)).filter(Boolean) as Match[];
    let when: ReactNode;
    if (series && (round.bestOf ?? 0) > 1) {
      const wins = seriesWins(tie, byId);
      const leader = wins.home > wins.away ? tie.home : tie.away;
      const high = Math.max(wins.home, wins.away);
      const low = Math.min(wins.home, wins.away);
      const next = legs.find((leg) => !leg.finished);
      when = tie.winner ? (
        <span>
          {tie.winner} gana {high}-{low}
        </span>
      ) : wins.played === 0 ? (
        <span>1.er partido {formatDate(legs[0]?.date)}</span>
      ) : (
        <>
          <span>{high === low ? `Empate ${high}-${low}` : `${leader} ${high}-${low}`}</span>
          {next && <span>Próximo {formatDate(next.date)}</span>}
        </>
      );
    } else if (legs.length > 1) {
      when = legs.map((leg, legIndex) => (
        <span key={leg.id}>
          {legIndex === 0 ? 'Ida' : 'Vuelta'} {formatDate(leg.date)}
        </span>
      ));
    } else {
      when = legs[0] && <span>{formatDate(legs[0].date)}</span>;
    }
    return (
      <p className="knockout-tie-legs">
        {when}
        {round.drawn && isLocked(active, index) && !tie.winner && (
          <span className="knockout-tie-closed">Cerrado</span>
        )}
      </p>
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
            {knockoutRoundTitle(item.round, isSeriesRound(item), true)}
          </button>
        ))}
      </div>

      <section
        id="knockout-round-panel"
        role="tabpanel"
        aria-labelledby={`knockout-tab-${round.round}`}
        className="knockout-round"
      >
        {series && (
          <h3 className="knockout-round-title">{knockoutRoundTitle(round.round, true)}</h3>
        )}
        <p className="knockout-round-status" role="status">
          {status}
        </p>
        {order.length > 0 && (
          <ol className="knockout-ties">
            {order.map(({ tie, index }, position) => {
              const conference = series ? (tie.conference ?? null) : null;
              const newConference =
                conference != null && conference !== order[position - 1]?.tie.conference;
              return (
                <Fragment key={tie.matchIds.join('-')}>
                  {newConference && (
                    <li className="knockout-conference">
                      Conferencia {CONFERENCE_LABELS[conference] ?? conference}
                    </li>
                  )}
                  <li className="knockout-tie">
                    {renderLegs(tie, index)}
                    <div className="knockout-tie-teams">
                      {renderTeam(tie, index, 'home')}
                      {renderTeam(tie, index, 'away')}
                    </div>
                    {series && renderGames(tie, index)}
                  </li>
                </Fragment>
              );
            })}
          </ol>
        )}
      </section>
    </div>
  );
}
