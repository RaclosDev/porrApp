import { useState, type ReactNode, type Ref } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  fetchPushConfig,
  setPushPreferences,
  type PushConfig,
  type PushPreferences,
} from '../services/api';
import { enablePush, needsIosInstall, notificationPermission } from '../services/push';
import { PUSH_CONFIG_QUERY_KEY } from './layout/PushReminderPrompt';
import { errorMessage } from '../utils/errors';

/**
 * Preferencias de avisos: recordatorio una hora antes del cierre de cada partido sin predicción,
 * aviso cuando alguien se une a una de tus ligas y aviso al terminar una jornada. La sección sale
 * siempre, para que «Avisos» del menú de cuenta tenga adónde llevar: sin claves de push en el
 * servidor, dice que no están disponibles.
 */
export default function ReminderSettings({ sectionRef }: { sectionRef?: Ref<HTMLElement> }) {
  const queryClient = useQueryClient();
  const { data: config, isPending } = useQuery({
    queryKey: PUSH_CONFIG_QUERY_KEY,
    queryFn: fetchPushConfig,
    staleTime: Infinity,
    retry: false,
  });
  const [saving, setSaving] = useState(false);
  const frame = (content: ReactNode) => (
    <section
      ref={sectionRef}
      tabIndex={-1}
      className="flex flex-col gap-2 outline-none"
      aria-labelledby="reminder-settings-title"
    >
      <h3 id="reminder-settings-title" className="m-0 text-[0.95rem] font-bold text-main">
        Avisos
      </h3>
      {content}
    </section>
  );
  if (isPending) return frame(null);
  if (!config?.publicKey) {
    return frame(
      <span className="text-[0.74rem] text-muted">
        Los avisos no están disponibles ahora mismo.
      </span>,
    );
  }
  const publicKey = config.publicKey;

  const permission = notificationPermission();
  const hint = needsIosInstall()
    ? 'En iPhone y iPad llegan solo con porrApp añadida a la pantalla de inicio.'
    : permission === 'denied'
      ? 'Las notificaciones están bloqueadas en este navegador: actívalas en sus ajustes.'
      : permission === 'unsupported'
        ? 'Este navegador no admite notificaciones.'
        : 'Te avisamos antes de que cierre un partido sin tu predicción, cuando alguien entra en tus ligas y cuando termina una jornada.';

  const toggle = async (key: keyof PushPreferences, enabled: boolean) => {
    setSaving(true);
    try {
      await setPushPreferences({ [key]: enabled });
      queryClient.setQueryData<PushConfig>(PUSH_CONFIG_QUERY_KEY, { ...config, [key]: enabled });
      if (enabled && permission === 'default') await enablePush(publicKey);
    } catch (err) {
      toast.error(errorMessage(err, 'No se pudo guardar la preferencia'));
    } finally {
      setSaving(false);
    }
  };

  return frame(
    <>
      <label className="flex items-center gap-2.5 cursor-pointer">
        <input
          type="checkbox"
          className="w-5 h-5 accent-[var(--ink)]"
          checked={config.remindersEnabled}
          disabled={saving}
          onChange={(event) => void toggle('remindersEnabled', event.target.checked)}
        />
        <span className="text-[0.9rem] font-bold text-main">
          Recordarme las predicciones pendientes
        </span>
      </label>
      <label className="flex items-center gap-2.5 cursor-pointer">
        <input
          type="checkbox"
          className="w-5 h-5 accent-[var(--ink)]"
          checked={config.memberJoinedEnabled}
          disabled={saving}
          onChange={(event) => void toggle('memberJoinedEnabled', event.target.checked)}
        />
        <span className="text-[0.9rem] font-bold text-main">
          Avisarme cuando alguien se una a mis ligas
        </span>
      </label>
      <label className="flex items-center gap-2.5 cursor-pointer">
        <input
          type="checkbox"
          className="w-5 h-5 accent-[var(--ink)]"
          checked={config.matchdayFinishedEnabled}
          disabled={saving}
          onChange={(event) => void toggle('matchdayFinishedEnabled', event.target.checked)}
        />
        <span className="text-[0.9rem] font-bold text-main">
          Avisarme cuando termine una jornada, con el ranking
        </span>
      </label>
      <span className="text-[0.74rem] text-muted">{hint}</span>
    </>,
  );
}
