import type { GroupsDashboardState } from '../../hooks/useGroupsDashboard';
interface JoinGroupPanelProps {
  joinCode: GroupsDashboardState['joinCode'];
  setJoinCode: GroupsDashboardState['setJoinCode'];
  handleJoin: GroupsDashboardState['handleJoin'];
  setShowJoinModal: (show: boolean) => void;
}

/** Formulario para unirse a una liga con su código. */
export default function JoinGroupPanel({
  joinCode,
  setJoinCode,
  handleJoin,
  setShowJoinModal,
}: JoinGroupPanelProps) {
  return (
    <div className="max-w-120 mt-0 mb-7.5 mx-auto">
      <div className="paper-panel album-sheet p-6 flex flex-col gap-[15px]">
        <div className="flex justify-between items-center">
          <h3 className="m-0 poster-title text-[1.3rem] flex items-center gap-2.5">
            Unirse con código
          </h3>
          <button
            className="bg-none bg-transparent border-none text-muted cursor-pointer text-[1.2rem] min-w-11 min-h-11 flex items-center justify-center"
            type="button"
            onClick={() => setShowJoinModal(false)}
            aria-label="Cerrar"
            title="Cerrar"
          >
            ✕
          </button>
        </div>
        <p className="text-muted text-[0.88rem] m-0">Escribe el código de invitación de la liga:</p>
        <form className="flex flex-wrap gap-2.5" onSubmit={handleJoin}>
          <input
            type="text"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            placeholder="Ej: X9K2PLMQ7R"
            aria-label="Código de invitación"
            maxLength={10}
            className="glass-input flex-1 min-w-0 uppercase tracking-[2px] font-bold"
          />
          <button type="submit" className="glass-btn primary-btn font-bold">
            Unirse
          </button>
        </form>
      </div>
    </div>
  );
}
