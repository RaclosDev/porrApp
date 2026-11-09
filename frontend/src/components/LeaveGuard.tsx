import { useEffect } from 'react';
import { useBlocker } from 'react-router-dom';
import { answerConfirm, confirmAction } from '../utils/confirmAction';
import {
  leaveDialog,
  unsavedChangesMessage,
  useUnsavedChangesStore,
} from '../utils/unsavedChanges';

/**
 * Pide confirmación antes de ir a otra pantalla si la actual tiene cambios de predicción sin guardar
 * (los que declara `useUnsavedChanges`). Si se guardan mientras se pregunta, sigue sin preguntar.
 */
export default function LeaveGuard() {
  const message = useUnsavedChangesStore(unsavedChangesMessage);
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      currentLocation.pathname !== nextLocation.pathname &&
      unsavedChangesMessage(useUnsavedChangesStore.getState()) !== null,
  );
  const blocked = blocker.state === 'blocked';

  useEffect(() => {
    if (!blocked || message === null) return undefined;
    let asking = true;
    void confirmAction(leaveDialog(message)).then((leave) => {
      if (!asking) return;
      if (leave) blocker.proceed?.();
      else blocker.reset?.();
    });
    return () => {
      asking = false;
      answerConfirm(false);
    };
    // `blocker` cambia en cada render; lo que decide es si hay una navegación retenida.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocked, message]);

  // Ya no queda nada por guardar: la navegación retenida sigue su camino.
  useEffect(() => {
    if (blocked && message === null) blocker.proceed?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocked, message]);

  return null;
}
