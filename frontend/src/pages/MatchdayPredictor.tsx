import PaperLoading from '../components/PaperLoading';
import LeagueLoadState from '../components/LeagueLoadState';
import { type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import MatchFriendsPredictionsModal from '../components/MatchFriendsPredictionsModal';
import MatchdayHeader from '../components/matchday/MatchdayHeader';
import NflByeTeams from '../components/matchday/NflByeTeams';
import RoundSelector from '../components/matchday/RoundSelector';
import StatusFilterTabs from '../components/matchday/StatusFilterTabs';
import FixtureCard from '../components/matchday/FixtureCard';
import FightCard from '../components/matchday/FightCard';
import SurvivorStatusBar from '../components/matchday/SurvivorStatusBar';
import { useMatchdayPredictor } from '../hooks/useMatchdayPredictor';
import { useMatchVoters } from '../hooks/useMatchVoters';
import { useRequestedGroup } from '../hooks/useRequestedGroup';
import { NoLeagueState, UnsupportedLeagueState } from '../components/NoLeagueState';
import type { LeagueKind } from '../context/leagueKind';
import { isNbaRegularSeason } from '../utils/nbaPlayoffs';

/** «Jornadas»: solo las ligas que se predicen partido a partido; el resto tiene su propia porra. */
function MatchdayPredictor() {
  const context = useAppContext();
  const switchingGroup = useRequestedGroup(context);
  if (switchingGroup) return <LeagueLoadState />;
  const league = (
    <MatchdayLeague
      key={`${context.userId || context.userName}:${context.activeGroupId}`}
      context={context}
    />
  );
  const views: Record<LeagueKind, ReactNode> = {
    loading: <LeagueLoadState />,
    error: <LeagueLoadState error={context.groupError} />,
    none: <NoLeagueState title="Mi porra" what="las predicciones" />,
    unknown: <UnsupportedLeagueState />,
    matchday: league,
    fightCard: league,
    tennisDraw: league,
    groupStage: <Navigate to="/prediction" replace />,
    customBracket: <Navigate to="/prediction" replace />,
    ownBracket: <Navigate to="/prediction" replace />,
    knockoutDraw: <Navigate to="/prediction" replace />,
    // Fórmula 1: las predicciones de cada Gran Premio están en el inicio.
    grandPrix: <Navigate to="/" replace />,
  };
  return views[context.leagueKind];
}

/**
 * Pronósticos por jornada (1X2 y marcador exacto), partido a partido: cada uno se cierra al
 * empezar y muestra los puntos obtenidos.
 */
function MatchdayLeague({ context }: { context: ReturnType<typeof useAppContext> }) {
  const {
    activeGroupId,
    activeGroupName,
    activeGroupIsLocked,
    activeCompetitionId,
    activeCompetitionExternalId,
    activeGroupPicksMatches,
  } = context;
  // Los descansos solo se deducen si la liga lleva todos los partidos de la semana.
  const nflWeeks = activeCompetitionExternalId === 'nfl' && !activeGroupPicksMatches;
  const md = useMatchdayPredictor(context);
  const voters = useMatchVoters(
    activeGroupId,
    md.fixtures
      .filter((fixture) => fixture.locked || activeGroupIsLocked)
      .map((fixture) => fixture.matchId),
  );

  return (
    <div className="md-page paper-panel album-sheet">
      <MatchdayHeader
        title={activeGroupName || 'Jornadas'}
        isLocked={activeGroupIsLocked}
        isLoading={md.isLoading}
        predicted={md.counts.predicted}
        total={md.counts.total}
        survivor={md.isSurvivor}
        saveStatus={md.saveStatus}
        errorMsg={md.saveErrorMsg}
        onRetry={md.retrySave}
      />

      {md.isSurvivor && (
        <SurvivorStatusBar
          status={md.survivor}
          weeks={
            activeCompetitionExternalId === 'nfl' || isNbaRegularSeason(activeCompetitionExternalId)
          }
        />
      )}

      {md.availableRounds.length > 0 && (
        <RoundSelector
          rounds={md.availableRounds}
          selected={md.selectedRound}
          index={md.roundIndex}
          onSelect={md.setSelectedRound}
        />
      )}

      {nflWeeks && (
        <NflByeTeams
          competitionId={activeCompetitionId}
          round={md.activeRound}
          fixtures={md.roundFixtures}
        />
      )}

      {md.fixtures.length > 0 && (
        <StatusFilterTabs
          value={md.statusFilter}
          onChange={md.setStatusFilter}
          counts={md.counts}
        />
      )}

      {md.isLoading && <PaperLoading label="Cargando partidos y predicciones" embedded />}

      {md.isError && (
        <p role="alert">
          No se pudieron cargar los partidos.{' '}
          <button type="button" className="glass-btn" onClick={() => md.refetch()}>
            Reintentar
          </button>
        </p>
      )}
      {!md.isLoading && !md.isError && md.fixtures.length === 0 && (
        <div className="paper-panel album-sheet landing-tape text-center p-10 text-muted rounded-[12px]">
          {context.leagueKind === 'tennisDraw' && md.availableRounds.length === 0
            ? 'El cuadro aún no está publicado: los partidos aparecerán aquí en cuanto ESPN lo publique.'
            : 'No hay partidos programados para esta competición o jornada.'}
        </div>
      )}

      <div className="flex flex-col gap-3.5">
        {md.displayedFixtures.map((fixture) =>
          fixture.fight ? (
            <FightCard
              key={fixture.matchId}
              fixture={fixture}
              prediction={md.predictionFor(fixture.matchId)}
              locked={fixture.locked || activeGroupIsLocked}
              onPick={md.handleFightPick}
              onShowFriends={md.setSelectedMatchForFriends}
            />
          ) : (
            <FixtureCard
              key={fixture.matchId}
              fixture={fixture}
              prediction={md.predictionFor(fixture.matchId)}
              locked={fixture.locked || activeGroupIsLocked}
              onQuickSign={md.handleQuickSign}
              onTennisPick={md.handleTennisPick}
              onShowFriends={md.setSelectedMatchForFriends}
              voters={voters.get(fixture.matchId)}
              onShowVoters={md.setSelectedMatchForFriends}
              survivor={
                md.isSurvivor
                  ? {
                      usedTeams: md.usedTeams,
                      eliminated: Boolean(md.survivor?.eliminated),
                      onPick: md.handleSurvivorPick,
                    }
                  : undefined
              }
            />
          ),
        )}
      </div>

      <MatchFriendsPredictionsModal
        groupId={activeGroupId}
        match={md.selectedMatchForFriends}
        onClose={() => md.setSelectedMatchForFriends(null)}
      />
    </div>
  );
}

export default MatchdayPredictor;
