import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAppContext } from '../../context/AppContext';
import { useLeagueHomeData, type MiniStandingRow } from '../../hooks/useLeagueHomeData';
import { isLiveMatch } from '../../utils/homeMatches';
import { myLeagueSummariesQuery } from '../../services/queries';
import Flag from '../Flag';
import LeagueRulesModal from '../LeagueRulesModal';
import InkStamp from '../InkStamp';
import SignVoters from '../voters/SignVoters';
import MatchVotersModal from '../voters/MatchVotersModal';
import { useMatchVoters } from '../../hooks/useMatchVoters';
import type { Match, MatchVoters } from '../../types/api';

const RANKING_SIZE = 5;

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

function PanelHeader({
  title,
  icon,
  onSeeAll,
}: {
  title: string;
  icon?: string;
  onSeeAll: () => void;
}) {
  return (
    <div className="home-list-header mb-2.5">
      <h2>
        {icon && <span aria-hidden="true">{icon}</span>}
        <span>{title}</span>
      </h2>
      <button type="button" className="home-link-btn" onClick={onSeeAll}>
        Ver todo →
      </button>
    </div>
  );
}

/** Fila compacta con posición, nombre y valor; la usan el ranking y la tabla de equipos. */
function MiniRow({
  rank,
  name,
  crest,
  detail,
  value,
  highlighted = false,
}: Pick<MiniStandingRow, 'rank' | 'name' | 'detail' | 'value'> & {
  crest?: ReactNode;
  highlighted?: boolean;
}) {
  return (
    <li
      className={`flex items-center justify-between gap-2 py-1.5 px-2.5 rounded-[8px] border bg-none ${highlighted ? 'bg-[rgba(11,_95,_116,_0.1)] border-[var(--marker-ink)]' : 'bg-[rgba(17,_24,_39,_0.04)] border-transparent'}`}
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className="w-4 text-center text-[0.78rem] text-muted shrink-0">{rank}</span>
        {crest}
        <span
          className={`text-[0.85rem] text-main overflow-hidden text-ellipsis whitespace-nowrap ${highlighted ? 'font-bold' : 'font-semibold'}`}
        >
          {name}
        </span>
      </div>
      <div className="flex gap-2.5 text-[0.85rem] items-baseline shrink-0">
        {detail && <span className="text-muted text-[0.75rem]">{detail}</span>}
        <span className="font-extrabold text-main">{value}</span>
      </div>
    </li>
  );
}

function MatchCard({
  match,
  action,
  onOpen,
  voters,
  onShowVoters,
}: {
  match: Match;
  action: string;
  onOpen: () => void;
  /** Quién ha votado cada signo; solo en ligas por jornadas y con el partido cerrado. */
  voters?: MatchVoters;
  onShowVoters?: (match: Match) => void;
}) {
  const isLive = isLiveMatch(match);
  const hasScore = match.home_score != null && match.away_score != null;
  const card = (
    <button
      type="button"
      className={`home-match-card${isLive ? ' is-live' : ''}`}
      onClick={onOpen}
      aria-label={`${match.home || 'Local'} contra ${match.away || 'Visitante'}, ${action}`}
    >
      <div className="home-match-meta">
        <span>{formatMatchDate(match.date)}</span>
        {isLive && <InkStamp size="sm">En directo</InkStamp>}
      </div>
      <div className="home-match-teams">
        <div className="home-match-team home">
          <span className="home-match-crest">
            <Flag
              team={match.home}
              logo={match.homeLogo || match.homeTeamLogo}
              style={{ width: '22px', height: '22px' }}
            />
          </span>
          <span className="home-match-name">{match.home || 'Local'}</span>
        </div>
        <div
          className={`home-match-score${isLive ? ' is-live' : ''}${hasScore ? '' : ' is-pending'}`}
        >
          {hasScore ? `${match.home_score} - ${match.away_score}` : formatKickOff(match.date)}
        </div>
        <div className="home-match-team away">
          <span className="home-match-name">{match.away || 'Visitante'}</span>
          <span className="home-match-crest">
            <Flag
              team={match.away}
              logo={match.awayLogo || match.awayTeamLogo}
              style={{ width: '22px', height: '22px' }}
            />
          </span>
        </div>
      </div>
    </button>
  );
  if (!voters || !onShowVoters) return card;
  return (
    <div>
      {card}
      <SignVoters
        voters={voters}
        matchName={`${match.home || 'Local'} - ${match.away || 'Visitante'}`}
        onOpen={() => onShowVoters(match)}
      />
    </div>
  );
}

/**
 * Portada de cualquier liga: cabecera con participantes y reglas, los partidos que tocan, el top del
 * ranking y una tabla corta de equipos. Los formatos solo cambian los datos (useLeagueHomeData).
 */
export default function LeagueHomeDashboard() {
  const {
    activeGroupId,
    activeGroupName,
    activeCompetitionName,
    activeGroupRules,
    leaderboardData,
    userName,
    userId,
    isAuthenticated,
    activeGroupPoolFormat,
  } = useAppContext();
  const { data: summaries } = useQuery(myLeagueSummariesQuery(isAuthenticated));
  const pending =
    summaries?.find((s) => s.groupId.toString() === activeGroupId?.toString())
      ?.pendingPredictions ?? 0;
  const { subtitle, matches, standings } = useLeagueHomeData();
  const navigate = useNavigate();
  const [showRules, setShowRules] = useState(false);
  const [votersMatch, setVotersMatch] = useState<Match | null>(null);
  // El servidor solo devuelve los partidos ya cerrados: los abiertos siguen ocultos.
  const voters = useMatchVoters(
    activeGroupPoolFormat === 'MATCH_DAY' ? activeGroupId : null,
    matches.items.map((match) => match.id).filter(Boolean),
  );

  // La competición solo se muestra si aporta información nueva respecto al nombre de la liga.
  const showCompetition =
    Boolean(activeCompetitionName) &&
    (activeCompetitionName ?? '').trim().toLowerCase() !==
      (activeGroupName || '').trim().toLowerCase();
  const participantCount = leaderboardData?.length || 0;
  const topParticipants = (leaderboardData ?? []).slice(0, RANKING_SIZE);

  return (
    <section className="view-section active max-w-270 my-0 mx-auto pt-1 pb-6 px-0">
      <MatchVotersModal
        voters={votersMatch ? (voters.get(votersMatch.id) ?? null) : null}
        homeTeam={votersMatch?.home || 'Local'}
        awayTeam={votersMatch?.away || 'Visitante'}
        onClose={() => setVotersMatch(null)}
      />
      {showRules && (
        <LeagueRulesModal
          group={{ id: activeGroupId, name: activeGroupName, rules: activeGroupRules }}
          onClose={() => setShowRules(false)}
        />
      )}

      <header className="home-hero paper-panel album-sheet">
        <div className="home-hero-info">
          <h1 className="home-hero-title">{activeGroupName || 'Mi Porra'}</h1>
          <div className="home-hero-pills">
            {showCompetition && <span className="home-hero-pill">{activeCompetitionName}</span>}
            <span className="home-hero-pill muted">
              {participantCount > 0
                ? `${participantCount} ${participantCount === 1 ? 'participante' : 'participantes'}`
                : subtitle}
            </span>
          </div>
        </div>
        <button type="button" className="home-rules-btn" onClick={() => setShowRules(true)}>
          Reglas
        </button>
      </header>

      {pending > 0 && (
        <button
          type="button"
          className="paper-panel album-sheet w-full flex items-center justify-between gap-3 px-4 py-3 mb-4.5 text-left cursor-pointer text-inherit font-[inherit] border-0"
          onClick={() => navigate(matches.to)}
        >
          <span className="font-bold text-[var(--stamp-red)]">
            Te {pending === 1 ? 'falta 1 predicción' : `faltan ${pending} predicciones`} para los
            próximos partidos
          </span>
          <span className="shrink-0 font-bold">Predecir →</span>
        </button>
      )}

      <div className="grid grid-cols-[repeat(auto-fit,_minmax(300px,_1fr))] gap-4.5">
        <div className="paper-panel album-sheet flex flex-col gap-2 min-w-0">
          <PanelHeader title={matches.title} onSeeAll={() => navigate(matches.allTo)} />
          {matches.items.length > 0 ? (
            matches.items.map((match) => (
              <MatchCard
                key={match.id || match.home + match.away}
                match={match}
                action={matches.action}
                onOpen={() => navigate(matches.to)}
                voters={voters.get(match.id)}
                onShowVoters={setVotersMatch}
              />
            ))
          ) : (
            <div className="paper-panel album-sheet p-6 text-center text-muted">
              {matches.empty}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4.5 min-w-0">
          <div className="paper-panel album-sheet p-4">
            <PanelHeader title="Ranking" icon="🏆" onSeeAll={() => navigate('/ranking')} />
            {topParticipants.length > 0 ? (
              <ol className="flex flex-col gap-1.5 m-0 p-0 list-none" aria-label="Top del ranking">
                {topParticipants.map((p, index) => {
                  const isMe = p.userId?.toString() === userId?.toString() || p.name === userName;
                  return (
                    <MiniRow
                      key={p.id || index}
                      rank={index + 1}
                      name={`${p.name}${isMe ? ' (Tú)' : ''}`}
                      value={`${p.total || 0} pts`}
                      highlighted={isMe}
                    />
                  );
                })}
              </ol>
            ) : (
              <div className="text-center text-muted text-[0.85rem] p-3">
                Aún no hay puntuaciones en esta liga.
              </div>
            )}
          </div>

          {standings && standings.rows.length > 0 && (
            <div className="paper-panel album-sheet p-4">
              <PanelHeader
                title={standings.title}
                icon="📊"
                onSeeAll={() => navigate(standings.to)}
              />
              <ol className="flex flex-col gap-1.5 m-0 p-0 list-none" aria-label={standings.title}>
                {standings.rows.map((row) => (
                  <MiniRow
                    key={row.team}
                    {...row}
                    crest={
                      <Flag
                        team={row.team}
                        logo={row.logo}
                        style={{ width: '20px', height: '20px' }}
                      />
                    }
                  />
                ))}
              </ol>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
