import { useId, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import PaperLoading from '../PaperLoading';
import { useAppContext } from '../../context/AppContext';
import { useMatchdayStats } from '../../hooks/useMatchdayStats';
import { fetchMatchdayFixtures } from '../../services/api';
import { leaderboardMatchdaysQuery } from '../../services/queries';
import { queryKeys } from '../../services/queryKeys';
import type { MatchStats, MatchdayFixture } from '../../types/api';
import {
  displayRoundLabel,
  formatMatchDate,
  hasLiveMatch,
  isLiveFixture,
  resolveRound,
  roundsFromMatchdays,
} from '../../utils/matchday';
import {
  boutBilling,
  fightOutcomes,
  methodRoundText,
  segmentLabel,
  weightClassLabel,
  type FightOutcome,
} from '../../utils/fights';
import { FightBadge, FightJudgesLine, FightResultLine, FightTitleTag } from '../fight/FightResult';
import {
  cardSummary,
  groupCard,
  leagueSplit,
  recordLabel,
  type CardSummary,
} from '../../utils/fightCard';

const EMPTY: MatchdayFixture[] = [];

function Fighter({
  name,
  photo,
  record,
  corner,
  outcome,
}: {
  name: string;
  photo: string | null;
  record: string | null | undefined;
  corner: 'red' | 'blue';
  /** W, L, D o NC al acabar; null antes. */
  outcome: FightOutcome | null;
}) {
  return (
    <div
      className={`ufc-fighter is-${corner}${outcome === 'W' ? ' is-winner' : ''}${outcome === 'L' ? ' is-loser' : ''}`}
    >
      {photo ? (
        <img className="ufc-fighter-photo" src={photo} alt="" loading="lazy" />
      ) : (
        <span className="ufc-fighter-photo" aria-hidden="true">
          {name.trim().charAt(0).toLocaleUpperCase('es')}
        </span>
      )}
      <span className="ufc-fighter-copy">
        <span className="ufc-fighter-name">
          {name}
          {outcome && <FightBadge outcome={outcome} size="sm" />}
        </span>
        {record && (
          <span className="ufc-fighter-record">
            <span aria-hidden="true">{record}</span>
            <span className="sr-only">Récord: {recordLabel(record)}</span>
          </span>
        )}
      </span>
    </div>
  );
}

function LeagueSplitBar({ fixture, stats }: { fixture: MatchdayFixture; stats?: MatchStats }) {
  const split = leagueSplit(stats);
  if (!split) {
    return fixture.locked || fixture.finished ? null : (
      <p className="ufc-bout-note">
        Lo que ha elegido la liga se verá cuando se cierre la predicción.
      </p>
    );
  }
  if (split.total === 0) return null;
  return (
    <div className="ufc-split">
      <p className="ufc-split-title">
        La liga <span>· {split.total === 1 ? '1 predicción' : `${split.total} predicciones`}</span>
      </p>
      <div className="ufc-split-bar" aria-hidden="true">
        {split.red > 0 && <span className="is-red" style={{ width: `${split.redPercent}%` }} />}
        {split.blue > 0 && <span className="is-blue" style={{ width: `${split.bluePercent}%` }} />}
      </div>
      <p className="ufc-split-legend">
        <span>
          <strong>{split.redPercent} %</strong> {fixture.homeTeam}
        </span>
        <span>
          {fixture.awayTeam} <strong>{split.bluePercent} %</strong>
        </span>
      </p>
      {split.topMethod && (
        <p className="ufc-bout-note">
          Método favorito: <strong>{split.topMethod.label}</strong> ({split.topMethod.percent} %)
        </p>
      )}
      {stats?.signHits != null && (
        <p className="ufc-bout-note">
          Acertaron el ganador <strong>{stats.signHits}</strong> de {split.total}.
        </p>
      )}
    </div>
  );
}

function OwnPick({ fixture }: { fixture: MatchdayFixture }) {
  const sign = fixture.predSign === '1' || fixture.predSign === '2' ? fixture.predSign : null;
  if (fixture.status === 'CANCELLED') return null;
  if (!sign) {
    return fixture.locked || fixture.finished ? (
      <p className="ufc-own is-empty">No hiciste tu predicción.</p>
    ) : (
      <p className="ufc-own is-empty">
        Aún no has hecho tu predicción.{' '}
        <Link to="/jornadas" className="standings-link">
          Hacerla →
        </Link>
      </p>
    );
  }
  const name = sign === '1' ? fixture.homeTeam : fixture.awayTeam;
  const extra = methodRoundText(fixture.predMethod, fixture.predRound);
  const points = fixture.pointsAwarded;
  const outcome =
    fixture.finished && fixture.fight?.winner
      ? fixture.fight.winner === sign
        ? 'hit'
        : 'miss'
      : '';
  return (
    <p className={`ufc-own${outcome ? ` is-${outcome}` : ''}`}>
      Tu predicción: <strong>{name}</strong>
      {extra && ` · ${extra}`}
      {points != null && (
        <span className="ufc-own-points">
          {points > 0 ? `+${points}` : points} {points === 1 ? 'punto' : 'puntos'}
        </span>
      )}
    </p>
  );
}

function Bout({ fixture, stats }: { fixture: MatchdayFixture; stats?: MatchStats }) {
  const fight = fixture.fight!;
  const cancelled = fixture.status === 'CANCELLED';
  const outcomes = cancelled ? null : fightOutcomes(fight, fixture.finished);
  const status = cancelled
    ? 'Cancelada'
    : fixture.finished
      ? 'Final'
      : isLiveFixture(fixture)
        ? 'En juego'
        : formatMatchDate(fixture.matchDate);

  return (
    <li>
      <article
        className={`ufc-bout${fight.order === 1 ? ' is-main-event' : ''}${cancelled ? ' is-cancelled' : ''}`}
        aria-label={`${fixture.homeTeam} contra ${fixture.awayTeam}`}
      >
        <div className="ufc-bout-top">
          <p className="ufc-bout-meta">
            {boutBilling(fight) && <strong>{boutBilling(fight)}</strong>}
            <FightTitleTag fight={fight} />
            {fight.weightClass && <span>{weightClassLabel(fight.weightClass)}</span>}
            {fight.scheduledRounds && <span>{fight.scheduledRounds} asaltos</span>}
          </p>
          <span
            className={`ufc-bout-status${isLiveFixture(fixture) ? ' is-live' : ''}${cancelled ? ' is-cancelled' : ''}`}
          >
            {status}
          </span>
        </div>

        <div className="ufc-bout-corners">
          <Fighter
            name={fixture.homeTeam}
            photo={fixture.homeTeamLogo}
            record={fight.homeRecord}
            corner="red"
            outcome={outcomes?.home ?? null}
          />
          <span className="ufc-bout-vs" aria-hidden="true">
            vs
          </span>
          <Fighter
            name={fixture.awayTeam}
            photo={fixture.awayTeamLogo}
            record={fight.awayRecord}
            corner="blue"
            outcome={outcomes?.away ?? null}
          />
        </div>

        {outcomes && <FightResultLine fight={fight} className="ufc-bout-result" />}
        {outcomes && <FightJudgesLine fight={fight} />}
        {!cancelled && <LeagueSplitBar fixture={fixture} stats={stats} />}
        <OwnPick fixture={fixture} />
      </article>
    </li>
  );
}

function Summary({ summary }: { summary: CardSummary }) {
  const items = [
    { label: 'Peleas', value: String(summary.fights) },
    { label: 'Terminadas', value: String(summary.finished) },
    {
      label: 'Tus aciertos',
      value: summary.predicted ? `${summary.hits} de ${summary.predicted}` : '—',
    },
    { label: 'Tus puntos', value: String(summary.points) },
  ];
  return (
    <dl className="ufc-summary">
      {items.map((item) => (
        <div key={item.label}>
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * La pestaña Tabla de una liga de la UFC: la cartelera de una velada por bloques, con el récord de
 * cada luchador, cómo acabó cada pelea, qué eligió la liga (cuando ya se puede ver) y tu predicción.
 */
export default function UfcCardBoard() {
  const { activeGroupId, activeCompetitionName, userId, userName } = useAppContext();
  const [selected, setSelected] = useState<string | null>(null);
  const selectId = useId();
  const groupId = activeGroupId ?? '';

  const matchdaysQuery = useQuery({
    ...leaderboardMatchdaysQuery(groupId),
    enabled: Boolean(activeGroupId),
  });
  const roundList = useMemo(
    () => roundsFromMatchdays(matchdaysQuery.data ?? []),
    [matchdaysQuery.data],
  );
  const round = resolveRound(selected, roundList);
  const rounds = roundList.rounds;
  const index = round ? rounds.indexOf(round) : -1;

  const fixturesQuery = useQuery({
    // La misma clave que la pestaña Jornadas: comparten caché y lo que la refresca refresca esto.
    queryKey: queryKeys.matchdayFixtures(groupId, userId || userName, round ?? ''),
    queryFn: () => fetchMatchdayFixtures(groupId, round ?? ''),
    enabled: Boolean(activeGroupId && round),
    refetchInterval: (query) => (hasLiveMatch(query.state.data) ? 30_000 : false),
  });
  const fixtures = fixturesQuery.data ?? EMPTY;
  const { data: stats } = useMatchdayStats(activeGroupId);

  const segments = useMemo(() => groupCard(fixtures), [fixtures]);
  const summary = useMemo(() => cardSummary(fixtures), [fixtures]);
  const statsById = useMemo(
    () => new Map((stats?.matches ?? []).map((m) => [m.matchId, m])),
    [stats],
  );

  const loading = matchdaysQuery.isPending || (round != null && fixturesQuery.isPending);
  const failed = matchdaysQuery.isError || fixturesQuery.isError;

  return (
    <section className="standings-page paper-panel album-sheet ufc-card-page">
      <header className="standings-head">
        <div className="standings-head-copy">
          <span className="standings-eyebrow">Cartelera</span>
          <h1 className="standings-title">
            {round ? displayRoundLabel(round) : activeCompetitionName || 'UFC'}
          </h1>
        </div>

        {rounds.length > 1 && round && (
          <div className="ufc-round-picker">
            <button
              type="button"
              className="ufc-round-step"
              onClick={() => setSelected(rounds[index - 1])}
              disabled={index <= 0}
              aria-label="Velada anterior"
            >
              <ChevronLeft size={18} aria-hidden="true" />
            </button>
            <label htmlFor={selectId} className="sr-only">
              Velada
            </label>
            <select
              id={selectId}
              className="glass-input ufc-round-select"
              value={round}
              onChange={(e) => setSelected(e.target.value)}
            >
              {rounds.map((r) => (
                <option key={r} value={r}>
                  {displayRoundLabel(r)}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="ufc-round-step"
              onClick={() => setSelected(rounds[index + 1])}
              disabled={index < 0 || index >= rounds.length - 1}
              aria-label="Velada siguiente"
            >
              <ChevronRight size={18} aria-hidden="true" />
            </button>
          </div>
        )}
      </header>

      {loading ? (
        <PaperLoading label="Cargando la cartelera" embedded />
      ) : failed ? (
        <div className="standings-empty" role="alert">
          <p>No se pudo cargar la cartelera. Inténtalo de nuevo.</p>
          <button
            type="button"
            className="glass-btn"
            onClick={() => {
              void matchdaysQuery.refetch();
              void fixturesQuery.refetch();
            }}
          >
            Reintentar
          </button>
        </div>
      ) : segments.length === 0 ? (
        <div className="paper-panel album-sheet landing-tape standings-empty">
          <p className="standings-empty-title">Esta liga aún no tiene peleas.</p>
          <p className="standings-empty-copy">
            La cartelera aparecerá en cuanto se anuncie la próxima velada.
          </p>
        </div>
      ) : (
        <>
          <Summary summary={summary} />
          {segments.map(({ segment, fights }) => (
            <section key={segment} className="ufc-segment" aria-label={segmentLabel(segment)}>
              <h2 className="ufc-segment-title">{segmentLabel(segment)}</h2>
              <ol className="ufc-bouts">
                {fights.map((fixture) => (
                  <Bout
                    key={fixture.matchId}
                    fixture={fixture}
                    stats={statsById.get(fixture.matchId)}
                  />
                ))}
              </ol>
            </section>
          ))}
        </>
      )}
    </section>
  );
}
