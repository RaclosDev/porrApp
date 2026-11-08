import { CalendarDays, Users } from 'lucide-react';
import type { FightMethod, MatchdayFixture } from '../../types/api';
import {
  formatMatchDate,
  isLiveFixture,
  withFightPick,
  type DraftPrediction,
} from '../../utils/matchday';
import {
  FIGHT_METHOD_LABELS,
  fightOutcomes,
  segmentLabel,
  weightClassLabel,
} from '../../utils/fights';
import { FightBadge, FightResultLine } from '../fight/FightResult';

interface FightCardProps {
  fixture: MatchdayFixture;
  prediction: DraftPrediction;
  /** La pelea o la liga están cerradas. */
  locked: boolean;
  onPick: (matchId: number, pick: DraftPrediction) => void;
  onShowFriends: (fixture: MatchdayFixture) => void;
}

const METHODS: FightMethod[] = ['KO_TKO', 'SUBMISSION', 'DECISION'];

/**
 * Pelea de una velada de la UFC: se elige quién gana y, si se quiere, cómo (KO/TKO, sumisión o
 * decisión) y en qué asalto acaba un KO/TKO o una sumisión. Al acabar muestra el resultado y los puntos.
 */
export default function FightCard({
  fixture,
  prediction,
  locked,
  onPick,
  onShowFriends,
}: FightCardProps) {
  const fight = fixture.fight!;
  const cancelled = fixture.status === 'CANCELLED';
  const fightName = `${fixture.homeTeam} vs. ${fixture.awayTeam}`;
  const sign = prediction.sign === '1' || prediction.sign === '2' ? prediction.sign : null;
  const method = (prediction.method || '') as FightMethod | '';
  const round = prediction.round || '';
  const rounds = Array.from({ length: fight.scheduledRounds ?? 3 }, (_, i) => String(i + 1));
  const finish = method === 'KO_TKO' || method === 'SUBMISSION';
  const points = fixture.pointsAwarded;
  const scored = points != null && points > 0;
  const inPlay = fixture.status === 'LIVE' || fixture.status === 'PAUSED';
  const showPoints =
    !cancelled && (fixture.finished || inPlay) && (points != null || fixture.finished);
  const corners = [
    {
      s: '1' as const,
      name: fixture.homeTeam,
      photo: fixture.homeTeamLogo,
      record: fight.homeRecord,
    },
    {
      s: '2' as const,
      name: fixture.awayTeam,
      photo: fixture.awayTeamLogo,
      record: fight.awayRecord,
    },
  ];
  const methodHit = fixture.finished && method !== '' && fight.resultMethod === method;
  const outcomes = cancelled ? null : fightOutcomes(fight, fixture.finished);

  const pick = (nextSign: '1' | '2', nextMethod: FightMethod | '' = method, nextRound = round) =>
    onPick(fixture.matchId, withFightPick(nextSign, nextMethod, nextRound));

  return (
    <div className={`md-match md-fight${locked ? ' is-locked' : ''}`}>
      <div className="md-match-top">
        <span className="inline-flex items-center gap-1.5">
          <CalendarDays size={12} aria-hidden="true" />
          {formatMatchDate(fixture.matchDate)}
          {!locked && fixture.lockAt && fixture.lockAt !== fixture.matchDate && (
            <span className="md-lock-at">· Cierra {formatMatchDate(fixture.lockAt)}</span>
          )}
        </span>
        <div className="md-match-status-actions">
          <button
            type="button"
            className="md-friends-btn"
            onClick={() => onShowFriends(fixture)}
            aria-label={`Ver predicciones de ${fightName}`}
            title="Ver predicciones de la liga"
          >
            <Users size={15} aria-hidden="true" />
          </button>
          {cancelled ? (
            <span className="md-badge is-cancelled">Cancelada</span>
          ) : fixture.finished ? (
            <span className="md-badge is-finished">Final</span>
          ) : isLiveFixture(fixture) ? (
            <span className="md-badge is-live">En juego</span>
          ) : fixture.awaitingTeams ? (
            <span className="md-badge is-pending">Por definir</span>
          ) : locked ? (
            <span className="md-badge is-locked" title={fixture.lockReason ?? undefined}>
              Cerrado
            </span>
          ) : (
            <span className="md-badge is-open">Abierto</span>
          )}
        </div>
      </div>

      <p className="md-fight-meta">
        <strong>{fight.order === 1 ? 'Pelea estelar' : segmentLabel(fight.segment)}</strong>
        {fight.weightClass && <span>{weightClassLabel(fight.weightClass)}</span>}
        {fight.scheduledRounds && <span>{fight.scheduledRounds} asaltos</span>}
      </p>

      <div
        className="md-signs md-survivor md-fight-corners"
        role="group"
        aria-label={`Quién gana ${fightName}`}
      >
        {corners.map(({ s, name, photo, record }) => {
          const isSelected = sign === s;
          const isResult = fixture.finished && fight.winner === s;
          return (
            <button
              key={s}
              type="button"
              disabled={locked}
              onClick={() => pick(s)}
              className={`md-sign-btn md-survivor-btn md-fight-corner${isSelected ? ' is-active' : ''}${isResult ? ' is-result' : ''}${isSelected && fixture.finished && !isResult ? ' is-miss' : ''}`}
              aria-pressed={isSelected}
              aria-label={`Gana ${name}${record ? ` (${record})` : ''}${isResult ? ', ganador' : ''}`}
            >
              {outcomes && <FightBadge outcome={s === '1' ? outcomes.home : outcomes.away} />}
              {photo ? (
                <img className="md-fight-photo" src={photo} alt="" loading="lazy" />
              ) : (
                <span className="md-fight-photo" aria-hidden="true" />
              )}
              <span className="md-survivor-team">{name}</span>
              {record && <span className="md-fight-record">{record}</span>}
            </button>
          );
        })}
      </div>

      {sign && !cancelled && (
        <>
          <p className="md-fight-label" id={`fight-method-${fixture.matchId}`}>
            Método {/* Con la pelea cerrada ya no se elige: el aviso sobra. */}
            {!locked && <span className="md-fight-optional">(opcional, suma más)</span>}
          </p>
          <div
            className="md-signs md-fight-options"
            role="group"
            aria-labelledby={`fight-method-${fixture.matchId}`}
          >
            {METHODS.map((m) => {
              const isSelected = method === m;
              const isResult = fixture.finished && fight.resultMethod === m;
              return (
                <button
                  key={m}
                  type="button"
                  disabled={locked}
                  onClick={() => pick(sign, isSelected ? '' : m, isSelected ? '' : round)}
                  className={`md-sign-btn${isSelected ? ' is-active' : ''}${isResult ? ' is-result' : ''}${isSelected && fixture.finished && !isResult ? ' is-miss' : ''}`}
                  aria-pressed={isSelected}
                >
                  {FIGHT_METHOD_LABELS[m]}
                </button>
              );
            })}
          </div>
          {finish && (
            <>
              <p className="md-fight-label" id={`fight-round-${fixture.matchId}`}>
                Asalto {!locked && <span className="md-fight-optional">(opcional)</span>}
              </p>
              <div
                className="md-signs md-fight-options md-fight-rounds"
                role="group"
                aria-labelledby={`fight-round-${fixture.matchId}`}
                style={{ gridTemplateColumns: `repeat(${rounds.length}, minmax(0, 1fr))` }}
              >
                {rounds.map((r) => {
                  const isSelected = round === r;
                  const isResult = methodHit && String(fight.resultRound) === r;
                  return (
                    <button
                      key={r}
                      type="button"
                      disabled={locked}
                      onClick={() => pick(sign, method, isSelected ? '' : r)}
                      className={`md-sign-btn${isSelected ? ' is-active' : ''}${isResult ? ' is-result' : ''}${isSelected && methodHit && !isResult ? ' is-miss' : ''}`}
                      aria-pressed={isSelected}
                      aria-label={`Asalto ${r}`}
                    >
                      {r}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}

      {cancelled || (fixture.awaitingTeams && !fixture.finished) ? (
        <p className="md-fight-result">{fixture.lockReason}</p>
      ) : (
        fixture.finished && <FightResultLine fight={fight} className="md-fight-outcome" />
      )}

      {showPoints && (
        <div
          className={`mt-2.5 py-2 px-3 rounded-[8px] flex items-center justify-between gap-2 text-[0.85rem] ${scored ? 'bg-[rgba(21,_128,_61,_0.08)] bg-none' : 'bg-[rgba(17,_24,_39,_0.04)] bg-none'} ${scored ? 'border border-[var(--hit)]' : 'border border-line'}`}
        >
          <span className={`${scored ? 'text-[var(--hit)]' : 'text-muted'}`}>
            {fixture.finished ? (scored ? '✓ ' : '✗ ') : 'Provisional · '}
            {points == null
              ? 'Sin predicción'
              : fixture.scoringDetails || (scored ? 'Predicción acertada' : 'Fallada')}
          </span>
          <span
            className={`font-extrabold text-[0.95rem] shrink-0 ${scored ? 'text-[var(--hit)]' : 'text-muted'}`}
          >
            {scored ? `+${points}` : '0'} pts
          </span>
        </div>
      )}
    </div>
  );
}
