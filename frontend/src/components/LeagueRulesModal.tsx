import { useRef } from 'react';
import { useDialogFocus } from '../hooks/useDialogFocus';

/**
 * Modal de solo lectura con las reglas personalizadas de una liga.
 * Cada liga define las suyas desde el panel de administración.
 */
export default function LeagueRulesModal({
  group,
  onClose,
}: {
  group: { name?: string; rules?: string | null } | null | undefined;
  onClose: () => void;
}) {
  const rules = (group?.rules || '').trim();
  const dialogRef = useRef<HTMLDivElement>(null);
  // Escape propio: desde Inicio no hay otro manejador que cierre este modal.
  useDialogFocus(dialogRef, { onEscape: onClose });

  return (
    <div
      className="fixed inset-0 bg-[rgba(0,_0,_0,_0.75)] bg-none [backdrop-filter:blur(8px)] flex items-center justify-center z-[10000] p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="league-rules-title"
      ref={dialogRef}
      tabIndex={-1}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="glass-panel w-full max-w-130 max-h-[85vh] bg-[#0f172a] bg-none border border-[rgba(0,_210,_211,_0.3)] rounded-[20px] flex flex-col shadow-[0_25px_50px_-12px_rgba(0,_0,_0,_0.7)] overflow-hidden">
        <div className="py-4 px-5 border-b border-b-[rgba(255,_255,_255,_0.08)] flex justify-between items-center gap-3">
          <div className="min-w-0">
            <div className="text-[0.72rem] font-bold text-[#00d2d3] uppercase tracking-[1px]">
              📖 Reglas de la liga
            </div>
            <h2
              className="m-0 text-[1.15rem] text-white font-extrabold overflow-hidden text-ellipsis whitespace-nowrap"
              id="league-rules-title"
            >
              {group?.name}
            </h2>
          </div>
          <button
            className="bg-[rgba(255,_255,_255,_0.08)] bg-none border-none text-white w-11 h-11 rounded-full cursor-pointer shrink-0"
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        <div className="py-4.5 px-5 overflow-y-auto flex-1">
          {rules ? (
            <p className="m-0 whitespace-pre-wrap leading-[1.6] text-[0.92rem] text-[#e2e8f0]">
              {rules}
            </p>
          ) : (
            <p className="m-0 text-muted text-[0.9rem]">
              El administrador de esta liga todavía no ha definido reglas propias.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
