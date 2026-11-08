import PaperLoading from '../components/PaperLoading';
import LeagueLoadState from '../components/LeagueLoadState';
import { useEffect } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import MatchFriendsPredictionsModal from '../components/MatchFriendsPredictionsModal';
import MatchdayHeader from '../components/matchday/MatchdayHeader';
import RoundSelector from '../components/matchday/RoundSelector';
import StatusFilterTabs from '../components/matchday/StatusFilterTabs';
import FixtureCard from '../components/matchday/FixtureCard';
import SurvivorStatusBar from '../components/matchday/SurvivorStatusBar';
import { useMatchdayPredictor } from '../hooks/useMatchdayPredictor';
import { useMatchVoters } from '../hooks/useMatchVoters';

function MatchdayPredictor() {
  const context = useAppContext();
  const switchingGroup = useRequestedGroup(context);
  if (switchingGroup || context.loadingGroup || context.groupError)
    return <LeagueLoadState error={context.groupError} />;
  return (
    <MatchdayLeague
      key={`${context.userId || context.userName}:${context.activeGroupId}`}
      context={context}
    />
  );
}

/**
 * Abre la liga de `?group=ID` (p. ej. desde un recordatorio) si el usuario es miembro.
 * Devuelve `true` mientras la petición está pendiente, para no pintar (ni redirigir desde)
 * la liga que estaba activa antes de cambiar.
 */
function useRequestedGroup({
  userGroups,
  userGroupsLoaded,
  activeGroupId,
  changeGroup,
}: ReturnType<typeof useAppContext>) {
  const [params, setParams] = useSearchParams();
  const requested = params.get('group');
  useEffect(() => {
    // Hasta que llegan las ligas, `userGroups` es una lista vacía: esperar o se descartaría la petición.
    if (!requested || !userGroupsLoaded) return;
    const group = userGroups.find((candidate) => String(candidate.id) === requested);
    if (group && String(activeGroupId) !== requested) changeGroup(group.id);
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.delete('group');
        return next;
      },
      { replace: true },
    );
  }, [requested, userGroups, userGroupsLoaded, activeGroupId, changeGroup, setParams]);
  return Boolean(requested);
}

/**
 * Pronósticos por jornada (1X2 y marcador exacto), partido a partido: cada uno se cierra al
 * empezar y muestra los puntos obtenidos.
 */
function MatchdayLeague({ context }: { context: ReturnType<typeof useAppContext> }) {
  const { activeGroupId, activeGroupName, activeGroupIsLocked, activeGroupPoolFormat } = context;
  const md = useMatchdayPredictor(context);
  const voters = useMatchVoters(
    md.isMatchDay ? activeGroupId : null,
    md.fixtures
      .filter((fixture) => fixture.locked || activeGroupIsLocked)
      .map((fixture) => fixture.matchId),
  );

  if (activeGroupPoolFormat && !md.isMatchDay) {
    return <Navigate to="/" replace />;
  }

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

      {md.isSurvivor && <SurvivorStatusBar status={md.survivor} />}

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
        ))}
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
