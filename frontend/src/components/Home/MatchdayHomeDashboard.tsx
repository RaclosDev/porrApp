import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAppContext } from '../../context/AppContext';
import { fetchCompetitionStandings } from '../../services/api';

function getCompetitionBadge(competitionName) {
  if (!competitionName) return '🏆';
  const lower = competitionName.toLowerCase();
  if (lower.includes('laliga') || lower.includes('copa del rey') || lower.includes('españa'))
    return '🇪🇸';
  if (lower.includes('premier') || lower.includes('inglaterra')) return '🏴󠁧󠁢󠁥󠁮󠁧󠁿';
  if (lower.includes('champions') || lower.includes('europa') || lower.includes('conference'))
    return '🇪🇺';
  if (lower.includes('serie a') || lower.includes('italia')) return '🇮🇹';
  if (lower.includes('bundesliga') || lower.includes('alemania')) return '🇩🇪';
  if (lower.includes('ligue 1') || lower.includes('francia')) return '🇫🇷';
  if (lower.includes('mex') || lower.includes('bbva')) return '🇲🇽';
  if (lower.includes('mls') || lower.includes('usa')) return '🇺🇸';
  if (lower.includes('mundial') || lower.includes('world cup') || lower.includes('fifa'))
    return '🌍';
  return '🏆';
}

export default function MatchdayHomeDashboard() {
  const {
    activeGroupName,
    activeCompetitionName,
    activeCompetitionId,
    allGames,
    leaderboardData,
    userName,
    userId,
  } = useAppContext();

  const navigate = useNavigate();

  const { data: leagueStandings } = useQuery({
    queryKey: ['competitionStandings', activeCompetitionId],
    queryFn: () => fetchCompetitionStandings(activeCompetitionId),
    enabled: Boolean(activeCompetitionId),
    staleTime: 120_000,
  });

  const compBadge = getCompetitionBadge(activeCompetitionName);

  // Filtramos y ordenamos los próximos partidos o en vivo
  const relevantMatches = useMemo(() => {
    if (!allGames || allGames.length === 0) return [];

    const now = new Date();
    // Priorizamos partidos en vivo o que se jueguen hoy/próximos días
    const sorted = [...allGames].sort((a, b) => {
      const dateA = a.date ? new Date(a.date) : new Date(0);
      const dateB = b.date ? new Date(b.date) : new Date(0);
      return dateA - dateB;
    });

    const upcomingOrLive = sorted.filter((m) => {
      if (m.status === 'live' || m.status === 'in_progress') return true;
      if (!m.date) return false;
      const d = new Date(m.date);
      // Incluir partidos desde hace 3 horas hasta próximos 7 días
      return d.getTime() > now.getTime() - 3 * 3600 * 1000;
    });

    return upcomingOrLive.length > 0 ? upcomingOrLive.slice(0, 6) : sorted.slice(0, 6);
  }, [allGames]);

  // Top 5 participantes de la porra
  const topParticipants = useMemo(() => {
    if (!leaderboardData || leaderboardData.length === 0) return [];
    return leaderboardData.slice(0, 5);
  }, [leaderboardData]);

  // Top 5 clubes de la clasificación real
  const topTeams = useMemo(() => {
    if (!leagueStandings || leagueStandings.length === 0) return [];
    return leagueStandings.slice(0, 5);
  }, [leagueStandings]);

  return (
    <section
      className="view-section active"
      style={{ maxWidth: '1080px', margin: '0 auto', padding: '12px 16px' }}
    >
      {/* Hero Card */}
      <div
        className="glass-panel"
        style={{
          padding: '24px',
          borderRadius: '16px',
          background:
            'linear-gradient(135deg, rgba(15, 23, 42, 0.9) 0%, rgba(30, 41, 59, 0.8) 100%)',
          border: '1px solid rgba(0, 210, 211, 0.3)',
          boxShadow: '0 12px 30px rgba(0, 0, 0, 0.5), 0 0 20px rgba(0, 210, 211, 0.1)',
          marginBottom: '24px',
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '16px',
        }}
      >
        <div style={{ minWidth: '240px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <span style={{ fontSize: '1.4rem' }}>{compBadge}</span>
            <span
              style={{
                fontSize: '0.8rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                color: 'var(--accent-color, #00d2d3)',
                letterSpacing: '1px',
              }}
            >
              {activeCompetitionName || 'Liga Regular'}
            </span>
          </div>
          <h1 style={{ margin: '0 0 6px 0', fontSize: '1.75rem', fontWeight: 800, color: '#fff' }}>
            {activeGroupName || 'Mi Porra'}
          </h1>
          <p style={{ margin: 0, color: 'var(--text-muted, #94a3b8)', fontSize: '0.9rem' }}>
            Pronostica los resultados de cada jornada y compite con tu peña.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="glass-btn primary-btn"
            style={{
              padding: '10px 20px',
              borderRadius: '10px',
              fontWeight: 700,
              fontSize: '0.95rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
            onClick={() => navigate('/jornadas')}
          >
            <span>⚽</span>
            <span>Pronosticar Jornada</span>
          </button>

          <button
            type="button"
            className="glass-btn"
            style={{
              padding: '10px 16px',
              borderRadius: '10px',
              fontWeight: 600,
              fontSize: '0.9rem',
            }}
            onClick={() => navigate('/clasificacion')}
          >
            🏆 Ver Clasificación
          </button>
        </div>
      </div>

      {/* Grid Principal: Partidos + Tablas */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '20px',
        }}
      >
        {/* Columna Izquierda: Partidos de la Jornada */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2
              style={{
                margin: 0,
                fontSize: '1.15rem',
                fontWeight: 700,
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <span>📅</span> Partidos en Directo y Próximos
            </h2>
            <button
              type="button"
              onClick={() => navigate('/radar')}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--accent-color, #00d2d3)',
                fontSize: '0.82rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Ver todos →
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {relevantMatches.length > 0 ? (
              relevantMatches.map((m) => {
                const isFinished = Boolean(m.finished);
                const isLive = m.status === 'live' || m.status === 'in_progress';
                const hasScore = m.home_score != null && m.away_score != null;

                let dateDisplay = 'Próximamente';
                if (m.date) {
                  const d = new Date(m.date);
                  dateDisplay = d.toLocaleDateString('es-ES', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  });
                }

                return (
                  <div
                    key={m.id || m.home + m.away}
                    className="glass-card"
                    style={{
                      padding: '12px 14px',
                      borderRadius: '12px',
                      background: 'rgba(15, 23, 42, 0.7)',
                      border: isLive
                        ? '1px solid rgba(255, 107, 107, 0.5)'
                        : '1px solid rgba(255, 255, 255, 0.08)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '12px',
                      boxShadow: isLive ? '0 0 15px rgba(255, 107, 107, 0.15)' : 'none',
                    }}
                  >
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {/* Estado o Fecha */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontSize: '0.75rem',
                        }}
                      >
                        {isLive ? (
                          <span
                            style={{
                              background: 'rgba(255, 107, 107, 0.2)',
                              color: '#ff6b6b',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontWeight: 700,
                            }}
                          >
                            🔴 EN VIVO {m.display_clock || ''}
                          </span>
                        ) : isFinished ? (
                          <span style={{ color: 'var(--text-muted, #94a3b8)', fontWeight: 600 }}>
                            FINALIZADO
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted, #94a3b8)' }}>{dateDisplay}</span>
                        )}
                        {m.round && (
                          <span style={{ color: 'var(--text-muted, #94a3b8)', fontSize: '0.7rem' }}>
                            · {m.round}
                          </span>
                        )}
                      </div>

                      {/* Equipos y Marcadores */}
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '4px',
                            minWidth: 0,
                          }}
                        >
                          <span
                            style={{
                              fontWeight: 600,
                              fontSize: '0.9rem',
                              color: '#fff',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {m.home || 'Local'}
                          </span>
                          <span
                            style={{
                              fontWeight: 600,
                              fontSize: '0.9rem',
                              color: '#fff',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {m.away || 'Visitante'}
                          </span>
                        </div>

                        {hasScore ? (
                          <div
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '4px',
                              alignItems: 'center',
                              padding: '2px 8px',
                              borderRadius: '6px',
                              background: 'rgba(255, 255, 255, 0.08)',
                              fontWeight: 800,
                              fontSize: '0.95rem',
                              color: isLive ? '#00d2d3' : '#fff',
                            }}
                          >
                            <span>{m.home_score}</span>
                            <span>{m.away_score}</span>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => navigate('/jornadas')}
                            style={{
                              background: 'rgba(0, 210, 211, 0.12)',
                              border: '1px solid rgba(0, 210, 211, 0.35)',
                              color: '#00d2d3',
                              padding: '4px 10px',
                              borderRadius: '6px',
                              fontSize: '0.78rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            Pronosticar
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div
                className="glass-panel"
                style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}
              >
                No hay partidos programados para los próximos días.
              </div>
            )}
          </div>
        </div>

        {/* Columna Derecha: Top Peña + Top Liga Oficial */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Top Peña */}
          <div className="glass-panel" style={{ padding: '16px', borderRadius: '14px' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '12px',
              }}
            >
              <h3
                style={{
                  margin: 0,
                  fontSize: '1rem',
                  fontWeight: 700,
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <span>🏆</span> Ranking de la Peña
              </h3>
              <button
                type="button"
                onClick={() => navigate('/clasificacion')}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--accent-color, #00d2d3)',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Ver todo →
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {topParticipants.length > 0 ? (
                topParticipants.map((p, index) => {
                  const isMe = p.userId?.toString() === userId?.toString() || p.name === userName;
                  let medal = `${index + 1}º`;
                  if (index === 0) medal = '🥇';
                  else if (index === 1) medal = '🥈';
                  else if (index === 2) medal = '🥉';

                  return (
                    <div
                      key={p.id || index}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '6px 10px',
                        borderRadius: '8px',
                        background: isMe ? 'rgba(0, 210, 211, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                        border: isMe
                          ? '1px solid rgba(0, 210, 211, 0.35)'
                          : '1px solid transparent',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '1rem', width: '24px', textAlign: 'center' }}>
                          {medal}
                        </span>
                        <span
                          style={{
                            fontWeight: isMe ? 700 : 500,
                            fontSize: '0.88rem',
                            color: '#fff',
                          }}
                        >
                          {p.name} {isMe ? '(Tú)' : ''}
                        </span>
                      </div>
                      <span
                        style={{
                          fontWeight: 800,
                          color: 'var(--accent-color, #00d2d3)',
                          fontSize: '0.9rem',
                        }}
                      >
                        {p.total || 0} pts
                      </span>
                    </div>
                  );
                })
              ) : (
                <div
                  style={{
                    textAlign: 'center',
                    color: 'var(--text-muted)',
                    fontSize: '0.85rem',
                    padding: '12px',
                  }}
                >
                  Aún no hay puntuaciones en esta peña.
                </div>
              )}
            </div>
          </div>

          {/* Top Liga Oficial */}
          {topTeams.length > 0 && (
            <div className="glass-panel" style={{ padding: '16px', borderRadius: '14px' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '12px',
                }}
              >
                <h3
                  style={{
                    margin: 0,
                    fontSize: '1rem',
                    fontWeight: 700,
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <span>📊</span> Tabla {activeCompetitionName || 'Oficial'}
                </h3>
                <button
                  type="button"
                  onClick={() => navigate('/tabla')}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--accent-color, #00d2d3)',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Tabla completa →
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {topTeams.map((t) => (
                  <div
                    key={t.rank + t.teamName}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '6px 10px',
                      borderRadius: '8px',
                      background: 'rgba(255, 255, 255, 0.03)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span
                        style={{
                          width: '18px',
                          textAlign: 'center',
                          fontSize: '0.8rem',
                          color: 'var(--text-muted)',
                        }}
                      >
                        {t.rank}
                      </span>
                      {t.teamLogo ? (
                        <img
                          src={t.teamLogo}
                          alt=""
                          width={20}
                          height={20}
                          loading="lazy"
                          style={{ width: '20px', height: '20px', objectFit: 'contain' }}
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      ) : (
                        <span>🛡️</span>
                      )}
                      <span style={{ fontWeight: 600, fontSize: '0.85rem', color: '#fff' }}>
                        {t.teamName}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '12px', fontSize: '0.85rem' }}>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                        {t.gamesPlayed} PJ
                      </span>
                      <span style={{ fontWeight: 800, color: '#fff' }}>{t.points} pts</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
