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
      <div className="glass-panel p-6 flex flex-col gap-[15px] border border-[#9b59b6]">
        <div className="flex justify-between items-center">
          <h3 className="m-0 text-[#9b59b6] flex items-center gap-2.5">🎟️ Unirse con Código</h3>
          <button
            className="bg-none border-none text-muted cursor-pointer text-[1.2rem] min-w-11 min-h-11 flex items-center justify-center"
            type="button"
            onClick={() => setShowJoinModal(false)}
            aria-label="Cerrar"
            title="Cerrar"
          >
            ✕
          </button>
        </div>
        <p className="text-muted text-[0.88rem] m-0">
          ¿Tienes un código de invitación de 6 letras? Introdúcelo aquí para acceder directamente a
          la liga:
        </p>
        <form className="flex gap-2.5" onSubmit={handleJoin}>
          <input
            type="text"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            placeholder="Ej: X9K2PL"
            aria-label="Código de invitación de 6 letras"
            maxLength={6}
            className="glass-input flex-1 uppercase tracking-[2px] font-bold"
          />
          <button
            type="submit"
            className="glass-btn primary-btn bg-[#9b59b6] border-[#9b59b6] font-bold"
          >
            Unirse
          </button>
        </form>
      </div>
    </div>
  );
}
