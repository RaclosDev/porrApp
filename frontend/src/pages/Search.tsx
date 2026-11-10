import { useMemo, type ReactNode } from 'react';
import LeagueLoadState from '../components/LeagueLoadState';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import InsightsHeader from '../components/insights/InsightsHeader';
import { InsightsNotice } from '../components/insights/InsightCard';
import TennisSearch from '../components/insights/TennisSearch';
import GrandPrixInsightsGate from '../components/insights/GrandPrixInsightsGate';
import GrandPrixSearch from '../components/insights/GrandPrixSearch';
import { useGrandPrixInsights } from '../hooks/useGrandPrixInsights';
import KnockoutInsightsGate from '../components/insights/KnockoutInsightsGate';
import KnockoutSearch, { type ExtraRows } from '../components/insights/KnockoutSearch';
import { useGroupStageInsights } from '../hooks/useGroupStageInsights';
import { useKnockoutInsights } from '../hooks/useKnockoutInsights';
import { roundOfStage, type GroupPosition } from '../utils/groupStageBracket';
import { positionPickers, positionRows, teamsByGroup } from '../utils/groupStagePicks';
import { pickedTeams } from '../utils/knockoutStats';
import { NoLeagueState, UnsupportedLeagueState } from '../components/NoLeagueState';
import type { LeagueKind } from '../context/leagueKind';

/**
 * Condiciones de los enlaces del primer buscador (`condition=reaches_r16`), que después pasaron a
 * nombrar la ronda a la que llega el equipo (`stage=r16`). Los dos se siguen abriendo.
 */
const LEGACY_CONDITIONS: Record<string, string> = {
  passes_groups: 'groups',
  first_group: 'first',
  second_group: 'second',
  passes_as_third: 'third',
  reaches_r16: 'r16',
  reaches_qf: 'qf',
  reaches_sf: 'sf',
  reaches_final: 'final',
  is_champion: 'champion',
};

/** Las selecciones no traen escudo: se pinta su bandera. */
const NO_LOGOS = {};

/**
 * Buscador: en las ligas de cuadro y en las eliminatorias, elige un equipo y mira cuántas
 * predicciones lo llevan a cada ronda, quién lo pone y hasta dónde lo lleva el resto; en la
 * Fórmula 1, elige un piloto y mira quién lo ha puesto y en qué puesto en cada Gran Premio; en el
 * tenis, elige un jugador y mira quién lo da ganador en cada partido del cuadro.
 */
function Search() {
  const { leagueKind, activeGroupId, userGroups, changeGroup, groupError } = useAppContext();
  const [params] = useSearchParams();
  const requestedGroup = params.get('group');
  if (requestedGroup && requestedGroup !== String(activeGroupId)) {
    const group = userGroups.find((candidate) => String(candidate.id) === requestedGroup);
    return (
      <section className="paper-panel album-sheet p-5" role="status">
        <h1>Esta búsqueda pertenece a otra liga</h1>
        <p>Selecciona la liga del enlace para consultar sus resultados.</p>
        {group ? (
          <button type="button" className="glass-btn" onClick={() => changeGroup(group.id)}>
            Abrir {group.name}
          </button>
        ) : (
          <Link to="/mis-ligas">Ver mis ligas y comprobar el acceso</Link>
        )}
      </section>
    );
  }
  const views: Record<LeagueKind, ReactNode> = {
    loading: <LeagueLoadState />,
    error: <LeagueLoadState error={groupError} />,
    none: <NoLeagueState title="Buscar" what="las predicciones" />,
    unknown: <UnsupportedLeagueState />,
    // Liga de juegos de mesa: no hay predicciones; su inicio es el marcador.
    scoreboard: <Navigate to="/" replace />,
    // El Mundial es un cuadro más, con los puestos de la fase de grupos aparte.
    groupStage: <GroupStageSearchPage />,
    matchday: <Navigate to="/stats" replace />,
    fightCard: <Navigate to="/stats" replace />,
    // En el tenis se busca un jugador en los partidos del cuadro que ya han empezado.
    tennisDraw: <TennisSearchPage />,
    // En la Fórmula 1 se busca un piloto a lo largo de la temporada.
    grandPrix: <GrandPrixSearchPage />,
    // En el resto de cuadros se busca un equipo en el cuadro de esa competición.
    customBracket: <KnockoutSearchPage />,
    ownBracket: <KnockoutSearchPage />,
    knockoutDraw: <KnockoutSearchPage />,
  };
  return views[leagueKind];
}

function TennisSearchPage() {
  const { activeGroupId, activeGroupName } = useAppContext();
  return (
    <section id="view-search" className="view-section block paper-panel album-sheet landing-tape">
      <InsightsHeader leagueName={activeGroupName} summary="Por jugador" />
      {activeGroupId ? (
        <TennisSearch groupId={activeGroupId} leagueName={activeGroupName} />
      ) : (
        <InsightsNotice title="No hay ninguna liga seleccionada" />
      )}
    </section>
  );
}

function KnockoutSearchPage() {
  const insights = useKnockoutInsights();
  const count = insights.entries.length;
  return (
    <section id="view-search" className="view-section block paper-panel album-sheet landing-tape">
      <InsightsHeader
        leagueName={insights.leagueName}
        summary={count > 0 ? `${count} ${count === 1 ? 'predicción' : 'predicciones'}` : undefined}
      />
      <KnockoutInsightsGate insights={insights}>
        <KnockoutSearch
          entries={insights.entries}
          field={insights.field}
          logos={insights.logos}
          leagueName={insights.leagueName}
          groupId={insights.groupId}
          avatarByUserId={insights.avatarByUserId}
          onOpen={insights.openPrediction}
        />
      </KnockoutInsightsGate>
    </section>
  );
}

function GrandPrixSearchPage() {
  const insights = useGrandPrixInsights();
  const count = insights.races.length;
  return (
    <section id="view-search" className="view-section block paper-panel album-sheet landing-tape">
      <InsightsHeader
        leagueName={insights.leagueName}
        summary={
          count > 0
            ? `${count} ${count === 1 ? 'Gran Premio cerrado' : 'Grandes Premios cerrados'}`
            : undefined
        }
      />
      <GrandPrixInsightsGate insights={insights}>
        <GrandPrixSearch
          races={insights.races}
          drivers={insights.drivers}
          leagueName={insights.leagueName}
          groupId={insights.groupId}
        />
      </GrandPrixInsightsGate>
    </section>
  );
}

/**
 * Buscador de un torneo con fase de grupos: el cuadro genérico, con los equipos ordenados por grupo
 * y, en las ligas que también predicen los grupos, en qué puesto pone cada uno al equipo.
 */
function GroupStageSearchPage() {
  const insights = useGroupStageInsights();
  const { entries, field, tournament, officialBracket, knockoutsOnly } = insights;
  const [params] = useSearchParams();

  const teamGroups = useMemo(
    () =>
      teamsByGroup(
        officialBracket,
        [...pickedTeams(entries), ...(field.rounds[0]?.teams ?? [])],
        knockoutsOnly,
      ),
    [officialBracket, entries, field, knockoutsOnly],
  );
  const positions = useMemo<ExtraRows | undefined>(
    () =>
      knockoutsOnly
        ? undefined
        : {
            after: 0,
            rows: (team) => positionRows(entries, team, tournament),
            pickers: (team, id) => positionPickers(entries, team, id as GroupPosition),
          },
    [knockoutsOnly, entries, tournament],
  );

  // Enlaces compartidos antes de que el buscador fuera el de cualquier cuadro.
  const stage = params.get('stage') ?? LEGACY_CONDITIONS[params.get('condition') ?? ''];
  if (stage && !params.has('round')) {
    const query = new URLSearchParams();
    for (const key of ['group', 'team']) {
      const value = params.get(key);
      if (value) query.set(key, value);
    }
    const round = roundOfStage(stage, knockoutsOnly);
    if (round) query.set('round', round);
    return <Navigate to={`/search?${query}`} replace />;
  }

  const count = entries.length;
  return (
    <section id="view-search" className="view-section block paper-panel album-sheet landing-tape">
      <InsightsHeader
        leagueName={insights.leagueName}
        summary={count > 0 ? `${count} ${count === 1 ? 'predicción' : 'predicciones'}` : undefined}
      />
      <KnockoutInsightsGate insights={insights}>
        <KnockoutSearch
          entries={entries}
          field={field}
          logos={NO_LOGOS}
          leagueName={insights.leagueName}
          groupId={insights.groupId}
          avatarByUserId={insights.avatarByUserId}
          onOpen={insights.openPrediction}
          teamGroups={teamGroups}
          extra={positions}
        />
      </KnockoutInsightsGate>
    </section>
  );
}

export default Search;
