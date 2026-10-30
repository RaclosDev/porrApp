import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useAppContext } from '../context/AppContext';
import { useDialogFocus } from '../hooks/useDialogFocus';
import { usePredictionViewerData, type RoundRef } from '../hooks/usePredictionViewerData';
import { PredictionSkeleton } from './Skeleton';
import ViewerHeader from './prediction/ViewerHeader';
import ViewerTabs from './prediction/ViewerTabs';
import GroupsView from './prediction/GroupsView';
import ThirdsView from './prediction/ThirdsView';
import BracketView from './prediction/BracketView';
import BracketCenter from './prediction/BracketCenter';
import GroupTeamRow from './prediction/GroupTeamRow';
import RoundFooter from './prediction/RoundFooter';
import ViewerSlot from './prediction/ViewerSlot';
import { ViewerMessage, ViewerModal } from './prediction/ViewerFrame';
import type { ViewerTab } from './prediction/viewerTypes';
import { nextKnockoutMatch } from '../utils/bracketBuilder';
import { advancingThirds, thirdPlacedTeams } from '../utils/predictionViewer';
import { featuredSlot, groupTeamPoints } from '../utils/viewerScoring';

interface PredictionViewerProps {
  /** Se pinta dentro de la página en vez de como modal. */
  inline?: boolean;
  predictionId?: string | number | null;
  onEdit?: (() => void) | null;
  onClose?: (() => void) | null;
}

/** Cuadro de eliminatorias sin columnas ocultas. */
const HIDDEN_ROUNDS = { 0: false, 1: false, 2: false, 3: false };

/**
 * Visor de la porra de un usuario, como modal o dentro de la página: fase de grupos, mejores
 * terceros y cuadro de eliminatorias con los puntos obtenidos.
 */
function PredictionViewer({
  inline = false,
  predictionId = null,
  onEdit = null,
  onClose = null,
}: PredictionViewerProps) {
  const state = useAppContext();
  const { viewerPredictionId, setViewerPredictionId, officialPoints, groupOdds, allGames } = state;
  const { participantsHashes } = state;
  const effectivePredictionId = predictionId || viewerPredictionId;
  const handleClose = useCallback(
    () => (onClose ? onClose() : setViewerPredictionId(null)),
    [onClose, setViewerPredictionId],
  );

  const initialPart = useMemo(() => {
    if (!effectivePredictionId) return null;
    const match = (participantsHashes || []).find(
      (h) => String(h?.key ?? '') === String(effectivePredictionId),
    );
    return match?.data || null;
  }, [effectivePredictionId, participantsHashes]);

  const {
    part,
    loading,
    error,
    points,
    initialSection,
    leftRounds,
    rightRounds,
    getSlotDetails,
    getRoundFooterTotal,
    getCenterPointsTotal,
    getGroupTeamData,
  } = usePredictionViewerData(
    effectivePredictionId,
    officialPoints,
    state.leaderboardData,
    groupOdds,
    allGames,
    initialPart,
  );

  const [activeTab, setActiveTab] = useState<ViewerTab>(() =>
    initialSection === 'knockout' ? 'bracket' : 'groups',
  );

  const featuredMatch = useMemo(() => nextKnockoutMatch(allGames), [allGames]);

  // Las cuatro variantes del modal comparten el mismo contenedor raíz, así que el ref no cambia.
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(dialogRef, {
    active: Boolean(effectivePredictionId) && !inline,
    onEscape: handleClose,
  });

  // Abre la sección que tiene más sentido según la fase del torneo.
  useEffect(() => {
    if (initialSection === 'knockout') {
      setActiveTab('bracket');
    } else if (initialSection === 'groups') {
      setActiveTab('groups');
    }
  }, [initialSection, effectivePredictionId]);

  const thirds = useMemo(() => advancingThirds(part, groupOdds), [part, groupOdds]);
  const allThirdTeams = useMemo(() => thirdPlacedTeams(part), [part]);

  if (!effectivePredictionId) return null;

  if (error) {
    return (
      <ViewerMessage
        inline={inline}
        dialogRef={dialogRef}
        onClose={handleClose}
        kind="error"
        message={error}
      />
    );
  }

  if (loading) {
    if (inline) return <PredictionSkeleton />;
    return (
      <ViewerModal
        dialogRef={dialogRef}
        onClose={handleClose}
        className="modal-content w-[95vw] max-w-150 py-7 px-6"
      >
        <PredictionSkeleton compact />
        <button onClick={handleClose} className="glass-btn mt-2 w-full">
          Cancelar
        </button>
      </ViewerModal>
    );
  }

  if (!part) {
    return (
      <ViewerMessage inline={inline} dialogRef={dialogRef} onClose={handleClose} kind="notFound" />
    );
  }

  const renderSlot = (
    name: string | null | undefined,
    { roundIndex }: { roundIndex: RoundRef },
  ) => (
    <ViewerSlot
      name={name}
      details={getSlotDetails(name, roundIndex)}
      featured={featuredSlot(featuredMatch, name, roundIndex)}
    />
  );

  const renderGroupTeam = (
    groupName: string,
    teamName: string,
    expectedPos: number,
    defaultColor: string,
    medal: string,
  ) => {
    const { color, status } = getGroupTeamData(groupName, teamName, expectedPos);
    return (
      <GroupTeamRow
        teamName={teamName}
        color={color === 'inherit' ? defaultColor : color}
        medal={medal}
        qualified={status === 5}
        points={groupTeamPoints(points, groupName, teamName)}
      />
    );
  };

  const champName = part.champion ?? null;
  const thirdWinnerName = part.thirdPlaceWinner ?? null;
  const [finalHome = null, finalAway = null] = part.final ?? [];
  const [thirdHome = null, thirdAway = null] = part.thirdPlaceMatch ?? [];
  const hasGroups = Boolean(part.groups && Object.keys(part.groups).length > 0);

  const content = (
    <div id="points-breakdown-body">
      <ViewerHeader
        handleClose={handleClose}
        inline={inline}
        onEdit={onEdit}
        part={part}
        points={points}
      />

      {hasGroups && <ViewerTabs activeTab={activeTab} setActiveTab={setActiveTab} />}

      <div className="flex flex-col">
        {hasGroups && activeTab === 'groups' && (
          <GroupsView part={part} points={points} renderGroupTeam={renderGroupTeam} />
        )}

        {hasGroups && activeTab === 'thirds' && (
          <ThirdsView
            advancingThirds={thirds}
            allThirdTeams={allThirdTeams}
            getGroupTeamData={getGroupTeamData}
          />
        )}

        {(!hasGroups || activeTab === 'bracket') && (
          <BracketView
            champName={champName}
            thirdWinnerName={thirdWinnerName}
            finalHome={finalHome}
            finalAway={finalAway}
            thirdHome={thirdHome}
            thirdAway={thirdAway}
            getCenterPointsTotal={getCenterPointsTotal}
            hiddenRounds={HIDDEN_ROUNDS}
            leftRounds={leftRounds}
            rightRounds={rightRounds}
            renderCenter={(colW) => (
              <BracketCenter
                colW={colW}
                centerTotal={getCenterPointsTotal()}
                champName={champName}
                thirdWinnerName={thirdWinnerName}
                finalHome={finalHome}
                finalAway={finalAway}
                thirdHome={thirdHome}
                thirdAway={thirdAway}
                renderSlot={renderSlot}
              />
            )}
            renderRoundFooter={(roundIndex, side) => (
              <RoundFooter total={getRoundFooterTotal(roundIndex, side)} />
            )}
            renderSlot={renderSlot}
          />
        )}
      </div>
    </div>
  );

  if (inline) {
    return <div className="prediction-viewer-inline w-full max-w-450 my-0 mx-auto">{content}</div>;
  }

  return (
    <ViewerModal
      dialogRef={dialogRef}
      onClose={handleClose}
      className="modal-content w-[98vw] max-w-475 text-left max-h-[95dvh] overflow-y-auto pt-[25px]"
    >
      {content}
    </ViewerModal>
  );
}

export default PredictionViewer;
