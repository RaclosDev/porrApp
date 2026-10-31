import type { ChartStage, ChartUser, Selection } from './evolutionData';
interface ParticipantFilterProps {
  mode: 'rank' | 'points';
  hoveredUser: ChartUser['key'] | null;
  setHoveredUser: (key: ChartUser['key'] | null) => void;
  selectedUsers: Selection;
  toggleUser: (key: ChartUser['key']) => void;
  selectAll: () => void;
  selectNone: () => void;
  selectTopN: (n: number) => void;
  activeStages: ChartStage[];
  users: ChartUser[];
}

/** Selector de participantes visibles y leyenda con su último dato. */
export default function ParticipantFilter({
  mode,
  hoveredUser,
  setHoveredUser,
  selectedUsers,
  toggleUser,
  selectAll,
  selectNone,
  selectTopN,
  activeStages,
  users,
}: ParticipantFilterProps) {
  return (
    <div className="mt-4 border-t border-t-[rgba(255,_255,_255,_0.08)] pt-3.5 pt-3.5 pb-0 px-1">
      <div className="flex justify-between items-center flex-wrap gap-2.5 mb-3">
        <span className="text-[0.85rem] text-muted">
          Participantes mostrados ({Object.values(selectedUsers).filter(Boolean).length}/
          {users.length}):
        </span>
        <div className="flex gap-2 flex-wrap">
          <button
            type="button"
            className="bg-[rgba(255,255,255,0.05)] bg-none text-white border border-[rgba(255,255,255,0.15)] py-1 px-2.5 rounded-[15px] text-[0.75rem] cursor-pointer [transition:background_0.2s] min-h-11 sm:min-h-0"
            onClick={() => selectTopN(5)}
          >
            Top 5
          </button>
          <button
            type="button"
            className="bg-[rgba(255,255,255,0.05)] bg-none text-white border border-[rgba(255,255,255,0.15)] py-1 px-2.5 rounded-[15px] text-[0.75rem] cursor-pointer [transition:background_0.2s] min-h-11 sm:min-h-0"
            onClick={() => selectTopN(10)}
          >
            Top 10
          </button>
          <button
            type="button"
            className="bg-[rgba(255,255,255,0.05)] bg-none text-white border border-[rgba(255,255,255,0.15)] py-1 px-2.5 rounded-[15px] text-[0.75rem] cursor-pointer [transition:background_0.2s] min-h-11 sm:min-h-0"
            onClick={selectAll}
          >
            Todos
          </button>
          <button
            type="button"
            className="bg-[rgba(255,255,255,0.05)] bg-none text-white border border-[rgba(255,255,255,0.15)] py-1 px-2.5 rounded-[15px] text-[0.75rem] cursor-pointer [transition:background_0.2s] min-h-11 sm:min-h-0"
            onClick={selectNone}
          >
            Ninguno
          </button>
        </div>
      </div>

      <div
        className="flex flex-wrap gap-2 max-h-32.5 overflow-y-auto p-0.5"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {users.map((u) => {
          const isSel = selectedUsers[u.key];
          const isHovered = hoveredUser === u.key;
          const lastIdx = activeStages.length - 1;
          return (
            <button
              type="button"
              aria-pressed={Boolean(isSel)}
              className={`flex items-center gap-1.5 py-[5px] px-3 cursor-pointer text-[0.8rem] [transition:all_0.2s] ${isSel ? 'text-white' : 'text-muted'} ${isSel ? 'opacity-100' : 'opacity-70'} ${isHovered ? '[transform:translateY(-1px)]' : '[transform:none]'}`}
              key={u.key}
              onClick={() => toggleUser(u.key)}
              onMouseEnter={() => setHoveredUser(u.key)}
              onMouseLeave={() => setHoveredUser(null)}
              style={{
                borderRadius: '20px',
                background: isSel
                  ? isHovered
                    ? 'rgba(255,255,255,0.2)'
                    : 'rgba(255,255,255,0.08)'
                  : 'transparent',
                border: isSel ? `1px solid ${u.color}` : '1px solid rgba(255,255,255,0.1)',
                boxShadow: isHovered && isSel ? `0 0 10px ${u.color}66` : 'none',
              }}
            >
              <span
                className="w-2.5 h-2.5 rounded-full inline-block"
                style={{ background: u.color }}
              ></span>
              <span className={`${u.isMe ? 'font-bold' : 'font-normal'}`}>
                {u.name} {u.isMe && '★'}
              </span>
              {isSel && (
                <span className="text-[0.75rem] font-bold ml-0.5" style={{ color: u.color }}>
                  {mode === 'rank'
                    ? `${u.rankEvolution[lastIdx]}º`
                    : `${u.pointsEvolution[lastIdx]}pts`}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
