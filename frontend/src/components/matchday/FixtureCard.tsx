import Flag from '../Flag';
import type { MatchdayFixture } from '../../types/api';
import { formatMatchDate, type DraftPrediction, type MatchSign } from '../../utils/matchday';

interface FixtureCardProps {
  fixture: MatchdayFixture;
  prediction: DraftPrediction;
  /** El partido o la porra están cerrados. */
  locked: boolean;
  /** Mientras se guarda no se puede editar. */
  disabled: boolean;
  onScoreChange: (matchId: number, side: 'home' | 'away', value: string) => void;
  onQuickSign: (matchId: number, sign: MatchSign) => void;
  onShowFriends: (fixture: MatchdayFixture) => void;
}

const SIGNS: MatchSign[] = ['1', 'X', '2'];
const CREST_STYLE = { width: '24px', height: '24px' };

/** Tarjeta de un partido: estado, marcador pronosticado, signo 1X2 y puntos obtenidos. */
export default function FixtureCard({
  fixture,
  prediction,
  locked,
  disabled,
  onScoreChange,
  onQuickSign,
  onShowFriends,
}: FixtureCardProps) {
  const inputDisabled = locked || disabled;
  const teams = [
    {
      side: 'home',
      team: fixture.homeTeam,
      logo: fixture.homeTeamLogo,
      score: prediction.homeScore,
    },
    {
      side: 'away',
      team: fixture.awayTeam,
      logo: fixture.awayTeamLogo,
      score: prediction.awayScore,
    },
  ] as const;
  const points = fixture.pointsAwarded;
  const scored = points != null && points > 0;

  return (
    <div className={`md-match${locked ? ' is-locked' : ''}`}>
      <div className="md-match-top">
        <span>📅 {formatMatchDate(fixture.matchDate)}</span>
        <div className="md-match-status-actions">
          <button
            type="button"
            className="md-predictions-btn md-predictions-icon-btn"
            onClick={() => onShowFriends(fixture)}
            aria-label={`Ver pronósticos de ${fixture.homeTeam} vs ${fixture.awayTeam}`}
            title="Ver pronósticos de amigos"
          >
            <span aria-hidden="true">👥</span>
          </button>
          {fixture.finished ? (
            <span className="md-badge is-finished">
              Final {fixture.actualHomeScore} - {fixture.actualAwayScore}
            </span>
          ) : locked ? (
            <span className="md-badge is-locked" title={fixture.lockReason ?? undefined}>
              🔒 Bloqueado
            </span>
          ) : (
            <span className="md-badge is-open">⏱️ Abierto</span>
          )}
        </div>
      </div>

      <div className="md-team-rows">
        {teams.map(({ side, team, logo, score }) => (
          <div key={side} className="md-team-row">
            <span className="md-crest">
              <Flag team={team} logo={logo} style={CREST_STYLE} />
            </span>
            <span className="md-team-name">{team}</span>
            <input
              type="number"
              min="0"
              max="99"
              inputMode="numeric"
              aria-label={`Goles de ${team}`}
              disabled={inputDisabled}
              value={score}
              onChange={(e) => onScoreChange(fixture.matchId, side, e.target.value)}
              placeholder="-"
              className="md-score-input"
            />
          </div>
        ))}
      </div>

      <div className="md-signs">
        {SIGNS.map((s) => {
          const isSelected = prediction.sign === s;
          return (
            <button
              key={s}
              type="button"
              disabled={inputDisabled}
              onClick={() => onQuickSign(fixture.matchId, s)}
              className={`md-sign-btn${isSelected ? ' is-active' : ''}`}
              aria-label={`Pronosticar signo ${s}`}
              aria-pressed={isSelected}
            >
              {s}
            </button>
          );
        })}
      </div>

      {/* Desglose de puntos si el partido ya ha finalizado */}
      {fixture.finished && points !== null && points !== undefined && (
        <div
          className={`mt-2.5 py-2 px-3 rounded-[8px] flex items-center justify-between gap-2 text-[0.85rem] ${scored ? 'bg-[rgba(21,_128,_61,_0.08)] bg-none' : 'bg-[rgba(17,_24,_39,_0.04)] bg-none'} ${scored ? 'border border-[var(--hit)]' : 'border border-line'}`}
        >
          <span className={`${scored ? 'text-[var(--hit)]' : 'text-muted'}`}>
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
