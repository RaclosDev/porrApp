import type { ChartStage, ChartUser, Selection } from './evolutionData';
interface StageInspectorProps {
  mode: 'rank' | 'points';
  setHoveredStageIdx: (idx: number | null) => void;
  selectedUsers: Selection;
  users: ChartUser[];
  currentInspectedStage: ChartStage | null;
  inspectedIdx: number;
}

/** Detalle del punto del eje que se está inspeccionando. */
export default function StageInspector({
  mode,
  setHoveredStageIdx,
  selectedUsers,
  users,
  currentInspectedStage,
  inspectedIdx,
}: StageInspectorProps) {
  return (
    <div
      style={{
        background: currentInspectedStage ? 'rgba(0, 210, 211, 0.07)' : 'rgba(255, 255, 255, 0.02)',
        border: '1px solid',
        borderColor: currentInspectedStage ? 'rgba(0, 210, 211, 0.3)' : 'rgba(255, 255, 255, 0.06)',
        borderRadius: '12px',
        padding: '12px 16px',
        marginBottom: '16px',
        transition: 'all 0.3s',
      }}
    >
      {currentInspectedStage ? (
        <div>
          <div className="flex justify-between items-center flex-wrap gap-2.5 border-b border-b-[rgba(255,_255,_255,_0.08)] pb-2 mb-2.5">
            <div className="flex items-center gap-3 flex-wrap">
              <span
                style={{
                  fontWeight: 'bold',
                  color: '#00d2d3',
                  fontSize: '0.95rem',
                  background: 'rgba(0, 210, 211, 0.15)',
                  padding: '3px 10px',
                  borderRadius: '15px',
                  border: '1px solid rgba(0, 210, 211, 0.4)',
                }}
              >
                📍 {currentInspectedStage.roundName || currentInspectedStage.label}
              </span>
              {currentInspectedStage.matchTitle && (
                <span className="text-[0.88rem] text-white font-bold">
                  ⚽ {currentInspectedStage.matchTitle}
                </span>
              )}
              {currentInspectedStage.matchTime && (
                <span className="text-[0.8rem] text-muted">
                  🕒 {currentInspectedStage.matchTime}
                </span>
              )}
            </div>
            <button
              className="bg-[rgba(255,255,255,0.08)] border-0 text-[#aaa] cursor-pointer text-[0.8rem] py-1 px-2.5 rounded-[12px] [transition:background_0.2s]"
              onClick={() => setHoveredStageIdx(null)}
              title="Cerrar inspección"
            >
              ✕ Cerrar detalle
            </button>
          </div>

          <div
            style={{
              display: 'flex',
              gap: '8px',
              overflowX: 'auto',
              paddingBottom: '4px',
              WebkitOverflowScrolling: 'touch',
            }}
          >
            {users
              .filter((u) => selectedUsers[u.key])
              .sort((a, b) => {
                if (mode === 'rank')
                  return a.rankEvolution[inspectedIdx] - b.rankEvolution[inspectedIdx];
                return b.pointsEvolution[inspectedIdx] - a.pointsEvolution[inspectedIdx];
              })
              .map((u) => {
                const rk = u.rankEvolution[inspectedIdx];
                const pts = u.pointsEvolution[inspectedIdx];
                return (
                  <div
                    key={u.key}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      background: u.isMe ? 'rgba(0, 210, 211, 0.2)' : 'rgba(255, 255, 255, 0.06)',
                      border: u.isMe ? '1px solid #00d2d3' : '1px solid rgba(255, 255, 255, 0.1)',
                      padding: '4px 10px',
                      borderRadius: '16px',
                      fontSize: '0.8rem',
                      color: '#fff',
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                    }}
                  >
                    <span
                      style={{
                        display: 'inline-block',
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: u.color,
                      }}
                    ></span>
                    <span style={{ fontWeight: u.isMe ? 'bold' : 'normal' }}>{u.name}</span>
                    <span
                      style={{
                        color: mode === 'rank' ? '#00d2d3' : '#ff9f43',
                        fontWeight: 'bold',
                        marginLeft: '4px',
                      }}
                    >
                      {mode === 'rank' ? `${rk}º` : `${pts} pts`}
                    </span>
                  </div>
                );
              })}
          </div>
        </div>
      ) : (
        <div className="text-center text-muted text-[0.85rem] py-1 px-0 select-none">
          👆 <span className="text-[#ccc]">Toca cualquier columna del gráfico</span> para
          inspeccionar en directo los puntos y el ranking de ese momento (sin clics dobles).
        </div>
      )}
    </div>
  );
}
