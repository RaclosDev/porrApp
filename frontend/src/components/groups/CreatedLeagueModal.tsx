import type { GroupsDashboardState } from '../../hooks/useGroupsDashboard';
import type { Group } from '../../types/api';

interface CreatedLeagueModalProps {
  newlyCreatedGroup: Group;
  setNewlyCreatedGroup: GroupsDashboardState['setNewlyCreatedGroup'];
  handleCopyCode: GroupsDashboardState['handleCopyCode'];
  handleCopyLink: GroupsDashboardState['handleCopyLink'];
  handleShareWhatsApp: GroupsDashboardState['handleShareWhatsApp'];
  navigate: GroupsDashboardState['navigate'];
}

/** Aviso tras crear una liga, con su código para invitar. */
export default function CreatedLeagueModal({
  newlyCreatedGroup,
  setNewlyCreatedGroup,
  handleCopyCode,
  handleCopyLink,
  handleShareWhatsApp,
  navigate,
}: CreatedLeagueModalProps) {
  return (
    <div className="fixed inset-0 bg-[rgba(0,_0,_0,_0.8)] [backdrop-filter:blur(6px)] flex items-center justify-center z-[9999] p-5">
      <div className="bg-[#1e293b] border border-[#00d2d3] rounded-[16px] max-w-120 w-full p-7 text-center shadow-[0_20px_40px_rgba(0,_0,_0,_0.6)] relative">
        <button
          className="absolute top-3.5 right-4 bg-transparent border-none text-muted text-[1.4rem] cursor-pointer"
          onClick={() => setNewlyCreatedGroup(null)}
        >
          ✕
        </button>
        <div className="text-[2.5rem] mb-2.5">🎉 🏆</div>
        <h2 className="text-[#00d2d3] mt-0 mb-2 mx-0 text-[1.5rem]">¡Tu liga está lista!</h2>
        <p className="text-white font-bold text-[1.1rem] mt-0 mb-4 mx-0">
          "{newlyCreatedGroup.name}"
        </p>
        <p className="text-muted text-[0.9rem] mb-5">
          Comparte este código o enlace con tus amigos para que puedan unirse y empezar a
          pronosticar.
        </p>

        <div className="bg-[rgba(0,_0,_0,_0.4)] border border-dashed border-[#00d2d3] rounded-[12px] p-4 mb-5">
          <div className="text-[0.8rem] text-muted mb-1">CÓDIGO DE INVITACIÓN</div>
          <div className="text-[2rem] font-black tracking-[6px] text-[#fbc531] mb-2.5">
            {newlyCreatedGroup.joinCode}
          </div>
          <div className="flex gap-2 justify-center flex-wrap">
            <button
              type="button"
              onClick={() => handleCopyCode(newlyCreatedGroup.joinCode)}
              className="glass-btn text-[0.85rem] py-1.5 px-3.5"
            >
              📋 Copiar Código
            </button>
            <button
              type="button"
              onClick={() => handleCopyLink(newlyCreatedGroup.joinCode)}
              className="glass-btn text-[0.85rem] py-1.5 px-3.5"
            >
              🔗 Copiar Enlace
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-2.5">
          <button
            className="w-full p-3 rounded-[10px] border-none bg-[#25D366] text-white font-bold text-[0.95rem] cursor-pointer flex items-center justify-center gap-2"
            type="button"
            onClick={() => handleShareWhatsApp(newlyCreatedGroup)}
          >
            <span>💬</span> Compartir por WhatsApp
          </button>

          <button
            type="button"
            onClick={() => {
              const format = newlyCreatedGroup.poolFormat;
              setNewlyCreatedGroup(null);
              if (format === 'MATCH_DAY') {
                navigate('/jornadas');
              } else {
                navigate('/prediction');
              }
            }}
            className="glass-btn primary-btn w-full p-3 text-[0.95rem] bg-[#00d2d3] text-[#0f172a] font-bold"
          >
            Comenzar mis Pronósticos ➜
          </button>
        </div>
      </div>
    </div>
  );
}
