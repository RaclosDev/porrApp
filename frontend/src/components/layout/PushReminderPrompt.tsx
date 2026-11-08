import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { fetchPushConfig } from '../../services/api';
import {
  enablePush,
  needsIosInstall,
  notificationPermission,
  syncPushSubscription,
} from '../../services/push';
import { errorMessage } from '../../utils/errors';

const DISMISSED_KEY = 'push_prompt_dismissed_at';
/** Tras «Ahora no», se vuelve a ofrecer pasada una semana. */
const DISMISS_FOR_MS = 7 * 24 * 60 * 60 * 1000;

export const PUSH_CONFIG_QUERY_KEY = ['push-config'] as const;

function recentlyDismissed(): boolean {
  const at = Number(localStorage.getItem(DISMISSED_KEY));
  return Number.isFinite(at) && at > 0 && Date.now() - at < DISMISS_FOR_MS;
}

/**
 * Recordatorios de predicción: los avisos vienen activados en la cuenta, pero el navegador exige
 * que el usuario dé permiso. Este aviso lo pide y, con el permiso ya dado, mantiene registrado el
 * dispositivo sin preguntar nada.
 */
export default function PushReminderPrompt({ canPrompt }: { canPrompt: boolean }) {
  const { data: config } = useQuery({
    queryKey: PUSH_CONFIG_QUERY_KEY,
    queryFn: fetchPushConfig,
    staleTime: Infinity,
    retry: false,
  });
  const [dismissed, setDismissed] = useState(recentlyDismissed);
  const [busy, setBusy] = useState(false);
  const synced = useRef(false);

  const publicKey = config?.publicKey ?? null;
  const enabled = Boolean(
    publicKey &&
    (config?.remindersEnabled || config?.memberJoinedEnabled || config?.matchdayFinishedEnabled),
  );
  const permission = notificationPermission();

  useEffect(() => {
    if (!enabled || !publicKey || permission !== 'granted' || synced.current) return;
    synced.current = true;
    syncPushSubscription(publicKey).catch(() => {
      synced.current = false;
    });
  }, [enabled, publicKey, permission]);

  if (!canPrompt || !enabled || !publicKey || dismissed) return null;
  // Sin soporte (p. ej. Safari de iOS fuera de la app instalada) el aviso de instalación ya lo explica.
  if (permission !== 'default' || needsIosInstall()) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISSED_KEY, String(Date.now()));
    setDismissed(true);
  };

  const activate = async () => {
    setBusy(true);
    try {
      const ok = await enablePush(publicKey);
      if (ok)
        toast.success(
          'Avisos activados: te avisaremos una hora antes de que cierre cada partido sin tu predicción.',
        );
      else toast('Sin permiso no podemos avisarte. Puedes darlo en los ajustes del navegador.');
      setDismissed(true);
    } catch (err) {
      toast.error(errorMessage(err, 'No se pudieron activar los avisos'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="region"
      aria-label="Avisos de predicción"
      className="paper-panel album-sheet landing-tape fixed bottom-[calc(90px_+_env(safe-area-inset-bottom,_0px))] md:bottom-5 left-1/2 z-[999998] flex w-[90%] max-w-[350px] -translate-x-1/2 flex-col items-center gap-2.5 rounded-[4px] border border-[var(--ink)] px-5 py-[15px] shadow-[4px_4px_0_rgba(0,0,0,0.2)]"
    >
      <p className="m-0 text-center font-bold text-main">
        Que no se te escape ninguna predicción: te avisamos una hora antes de que cierre cada
        partido.
      </p>
      <div className="mt-[5px] flex gap-2.5">
        <button
          type="button"
          onClick={activate}
          disabled={busy}
          className="glass-btn primary-btn px-[15px] py-2 font-bold text-main"
        >
          Activar avisos
        </button>
        <button
          type="button"
          onClick={dismiss}
          disabled={busy}
          className="glass-btn px-[15px] py-2"
        >
          Ahora no
        </button>
      </div>
    </div>
  );
}
