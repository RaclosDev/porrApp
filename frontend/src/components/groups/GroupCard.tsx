import type { GroupsDashboardState } from '../../hooks/useGroupsDashboard';
import type { Group } from '../../types/api';
import { LeagueAvatar } from '../Avatar';

interface GroupCardProps {
  group: Group;
  isSelected: boolean;
  isCreator: boolean;
  handleEnterGroup: GroupsDashboardState['handleEnterGroup'];
  handleLeaveGroup: GroupsDashboardState['handleLeaveGroup'];
  handleCopyCode: GroupsDashboardState['handleCopyCode'];
  handleCopyLink: GroupsDashboardState['handleCopyLink'];
  handleShareWhatsApp: GroupsDashboardState['handleShareWhatsApp'];
  setSelectedGroupForMembers: (group: Group | null) => void;
  setSelectedGroupForRules: (group: Group | null) => void;
}

/** Tarjeta de una liga en "Mis ligas", con sus acciones. */
export default function GroupCard({
  group,
  isSelected,
  isCreator,
  handleEnterGroup,
  handleLeaveGroup,
  handleCopyCode,
  handleCopyLink,
  handleShareWhatsApp,
  setSelectedGroupForMembers,
  setSelectedGroupForRules,
}: GroupCardProps) {
  return (
    <div
      key={group.id}
      className={`glass-panel flex-1 min-w-70 max-w-90 p-5 relative flex flex-col gap-3 rounded-[16px] bg-[linear-gradient(160deg,_rgba(255,255,255,0.05),_rgba(255,255,255,0.015))] bg-transparent ${isSelected ? 'border-2 border-[#00d2d3]' : 'border border-line'} ${isSelected ? 'shadow-[0_8px_24px_rgba(0,_210,_211,_0.18)]' : 'shadow-[0_4px_14px_rgba(0,_0,_0,_0.25)]'}`}
    >
      {isSelected && (
        <div className="absolute -top-2.5 left-[15px] bg-[#00d2d3] bg-none text-black py-0.5 px-2.5 rounded-[12px] text-[0.75rem] font-bold">
          SELECCIONADA
        </div>
      )}

      <div className="flex items-center gap-3.5 min-h-16">
        <LeagueAvatar url={group.imageUrl} size={64} />
        <div className="min-w-0">
          <h3
            className="text-[1.15rem] mt-0 mb-1 mx-0 overflow-hidden text-ellipsis whitespace-nowrap"
            title={group.name}
          >
            {group.name}
          </h3>
          <p className="text-muted text-[0.8rem] m-0">
            Admin: <strong>{group.adminParticipantName}</strong>
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {isCreator && (
          <span className="text-[0.72rem] font-bold py-[3px] px-[9px] rounded-[999px] bg-[rgba(255,_193,_7,_0.14)] bg-none border border-[rgba(255,_193,_7,_0.4)] text-[#ffc107]">
            👑 Administras
          </span>
        )}
        {group.competitionName && (
          <span className="text-[0.72rem] font-semibold py-[3px] px-[9px] rounded-[999px] bg-[rgba(162,_155,_254,_0.14)] bg-none border border-[rgba(162,_155,_254,_0.35)] text-[#a29bfe]">
            {group.competitionName}
          </span>
        )}
        {group.poolFormat && (
          <span className="text-[0.72rem] font-semibold py-[3px] px-[9px] rounded-[999px] bg-[rgba(0,_210,_211,_0.1)] bg-none border border-[rgba(0,_210,_211,_0.3)] text-[#00d2d3]">
            {group.poolFormat === 'MATCH_DAY' ? 'Jornadas' : 'Cuadro'}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-2 mt-auto pt-2.5">
        {isSelected ? (
          <div className="w-full py-2.5 px-3.5 rounded-[10px] bg-[rgba(0,_210,_211,_0.12)] bg-none border border-[#00d2d3] text-[#00d2d3] font-bold text-[0.9rem] flex items-center justify-center gap-1.5 box-border">
            <span>✓</span>
            <span>Liga Actual</span>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => handleEnterGroup(group.id)}
            className="glass-btn primary-btn w-full py-2.5 px-3.5 rounded-[10px] font-bold text-[0.9rem] flex items-center justify-center gap-1.5 box-border cursor-pointer"
          >
            <span>Acceder a esta Liga</span>
            <span>→</span>
          </button>
        )}

        {group.joinCode && (
          <div className="flex items-stretch gap-2 w-full">
            <button
              type="button"
              onClick={() => handleShareWhatsApp(group)}
              className="glass-btn flex-[1_1_auto] min-w-0 py-2.5 px-3 rounded-[10px] font-extrabold text-[0.9rem] flex items-center justify-center gap-[7px] text-[#0f172a] bg-[linear-gradient(135deg,_#25D366,_#1ebd5a)] bg-transparent border border-[rgba(37,_211,_102,_0.55)] box-border"
              title="Invitar por WhatsApp"
              aria-label={`Invitar a ${group.name} por WhatsApp`}
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                width="16"
                height="16"
                fill="currentColor"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M20.52 3.48A11.86 11.86 0 0 0 12.08 0C5.5 0 .14 5.35.14 11.94c0 2.1.55 4.16 1.6 5.97L0 24l6.25-1.64a11.94 11.94 0 0 0 5.82 1.49h.01c6.58 0 11.94-5.36 11.94-11.94 0-3.19-1.24-6.19-3.5-8.43ZM12.08 21.8h-.01a9.9 9.9 0 0 1-5.04-1.38l-.36-.21-3.71.97.99-3.62-.23-.37a9.88 9.88 0 0 1-1.52-5.25c0-5.46 4.44-9.9 9.9-9.9a9.83 9.83 0 0 1 7 2.9 9.83 9.83 0 0 1 2.9 7c0 5.46-4.45 9.9-9.92 9.9Zm5.43-7.41c-.3-.15-1.77-.87-2.04-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.95 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.47-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.62-.92-2.22-.24-.58-.48-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.49s1.07 2.89 1.22 3.09c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.5 1.69.64.71.23 1.36.2 1.87.12.57-.08 1.77-.72 2.02-1.42.25-.7.25-1.3.17-1.42-.07-.12-.27-.2-.57-.35Z" />
              </svg>
              <span>Invitar</span>
            </button>
            <button
              type="button"
              onClick={() => handleCopyCode(group.joinCode)}
              className="glass-btn flex-[0_0_auto] py-2.5 px-3 rounded-[10px] font-extrabold text-[0.85rem] text-white bg-[rgba(0,_0,_0,_0.25)] bg-none border border-line whitespace-nowrap"
              title="Copiar código de invitación"
              aria-label={`Copiar código de invitación de ${group.name}`}
            >
              {group.joinCode}
            </button>
            <button
              type="button"
              onClick={() => handleCopyLink(group.joinCode)}
              className="glass-btn flex-[0_0_42px] w-10.5 py-2.5 px-0 rounded-[10px] flex items-center justify-center text-[1rem] text-white bg-[rgba(0,_0,_0,_0.25)] bg-none border border-line"
              title="Copiar enlace de invitación"
              aria-label={`Copiar enlace de invitación de ${group.name}`}
            >
              🔗
            </button>
          </div>
        )}

        <div className="flex gap-2 items-center">
          <button
            type="button"
            onClick={() => setSelectedGroupForRules(group)}
            className="glass-btn flex-1 py-2 px-3 text-[0.85rem] flex items-center justify-center gap-1.5 whitespace-nowrap"
            title="Ver las reglas de esta liga"
            aria-label="Ver las reglas de esta liga"
          >
            <span>📖</span>
            <span>Reglas</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedGroupForMembers(group)}
            className="glass-btn flex-1 py-2 px-3 text-[0.85rem] text-[#00d2d3] flex items-center justify-center gap-1.5 whitespace-nowrap"
            title={isCreator ? 'Administrar liga' : 'Ver participantes'}
            aria-label={isCreator ? 'Administrar liga' : 'Ver participantes'}
          >
            <span>{isCreator ? '⚙️' : '👥'}</span>
            <span>{isCreator ? 'Administrar' : 'Miembros'}</span>
          </button>
        </div>

        {!isCreator && (
          <button
            type="button"
            onClick={() => handleLeaveGroup(group.id, group.name)}
            className="glass-btn w-full py-2 px-3.5 text-[0.85rem] bg-[rgba(231,_76,_60,_0.15)] bg-none border border-[rgba(231,_76,_60,_0.6)] text-[#ffcccc] whitespace-nowrap"
            title="Abandonar Liga"
          >
            Salir de la liga
          </button>
        )}
      </div>
    </div>
  );
}
