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
import { extractGroupsFromR32 } from '../hooks/useBracket';
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
          style={{
            marginLeft: '4px',
            fontSize: '0.85em',
            fontWeight: 'bold',
            color: slotPoints === '0' ? '#e74c3c' : '#2ecc71',
            background: slotPoints === '0' ? 'rgba(231,76,60,0.1)' : 'rgba(46,204,113,0.1)',
            padding: '2px 4px',
            borderRadius: '4px',
          }}
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
        <div
          style={{
            fontSize: '0.85rem',
            fontWeight: 'bold',
            color: 'rgba(255,255,255,0.3)',
            pointerEvents: 'none',
          }}
        >
          0 pts
        </div>
      );
    }

    return (
      <div
        style={{
          fontSize: '0.85rem',
          fontWeight: 'bold',
          color: '#00d2d3',
          background: 'rgba(0, 210, 211, 0.1)',
          display: 'inline-block',
          padding: '2px 8px',
          borderRadius: '4px',
          pointerEvents: 'none',
        }}
      >
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
      <div style={{ display: 'block' }}>
        {/* FINAL HEADER & POINTS */}
        <div
          style={{
            position: 'absolute',
            top: finalTopY - 44,
            left: COL_GAP,
            width: colW,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 2,
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              fontSize: '0.65rem',
              fontWeight: 700,
              color: 'rgba(251,191,36,0.9)',
              letterSpacing: 2,
              textTransform: 'uppercase',
            }}
          >
            🏆 Final 🏆
          </div>
          {centerTotal > 0 ? (
            <div
              style={{
                fontSize: '0.85rem',
                fontWeight: 'bold',
                color: '#00d2d3',
                background: 'rgba(0, 210, 211, 0.1)',
                display: 'inline-block',
                padding: '2px 8px',
                borderRadius: '4px',
              }}
            >
              +{centerTotal} pts
            </div>
          ) : (
            <div
              style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'rgba(255,255,255,0.3)' }}
            >
              0 pts
            </div>
          )}
        </div>

        <div
          className="match final-match"
          style={{ position: 'absolute', top: finalTopY, left: COL_GAP, width: colW }}
        >
          {renderSlot(finalHome, { roundIndex: 'final', isHome: true })}
          {renderSlot(finalAway, { roundIndex: 'final', isHome: false })}
        </div>

        {/* CAMPEÓN */}
        <div
          style={{
            position: 'absolute',
            top: finalTopY + MATCH_H + 16,
            left: COL_GAP,
            width: colW,
            textAlign: 'center',
          }}
        >
          <div
            style={{
              fontSize: '0.65rem',
              fontWeight: 700,
              color: 'var(--champion-gold)',
              letterSpacing: 2,
              textTransform: 'uppercase',
              marginBottom: 4,
            }}
          >
            🏆 Campeón
          </div>
          <div className="champion-display">
            <div
              className="team-slot"
              style={{
                height: 50,
                fontSize: '1.1rem',
                fontWeight: 'bold',
                justifyContent: 'center',
                pointerEvents: 'none',
                borderColor: '#fbbf24',
                background: 'rgba(251,191,36,0.15)',
                color: '#fbbf24',
              }}
            >
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
          style={{
            position: 'absolute',
            top: finalTopY + MATCH_H + 16 + MATCH_H + 36,
            left: COL_GAP,
            width: colW,
            textAlign: 'center',
          }}
        >
          <div
            style={{
              fontSize: '0.65rem',
              fontWeight: 700,
              color: 'var(--text-muted)',
              letterSpacing: 2,
              textTransform: 'uppercase',
              marginBottom: 4,
            }}
          >
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
            <div style={{ marginTop: 8, textAlign: 'center' }}>
              <div
                style={{
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  color: 'var(--text-muted)',
                  letterSpacing: 1.5,
                  textTransform: 'uppercase',
                  marginBottom: 4,
                }}
              >
                Ganador 3er Puesto:
              </div>
              <div className="champion-display" style={{ display: 'inline-block', width: '100%' }}>
                <div
                  className="team-slot"
                  style={{
                    height: 38,
                    fontSize: '0.95rem',
                    fontWeight: 'bold',
                    justifyContent: 'center',
                    pointerEvents: 'none',
                    borderColor: '#cd7f32',
                    background: 'rgba(205, 127, 50, 0.15)',
                    color: '#e0a96d',
                  }}
                >
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
          title="Clasificado Matemáticamente"
          aria-label="Clasificado Matemáticamente"
          style={{
            width: '8px',
            height: '8px',
            background: '#3498db',
            borderRadius: '50%',
            marginLeft: '6px',
            flexShrink: 0,
            display: 'inline-block',
          }}
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
        <span style={{ marginRight: '4px' }}>{medal}</span>{' '}
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
        <span
          style={{
            flexGrow: 1,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          {teamName}
          {blueDot}
        </span>
        {teamPts > 0 && (
          <span
            style={{
              marginLeft: '6px',
              fontSize: '0.85em',
              fontWeight: 'bold',
              color: 'rgba(0, 210, 211, 0.9)',
              background: 'rgba(0, 210, 211, 0.15)',
              padding: '1px 5px',
              borderRadius: '4px',
            }}
          >
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
        <div
          style={{
            textAlign: 'center',
            padding: '40px 20px',
            background: 'rgba(231,76,60,0.1)',
            borderRadius: '16px',
            border: '1px solid rgba(231,76,60,0.3)',
          }}
        >
          <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>🔒</div>
          <h3 style={{ color: '#e74c3c', marginBottom: '10px' }}>Porra no disponible</h3>
          <p style={{ color: 'var(--text-muted)', lineHeight: '1.5' }}>{error}</p>
        </div>
      );
    }
    return (
      <div
        id="points-breakdown-modal"
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="Visor de porra"
        style={{ display: 'flex', zIndex: 999999 }}
        onClick={handleClose}
      >
        <div
          className="modal-content"
          style={{ width: '95vw', maxWidth: '600px', textAlign: 'center', padding: '50px' }}
          role="presentation"
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>🔒</div>
          <h3 style={{ color: '#e74c3c', marginBottom: '10px' }}>Porra no disponible</h3>
          <p style={{ color: 'var(--text-muted)', lineHeight: '1.5' }}>{error}</p>
          <button
            onClick={handleClose}
            className="glass-btn primary-btn"
            style={{ marginTop: '20px' }}
          >
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
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="Visor de porra"
        style={{ display: 'flex', zIndex: 999999 }}
        onClick={handleClose}
      >
        <div
          className="modal-content"
          style={{ width: '95vw', maxWidth: '600px', padding: '28px 24px' }}
          role="presentation"
          onClick={(e) => e.stopPropagation()}
        >
          <PredictionSkeleton compact />
          <button
            onClick={handleClose}
            className="glass-btn"
            style={{ marginTop: '8px', width: '100%' }}
          >
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  if (!part) {
    if (inline) {
      return (
        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>⚠️</div>
          <h3 style={{ color: 'var(--text-color)', marginBottom: '10px' }}>Porra no encontrada</h3>
          <p style={{ color: 'var(--text-muted)' }}>
            No se encontraron los datos de la porra seleccionada.
          </p>
        </div>
      );
    }
    return (
      <div
        id="points-breakdown-modal"
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="Visor de porra"
        style={{ display: 'flex', zIndex: 999999 }}
        onClick={handleClose}
      >
        <div
          className="modal-content"
          style={{ width: '95vw', maxWidth: '600px', textAlign: 'center', padding: '50px' }}
          role="presentation"
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>⚠️</div>
          <h3 style={{ color: 'var(--text-color)', marginBottom: '10px' }}>Porra no encontrada</h3>
          <p style={{ color: 'var(--text-muted)' }}>
            No se encontraron los datos de la porra seleccionada.
          </p>
          <button
            onClick={handleClose}
            className="glass-btn primary-btn"
            style={{ marginTop: '20px' }}
          >
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

      <div style={{ display: 'flex', flexDirection: 'column' }}>
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
    return (
      <div
        className="prediction-viewer-inline"
        style={{ width: '100%', maxWidth: '1800px', margin: '0 auto' }}
      >
        {content}
      </div>
    );
  }

  return (
    <div
      id="points-breakdown-modal"
      className="modal"
      role="dialog"
      aria-modal="true"
      aria-label="Visor de porra"
      style={{ display: 'flex', zIndex: 999999 }}
      onClick={handleClose}
    >
      <div
        className="modal-content"
        style={{
          width: '98vw',
          maxWidth: '1900px',
          textAlign: 'left',
          maxHeight: '95vh',
          overflowY: 'auto',
          paddingTop: '25px',
        }}
        role="presentation"
        onClick={(e) => e.stopPropagation()}
      >
        {content}
      </div>
    </div>
  );
}

export default PredictionViewer;
