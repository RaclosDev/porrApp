import { Navigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import LeagueLoadState from '../components/LeagueLoadState';
import { useGrandPrixInsights } from '../hooks/useGrandPrixInsights';
import { useGroupStageInsights } from '../hooks/useGroupStageInsights';
import { useKnockoutInsights } from '../hooks/useKnockoutInsights';
import InsightsHeader from '../components/insights/InsightsHeader';
import GrandPrixInsightsGate from '../components/insights/GrandPrixInsightsGate';
import GrandPrixStats from '../components/insights/GrandPrixStats';
import GroupWinnerPicks from '../components/insights/GroupWinnerPicks';
import KnockoutInsightsGate from '../components/insights/KnockoutInsightsGate';
import KnockoutStats from '../components/insights/KnockoutStats';
import MatchdayStatsView from '../components/insights/MatchdayStatsView';
import ScorerPicks from '../components/insights/ScorerPicks';
import { InsightsNotice } from '../components/insights/InsightCard';
import type { ReactNode } from 'react';
import { NoLeagueState, UnsupportedLeagueState } from '../components/NoLeagueState';
import type { LeagueKind } from '../context/leagueKind';

/** Las selecciones no traen escudo: se pinta su bandera. */
const NO_LOGOS = {};

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
    // Liga de juegos de mesa: no hay predicciones; su inicio es el marcador.
    scoreboard: <Navigate to="/" replace />,
    tournament: <Navigate to="/" replace />,
    poker: <Navigate to="/" replace />,
    // El Mundial es un cuadro más, con la fase de grupos y el pichichi aparte.
    groupStage: <GroupStageStatsPage />,
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

/**
 * Lo más elegido en un torneo con fase de grupos: las rondas salen del cuadro genérico y lo que no
 * es del cuadro (pichichi y primeros de grupo) va en sus propias tarjetas.
 */
function GroupStageStatsPage() {
  const insights = useGroupStageInsights();
  const { entries, tournament } = insights;
  const count = entries.length;
  const progress = tournament.finished
    ? 'Torneo terminado'
    : tournament.started
      ? 'Torneo en juego'
      : 'El torneo no ha empezado';

  return (
    <section id="view-stats" className="view-section block paper-panel album-sheet landing-tape">
      <InsightsHeader
        leagueName={insights.leagueName}
        summary={
          count > 0
            ? `${count} ${count === 1 ? 'predicción' : 'predicciones'} · ${progress}`
            : undefined
        }
      />
      <KnockoutInsightsGate insights={insights}>
        <KnockoutStats entries={entries} field={insights.field} logos={NO_LOGOS}>
          {insights.pichichi && (
            <ScorerPicks
              entries={entries}
              real={tournament.scorers}
              finished={tournament.finished}
            />
          )}
          {!insights.knockoutsOnly && (
            <GroupWinnerPicks entries={entries} tournament={tournament} logos={NO_LOGOS} />
          )}
        </KnockoutStats>
      </KnockoutInsightsGate>
    </section>
  );
}

export default Stats;
