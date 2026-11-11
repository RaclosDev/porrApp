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
import {
  pushPromptDue,
  rememberPushPrompt,
  reportPushDeviceState,
} from '../../services/pushPrompt';

export const PUSH_CONFIG_QUERY_KEY = ['push-config'] as const;

/**
 * Recordatorios de predicción: los avisos vienen activados en la cuenta, pero el navegador exige
 * que el usuario dé permiso. Este aviso lo pide y, con el permiso ya dado, mantiene registrado el
 * dispositivo sin preguntar nada.
 */
export default function PushReminderPrompt({
  canPrompt,
  userId,
  onVisibilityChange,
}: {
  canPrompt: boolean;
  userId: string;
  onVisibilityChange?: (visible: boolean) => void;
}) {
  const { data: config } = useQuery({
    queryKey: PUSH_CONFIG_QUERY_KEY,
    queryFn: fetchPushConfig,
    staleTime: 60_000,
    retry: 2,
  });
  const [dismissed, setDismissed] = useState(() => !pushPromptDue(userId));
  const [busy, setBusy] = useState(false);
  const [permission, setPermission] = useState(notificationPermission);
  const recorded = useRef(false);

  const publicKey = config?.publicKey ?? null;
  const enabled = Boolean(
    publicKey &&
    (config?.remindersEnabled || config?.memberJoinedEnabled || config?.matchdayFinishedEnabled),
  );
  const installRequired = needsIosInstall();
  const visible = Boolean(
    canPrompt &&
    publicKey &&
    !dismissed &&
    (installRequired || permission === 'default' || permission === 'denied'),
  );

  useEffect(() => {
    onVisibilityChange?.(visible);
    return () => onVisibilityChange?.(false);
  }, [visible, onVisibilityChange]);

  useEffect(() => {
    if (!visible || recorded.current) return;
    recorded.current = true;
    rememberPushPrompt(userId);
    void reportPushDeviceState(true).catch(() => {});
  }, [visible, userId]);

  useEffect(() => {
    let lastReport = 0;
    let lastPermission = '';
    const observe = () => {
      const current = notificationPermission();
      setPermission(current);
      if (document.visibilityState === 'hidden' || !navigator.onLine) return;
      if (lastPermission === current && Date.now() - lastReport < 300_000) return;
      lastReport = Date.now();
      lastPermission = current;
      void reportPushDeviceState().catch(() => {
        lastPermission = '';
      });
    };
    observe();
    window.addEventListener('focus', observe);
    window.addEventListener('online', observe);
    document.addEventListener('visibilitychange', observe);
    return () => {
      window.removeEventListener('focus', observe);
      window.removeEventListener('online', observe);
      document.removeEventListener('visibilitychange', observe);
    };
  }, []);
  useEffect(() => {
    if (!enabled || !publicKey) return;
    let disposed = false;
    let inFlight = false;
    let lastSuccess: number | null = null;
    let retryDelay = 30_000;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    const sync = async () => {
      const currentPermission = notificationPermission();
      setPermission(currentPermission);
      if (
        disposed ||
        inFlight ||
        document.visibilityState === 'hidden' ||
        !navigator.onLine ||
        needsIosInstall() ||
        currentPermission !== 'granted' ||
        (lastSuccess !== null && Date.now() - lastSuccess < 300_000)
      )
        return;

      clearTimeout(retryTimer);
      inFlight = true;
      try {
        await syncPushSubscription(publicKey);
        lastSuccess = Date.now();
        retryDelay = 30_000;
      } catch {
        // Una caída de red no debe dejar el dispositivo sin registrar toda la sesión.
        if (!disposed) {
          retryTimer = setTimeout(() => void sync(), retryDelay);
          retryDelay = Math.min(retryDelay * 2, 300_000);
        }
      } finally {
        inFlight = false;
      }
    };
    const resume = () => void sync();
    resume();
    window.addEventListener('online', resume);
    window.addEventListener('focus', resume);
    document.addEventListener('visibilitychange', resume);
    return () => {
      disposed = true;
      clearTimeout(retryTimer);
      window.removeEventListener('online', resume);
      window.removeEventListener('focus', resume);
      document.removeEventListener('visibilitychange', resume);
    };
  }, [enabled, publicKey]);

  if (!visible || !publicKey) return null;

  const dismiss = () => {
    setDismissed(true);
  };

  const activate = async () => {
    setBusy(true);
    try {
      const ok = await enablePush(publicKey);
      setPermission(notificationPermission());
      if (ok)
        toast.success('Permiso activado. Puedes elegir qué avisos recibir en Cuenta → Avisos.');
      else toast('Sin permiso no podemos avisarte. Puedes darlo en los ajustes del navegador.');
      setDismissed(true);
    } catch (err) {
      toast.error(errorMessage(err, 'No se pudieron activar los avisos'));
    } finally {
      void reportPushDeviceState().catch(() => {});
      setBusy(false);
    }
  };

  return (
    <div
      role="region"
      aria-label="Notificaciones de PorrApp"
      className="paper-panel album-sheet landing-tape fixed bottom-[calc(90px_+_env(safe-area-inset-bottom,_0px))] md:bottom-5 left-1/2 z-[999998] flex w-[90%] max-w-[350px] -translate-x-1/2 flex-col items-center gap-2.5 rounded-[4px] border border-[var(--ink)] px-5 py-[15px] shadow-[4px_4px_0_rgba(0,0,0,0.2)]"
    >
      <p className="m-0 text-center font-bold text-main">
        {installRequired
          ? 'Recibe los avisos de PorrApp en tu iPhone o iPad'
          : permission === 'denied'
            ? 'Tienes las notificaciones bloqueadas en este dispositivo'
            : 'Activa las notificaciones de PorrApp'}
      </p>
      <p className="m-0 text-center text-sm text-main">
        {installRequired
          ? 'Abre PorrApp en Safari, pulsa Compartir → Añadir a pantalla de inicio y abre la app desde su icono para activar los avisos.'
          : permission === 'denied'
            ? 'Permite las notificaciones en los ajustes del navegador o, si usas la app instalada en iPhone, en Ajustes → Notificaciones → PorrApp. Al volver comprobaremos el permiso.'
            : 'Podremos avisarte de nuevos miembros, resultados y predicciones pendientes. Tú eliges qué recibir en Cuenta → Avisos.'}
      </p>
      <div className="mt-[5px] flex gap-2.5">
        {!installRequired && permission === 'default' && (
          <button
            type="button"
            onClick={activate}
            disabled={busy}
            className="glass-btn primary-btn px-[15px] py-2 font-bold text-main"
          >
            Activar avisos
          </button>
        )}
        <button
          type="button"
          onClick={dismiss}
          disabled={busy}
          className="glass-btn px-[15px] py-2"
        >
          Recordármelo en una semana
        </button>
      </div>
    </div>
  );
}
