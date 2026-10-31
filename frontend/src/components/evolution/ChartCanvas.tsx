import type { ChartStage, ChartUser, Selection, TimeScale } from './evolutionData';
interface ChartCanvasProps {
  mode: 'rank' | 'points';
  timeScale: TimeScale;
  zoomLevel: number;
  hoveredUser: ChartUser['key'] | null;
  setHoveredUser: (key: ChartUser['key'] | null) => void;
  hoveredStageIdx: number | null;
  setHoveredStageIdx: (idx: number | null) => void;
  selectedUsers: Selection;
  activeStages: ChartStage[];
  users: ChartUser[];
  yGridLines: number[];
  maxRank: number;
  width: number;
  height: number;
  padding: { top: number; right: number; bottom: number; left: number };
  chartW: number;
  chartH: number;
  getX: (idx: number) => number;
  getY: (val: number, isRank: boolean) => number;
}

/** Gráfico SVG con las líneas de cada participante y los ejes. */
export default function ChartCanvas({
  mode,
  timeScale,
  zoomLevel,
  hoveredUser,
  setHoveredUser,
  hoveredStageIdx,
  setHoveredStageIdx,
  selectedUsers,
  activeStages,
  users,
  yGridLines,
  maxRank,
  width,
  height,
  padding,
  chartW,
  chartH,
  getX,
  getY,
}: ChartCanvasProps) {
  return (
    <div
      className="relative w-full overflow-x-auto pb-2"
      style={{ WebkitOverflowScrolling: 'touch' }}
    >
      <svg
        className="w-full h-auto block overflow-visible [transition:min-width_0.3s_cubic-bezier(0.2,_0.8,_0.2,_1)]"
        viewBox={`0 0 ${width} ${height}`}
        style={{
          minWidth:
            timeScale === 'rounds'
              ? `${Math.max(100, zoomLevel * 100)}%`
              : `${Math.max(750, zoomLevel * 750)}px`,
        }}
        onClick={() => {
          setHoveredStageIdx(null);
          setHoveredUser(null);
        }}
      >
        {mode === 'rank'
          ? Array.from({ length: maxRank }, (_, i) => i + 1).map((rk) => {
              const y = getY(rk, true);
              return (
                <g key={`y-${rk}`}>
                  <line
                    x1={padding.left}
                    y1={y}
                    x2={width - padding.right}
                    y2={y}
                    stroke="rgba(17,24,39,0.06)"
                    strokeDasharray="4 4"
                  />
                  <text
                    x={padding.left - 10}
                    y={y + 4}
                    fontSize="11"
                    textAnchor="end"
                    fontWeight={rk === 1 ? 'bold' : 'normal'}
                    fill={rk === 1 ? 'var(--accent-cyan)' : 'var(--text-muted)'}
                  >
                    {rk === 1 ? '🥇 1º' : `${rk}º`}
                  </text>
                </g>
              );
            })
          : yGridLines.map((pts) => {
              const y = getY(pts, false);
              return (
                <g key={`y-${pts}`}>
                  <line
                    x1={padding.left}
                    y1={y}
                    x2={width - padding.right}
                    y2={y}
                    stroke="rgba(17,24,39,0.06)"
                    strokeDasharray="4 4"
                  />
                  <text
                    x={padding.left - 10}
                    y={y + 4}
                    fill="var(--text-muted)"
                    fontSize="11"
                    textAnchor="end"
                  >
                    {pts} pts
                  </text>
                </g>
              );
            })}

        {activeStages.map((st, idx) => {
          const x = getX(idx);
          const isHovered = hoveredStageIdx === idx;
          const colWidth = chartW / Math.max(activeStages.length, 1);
          return (
            <g
              className="cursor-pointer"
              key={st.key}
              onMouseEnter={() => setHoveredStageIdx(idx)}
              onClick={(e) => {
                e.stopPropagation();
                setHoveredStageIdx(idx);
              }}
            >
              <rect
                className="[transition:fill_0.2s]"
                x={x - colWidth / 2}
                y={padding.top}
                width={colWidth}
                height={chartH}
                fill={isHovered ? 'rgba(11, 95, 116, 0.12)' : 'transparent'}
              />
              <line
                x1={x}
                y1={padding.top}
                x2={x}
                y2={padding.top + chartH}
                stroke={
                  isHovered
                    ? 'rgba(11, 95, 116, 0.6)'
                    : st.isRoundBoundary
                      ? 'rgba(17,24,39,0.15)'
                      : 'rgba(17,24,39,0.04)'
                }
                strokeWidth={isHovered ? 2 : st.isRoundBoundary ? 1.5 : 1}
                strokeDasharray={st.isRoundBoundary && !isHovered ? '3 3' : undefined}
              />
              {(st.showLabel || isHovered) && (
                <text
                  x={x}
                  y={height - 12}
                  fill={isHovered ? 'var(--accent-cyan)' : 'var(--text-muted)'}
                  fontSize={isHovered ? '12' : '11'}
                  fontWeight={isHovered ? 'bold' : 'normal'}
                  textAnchor="middle"
                >
                  {st.label}
                </text>
              )}
            </g>
          );
        })}

        {users.map((u) => {
          if (!selectedUsers[u.key]) return null;
          const isHovered = hoveredUser === u.key;
          const isOtherHovered = hoveredUser !== null && hoveredUser !== u.key;

          const points = activeStages
            .map((_, idx) => {
              let val = mode === 'rank' ? u.rankEvolution[idx] : u.pointsEvolution[idx];
              if (val === undefined || val === null || isNaN(val)) {
                val =
                  mode === 'rank' ? u.rankEvolution[idx - 1] || 1 : u.pointsEvolution[idx - 1] || 0;
              }
              return `${getX(idx)},${getY(val, mode === 'rank')}`;
            })
            .join(' ');

          return (
            <g
              className={`[transition:opacity_0.2s] cursor-pointer ${isOtherHovered ? 'opacity-[0.15]' : 'opacity-[1]'}`}
              key={u.key}
              onMouseEnter={() => setHoveredUser(u.key)}
              onMouseLeave={() => setHoveredUser(null)}
              onClick={(e) => {
                e.stopPropagation();
                setHoveredUser(hoveredUser === u.key ? null : u.key);
              }}
            >
              <polyline fill="none" stroke="transparent" strokeWidth="20" points={points} />
              <polyline
                className="[transition:all_0.2s]"
                fill="none"
                stroke={u.color}
                strokeWidth={isHovered || u.isMe ? 3.5 : 2}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={u.isMe && !isHovered ? 'none' : undefined}
                points={points}
              />
              {activeStages.map((st, idx) => {
                let val = mode === 'rank' ? u.rankEvolution[idx] : u.pointsEvolution[idx];
                if (val === undefined || val === null || isNaN(val)) {
                  val =
                    mode === 'rank'
                      ? u.rankEvolution[idx - 1] || 1
                      : u.pointsEvolution[idx - 1] || 0;
                }
                const cx = getX(idx);
                const cy = getY(val, mode === 'rank');
                const isStageHovered = hoveredStageIdx === idx;
                const shouldShowDot =
                  timeScale === 'rounds' || st.showLabel || isHovered || isStageHovered;
                if (!shouldShowDot) return null;
                const dotRadius = isHovered || isStageHovered ? 6 : u.isMe ? 4 : 3;
                return (
                  <circle
                    className="[transition:all_0.2s]"
                    key={idx}
                    cx={cx}
                    cy={cy}
                    r={dotRadius}
                    fill={u.color}
                    stroke="var(--paper)"
                    strokeWidth="2"
                  />
                );
              })}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
