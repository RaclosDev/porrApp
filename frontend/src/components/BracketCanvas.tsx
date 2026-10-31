import React, { type ReactNode } from 'react';
import { getCountryCode } from '../utils/constants';
import Flag from './Flag';
import MobileBracket from './MobileBracket';
import BracketFinale from './BracketFinale';
import type { BracketTeam } from '../store/useAppStore';

const SLOT_H = 36;
export const MATCH_H = SLOT_H * 2 + 2; // 74px
const R32_PITCH = MATCH_H + 14; // 88px

const leafTop = (i: number) => i * R32_PITCH;

/**
 * Posición Y (top) de un partido, centrado respecto a sus dos partidos de la ronda anterior.
 * `r`: 0 = dieciseisavos, 1 = octavos, 2 = cuartos, 3 = semis; `i`: índice en la ronda.
 */
function matchTop(r: number, i: number): number {
  if (r === 0) return leafTop(i);
  return (matchTop(r - 1, i * 2) + matchTop(r - 1, i * 2 + 1)) / 2;
}

const GAP = 20; // px between adjacent columns (fixed)
const ROUND_LABELS = ['16avos', 'Octavos', 'Cuartos', 'Semis'];

interface ConnectorsProps {
  /** Top del partido de la ronda actual. */
  parentTop: number;
  /** Tops de sus dos partidos de la ronda previa. */
  childATop: number;
  childBTop: number;
  /** Hacia dónde crecen las ramas. */
  dir: 'left' | 'right';
}

/** Líneas SVG que unen dos partidos de una ronda con el de la siguiente. */
function Connectors({ parentTop, childATop, childBTop, dir }: ConnectorsProps) {
  const pMid = parentTop + MATCH_H / 2;
  const aMid = childATop + MATCH_H / 2;
  const bMid = childBTop + MATCH_H / 2;
  const stub = GAP / 2;
  const color = 'currentColor';
  const sw = 2;
  const svgH = Math.max(bMid, pMid) + 4;

  // dir='right': children to the LEFT  → SVG in the gap LEFT  of this column
  // dir='left':  children to the RIGHT → SVG in the gap RIGHT of this column
  const svgLeft = dir === 'right' ? -GAP : '100%';
  const childX = dir === 'right' ? 0 : GAP;
  const parentX = dir === 'right' ? GAP : 0;
  const midX = dir === 'right' ? stub : GAP - stub;

  return (
    <svg
      className="bracket-connector absolute top-0 overflow-visible pointer-events-none"
      style={{ left: svgLeft, width: GAP, height: svgH }}
    >
      <line x1={childX} y1={aMid} x2={midX} y2={aMid} stroke={color} strokeWidth={sw} />
      <line x1={childX} y1={bMid} x2={midX} y2={bMid} stroke={color} strokeWidth={sw} />
      <line x1={midX} y1={aMid} x2={midX} y2={bMid} stroke={color} strokeWidth={sw} />
      <line x1={midX} y1={pMid} x2={parentX} y2={pMid} stroke={color} strokeWidth={sw} />
    </svg>
  );
}

interface TeamSlotProps {
  name: string | null | undefined;
  onClick?: () => void;
  slotStyle?: React.CSSProperties;
  rightContent?: React.ReactNode;
  pressed?: boolean;
}

/** Casilla de un equipo en el cuadro; solo es pulsable si el equipo es real. */
export function TeamSlot({
  name,
  onClick,
  slotStyle = {},
  rightContent = null,
  pressed = false,
}: TeamSlotProps) {
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

  const style: React.CSSProperties = {
    cursor: clickable ? 'pointer' : 'default',
    height: SLOT_H,
    padding: '0 8px',
    fontSize: '0.78rem',
    display: 'flex',
    alignItems: 'center',
    ...slotStyle,
  };

  const content = (
    <>
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
        <div className="flex mr-1.5 shrink-0 items-center">
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
        className={`overflow-hidden text-ellipsis whitespace-nowrap flex-1 ${isCombined ? 'text-[0.65rem]' : 'text-[0.78rem]'}`}
      >
        {name ?? 'Por definir'}
      </span>
      {rightContent}
    </>
  );

  if (clickable) {
    return (
      <button
        type="button"
        className="team-slot team-slot-btn"
        onClick={onClick}
        aria-label={`Pasar a ${name}`}
        aria-pressed={pressed}
        style={style}
      >
        {content}
      </button>
    );
  }

  return (
    <div className={`team-slot${isEmpty || isPlaceholder ? ' empty' : ''}`} style={style}>
      {content}
    </div>
  );
}

/** Pestaña inicial del cuadro móvil: la última ronda con todos los cruces definidos; -1 si lo están todas. */
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
  /** Columnas ocultas en móvil o al filtrar, indexadas por ronda. */
  hiddenRounds?: Record<number, boolean>;
  /** Pie opcional de cada columna (p. ej. puntos por ronda). */
  renderRoundFooter?: (roundIndex: number, side: 'left' | 'right') => ReactNode;
  /** Final destacada compartida entre móvil y escritorio. */
  renderFinal?: (expandedThirdPlace?: boolean) => ReactNode;
}

/** Tres hojas: dos ramas de cruces y el desenlace en la hoja central. */
export default function BracketCanvas<T extends SlotTeam>({
  leftRounds,
  rightRounds,
  renderSlot,
  hiddenRounds = {},
  renderRoundFooter,
  renderFinal,
}: BracketCanvasProps<T>) {
  const renderSide = (rounds: CanvasMatch<T>[][], side: 'left' | 'right') => {
    const visible = [0, 1, 2].filter((round) => !hiddenRounds[round] && rounds[round]?.length);
    const firstRound = visible[0] ?? 0;
    const height = leafTop(Math.max(0, (rounds[firstRound]?.length ?? 1) - 1)) + MATCH_H;
    const order = side === 'left' ? visible : [...visible].reverse();

    return (
      <section
        className={`bracket-sheet bracket-sheet-${side} paper-panel landing-tape album-sheet`}
        aria-label={`Cruces del lado ${side === 'left' ? 'izquierdo' : 'derecho'}`}
      >
        {visible.length === 0 ? (
          <p className="text-center text-muted">Cruces por definir</p>
        ) : (
          <div className="bracket-tree-columns" style={{ height }}>
            {order.map((roundIndex) => (
              <div className="bracket-tree-column" key={roundIndex}>
                <h3 className="bracket-round-title">{ROUND_LABELS[roundIndex]}</h3>
                {renderRoundFooter && (
                  <div className="bracket-round-points">{renderRoundFooter(roundIndex, side)}</div>
                )}
                {rounds[roundIndex].map((match, matchIndex) => (
                  <div
                    className="match bracket-tree-match"
                    key={matchIndex}
                    style={{ top: matchTop(roundIndex - firstRound, matchIndex) }}
                  >
                    {renderSlot(match.home, { side, roundIndex, matchIndex, isHome: true })}
                    {renderSlot(match.away, { side, roundIndex, matchIndex, isHome: false })}
                  </div>
                ))}
                {visible.includes(roundIndex - 1) &&
                  rounds[roundIndex].map((_, matchIndex) => (
                    <Connectors
                      key={`connector-${matchIndex}`}
                      parentTop={matchTop(roundIndex - firstRound, matchIndex)}
                      childATop={matchTop(roundIndex - firstRound - 1, matchIndex * 2)}
                      childBTop={matchTop(roundIndex - firstRound - 1, matchIndex * 2 + 1)}
                      dir={side === 'left' ? 'right' : 'left'}
                    />
                  ))}
              </div>
            ))}
          </div>
        )}
      </section>
    );
  };

  return (
    <>
      <div className="bracket-mobile-sheet paper-panel landing-tape album-sheet">
        <MobileBracket
          leftRounds={leftRounds}
          rightRounds={rightRounds}
          renderSlot={renderSlot}
          renderFinal={renderFinal}
          defaultTab={computeActiveTab(leftRounds, rightRounds)}
          renderRoundFooter={renderRoundFooter}
        />
      </div>
      <div className="bracket-desktop-scroll">
        <div className="bracket-paper-board">
          {renderSide(leftRounds, 'left')}
          <section
            className="bracket-sheet bracket-sheet-center paper-panel landing-tape album-sheet"
            aria-label="Semifinales, final y tercer puesto"
          >
            <BracketFinale
              leftRounds={leftRounds}
              rightRounds={rightRounds}
              renderSlot={renderSlot}
              center={renderFinal ? () => renderFinal(true) : undefined}
              renderRoundFooter={renderRoundFooter}
            />
          </section>
          {renderSide(rightRounds, 'right')}
        </div>
      </div>
    </>
  );
}
