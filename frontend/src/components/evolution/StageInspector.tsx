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
      className={`py-3 px-4 mb-4 [transition:all_0.3s] ${currentInspectedStage ? 'bg-[rgba(0,_210,_211,_0.07)] bg-none' : 'bg-[rgba(255,_255,_255,_0.02)] bg-none'}`}
      style={{
        border: '1px solid',
        borderColor: currentInspectedStage ? 'rgba(0, 210, 211, 0.3)' : 'rgba(255, 255, 255, 0.06)',
        borderRadius: '12px',
      }}
    >
      {currentInspectedStage ? (
        <div>
          <div className="flex justify-between items-center flex-wrap gap-2.5 border-b border-b-[rgba(255,_255,_255,_0.08)] pb-2 mb-2.5">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="font-bold text-[#00d2d3] text-[0.95rem] bg-[rgba(0,_210,_211,_0.15)] bg-none py-[3px] px-2.5 rounded-[15px] border border-[rgba(0,_210,_211,_0.4)]">
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
              type="button"
              className="bg-[rgba(255,255,255,0.08)] bg-none border-none text-[#aaa] cursor-pointer text-[0.8rem] py-1 px-2.5 rounded-[12px] [transition:background_0.2s]"
              onClick={() => setHoveredStageIdx(null)}
              title="Cerrar inspección"
            >
              Cerrar
            </button>
          </div>

          <div
            className="flex gap-2 overflow-x-auto pb-1"
            style={{ WebkitOverflowScrolling: 'touch' }}
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
                    className={`flex items-center gap-1.5 py-1 px-2.5 rounded-[16px] text-[0.8rem] text-white whitespace-nowrap shrink-0 ${u.isMe ? 'bg-[rgba(0,_210,_211,_0.2)] bg-none' : 'bg-[rgba(255,_255,_255,_0.06)] bg-none'} ${u.isMe ? 'border border-[#00d2d3]' : 'border border-[rgba(255,_255,_255,_0.1)]'}`}
                    key={u.key}
                  >
                    <span
                      className="inline-block w-2 h-2 rounded-full"
                      style={{ background: u.color }}
                    ></span>
                    <span className={`${u.isMe ? 'font-bold' : 'font-normal'}`}>{u.name}</span>
                    <span
                      className={`font-bold ml-1 ${mode === 'rank' ? 'text-[#00d2d3]' : 'text-[#ff9f43]'}`}
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
          <span className="text-[#ccc]">Pulsa una columna del gráfico</span> para ver los puntos y
          la posición en ese momento.
        </div>
      )}
    </div>
  );
}
