import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useDialogFocus } from '../hooks/useDialogFocus';
import { fetchLeagueScoring } from '../services/api';
import { queryKeys } from '../services/queryKeys';
import { errorMessage } from '../utils/errors';
import RulesTabs, { type RulesTab } from './league/RulesTabs';
import ScoringRulesPanel from './league/ScoringRulesPanel';

/**
 * Modal de solo lectura con las reglas de una liga: cuánto da cada acierto ("Puntuación") y las
 * normas en texto libre que escribe el administrador ("Normas").
 */
export default function LeagueRulesModal({
  group,
  onClose,
}: {
  group: { id?: number | string | null; name?: string; rules?: string | null } | null | undefined;
  onClose: () => void;
}) {
  const rules = (group?.rules || '').trim();
  // Sin liga activa el id llega vacío.
  const groupId = group?.id || null;
  const [tab, setTab] = useState<RulesTab>('scoring');
  const dialogRef = useRef<HTMLDivElement>(null);
  // Escape propio: desde Inicio no hay otro manejador que cierre este modal.
  useDialogFocus(dialogRef, { onEscape: onClose });

  const {
    data: scoring,
    isLoading,
    error,
  } = useQuery({
    queryKey: queryKeys.leagueScoring(groupId),
    queryFn: () => fetchLeagueScoring(groupId as number | string),
    enabled: groupId != null,
  });

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
        <div className="py-4 px-5 border-b border-b-[rgba(255,_255,_255,_0.08)] flex flex-col gap-3">
          <div className="flex justify-between items-center gap-3">
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
          <RulesTabs idPrefix="league-rules" tab={tab} onChange={setTab} />
        </div>

        <div className="py-4.5 px-5 overflow-y-auto flex-1">
          {tab === 'scoring' && (
            <div
              id="league-rules-panel-scoring"
              role="tabpanel"
              aria-labelledby="league-rules-tab-scoring"
            >
              {groupId == null && (
                <p className="m-0 text-muted text-[0.9rem]">
                  Elige una liga para ver su puntuación.
                </p>
              )}
              {isLoading && <p className="m-0 text-muted text-[0.9rem]">Cargando la puntuación…</p>}
              {error && (
                <p className="m-0 text-muted text-[0.9rem]" role="alert">
                  {errorMessage(error, 'No se pudo cargar la puntuación.')}
                </p>
              )}
              {scoring && <ScoringRulesPanel scoring={scoring} />}
            </div>
          )}

          {tab === 'norms' && (
            <div
              id="league-rules-panel-norms"
              role="tabpanel"
              aria-labelledby="league-rules-tab-norms"
            >
              {rules ? (
                <p className="m-0 whitespace-pre-wrap leading-[1.6] text-[0.92rem] text-[#e2e8f0]">
                  {rules}
                </p>
              ) : (
                <p className="m-0 text-muted text-[0.9rem]">
                  El administrador de esta liga todavía no ha escrito normas: cuota, pagos o
                  premios.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
