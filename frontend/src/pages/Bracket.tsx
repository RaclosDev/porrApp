import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import GroupStage from '../components/GroupStage';
import { BracketFinalMatch } from '../components/BracketFinale';
import BracketCanvas, { TeamSlot, type SlotContext } from '../components/BracketCanvas';
import type { BracketTeam } from '../store/useAppStore';
import PredictionViewer from '../components/PredictionViewer';
import { PredictionSkeleton } from '../components/Skeleton';
import { useBracket } from '../hooks/useBracket';
import { useAppContext } from '../context/AppContext';
import { useMyLeaguePrediction } from '../hooks/useLeaguePredictions';
import { isMathematicallyQualified } from '../utils/groupStatus';
import InkStamp from '../components/InkStamp';

/**
 * Porra de la liga activa: si ya hay una guardada muestra el visor (con opción de editar);
 * si no, o al editar, el asistente de grupos y cruces.
 */
function Bracket() {
  const { userId } = useAppContext();
  const myPred = useMyLeaguePrediction();
  const {
    bracketState,
    userName,
    setUserName,
    topScorer,
    setTopScorer,
    predictionName,
    setPredictionName,
    isKnockoutsOnly,
    isMatchDay,
    allTeams,
    isInitialState,
    isAuthenticated,
    activeGroupId,
    groupOdds,
    activeGroupPichichi,
    activeGroupIsLocked,
    setR32Team,
    advanceTeam,
    handleGroupStageComplete,
    generatePredictionData,
    getTeamStatus,
    handleResetToGroupStage,
    savedGroupsDraft,
    savedThirdsDraft,
    savedPredictionId,
    loadingGroup,
    groupError,
  } = useBracket();

  const [mobileStep, setMobileStep] = useState('bracket'); // 'bracket' | 'save'
  const [isEditing, setIsEditing] = useState(false);

  const effectivePredictionId = savedPredictionId || myPred?.key;

  if (loadingGroup)
    return (
      <div className="py-2 px-0">
        <PredictionSkeleton />
      </div>
    );
  if (groupError)
    return (
      <p className="p-6 text-center text-[#ff7675]" role="alert">
        No se pudo cargar la liga. Inténtalo de nuevo.
      </p>
    );
  if (isMatchDay) {
    return <Navigate to="/jornadas" replace />;
  }

  if (effectivePredictionId && !isEditing) {
    return (
      <PredictionViewer
        inline={true}
        predictionId={effectivePredictionId}
        onEdit={!activeGroupIsLocked ? () => setIsEditing(true) : undefined}
      />
    );
  }

  /** Si el equipo ya está elegido para pasar de ronda desde esa casilla. */
  const isPicked = (
    team: BracketTeam | null | undefined,
    side: SlotContext['side'] | 'center',
    roundIndex: number,
    matchIndex: number,
  ) => {
    if (!team?.name) return false;
    let picked: BracketTeam | null | undefined;
    if (side === 'center') {
      picked = roundIndex === 4 ? bracketState.champion : bracketState.thirdPlaceWinner;
    } else if (roundIndex < 3) {
      const next = [bracketState.r16, bracketState.qf, bracketState.sf][roundIndex][side][
        Math.floor(matchIndex / 2)
      ];
      picked = matchIndex % 2 === 0 ? next?.home : next?.away;
    } else {
      picked = side === 'left' ? bracketState.final?.home : bracketState.final?.away;
    }
    return picked?.name === team.name;
  };

  const renderSlot = (
    team: BracketTeam | null | undefined,
    { side, roundIndex, matchIndex, isHome }: SlotContext,
  ) => {
    // En KNOCKOUTS_ONLY, los dieciseisavos sin equipo ("1º A") se eligen en un desplegable.
    if (roundIndex === 0 && isKnockoutsOnly && team?.name?.includes('º')) {
      return (
        <select
          aria-label="Seleccionar equipo clasificado"
          className="glass-input w-full h-10.5 py-0 px-2.5 text-[0.85rem]"
          defaultValue=""
          onChange={(e) => e.target.value && setR32Team(e.target.value, side, matchIndex, isHome)}
        >
          <option value="" disabled>
            Seleccionar...
          </option>
          {allTeams.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      );
    }
    if (roundIndex === 0) {
      let statusIndicator = null;
      const name = team?.name;
      if (name && !name.includes('º')) {
        const teamStatus = getTeamStatus(name);
        if (isMathematicallyQualified(teamStatus)) {
          statusIndicator = (
            <InkStamp tone="ink" size="sm" label="Clasificado matemáticamente" className="ml-1">
              Clas.
            </InkStamp>
          );
        }
      }
      return (
        <TeamSlot
          name={name}
          rightContent={statusIndicator}
          pressed={isPicked(team, side, roundIndex, matchIndex)}
          onClick={() => advanceTeam(team, side, roundIndex, matchIndex)}
        />
      );
    }
    return (
      <TeamSlot
        name={team?.name}
        pressed={isPicked(team, side, roundIndex, matchIndex)}
        onClick={() => advanceTeam(team, side, roundIndex, matchIndex)}
      />
    );
  };

  return (
    <section id="view-bracket" className="view-section block">
      {effectivePredictionId && (
        <div className="flex justify-end mb-4 py-0 px-2">
          <button
            type="button"
            onClick={() => setIsEditing(false)}
            className="glass-btn py-2 px-4 text-[0.88rem] font-bold cursor-pointer flex items-center gap-1.5"
          >
            Ver mi porra
          </button>
        </div>
      )}
      {isInitialState ? (
        <GroupStage
          groupOdds={groupOdds}
          onComplete={handleGroupStageComplete}
          activeGroupId={activeGroupId}
          userId={userId}
          initialSelections={savedGroupsDraft}
          initialThirds={savedThirdsDraft}
        />
      ) : (
        <>
          <div className="section-header mb-7.5 text-center">
            <h2 className="m-0 poster-title">Paso 2: Eliminatorias</h2>
            <p className="text-muted mt-2 text-[0.9rem]">
              Pulsa un equipo para pasarlo a la siguiente ronda
            </p>
            {!isKnockoutsOnly && (
              <button
                type="button"
                onClick={handleResetToGroupStage}
                className="glass-btn mt-2.5 text-[0.85rem] py-1.5 px-3.5 rounded-[20px] text-cyan border border-[rgba(0,_210,_211,_0.4)] cursor-pointer"
              >
                ← Editar fase de grupos
              </button>
            )}
          </div>

          <div className="mb-tabs hide-on-desktop" role="tablist" aria-label="Pasos del cuadro">
            <button
              type="button"
              role="tab"
              aria-selected={mobileStep === 'bracket'}
              className={`mb-tab ${mobileStep === 'bracket' ? 'mb-tab-active' : ''}`}
              onClick={() => setMobileStep('bracket')}
            >
              Cuadro
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mobileStep === 'save'}
              className={`mb-tab ${mobileStep === 'save' ? 'mb-tab-active' : ''}`}
              onClick={() => setMobileStep('save')}
            >
              {activeGroupPichichi ? 'Guardar y pichichi' : 'Guardar porra'}
            </button>
          </div>

          <div className={mobileStep === 'bracket' ? '' : 'mobile-step-hidden'}>
            <BracketCanvas
              leftRounds={[
                bracketState.r32.left,
                bracketState.r16.left,
                bracketState.qf.left,
                bracketState.sf.left,
              ]}
              rightRounds={[
                bracketState.r32.right,
                bracketState.r16.right,
                bracketState.qf.right,
                bracketState.sf.right,
              ]}
              renderSlot={renderSlot}
              renderFinal={(expandedThirdPlace) => (
                <BracketFinalMatch
                  expandedThirdPlace={expandedThirdPlace}
                  editable
                  home={
                    <TeamSlot
                      name={bracketState.final?.home?.name}
                      pressed={isPicked(bracketState.final?.home, 'center', 4, 0)}
                      onClick={() =>
                        bracketState.final?.home &&
                        advanceTeam(bracketState.final.home, 'center', 4, 0)
                      }
                    />
                  }
                  away={
                    <TeamSlot
                      name={bracketState.final?.away?.name}
                      pressed={isPicked(bracketState.final?.away, 'center', 4, 0)}
                      onClick={() =>
                        bracketState.final?.away &&
                        advanceTeam(bracketState.final.away, 'center', 4, 0)
                      }
                    />
                  }
                  champion={<TeamSlot name={bracketState.champion?.name} />}
                  thirdWinner={bracketState.thirdPlaceWinner?.name}
                  thirdPlace={
                    <>
                      <TeamSlot
                        name={bracketState.thirdPlaceMatch?.home?.name}
                        pressed={isPicked(bracketState.thirdPlaceMatch?.home, 'center', 5, 0)}
                        onClick={() =>
                          bracketState.thirdPlaceMatch?.home &&
                          advanceTeam(bracketState.thirdPlaceMatch.home, 'center', 5, 0)
                        }
                      />
                      <TeamSlot
                        name={bracketState.thirdPlaceMatch?.away?.name}
                        pressed={isPicked(bracketState.thirdPlaceMatch?.away, 'center', 5, 0)}
                        onClick={() =>
                          bracketState.thirdPlaceMatch?.away &&
                          advanceTeam(bracketState.thirdPlaceMatch.away, 'center', 5, 0)
                        }
                      />
                    </>
                  }
                />
              )}
            />

            <div
              className={`hide-on-desktop ${mobileStep === 'bracket' ? '' : 'mobile-step-hidden'}`}
              style={{ textAlign: 'center', marginTop: '20px' }}
            >
              <button
                className="glass-btn primary-btn"
                onClick={() => {
                  window.scrollTo({ top: 0 });
                  setMobileStep('save');
                }}
              >
                Continuar
              </button>
            </div>
          </div>

          <div
            id="controls-section"
            className={`glass-panel mt-7.5 p-5 ${mobileStep === 'save' ? '' : 'mobile-step-hidden'}`}
          >
            <h3 className="mt-0 text-accent-text">Guardar porra</h3>
            <div className="flex gap-[15px] flex-wrap mb-[15px]">
              <input
                type="text"
                placeholder="Tu nombre"
                aria-label="Tu nombre"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                className="glass-input flex-1 min-w-50"
                disabled={isAuthenticated}
              />
              <input
                type="text"
                placeholder="Nombre de la porra (p. ej.: Mi porra 1)"
                aria-label="Nombre de la porra"
                value={predictionName}
                onChange={(e) => setPredictionName(e.target.value)}
                className="glass-input flex-1 min-w-50"
              />
              {activeGroupPichichi && (
                <input
                  type="text"
                  placeholder="Pichichi"
                  aria-label="Pichichi"
                  value={topScorer}
                  onChange={(e) => setTopScorer(e.target.value)}
                  className="glass-input flex-1 min-w-50"
                />
              )}
            </div>
            {!isAuthenticated && (
              <p className="text-muted mt-0 mb-[15px] text-[0.9rem]">Inicia sesión para guardar.</p>
            )}
            {activeGroupIsLocked && (
              <p className="flex items-center gap-3 mb-[15px] text-[0.9rem] text-muted">
                <InkStamp>Porra cerrada</InkStamp>
                El plazo para enviarla o cambiarla ha terminado.
              </p>
            )}
            <button
              className="glass-btn primary-btn"
              onClick={generatePredictionData}
              disabled={activeGroupIsLocked}
            >
              {activeGroupIsLocked ? 'Plazo cerrado' : 'Guardar porra'}
            </button>
          </div>
        </>
      )}
    </section>
  );
}

export default Bracket;
