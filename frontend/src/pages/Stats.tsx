import { useAppContext } from '../context/AppContext';
import LeagueLoadState from '../components/LeagueLoadState';
import { useBracketInsights } from '../hooks/useBracketInsights';
import InsightsHeader from '../components/insights/InsightsHeader';
import BracketInsightsGate from '../components/insights/BracketInsightsGate';
import BracketStats from '../components/insights/BracketStats';
import MatchdayStatsView from '../components/insights/MatchdayStatsView';
import { InsightsNotice } from '../components/insights/InsightCard';
import type { OfficialState } from '../utils/bracketStats';
import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { NoLeagueState, UnsupportedLeagueState } from '../components/NoLeagueState';
import type { LeagueKind } from '../context/leagueKind';

/** Resumen del torneo para la cabecera. */
function tournamentSummary(official: OfficialState): string {
  if (official.finished) return 'Torneo terminado';
  if (official.started) return 'Torneo en juego';
  return 'El torneo no ha empezado';
}

/**
 * Estadísticas de la liga activa. En las ligas de cuadro, lo más elegido comparado con lo
 * real; en las de jornadas, el reparto de pronósticos de cada partido ya empezado.
 */
function Stats() {
  const { leagueKind, groupError } = useAppContext();
  const views: Record<LeagueKind, ReactNode> = {
    loading: <LeagueLoadState />,
    error: <LeagueLoadState error={groupError} />,
    none: <NoLeagueState title="Estadísticas" what="las estadísticas" />,
    unknown: <UnsupportedLeagueState />,
    // Lo más elegido compara los cuadros con el oficial del Mundial.
    worldCup: <WorldCupStatsPage />,
    matchday: <MatchdayStatsPage />,
    fightCard: <MatchdayStatsPage />,
    // Sin estadísticas propias: los cuadros propios, las eliminatorias sorteadas y la Fórmula 1.
    customBracket: <Navigate to="/" replace />,
    ownBracket: <Navigate to="/" replace />,
    knockoutDraw: <Navigate to="/" replace />,
    grandPrix: <Navigate to="/" replace />,
  };
  return views[leagueKind];
}

/** Reparto de pronósticos de cada partido ya empezado. */
function MatchdayStatsPage() {
  const { activeGroupId, activeGroupName } = useAppContext();
  return (
    <section id="view-stats" className="view-section block paper-panel album-sheet landing-tape">
      <InsightsHeader leagueName={activeGroupName} summary="Por partido" withSearch={false} />
      {activeGroupId ? (
        <MatchdayStatsView groupId={activeGroupId} />
      ) : (
        <InsightsNotice title="No hay ninguna liga seleccionada" />
      )}
    </section>
  );
}

/** Lo más elegido en los cuadros del Mundial de la liga, comparado con lo real. */
function WorldCupStatsPage() {
  const insights = useBracketInsights();
  const count = insights.entries.length;
  const summary =
    count > 0 && !insights.loading
      ? `${count} ${count === 1 ? 'cuadro' : 'cuadros'} · ${tournamentSummary(insights.official)}`
      : undefined;

  return (
    <section id="view-stats" className="view-section block paper-panel album-sheet landing-tape">
      <InsightsHeader leagueName={insights.leagueName} summary={summary} withSearch />
      <BracketInsightsGate insights={insights}>
        <BracketStats
          entries={insights.entries}
          official={insights.official}
          knockoutsOnly={insights.knockoutsOnly}
          pichichi={insights.pichichi}
        />
      </BracketInsightsGate>
    </section>
  );
}

export default Stats;
