import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchMatchdayFriendBets } from '../services/api';
import { UserAvatar } from './Avatar';

function TeamCrest({ team, logo }) {
  const [failed, setFailed] = useState(false);

  useEffect(() => setFailed(false), [logo]);

  if (logo && !failed) {
    return (
      <img
        className="friends-bets-crest"
        src={logo}
        alt=""
        width={30}
        height={30}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <span className="friends-bets-crest friends-bets-crest-fallback" aria-hidden="true">
      ⚽
    </span>
  );
}

const formatTimestamp = (dateStr) => {
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

export default function MatchFriendsBetsModal({ groupId, match, onClose }) {
  const matchId = match?.matchId;
  const {
    data: bets = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['matchFriendBets', groupId, matchId],
    queryFn: () => fetchMatchdayFriendBets(groupId, matchId),
    enabled: Boolean(groupId && matchId),
  });

  useEffect(() => {
    if (!match) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [match, onClose]);

  if (!match) return null;

  const isMatchLocked = Boolean(match.finished || match.locked);
  const predictedCount = bets.filter((bet) => bet.hasPredicted).length;
  const progress = bets.length ? Math.round((predictedCount / bets.length) * 100) : 0;
  const matchDate = formatTimestamp(match.matchDate);
  const roundLabel = match.round && match.round !== 'group' ? match.round : '';
  const hasFinalScore =
    match.finished && match.actualHomeScore != null && match.actualAwayScore != null;

  return (
    <div
      className="friends-bets-overlay"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="friends-bets-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="friends-bets-title"
      >
        <div className="friends-bets-head">
          <div>
            <div className="friends-bets-kicker">
              <span aria-hidden="true">👥</span>
              <span>Porras del grupo</span>
            </div>
            <h2 id="friends-bets-title" className="friends-bets-title">
              Pronósticos del partido
            </h2>
          </div>
          <button
            type="button"
            className="friends-bets-close"
            onClick={onClose}
            aria-label="Cerrar modal"
          >
            ✕
          </button>
        </div>

        <div className="friends-bets-match">
          <div className="friends-bets-team">
            <TeamCrest team={match.homeTeam} logo={match.homeTeamLogo} />
            <span>{match.homeTeam}</span>
          </div>
          <div className="friends-bets-center">
            <span className={`friends-bets-vs${hasFinalScore ? ' is-finished' : ''}`}>
              {hasFinalScore ? `${match.actualHomeScore} - ${match.actualAwayScore}` : 'vs'}
            </span>
            {roundLabel && <span className="friends-bets-round">{roundLabel}</span>}
          </div>
          <div className="friends-bets-team is-away">
            <span>{match.awayTeam}</span>
            <TeamCrest team={match.awayTeam} logo={match.awayTeamLogo} />
          </div>
        </div>

        <div className="friends-bets-meta">
          {matchDate && <span>📅 {matchDate}</span>}
          {!isLoading && !error && (
            <span className="friends-bets-count">
              {predictedCount}/{bets.length} con pronóstico
            </span>
          )}
        </div>
        <div className="friends-bets-progress" aria-hidden="true">
          <i style={{ width: `${progress}%` }} />
        </div>

        <div className="friends-bets-list">
          {isLoading && (
            <div className="friends-bets-skeletons" role="status">
              <span className="sr-only">Cargando pronósticos…</span>
              {[0, 1, 2].map((row) => (
                <div key={row} className="friends-bets-skeleton" />
              ))}
            </div>
          )}

          {error && (
            <p className="friends-bets-message is-error">
              No se pudieron cargar los pronósticos del grupo.
            </p>
          )}

          {!isLoading && !error && bets.length === 0 && (
            <p className="friends-bets-message">
              Todavía no hay miembros con pronósticos en este partido.
            </p>
          )}

          {!isLoading &&
            !error &&
            bets.map((bet) => {
              const formattedTime = formatTimestamp(bet.updatedAt);
              const visible =
                bet.hasPredicted &&
                bet.homeScore !== null &&
                bet.homeScore !== undefined &&
                bet.awayScore !== null &&
                bet.awayScore !== undefined;
              const hidden = bet.hasPredicted && !visible;
              const hasPoints = bet.pointsAwarded !== null && bet.pointsAwarded !== undefined;

              return (
                <div key={bet.userId} className={`friends-bet${bet.isCaller ? ' is-caller' : ''}`}>
                  <UserAvatar
                    url={bet.avatarUrl || (bet.userId ? `/api/users/${bet.userId}/avatar` : '')}
                    name={bet.participantName}
                    size={40}
                  />

                  <div className="friends-bet-main">
                    <div className="friends-bet-name">
                      <span>{bet.participantName}</span>
                      {bet.isCaller && <span className="friends-bet-you">Tú</span>}
                    </div>
                    <div className="friends-bet-time">
                      {formattedTime ? `🕒 ${formattedTime}` : 'Sin fecha de envío'}
                    </div>
                  </div>

                  <div className="friends-bet-result">
                    {visible ? (
                      <>
                        <div className="friends-bet-score-row">
                          <span className="friends-bet-score">
                            {bet.homeScore} - {bet.awayScore}
                          </span>
                          {bet.sign && <span className="friends-bet-sign">{bet.sign}</span>}
                        </div>
                        {hasPoints && (
                          <span
                            className={`friends-bet-points${bet.pointsAwarded > 0 ? '' : ' is-zero'}`}
                          >
                            {bet.isExactScore ? '🎯 ' : bet.isCorrectSign ? '✅ ' : ''}
                            {bet.pointsAwarded > 0 ? `+${bet.pointsAwarded} pts` : '0 pts'}
                          </span>
                        )}
                      </>
                    ) : hidden ? (
                      <span className="friends-bet-status is-hidden">🔒 Oculto</span>
                    ) : (
                      <span
                        className={`friends-bet-status ${isMatchLocked ? 'is-missed' : 'is-pending'}`}
                      >
                        {isMatchLocked ? 'Sin pronóstico' : 'Sin pronosticar'}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
        </div>

        <div className="friends-bets-foot">
          <span aria-hidden="true">🔒</span>
          <span>Los pronósticos se revelan al empezar el partido.</span>
        </div>
      </div>
    </div>
  );
}
