import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchMatchdayFriendBets } from '../services/api';
import Flag from './Flag';

export default function MatchFriendsBetsModal({ groupId, match, onClose }) {
  if (!match) return null;

  const {
    data: bets = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['matchFriendBets', groupId, match.matchId],
    queryFn: () => fetchMatchdayFriendBets(groupId, match.matchId),
    enabled: Boolean(groupId && match.matchId),
  });

  const formatTimestamp = (dateStr) => {
    if (!dateStr) return null;
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('es-ES', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return null;
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        padding: '16px',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: '560px',
          maxHeight: '85vh',
          background: '#0f172a',
          border: '1px solid rgba(0, 210, 211, 0.3)',
          borderRadius: '20px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
          overflow: 'hidden',
          animation: 'fadeIn 0.2s ease-out',
        }}
      >
        {/* Cabecera del partido */}
        <div
          style={{
            padding: '18px 20px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            background: 'rgba(255, 255, 255, 0.02)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <div
              style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                color: '#00d2d3',
                textTransform: 'uppercase',
                letterSpacing: '1px',
                marginBottom: '4px',
              }}
            >
              👥 Porras del Grupo en este Partido
            </div>
            <h2
              id="modal-title"
              style={{
                margin: 0,
                fontSize: '1.15rem',
                color: '#fff',
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                flexWrap: 'wrap',
                rowGap: '4px',
                gap: '8px',
              }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                <Flag
                  team={match.homeTeam}
                  logo={match.homeTeamLogo}
                  style={{ width: '18px', height: '18px' }}
                />
                <span>{match.homeTeam}</span>
              </span>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                {match.finished && match.actualHomeScore !== null
                  ? `${match.actualHomeScore} - ${match.actualAwayScore}`
                  : 'vs'}
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                <Flag
                  team={match.awayTeam}
                  logo={match.awayTeamLogo}
                  style={{ width: '18px', height: '18px' }}
                />
                <span>{match.awayTeam}</span>
              </span>
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar modal"
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: 'none',
              color: '#fff',
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              cursor: 'pointer',
              fontSize: '1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ✕
          </button>
        </div>

        {/* Lista de pronósticos de los miembros */}
        <div
          style={{
            padding: '16px 20px',
            overflowY: 'auto',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          {isLoading && (
            <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: '1.5rem', marginBottom: '8px' }}>⚽</div>
              Cargando pronósticos de los miembros...
            </div>
          )}

          {error && (
            <div style={{ textAlign: 'center', padding: '20px', color: '#ff7675' }}>
              Error al cargar los pronósticos del grupo.
            </div>
          )}

          {!isLoading && !error && bets.length === 0 && (
            <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
              No se encontraron pronósticos registrados para este partido.
            </div>
          )}

          {!isLoading &&
            !error &&
            bets.map((b) => {
              const formattedTime = formatTimestamp(b.updatedAt);
              return (
                <div
                  key={b.userId}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 14px',
                    borderRadius: '12px',
                    background: b.isCaller
                      ? 'rgba(0, 210, 211, 0.08)'
                      : 'rgba(255, 255, 255, 0.03)',
                    border: b.isCaller
                      ? '1px solid rgba(0, 210, 211, 0.3)'
                      : '1px solid rgba(255, 255, 255, 0.06)',
                  }}
                >
                  {/* Usuario */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '50%',
                        background: b.isCaller ? '#00d2d3' : 'rgba(255, 255, 255, 0.1)',
                        color: b.isCaller ? '#000' : '#fff',
                        fontWeight: 800,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.9rem',
                        flexShrink: 0,
                      }}
                    >
                      {b.participantName?.charAt(0).toUpperCase() || 'U'}
                    </div>
                    <div>
                      <div
                        style={{
                          fontWeight: 700,
                          color: '#fff',
                          fontSize: '0.95rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        <span>{b.participantName}</span>
                        {b.isCaller && (
                          <span
                            style={{
                              fontSize: '0.65rem',
                              background: '#00d2d3',
                              color: '#000',
                              padding: '1px 6px',
                              borderRadius: '6px',
                              fontWeight: 800,
                            }}
                          >
                            TÚ
                          </span>
                        )}
                      </div>
                      {formattedTime && (
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          🕒 {formattedTime}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Pronóstico y Puntos */}
                  <div
                    style={{
                      textAlign: 'right',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-end',
                      gap: '4px',
                    }}
                  >
                    {b.hasPredicted && b.homeScore !== null && b.awayScore !== null ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span
                          style={{
                            fontSize: '1.05rem',
                            fontWeight: 900,
                            letterSpacing: '1px',
                            background: 'rgba(0, 0, 0, 0.4)',
                            padding: '3px 10px',
                            borderRadius: '8px',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            color: '#fff',
                          }}
                        >
                          {b.homeScore} - {b.awayScore}
                        </span>
                        {b.sign && (
                          <span
                            style={{
                              fontSize: '0.75rem',
                              fontWeight: 800,
                              color: '#00d2d3',
                              background: 'rgba(0, 210, 211, 0.15)',
                              padding: '2px 6px',
                              borderRadius: '4px',
                            }}
                          >
                            {b.sign}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span
                        style={{
                          fontSize: '0.8rem',
                          color: 'var(--text-muted)',
                          fontStyle: 'italic',
                        }}
                      >
                        {b.scoringDetails || 'Sin pronóstico'}
                      </span>
                    )}

                    {/* Badge de puntos si el partido ya está evaluado */}
                    {b.pointsAwarded !== null && b.pointsAwarded !== undefined && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {b.isExactScore ? (
                          <span
                            style={{
                              fontSize: '0.75rem',
                              fontWeight: 800,
                              color: '#2ecc71',
                              background: 'rgba(46, 204, 113, 0.15)',
                              padding: '2px 8px',
                              borderRadius: '6px',
                              border: '1px solid rgba(46, 204, 113, 0.3)',
                            }}
                          >
                            🎯 Pleno +{b.pointsAwarded} pts
                          </span>
                        ) : b.isCorrectSign ? (
                          <span
                            style={{
                              fontSize: '0.75rem',
                              fontWeight: 800,
                              color: '#00d2d3',
                              background: 'rgba(0, 210, 211, 0.15)',
                              padding: '2px 8px',
                              borderRadius: '6px',
                            }}
                          >
                            ✅ Signo +{b.pointsAwarded} pts
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            0 pts
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}
