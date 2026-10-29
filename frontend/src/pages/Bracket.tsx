import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import GroupStage from '../components/GroupStage';
import BracketCanvas, {
  TeamSlot,
  matchTop,
  MATCH_H,
  COL_GAP,
  type SlotContext,
} from '../components/BracketCanvas';
import type { BracketTeam } from '../store/useAppStore';
import PredictionViewer from '../components/PredictionViewer';
import { PredictionSkeleton } from '../components/Skeleton';
import { useBracket } from '../hooks/useBracket';
import { useAppContext } from '../context/AppContext';

/**
 * Componente principal para crear o ver una Porra (Pronóstico).
 * Si el usuario ya tiene un pronóstico guardado en la liga activa, muestra el visor interactivo (PredictionViewer)
 * con píldoras de navegación (Grupos, Mejores Terceros, Bracket) y opción de editar.
 * Si no tiene pronóstico o está editando, muestra el asistente de creación/edición.
 *
 * @component
 * @returns {JSX.Element} Vista interactiva para ver o rellenar el bracket.
 */
function Bracket() {
  const { participantsHashes, userId } = useAppContext();
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

  const myPred = participantsHashes?.find(
    (h) =>
      (userName && h.participantName?.toLowerCase() === userName.toLowerCase()) ||
      (userId && h.userId?.toString() === userId?.toString()),
  );
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

  /** Slot renderer for BracketCanvas */
  const renderSlot = (
    team: BracketTeam | null | undefined,
    { side, roundIndex, matchIndex, isHome }: SlotContext,
  ) => {
    // R32 in KNOCKOUTS_ONLY with placeholder → dropdown
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
    // R32: display with status indicator and click to advance
    if (roundIndex === 0) {
      let statusIndicator = null;
      const name = team?.name;
      if (name && !name.includes('º')) {
        const teamStatus = getTeamStatus(name);
        if (teamStatus === 5) {
          statusIndicator = (
            <span
              className="w-2 h-2 bg-[#3498db] bg-none rounded-full ml-1 shrink-0 inline-block"
              title="Clasificado Matemáticamente"
              aria-label="Clasificado Matemáticamente"
            />
          );
        }
      }
      return (
        <TeamSlot
          name={name}
          rightContent={statusIndicator}
          onClick={() => advanceTeam(team, side, roundIndex, matchIndex)}
        />
      );
    }
    // Other rounds: click to advance
    return (
      <TeamSlot name={team?.name} onClick={() => advanceTeam(team, side, roundIndex, matchIndex)} />
    );
  };

  const finalTopY = matchTop(3, 0);

  const renderCenter = (colW: number) => (
    <>
      {/* FINAL */}
      <div
        className="absolute text-center text-[0.65rem] font-bold text-[rgba(251,191,36,0.9)] tracking-[2px] uppercase"
        style={{ top: finalTopY - 22, left: COL_GAP, width: colW }}
      >
        ⚽ Final
      </div>
      <div
        className="match final-match absolute"
        style={{ top: finalTopY, left: COL_GAP, width: colW }}
      >
        <TeamSlot
          name={bracketState.final?.home?.name}
          onClick={() =>
            bracketState.final?.home && advanceTeam(bracketState.final.home, 'center', 4, 0)
          }
        />
        <TeamSlot
          name={bracketState.final?.away?.name}
          onClick={() =>
            bracketState.final?.away && advanceTeam(bracketState.final.away, 'center', 4, 0)
          }
        />
      </div>

      {/* CAMPEÓN */}
      <div
        className="absolute text-center"
        style={{ top: finalTopY + MATCH_H + 18, left: COL_GAP, width: colW }}
      >
        <div className="text-[0.65rem] font-bold text-gold tracking-[2px] uppercase mb-1.5">
          🏆 Campeón
        </div>
        <div className="champion-display">
          <TeamSlot name={bracketState.champion?.name} />
        </div>
      </div>

      {/* TERCER PUESTO */}
      <div
        className="absolute"
        style={{ top: finalTopY + MATCH_H + 18 + MATCH_H + 44, left: COL_GAP, width: colW }}
      >
        <div className="text-[0.65rem] font-bold text-muted tracking-[2px] uppercase mb-1.5 text-center">
          🥉 Tercer Puesto
        </div>
        <div className="match third-place">
          <TeamSlot
            name={bracketState.thirdPlaceMatch?.home?.name}
            onClick={() =>
              bracketState.thirdPlaceMatch?.home &&
              advanceTeam(bracketState.thirdPlaceMatch.home, 'center', 5, 0)
            }
          />
          <TeamSlot
            name={bracketState.thirdPlaceMatch?.away?.name}
            onClick={() =>
              bracketState.thirdPlaceMatch?.away &&
              advanceTeam(bracketState.thirdPlaceMatch.away, 'center', 5, 0)
            }
          />
        </div>
        {bracketState.thirdPlaceWinner && (
          <div className="mt-2.5 text-center">
            <div className="text-[0.65rem] text-muted mb-1">Ganador:</div>
            <TeamSlot name={bracketState.thirdPlaceWinner?.name} />
          </div>
        )}
      </div>
    </>
  );

  return (
    <section id="view-bracket" className="view-section block">
      {effectivePredictionId && (
        <div className="flex justify-end mb-4 py-0 px-2">
          <button
            type="button"
            onClick={() => setIsEditing(false)}
            className="glass-btn py-2 px-4 text-[0.88rem] font-bold cursor-pointer flex items-center gap-1.5"
          >
            👁️ Ver Pronóstico Guardado
          </button>
        </div>
      )}
      {isInitialState ? (
        <GroupStage
          groupOdds={groupOdds}
          onComplete={handleGroupStageComplete}
          activeGroupId={activeGroupId}
          initialSelections={savedGroupsDraft}
          initialThirds={savedThirdsDraft}
        />
      ) : (
        <>
          <div className="section-header mb-7.5 text-center">
            <h2 className="m-0">Paso 2: Eliminatorias</h2>
            <p className="text-muted mt-2 text-[0.9rem]">
              Haz clic en un equipo para avanzarlo a la siguiente ronda
            </p>
            {!isKnockoutsOnly && (
              <button
                type="button"
                onClick={handleResetToGroupStage}
                className="glass-btn mt-2.5 text-[0.85rem] py-1.5 px-3.5 rounded-[20px] text-cyan border border-[rgba(0,_210,_211,_0.4)] cursor-pointer"
              >
                ← Modificar Fase de Grupos
              </button>
            )}
          </div>

          {/* Pestañas para móvil */}
          <div className="mb-tabs hide-on-desktop">
            <button
              className={`mb-tab ${mobileStep === 'bracket' ? 'mb-tab-active' : ''}`}
              onClick={() => setMobileStep('bracket')}
            >
              Cuadro
            </button>
            <button
              className={`mb-tab ${mobileStep === 'save' ? 'mb-tab-active' : ''}`}
              onClick={() => setMobileStep('save')}
            >
              {activeGroupPichichi ? 'Guardar y Pichichi' : 'Guardar Porra'}
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
              renderCenter={renderCenter}
              mobileCenter={() => (
                <div className="flex flex-col gap-5">
                  {/* Final */}
                  <div>
                    <div className="text-[0.75rem] font-bold text-[rgba(251,191,36,0.9)] tracking-[2px] uppercase text-center mb-2">
                      ⚽ Final
                    </div>
                    <div className="mb-match-card">
                      <TeamSlot
                        name={bracketState.final?.home?.name}
                        onClick={() =>
                          bracketState.final?.home &&
                          advanceTeam(bracketState.final.home, 'center', 4, 0)
                        }
                      />
                      <TeamSlot
                        name={bracketState.final?.away?.name}
                        onClick={() =>
                          bracketState.final?.away &&
                          advanceTeam(bracketState.final.away, 'center', 4, 0)
                        }
                      />
                    </div>
                  </div>
                  {/* Campeón */}
                  <div className="text-center">
                    <div className="text-[0.75rem] font-bold text-gold tracking-[2px] uppercase mb-2">
                      🏆 Campeón
                    </div>
                    <div className="champion-display">
                      <TeamSlot name={bracketState.champion?.name} />
                    </div>
                  </div>
                  {/* Tercer Puesto */}
                  <div>
                    <div className="text-[0.75rem] font-bold text-muted tracking-[2px] uppercase text-center mb-2">
                      🥉 Tercer Puesto
                    </div>
                    <div className="mb-match-card">
                      <TeamSlot
                        name={bracketState.thirdPlaceMatch?.home?.name}
                        onClick={() =>
                          bracketState.thirdPlaceMatch?.home &&
                          advanceTeam(bracketState.thirdPlaceMatch.home, 'center', 5, 0)
                        }
                      />
                      <TeamSlot
                        name={bracketState.thirdPlaceMatch?.away?.name}
                        onClick={() =>
                          bracketState.thirdPlaceMatch?.away &&
                          advanceTeam(bracketState.thirdPlaceMatch.away, 'center', 5, 0)
                        }
                      />
                    </div>
                    {bracketState.thirdPlaceWinner && (
                      <div className="mt-2.5 text-center">
                        <div className="text-[0.65rem] text-muted mb-1">Ganador:</div>
                        <TeamSlot name={bracketState.thirdPlaceWinner?.name} />
                      </div>
                    )}
                  </div>
                </div>
              )}
            />

            {/* Botón Siguiente en móvil para pasar a Guardar */}
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
                Continuar a Guardar Porra
              </button>
            </div>
          </div>

          {/* Controls */}
          <div
            id="controls-section"
            className={mobileStep === 'save' ? '' : 'mobile-step-hidden'}
            style={{
              marginTop: 30,
              padding: 20,
              background: 'rgba(255,255,255,0.05)',
              borderRadius: 12,
              border: '1px solid rgba(255,255,255,0.1)',
            }}
          >
            <h3 className="mt-0 text-accent">Guardar Porra</h3>
            <div className="flex gap-[15px] flex-wrap mb-[15px]">
              <input
                type="text"
                placeholder="Tu Nombre (Loguéate arriba primero)"
                aria-label="Tu Nombre"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                className="glass-input flex-1 min-w-50"
                disabled={isAuthenticated}
              />
              <input
                type="text"
                placeholder="Nombre de la Porra (ej: Mi Porra 1)"
                aria-label="Nombre de la Porra"
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
            {activeGroupIsLocked && (
              <div className="py-2.5 px-3.5 bg-[rgba(239,_68,_68,_0.15)] bg-none border border-[rgba(239,_68,_68,_0.4)] rounded-[8px] text-[#fca5a5] mb-[15px] text-[0.9rem]">
                🔒 <b>Pronósticos cerrados:</b> El plazo para enviar o modificar porras en esta liga
                ha finalizado.
              </div>
            )}
            <button
              className="glass-btn primary-btn"
              onClick={generatePredictionData}
              disabled={activeGroupIsLocked}
              style={activeGroupIsLocked ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
            >
              {activeGroupIsLocked ? 'Plazo Cerrado' : 'Guardar Pronóstico'}
            </button>
          </div>
        </>
      )}
    </section>
  );
}

export default Bracket;
