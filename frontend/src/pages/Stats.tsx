import { useAppContext } from '../context/AppContext';
import LeagueLoadState from '../components/LeagueLoadState';
import { useBracketInsights } from '../hooks/useBracketInsights';
import { useGrandPrixInsights } from '../hooks/useGrandPrixInsights';
import { useKnockoutInsights } from '../hooks/useKnockoutInsights';
import InsightsHeader from '../components/insights/InsightsHeader';
import BracketInsightsGate from '../components/insights/BracketInsightsGate';
import BracketStats from '../components/insights/BracketStats';
import GrandPrixInsightsGate from '../components/insights/GrandPrixInsightsGate';
import GrandPrixStats from '../components/insights/GrandPrixStats';
import KnockoutInsightsGate from '../components/insights/KnockoutInsightsGate';
import KnockoutStats from '../components/insights/KnockoutStats';
import MatchdayStatsView from '../components/insights/MatchdayStatsView';
import { InsightsNotice } from '../components/insights/InsightCard';
import type { OfficialState } from '../utils/bracketStats';
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
 * Estadísticas de la liga activa. En las ligas de cuadro, en las eliminatorias y en la Fórmula 1,
 * lo más elegido comparado con lo real; en las de jornadas, el reparto de pronósticos de cada
 * partido ya empezado.
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
    tennisDraw: <MatchdayStatsPage />,
    grandPrix: <GrandPrixStatsPage />,
    // Lo más elegido compara las predicciones con el cuadro real de esa competición.
    customBracket: <KnockoutStatsPage />,
    ownBracket: <KnockoutStatsPage />,
    knockoutDraw: <KnockoutStatsPage />,
  };
  return views[leagueKind];
}

/** Lo más elegido en cada ronda de unas eliminatorias o de un cuadro propio. */
function KnockoutStatsPage() {
  const insights = useKnockoutInsights();
  const count = insights.entries.length;
  return (
    <section id="view-stats" className="view-section block paper-panel album-sheet landing-tape">
      <InsightsHeader
        leagueName={insights.leagueName}
        summary={count > 0 ? `${count} ${count === 1 ? 'predicción' : 'predicciones'}` : undefined}
      />
      <KnockoutInsightsGate insights={insights}>
        <KnockoutStats entries={insights.entries} field={insights.field} logos={insights.logos} />
      </KnockoutInsightsGate>
    </section>
  );
}

/** Lo más elegido de cada Gran Premio ya cerrado, comparado con el resultado. */
function GrandPrixStatsPage() {
  const insights = useGrandPrixInsights();
  const count = insights.races.length;
  const summary =
    count > 0
      ? `${count} ${count === 1 ? 'Gran Premio cerrado' : 'Grandes Premios cerrados'}`
      : undefined;
  return (
    <section id="view-stats" className="view-section block paper-panel album-sheet landing-tape">
      <InsightsHeader leagueName={insights.leagueName} summary={summary} />
      <GrandPrixInsightsGate insights={insights}>
        <GrandPrixStats races={insights.races} drivers={insights.drivers} />
      </GrandPrixInsightsGate>
    </section>
  );
}

/** Reparto de pronósticos de cada partido ya empezado. */
function MatchdayStatsPage() {
  const { activeGroupId, activeGroupName } = useAppContext();
  return (
    <section id="view-stats" className="view-section block paper-panel album-sheet landing-tape">
      <InsightsHeader leagueName={activeGroupName} summary="Por partido" />
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
      <InsightsHeader leagueName={insights.leagueName} summary={summary} />
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
