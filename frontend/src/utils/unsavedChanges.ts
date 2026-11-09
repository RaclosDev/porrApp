import { useEffect } from 'react';
import { create } from 'zustand';
import type { ConfirmOptions } from './confirmAction';

interface UnsavedChangesState {
  /** Aviso de cada pantalla con cambios de predicción sin guardar. */
  pending: Map<symbol, string>;
}

export const useUnsavedChangesStore = create<UnsavedChangesState>(() => ({ pending: new Map() }));

/** Aviso de la pantalla que tiene cambios sin guardar, o `null` si no hay ninguno. */
export const unsavedChangesMessage = (state: UnsavedChangesState): string | null =>
  state.pending.values().next().value ?? null;

/** Diálogo con el que se pregunta si se sale de una pantalla con cambios sin guardar. */
export const leaveDialog = (message: string): ConfirmOptions => ({
  title: '¿Salir sin guardar?',
  message,
  confirmLabel: 'Salir',
  cancelLabel: 'Seguir aquí',
});

/** Da por perdidos los cambios sin guardar: se llama tras confirmar que se sale de todos modos. */
export const discardUnsavedChanges = () => useUnsavedChangesStore.setState({ pending: new Map() });

/**
 * Declara que la pantalla tiene cambios de predicción sin guardar mientras `dirty` sea cierto. Con
 * ellos, `LeaveGuard` pide confirmación antes de ir a otra pantalla y el navegador antes de cerrar o
 * recargar la pestaña.
 *
 * @param message - Qué se pierde al salir, para el diálogo de confirmación.
 */
export function useUnsavedChanges(dirty: boolean, message: string) {
  useEffect(() => {
    if (!dirty) return undefined;
    const key = Symbol('unsaved');
    const update = (change: (pending: Map<symbol, string>) => void) =>
      useUnsavedChangesStore.setState((state) => {
        const pending = new Map(state.pending);
        change(pending);
        return { pending };
      });
    // El navegador muestra su propio texto: solo deja pedir la confirmación.
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    update((pending) => pending.set(key, message));
    window.addEventListener('beforeunload', warn);
    return () => {
      window.removeEventListener('beforeunload', warn);
      update((pending) => pending.delete(key));
    };
  }, [dirty, message]);
}
