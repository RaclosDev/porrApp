import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAppContext } from '../../context/AppContext';
import { fetchCompetitionStandings } from '../../services/api';
import Flag from '../Flag';
import LeagueRulesModal from '../LeagueRulesModal';
import type { Match } from '../../types/api';

function formatKickOff(date: string | null) {
  if (!date) return 'VS';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return 'VS';
  return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

function formatMatchDate(date: string | null) {
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

function roundLabelFor(match: Match | null | undefined) {
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
    activeGroupRules,
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
    (activeCompetitionName ?? '').trim().toLowerCase() !==
      (activeGroupName || '').trim().toLowerCase();

  // Jornada actual: la primera ronda con partidos sin finalizar (o la última si ya acabó todo).
  // Se muestran todos los partidos de esa jornada, también los ya finalizados.
  const { currentRound, matchdayMatches } = useMemo(() => {
    const empty = { currentRound: null as string | null, matchdayMatches: [] as Match[] };
    if (!allGames || allGames.length === 0) return empty;

    const sorted = [...allGames].sort((a, b) => {
      const dateA = a.date ? new Date(a.date).getTime() : 0;
      const dateB = b.date ? new Date(b.date).getTime() : 0;
      return dateA - dateB;
    });

    const rounds: string[] = [];
    const byRound = new Map<string, Match[]>();
    sorted.forEach((match) => {
      const label = roundLabelFor(match);
      if (!label) return;
      if (!byRound.has(label)) {
        byRound.set(label, []);
        rounds.push(label);
      }
      byRound.get(label)!.push(match);
    });

    if (rounds.length === 0) return empty;

    let currentIndex = rounds.findIndex((label) =>
      (byRound.get(label) ?? []).some(
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
  const [showRules, setShowRules] = useState(false);

  return (
    <section className="view-section active max-w-270 my-0 mx-auto pt-1 pb-6 px-0">
      {showRules && (
        <LeagueRulesModal
          group={{ name: activeGroupName, rules: activeGroupRules }}
          onClose={() => setShowRules(false)}
        />
      )}

      {/* Cabecera de la liga */}
      <header className="home-hero">
        <div className="home-hero-info">
          <h1 className="home-hero-title">{activeGroupName || 'Mi Porra'}</h1>
          <div className="home-hero-pills">
            {showCompetition && <span className="home-hero-pill">{activeCompetitionName}</span>}
            <span className="home-hero-pill muted">
              {participantCount > 0
                ? `${participantCount} ${participantCount === 1 ? 'participante' : 'participantes'}`
                : 'Pronósticos por jornada'}
            </span>
          </div>
        </div>
        <button type="button" className="home-rules-btn" onClick={() => setShowRules(true)}>
          📜 Reglas
        </button>
      </header>

      <div className="grid grid-cols-[repeat(auto-fit,_minmax(300px,_1fr))] gap-4.5">
        {/* Partidos */}
        <div className="flex flex-col gap-2 min-w-0">
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
            <div className="glass-panel p-6 text-center text-muted">
              No hay partidos programados para esta jornada.
            </div>
          )}
        </div>

        {/* Ranking y tabla */}
        <div className="flex flex-col gap-4.5 min-w-0">
          <div className="glass-panel p-4 rounded-[14px]">
            <div className="home-list-header mb-2.5">
              <h2>
                <span aria-hidden="true">🏆</span>
                <span>Ranking</span>
              </h2>
              <button type="button" className="home-link-btn" onClick={() => navigate('/ranking')}>
                Ver todo →
              </button>
            </div>

            <div className="flex flex-col gap-1.5">
              {topParticipants.length > 0 ? (
                topParticipants.map((p, index) => {
                  const isMe = p.userId?.toString() === userId?.toString() || p.name === userName;
                  let medal = `${index + 1}º`;
                  if (index === 0) medal = '🥇';
                  else if (index === 1) medal = '🥈';
                  else if (index === 2) medal = '🥉';

                  return (
                    <div
                      className={`flex items-center justify-between gap-2 py-1.5 px-2.5 rounded-[8px] ${isMe ? 'bg-[rgba(0,_210,_211,_0.12)] bg-none' : 'bg-[rgba(255,_255,_255,_0.03)] bg-none'} ${isMe ? 'border border-[rgba(0,_210,_211,_0.35)]' : 'border border-transparent'}`}
                      key={p.id || index}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[1rem] w-5.5 text-center shrink-0">{medal}</span>
                        <span
                          className={`text-[0.88rem] text-white overflow-hidden text-ellipsis whitespace-nowrap ${isMe ? 'font-bold' : 'font-medium'}`}
                        >
                          {p.name}
                          {isMe ? ' (Tú)' : ''}
                        </span>
                      </div>
                      <span className="font-extrabold text-accent-text text-[0.88rem] shrink-0">
                        {p.total || 0} pts
                      </span>
                    </div>
                  );
                })
              ) : (
                <div className="text-center text-muted text-[0.85rem] p-3">
                  Aún no hay puntuaciones en esta peña.
                </div>
              )}
            </div>
          </div>

          {topTeams.length > 0 && (
            <div className="glass-panel p-4 rounded-[14px]">
              <div className="home-list-header mb-2.5">
                <h2>
                  <span aria-hidden="true">📊</span>
                  <span>Tabla</span>
                </h2>
                <button type="button" className="home-link-btn" onClick={() => navigate('/tabla')}>
                  Ver todo →
                </button>
              </div>

              <div className="flex flex-col gap-1.5">
                {topTeams.map((t) => (
                  <div
                    className="flex items-center justify-between gap-2 py-1.5 px-2.5 rounded-[8px] bg-[rgba(255,_255,_255,_0.03)] bg-none"
                    key={t.rank + t.teamName}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-4 text-center text-[0.78rem] text-muted shrink-0">
                        {t.rank}
                      </span>
                      <Flag
                        team={t.teamName}
                        logo={t.teamLogo}
                        style={{ width: '20px', height: '20px' }}
                      />
                      <span className="font-semibold text-[0.85rem] text-white overflow-hidden text-ellipsis whitespace-nowrap">
                        {t.teamName}
                      </span>
                    </div>
                    <div className="flex gap-2.5 text-[0.85rem] items-baseline shrink-0">
                      <span className="text-muted text-[0.75rem]">{t.gamesPlayed} PJ</span>
                      <span className="font-extrabold text-white">{t.points} pts</span>
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
