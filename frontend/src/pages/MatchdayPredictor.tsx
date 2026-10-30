import { Navigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import MatchFriendsPredictionsModal from '../components/MatchFriendsPredictionsModal';
import MatchdayHeader from '../components/matchday/MatchdayHeader';
import RoundSelector from '../components/matchday/RoundSelector';
import StatusFilterTabs from '../components/matchday/StatusFilterTabs';
import FixtureCard from '../components/matchday/FixtureCard';
import FloatingSaveButton from '../components/matchday/FloatingSaveButton';
import { useMatchdayPredictor } from '../hooks/useMatchdayPredictor';

function MatchdayPredictor() {
  const context = useAppContext();
  if (context.loadingGroup) return <p role="status">Cargando liga...</p>;
  if (context.groupError) return <p role="alert">No se pudo cargar la liga. Inténtalo de nuevo.</p>;
  return (
    <MatchdayLeague
      key={`${context.userId || context.userName}:${context.activeGroupId}`}
      context={context}
    />
  );
}

/**
 * Pronósticos por jornada (1X2 y marcador exacto), partido a partido: cada uno se cierra al
 * empezar y muestra los puntos obtenidos.
 */
function MatchdayLeague({ context }: { context: ReturnType<typeof useAppContext> }) {
  const { activeGroupId, activeGroupName, activeGroupIsLocked, activeGroupPoolFormat } = context;
  const md = useMatchdayPredictor(context);

  if (context.loadingGroup)
    return (
      <p className="p-6 text-center text-muted" role="status">
        Cargando liga...
      </p>
    );
  if (context.groupError)
    return (
      <p className="p-6 text-center text-[#ff7675]" role="alert">
        No se pudo cargar la liga. Inténtalo de nuevo.
      </p>
    );
  if (activeGroupPoolFormat && !md.isMatchDay) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="md-page">
      <MatchdayHeader
        title={activeGroupName || 'Jornadas'}
        isLocked={activeGroupIsLocked}
        predicted={md.counts.predicted}
        total={md.counts.total}
        isSaving={md.isSaving}
        onSave={md.handleSaveAll}
        successMsg={md.saveSuccessMsg}
        errorMsg={md.saveErrorMsg}
      />

      {md.availableRounds.length > 0 && (
        <RoundSelector
          rounds={md.availableRounds}
          selected={md.selectedRound}
          index={md.roundIndex}
          onSelect={md.setSelectedRound}
        />
      )}

      {md.fixtures.length > 0 && (
        <StatusFilterTabs
          value={md.statusFilter}
          onChange={md.setStatusFilter}
          counts={md.counts}
        />
      )}

      {md.isLoading && (
        <div className="text-center p-10 text-muted">Cargando partidos y pronósticos...</div>
      )}

      {md.isError && (
        <p role="alert">
          No se pudieron cargar los partidos.{' '}
          <button onClick={() => md.refetch()}>Reintentar</button>
        </p>
      )}
      {!md.isLoading && !md.isError && md.fixtures.length === 0 && (
        <div className="glass-panel text-center p-10 text-muted rounded-[12px]">
          No hay partidos programados para esta competición o jornada.
        </div>
      )}

      <div className="flex flex-col gap-3.5">
        {md.displayedFixtures.map((fixture) => (
          <FixtureCard
            key={fixture.matchId}
            fixture={fixture}
            prediction={md.predictionFor(fixture.matchId)}
            locked={fixture.locked || activeGroupIsLocked}
            disabled={md.isSaving}
            onScoreChange={md.handleScoreChange}
            onQuickSign={md.handleQuickSign}
            onShowFriends={md.setSelectedMatchForFriends}
          />
        ))}
      </div>

      {md.hasUnsavedChanges && (
        <FloatingSaveButton
          isSaving={md.isSaving}
          isLocked={activeGroupIsLocked}
          predicted={md.counts.predicted}
          total={md.counts.total}
          onSave={md.handleSaveAll}
        />
      )}

      <MatchFriendsPredictionsModal
        groupId={activeGroupId}
        match={md.selectedMatchForFriends}
        onClose={() => md.setSelectedMatchForFriends(null)}
      />
    </div>
  );
}

export default MatchdayPredictor;
