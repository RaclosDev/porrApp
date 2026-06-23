import { useRef, useState, useEffect } from 'react';
import { getCountryCode } from '../utils/constants';

// ── Vertical constants (fixed) ─────────────────────────────────────────────
export const SLOT_H    = 36;
export const MATCH_H   = SLOT_H * 2 + 2;  // 74px
export const R32_PITCH = MATCH_H + 14;     // 88px

const leafTop = (i) => i * R32_PITCH;

export function matchTop(r, i) {
  if (r === 0) return leafTop(i);
  return (matchTop(r - 1, i * 2) + matchTop(r - 1, i * 2 + 1)) / 2;
}

export const CANVAS_H = leafTop(7) + MATCH_H;

// ── Horizontal constants ───────────────────────────────────────────────────
const GAP         = 20;   // px between adjacent columns (fixed)
const MIN_COL_W   = 110;
const MAX_COL_W   = 180;
const DEFAULT_COL = 155;

// Re-export for pages that need gap value for center content positioning
export const COL_GAP = GAP;

const ROUND_LABELS = ['16avos', 'Octavos', 'Cuartos', ''];

// ── SVG connector lines ────────────────────────────────────────────────────
function Connectors({ parentTop, childATop, childBTop, dir, colW }) {
  const pMid  = parentTop  + MATCH_H / 2;
  const aMid  = childATop  + MATCH_H / 2;
  const bMid  = childBTop  + MATCH_H / 2;
  const stub  = GAP / 2;
  const color = 'rgba(59,130,246,0.5)';
  const sw    = 1.5;
  const svgH  = Math.max(bMid, pMid) + 4;

  // dir='right': children to the LEFT  → SVG in the gap LEFT  of this column
  // dir='left':  children to the RIGHT → SVG in the gap RIGHT of this column
  const svgLeft = dir === 'right' ? -GAP : colW;
  const childX  = dir === 'right' ? 0    : GAP;
  const parentX = dir === 'right' ? GAP  : 0;
  const midX    = dir === 'right' ? stub : GAP - stub;

  return (
    <svg style={{ position: 'absolute', top: 0, left: svgLeft, width: GAP, height: svgH, overflow: 'visible', pointerEvents: 'none' }}>
      <line x1={childX}  y1={aMid} x2={midX}    y2={aMid} stroke={color} strokeWidth={sw} />
      <line x1={childX}  y1={bMid} x2={midX}    y2={bMid} stroke={color} strokeWidth={sw} />
      <line x1={midX}    y1={aMid} x2={midX}    y2={bMid} stroke={color} strokeWidth={sw} />
      <line x1={midX}    y1={pMid} x2={parentX} y2={pMid} stroke={color} strokeWidth={sw} />
    </svg>
  );
}

// ── Default team slot ──────────────────────────────────────────────────────
export function TeamSlot({ name, onClick, slotStyle = {}, rightContent = null }) {
  const isEmpty       = !name;
  const isPlaceholder = name?.includes('º');
  const clickable     = !!onClick && !isEmpty && !isPlaceholder;
  return (
    <div
      className={`team-slot${isEmpty || isPlaceholder ? ' empty' : ''}`}
      onClick={clickable ? onClick : undefined}
      style={{ cursor: clickable ? 'pointer' : 'default', height: SLOT_H, padding: '0 8px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', ...slotStyle }}
    >
      {!isEmpty && !isPlaceholder && (
        <img src={`https://flagcdn.com/16x12/${getCountryCode(name)}.png`} alt=""
          style={{ width: 18, height: 13, borderRadius: 2, objectFit: 'cover', flexShrink: 0, marginRight: 6 }} />
      )}
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
        {name ?? 'Por definir'}
      </span>
      {rightContent}
    </div>
  );
}

// ── BracketCanvas ──────────────────────────────────────────────────────────
/**
 * @param {Array[]}   leftRounds     4 arrays [R32,R16,QF,SF]; each match = { home, away }
 * @param {Array[]}   rightRounds    same
 * @param {Function}  renderSlot     (value, {side, roundIndex, matchIndex, isHome}) → ReactNode
 * @param {Function}  renderCenter   (colW) → ReactNode   (receives current column width)
 * @param {Object}    [hiddenRounds] { 0:true, … } – true = completely hidden & collapsed
 */
export default function BracketCanvas({ leftRounds, rightRounds, renderSlot, renderCenter, hiddenRounds = {} }) {
  const wrapperRef = useRef(null);
  const [colW, setColW] = useState(DEFAULT_COL);

  // Visible round indices per side
  const leftVis  = [0, 1, 2, 3].filter(i => !hiddenRounds[i]);
  const rightVis = [3, 2, 1, 0].filter(i => !hiddenRounds[i]);
  const totalCols = leftVis.length + rightVis.length + 1; // +1 center

  // Responsive column width
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const compute = () => {
      const w = el.clientWidth - 32; // padding
      const leftGaps  = Math.max(0, leftVis.length  - 1);
      const rightGaps = Math.max(0, rightVis.length - 1);
      // +2 for the SF↔Final dashed connectors on each side
      const totalGaps = leftGaps + 2 + rightGaps;
      const available = w - totalGaps * GAP;
      if (totalCols > 0) {
        setColW(Math.max(MIN_COL_W, Math.min(MAX_COL_W, available / totalCols)));
      }
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    return () => ro.disconnect();
  }, [leftVis.length, rightVis.length, totalCols]);

  const sfMidY  = matchTop(3, 0) + MATCH_H / 2;
  const centerW = colW + GAP * 2;

  /** Render one round column as a flex item. Returns null if hidden. */
  const renderRoundCol = (rounds, roundIndex, side, connDir) => {
    if (hiddenRounds[roundIndex]) return null;
    const matches = rounds[roundIndex];
    if (!matches) return null;

    return (
      <div key={`${side}-${roundIndex}`}
        style={{ position: 'relative', width: colW, height: CANVAS_H, flexShrink: 0 }}
      >
        {/* Label */}
        <div style={{
          position: 'absolute', top: -22, left: 0, width: '100%',
          textAlign: 'center', fontSize: '0.6rem', fontWeight: 700,
          color: 'var(--text-muted)', letterSpacing: 1.5, textTransform: 'uppercase',
        }}>
          {ROUND_LABELS[roundIndex]}
        </div>

        {/* Match cards (absolutely positioned vertically) */}
        {matches.map((match, i) => (
          <div key={i} className="match"
            style={{ position: 'absolute', top: matchTop(roundIndex, i), left: 0, width: '100%' }}
          >
            {renderSlot(match.home, { side, roundIndex, matchIndex: i, isHome: true })}
            {renderSlot(match.away, { side, roundIndex, matchIndex: i, isHome: false })}
          </div>
        ))}

        {/* Connectors to previous round (only if that round is visible) */}
        {connDir && roundIndex > 0 && !hiddenRounds[roundIndex - 1] && matches.map((_, i) => (
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
    <div ref={wrapperRef} style={{ width: '100%', paddingBottom: 20, overflowX: 'auto' }}>
      <div style={{
        display: 'inline-flex', alignItems: 'flex-start',
        padding: '30px 16px 16px', gap: 0,
        minWidth: 'min-content',
      }}>

        {/* ── LEFT SIDE ── */}
        <div style={{ display: 'flex', gap: GAP, height: CANVAS_H, flexShrink: 0 }}>
          {[0, 1, 2, 3].map(rIdx =>
            renderRoundCol(leftRounds, rIdx, 'left', rIdx > 0 ? 'right' : null)
          )}
        </div>

        {/* SF → Final dashed connector (left) */}
        {!hiddenRounds[3] && (
          <svg style={{ width: GAP, height: CANVAS_H, flexShrink: 0, overflow: 'visible', pointerEvents: 'none' }}>
            <line x1={0} y1={sfMidY} x2={GAP} y2={sfMidY}
              stroke="rgba(251,191,36,0.6)" strokeWidth={1.5} strokeDasharray="5 3" />
          </svg>
        )}

        {/* ── CENTER ── */}
        <div style={{ position: 'relative', width: centerW, height: CANVAS_H, flexShrink: 0 }}>
          {renderCenter(colW)}
        </div>

        {/* Final → SF dashed connector (right) */}
        {!hiddenRounds[3] && (
          <svg style={{ width: GAP, height: CANVAS_H, flexShrink: 0, overflow: 'visible', pointerEvents: 'none' }}>
            <line x1={0} y1={sfMidY} x2={GAP} y2={sfMidY}
              stroke="rgba(251,191,36,0.6)" strokeWidth={1.5} strokeDasharray="5 3" />
          </svg>
        )}

        {/* ── RIGHT SIDE ── */}
        <div style={{ display: 'flex', gap: GAP, height: CANVAS_H, flexShrink: 0 }}>
          {[3, 2, 1, 0].map(rIdx =>
            renderRoundCol(rightRounds, rIdx, 'right', rIdx > 0 ? 'left' : null)
          )}
        </div>

      </div>
    </div>
  );
}
