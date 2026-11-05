import Flag from '../Flag';
import { CalendarDays, Users } from 'lucide-react';
import type { MatchdayFixture } from '../../types/api';
import {
  formatMatchDate,
  isLiveFixture,
  type DraftPrediction,
  type MatchSign,
} from '../../utils/matchday';

interface FixtureCardProps {
  fixture: MatchdayFixture;
  prediction: DraftPrediction;
  /** El partido o la porra están cerrados. */
  locked: boolean;
  /** Mientras se guarda no se puede editar. */
  disabled: boolean;
  onQuickSign: (matchId: number, sign: MatchSign) => void;
  onShowFriends: (fixture: MatchdayFixture) => void;
}

const SIGNS: MatchSign[] = ['1', 'X', '2'];
const CREST_STYLE = { width: '24px', height: '24px' };

/** Tarjeta de un partido: estado, signo 1X2 pronosticado y puntos obtenidos. */
export default function FixtureCard({
  fixture,
  prediction,
  locked,
  disabled,
  onQuickSign,
  onShowFriends,
}: FixtureCardProps) {
  const inputDisabled = locked || disabled;
  const teams = [
    { side: 'home', team: fixture.homeTeam, logo: fixture.homeTeamLogo },
    { side: 'away', team: fixture.awayTeam, logo: fixture.awayTeamLogo },
  ] as const;
  const matchName = `${fixture.homeTeam} - ${fixture.awayTeam}`;
  const points = fixture.pointsAwarded;
  const scored = points != null && points > 0;

  return (
    <div className={`md-match${locked ? ' is-locked' : ''}`}>
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
            aria-label={`Ver pronósticos de ${matchName}`}
            title="Ver pronósticos de la liga"
          >
            <Users size={15} aria-hidden="true" />
          </button>
          {fixture.finished ? (
            <span className="md-badge is-finished">
              Final {fixture.actualHomeScore} - {fixture.actualAwayScore}
            </span>
          ) : isLiveFixture(fixture) ? (
            <span className="md-badge is-live">En juego</span>
          ) : locked ? (
            <span className="md-badge is-locked" title={fixture.lockReason ?? undefined}>
              Cerrado
            </span>
          ) : (
            <span className="md-badge is-open">Abierto</span>
          )}
        </div>
      </div>

      <div className="md-team-rows">
        {teams.map(({ side, team, logo }) => (
          <div key={side} className="md-team-row">
            <span className="md-crest">
              <Flag team={team} logo={logo} style={CREST_STYLE} />
            </span>
            <span className="md-team-name">{team}</span>
          </div>
        ))}
      </div>

      <div className="md-signs" role="group" aria-label={`Pronóstico de ${matchName}`}>
        {SIGNS.map((s) => {
          const isSelected = prediction.sign === s;
          return (
            <button
              key={s}
              type="button"
              disabled={inputDisabled}
              onClick={() => onQuickSign(fixture.matchId, s)}
              className={`md-sign-btn${isSelected ? ' is-active' : ''}`}
              aria-label={`Pronosticar ${s} en ${matchName}`}
              aria-pressed={isSelected}
            >
              {s}
            </button>
          );
        })}
      </div>

      {/* Desglose de puntos si el partido ya ha finalizado */}
      {(fixture.finished || fixture.status === 'LIVE' || fixture.status === 'PAUSED') &&
        points !== null &&
        points !== undefined && (
          <div
            className={`mt-2.5 py-2 px-3 rounded-[8px] flex items-center justify-between gap-2 text-[0.85rem] ${scored ? 'bg-[rgba(21,_128,_61,_0.08)] bg-none' : 'bg-[rgba(17,_24,_39,_0.04)] bg-none'} ${scored ? 'border border-[var(--hit)]' : 'border border-line'}`}
          >
            <span className={`${scored ? 'text-[var(--hit)]' : 'text-muted'}`}>
              {fixture.finished ? '' : 'Provisional · '}
              {fixture.scoringDetails || (scored ? 'Acierto en pronóstico' : 'Sin puntos')}
            </span>
            <span
              className={`font-extrabold text-[0.95rem] shrink-0 ${scored ? 'text-[var(--hit)]' : 'text-muted'}`}
            >
              +{points} pts
            </span>
          </div>
        )}
    </div>
  );
}
