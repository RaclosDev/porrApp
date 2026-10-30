import { useAppContext } from '../context/AppContext';
import { useBracketInsights } from '../hooks/useBracketInsights';
import InsightsHeader from '../components/insights/InsightsHeader';
import BracketInsightsGate from '../components/insights/BracketInsightsGate';
import BracketStats from '../components/insights/BracketStats';
import MatchdayStatsView from '../components/insights/MatchdayStatsView';
import { InsightsNotice } from '../components/insights/InsightCard';
import type { OfficialState } from '../utils/bracketStats';

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
  const { activeGroupId, activeGroupName, activeGroupPoolFormat, activeCompetitionFormatType } =
    useAppContext();

  if (activeGroupPoolFormat === 'MATCH_DAY' || activeCompetitionFormatType === 'LEAGUE') {
    return (
      <section id="view-stats" className="view-section block">
        <InsightsHeader leagueName={activeGroupName} summary="Por partido" withSearch={false} />
        {activeGroupId ? (
          <MatchdayStatsView groupId={activeGroupId} />
        ) : (
          <InsightsNotice title="No hay ninguna liga seleccionada" />
        )}
      </section>
    );
  }
  return <BracketStatsPage />;
}

function BracketStatsPage() {
  const insights = useBracketInsights();
  const count = insights.entries.length;
  const summary =
    count > 0 && !insights.loading
      ? `${count} ${count === 1 ? 'cuadro' : 'cuadros'} · ${tournamentSummary(insights.official)}`
      : undefined;

  return (
    <section id="view-stats" className="view-section block">
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
