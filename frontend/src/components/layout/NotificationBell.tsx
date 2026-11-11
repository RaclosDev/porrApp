import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, BellOff, BellPlus } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  fetchPushConfig,
  fetchRecentPushNotifications,
  setPushPreferences,
  type PushConfig,
} from '../../services/api';
import { bellAction, enablePush } from '../../services/push';
import { queryKeys } from '../../services/queryKeys';
import { errorMessage } from '../../utils/errors';
import { PUSH_CONFIG_QUERY_KEY } from './PushReminderPrompt';
import InstallGuide from './InstallGuide';

const LABELS = {
  recent: 'Últimos avisos',
  enable: 'Activar avisos',
  'install-first': 'Activar avisos',
  blocked: 'Avisos bloqueados',
} as const;

const relativeTime = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });

function timeAgo(iso: string): string {
  const minutes = Math.round((new Date(iso).getTime() - Date.now()) / 60_000);
  if (Math.abs(minutes) < 60) return relativeTime.format(minutes, 'minute');
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return relativeTime.format(hours, 'hour');
  return relativeTime.format(Math.round(hours / 24), 'day');
}

/** Solo rutas de la propia app: el enlace lo genera el servidor, pero nunca se sigue hacia fuera. */
const isAppPath = (url: string | null): url is string =>
  Boolean(url && url.startsWith('/') && !url.startsWith('//'));

/**
 * Campana de la cabecera. Sin avisos activados en este dispositivo, pulsarla los activa (en iPhone,
 * antes explica cómo instalar la app); con ellos activados, muestra los 3 últimos que le llegaron.
 */
export default function NotificationBell({ onOpenSettings }: { onOpenSettings: () => void }) {
  const queryClient = useQueryClient();
  const { data: config } = useQuery({
    queryKey: PUSH_CONFIG_QUERY_KEY,
    queryFn: fetchPushConfig,
    staleTime: 60_000,
    retry: 2,
  });
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showIosSteps, setShowIosSteps] = useState(false);
  // El permiso del navegador no avisa cuando cambia: se vuelve a leer tras pedirlo.
  const [, setPermissionVersion] = useState(0);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  const recent = useQuery({
    queryKey: queryKeys.recentPushNotifications(),
    queryFn: fetchRecentPushNotifications,
    enabled: open,
    staleTime: 0,
  });

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!panelRef.current?.contains(target) && !buttonRef.current?.contains(target)) {
        setOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  const publicKey = config?.publicKey;
  if (!config || !publicKey) return null;
  const accountEnabled =
    config.remindersEnabled || config.memberJoinedEnabled || config.matchdayFinishedEnabled;
  const action = bellAction(accountEnabled);
  if (!action) return null;

  const activate = async () => {
    setBusy(true);
    try {
      const granted = await enablePush(publicKey);
      setPermissionVersion((version) => version + 1);
      if (!granted) {
        toast('Sin permiso no podemos avisarte. Puedes darlo en los ajustes del navegador.');
        return;
      }
      if (!accountEnabled) {
        const all = {
          remindersEnabled: true,
          memberJoinedEnabled: true,
          matchdayFinishedEnabled: true,
        };
        await setPushPreferences(all);
        queryClient.setQueryData<PushConfig>(PUSH_CONFIG_QUERY_KEY, { ...config, ...all });
      }
      toast.success(
        'Avisos activados: te avisaremos una hora antes de que cierre cada partido sin tu predicción.',
      );
    } catch (err) {
      toast.error(errorMessage(err, 'No se pudieron activar los avisos'));
    } finally {
      setBusy(false);
    }
  };

  const handleClick = () => {
    if (action === 'recent') setOpen((value) => !value);
    else if (action === 'install-first') setShowIosSteps(true);
    else if (action === 'blocked')
      toast('Las notificaciones están bloqueadas en este navegador: actívalas en sus ajustes.');
    else void activate();
  };

  const Icon = action === 'recent' ? Bell : action === 'blocked' ? BellOff : BellPlus;

  return (
    <>
      <button
        ref={buttonRef}
        id="btn-notifications"
        type="button"
        onClick={handleClick}
        disabled={busy}
        className="glass-btn header-icon-btn"
        title={LABELS[action]}
        aria-label={LABELS[action]}
        aria-haspopup={action === 'recent' || action === 'install-first' ? 'dialog' : undefined}
        aria-expanded={action === 'recent' ? open : undefined}
        aria-controls={action === 'recent' && open ? panelId : undefined}
      >
        <Icon size={20} aria-hidden="true" />
      </button>

      {open && action === 'recent' && (
        <div
          ref={panelRef}
          id={panelId}
          role="dialog"
          aria-labelledby={`${panelId}-title`}
          className="paper-panel album-sheet absolute top-full right-0 z-[100] mt-2.5 flex w-[min(320px,calc(100vw-24px))] flex-col gap-2.5 p-3"
        >
          <h2 id={`${panelId}-title`} className="m-0 text-[0.95rem] font-bold text-main">
            Últimos avisos
          </h2>
          {recent.isPending ? (
            <p className="m-0 text-[0.85rem] text-muted">Cargando…</p>
          ) : recent.isError ? (
            <p className="m-0 text-[0.85rem] text-muted">No se pudieron cargar los avisos.</p>
          ) : recent.data.length === 0 ? (
            <p className="m-0 text-[0.85rem] text-muted">
              Aún no te ha llegado ningún aviso. Te avisaremos una hora antes de que cierre un
              partido sin tu predicción.
            </p>
          ) : (
            <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
              {recent.data.map((notification) => {
                const content = (
                  <>
                    <span className="block text-[0.88rem] font-bold text-main">
                      {notification.title}
                    </span>
                    <span className="block text-[0.82rem] text-muted">{notification.body}</span>
                    <time
                      dateTime={notification.sentAt}
                      className="block text-[0.75rem] text-muted"
                    >
                      {timeAgo(notification.sentAt)}
                    </time>
                  </>
                );
                return (
                  <li key={`${notification.sentAt}-${notification.title}`}>
                    {isAppPath(notification.url) ? (
                      <Link
                        to={notification.url}
                        onClick={() => setOpen(false)}
                        className="block rounded-[8px] border border-line px-2.5 py-2 no-underline hover:bg-[rgba(0,0,0,0.05)]"
                      >
                        {content}
                      </Link>
                    ) : (
                      <div className="rounded-[8px] border border-line px-2.5 py-2">{content}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onOpenSettings();
            }}
            className="glass-btn w-full rounded-[8px] px-3 py-2 text-[0.85rem] font-bold"
          >
            Ajustes de avisos
          </button>
        </div>
      )}

      {showIosSteps && (
        <InstallGuide
          onClose={() => setShowIosSteps(false)}
          reason="En iPhone y iPad los avisos solo llegan con porrApp instalada. Instálala, ábrela desde su icono y pulsa la campana para activarlos."
        />
      )}
    </>
  );
}
