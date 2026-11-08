import Flag from '../Flag';
import { CalendarDays, Users } from 'lucide-react';
import SignVoters from '../voters/SignVoters';
import type { MatchdayFixture, MatchVoters } from '../../types/api';
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
  onQuickSign: (matchId: number, sign: MatchSign) => void;
  onShowFriends: (fixture: MatchdayFixture) => void;
  /** Quién ha votado cada signo; solo llega cuando el partido está cerrado. */
  voters?: MatchVoters;
  onShowVoters?: (fixture: MatchdayFixture) => void;
  /** Liga superviviente: se elige un equipo que gane en vez de un signo 1X2. */
  survivor?: SurvivorOptions;
}

export interface SurvivorOptions {
  /** Equipos ya usados en otras jornadas, con la jornada en que se eligieron. */
  usedTeams: Map<number, string>;
  /** Eliminado: ya no puede elegir. */
  eliminated: boolean;
  onPick: (matchId: number, sign: '1' | '2') => void;
}

const SIGNS: MatchSign[] = ['1', 'X', '2'];
const CREST_STYLE = { width: '24px', height: '24px' };

/** Tarjeta de un partido: estado, signo 1X2 pronosticado y puntos obtenidos. */
export default function FixtureCard({
  fixture,
  prediction,
  locked,
  onQuickSign,
  onShowFriends,
  voters,
  onShowVoters,
  survivor,
}: FixtureCardProps) {
  const inputDisabled = locked;
  const teams = [
    { side: 'home', team: fixture.homeTeam, logo: fixture.homeTeamLogo },
    { side: 'away', team: fixture.awayTeam, logo: fixture.awayTeamLogo },
  ] as const;
  const matchName = `${fixture.homeTeam} - ${fixture.awayTeam}`;
  const points = fixture.pointsAwarded;
  const scored = points != null && points > 0;
  const { actualHomeScore: home, actualAwayScore: away } = fixture;
  const resultSign: MatchSign | null =
    fixture.finished && home != null && away != null
      ? home > away
        ? '1'
        : home === away
          ? 'X'
          : '2'
      : null;
  const inPlay = fixture.status === 'LIVE' || fixture.status === 'PAUSED';
  // Terminado sin predicción: también se dice que no suma, para que cada partido cerrado tenga su balance.
  // En superviviente solo se juega un partido por jornada: los demás no tienen balance que mostrar.
  const showPoints = survivor
    ? (fixture.finished || inPlay) && points != null
    : (fixture.finished || inPlay) && (points != null || fixture.finished);

  return (
    <div className={`md-match${locked ? ' is-locked' : ''}`}>
      {fixture.competitionName && <p className="md-match-competition">{fixture.competitionName}</p>}
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
            aria-label={`Ver predicciones de ${matchName}`}
            title="Ver predicciones de la liga"
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

      {survivor ? (
        <SurvivorPick
          fixture={fixture}
          sign={prediction.sign}
          resultSign={resultSign}
          locked={inputDisabled}
          options={survivor}
        />
      ) : (
        <div className="md-signs" role="group" aria-label={`Predicción de ${matchName}`}>
          {SIGNS.map((s) => {
            const isSelected = prediction.sign === s;
            const isResult = resultSign === s;
            return (
              <button
                key={s}
                type="button"
                disabled={inputDisabled}
                onClick={() => onQuickSign(fixture.matchId, s)}
                className={`md-sign-btn${isSelected ? ' is-active' : ''}${isResult ? ' is-result' : ''}${isSelected && resultSign && !isResult ? ' is-miss' : ''}`}
                aria-label={`Predecir ${s} en ${matchName}${isResult ? ' (resultado final)' : ''}`}
                aria-pressed={isSelected}
              >
                {s}
              </button>
            );
          })}
        </div>
      )}
      {voters && onShowVoters && (
        <SignVoters voters={voters} matchName={matchName} onOpen={() => onShowVoters(fixture)} />
      )}

      {/* Desglose de puntos si el partido ya ha finalizado */}
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
          {!survivor && (
            <span
              className={`font-extrabold text-[0.95rem] shrink-0 ${scored ? 'text-[var(--hit)]' : 'text-muted'}`}
            >
              {scored ? `+${points}` : '0'} pts
            </span>
          )}
        </div>
      )}
    </div>
  );
}

interface SurvivorPickProps {
  fixture: MatchdayFixture;
  sign: string;
  resultSign: MatchSign | null;
  locked: boolean;
  options: SurvivorOptions;
}

/** Superviviente: un botón por equipo para elegir quién gana. Sin empate. */
function SurvivorPick({ fixture, sign, resultSign, locked, options }: SurvivorPickProps) {
  const sides = [
    { s: '1' as const, team: fixture.homeTeam, teamId: fixture.homeTeamId },
    { s: '2' as const, team: fixture.awayTeam, teamId: fixture.awayTeamId },
  ];
  return (
    <div
      className="md-signs md-survivor"
      role="group"
      aria-label={`Elige quién gana: ${fixture.homeTeam} o ${fixture.awayTeam}`}
    >
      {sides.map(({ s, team, teamId }) => {
        const isSelected = sign === s;
        const usedIn = teamId != null ? options.usedTeams.get(teamId) : undefined;
        const isResult = resultSign === s;
        const disabled = locked || options.eliminated || (Boolean(usedIn) && !isSelected);
        return (
          <button
            key={s}
            type="button"
            disabled={disabled}
            onClick={() => options.onPick(fixture.matchId, s)}
            className={`md-sign-btn md-survivor-btn${isSelected ? ' is-active' : ''}${isResult ? ' is-result' : ''}${isSelected && resultSign && !isResult ? ' is-miss' : ''}`}
            aria-pressed={isSelected}
            title={usedIn ? `Ya lo elegiste en ${usedIn}` : undefined}
          >
            <span className="md-survivor-team">Gana {team}</span>
            {usedIn && !isSelected && <span className="md-survivor-used">Usado en {usedIn}</span>}
          </button>
        );
      })}
    </div>
  );
}
