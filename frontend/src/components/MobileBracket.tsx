import { useState, useRef, useEffect } from 'react';
import { MATCH_H } from './BracketCanvas';

/**
 * Pestañas del bracket móvil, una por cada ronda eliminatoria.
 */
const ALL_TABS = [
  { key: 'r32', label: '16avos', roundIndex: 0 },
  { key: 'r16', label: 'Octavos', roundIndex: 1 },
  { key: 'qf', label: 'Cuartos', roundIndex: 2 },
  { key: 'sf', label: 'Semis', roundIndex: 3 },
  { key: 'final', label: 'Final', roundIndex: -1 },
];

/**
 * Visualización optimizada del cuadro eliminatorio para dispositivos móviles.
 * Muestra las eliminatorias en formato lineal vertical con pestañas por ronda.
 * Cada ronda muestra sus partidos agrupados en pares que alimentan la siguiente ronda,
 * con líneas SVG conectoras estilo árbol.
 *
 * @component
 * @param {Object} props
 * @param {Array[]} props.leftRounds  - Rondas del lado izquierdo del bracket.
 * @param {Array[]} props.rightRounds - Rondas del lado derecho del bracket.
 * @param {Function} props.renderSlot - Función inyectada para pintar un slot de equipo.
 * @param {Function} [props.mobileCenter] - Render prop para la pestaña "Final" (flow layout).
 * @param {number} [props.defaultTab=0] - Pestaña activa por defecto.
 * @returns {JSX.Element} El bracket móvil con pestañas.
 */
const getTabs = (hasR32) => (hasR32 ? ALL_TABS : ALL_TABS.filter((t) => t.key !== 'r32'));

const resolveTabIndex = (tabs, target) => {
  if (typeof target === 'number') {
    const byRound = tabs.findIndex((t) => t.roundIndex === target);
    if (byRound !== -1) return byRound;
    if (target >= 0 && target < tabs.length) return target;
  }
  return 0;
};

export default function MobileBracket({
  leftRounds,
  rightRounds,
  renderSlot,
  mobileCenter,
  defaultTab = 0,
}) {
  const hasR32 = (leftRounds?.[0]?.length || 0) + (rightRounds?.[0]?.length || 0) > 0;
  const tabs = getTabs(hasR32);

  const [activeTab, setActiveTab] = useState(() => resolveTabIndex(tabs, defaultTab));
  const [slideDir, setSlideDir] = useState('right');
  const [animKey, setAnimKey] = useState(0);
  const hasUserNavigated = useRef(false);

  useEffect(() => {
    if (!hasUserNavigated.current) {
      setActiveTab(resolveTabIndex(getTabs(hasR32), defaultTab));
    }
  }, [defaultTab, hasR32]);

  /** Cambia de pestaña con animación de deslizamiento */
  const goToTab = (newTab) => {
    if (newTab === activeTab) return;
    hasUserNavigated.current = true;
    setSlideDir(newTab > activeTab ? 'right' : 'left');
    setActiveTab(newTab);
    setAnimKey((k) => k + 1);
  };

  /**
   * Agrupa los partidos de una ronda en pares.
   * Cada par son 2 partidos de la ronda actual que alimentan 1 partido de la siguiente.
   *
   * @param {number} roundIndex - Índice de la ronda (0-2).
   * @returns {Array} Lista de grupos { matchA, matchB, nextMatch }.
   */
  const buildGroups = (roundIndex) => {
    const groups = [];

    for (const side of ['left', 'right']) {
      const rounds = side === 'left' ? leftRounds : rightRounds;
      const matches = rounds[roundIndex] || [];
      const nextRoundMatches = roundIndex < 3 ? rounds[roundIndex + 1] || [] : [];

      for (let i = 0; i < matches.length; i += 2) {
        if (i + 1 >= matches.length) break;

        const nextMatch = nextRoundMatches[Math.floor(i / 2)] || null;

        groups.push({
          matchA: { data: matches[i], side, index: i },
          matchB: { data: matches[i + 1], side, index: i + 1 },
          nextMatch: nextMatch
            ? {
                data: nextMatch,
                side,
                index: Math.floor(i / 2),
                roundIndex: roundIndex + 1,
              }
            : null,
        });
      }
    }

    return groups;
  };

  /**
   * Renderiza el contenido de la pestaña activa.
   */
  const renderTabContent = () => {
    const tab = tabs[activeTab] || tabs[0];

    // Final
    if (tab.key === 'final') {
      return mobileCenter ? (
        <div className="mb-final-content">{mobileCenter()}</div>
      ) : (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>
          Final aún por definir
        </div>
      );
    }

    const roundIndex = tab.roundIndex;

    // Semifinales
    if (roundIndex === 3) {
      const leftSF = leftRounds[3]?.[0];
      const rightSF = rightRounds[3]?.[0];

      return (
        <div className="mb-round">
          {leftSF && (
            <div
              className="mb-sf-card"
              role="button"
              tabIndex={0}
              aria-label="Ir a la Final"
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  goToTab(tabs.findIndex((t) => t.key === 'final'));
                }
              }}
              onClick={() => goToTab(tabs.findIndex((t) => t.key === 'final'))}
              style={{ cursor: 'pointer' }}
            >
              <div className="mb-sf-label">Semifinal 1</div>
              <div className="mb-match-card">
                {renderSlot(leftSF.home, {
                  side: 'left',
                  roundIndex: 3,
                  matchIndex: 0,
                  isHome: true,
                })}
                {renderSlot(leftSF.away, {
                  side: 'left',
                  roundIndex: 3,
                  matchIndex: 0,
                  isHome: false,
                })}
              </div>
            </div>
          )}
          {rightSF && (
            <div
              className="mb-sf-card"
              role="button"
              tabIndex={0}
              aria-label="Ir a la Final"
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  goToTab(4);
                }
              }}
              onClick={() => goToTab(4)}
              style={{ cursor: 'pointer' }}
            >
              <div className="mb-sf-label">Semifinal 2</div>
              <div className="mb-match-card">
                {renderSlot(rightSF.home, {
                  side: 'right',
                  roundIndex: 3,
                  matchIndex: 0,
                  isHome: true,
                })}
                {renderSlot(rightSF.away, {
                  side: 'right',
                  roundIndex: 3,
                  matchIndex: 0,
                  isHome: false,
                })}
              </div>
            </div>
          )}
        </div>
      );
    }

    // Rondas previas
    const groups = buildGroups(roundIndex);

    return (
      <div className="mb-round">
        {groups.map((group, gIdx) => (
          <BracketGroup
            key={`${group.matchA.side}-${group.matchA.index}-${gIdx}`}
            group={group}
            roundIndex={roundIndex}
            renderSlot={renderSlot}
            onNavigateNext={() => goToTab(activeTab + 1)}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="mobile-bracket">
      {/* Pestañas */}
      <div className="mb-tabs">
        {tabs.map((t, i) => (
          <button
            key={t.key}
            className={`mb-tab ${activeTab === i ? 'mb-tab-active' : ''}`}
            onClick={() => goToTab(i)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Contenido */}
      <div key={animKey} className={`mb-content mb-slide-${slideDir}`}>
        {renderTabContent()}
      </div>
    </div>
  );
}

// Subcomponente: par de partidos con conector SVG y partido siguiente

/**
 * Grupo visual de 2 partidos de la ronda actual que alimentan 1 partido de la siguiente.
 * Dibuja líneas SVG estilo bracket entre los partidos actuales y el siguiente.
 *
 * @param {Object} props.group      - Datos del grupo { matchA, matchB, nextMatch }.
 * @param {number} props.roundIndex - Índice de la ronda actual.
 * @param {Function} props.renderSlot - Función para pintar un slot de equipo.
 */
function BracketGroup({ group, roundIndex, renderSlot, onNavigateNext }) {
  const { matchA, matchB, nextMatch } = group;

  // Posiciones SVG
  const CARD_GAP = 10;
  const totalH = MATCH_H * 2 + CARD_GAP;
  const midA = MATCH_H / 2;
  const midB = MATCH_H + CARD_GAP + MATCH_H / 2;
  const center = (midA + midB) / 2;

  return (
    <div className="mb-group">
      {/* Columna izquierda: partidos de la ronda actual */}
      <div
        className="mb-current"
        style={{ display: 'flex', flexDirection: 'column', gap: CARD_GAP }}
      >
        <div className="mb-match-card">
          {renderSlot(matchA.data.home, {
            side: matchA.side,
            roundIndex,
            matchIndex: matchA.index,
            isHome: true,
          })}
          {renderSlot(matchA.data.away, {
            side: matchA.side,
            roundIndex,
            matchIndex: matchA.index,
            isHome: false,
          })}
        </div>
        <div className="mb-match-card">
          {renderSlot(matchB.data.home, {
            side: matchB.side,
            roundIndex,
            matchIndex: matchB.index,
            isHome: true,
          })}
          {renderSlot(matchB.data.away, {
            side: matchB.side,
            roundIndex,
            matchIndex: matchB.index,
            isHome: false,
          })}
        </div>
      </div>

      {/* Conector SVG (estilo bracket/árbol) */}
      <svg className="mb-connector" width="18" height={totalH} viewBox={`0 0 18 ${totalH}`}>
        {/* Línea horizontal desde Match A */}
        <line x1="0" y1={midA} x2="9" y2={midA} stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />
        {/* Línea horizontal desde Match B */}
        <line x1="0" y1={midB} x2="9" y2={midB} stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />
        {/* Línea vertical conectando A y B */}
        <line x1="9" y1={midA} x2="9" y2={midB} stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />
        {/* Línea horizontal desde el punto medio al partido siguiente */}
        <line
          x1="9"
          y1={center}
          x2="18"
          y2={center}
          stroke="rgba(255,255,255,0.15)"
          strokeWidth="1.5"
        />
      </svg>

      {/* Columna derecha: partido de la siguiente ronda */}
      <div
        className="mb-next"
        role="button"
        tabIndex={0}
        aria-label="Navegar a la siguiente ronda"
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onNavigateNext();
          }
        }}
        onClick={onNavigateNext}
        style={{ cursor: 'pointer' }}
      >
        {nextMatch ? (
          <div className="mb-match-card mb-match-next">
            {renderSlot(nextMatch.data.home, {
              side: nextMatch.side,
              roundIndex: nextMatch.roundIndex,
              matchIndex: nextMatch.index,
              isHome: true,
            })}
            {renderSlot(nextMatch.data.away, {
              side: nextMatch.side,
              roundIndex: nextMatch.roundIndex,
              matchIndex: nextMatch.index,
              isHome: false,
            })}
          </div>
        ) : (
          <div className="mb-match-card mb-match-next mb-match-placeholder">
            <div className="mb-placeholder-inner">Por definir</div>
          </div>
        )}
      </div>
    </div>
  );
}
