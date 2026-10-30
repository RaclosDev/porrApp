import React, { useRef, useState, useEffect, type ReactNode } from 'react';
import { getCountryCode } from '../utils/constants';
import Flag from './Flag';
import MobileBracket from './MobileBracket';
import type { BracketTeam } from '../store/useAppStore';

// Vertical layout constants
export const SLOT_H = 36;
export const MATCH_H = SLOT_H * 2 + 2; // 74px
export const R32_PITCH = MATCH_H + 14; // 88px

const leafTop = (i: number) => i * R32_PITCH;

/**
 * Posición Y (top) de un partido, centrado respecto a sus dos partidos de la ronda anterior.
 * `r`: 0 = dieciseisavos, 1 = octavos, 2 = cuartos, 3 = semis; `i`: índice en la ronda.
 */
export function matchTop(r: number, i: number): number {
  if (r === 0) return leafTop(i);
  return (matchTop(r - 1, i * 2) + matchTop(r - 1, i * 2 + 1)) / 2;
}

export const CANVAS_H = leafTop(7) + MATCH_H;

// Horizontal layout constants
const GAP = 20; // px between adjacent columns (fixed)
const DEFAULT_COL = 155;

// Re-export for pages that need gap value for center content positioning
export const COL_GAP = GAP;

const ROUND_LABELS = ['16avos', 'Octavos', 'Cuartos', 'Semis'];

// SVG connector lines
interface ConnectorsProps {
  /** Top del partido de la ronda actual. */
  parentTop: number;
  /** Tops de sus dos partidos de la ronda previa. */
  childATop: number;
  childBTop: number;
  /** Hacia dónde crecen las ramas. */
  dir: 'left' | 'right';
  colW: number;
}

/** Líneas SVG que unen dos partidos de una ronda con el de la siguiente. */
function Connectors({ parentTop, childATop, childBTop, dir, colW }: ConnectorsProps) {
  const pMid = parentTop + MATCH_H / 2;
  const aMid = childATop + MATCH_H / 2;
  const bMid = childBTop + MATCH_H / 2;
  const stub = GAP / 2;
  const color = 'rgba(59,130,246,0.5)';
  const sw = 1.5;
  const svgH = Math.max(bMid, pMid) + 4;

  // dir='right': children to the LEFT  → SVG in the gap LEFT  of this column
  // dir='left':  children to the RIGHT → SVG in the gap RIGHT of this column
  const svgLeft = dir === 'right' ? -GAP : colW;
  const childX = dir === 'right' ? 0 : GAP;
  const parentX = dir === 'right' ? GAP : 0;
  const midX = dir === 'right' ? stub : GAP - stub;

  return (
    <svg
      style={{
        position: 'absolute',
        top: 0,
        left: svgLeft,
        width: GAP,
        height: svgH,
        overflow: 'visible',
        pointerEvents: 'none',
      }}
    >
      <line x1={childX} y1={aMid} x2={midX} y2={aMid} stroke={color} strokeWidth={sw} />
      <line x1={childX} y1={bMid} x2={midX} y2={bMid} stroke={color} strokeWidth={sw} />
      <line x1={midX} y1={aMid} x2={midX} y2={bMid} stroke={color} strokeWidth={sw} />
      <line x1={midX} y1={pMid} x2={parentX} y2={pMid} stroke={color} strokeWidth={sw} />
    </svg>
  );
}

// Default team slot
/**
 * Casilla individual que muestra un equipo en el Bracket.
 *
 * @component
 * @param {Object} props
 * @param {string} props.name - Nombre del equipo (ej. "España", "1º Grupo A").
 * @param {Function} [props.onClick] - Acción al hacer click en la casilla.
 * @param {Object} [props.slotStyle] - Estilos adicionales de renderizado (para aciertos/fallos).
 * @param {ReactNode} [props.rightContent] - Elemento a renderizar en la derecha (puntos).
 * @returns {JSX.Element} La casilla del bracket.
 */
interface TeamSlotProps {
  name: string | null | undefined;
  onClick?: () => void;
  slotStyle?: React.CSSProperties;
  rightContent?: React.ReactNode;
}

export function TeamSlot({ name, onClick, slotStyle = {}, rightContent = null }: TeamSlotProps) {
  const isEmpty = !name;
  const lower = name?.toLowerCase() || '';
  const isCombined = !isEmpty && name.includes(' / ');
  const combinedTeams = isCombined ? name.split(' / ').map((t) => t.trim()) : [];
  const isPlaceholder =
    !isCombined &&
    (name?.includes('º') ||
      lower.includes('por definir') ||
      lower.includes('por decidir') ||
      lower.includes('tbd') ||
      lower.includes('ganador') ||
      lower.includes('perdedor') ||
      name === '?' ||
      getCountryCode(name) === 'xx');
  const clickable = !!onClick && !isEmpty && !isPlaceholder;

  return (
    <div
      className={`team-slot${isEmpty || isPlaceholder ? ' empty' : ''}`}
      onClick={clickable ? onClick : undefined}
      style={{
        cursor: clickable ? 'pointer' : 'default',
        height: SLOT_H,
        padding: '0 8px',
        fontSize: '0.78rem',
        display: 'flex',
        alignItems: 'center',
        ...slotStyle,
      }}
    >
      {!isEmpty && !isPlaceholder && !isCombined && (
        <Flag
          team={name}
          size="w40"
          style={{
            width: 18,
            height: 13,
            borderRadius: 2,
            marginRight: 6,
          }}
        />
      )}
      {!isEmpty && isCombined && (
        <div style={{ display: 'flex', marginRight: 6, flexShrink: 0, alignItems: 'center' }}>
          {combinedTeams.map((t, idx) => (
            <Flag
              key={t}
              team={t}
              size="w40"
              style={{
                width: 16,
                height: 12,
                borderRadius: 2,
                marginLeft: idx > 0 ? -6 : 0,
                border: '1px solid rgba(0,0,0,0.5)',
                zIndex: combinedTeams.length - idx,
              }}
            />
          ))}
        </div>
      )}
      <span
        style={{
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          flex: 1,
          fontSize: isCombined ? '0.65rem' : '0.78rem',
        }}
      >
        {name ?? 'Por definir'}
      </span>
      {rightContent}
    </div>
  );
}

// Active tab calculation
/**
 * Determina la pestaña activa por defecto para el bracket móvil.
 * Busca la primera ronda donde NO todos los partidos están completos
 * (tienen equipos reales, no placeholders).
 * Si todas las rondas están completas, devuelve la última pestaña (Final).
 *
 * @param {Array[]} leftRounds  - Rondas del lado izquierdo.
 * @param {Array[]} rightRounds - Rondas del lado derecho.
 * @returns {number} Índice de la pestaña activa (0-4).
 */
function computeActiveTab(leftRounds: CanvasMatch[][], rightRounds: CanvasMatch[][]) {
  const hasR32 = (leftRounds?.[0]?.length || 0) + (rightRounds?.[0]?.length || 0) > 0;
  const isRealTeam = (team: SlotTeam | undefined) => {
    if (!team) return false;
    const name = typeof team === 'object' ? team.name : team;
    if (!name) return false;
    if (name.includes('º')) return false;
    if (name === 'Por definir') return false;
    return true;
  };

  const isMatchComplete = (match: CanvasMatch | undefined) => {
    if (!match) return false;
    return isRealTeam(match.home) && isRealTeam(match.away);
  };

  const isRoundComplete = (roundIndex: number) => {
    const leftMatches = leftRounds[roundIndex] || [];
    const rightMatches = rightRounds[roundIndex] || [];
    const allMatches = [...leftMatches, ...rightMatches];
    if (allMatches.length === 0) return false;
    return allMatches.every(isMatchComplete);
  };

  const startRound = hasR32 ? 0 : 1;
  for (let i = startRound; i < 4; i++) {
    if (!isRoundComplete(i)) {
      return Math.max(startRound, i - 1);
    }
  }
  return -1;
}

// BracketCanvas core
/**
 * Componente core del diseño "Copa del Mundo".
 * Dibuja un bracket (cuadro de eliminatorias) con 2 mitades simétricas (Izquierda y Derecha)
 * que colapsan hacia una columna central (La Final y Tercer Puesto).
 *
 * @component
 */
export type SlotTeam = BracketTeam | string | null | undefined;

/** Partido del cuadro; cada página decide qué guarda en los huecos (`T`). */
export interface CanvasMatch<T extends SlotTeam = SlotTeam> {
  home?: T;
  away?: T;
}

export type RenderSlot<T extends SlotTeam = SlotTeam> = (
  team: T | undefined,
  context: SlotContext,
) => ReactNode;

/** Huecos de la final y del tercer puesto, que la página pinta fuera del lienzo. */
export interface CenterSlotContext {
  side: 'center';
  roundIndex: 'final' | 'thirdPlaceMatch';
  isHome: boolean;
  matchIndex?: number;
}

export type OfficialSlotContext = SlotContext | CenterSlotContext;

export interface SlotContext {
  side: 'left' | 'right';
  roundIndex: number;
  matchIndex: number;
  isHome: boolean;
}

interface BracketCanvasProps<T extends SlotTeam> {
  /** 4 rondas de partidos del lado izquierdo. */
  leftRounds: CanvasMatch<T>[][];
  /** 4 rondas de partidos del lado derecho. */
  rightRounds: CanvasMatch<T>[][];
  /** Pinta un hueco del cuadro (inyecta la lógica de clics o coloreado). */
  renderSlot: RenderSlot<T>;
  /** Dibuja el centro (final y tercer puesto) con el ancho de columna calculado. */
  renderCenter: (colW: number) => ReactNode;
  /** Columnas ocultas en móvil o al filtrar, indexadas por ronda. */
  hiddenRounds?: Record<number, boolean>;
  /** Pie opcional de cada columna (p. ej. puntos por ronda). */
  renderRoundFooter?: (roundIndex: number, side: 'left' | 'right') => ReactNode;
  /** Centro alternativo para la vista móvil. */
  mobileCenter?: () => ReactNode;
}

export default function BracketCanvas<T extends SlotTeam>({
  leftRounds,
  rightRounds,
  renderSlot,
  renderCenter,
  hiddenRounds = {},
  renderRoundFooter,
  mobileCenter,
}: BracketCanvasProps<T>) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [colW, setColW] = useState(DEFAULT_COL);
  const [scale, setScale] = useState(1);
  const [isOverflowX, setIsOverflowX] = useState(false);

  // Visible round indices per side
  const leftVis = [0, 1, 2, 3].filter((i) => !hiddenRounds[i]);
  const rightVis = [3, 2, 1, 0].filter((i) => !hiddenRounds[i]);
  const totalCols = leftVis.length + rightVis.length + 1; // +1 center

  // Responsive column width calculation based on screen size
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const compute = () => {
      const w = el.clientWidth || window.innerWidth;
      const leftGaps = Math.max(0, leftVis.length - 1);
      const rightGaps = Math.max(0, rightVis.length - 1);
      const totalGaps = leftGaps + 4 + rightGaps;

      const availableW = w - 20;
      const totalGapsW = totalGaps * GAP + 32;

      // En PC de escritorio permitimos que las columnas se estiren hasta 195px para que no quede estrecho
      let targetColW = 150;
      if (availableW > totalCols * 150 + totalGapsW) {
        targetColW = Math.min(195, Math.floor((availableW - totalGapsW) / totalCols));
      }

      const requiredW = totalCols * targetColW + totalGapsW;

      let scaleX = 1;
      if (requiredW > availableW && availableW > 400) {
        scaleX = availableW / requiredW;
      }

      const wrapperH = CANVAS_H + 40;
      const availableH = window.innerHeight - 150;
      let scaleY = 1;
      if (wrapperH > availableH && availableH > 300) {
        scaleY = availableH / wrapperH;
      }

      let actualScale = Math.min(1, scaleX, scaleY);
      actualScale = Math.max(0.45, actualScale);

      setScale(actualScale);
      setColW(targetColW);

      const vw = requiredW * actualScale;
      setIsOverflowX(vw > (el.clientWidth || window.innerWidth) + 15);
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    window.addEventListener('resize', compute);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', compute);
    };
  }, [leftVis.length, rightVis.length, totalCols]);

  const leftGaps = Math.max(0, leftVis.length - 1);
  const rightGaps = Math.max(0, rightVis.length - 1);
  const totalGaps = leftGaps + 4 + rightGaps;

  // Calculate exact visual dimensions after scaling to prevent bounding box collapse
  const visualWidth = (totalCols * colW + totalGaps * GAP + 32) * scale;
  const visualHeight = (CANVAS_H + 50) * scale;

  const sfMidY = matchTop(3, 0) + MATCH_H / 2;
  const centerW = colW + GAP * 2;

  /** Render one round column as a flex item. Returns null if hidden. */
  const renderRoundCol = (
    rounds: CanvasMatch<T>[][],
    roundIndex: number,
    side: 'left' | 'right',
    connDir: 'left' | 'right' | null,
  ) => {
    if (hiddenRounds[roundIndex]) return null;
    const matches = rounds[roundIndex];
    if (!matches) return null;

    return (
      <div
        key={`${side}-${roundIndex}`}
        style={{ position: 'relative', width: colW, height: CANVAS_H, flexShrink: 0 }}
      >
        {/* Label */}
        <div
          style={{
            position: 'absolute',
            top: -34,
            left: 0,
            width: '100%',
            textAlign: 'center',
            fontSize: '0.6rem',
            fontWeight: 700,
            color: 'var(--text-muted)',
            letterSpacing: 1.5,
            textTransform: 'uppercase',
          }}
        >
          {ROUND_LABELS[roundIndex]}
        </div>

        {/* Column Total (was Footer) */}
        {renderRoundFooter && (
          <div
            style={{
              position: 'absolute',
              top: -20,
              left: 0,
              width: '100%',
              textAlign: 'center',
              pointerEvents: 'none',
            }}
          >
            {renderRoundFooter(roundIndex, side)}
          </div>
        )}

        {/* Match cards (absolutely positioned vertically) */}
        {matches.map((match, i) => (
          <div
            key={i}
            className="match"
            style={{ position: 'absolute', top: matchTop(roundIndex, i), left: 0, width: '100%' }}
          >
            {renderSlot(match.home, { side, roundIndex, matchIndex: i, isHome: true })}
            {renderSlot(match.away, { side, roundIndex, matchIndex: i, isHome: false })}
          </div>
        ))}

        {/* Connectors to previous round (only if that round is visible) */}
        {connDir &&
          roundIndex > 0 &&
          !hiddenRounds[roundIndex - 1] &&
          matches.map((_, i) => (
            <Connectors
              key={`c-${i}`}
              parentTop={matchTop(roundIndex, i)}
              childATop={matchTop(roundIndex - 1, i * 2)}
              childBTop={matchTop(roundIndex - 1, i * 2 + 1)}
              dir={connDir}
              colW={colW}
            />
          ))}
      </div>
    );
  };

  return (
    <>
      {/* Mobile bracket */}
      <MobileBracket
        leftRounds={leftRounds}
        rightRounds={rightRounds}
        renderSlot={renderSlot}
        mobileCenter={mobileCenter}
        defaultTab={computeActiveTab(leftRounds, rightRounds)}
      />

      {/* Desktop horizontal bracket */}
      <div
        ref={wrapperRef}
        className="desktop-bracket-wrapper"
        style={{
          width: '100%',
          paddingBottom: 10,
          display: 'flex',
          justifyContent: isOverflowX ? 'flex-start' : 'center',
        }}
      >
        <div
          style={{
            width: visualWidth,
            height: visualHeight,
            flexShrink: 0,
            position: 'relative',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              display: 'inline-flex',
              alignItems: 'flex-start',
              padding: '40px 16px 10px',
              gap: 0,
              transform: `scale(${scale})`,
              transformOrigin: '0 0',
            }}
          >
            {/* Left side */}
            <div style={{ display: 'flex', gap: GAP, height: CANVAS_H, flexShrink: 0 }}>
              {[0, 1, 2, 3].map((rIdx) =>
                renderRoundCol(leftRounds, rIdx, 'left', rIdx > 0 ? 'right' : null),
              )}
            </div>

            {/* SF → Final dashed connector (left) */}
            {!hiddenRounds[3] && (
              <svg
                style={{
                  width: GAP,
                  height: CANVAS_H,
                  flexShrink: 0,
                  overflow: 'visible',
                  pointerEvents: 'none',
                }}
              >
                <line
                  x1={0}
                  y1={sfMidY}
                  x2={GAP}
                  y2={sfMidY}
                  stroke="rgba(251,191,36,0.6)"
                  strokeWidth={1.5}
                  strokeDasharray="5 3"
                />
              </svg>
            )}

            {/* Center */}
            <div style={{ position: 'relative', width: centerW, height: CANVAS_H, flexShrink: 0 }}>
              {renderCenter(colW)}
            </div>

            {/* Final → SF dashed connector (right) */}
            {!hiddenRounds[3] && (
              <svg
                style={{
                  width: GAP,
                  height: CANVAS_H,
                  flexShrink: 0,
                  overflow: 'visible',
                  pointerEvents: 'none',
                }}
              >
                <line
                  x1={0}
                  y1={sfMidY}
                  x2={GAP}
                  y2={sfMidY}
                  stroke="rgba(251,191,36,0.6)"
                  strokeWidth={1.5}
                  strokeDasharray="5 3"
                />
              </svg>
            )}

            {/* Right side */}
            <div style={{ display: 'flex', gap: GAP, height: CANVAS_H, flexShrink: 0 }}>
              {[3, 2, 1, 0].map((rIdx) =>
                renderRoundCol(rightRounds, rIdx, 'right', rIdx > 0 ? 'left' : null),
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
