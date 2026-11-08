import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAppContext } from '../../context/AppContext';
import { useLeagueHomeData, type MiniStandingRow } from '../../hooks/useLeagueHomeData';
import { hasShownScore, isLiveMatch } from '../../utils/homeMatches';
import { finishedLabel, formatMatchDate, resultNote } from '../../utils/matchday';
import { myLeagueSummariesQuery } from '../../services/queries';
import Flag from '../Flag';
import { Skeleton } from '../SkeletonBlock';
import LeagueRulesModal from '../LeagueRulesModal';
import LeagueParticipantsDialog from '../league/LeagueParticipantsDialog';
import InkStamp from '../InkStamp';
import { VoterStack } from '../voters/SignVoters';
import MatchVotersModal from '../voters/MatchVotersModal';
import RoundParticipants from '../voters/RoundParticipants';
import { useMatchVoters } from '../../hooks/useMatchVoters';
import { useRoundParticipants } from '../../hooks/useRoundParticipants';
import type { Match, MatchVoter, MatchVoters } from '../../types/api';
import { MATCH_KINDS } from '../../context/leagueKind';
import { fightOutcomes, fightResultText } from '../../utils/fights';
import { FightBadge, FightResultLine } from '../fight/FightResult';

const RANKING_SIZE = 5;

function formatKickOff(date: string | null) {
  if (!date) return 'VS';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return 'VS';
  return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

function PanelHeader({
  title,
  icon,
  onSeeAll,
  children,
  reserveExtra = false,
}: {
  title: string;
  icon?: string;
  onSeeAll: () => void;
  /** Lo que va entre el título y «Ver todo», como quién ya ha hecho su predicción. */
  children?: ReactNode;
  /** Deja ya el alto de `children` (44 px), que llega después: así no empuja lo de debajo. */
  reserveExtra?: boolean;
}) {
  return (
    <div
      className={`home-list-header mb-2.5${children ? ' has-extra' : ''}${reserveExtra ? ' min-h-11' : ''}`}
    >
      <h2>
        {icon && <span aria-hidden="true">{icon}</span>}
        <span>{title}</span>
      </h2>
      {children}
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
  twoWay = false,
}: {
  match: Match;
  action: string;
  onOpen: () => void;
  /** Quién ha votado cada signo (o cada equipo en los cruces de cuadro), con el partido cerrado. */
  voters?: MatchVoters;
  onShowVoters?: (match: Match) => void;
  twoWay?: boolean;
}) {
  const isLive = isLiveMatch(match);
  const home = match.home || 'Local';
  const away = match.away || 'Visitante';
  // Una pelea de la UFC no tiene marcador: cada luchador lleva su W o L y debajo va cómo acabó.
  const outcomes = fightOutcomes(match.fight, match.finished);
  const hasScore = !match.fight && hasShownScore(match);
  const result = outcomes
    ? fightResultText({ homeTeam: home, awayTeam: away, fight: match.fight })
    : '';
  const matchName = `${home} - ${away}`;
  // Un empate de Copa decidido en los penaltis, o un partido que fue a la prórroga, lo dice bajo el marcador.
  const note = hasScore && match.finished ? resultNote(match.displayClock) : null;
  // Las fotos van dentro de la tarjeta: bajo cada equipo y, en las jornadas, el empate bajo el marcador.
  const voterStack = (list: MatchVoter[], label: string) =>
    voters && onShowVoters ? (
      <VoterStack
        list={list}
        label={label}
        matchName={matchName}
        onOpen={() => onShowVoters(match)}
      />
    ) : null;
  return (
    <div className={`home-match-card${isLive ? ' is-live' : ''}`}>
      <button
        type="button"
        className="home-match-open"
        onClick={onOpen}
        aria-label={`${home} contra ${away}${result ? ` (${result})` : ''}${note ? ` (${note})` : ''}, ${action}`}
      />
      <div className="home-match-meta">
        <span>{formatMatchDate(match.date)}</span>
        {isLive && <InkStamp size="sm">En directo</InkStamp>}
      </div>
      <div className="home-match-teams">
        <div className="home-match-side home">
          <div className="home-match-team home">
            <span className="home-match-crest">
              <Flag
                team={match.home}
                logo={match.homeLogo || match.homeTeamLogo}
                style={{ width: '22px', height: '22px' }}
              />
            </span>
            <span className="home-match-name">{home}</span>
          </div>
          {voterStack(voters?.home ?? [], twoWay ? home : '1')}
        </div>
        <div className="home-match-side">
          {/* UFC: la W y la L junto a «Final», siempre en el mismo sitio sea cual sea el nombre. */}
          <div className="home-match-result">
            {outcomes && <FightBadge outcome={outcomes.home} size="sm" />}
            <div
              className={`home-match-score${isLive ? ' is-live' : ''}${hasScore ? '' : ' is-pending'}`}
            >
              {hasScore
                ? `${match.home_score} - ${match.away_score}`
                : outcomes
                  ? 'Final'
                  : formatKickOff(match.date)}
            </div>
            {outcomes && <FightBadge outcome={outcomes.away} size="sm" />}
          </div>
          {voterStack(twoWay ? [] : (voters?.draw ?? []), 'X')}
        </div>
        <div className="home-match-side away">
          <div className="home-match-team away">
            <span className="home-match-name">{away}</span>
            <span className="home-match-crest">
              <Flag
                team={match.away}
                logo={match.awayLogo || match.awayTeamLogo}
                style={{ width: '22px', height: '22px' }}
              />
            </span>
          </div>
          {voterStack(voters?.away ?? [], twoWay ? away : '2')}
        </div>
      </div>
      {outcomes && <FightResultLine fight={match.fight} className="home-match-fight" />}
      {note && <p className="home-match-note">{note.charAt(0).toUpperCase() + note.slice(1)}</p>}
    </div>
  );
}

/**
 * Portada de cualquier liga: cabecera con participantes y reglas, los partidos que tocan, el top del
 * ranking y una tabla corta de equipos. Los formatos solo cambian los datos (useLeagueHomeData).
 */
/** Filas de un panel mientras llegan sus datos. */
function SkeletonRows({ count, height }: { count: number; height: number }) {
  return (
    <div className="flex flex-col gap-1.5" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <Skeleton key={index} height={height} radius={4} />
      ))}
    </div>
  );
}

/**
 * Los paneles de la portada con la forma que tendrán. Se enseñan hasta que llegan los partidos, el
 * ranking, la tabla y el aviso de predicciones pendientes, y entonces aparecen todos a la vez: si
 * no, cada panel pasaría de vacío a lleno por su cuenta y la página se iría estirando a saltos.
 */
function DashboardSkeleton() {
  return (
    <div
      className="grid grid-cols-[repeat(auto-fit,_minmax(300px,_1fr))] gap-4.5"
      role="status"
      aria-label="Cargando la liga"
      aria-busy="true"
    >
      <div className="paper-panel album-sheet flex flex-col gap-2 min-w-0 p-4">
        <Skeleton width="40%" height={20} />
        <SkeletonRows count={5} height={74} />
      </div>
      <div className="flex flex-col gap-4.5 min-w-0">
        <div className="paper-panel album-sheet p-4 flex flex-col gap-2.5">
          <Skeleton width="30%" height={20} />
          <SkeletonRows count={5} height={32} />
        </div>
        <div className="paper-panel album-sheet p-4 flex flex-col gap-2.5">
          <Skeleton width="30%" height={20} />
          <SkeletonRows count={5} height={32} />
        </div>
      </div>
    </div>
  );
}

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
    leagueKind,
    activeGroupWinnerOnly,
    loading: loadingOfficialData,
    loadingLeaderboard,
  } = useAppContext();
  const { data: summaries, isLoading: loadingSummaries } = useQuery(
    myLeagueSummariesQuery(isAuthenticated),
  );
  const pending =
    summaries?.find((s) => s.groupId.toString() === activeGroupId?.toString())
      ?.pendingPredictions ?? 0;
  const { subtitle, matches, standings, loading: loadingHomeData } = useLeagueHomeData();
  const settling = loadingOfficialData || loadingLeaderboard || loadingHomeData || loadingSummaries;
  const navigate = useNavigate();
  const [showRules, setShowRules] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [votersMatch, setVotersMatch] = useState<Match | null>(null);
  // El servidor solo devuelve los partidos ya cerrados: los abiertos siguen ocultos. En las ligas de
  // cuadro cada uno aparece bajo el equipo que pasa en su pronóstico, sin empate.
  const voters = useMatchVoters(
    activeGroupId,
    matches.items.map((match) => match.id).filter(Boolean),
  );
  const twoWayVoters = activeGroupPoolFormat !== 'MATCH_DAY' || activeGroupWinnerOnly;
  // Quién ya ha hecho su predicción en la jornada: solo las ligas por jornadas y solo el quién.
  const participants = useRoundParticipants(
    activeGroupId,
    matches.items.map((match) => match.id).filter(Boolean),
    isAuthenticated && MATCH_KINDS[leagueKind],
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
        homeLogo={votersMatch?.homeLogo || votersMatch?.homeTeamLogo}
        awayLogo={votersMatch?.awayLogo || votersMatch?.awayTeamLogo}
        homeScore={votersMatch?.home_score}
        awayScore={votersMatch?.away_score}
        live={Boolean(votersMatch && isLiveMatch(votersMatch))}
        status={
          !votersMatch
            ? undefined
            : votersMatch.finished
              ? finishedLabel(votersMatch.displayClock)
              : isLiveMatch(votersMatch)
                ? votersMatch.displayClock || 'En directo'
                : undefined
        }
        twoWay={twoWayVoters}
        onClose={() => setVotersMatch(null)}
      />
      {showParticipants && activeGroupId && (
        <LeagueParticipantsDialog
          groupId={activeGroupId}
          groupName={activeGroupName || 'Mi Porra'}
          onClose={() => setShowParticipants(false)}
        />
      )}
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
            {participantCount > 0 && activeGroupId ? (
              <button
                type="button"
                className="home-hero-pill-btn"
                onClick={() => setShowParticipants(true)}
                aria-haspopup="dialog"
                aria-label={`${participantCount} ${participantCount === 1 ? 'participante' : 'participantes'}: ver la lista`}
              >
                <span className="home-hero-pill muted">
                  {participantCount} {participantCount === 1 ? 'participante' : 'participantes'}
                </span>
              </button>
            ) : (
              <span className="home-hero-pill muted">{subtitle}</span>
            )}
          </div>
        </div>
        <button type="button" className="home-rules-btn" onClick={() => setShowRules(true)}>
          Reglas
        </button>
      </header>

      {settling ? (
        <DashboardSkeleton />
      ) : (
        <>
          {pending > 0 && (
            <button
              type="button"
              className="paper-panel album-sheet w-full flex items-center justify-between gap-3 px-4 py-3 mb-4.5 text-left cursor-pointer font-[inherit] border-0"
              onClick={() => navigate(matches.to)}
            >
              <span className="font-bold text-[var(--stamp-red)]">
                Te {pending === 1 ? 'falta 1 predicción' : `faltan ${pending} predicciones`} para
                los próximos partidos
              </span>
              <span className="shrink-0 font-bold">Predecir →</span>
            </button>
          )}

          <div className="grid grid-cols-[repeat(auto-fit,_minmax(300px,_1fr))] gap-4.5">
            <div className="paper-panel album-sheet flex flex-col gap-2 min-w-0">
              <PanelHeader
                title={matches.title}
                onSeeAll={() => navigate(matches.allTo)}
                reserveExtra={MATCH_KINDS[leagueKind]}
              >
                <RoundParticipants participants={participants} roundLabel={matches.title} />
              </PanelHeader>
              {matches.items.length > 0 ? (
                matches.items.map((match) => (
                  <MatchCard
                    key={match.id || match.home + match.away}
                    match={match}
                    // Empezado el partido, la tarjeta enseña quién eligió cada opción; antes, lleva a
                    // hacer tu predicción (las de los demás siguen ocultas hasta el pitido inicial).
                    action={
                      voters.has(match.id) ? 'ver quién ha elegido cada opción' : matches.action
                    }
                    onOpen={() =>
                      voters.has(match.id) ? setVotersMatch(match) : navigate(matches.to)
                    }
                    voters={voters.get(match.id)}
                    onShowVoters={setVotersMatch}
                    twoWay={twoWayVoters}
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
                <PanelHeader title="Ranking" onSeeAll={() => navigate('/ranking')} />
                {topParticipants.length > 0 ? (
                  <ol
                    className="flex flex-col gap-1.5 m-0 p-0 list-none"
                    aria-label="Top del ranking"
                  >
                    {topParticipants.map((p, index) => {
                      const isMe =
                        p.userId?.toString() === userId?.toString() || p.name === userName;
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
                  <PanelHeader title={standings.title} onSeeAll={() => navigate(standings.to)} />
                  <ol
                    className="flex flex-col gap-1.5 m-0 p-0 list-none"
                    aria-label={standings.title}
                  >
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
        </>
      )}
    </section>
  );
}
