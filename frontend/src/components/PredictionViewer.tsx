import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAppContext } from '../context/AppContext';
import Flag from './Flag';
import { usePredictionViewerData } from '../hooks/usePredictionViewerData';
import { PredictionSkeleton } from './Skeleton';
import { extractGroupsFromR32 } from '../hooks/useBracket';
import BracketCanvas, { TeamSlot, matchTop, MATCH_H, COL_GAP } from './BracketCanvas';

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

  const [activeTab, setActiveTab] = useState(() =>
    initialSection === 'knockout' ? 'bracket' : 'groups',
  );

  const isKnockoutMatch = (m) => {
    if (!m) return false;
    if (m.groupName && m.groupName !== '-' && m.groupName.trim() !== '') return false;
    const r = (m.round || '').toLowerCase().trim();
    if (r === 'group' || r.startsWith('group') || r.includes('grupo') || r.includes('jornada'))
      return false;
    return true;
  };

  const featuredMatch = useMemo(() => {
    if (!allGames || allGames.length === 0) return null;
    const koUnfinished = allGames
      .filter((g) => g && isKnockoutMatch(g) && !g.finished && !g.winner && g.home_score == null)
      .sort(
        (a, b) => new Date(a.date || Infinity).getTime() - new Date(b.date || Infinity).getTime(),
      );
    return koUnfinished[0] || null;
  }, [allGames]);

  const isMatchInRound = (match, ctx) => {
    if (!match || !ctx) return true;
    if (!isKnockoutMatch(match)) return false;
    const r = (match.round || '').toLowerCase();
    const idx = ctx.roundIndex;
    if (idx === 0) return r === 'r32' || r === '32' || r.includes('32') || r.includes('16avo');
    if (idx === 1) return r === 'r16' || r === '16' || r.includes('16') || r.includes('octav');
    if (idx === 2) return r === 'qf' || r.includes('quart') || r.includes('cuart');
    if (idx === 3) return r === 'sf' || r.includes('semi') || r.includes('semis');
    if (idx === 'final') return r === 'final' || r.includes('final');
    if (idx === 'thirdPlaceMatch')
      return r === 'third' || r.includes('tercer') || r.includes('3rd') || r.includes('3er');
    return true;
  };

  /**
   * Abre automáticamente la sección que tiene más sentido mostrar
   * basado en en qué fase del mundial nos encontremos.
   */
  useEffect(() => {
    const handleKeyDown = (e) => {
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
    slotItem,
    { roundIndex }: { roundIndex: number | string; isHome?: boolean },
  ) => {
    const name = typeof slotItem === 'object' && slotItem !== null ? slotItem.name : slotItem;
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
      if (isMatchInRound(featuredMatch, { roundIndex })) {
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
  const renderRoundFooter = (roundIndex, side) => {
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
  const renderCenter = (colW) => {
    const centerTotal = getCenterPointsTotal();
    const champName =
      typeof part?.champion === 'object' && part.champion !== null
        ? part.champion.name
        : part?.champion;
    const thirdWinnerName =
      typeof part?.thirdPlaceWinner === 'object' && part.thirdPlaceWinner !== null
        ? part.thirdPlaceWinner.name
        : part?.thirdPlaceWinner;

    const finalHome = Array.isArray(part?.final)
      ? part.final[0]
      : part?.final?.home || part?.finalMatch?.[0];
    const finalAway = Array.isArray(part?.final)
      ? part.final[1]
      : part?.final?.away || part?.finalMatch?.[1];
    const thirdHome = Array.isArray(part?.thirdPlaceMatch)
      ? part.thirdPlaceMatch[0]
      : part?.thirdPlaceMatch?.home || part?.thirdMatch?.[0];
    const thirdAway = Array.isArray(part?.thirdPlaceMatch)
      ? part.thirdPlaceMatch[1]
      : part?.thirdPlaceMatch?.away || part?.thirdMatch?.[1];

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
  const renderGroupTeam = (groupName, teamName, expectedPos, defaultColor, medal) => {
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

    const resolveName = (n) =>
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

  const getTeamVal = (groupVal, idx, key) => {
    if (!groupVal) return null;
    if (Array.isArray(groupVal)) return groupVal[idx] || null;
    if (typeof groupVal === 'object') return groupVal[key] || null;
    return null;
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

  const allThirdTeams = useMemo(() => {
    if (!part?.groups) return [];
    const list = [];
    Object.keys(part.groups)
      .sort()
      .forEach((g) => {
        const groupVal = part.groups[g];
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
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          paddingBottom: '10px',
          marginBottom: '15px',
          flexWrap: 'wrap',
          gap: '10px',
        }}
      >
        <h3
          style={{
            color: 'var(--accent-cyan, #00d2d3)',
            fontFamily: "'Outfit', sans-serif",
            fontSize: '1.25rem',
            fontWeight: 800,
            letterSpacing: '-0.3px',
            margin: 0,
          }}
        >
          Porra de {part.user}
        </h3>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          {part.scorer && (
            <div
              style={{
                background: 'rgba(255,159,67,0.15)',
                border: '1px solid rgba(255,159,67,0.4)',
                padding: '4px 10px',
                borderRadius: '8px',
                color: '#ff9f43',
                fontWeight: 'bold',
                fontSize: '0.85rem',
              }}
            >
              ⚽ Pichichi: {part.scorer}
            </div>
          )}
          <div
            style={{
              background: 'rgba(0,210,211,0.12)',
              border: '1px solid rgba(0,210,211,0.4)',
              padding: '4px 10px',
              borderRadius: '8px',
              color: 'var(--accent-cyan, #00d2d3)',
              fontWeight: 800,
              fontSize: '0.95rem',
            }}
          >
            🏆 Total: {points.total} pts
          </div>
          {inline && onEdit ? (
            <button
              type="button"
              onClick={onEdit}
              className="glass-btn primary-btn"
              style={{
                padding: '5px 14px',
                fontSize: '0.88rem',
                borderRadius: '8px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              ✏️ Modificar Pronóstico
            </button>
          ) : !inline ? (
            <button
              type="button"
              onClick={handleClose}
              className="glass-btn"
              style={{
                padding: '5px 14px',
                fontSize: '0.88rem',
                borderRadius: '8px',
                fontWeight: 700,
                cursor: 'pointer',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                background: 'rgba(255, 255, 255, 0.08)',
                color: '#fff',
              }}
            >
              ✕ Cerrar
            </button>
          ) : null}
        </div>
      </div>

      {/* PESTAÑAS DE VISTA ESTILO PILLS */}
      {part.groups && Object.keys(part.groups).length > 0 && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            marginBottom: '20px',
            marginTop: '5px',
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
              width: '100%',
              maxWidth: '520px',
              boxSizing: 'border-box',
              background: 'rgba(15, 23, 42, 0.8)',
              padding: '4px',
              borderRadius: '16px',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              boxShadow: '0 8px 25px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
              backdropFilter: 'blur(12px)',
              gap: '4px',
            }}
          >
            <button
              type="button"
              onClick={() => setActiveTab('groups')}
              style={{
                padding: '8px 6px',
                fontWeight: 800,
                fontSize: 'clamp(0.7rem, 3vw, 0.95rem)',
                minWidth: 0,
                justifyContent: 'center',
                background:
                  activeTab === 'groups'
                    ? 'linear-gradient(135deg, #00d2d3, #01a3a4)'
                    : 'transparent',
                border: 'none',
                color: activeTab === 'groups' ? '#000000' : 'var(--text-muted)',
                cursor: 'pointer',
                borderRadius: '12px',
                transition: 'all 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)',
                boxShadow: activeTab === 'groups' ? '0 4px 15px rgba(0, 210, 211, 0.4)' : 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                letterSpacing: '0.5px',
                whiteSpace: 'nowrap',
              }}
            >
              Grupos
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('thirds')}
              style={{
                padding: '8px 6px',
                fontWeight: 800,
                fontSize: 'clamp(0.7rem, 3vw, 0.95rem)',
                minWidth: 0,
                justifyContent: 'center',
                background:
                  activeTab === 'thirds'
                    ? 'linear-gradient(135deg, #a29bfe, #6c5ce7)'
                    : 'transparent',
                border: 'none',
                color: activeTab === 'thirds' ? '#ffffff' : 'var(--text-muted)',
                cursor: 'pointer',
                borderRadius: '12px',
                transition: 'all 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)',
                boxShadow: activeTab === 'thirds' ? '0 4px 15px rgba(108, 92, 231, 0.4)' : 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                letterSpacing: '0.5px',
                whiteSpace: 'nowrap',
              }}
            >
              Terceros
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('bracket')}
              style={{
                padding: '8px 6px',
                fontWeight: 800,
                fontSize: 'clamp(0.7rem, 3vw, 0.95rem)',
                minWidth: 0,
                justifyContent: 'center',
                background:
                  activeTab === 'bracket'
                    ? 'linear-gradient(135deg, #ff9f43, #ffaf60)'
                    : 'transparent',
                border: 'none',
                color: activeTab === 'bracket' ? '#000000' : 'var(--text-muted)',
                cursor: 'pointer',
                borderRadius: '12px',
                transition: 'all 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)',
                boxShadow: activeTab === 'bracket' ? '0 4px 15px rgba(255, 159, 67, 0.4)' : 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                letterSpacing: '0.5px',
                whiteSpace: 'nowrap',
              }}
            >
              Bracket
            </button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {/* VISTA 1: FASE DE GRUPOS */}
        {part.groups && Object.keys(part.groups).length > 0 && activeTab === 'groups' && (
          <div
            className="modal-groups-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
              gap: '14px',
              marginTop: '16px',
              width: '100%',
              maxWidth: '1500px',
              alignSelf: 'center',
            }}
          >
            {Object.keys(part.groups).map((g) => {
              let groupPts = 0;
              points?.log
                ?.filter(
                  (l) =>
                    l.stage === 'r1' &&
                    (l.msg.includes(`Grupo ${g}`) || l.msg.includes(`Grupo ${g.toUpperCase()}`)),
                )
                .forEach((l) => {
                  groupPts += l.amount;
                });

              const t1 = getTeamVal(part.groups[g], 0, 'first');
              const t2 = getTeamVal(part.groups[g], 1, 'second');
              const t3 = getTeamVal(part.groups[g], 2, 'third');

              return (
                <div
                  key={g}
                  style={{
                    background:
                      'linear-gradient(145deg, rgba(30, 41, 59, 0.92), rgba(15, 23, 42, 0.88))',
                    border: '1px solid rgba(148, 163, 184, 0.18)',
                    padding: '14px',
                    borderRadius: '12px',
                    textAlign: 'left',
                    minWidth: 0,
                    boxShadow: '0 6px 18px rgba(0, 0, 0, 0.12)',
                  }}
                >
                  <div
                    style={{
                      fontWeight: 'bold',
                      color: 'var(--accent-color)',
                      marginBottom: '8px',
                      fontSize: '1.1em',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      borderBottom: '1px solid rgba(255,255,255,0.1)',
                      paddingBottom: '5px',
                    }}
                  >
                    <span>Grupo {g}</span>
                    {groupPts > 0 && (
                      <span
                        style={{
                          fontSize: '0.85em',
                          background: 'rgba(0, 210, 211, 0.15)',
                          padding: '2px 8px',
                          borderRadius: '10px',
                        }}
                      >
                        +{groupPts}
                      </span>
                    )}
                  </div>
                  {t1 && renderGroupTeam(g, t1, 1, 'white', '🥇')}
                  {t2 && renderGroupTeam(g, t2, 2, '#ddd', '🥈')}
                  {t3 && renderGroupTeam(g, t3, 3, '#bbb', '🥉')}
                </div>
              );
            })}
          </div>
        )}

        {/* VISTA 2: MEJORES TERCEROS */}
        {part.groups && Object.keys(part.groups).length > 0 && activeTab === 'thirds' && (
          <div style={{ marginTop: '10px' }}>
            <div
              style={{
                padding: '16px 20px',
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '12px',
                marginBottom: '20px',
                textAlign: 'center',
              }}
            >
              <h4 style={{ margin: '0 0 6px 0', color: '#a29bfe', fontSize: '1.1rem' }}>
                Mejores Terceros Seleccionados ({advancingThirds.length}/8 a Dieciseisavos)
              </h4>
              <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-muted)' }}>
                De los 12 equipos situados en 3ª posición en la fase de grupos, estos son los 8 que
                elegiste para avanzar al cuadro.
              </p>
            </div>

            {allThirdTeams.length === 0 ? (
              <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '30px' }}>
                No se han encontrado equipos clasificados en 3ª posición.
              </p>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                  gap: '12px',
                }}
              >
                {allThirdTeams.map(({ group, team }) => {
                  const isAdvancing = advancingThirds.includes(team);
                  const { color, status } = getGroupTeamData(group, team, 3);
                  const displayColor =
                    color === 'inherit' ? (isAdvancing ? '#00d2d3' : 'var(--text-muted)') : color;

                  return (
                    <div
                      key={group}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '12px 16px',
                        borderRadius: '10px',
                        background: isAdvancing
                          ? 'rgba(0, 210, 211, 0.08)'
                          : 'rgba(255, 255, 255, 0.03)',
                        border: isAdvancing
                          ? '1px solid rgba(0, 210, 211, 0.4)'
                          : '1px solid rgba(255, 255, 255, 0.08)',
                        boxShadow: isAdvancing ? '0 4px 15px rgba(0, 210, 211, 0.15)' : 'none',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          minWidth: 0,
                          flex: 1,
                        }}
                      >
                        <span
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 800,
                            padding: '3px 8px',
                            borderRadius: '6px',
                            background: 'rgba(255, 255, 255, 0.08)',
                            color: 'var(--text-muted)',
                            letterSpacing: '0.5px',
                          }}
                        >
                          G.{group}
                        </span>
                        <Flag
                          team={team}
                          size="w40"
                          style={{
                            width: 22,
                            height: 16,
                            objectFit: 'cover',
                            borderRadius: '3px',
                            flexShrink: 0,
                          }}
                        />
                        <span
                          style={{
                            fontWeight: 700,
                            fontSize: '0.95rem',
                            color: displayColor,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {team}
                        </span>
                        {status === 5 && (
                          <span
                            title="Clasificado Matemáticamente"
                            style={{
                              width: '8px',
                              height: '8px',
                              background: '#3498db',
                              borderRadius: '50%',
                              display: 'inline-block',
                              flexShrink: 0,
                            }}
                          />
                        )}
                      </div>
                      <span
                        role="img"
                        title={
                          isAdvancing
                            ? 'Seleccionado para avanzar a R32'
                            : 'No seleccionado para avanzar a R32'
                        }
                        aria-label={
                          isAdvancing
                            ? 'Seleccionado para avanzar a R32'
                            : 'No seleccionado para avanzar a R32'
                        }
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          width: '26px',
                          height: '26px',
                          marginLeft: '8px',
                          borderRadius: '50%',
                          fontSize: '0.95rem',
                          fontWeight: 800,
                          lineHeight: 1,
                          background: isAdvancing
                            ? 'rgba(0, 210, 211, 0.16)'
                            : 'rgba(255, 255, 255, 0.05)',
                          color: isAdvancing ? '#00d2d3' : 'var(--text-muted)',
                          border: isAdvancing
                            ? '1px solid rgba(0, 210, 211, 0.4)'
                            : '1px solid rgba(255, 255, 255, 0.12)',
                        }}
                      >
                        {isAdvancing ? '✓' : '×'}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* VISTA 3: BRACKET / ELIMINATORIAS */}
        {(!part.groups || Object.keys(part.groups).length === 0 || activeTab === 'bracket') && (
          <div
            style={{
              paddingBottom: '20px',
              marginTop: '10px',
            }}
          >
            <BracketCanvas
              leftRounds={leftRounds}
              rightRounds={rightRounds}
              renderSlot={renderSlot}
              renderCenter={renderCenter}
              hiddenRounds={hiddenRounds}
              renderRoundFooter={renderRoundFooter}
              mobileCenter={() => {
                const centerTotal = getCenterPointsTotal();
                const champName =
                  typeof part?.champion === 'object' && part.champion !== null
                    ? part.champion.name
                    : part?.champion;
                const thirdWinnerName =
                  typeof part?.thirdPlaceWinner === 'object' && part.thirdPlaceWinner !== null
                    ? part.thirdPlaceWinner.name
                    : part?.thirdPlaceWinner;

                const finalHome = Array.isArray(part?.final)
                  ? part.final[0]
                  : part?.final?.home || part?.finalMatch?.[0];
                const finalAway = Array.isArray(part?.final)
                  ? part.final[1]
                  : part?.final?.away || part?.finalMatch?.[1];
                const thirdHome = Array.isArray(part?.thirdPlaceMatch)
                  ? part.thirdPlaceMatch[0]
                  : part?.thirdPlaceMatch?.home || part?.thirdMatch?.[0];
                const thirdAway = Array.isArray(part?.thirdPlaceMatch)
                  ? part.thirdPlaceMatch[1]
                  : part?.thirdPlaceMatch?.away || part?.thirdMatch?.[1];

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    {/* Final */}
                    <div>
                      <div
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          color: 'rgba(251,191,36,0.9)',
                          letterSpacing: 2,
                          textTransform: 'uppercase',
                          textAlign: 'center',
                          marginBottom: 8,
                        }}
                      >
                        🏆 Final 🏆
                      </div>
                      <div className="mb-match-card">
                        {renderSlot(finalHome, { roundIndex: 'final', isHome: true })}
                        {renderSlot(finalAway, { roundIndex: 'final', isHome: false })}
                      </div>
                    </div>
                    {/* Campeón */}
                    <div style={{ textAlign: 'center' }}>
                      <div
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          color: 'var(--champion-gold)',
                          letterSpacing: 2,
                          textTransform: 'uppercase',
                          marginBottom: 8,
                        }}
                      >
                        🏆 Campeón
                      </div>
                      <div className="champion-display">
                        {renderSlot(champName, { roundIndex: 'champion' })}
                      </div>
                    </div>
                    {/* Tercer Puesto */}
                    <div>
                      <div
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          color: 'var(--text-muted)',
                          letterSpacing: 2,
                          textTransform: 'uppercase',
                          textAlign: 'center',
                          marginBottom: 8,
                        }}
                      >
                        🥉 Tercer Puesto
                      </div>
                      <div className="mb-match-card">
                        {renderSlot(thirdHome, {
                          roundIndex: 'thirdPlaceMatch',
                          isHome: true,
                        })}
                        {renderSlot(thirdAway, {
                          roundIndex: 'thirdPlaceMatch',
                          isHome: false,
                        })}
                      </div>
                    </div>
                    {/* Ganador Tercer Puesto */}
                    {thirdWinnerName && (
                      <div style={{ textAlign: 'center' }}>
                        <div
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            color: 'var(--text-muted)',
                            letterSpacing: 1.5,
                            textTransform: 'uppercase',
                            marginBottom: 8,
                          }}
                        >
                          🥉 Ganador 3er Puesto
                        </div>
                        <div className="champion-display">
                          {renderSlot(thirdWinnerName, { roundIndex: 'thirdPlaceMatch' })}
                        </div>
                      </div>
                    )}
                    {/* Puntos del centro */}
                    {centerTotal > 0 && (
                      <div style={{ textAlign: 'center' }}>
                        <div
                          style={{
                            fontSize: '0.85rem',
                            fontWeight: 'bold',
                            color: '#00d2d3',
                            background: 'rgba(0, 210, 211, 0.1)',
                            display: 'inline-block',
                            padding: '4px 12px',
                            borderRadius: '6px',
                          }}
                        >
                          +{centerTotal} pts
                        </div>
                      </div>
                    )}
                  </div>
                );
              }}
            />
          </div>
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
