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

  const showCompetition =
    Boolean(activeCompetitionName) &&
    activeCompetitionName.trim().toLowerCase() !== (activeGroupName || '').trim().toLowerCase();

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
                      <span className="home-match-name">{m.home}</span>
                    </div>
                    <span className={`home-match-score${isLive ? ' is-live' : ''}${hasScore ? '' : ' is-pending'}`}>
                      {hasScore ? `${m.home_score} - ${m.away_score}` : formatKickOff(m.date)}
                    </span>
                    <div className="home-match-team away">
                      <span className="home-match-name">{m.away}</span>
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
            <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>
              No hay partidos para mostrar en esta jornada.
            </p>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: 0 }}>
          <div className="home-list-header">
            <h2>Clasificación</h2>
            <button type="button" className="home-link-btn" onClick={() => navigate('/tabla')}>
              Ver completa →
            </button>
          </div>
          {topTeams.length > 0 ? (
            <div className="glass-panel" style={{ padding: '8px 12px' }}>
              {topTeams.map((team, index) => (
                <div key={team.teamId || team.teamName || index} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderBottom: index === topTeams.length - 1 ? 'none' : '1px solid var(--border-color)' }}>
                  <span style={{ width: 20, color: 'var(--text-muted)', fontSize: '0.8rem' }}>{index + 1}</span>
                  <Flag team={team.teamName || team.name} />
                  <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.85rem' }}>{team.teamName || team.name}</span>
                  <strong>{team.points ?? team.pts ?? 0}</strong>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>
              Clasificación no disponible.
            </p>
          )}
        </div>

        {topParticipants.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: 0 }}>
            <div className="home-list-header">
              <h2>Ranking de la liga</h2>
              <button type="button" className="home-link-btn" onClick={() => navigate('/ranking')}>
                Ver completo →
              </button>
            </div>
            <div className="glass-panel" style={{ padding: '8px 12px' }}>
              {topParticipants.map((participant, index) => (
                <div key={participant.id || participant.userId || index} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderBottom: index === topParticipants.length - 1 ? 'none' : '1px solid var(--border-color)' }}>
                  <span style={{ width: 20, color: 'var(--text-muted)', fontSize: '0.8rem' }}>{index + 1}</span>
                  <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.85rem' }}>{participant.name || participant.participantName || 'Participante'}</span>
                  <strong>{participant.totalPoints ?? participant.total ?? participant.points ?? 0} pts</strong>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
