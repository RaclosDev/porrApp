import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAppContext } from '../../context/AppContext';
import { fetchCompetitionStandings } from '../../services/api';
import Flag from '../Flag';

function formatKickOff(date) {
  if (!date) return 'VS';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return 'VS';
  return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

function formatMatchDate(date) {
  if (!date) return 'Fecha por confirmar';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return 'Fecha por confirmar';
  return d.toLocaleDateString('es-ES', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function roundLabelFor(match) {
  if (!match) return '';
  if (match.groupName) return `Grupo ${match.groupName}`;
  if (match.round && match.round.toLowerCase() !== 'group') return match.round;
  if (match.date) return `Fecha ${match.date.slice(0, 10)}`;
  return '';
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

  // La competición solo se muestra si aporta información nueva respecto al nombre de la liga.
  const showCompetition =
    Boolean(activeCompetitionName) &&
    activeCompetitionName.trim().toLowerCase() !== (activeGroupName || '').trim().toLowerCase();

  // Jornada actual: la primera ronda con partidos sin finalizar (o la última si ya acabó todo).
  // Se muestran todos los partidos de esa jornada, también los ya finalizados.
  const { currentRound, matchdayMatches } = useMemo(() => {
    if (!allGames || allGames.length === 0) return { currentRound: null, matchdayMatches: [] };

    const sorted = [...allGames].sort((a, b) => {
      const dateA = a.date ? new Date(a.date) : new Date(0);
      const dateB = b.date ? new Date(b.date) : new Date(0);
      return dateA - dateB;
    });

    const rounds = [];
    const byRound = new Map();
    sorted.forEach((match) => {
      const label = roundLabelFor(match);
      if (!label) return;
      if (!byRound.has(label)) {
        byRound.set(label, []);
        rounds.push(label);
      }
      byRound.get(label).push(match);
    });

    if (rounds.length === 0) return { currentRound: null, matchdayMatches: [] };

    let currentIndex = rounds.findIndex((label) =>
      byRound.get(label).some(
        (match) =>
          !match.finished &&
          !['CANCELLED', 'POSTPONED', 'ABANDONED', 'SUSPENDED'].includes(
            (match.status || '').toUpperCase(),
          ),
      ),
    );
    if (currentIndex === -1) currentIndex = rounds.length - 1;

    const round = rounds[currentIndex];
    return { currentRound: round, matchdayMatches: byRound.get(round) || [] };
  }, [allGames]);

  const topParticipants = useMemo(() => {
    if (!leaderboardData || leaderboardData.length === 0) return [];
    return leaderboardData.slice(0, 5);
  }, [leaderboardData]);

  const topTeams = useMemo(() => {
    if (!leagueStandings || leagueStandings.length === 0) return [];
    return leagueStandings.slice(0, 5);
  }, [leagueStandings]);

  const participantCount = leaderboardData?.length || 0;

  return (
    <section
      className="view-section active"
      style={{ maxWidth: '1080px', margin: '0 auto', padding: '4px 0 24px' }}
    >
      {/* Cabecera de la liga */}
      <header className="home-hero">
        <div className="home-hero-info">
          <h1 className="home-hero-title">{activeGroupName || 'Mi Porra'}</h1>
          <div className="home-hero-pills">
            {showCompetition && (
              <span className="home-hero-pill">{activeCompetitionName}</span>
            )}
            <span className="home-hero-pill muted">
              {participantCount > 0
                ? `${participantCount} ${participantCount === 1 ? 'participante' : 'participantes'}`
                : 'Pronósticos por jornada'}
            </span>
          </div>
        </div>

      </header>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '18px',
        }}
      >
        {/* Partidos */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: 0 }}>
          <div className="home-list-header">
            <h2>
              <span>Partidos{currentRound ? ` ${currentRound}` : ''}</span>
            </h2>
            <button type="button" className="home-link-btn" onClick={() => navigate('/radar')}>
              Ver todos →
            </button>
          </div>

          {matchdayMatches.length > 0 ? (
            matchdayMatches.map((m) => {
              const isLive = ['LIVE', 'PAUSED', 'IN_PLAY', 'IN_PROGRESS'].includes(
                m.status?.toUpperCase(),
              );
              const hasScore = m.home_score != null && m.away_score != null;
              const homeLogo = m.homeLogo || m.homeTeamLogo;
              const awayLogo = m.awayLogo || m.awayTeamLogo;

              return (
                <button
                  type="button"
                  key={m.id || m.home + m.away}
                  className={`home-match-card${isLive ? ' is-live' : ''}`}
                  onClick={() => navigate('/jornadas')}
                  aria-label={`${m.home || 'Local'} contra ${m.away || 'Visitante'}, pronosticar`}
                >
                  <div className="home-match-meta">
                    <span>{formatMatchDate(m.date)}</span>
                    {isLive && <span className="home-live-badge">EN VIVO</span>}
                  </div>

                  <div className="home-match-teams">
                    <div className="home-match-team home">
                      <span className="home-match-crest">
                        <Flag
                          team={m.home}
                          logo={homeLogo}
                          style={{ width: '22px', height: '22px' }}
                        />
                      </span>
                      <span className="home-match-name">{m.home || 'Local'}</span>
                    </div>

                    <div
                      className={`home-match-score${isLive ? ' is-live' : ''}${
                        hasScore ? '' : ' is-pending'
                      }`}
                    >
                      {hasScore ? `${m.home_score} - ${m.away_score}` : formatKickOff(m.date)}
                    </div>

                    <div className="home-match-team away">
                      <span className="home-match-name">{m.away || 'Visitante'}</span>
                      <span className="home-match-crest">
                        <Flag
                          team={m.away}
                          logo={awayLogo}
                          style={{ width: '22px', height: '22px' }}
                        />
                      </span>
                    </div>
                  </div>
                </button>
              );
            })
          ) : (
            <div
              className="glass-panel"
              style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}
            >
              No hay partidos programados para esta jornada.
            </div>
          )}
        </div>

        {/* Ranking y tabla */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', minWidth: 0 }}>
          <div className="glass-panel" style={{ padding: '16px', borderRadius: '14px' }}>
            <div className="home-list-header" style={{ marginBottom: '10px' }}>
              <h2>
                <span aria-hidden="true">🏆</span>
                <span>Ranking</span>
              </h2>
              <button
                type="button"
                className="home-link-btn"
                onClick={() => navigate('/ranking')}
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
                        gap: '8px',
                        padding: '6px 10px',
                        borderRadius: '8px',
                        background: isMe ? 'rgba(0, 210, 211, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                        border: isMe
                          ? '1px solid rgba(0, 210, 211, 0.35)'
                          : '1px solid transparent',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          minWidth: 0,
                        }}
                      >
                        <span
                          style={{
                            fontSize: '1rem',
                            width: '22px',
                            textAlign: 'center',
                            flexShrink: 0,
                          }}
                        >
                          {medal}
                        </span>
                        <span
                          style={{
                            fontWeight: isMe ? 700 : 500,
                            fontSize: '0.88rem',
                            color: '#fff',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {p.name}
                          {isMe ? ' (Tú)' : ''}
                        </span>
                      </div>
                      <span
                        style={{
                          fontWeight: 800,
                          color: 'var(--accent-color, #00d2d3)',
                          fontSize: '0.88rem',
                          flexShrink: 0,
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

          {topTeams.length > 0 && (
            <div className="glass-panel" style={{ padding: '16px', borderRadius: '14px' }}>
              <div className="home-list-header" style={{ marginBottom: '10px' }}>
                <h2>
                  <span aria-hidden="true">📊</span>
                  <span>Tabla</span>
                </h2>
                <button type="button" className="home-link-btn" onClick={() => navigate('/tabla')}>
                  Ver todo →
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
                      gap: '8px',
                      padding: '6px 10px',
                      borderRadius: '8px',
                      background: 'rgba(255, 255, 255, 0.03)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                      <span
                        style={{
                          width: '16px',
                          textAlign: 'center',
                          fontSize: '0.78rem',
                          color: 'var(--text-muted)',
                          flexShrink: 0,
                        }}
                      >
                        {t.rank}
                      </span>
                      <Flag
                        team={t.teamName}
                        logo={t.teamLogo}
                        style={{ width: '20px', height: '20px' }}
                      />
                      <span
                        style={{
                          fontWeight: 600,
                          fontSize: '0.85rem',
                          color: '#fff',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {t.teamName}
                      </span>
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        gap: '10px',
                        fontSize: '0.85rem',
                        alignItems: 'baseline',
                        flexShrink: 0,
                      }}
                    >
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
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
