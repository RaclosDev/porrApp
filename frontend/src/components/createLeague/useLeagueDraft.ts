import { useCallback, useEffect, useState } from 'react';
import {
  clearStoredDraft,
  emptyDraft,
  normalizeDraft,
  readStoredDraft,
  storeDraft,
  type DraftContext,
  type LeagueDraft,
  type StepErrors,
} from './leagueDraft';

const EMPTY = JSON.stringify(emptyDraft());

/**
 * Borrador de la liga que se está creando. Vive en el dispositivo: ir hacia atrás, recargar o
 * volver otro día no pierde lo elegido. Con las competiciones cargadas se mantiene coherente.
 */
export function useLeagueDraft(ctx: DraftContext | null) {
  const [draft, setDraft] = useState<LeagueDraft>(readStoredDraft);

  useEffect(() => {
    if (JSON.stringify(draft) === EMPTY) clearStoredDraft();
    else storeDraft(draft);
  }, [draft]);

  // Lo guardado puede apuntar a una competición o un cierre que ya no existen.
  useEffect(() => {
    if (ctx) setDraft((prev) => normalizeDraft(prev, ctx));
  }, [ctx]);

  const update = useCallback(
    (patch: Partial<LeagueDraft>) =>
      setDraft((prev) =>
        ctx ? normalizeDraft({ ...prev, ...patch }, ctx) : { ...prev, ...patch },
      ),
    [ctx],
  );

  const reset = useCallback(() => {
    clearStoredDraft();
    setDraft(emptyDraft());
  }, []);

  return { draft, update, reset };
}

type DraftUpdate = ReturnType<typeof useLeagueDraft>['update'];

/** Lo que recibe cada paso del asistente. */
export interface StepProps {
  draft: LeagueDraft;
  update: DraftUpdate;
  errors: StepErrors;
  ctx: DraftContext;
}
