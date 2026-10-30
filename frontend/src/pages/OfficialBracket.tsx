import { useState, useMemo, type CSSProperties } from 'react';
import { Navigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import BracketCanvas, { TeamSlot, matchTop, MATCH_H, COL_GAP } from '../components/BracketCanvas';
import Flag from '../components/Flag';
import {
  buildBracketData,
  isMatchInRound,
  matchTeamNames,
  nextKnockoutMatch,
  slotName,
  type BracketSlot,
} from '../utils/bracketBuilder';
import type { CanvasMatch, SlotContext } from '../components/BracketCanvas';

/** Huecos de la final y del tercer puesto, que la página pinta fuera del lienzo. */
interface CenterSlotContext {
  side: 'center';
  roundIndex: 'final' | 'thirdPlaceMatch';
  isHome: boolean;
  matchIndex?: number;
}

type OfficialSlotContext = SlotContext | CenterSlotContext;
import LiveMatchesPanel from '../components/Home/LiveMatchesPanel';
import TopScorersPanel from '../components/Home/TopScorersPanel';
import OfficialGroupsView from '../components/Home/OfficialGroupsView';

/**
 * Componente que muestra el Bracket Oficial (los cruces reales del torneo).
 * Calcula y resuelve en vivo qué equipos avanzan con la lógica de clasificación de terceros.
 *
 * @component
 * @returns {JSX.Element} La vista del bracket oficial.
 */
function OfficialBracket() {
  const { activeGroupPoolFormat, activeCompetitionFormatType, loadingGroup, groupError } =
    useAppContext();

  const isMatchDay =
    activeGroupPoolFormat === 'MATCH_DAY' || activeCompetitionFormatType === 'LEAGUE';

  if (loadingGroup)
    return (
      <p role="status" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
        Cargando liga...
      </p>
    );
  if (groupError)
    return (
      <p role="alert" style={{ padding: '24px', textAlign: 'center', color: '#ff7675' }}>
        No se pudo cargar la liga. Inténtalo de nuevo.
      </p>
    );
  if (activeCompetitionFormatType && isMatchDay) {
    return <Navigate to="/tabla" replace />;
  }

  return <OfficialBracketView />;
}

function OfficialBracketView() {
  const {
    officialPoints,
    groupOdds,
    allGames,
    matchRadar,
    topScorers,
    topScorersLoading,
    topScorersError,
    refreshTopScorers,
    activeGroupPichichi,
  } = useAppContext();

  const [activePanel, setActivePanel] = useState<'live' | 'scorers' | null>(null);
  const [activeTab, setActiveTab] = useState('cuadro'); // 'cuadro' | 'grupos'

  // Build bracket data
  const part = useMemo(
    () => buildBracketData(officialPoints, groupOdds, allGames),
    [officialPoints, groupOdds, allGames],
  );

  // Featured upcoming match
  const featuredMatch = useMemo(() => nextKnockoutMatch(allGames), [allGames]);

  const { leftRounds, rightRounds } = useMemo(() => {
    const toMatches = (arr: BracketSlot[][] | undefined): CanvasMatch<BracketSlot>[] =>
      (arr || []).map((m) => ({ home: m?.[0] || null, away: m?.[1] || null }));

    return {
      leftRounds: [
        toMatches(part.r32?.slice(0, 8)),
        toMatches(part.r16?.slice(0, 4)),
        toMatches(part.qf?.slice(0, 2)),
        toMatches(part.sf?.slice(0, 1)),
      ],
      rightRounds: [
        toMatches(part.r32?.slice(8, 16)),
        toMatches(part.r16?.slice(4, 8)),
        toMatches(part.qf?.slice(2, 4)),
        toMatches(part.sf?.slice(1, 2)),
      ],
    };
  }, [part]);

  if (!part) {
    return (
      <section
        className="view-section"
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '50vh',
        }}
      >
        <h2 style={{ color: 'var(--text-muted)' }}>Cargando cuadro oficial...</h2>
      </section>
    );
  }

  // Render slot
  const renderSlot = (teamOrObj: BracketSlot | undefined, context?: OfficialSlotContext) => {
    const isObj = typeof teamOrObj === 'object' && teamOrObj !== null;
    const name = slotName(teamOrObj);
    const isProv = isObj ? teamOrObj.isProvisional : false;

    let style: CSSProperties = isProv
      ? {
          border: '1px dashed #ff4757',
          animation: 'provisional-pulse 1.5s infinite',
        }
      : {};

    let scoreContent = null;
    let oppName: string | null = null;
    if (context && name && !name.includes('º') && name !== 'Por definir') {
      const { side, roundIndex, matchIndex, isHome } = context;
      let opponent = null;
      if (side === 'left') {
        opponent = isHome
          ? leftRounds[roundIndex][matchIndex]?.away
          : leftRounds[roundIndex][matchIndex]?.home;
      } else if (side === 'right') {
        opponent = isHome
          ? rightRounds[roundIndex][matchIndex]?.away
          : rightRounds[roundIndex][matchIndex]?.home;
      } else if (side === 'center') {
        if (roundIndex === 'final') opponent = isHome ? part.final?.[1] : part.final?.[0];
        else if (roundIndex === 'thirdPlaceMatch')
          opponent = isHome ? part.thirdPlaceMatch?.[1] : part.thirdPlaceMatch?.[0];
      }

      oppName = slotName(opponent);

      const m = (allGames || []).find((g) => {
        if (!g) return false;
        if (!isMatchInRound(g, context?.roundIndex)) return false;
        if (oppName && !oppName.includes('º') && oppName !== 'Por definir') {
          if (
            (matchTeamNames(g.home, name) && matchTeamNames(g.away, oppName)) ||
            (matchTeamNames(g.home, oppName) && matchTeamNames(g.away, name))
          ) {
            return true;
          }
        }
        if (roundIndex === 'final') {
          return matchTeamNames(g.home, name) || matchTeamNames(g.away, name);
        }
        if (roundIndex === 'thirdPlaceMatch') {
          return matchTeamNames(g.home, name) || matchTeamNames(g.away, name);
        }
        return false;
      });

      if (m && m.home_score != null && m.away_score != null) {
        const isHomeInMatch = matchTeamNames(m.home, name);
        const score = isHomeInMatch ? m.home_score : m.away_score;

        // Determine if this team won the match
        let isWinner = false;
        if (m.winner) {
          isWinner = matchTeamNames(m.winner, name);
        } else if (!isProv) {
          isWinner = isHomeInMatch ? m.home_score > m.away_score : m.away_score > m.home_score;
        }

        scoreContent = (
          <span
            style={{
              marginLeft: '4px',
              fontSize: '0.85em',
              fontWeight: 'bold',
              color: isWinner ? '#2ecc71' : 'var(--text-muted)',
              background: 'rgba(255,255,255,0.05)',
              padding: '2px 4px',
              borderRadius: '4px',
            }}
          >
            {score}
          </span>
        );
      }
    }

    let isFeatured = false;
    let isLive = false;
    if (featuredMatch && name && !name.includes('º') && name !== 'Por definir' && name !== '???') {
      if (isMatchInRound(featuredMatch, context?.roundIndex)) {
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
        boxShadow: isLive
          ? '0 0 16px rgba(255, 71, 87, 0.8), inset 0 0 10px rgba(255, 71, 87, 0.3)'
          : '0 0 16px rgba(0, 210, 211, 0.8), inset 0 0 10px rgba(0, 210, 211, 0.3)',
        background: isLive
          ? 'linear-gradient(90deg, rgba(255,71,87,0.25) 0%, rgba(15,15,26,0.95) 100%)'
          : 'linear-gradient(90deg, rgba(0,210,211,0.25) 0%, rgba(15,15,26,0.95) 100%)',
        animation: 'featured-match-pulse 1.5s infinite ease-in-out',
        position: 'relative',
        zIndex: 10,
        fontWeight: 'bold',
      };
    }

    return <TeamSlot name={name} slotStyle={style} rightContent={scoreContent} />;
  };

  // Hidden rounds
  const hiddenRounds = {
    0: false,
    1: false,
    2: false,
    3: false,
  };

  // Center content
  const finalTopY = matchTop(3, 0);

  const getName = slotName;
  const getIsProv = (t: BracketSlot | undefined) =>
    typeof t === 'object' && t ? t.isProvisional : false;

  const centerContent = (colW: number) => (
    <div style={{ display: 'block' }}>
      {/* FINAL */}
      <div
        style={{
          position: 'absolute',
          top: finalTopY - 22,
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
      <div
        className="match final-match"
        style={{ position: 'absolute', top: finalTopY, left: COL_GAP, width: colW }}
      >
        {renderSlot(part.final?.[0], { side: 'center', roundIndex: 'final', isHome: true })}
        {renderSlot(part.final?.[1], { side: 'center', roundIndex: 'final', isHome: false })}
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
          <div
            className="team-slot"
            style={{
              height: 50,
              fontSize: '1.1rem',
              fontWeight: 'bold',
              justifyContent: 'center',
              pointerEvents: 'none',
              borderColor: getIsProv(part.champion) ? '#ff4757' : '#fbbf24',
              background: 'rgba(251,191,36,0.15)',
              color: '#fbbf24',
              borderStyle: getIsProv(part.champion) ? 'dashed' : 'solid',
              animation: getIsProv(part.champion) ? 'provisional-pulse 1.5s infinite' : 'none',
            }}
          >
            <Flag
              team={getName(part.champion) || ''}
              size="w40"
              style={{
                width: 24,
                height: 18,
                borderRadius: 2,
                marginRight: 8,
                verticalAlign: 'middle',
              }}
            />
            {getName(part.champion) || '???'}
          </div>
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
          {renderSlot(part.thirdPlaceMatch?.[0], {
            side: 'center',
            roundIndex: 'thirdPlaceMatch',
            isHome: true,
          })}
          {renderSlot(part.thirdPlaceMatch?.[1], {
            side: 'center',
            roundIndex: 'thirdPlaceMatch',
            isHome: false,
          })}
        </div>
        <div style={{ marginTop: 8, textAlign: 'center' }}>
          <div
            style={{
              fontSize: '0.65rem',
              fontWeight: 700,
              color: '#cd7f32',
              letterSpacing: 2,
              textTransform: 'uppercase',
              marginBottom: 4,
            }}
          >
            🥉 3.º Puesto
          </div>
          <div className="champion-display">
            <div
              className="team-slot"
              style={{
                height: 38,
                fontSize: '0.95rem',
                fontWeight: 'bold',
                justifyContent: 'center',
                pointerEvents: 'none',
                borderColor: getIsProv(part.thirdPlaceWinner) ? '#ff4757' : '#cd7f32',
                background: 'rgba(205, 127, 50, 0.15)',
                color: '#e0a96d',
                borderStyle: getIsProv(part.thirdPlaceWinner) ? 'dashed' : 'solid',
                animation: getIsProv(part.thirdPlaceWinner)
                  ? 'provisional-pulse 1.5s infinite'
                  : 'none',
              }}
            >
              <Flag
                team={getName(part.thirdPlaceWinner) || ''}
                size="w40"
                style={{
                  width: 20,
                  height: 15,
                  borderRadius: 2,
                  marginRight: 6,
                  verticalAlign: 'middle',
                }}
              />
              {getName(part.thirdPlaceWinner) || '???'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <style>{`
      @keyframes provisional-pulse {
        0% { opacity: 1; border-color: #ff4757; }
        50% { opacity: 0.5; border-color: rgba(255,71,87,0.4); }
        100% { opacity: 1; border-color: #ff4757; }
      }
      @keyframes slideInRight {
        from { transform: translateX(30px) scale(0.96); opacity: 0; }
        to { transform: translateX(0) scale(1); opacity: 1; }
      }
      @keyframes featured-match-pulse {
        0% { filter: drop-shadow(0 0 2px rgba(0,210,211,0.4)); }
        50% { filter: drop-shadow(0 0 8px rgba(0,210,211,0.9)) brightness(1.1); }
        100% { filter: drop-shadow(0 0 2px rgba(0,210,211,0.4)); }
      }
    `}</style>
      <section
        className="view-section"
        style={{ display: 'block', paddingTop: 0, position: 'relative' }}
      >
        {/* PESTAÑAS DE NAVEGACIÓN ESTILO PILLS */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 'clamp(2px, 0.7vw, 8px)',
            marginBottom: '20px',
            marginTop: '5px',
            flexWrap: 'nowrap',
          }}
        >
          {activeTab === 'cuadro' && (
            <button
              className="glass-btn"
              onClick={() => setActivePanel((p) => (p === 'live' ? null : 'live'))}
              style={{
                padding: 'clamp(4px, 1.1vw, 6px) clamp(5px, 1.5vw, 10px)',
                fontSize: 'clamp(0.6rem, 2.4vw, 0.8rem)',
                fontWeight: 'bold',
                minHeight: 'auto',
                alignSelf: 'stretch',
                background: activePanel === 'live' ? 'rgba(255, 71, 87, 0.18)' : 'transparent',
                borderColor: activePanel === 'live' ? '#ff4757' : 'var(--border-color)',
                color: activePanel === 'live' ? '#ff4757' : 'var(--text-muted)',
                borderRadius: '12px',
                transition: 'all 0.2s',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              <span className="results-toggle-icon">🔴</span> Partidos
            </button>
          )}
          <div
            style={{
              display: 'inline-flex',
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
              onClick={() => setActiveTab('cuadro')}
              style={{
                padding: 'clamp(7px, 1.6vw, 8px) clamp(9px, 2.6vw, 22px)',
                fontWeight: 800,
                fontSize: 'clamp(0.76rem, 3vw, 0.95rem)',
                background:
                  activeTab === 'cuadro'
                    ? 'linear-gradient(135deg, #00d2d3, #01a3a4)'
                    : 'transparent',
                border: 'none',
                color: activeTab === 'cuadro' ? '#000000' : 'var(--text-muted)',
                cursor: 'pointer',
                borderRadius: '12px',
                transition: 'all 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)',
                boxShadow: activeTab === 'cuadro' ? '0 4px 15px rgba(0, 210, 211, 0.4)' : 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                letterSpacing: '0.5px',
                whiteSpace: 'nowrap',
              }}
            >
              🏆 Cuadro
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('grupos')}
              style={{
                padding: 'clamp(7px, 1.6vw, 8px) clamp(9px, 2.6vw, 22px)',
                fontWeight: 800,
                fontSize: 'clamp(0.76rem, 3vw, 0.95rem)',
                background:
                  activeTab === 'grupos'
                    ? 'linear-gradient(135deg, #00d2d3, #01a3a4)'
                    : 'transparent',
                border: 'none',
                color: activeTab === 'grupos' ? '#000000' : 'var(--text-muted)',
                cursor: 'pointer',
                borderRadius: '12px',
                transition: 'all 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)',
                boxShadow: activeTab === 'grupos' ? '0 4px 15px rgba(0, 210, 211, 0.4)' : 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                letterSpacing: '0.5px',
                whiteSpace: 'nowrap',
              }}
            >
              📋 Grupos
            </button>
          </div>
          {activeTab === 'cuadro' && activeGroupPichichi && (
            <button
              className="glass-btn"
              onClick={() => setActivePanel((p) => (p === 'scorers' ? null : 'scorers'))}
              style={{
                padding: 'clamp(4px, 1.1vw, 6px) clamp(5px, 1.5vw, 10px)',
                fontSize: 'clamp(0.6rem, 2.4vw, 0.8rem)',
                fontWeight: 'bold',
                minHeight: 'auto',
                alignSelf: 'stretch',
                background: activePanel === 'scorers' ? 'rgba(255, 211, 42, 0.18)' : 'transparent',
                borderColor: activePanel === 'scorers' ? '#ffd32a' : 'var(--border-color)',
                color: activePanel === 'scorers' ? '#ffd32a' : 'var(--text-muted)',
                borderRadius: '12px',
                transition: 'all 0.2s',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              <span className="results-toggle-icon">🏆</span> Pichichi
            </button>
          )}
        </div>

        {activeTab === 'grupos' ? (
          <OfficialGroupsView />
        ) : (
          <>
            {featuredMatch && (
              <div
                style={{
                  margin: '0 auto 12px auto',
                  padding: '8px 18px',
                  background: 'rgba(0, 210, 211, 0.12)',
                  border: '1px solid rgba(0, 210, 211, 0.5)',
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px',
                  flexWrap: 'wrap',
                  maxWidth: '580px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                  animation: 'featured-match-pulse 2s infinite',
                }}
              >
                <span
                  style={{
                    fontSize: '0.75rem',
                    background: '#00d2d3',
                    color: '#000',
                    fontWeight: '900',
                    padding: '2px 8px',
                    borderRadius: '12px',
                  }}
                >
                  🔜 PRÓXIMO PARTIDO EN EL BRACKET
                </span>
                <span style={{ color: '#fff', fontWeight: 'bold', fontSize: '0.9rem' }}>
                  {featuredMatch.home || 'Por definir'} vs {featuredMatch.away || 'Por definir'}
                </span>
                {featuredMatch.date && (
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                    🕒{' '}
                    {new Date(featuredMatch.date).toLocaleDateString('es-ES', {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                )}
              </div>
            )}

            {/* Controls overlay */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                marginBottom: '10px',
                position: 'relative',
                zIndex: 50,
              }}
            >
              {/* HUD Modal Centrado debajo de los botones - Cierra al hacer clic en cualquier parte fuera */}
              {activePanel && (
                <div
                  style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    zIndex: 9999,
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'center',
                    paddingTop: '115px',
                    paddingBottom: '30px',
                    paddingLeft: '15px',
                    paddingRight: '15px',
                    background: 'transparent',
                    overflowY: 'auto',
                  }}
                  onClick={() => setActivePanel(null)}
                >
                  <div
                    style={{
                      width: '380px',
                      maxWidth: '92vw',
                      maxHeight: 'calc(100vh - 140px)',
                      background: 'rgba(15, 23, 42, 0.92)',
                      backdropFilter: 'blur(20px)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      borderRadius: '16px',
                      boxShadow:
                        '0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 30px rgba(59, 130, 246, 0.15)',
                      display: 'flex',
                      flexDirection: 'column',
                      overflow: 'hidden',
                      animation: 'modalScaleUp 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                      marginTop: '10px',
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Cabecera del HUD */}
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'flex-end',
                        alignItems: 'center',
                        padding: '12px 16px 0 16px',
                        background: 'transparent',
                      }}
                    >
                      <button
                        onClick={() => setActivePanel(null)}
                        style={{
                          background: 'rgba(255, 255, 255, 0.08)',
                          border: 'none',
                          color: 'var(--text-muted)',
                          width: '28px',
                          height: '28px',
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '1rem',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                        }}
                        onMouseOver={(e) => {
                          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
                          e.currentTarget.style.color = '#fff';
                        }}
                        onMouseOut={(e) => {
                          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                          e.currentTarget.style.color = 'var(--text-muted)';
                        }}
                      >
                        ✕
                      </button>
                    </div>

                    {/* Contenido del HUD */}
                    <div style={{ padding: '8px 16px 16px 16px', overflowY: 'auto', flex: 1 }}>
                      {activePanel === 'live' && (
                        <LiveMatchesPanel
                          liveMatches={matchRadar?.live || []}
                          matchRadar={matchRadar}
                          maxNext={3}
                        />
                      )}
                      {activePanel === 'scorers' && (
                        <TopScorersPanel
                          topScorers={topScorers}
                          loading={topScorersLoading}
                          error={topScorersError}
                          onRetry={refreshTopScorers}
                        />
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <BracketCanvas
              leftRounds={leftRounds}
              rightRounds={rightRounds}
              renderSlot={renderSlot}
              renderCenter={centerContent}
              hiddenRounds={hiddenRounds}
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
                      {renderSlot(part.final?.[0], {
                        side: 'center',
                        roundIndex: 'final',
                        isHome: true,
                      })}
                      {renderSlot(part.final?.[1], {
                        side: 'center',
                        roundIndex: 'final',
                        isHome: false,
                      })}
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
                      <div
                        className="team-slot"
                        style={{
                          height: 50,
                          fontSize: '1.1rem',
                          fontWeight: 'bold',
                          justifyContent: 'center',
                          pointerEvents: 'none',
                          borderColor: getIsProv(part.champion) ? '#ff4757' : '#fbbf24',
                          background: 'rgba(251,191,36,0.15)',
                          color: '#fbbf24',
                          borderStyle: getIsProv(part.champion) ? 'dashed' : 'solid',
                          animation: getIsProv(part.champion)
                            ? 'provisional-pulse 1.5s infinite'
                            : 'none',
                        }}
                      >
                        <Flag
                          team={getName(part.champion) || ''}
                          size="w40"
                          style={{
                            width: 24,
                            height: 18,
                            borderRadius: 2,
                            marginRight: 8,
                            verticalAlign: 'middle',
                          }}
                        />
                        {getName(part.champion) || '???'}
                      </div>
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
                        side: 'center',
                        roundIndex: 'thirdPlaceMatch',
                        isHome: true,
                      })}
                      {renderSlot(part.thirdPlaceMatch?.[1], {
                        side: 'center',
                        roundIndex: 'thirdPlaceMatch',
                        isHome: false,
                      })}
                    </div>
                    <div style={{ textAlign: 'center', marginTop: 10 }}>
                      <div
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          color: '#cd7f32',
                          letterSpacing: 2,
                          textTransform: 'uppercase',
                          marginBottom: 6,
                        }}
                      >
                        🥉 3.º Puesto
                      </div>
                      <div className="champion-display">
                        <div
                          className="team-slot"
                          style={{
                            height: 42,
                            fontSize: '1rem',
                            fontWeight: 'bold',
                            justifyContent: 'center',
                            pointerEvents: 'none',
                            borderColor: getIsProv(part.thirdPlaceWinner) ? '#ff4757' : '#cd7f32',
                            background: 'rgba(205, 127, 50, 0.15)',
                            color: '#e0a96d',
                            borderStyle: getIsProv(part.thirdPlaceWinner) ? 'dashed' : 'solid',
                            animation: getIsProv(part.thirdPlaceWinner)
                              ? 'provisional-pulse 1.5s infinite'
                              : 'none',
                          }}
                        >
                          <Flag
                            team={getName(part.thirdPlaceWinner) || ''}
                            size="w40"
                            style={{
                              width: 20,
                              height: 15,
                              borderRadius: 2,
                              marginRight: 6,
                              verticalAlign: 'middle',
                            }}
                          />
                          {getName(part.thirdPlaceWinner) || '???'}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            />
          </>
        )}
      </section>
    </>
  );
}

export default OfficialBracket;
