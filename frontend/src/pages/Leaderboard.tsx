import React, { useEffect, useState, Suspense } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { NoLeagueState } from '../components/NoLeagueState';
import { BarChart3, Search, Share2 } from 'lucide-react';
import MatchdayPodium from '../components/MatchdayPodium';
import PaperLoading from '../components/PaperLoading';
import LeaderboardTable from '../components/leaderboard/LeaderboardTable';
import MatchdaySummary from '../components/leaderboard/MatchdaySummary';
import ShareImageTemplate from '../components/leaderboard/ShareImageTemplate';
import { leaderboardColumns } from '../components/leaderboard/leaderboardColumns';
import { useLeaderboard, type LeaderboardRow } from '../hooks/useLeaderboard';
import { useRequestedGroup } from '../hooks/useRequestedGroup';
import type { MatchdayPoints } from '../types/api';
import { displayRoundLabel } from '../utils/matchday';
import type { LeagueKind } from '../context/leagueKind';
import { LEAGUE_INSIGHTS } from '../context/leagueInsights';

const EvolutionChart = React.lazy(() => import('../components/EvolutionChart'));

type RankingTab = 'table' | 'evolution';

/** Cómo es la clasificación de cada clase de liga. */
interface RankingLayout {
  /** Suma por jornada (o por Gran Premio): desglose por jornada, sin gráfica ni podio general. */
  byRound: boolean;
  /** Cuadro propio: sus columnas de rondas. */
  ownBracket: boolean;
  /** Adónde lleva tocar una fila: sus predicciones o el visor de su cuadro. */
  openRow: '/jornadas' | 'viewer' | null;
  /** Columna de puntos de la jornada (no en la Fórmula 1). */
  roundPointsColumn: boolean;
}

const NO_RANKING: RankingLayout = {
  byRound: false,
  ownBracket: false,
  openRow: null,
  roundPointsColumn: false,
};
const OWN_BRACKET_RANKING: RankingLayout = {
  byRound: false,
  ownBracket: true,
  openRow: 'viewer',
  roundPointsColumn: false,
};
const MATCHDAY_RANKING: RankingLayout = {
  byRound: true,
  ownBracket: false,
  openRow: '/jornadas',
  roundPointsColumn: true,
};

const RANKING_LAYOUT: Record<LeagueKind, RankingLayout> = {
  groupStage: {
    byRound: false,
    ownBracket: false,
    openRow: 'viewer',
    roundPointsColumn: false,
  },
  customBracket: OWN_BRACKET_RANKING,
  ownBracket: OWN_BRACKET_RANKING,
  knockoutDraw: OWN_BRACKET_RANKING,
  matchday: MATCHDAY_RANKING,
  fightCard: MATCHDAY_RANKING,
  tennisDraw: MATCHDAY_RANKING,
  // En la Fórmula 1 no hay una página con las predicciones de cada participante: se ven en cada Gran
  // Premio, en «Predicciones de la liga». Abrir una fila llevaría a las propias.
  grandPrix: { ...MATCHDAY_RANKING, openRow: null, roundPointsColumn: false },
  loading: NO_RANKING,
  error: NO_RANKING,
  none: NO_RANKING,
  unknown: NO_RANKING,
};

/**
 * Abre la jornada de `?jornada=` (desde el aviso de fin de jornada) en cuanto la liga la tiene.
 * Espera mientras se cambia a la liga del aviso, para no buscarla entre las de la anterior.
 */
function useRequestedMatchday(
  waiting: boolean,
  matchdays: MatchdayPoints[],
  select: (label: string) => void,
) {
  const [params, setParams] = useSearchParams();
  const requested = params.get('jornada');
  useEffect(() => {
    if (!requested || waiting || !matchdays.some((matchday) => matchday.label === requested)) {
      return;
    }
    select(requested);
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.delete('jornada');
        return next;
      },
      { replace: true },
    );
  }, [requested, waiting, matchdays, select, setParams]);
}

/** Clasificación de la liga activa (tabla y gráfica). */
function Leaderboard() {
  const {
    state,
    results,
    loading,
    activeGroupName,
    activeGroupId,
    activeGroupPichichi,
    userId,
    userName,
    lowestPaidRank,
    sharing,
    handleShare,
    validResults,
    generalValidResults,
    generalLowestPaidRank,
    sortColumn,
    sortDirection,
    handleSort,
    matchdays,
    currentMatchday,
    selectedMatchday,
    selectedMatchdayInfo,
    matchdayStats,
    canGoPrevMatchday,
    canGoNextMatchday,
    handleSelectMatchday,
    handleRankingView,
    handleStepMatchday,
  } = useLeaderboard();

  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<RankingTab>('table');
  // En móvil el desglose por fase va oculto hasta que se pide.
  const [showDetail, setShowDetail] = useState(false);
  const switchingGroup = useRequestedGroup(state);
  useRequestedMatchday(switchingGroup || loading, matchdays, handleSelectMatchday);

  if (loading || switchingGroup) return <PaperLoading label="Cargando clasificación" />;
  if (!activeGroupId) return <NoLeagueState title="Clasificación" what="la clasificación" />;

  const layout = RANKING_LAYOUT[state.leagueKind];
  // Enlaces a Estadísticas y al Buscador: solo en las clases de liga que tienen esas pantallas.
  const insights = LEAGUE_INSIGHTS[state.leagueKind];
  const insightLinks = insights.stats && (
    <nav aria-label="Estadísticas de la liga" className="ranking-secondary-links">
      <Link to="/stats" className="ranking-secondary-link">
        <BarChart3 size={16} aria-hidden="true" />
        {insights.stats}
      </Link>
      {insights.search && (
        <Link to="/search" className="ranking-secondary-link">
          <Search size={16} aria-hidden="true" />
          Buscador
        </Link>
      )}
    </nav>
  );
  const isMatchday = layout.byRound;
  const columns = leaderboardColumns({
    isMatchday,
    ownBracket: layout.ownBracket,
    pichichi: activeGroupPichichi,
    ownBracketHasGroupPoints: validResults.some((row) => (row.points.r1 ?? 0) !== 0),
    selectedMatchday,
    roundPointsColumn: layout.roundPointsColumn,
  });
  const summaryMatchday = selectedMatchdayInfo || currentMatchday;
  // Clasificación de la jornada elegida en vez de la general (se activa al cambiar de jornada).
  const byMatchday = isMatchday && Boolean(summaryMatchday) && sortColumn === 'matchday';
  const matchdayName = summaryMatchday ? displayRoundLabel(summaryMatchday.label) : '';
  const openRow = (row: LeaderboardRow) => {
    if (layout.openRow === 'viewer') state.setViewerPredictionId(row.id ?? null);
    else if (layout.openRow) navigate(layout.openRow);
  };

  const shareButton = (className: string, iconSize: number) => (
    <button
      type="button"
      className={className}
      onClick={handleShare}
      disabled={sharing}
      aria-busy={sharing}
      aria-label="Compartir clasificación"
    >
      <Share2 size={iconSize} aria-hidden="true" />
      <span>{sharing ? 'Generando…' : 'Compartir'}</span>
    </button>
  );

  return (
    <section id="view-leaderboard" className="view-section block">
      {!isMatchday && (
        <div className="ranking-toolbar">
          {/* Las flechas se gestionan en el tablist y el foco va en las pestañas (tabindex móvil). */}
          {/* eslint-disable-next-line jsx-a11y/interactive-supports-focus */}
          <div
            role="tablist"
            aria-label="Vista de la clasificación"
            className="ranking-view-tabs"
            onKeyDown={(event) => {
              if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
              event.preventDefault();
              const next: RankingTab =
                event.key === 'Home'
                  ? 'table'
                  : event.key === 'End'
                    ? 'evolution'
                    : activeTab === 'table'
                      ? 'evolution'
                      : 'table';
              setActiveTab(next);
              document.getElementById(`leaderboard-tab-${next}`)?.focus();
            }}
          >
            {(['table', 'evolution'] as const).map((tab) => (
              <button
                key={tab}
                className={`ranking-view-tab ${activeTab === tab ? 'is-active' : ''}`}
                type="button"
                onClick={() => setActiveTab(tab)}
                role="tab"
                id={`leaderboard-tab-${tab}`}
                aria-selected={activeTab === tab}
                aria-controls="leaderboard-panel"
                tabIndex={activeTab === tab ? 0 : -1}
              >
                {tab === 'table' ? 'Ranking' : 'Gráfica'}
              </button>
            ))}
          </div>
          {insightLinks}
          <button
            className="ranking-share-button"
            id="btn-share-wa"
            onClick={handleShare}
            disabled={sharing}
            title="Compartir clasificación"
            aria-label="Compartir clasificación"
            aria-busy={sharing}
          >
            <Share2 size={20} aria-hidden="true" />
            <span className="ml-2">{sharing ? 'Generando…' : 'Compartir'}</span>
          </button>
        </div>
      )}

      <div
        id="leaderboard-panel"
        role={isMatchday ? 'region' : 'tabpanel'}
        aria-label={isMatchday ? 'Clasificación' : undefined}
        aria-labelledby={isMatchday ? undefined : `leaderboard-tab-${activeTab}`}
        tabIndex={isMatchday ? undefined : 0}
      >
        {!isMatchday && activeTab === 'evolution' ? (
          <div className="w-full mt-2.5">
            <Suspense fallback={<PaperLoading label="Cargando gráfica" />}>
              <EvolutionChart
                groupId={activeGroupId}
                validResults={validResults}
                userName={userName}
                allGames={state.allGames}
              />
            </Suspense>
          </div>
        ) : (
          <>
            {isMatchday && summaryMatchday && (
              <MatchdaySummary
                matchday={summaryMatchday}
                selected={selectedMatchdayInfo}
                matchdays={matchdays}
                selectedLabel={selectedMatchday}
                myPoints={matchdayStats?.myPoints ?? 0}
                myRank={matchdayStats?.myRank ?? null}
                canGoPrev={canGoPrevMatchday}
                canGoNext={canGoNextMatchday}
                onSelect={handleSelectMatchday}
                onStep={handleStepMatchday}
                fightCard={state.leagueKind === 'fightCard'}
                insights={insights}
              />
            )}

            {!isMatchday && <MatchdayPodium rows={results} />}
            <div className="flex gap-5 items-start flex-wrap justify-center w-full">
              <div
                className={`table-container paper-panel album-sheet flex-1 min-w-75 max-w-350 my-0 mx-auto ${showDetail ? 'show-detail' : ''}`}
              >
                {isMatchday && (
                  <>
                    <div className="matchday-ranking-heading">
                      <h2 className="poster-title">
                        {byMatchday ? `Clasificación · ${matchdayName}` : 'Clasificación general'}
                      </h2>
                      {shareButton('matchday-ranking-share', 18)}
                    </div>
                    {summaryMatchday && (
                      <div className="md-filters matchday-ranking-toggle">
                        {(['general', 'matchday'] as const).map((view) => (
                          <button
                            key={view}
                            type="button"
                            aria-pressed={byMatchday === (view === 'matchday')}
                            onClick={() => handleRankingView(view)}
                            className={`md-filter${byMatchday === (view === 'matchday') ? ' is-active' : ''}`}
                          >
                            {view === 'general' ? 'General' : matchdayName}
                          </button>
                        ))}
                      </div>
                    )}
                    <MatchdayPodium
                      rows={results}
                      by={byMatchday ? 'matchday' : 'total'}
                      label={
                        byMatchday
                          ? `Podio de la ${matchdayName}`
                          : 'Podio de la clasificación general'
                      }
                    />
                    {!summaryMatchday && insightLinks}
                  </>
                )}
                {!isMatchday && (
                  <button
                    type="button"
                    className="lb-detail-toggle glass-btn py-1.5 px-3 text-[0.8rem]"
                    aria-pressed={showDetail}
                    onClick={() => setShowDetail((v) => !v)}
                  >
                    {showDetail ? 'Ocultar desglose' : 'Ver desglose por fase'}
                  </button>
                )}
                <LeaderboardTable
                  rows={results}
                  columns={columns}
                  isMatchday={isMatchday}
                  lowestPaidRank={lowestPaidRank}
                  userId={userId}
                  userName={userName}
                  sortColumn={sortColumn}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                  onOpenRow={layout.openRow ? openRow : undefined}
                />
              </div>
            </div>
          </>
        )}
      </div>

      <ShareImageTemplate
        rows={generalValidResults}
        competitionName={state.activeCompetitionName}
        leagueName={activeGroupName}
        lowestPaidRank={generalLowestPaidRank}
        userId={userId}
        userName={userName}
      />
    </section>
  );
}

export default Leaderboard;
