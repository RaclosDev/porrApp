import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { fetchPushConfig, setPushPreferences, type PushConfig } from '../services/api';
import { enablePush, needsIosInstall, notificationPermission } from '../services/push';
import { PUSH_CONFIG_QUERY_KEY } from './layout/PushReminderPrompt';
import { errorMessage } from '../utils/errors';

/** Preferencia de recordatorios: una hora antes del cierre de cada partido sin predicción. */
export default function ReminderSettings() {
  const queryClient = useQueryClient();
  const { data: config } = useQuery({
    queryKey: PUSH_CONFIG_QUERY_KEY,
    queryFn: fetchPushConfig,
    staleTime: Infinity,
    retry: false,
  });
  const [saving, setSaving] = useState(false);
  if (!config?.publicKey) return null;
  const publicKey = config.publicKey;

  const permission = notificationPermission();
  const hint = needsIosInstall()
    ? 'En iPhone y iPad llegan solo con porrApp añadida a la pantalla de inicio.'
    : permission === 'denied'
      ? 'Las notificaciones están bloqueadas en este navegador: actívalas en sus ajustes.'
      : permission === 'unsupported'
        ? 'Este navegador no admite notificaciones.'
        : 'Te avisamos una hora antes de que cierre un partido que aún no has predicho.';

  const toggle = async (enabled: boolean) => {
    setSaving(true);
    try {
      await setPushPreferences(enabled);
      queryClient.setQueryData<PushConfig>(PUSH_CONFIG_QUERY_KEY, {
        ...config,
        remindersEnabled: enabled,
      });
      if (enabled && permission === 'default') await enablePush(publicKey);
    } catch (err) {
      toast.error(errorMessage(err, 'No se pudo guardar la preferencia'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="flex flex-col gap-2">
      <label className="flex items-center gap-2.5 cursor-pointer">
        <input
          type="checkbox"
          className="w-5 h-5 accent-[var(--ink)]"
          checked={config.remindersEnabled}
          disabled={saving}
          onChange={(event) => void toggle(event.target.checked)}
        />
        <span className="text-[0.9rem] font-bold text-main">
          Recordarme las predicciones pendientes
        </span>
      </label>
      <span className="text-[0.74rem] text-muted">{hint}</span>
    </section>
  );
}
