import Flag from '../Flag';
import { CalendarDays, Users } from 'lucide-react';
import SignVoters from '../voters/SignVoters';
import type { MatchdayFixture, MatchVoters } from '../../types/api';
import {
  allowsDraw,
  resultNote,
  formatMatchDate,
  isLiveFixture,
  liveLabel,
  tennisLoserSets,
  tennisPick,
  tennisPickedLoserSets,
  tennisPickedSign,
  type DraftPrediction,
  type MatchSign,
} from '../../utils/matchday';
import { parseTennisScore, tennisEndingLabel } from '../../utils/tennisScore';

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
  /** Tenis: se elige quién gana y, si se quiere, los sets. */
  onTennisPick?: (matchId: number, prediction: DraftPrediction) => void;
}

export interface SurvivorOptions {
  /** Equipos ya usados en otras jornadas, con la jornada en que se eligieron. */
  usedTeams: Map<number, string>;
  /** Eliminado: ya no puede elegir. */
  eliminated: boolean;
  onPick: (matchId: number, sign: '1' | '2') => void;
}

const SIGNS: MatchSign[] = ['1', 'X', '2'];
/** Sin empate (NFL): se elige quién gana. */
const WINNER_SIGNS: MatchSign[] = ['1', '2'];
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
  onTennisPick,
}: FixtureCardProps) {
  const tennisSets = onTennisPick && fixture.setsToWin ? fixture.setsToWin : null;
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
    tennisSets && fixture.finished && fixture.winnerSign
      ? fixture.winnerSign
      : fixture.finished && home != null && away != null
        ? home > away
          ? '1'
          : home === away
            ? 'X'
            : '2'
        : null;
  const inPlay = fixture.status === 'LIVE' || fixture.status === 'PAUSED';
  const winnerOnly = !allowsDraw(fixture.sport);
  const note = fixture.finished ? resultNote(fixture.displayClock) : null;
  // Tenis: los juegos de cada set y, si no se jugó entero, cómo acabó (retirada, W.O.).
  const tennisScore = tennisSets ? parseTennisScore(fixture.displayClock) : null;
  const tennisEnding = tennisEndingLabel(tennisScore);
  const tennisGames = tennisScore && tennisScore.sets.length > 0 ? tennisScore.sets : null;
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
              {tennisScore
                ? tennisEnding
                  ? `Final · ${tennisEnding}`
                  : 'Final'
                : home != null && away != null
                  ? `Final ${home} - ${away}${note ? ` · ${note}` : ''}`
                  : tennisSets
                    ? 'Final · retirada o W.O.'
                    : 'Final'}
            </span>
          ) : isLiveFixture(fixture) ? (
            <span className="md-badge is-live">
              {tennisGames
                ? 'En juego'
                : tennisSets && home != null && away != null
                  ? `En juego · ${home}-${away}`
                  : liveLabel(fixture.displayClock)}
            </span>
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

      <div className="md-team-rows">
        {teams.map(({ side, team, logo }) => (
          <div key={side} className="md-team-row">
            <span className="md-crest">
              <Flag team={team} logo={logo} style={CREST_STYLE} />
            </span>
            <span
              className={`md-team-name${
                tennisSets && resultSign && resultSign !== (side === 'home' ? '1' : '2')
                  ? ' is-loser'
                  : ''
              }`}
            >
              {team}
            </span>
            {tennisGames && (
              <span className="md-set-games" aria-label={`Juegos de ${team} por set`}>
                {tennisGames.map((set, index) => {
                  const own = side === 'home' ? set.home : set.away;
                  const rival = side === 'home' ? set.away : set.home;
                  return (
                    <span key={index} className={`md-set-game${own > rival ? ' is-won' : ''}`}>
                      {own}
                      {set.tiebreak != null && own < rival && <sup>{set.tiebreak}</sup>}
                    </span>
                  );
                })}
              </span>
            )}
          </div>
        ))}
      </div>
      {fixture.awaitingTeams && !fixture.finished && (
        <p className="md-match-note">
          {fixture.lockReason ?? 'Se abre cuando se conozcan los dos equipos'}
        </p>
      )}

      {tennisSets && onTennisPick ? (
        <TennisPick
          fixture={fixture}
          setsToWin={tennisSets}
          prediction={prediction}
          resultSign={resultSign}
          locked={inputDisabled}
          onPick={(next) => onTennisPick(fixture.matchId, next)}
        />
      ) : survivor ? (
        <SurvivorPick
          fixture={fixture}
          sign={prediction.sign}
          resultSign={resultSign}
          locked={inputDisabled}
          options={survivor}
        />
      ) : (
        <div
          className={`md-signs${winnerOnly ? ' md-survivor' : ''}`}
          role="group"
          aria-label={`Predicción de ${matchName}`}
        >
          {(winnerOnly ? WINNER_SIGNS : SIGNS).map((s) => {
            const isSelected = prediction.sign === s;
            const isResult = resultSign === s;
            const winner = s === '1' ? fixture.homeTeam : fixture.awayTeam;
            return (
              <button
                key={s}
                type="button"
                disabled={inputDisabled}
                onClick={() => onQuickSign(fixture.matchId, s)}
                className={`md-sign-btn${winnerOnly ? ' md-survivor-btn' : ''}${isSelected ? ' is-active' : ''}${isResult ? ' is-result' : ''}${isSelected && resultSign && !isResult ? ' is-miss' : ''}`}
                aria-label={`${winnerOnly ? `Predecir que gana ${winner}` : `Predecir ${s}`} en ${matchName}${isResult ? ' (resultado final)' : ''}`}
                aria-pressed={isSelected}
              >
                {winnerOnly ? <span className="md-survivor-team">Gana {winner}</span> : s}
              </button>
            );
          })}
        </div>
      )}
      {voters && onShowVoters && (
        <SignVoters
          voters={voters}
          matchName={matchName}
          onOpen={() => onShowVoters(fixture)}
          twoWay={winnerOnly}
        />
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

interface TennisPickProps {
  fixture: MatchdayFixture;
  setsToWin: number;
  prediction: DraftPrediction;
  resultSign: MatchSign | null;
  locked: boolean;
  onPick: (prediction: DraftPrediction) => void;
}

/**
 * Tenis: un botón por jugador para elegir quién gana y, debajo, los sets (opcionales). Volver a
 * pulsar los sets elegidos los quita y deja solo el ganador.
 */
function TennisPick({
  fixture,
  setsToWin,
  prediction,
  resultSign,
  locked,
  onPick,
}: TennisPickProps) {
  const sign = tennisPickedSign(prediction);
  const loserSets = tennisPickedLoserSets(prediction);
  const sides = [
    { s: '1' as const, player: fixture.homeTeam },
    { s: '2' as const, player: fixture.awayTeam },
  ];
  const { actualHomeScore: home, actualAwayScore: away } = fixture;
  const resultLoserSets =
    fixture.finished && home != null && away != null ? Math.min(home, away) : null;
  const winnerName = sign === '1' ? fixture.homeTeam : sign === '2' ? fixture.awayTeam : null;
  return (
    <>
      <div
        className="md-signs md-survivor"
        role="group"
        aria-label={`Quién gana: ${fixture.homeTeam} o ${fixture.awayTeam}`}
      >
        {sides.map(({ s, player }) => {
          const isSelected = sign === s;
          const isResult = resultSign === s;
          return (
            <button
              key={s}
              type="button"
              disabled={locked}
              onClick={() => onPick(tennisPick(s, setsToWin, isSelected ? loserSets : null))}
              className={`md-sign-btn md-survivor-btn${isSelected ? ' is-active' : ''}${isResult ? ' is-result' : ''}${isSelected && resultSign && !isResult ? ' is-miss' : ''}`}
              aria-pressed={isSelected}
            >
              <span className="md-survivor-team">Gana {player}</span>
            </button>
          );
        })}
      </div>
      {sign && winnerName && (
        <div className="md-sets" role="group" aria-label={`En cuántos sets gana ${winnerName}`}>
          <span className="md-sets-label">Sets</span>
          {tennisLoserSets(setsToWin).map((lost) => {
            const isSelected = loserSets === lost;
            const isResult = resultSign === sign && resultLoserSets === lost;
            return (
              <button
                key={lost}
                type="button"
                disabled={locked}
                onClick={() => onPick(tennisPick(sign, setsToWin, isSelected ? null : lost))}
                className={`md-sign-btn${isSelected ? ' is-active' : ''}${isResult ? ' is-result' : ''}`}
                aria-pressed={isSelected}
                aria-label={`${winnerName} gana ${setsToWin}-${lost}`}
              >
                {setsToWin}-{lost}
              </button>
            );
          })}
        </div>
      )}
    </>
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
