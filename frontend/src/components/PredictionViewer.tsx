import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAppContext } from '../context/AppContext';
import Flag from './Flag';
import { usePredictionViewerData } from '../hooks/usePredictionViewerData';
import { PredictionSkeleton } from './Skeleton';
import ViewerHeader from './prediction/ViewerHeader';
import ViewerTabs from './prediction/ViewerTabs';
import GroupsView from './prediction/GroupsView';
import ThirdsView from './prediction/ThirdsView';
import BracketView from './prediction/BracketView';
import { getTeamVal, type ViewerTab } from './prediction/viewerTypes';
import { extractGroupsFromR32 } from '../utils/bracketDraft';
import { isMatchInRound, nextKnockoutMatch } from '../utils/bracketBuilder';
import type { RoundRef } from '../hooks/usePredictionViewerData';
import { TeamSlot, matchTop, MATCH_H, COL_GAP } from './BracketCanvas';

/**
 * Componente principal para visualizar la porra de un usuario específico.
 * Se muestra como un modal flotante.
 * Integra la fase de grupos y la vista de Bracket de eliminatorias.
 *
 * @component
 * @returns {JSX.Element|null} El modal del visor de porras, o null si no hay porra seleccionada.
 */
interface PredictionViewerProps {
  /** Se pinta dentro de la página en vez de como modal. */
  inline?: boolean;
  predictionId?: string | number | null;
  onEdit?: (() => void) | null;
  onClose?: (() => void) | null;
}

function PredictionViewer({
  inline = false,
  predictionId = null,
  onEdit = null,
  onClose = null,
}: PredictionViewerProps) {
  const state = useAppContext();
  const {
    viewerPredictionId,
    setViewerPredictionId,
    officialPoints,
    groupOdds,
    allGames,
    nameToIdMap,
  } = state;
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
    nameToIdMap,
    initialPart,
  );

  const [activeTab, setActiveTab] = useState<ViewerTab>(() =>
    initialSection === 'knockout' ? 'bracket' : 'groups',
  );

  const featuredMatch = useMemo(() => nextKnockoutMatch(allGames), [allGames]);

  /**
   * Abre automáticamente la sección que tiene más sentido mostrar
   * basado en en qué fase del mundial nos encontremos.
   */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    if (effectivePredictionId && !inline) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [effectivePredictionId, handleClose, inline]);

  useEffect(() => {
    if (initialSection === 'knockout') {
      setActiveTab('bracket');
    } else if (initialSection === 'groups') {
      setActiveTab('groups');
    }
  }, [initialSection, effectivePredictionId]);

  /**
   * Función inyectada a BracketCanvas para pintar un "Slot" de un equipo en eliminatorias.
   * Colorea de verde si el usuario acertó el equipo clasificado, e inyecta los puntos obtenidos.
   *
   * @param {string} name - Nombre del equipo predicho por el usuario.
   * @param {Object} ctx - Contexto del slot (side, roundIndex, matchIndex, isHome).
   * @returns {JSX.Element} Un TeamSlot configurado.
   */
  const renderSlot = (
    name: string | null | undefined,
    { roundIndex }: { roundIndex: RoundRef; isHome?: boolean },
  ) => {
    const { isWinner, slotPoints } = getSlotDetails(name, roundIndex);

    let style: React.CSSProperties = isWinner
      ? { borderLeft: '3px solid #2ecc71', background: 'rgba(46, 204, 113, 0.1)' }
      : {};
    const rightContent =
      slotPoints !== null ? (
        <span
          className={`ml-1 text-[0.85em] font-bold py-0.5 px-1 rounded-[4px] ${slotPoints === '0' ? 'text-[#e74c3c]' : 'text-[#2ecc71]'} ${slotPoints === '0' ? 'bg-[rgba(231,76,60,0.1)]' : 'bg-[rgba(46,204,113,0.1)]'}`}
        >
          {slotPoints}
        </span>
      ) : null;

    let isFeatured = false;
    let isLive = false;
    if (featuredMatch && name && !name.includes('º') && name !== 'Por definir' && name !== '???') {
      if (isMatchInRound(featuredMatch, roundIndex)) {
        if (featuredMatch.home === name || featuredMatch.away === name) {
          isFeatured = true;
          if (featuredMatch.date && new Date(featuredMatch.date) <= new Date()) {
            isLive = true;
          }
        }
      }
    }

    if (isFeatured) {
      style = {
        ...style,
        border: isLive ? '2px solid #ff4757' : '2px solid #00d2d3',
      };
    }

    return <TeamSlot name={name} slotStyle={style} rightContent={rightContent} />;
  };

  /**
   * Función inyectada a BracketCanvas para renderizar el total de puntos ganados por columna/ronda.
   */
  const renderRoundFooter = (roundIndex: number, side: 'left' | 'right') => {
    const total = getRoundFooterTotal(roundIndex, side);

    if (total === 0) {
      return (
        <div className="text-[0.85rem] font-bold text-[rgba(255,255,255,0.3)] pointer-events-none">
          0 pts
        </div>
      );
    }

    return (
      <div className="text-[0.85rem] font-bold text-[#00d2d3] bg-[rgba(0,_210,_211,_0.1)] inline-block py-0.5 px-2 rounded-[4px] pointer-events-none">
        +{total} pts
      </div>
    );
  };

  const hiddenRounds = {
    0: false,
    1: false,
    2: false,
    3: false,
  };

  const finalTopY = matchTop(3, 0);

  /**
   * Renderiza el bloque central (Final y Tercer puesto).
   */
  const renderCenter = (colW: number) => {
    const centerTotal = getCenterPointsTotal();
    return (
      <div className="block">
        {/* FINAL HEADER & POINTS */}
        <div
          className="absolute flex flex-col items-center gap-0.5 pointer-events-none"
          style={{ top: finalTopY - 44, left: COL_GAP, width: colW }}
        >
          <div className="text-[0.65rem] font-bold text-[rgba(251,191,36,0.9)] tracking-[2px] uppercase">
            🏆 Final 🏆
          </div>
          {centerTotal > 0 ? (
            <div className="text-[0.85rem] font-bold text-[#00d2d3] bg-[rgba(0,_210,_211,_0.1)] inline-block py-0.5 px-2 rounded-[4px]">
              +{centerTotal} pts
            </div>
          ) : (
            <div className="text-[0.85rem] font-bold text-[rgba(255,255,255,0.3)]">0 pts</div>
          )}
        </div>

        <div
          className="match final-match absolute"
          style={{ top: finalTopY, left: COL_GAP, width: colW }}
        >
          {renderSlot(finalHome, { roundIndex: 'final', isHome: true })}
          {renderSlot(finalAway, { roundIndex: 'final', isHome: false })}
        </div>

        {/* CAMPEÓN */}
        <div
          className="absolute text-center"
          style={{ top: finalTopY + MATCH_H + 16, left: COL_GAP, width: colW }}
        >
          <div className="text-[0.65rem] font-bold text-gold tracking-[2px] uppercase mb-1">
            🏆 Campeón
          </div>
          <div className="champion-display">
            <div className="team-slot h-12.5 text-[1.1rem] font-bold justify-center pointer-events-none border-[#fbbf24] bg-[rgba(251,191,36,0.15)] text-[#fbbf24]">
              <Flag
                team={champName || ''}
                size="w40"
                style={{
                  width: 24,
                  height: 18,
                  borderRadius: 2,
                  marginRight: 8,
                  verticalAlign: 'middle',
                }}
              />
              {champName || '???'}
            </div>
          </div>
        </div>

        {/* TERCER PUESTO */}
        <div
          className="absolute text-center"
          style={{ top: finalTopY + MATCH_H + 16 + MATCH_H + 36, left: COL_GAP, width: colW }}
        >
          <div className="text-[0.65rem] font-bold text-muted tracking-[2px] uppercase mb-1">
            🥉 Tercer Puesto
          </div>
          <div className="match third-place">
            {renderSlot(thirdHome, {
              roundIndex: 'thirdPlaceMatch',
              isHome: true,
            })}
            {renderSlot(thirdAway, {
              roundIndex: 'thirdPlaceMatch',
              isHome: false,
            })}
          </div>
          {thirdWinnerName && (
            <div className="mt-2 text-center">
              <div className="text-[0.65rem] font-bold text-muted tracking-[1.5px] uppercase mb-1">
                Ganador 3er Puesto:
              </div>
              <div className="champion-display inline-block w-full">
                <div className="team-slot h-9.5 text-[0.95rem] font-bold justify-center pointer-events-none border-[#cd7f32] bg-[rgba(205,_127,_50,_0.15)] text-[#e0a96d]">
                  <Flag
                    team={thirdWinnerName || ''}
                    size="w40"
                    style={{
                      width: 20,
                      height: 15,
                      borderRadius: 2,
                      marginRight: 6,
                      verticalAlign: 'middle',
                    }}
                  />
                  {thirdWinnerName || '???'}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  /**
   * Renderiza un equipo dentro de su tabla de grupo.
   */
  const renderGroupTeam = (
    groupName: string,
    teamName: string,
    expectedPos: number,
    defaultColor: string,
    medal: string,
  ) => {
    const groupTeam = getGroupTeamData(groupName, teamName, expectedPos);
    const { status } = groupTeam;
    const color = groupTeam.color === 'inherit' ? defaultColor : groupTeam.color;

    let blueDot = null;
    if (status === 5) {
      blueDot = (
        <span
          className="w-2 h-2 bg-[#3498db] rounded-full ml-1.5 shrink-0 inline-block"
          title="Clasificado Matemáticamente"
          aria-label="Clasificado Matemáticamente"
        ></span>
      );
    }

    const resolveName = (n: string) =>
      n === 'EEUU' ? 'Estados Unidos' : n === 'Estados Unidos' ? 'EEUU' : n;
    const altTeamName = resolveName(teamName);

    let teamPts = 0;
    points?.log
      ?.filter(
        (l) =>
          l.stage === 'r1' &&
          (l.msg.includes(`Grupo ${groupName}`) ||
            l.msg.includes(`Grupo ${groupName.toUpperCase()}`)),
      )
      .forEach((l) => {
        if (l.msg.includes(teamName) || l.msg.includes(altTeamName)) teamPts += l.amount;
      });

    return (
      <div
        style={{
          fontSize: '1em',
          color,
          marginBottom: '4px',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <span className="mr-1">{medal}</span>{' '}
        <Flag
          team={teamName}
          size="w40"
          style={{
            width: 16,
            height: 12,
            objectFit: 'cover',
            borderRadius: '2px',
            marginRight: '4px',
            flexShrink: 0,
          }}
        />{' '}
        <span className="grow whitespace-nowrap overflow-hidden text-ellipsis flex items-center">
          {teamName}
          {blueDot}
        </span>
        {teamPts > 0 && (
          <span className="ml-1.5 text-[0.85em] font-bold text-[rgba(0,_210,_211,_0.9)] bg-[rgba(0,_210,_211,_0.15)] py-px px-[5px] rounded-[4px]">
            +{teamPts}
          </span>
        )}
      </div>
    );
  };

  const advancingThirds = useMemo(() => {
    if (Array.isArray(part?.thirds) && part.thirds.length > 0) {
      return part.thirds;
    }
    if (part?.r32 || part?.r1) {
      const extracted = extractGroupsFromR32(part.r32 || part.r1, groupOdds);
      return extracted.thirds || [];
    }
    return [];
  }, [part, groupOdds]);

  const champName = part?.champion ?? null;
  const thirdWinnerName = part?.thirdPlaceWinner ?? null;
  const [finalHome = null, finalAway = null] = part?.final ?? [];
  const [thirdHome = null, thirdAway = null] = part?.thirdPlaceMatch ?? [];

  const allThirdTeams = useMemo(() => {
    if (!part?.groups) return [];
    const groups = part.groups;
    const list: { group: string; team: string }[] = [];
    Object.keys(groups)
      .sort()
      .forEach((g) => {
        const groupVal = groups[g];
        const thirdName = getTeamVal(groupVal, 2, 'third');
        if (thirdName) {
          list.push({ group: g, team: thirdName });
        }
      });
    return list;
  }, [part?.groups]);

  if (!effectivePredictionId) return null;

  if (error) {
    if (inline) {
      return (
        <div className="text-center py-10 px-5 bg-[rgba(231,76,60,0.1)] rounded-[16px] border border-[rgba(231,76,60,0.3)]">
          <div className="text-[2.5rem] mb-3">🔒</div>
          <h3 className="text-[#e74c3c] mb-2.5">Porra no disponible</h3>
          <p className="text-muted leading-[1.5]">{error}</p>
        </div>
      );
    }
    return (
      <div
        id="points-breakdown-modal"
        className="modal flex z-[999999]"
        role="dialog"
        aria-modal="true"
        aria-label="Visor de porra"
        onClick={handleClose}
      >
        <div
          className="modal-content w-[95vw] max-w-150 text-center p-12.5"
          role="presentation"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="text-[2.5rem] mb-3">🔒</div>
          <h3 className="text-[#e74c3c] mb-2.5">Porra no disponible</h3>
          <p className="text-muted leading-[1.5]">{error}</p>
          <button onClick={handleClose} className="glass-btn primary-btn mt-5">
            Cerrar
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    if (inline) {
      return <PredictionSkeleton />;
    }
    return (
      <div
        id="points-breakdown-modal"
        className="modal flex z-[999999]"
        role="dialog"
        aria-modal="true"
        aria-label="Visor de porra"
        onClick={handleClose}
      >
        <div
          className="modal-content w-[95vw] max-w-150 py-7 px-6"
          role="presentation"
          onClick={(e) => e.stopPropagation()}
        >
          <PredictionSkeleton compact />
          <button onClick={handleClose} className="glass-btn mt-2 w-full">
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  if (!part) {
    if (inline) {
      return (
        <div className="text-center py-10 px-5">
          <div className="text-[2.5rem] mb-3">⚠️</div>
          <h3 className="text-(color:--text-color) mb-2.5">Porra no encontrada</h3>
          <p className="text-muted">No se encontraron los datos de la porra seleccionada.</p>
        </div>
      );
    }
    return (
      <div
        id="points-breakdown-modal"
        className="modal flex z-[999999]"
        role="dialog"
        aria-modal="true"
        aria-label="Visor de porra"
        onClick={handleClose}
      >
        <div
          className="modal-content w-[95vw] max-w-150 text-center p-12.5"
          role="presentation"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="text-[2.5rem] mb-3">⚠️</div>
          <h3 className="text-(color:--text-color) mb-2.5">Porra no encontrada</h3>
          <p className="text-muted">No se encontraron los datos de la porra seleccionada.</p>
          <button onClick={handleClose} className="glass-btn primary-btn mt-5">
            Cerrar
          </button>
        </div>
      </div>
    );
  }

  const content = (
    <div id="points-breakdown-body">
      {/* HEADER */}
      <ViewerHeader
        handleClose={handleClose}
        inline={inline}
        onEdit={onEdit}
        part={part}
        points={points}
      />

      {/* PESTAÑAS DE VISTA ESTILO PILLS */}
      {part.groups && Object.keys(part.groups).length > 0 && (
        <ViewerTabs activeTab={activeTab} setActiveTab={setActiveTab} />
      )}

      <div className="flex flex-col">
        {/* VISTA 1: FASE DE GRUPOS */}
        {part.groups && Object.keys(part.groups).length > 0 && activeTab === 'groups' && (
          <GroupsView part={part} points={points} renderGroupTeam={renderGroupTeam} />
        )}

        {/* VISTA 2: MEJORES TERCEROS */}
        {part.groups && Object.keys(part.groups).length > 0 && activeTab === 'thirds' && (
          <ThirdsView
            advancingThirds={advancingThirds}
            allThirdTeams={allThirdTeams}
            getGroupTeamData={getGroupTeamData}
          />
        )}

        {/* VISTA 3: BRACKET / ELIMINATORIAS */}
        {(!part.groups || Object.keys(part.groups).length === 0 || activeTab === 'bracket') && (
          <BracketView
            champName={champName}
            thirdWinnerName={thirdWinnerName}
            finalHome={finalHome}
            finalAway={finalAway}
            thirdHome={thirdHome}
            thirdAway={thirdAway}
            getCenterPointsTotal={getCenterPointsTotal}
            hiddenRounds={hiddenRounds}
            leftRounds={leftRounds}
            rightRounds={rightRounds}
            renderCenter={renderCenter}
            renderRoundFooter={renderRoundFooter}
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
    <div
      id="points-breakdown-modal"
      className="modal flex z-[999999]"
      role="dialog"
      aria-modal="true"
      aria-label="Visor de porra"
      onClick={handleClose}
    >
      <div
        className="modal-content w-[98vw] max-w-475 text-left max-h-[95vh] overflow-y-auto pt-[25px]"
        role="presentation"
        onClick={(e) => e.stopPropagation()}
      >
        {content}
      </div>
    </div>
  );
}

export default PredictionViewer;
