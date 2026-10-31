import PaperLoading from './PaperLoading';
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
      className="paper-dialog-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="league-rules-title"
      ref={dialogRef}
      tabIndex={-1}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="paper-panel landing-tape paper-dialog">
        <div className="py-4 px-5 border-b border-b-[rgba(17,_24,_39,_0.15)] flex flex-col gap-3">
          <div className="flex justify-between items-center gap-3">
            <div className="min-w-0">
              <div className="marker-ink text-[1rem]">Reglas de la liga</div>
              <h2
                className="m-0 poster-title text-[1.35rem] text-[#111827] overflow-hidden text-ellipsis whitespace-nowrap"
                id="league-rules-title"
              >
                {group?.name}
              </h2>
            </div>
            <button
              className="bg-[rgba(17,_24,_39,_0.08)] bg-none border-none text-[#111827] w-11 h-11 rounded-full cursor-pointer shrink-0"
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
                <p className="m-0 text-[#4b5563] text-[0.9rem]">
                  Elige una liga para ver su puntuación.
                </p>
              )}
              {isLoading && <PaperLoading label="Cargando puntuación" embedded />}
              {error && (
                <p className="m-0 text-[#4b5563] text-[0.9rem]" role="alert">
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
                <p className="m-0 whitespace-pre-wrap leading-[1.6] text-[0.95rem] text-[#1f2937]">
                  {rules}
                </p>
              ) : (
                <p className="m-0 text-[#4b5563] text-[0.9rem]">
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
