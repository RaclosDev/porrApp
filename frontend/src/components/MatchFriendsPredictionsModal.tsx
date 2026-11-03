import { createPortal } from 'react-dom';
import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchMatchdayFriendPredictions } from '../services/api';
import { UserAvatar } from './Avatar';
import type { MatchdayFixture } from '../types/api';
import { useDialogFocus } from '../hooks/useDialogFocus';

function TeamCrest({ logo }: { logo: string | null }) {
  const [failed, setFailed] = useState(false);

  useEffect(() => setFailed(false), [logo]);

  if (logo && !failed) {
    return (
      <img
        className="friends-predictions-crest"
        src={logo}
        alt=""
        width={30}
        height={30}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <span
      className="friends-predictions-crest friends-predictions-crest-fallback"
      aria-hidden="true"
    >
      ⚽
    </span>
  );
}

const formatTimestamp = (dateStr: string | null) => {
  if (!dateStr) return null;
  try {
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleString('es-ES', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return null;
  }
};

export default function MatchFriendsPredictionsModal({
  groupId,
  match,
  onClose,
}: {
  groupId: string;
  match: MatchdayFixture | null;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const matchId = match?.matchId;
  const {
    data: predictions = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['matchFriendPredictions', groupId, matchId],
    queryFn: () => fetchMatchdayFriendPredictions(groupId, matchId!),
    enabled: Boolean(groupId && matchId),
  });

  useEffect(() => {
    if (!match) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [match]);

  useDialogFocus(dialogRef, { active: Boolean(match), onEscape: onClose });

  if (!match) return null;

  const isMatchLocked = Boolean(match.finished || match.locked);
  const predictedCount = predictions.filter((prediction) => prediction.hasPredicted).length;
  const progress = predictions.length ? Math.round((predictedCount / predictions.length) * 100) : 0;
  const matchDate = formatTimestamp(match.matchDate);
  const roundLabel = match.round && match.round !== 'group' ? match.round : '';
  const hasFinalScore =
    match.finished && match.actualHomeScore != null && match.actualAwayScore != null;

  return createPortal(
    <div
      className="friends-predictions-overlay"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="friends-predictions-panel paper-panel landing-tape paper-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="friends-predictions-title"
        ref={dialogRef}
        tabIndex={-1}
      >
        <div className="friends-predictions-head">
          <h2 id="friends-predictions-title" className="friends-predictions-title">
            Pronósticos del partido
          </h2>
          <button
            type="button"
            className="friends-predictions-close"
            onClick={onClose}
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        <div className="friends-predictions-match">
          <div className="friends-predictions-team">
            <TeamCrest logo={match.homeTeamLogo} />
            <span>{match.homeTeam}</span>
          </div>
          <div className="friends-predictions-center">
            <span className={`friends-predictions-vs${hasFinalScore ? ' is-finished' : ''}`}>
              {hasFinalScore ? `${match.actualHomeScore} - ${match.actualAwayScore}` : 'vs'}
            </span>
            {roundLabel && <span className="friends-predictions-round">{roundLabel}</span>}
          </div>
          <div className="friends-predictions-team is-away">
            <span>{match.awayTeam}</span>
            <TeamCrest logo={match.awayTeamLogo} />
          </div>
        </div>

        <div className="friends-predictions-meta">
          {matchDate && <span>📅 {matchDate}</span>}
          {!isLoading && !error && (
            <span className="friends-predictions-count">
              {predictedCount}/{predictions.length} con pronóstico
            </span>
          )}
        </div>
        <div className="friends-predictions-progress" aria-hidden="true">
          <i style={{ width: `${progress}%` }} />
        </div>

        <div className="friends-predictions-list">
          {isLoading && (
            <div className="friends-predictions-skeletons" role="status">
              <span className="sr-only">Cargando pronósticos…</span>
              {[0, 1, 2].map((row) => (
                <div key={row} className="friends-predictions-skeleton skeleton" />
              ))}
            </div>
          )}

          {error && (
            <p className="friends-predictions-message is-error">
              No se pudieron cargar los pronósticos de la liga.
            </p>
          )}

          {!isLoading && !error && predictions.length === 0 && (
            <p className="friends-predictions-message">
              Todavía no hay miembros con pronósticos en este partido.
            </p>
          )}

          {!isLoading &&
            !error &&
            predictions.map((prediction) => {
              const formattedTime = formatTimestamp(prediction.updatedAt);
              const visible =
                prediction.hasPredicted &&
                prediction.homeScore !== null &&
                prediction.homeScore !== undefined &&
                prediction.awayScore !== null &&
                prediction.awayScore !== undefined;
              const hidden = prediction.hasPredicted && !visible;
              const hasPoints =
                prediction.pointsAwarded !== null && prediction.pointsAwarded !== undefined;

              return (
                <div
                  key={prediction.userId}
                  className={`friends-prediction${prediction.isCaller ? ' is-caller' : ''}`}
                >
                  <UserAvatar
                    url={prediction.avatarUrl}
                    userId={prediction.userId}
                    name={prediction.participantName}
                    size={40}
                  />

                  <div className="friends-prediction-main">
                    <div className="friends-prediction-name">
                      <span>{prediction.participantName}</span>
                      {prediction.isCaller && <span className="friends-prediction-you">Tú</span>}
                    </div>
                    <div className="friends-prediction-time">
                      {formattedTime ?? 'Sin fecha de envío'}
                    </div>
                  </div>

                  <div className="friends-prediction-result">
                    {visible ? (
                      <>
                        <div className="friends-prediction-score-row">
                          <span className="friends-prediction-score">
                            {prediction.homeScore} - {prediction.awayScore}
                          </span>
                          {prediction.sign && (
                            <span className="friends-prediction-sign">{prediction.sign}</span>
                          )}
                        </div>
                        {hasPoints && (
                          <span
                            className={`friends-prediction-points${(prediction.pointsAwarded ?? 0) > 0 ? '' : ' is-zero'}`}
                          >
                            {prediction.isExactScore
                              ? '🎯 '
                              : prediction.isCorrectSign
                                ? '✅ '
                                : ''}
                            {(prediction.pointsAwarded ?? 0) > 0
                              ? `+${prediction.pointsAwarded} pts`
                              : '0 pts'}
                          </span>
                        )}
                      </>
                    ) : hidden ? (
                      <span className="friends-prediction-status is-hidden">🔒 Oculto</span>
                    ) : (
                      <span
                        className={`friends-prediction-status ${isMatchLocked ? 'is-missed' : 'is-pending'}`}
                      >
                        {isMatchLocked ? 'No pronosticó' : 'Pendiente'}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
        </div>

        <div className="friends-predictions-foot">
          <span aria-hidden="true">🔒</span>
          <span>Los pronósticos se revelan al empezar el partido.</span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
