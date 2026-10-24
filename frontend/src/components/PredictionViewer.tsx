import { useState, useEffect, useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import { getCountryCode } from '../utils/constants';
import { useBetViewerData } from '../hooks/useBetViewerData';
import BracketCanvas, { TeamSlot, matchTop, MATCH_H, COL_GAP } from './BracketCanvas';

/**
 * Componente principal para visualizar la porra de un usuario específico.
 * Se muestra como un modal flotante.
 * Integra la fase de grupos y la vista de Bracket de eliminatorias.
 *
 * @component
 * @returns {JSX.Element|null} El modal del visor de porras, o null si no hay porra seleccionada.
 */
function PredictionViewer() {
  const state = useAppContext();
  const { viewerBetId, setViewerBetId, officialPoints, groupOdds, allGames, nameToIdMap } = state;
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
  } = useBetViewerData(
    viewerBetId,
    officialPoints,
    state.leaderboardData,
    groupOdds,
    allGames,
    nameToIdMap,
  );

  const [openSection, setOpenSection] = useState(() => initialSection || 'groups');

  const featuredMatch = useMemo(() => {
    if (!allGames || allGames.length === 0) return null;
    const koUnfinished = allGames
      .filter(
        (g) =>
          g &&
          g.round !== 'group' &&
          g.round !== 'r1' &&
          g.round !== '1' &&
          !g.finished &&
          !g.winner &&
          (g.home_score === null || g.home_score === undefined || g.home_score === ''),
      )
      .sort((a, b) => new Date(a.date || Infinity) - new Date(b.date || Infinity));
    return koUnfinished[0] || null;
  }, [allGames]);

  const isMatchInRound = (match, ctx) => {
    if (!match || !ctx) return true;
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
      if (e.key === 'Escape') setViewerBetId(null);
    };
    if (viewerBetId) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [viewerBetId, setViewerBetId]);

  useEffect(() => {
    if (initialSection) {
      setTimeout(() => setOpenSection(initialSection), 0);
    }
  }, [initialSection, viewerBetId]);

  /**
   * Función inyectada a BracketCanvas para pintar un "Slot" de un equipo en eliminatorias.
   * Colorea de verde si el usuario acertó el equipo clasificado, e inyecta los puntos obtenidos.
   *
   * @param {string} name - Nombre del equipo predicho por el usuario.
   * @param {Object} ctx - Contexto del slot (side, roundIndex, matchIndex, isHome).
   * @returns {JSX.Element} Un TeamSlot configurado.
   */
  const renderSlot = (name, { roundIndex }) => {
    const { isWinner, slotPoints } = getSlotDetails(name, roundIndex);

    let style = isWinner
      ? { borderLeft: '3px solid #2ecc71', background: 'rgba(46, 204, 113, 0.1)' }
      : {};
    let rightContent =
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
  const renderCenter = (colW) => (
    <div style={{ display: 'block' }}>
      {/* FINAL */}
      <div
        style={{
          position: 'absolute',
          top: finalTopY - 38,
          left: COL_GAP,
          width: colW,
          textAlign: 'center',
          fontSize: '0.65rem',
          fontWeight: 700,
          color: 'rgba(251,191,36,0.9)',
          letterSpacing: 2,
          textTransform: 'uppercase',
        }}
      >
        🏆 Final 🏆
      </div>

      {/* FOOTER TOTAL CENTER (now at top) */}
      {(() => {
        const total = getCenterPointsTotal();

        return (
          <div
            style={{
              position: 'absolute',
              top: finalTopY - 20,
              left: COL_GAP,
              width: colW,
              textAlign: 'center',
              pointerEvents: 'none',
            }}
          >
            {total > 0 ? (
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
                +{total} pts
              </div>
            ) : (
              <div
                style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'rgba(255,255,255,0.3)' }}
              >
                0 pts
              </div>
            )}
          </div>
        );
      })()}

      <div
        className="match final-match"
        style={{ position: 'absolute', top: finalTopY, left: COL_GAP, width: colW }}
      >
        {renderSlot(part.final?.[0], { roundIndex: 'final', isHome: true })}
        {renderSlot(part.final?.[1], { roundIndex: 'final', isHome: false })}
      </div>

      {/* CAMPEÓN */}
      <div
        style={{
          position: 'absolute',
          top: finalTopY + MATCH_H + 18,
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
            marginBottom: 6,
          }}
        >
          🏆 Campeón
        </div>
        <div className="champion-display">
          {renderSlot(part.champion, { roundIndex: 'champion' })}
        </div>
      </div>

      {/* TERCER PUESTO */}
      <div
        style={{
          position: 'absolute',
          top: finalTopY + MATCH_H + 18 + MATCH_H + 44,
          left: COL_GAP,
          width: colW,
        }}
      >
        <div
          style={{
            fontSize: '0.65rem',
            fontWeight: 700,
            color: 'var(--text-muted)',
            letterSpacing: 2,
            textTransform: 'uppercase',
            marginBottom: 6,
            textAlign: 'center',
          }}
        >
          🥉 Tercer Puesto
        </div>
        <div className="match third-place">
          {renderSlot(part.thirdPlaceMatch?.[0], { roundIndex: 'thirdPlaceMatch', isHome: true })}
          {renderSlot(part.thirdPlaceMatch?.[1], { roundIndex: 'thirdPlaceMatch', isHome: false })}
        </div>
      </div>
    </div>
  );

  /**
   * Renderiza un equipo dentro de su tabla de grupo.
   */
  const renderGroupTeam = (groupName, teamName, expectedPos, defaultColor, medal) => {
    let { color, status } = getGroupTeamData(groupName, teamName, expectedPos);
    if (color === 'inherit') color = defaultColor;

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

    let teamPts = 0;
    points?.log
      ?.filter((l) => l.stage === 'r1' && l.msg.includes(`Grupo ${groupName}`))
      .forEach((l) => {
        if (l.msg.includes(teamName)) teamPts += l.amount;
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
        {!teamName.includes('º') &&
          getCountryCode(teamName) !== 'xx' &&
          !teamName.toLowerCase().includes('por definir') && (
            <img
              src={`https://flagcdn.com/w40/${getCountryCode(teamName)}.png`}
              alt=""
              width={16}
              height={12}
              loading="lazy"
              style={{
                width: '16px',
                height: '12px',
                objectFit: 'cover',
                borderRadius: '2px',
                marginRight: '4px',
                flexShrink: 0,
              }}
            />
          )}{' '}
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

  const handleSectionChange = (section) => {
    setOpenSection((prev) => (prev === section ? null : section));
  };

  if (!viewerBetId) return null;

  if (error) {
    return (
      <div
        id="points-breakdown-modal"
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="Visor de porra"
        style={{ display: 'flex', zIndex: 999999 }}
        onClick={() => setViewerBetId(null)}
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
            onClick={() => setViewerBetId(null)}
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
    return (
      <div
        id="points-breakdown-modal"
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="Visor de porra"
        style={{ display: 'flex', zIndex: 999999 }}
        onClick={() => setViewerBetId(null)}
      >
        <div
          className="modal-content"
          style={{ width: '95vw', maxWidth: '600px', textAlign: 'center', padding: '50px' }}
          role="presentation"
          onClick={(e) => e.stopPropagation()}
        >
          <h2 style={{ color: 'var(--accent-color)', marginBottom: '16px' }}>Cargando porra...</h2>
          <button
            onClick={() => setViewerBetId(null)}
            className="glass-btn"
            style={{ marginTop: '10px' }}
          >
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  if (!part) {
    return (
      <div
        id="points-breakdown-modal"
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="Visor de porra"
        style={{ display: 'flex', zIndex: 999999 }}
        onClick={() => setViewerBetId(null)}
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
            onClick={() => setViewerBetId(null)}
            className="glass-btn primary-btn"
            style={{ marginTop: '20px' }}
          >
            Cerrar
          </button>
        </div>
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
      onClick={() => setViewerBetId(null)}
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
            <h3 style={{ color: 'var(--accent-color)', margin: 0 }}>Porra de {part.user}</h3>
            <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
              {part.scorer && (
                <div
                  style={{
                    background: 'rgba(255,159,67,0.15)',
                    border: '1px solid rgba(255,159,67,0.3)',
                    padding: '4px 10px',
                    borderRadius: '8px',
                    color: '#ff9f43',
                    fontWeight: 'bold',
                    fontSize: '0.9em',
                  }}
                >
                  ⚽ Pichichi: {part.scorer}
                </div>
              )}
              <div
                style={{
                  background: 'rgba(0,210,211,0.15)',
                  border: '1px solid rgba(0,210,211,0.3)',
                  padding: '4px 10px',
                  borderRadius: '8px',
                  color: 'var(--accent-color)',
                  fontWeight: 'bold',
                  fontSize: '1.1em',
                }}
              >
                🏆 Total: {points.total} pts
              </div>
              <button
                onClick={() => setViewerBetId(null)}
                className="glass-btn primary-btn"
                style={{ padding: '4px 15px', fontSize: '1rem', borderRadius: '8px' }}
              >
                Cerrar
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {part.groups && Object.keys(part.groups).length > 0 && (
              <details
                id="details-groups"
                open={openSection === 'groups'}
                style={{ marginBottom: '10px', order: initialSection === 'knockout' ? 2 : 1 }}
              >
                <summary
                  onClick={(e) => {
                    e.preventDefault();
                    handleSectionChange('groups');
                  }}
                  style={{
                    color: '#00d2d3',
                    fontSize: '1.2em',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    padding: '5px 0',
                    userSelect: 'none',
                  }}
                >
                  Fase de Grupos
                </summary>
                <div
                  className="modal-groups-grid"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                    gap: '10px',
                    marginTop: '10px',
                  }}
                >
                  {Object.keys(part.groups).map((g) => {
                    let groupPts = 0;
                    points?.log
                      ?.filter((l) => l.stage === 'r1' && l.msg.includes(`Grupo ${g}`))
                      .forEach((l) => {
                        groupPts += l.amount;
                      });

                    return (
                      <div
                        key={g}
                        style={{
                          background: 'rgba(255,255,255,0.05)',
                          border: '1px solid rgba(255,255,255,0.1)',
                          padding: '10px',
                          borderRadius: '8px',
                          textAlign: 'left',
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
                        {renderGroupTeam(g, part.groups[g][0], 1, 'white', '🥇')}
                        {renderGroupTeam(g, part.groups[g][1], 2, '#ddd', '🥈')}
                        {part.thirds &&
                          part.thirds.includes(part.groups[g][2]) &&
                          renderGroupTeam(g, part.groups[g][2], 3, '#bbb', '🥉')}
                      </div>
                    );
                  })}
                </div>
              </details>
            )}

            <details
              id="details-knockout"
              open={openSection === 'knockout'}
              style={{ marginBottom: '20px', order: initialSection === 'knockout' ? 1 : 2 }}
            >
              <summary
                onClick={(e) => {
                  e.preventDefault();
                  handleSectionChange('knockout');
                }}
                style={{
                  color: '#00d2d3',
                  fontSize: '1.2em',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  padding: '5px 0',
                  userSelect: 'none',
                  marginBottom: '10px',
                }}
              >
                Eliminatorias
              </summary>

              <div
                style={{
                  paddingBottom: '20px',
                  border: '1px solid rgba(255,255,255,0.05)',
                  borderRadius: '8px',
                  background: 'rgba(0,0,0,0.15)',
                }}
              >
                <BracketCanvas
                  leftRounds={leftRounds}
                  rightRounds={rightRounds}
                  renderSlot={renderSlot}
                  renderCenter={renderCenter}
                  hiddenRounds={hiddenRounds}
                  renderRoundFooter={renderRoundFooter}
                  mobileCenter={() => (
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
                          {renderSlot(part.final?.[0], { roundIndex: 'final', isHome: true })}
                          {renderSlot(part.final?.[1], { roundIndex: 'final', isHome: false })}
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
                          {renderSlot(part.champion, { roundIndex: 'champion' })}
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
                          {renderSlot(part.thirdPlaceMatch?.[0], {
                            roundIndex: 'thirdPlaceMatch',
                            isHome: true,
                          })}
                          {renderSlot(part.thirdPlaceMatch?.[1], {
                            roundIndex: 'thirdPlaceMatch',
                            isHome: false,
                          })}
                        </div>
                      </div>
                      {/* Puntos del centro */}
                      {(() => {
                        const total = getCenterPointsTotal();
                        return total > 0 ? (
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
                              +{total} pts
                            </div>
                          </div>
                        ) : null;
                      })()}
                    </div>
                  )}
                />
              </div>
            </details>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PredictionViewer;
