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
    <div
      style={{
        marginTop: '16px',
        borderTop: '1px solid rgba(255, 255, 255, 0.08)',
        paddingTop: '14px',
        padding: '14px 4px 0 4px',
      }}
    >
      <div className="flex justify-between items-center flex-wrap gap-2.5 mb-3">
        <span className="text-[0.85rem] text-muted">
          👥 Participantes mostrados ({Object.values(selectedUsers).filter(Boolean).length}/
          {users.length}):
        </span>
        <div className="flex gap-2 flex-wrap">
          <button
            className="bg-[rgba(255,255,255,0.05)] text-white border border-[rgba(255,255,255,0.15)] py-1 px-2.5 rounded-[15px] text-[0.75rem] cursor-pointer [transition:background_0.2s]"
            onClick={() => selectTopN(5)}
          >
            ⚡ Top 5
          </button>
          <button
            className="bg-[rgba(255,255,255,0.05)] text-white border border-[rgba(255,255,255,0.15)] py-1 px-2.5 rounded-[15px] text-[0.75rem] cursor-pointer [transition:background_0.2s]"
            onClick={() => selectTopN(10)}
          >
            🔥 Top 10
          </button>
          <button
            className="bg-[rgba(255,255,255,0.05)] text-white border border-[rgba(255,255,255,0.15)] py-1 px-2.5 rounded-[15px] text-[0.75rem] cursor-pointer [transition:background_0.2s]"
            onClick={selectAll}
          >
            ✔️ Todos
          </button>
          <button
            className="bg-[rgba(255,255,255,0.05)] text-white border border-[rgba(255,255,255,0.15)] py-1 px-2.5 rounded-[15px] text-[0.75rem] cursor-pointer [transition:background_0.2s]"
            onClick={selectNone}
          >
            ❌ Ninguno
          </button>
        </div>
      </div>

      {/* Legend Chips Grid */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '8px',
          maxHeight: '130px',
          overflowY: 'auto',
          padding: '2px',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {users.map((u) => {
          const isSel = selectedUsers[u.key];
          const isHovered = hoveredUser === u.key;
          const lastIdx = activeStages.length - 1;
          return (
            <div
              key={u.key}
              onClick={() => toggleUser(u.key)}
              onMouseEnter={() => setHoveredUser(u.key)}
              onMouseLeave={() => setHoveredUser(null)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '5px 12px',
                borderRadius: '20px',
                cursor: 'pointer',
                fontSize: '0.8rem',
                transition: 'all 0.2s',
                background: isSel
                  ? isHovered
                    ? 'rgba(255,255,255,0.2)'
                    : 'rgba(255,255,255,0.08)'
                  : 'transparent',
                border: isSel ? `1px solid ${u.color}` : '1px solid rgba(255,255,255,0.1)',
                color: isSel ? '#fff' : 'var(--text-muted)',
                opacity: isSel ? 1 : 0.4,
                boxShadow: isHovered && isSel ? `0 0 10px ${u.color}66` : 'none',
                transform: isHovered ? 'translateY(-1px)' : 'none',
              }}
            >
              <span
                style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  background: u.color,
                  display: 'inline-block',
                }}
              ></span>
              <span style={{ fontWeight: u.isMe ? 'bold' : 'normal' }}>
                {u.name} {u.isMe && '★'}
              </span>
              {isSel && (
                <span
                  style={{
                    fontSize: '0.75rem',
                    color: u.color,
                    fontWeight: 'bold',
                    marginLeft: '2px',
                  }}
                >
                  {mode === 'rank'
                    ? `${u.rankEvolution[lastIdx]}º`
                    : `${u.pointsEvolution[lastIdx]}pts`}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
