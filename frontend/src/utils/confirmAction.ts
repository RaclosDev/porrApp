import { create } from 'zustand';

export interface ConfirmOptions {
  title: string;
  message: string;
  /** Texto del botón que ejecuta la acción; nombra la acción, no un «Aceptar» genérico. */
  confirmLabel: string;
  cancelLabel?: string;
}

interface ConfirmRequest extends ConfirmOptions {
  resolve: (confirmed: boolean) => void;
}

export const useConfirmStore = create<{ request: ConfirmRequest | null }>(() => ({
  request: null,
}));

/**
 * Pide confirmación en el diálogo de papel de la app en lugar del `window.confirm` del navegador.
 * Resuelve `true` solo si se pulsa el botón de la acción; cerrar o cancelar resuelve `false`.
 */
export function confirmAction(options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    useConfirmStore.getState().request?.resolve(false);
    useConfirmStore.setState({ request: { ...options, resolve } });
  });
}

export function answerConfirm(confirmed: boolean) {
  const { request } = useConfirmStore.getState();
  if (!request) return;
  useConfirmStore.setState({ request: null });
  request.resolve(confirmed);
}
