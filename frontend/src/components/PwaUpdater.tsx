import { useEffect, useRef } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

const UPDATE_CHECK_INTERVAL_MS = 60 * 1000;

/**
 * Keeps an installed PWA up to date while it remains open.
 *
 * Browsers can suspend background tabs/apps, so also check as soon as the
 * document becomes visible again. The service worker script is requested
 * without cache before asking the registration to perform its update check.
 */
export default function PwaUpdater() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    immediate: true,
    onRegisteredSW(swUrl, registration) {
      if (!registration) return;

      const checkForUpdate = async () => {
        if (!navigator.onLine || registration.installing) return;

        try {
          // Avoid a stale HTTP-cache response hiding a newly deployed worker.
          const response = await fetch(swUrl, {
            cache: 'no-store',
            headers: {
              cache: 'no-store',
              'cache-control': 'no-cache',
            },
          });

          if (response.ok) {
            await registration.update();
          }
        } catch {
          // Offline/transient network failures must not interrupt the app.
        }
      };

      void checkForUpdate();

      // Keep checking while the PWA stays open; browsers may throttle this
      // timer in the background, so visibility/focus handlers below are vital.
      const intervalId = window.setInterval(
        () => void checkForUpdate(),
        UPDATE_CHECK_INTERVAL_MS,
      );

      // Store the timer on the registration so a repeated registration does
      // not leave multiple polling loops running.
      const previousInterval = (registration as ServiceWorkerRegistration & {
        __porrAppUpdateInterval?: number;
      }).__porrAppUpdateInterval;
      if (previousInterval !== undefined) {
        window.clearInterval(previousInterval);
      }
      (registration as ServiceWorkerRegistration & {
        __porrAppUpdateInterval?: number;
      }).__porrAppUpdateInterval = intervalId;
    },
    onRegisterError(error) {
      console.error('No se pudo registrar el Service Worker de PorrApp:', error);
    },
  });

  const updateInProgress = useRef(false);

  useEffect(() => {
    const checkWhenActive = () => {
      if (document.visibilityState !== 'visible' || !('serviceWorker' in navigator)) {
        return;
      }

      navigator.serviceWorker.ready
        .then((registration) => registration.update())
        .catch(() => {
          // A failed check is harmless; the next foreground/interval check retries.
        });
    };

    // visibilitychange is dispatched on document, not window.
    document.addEventListener('visibilitychange', checkWhenActive);
    window.addEventListener('focus', checkWhenActive);
    window.addEventListener('pageshow', checkWhenActive);

    return () => {
      document.removeEventListener('visibilitychange', checkWhenActive);
      window.removeEventListener('focus', checkWhenActive);
      window.removeEventListener('pageshow', checkWhenActive);
    };
  }, []);

  useEffect(() => {
    if (!needRefresh || updateInProgress.current) return;

    updateInProgress.current = true;
    void updateServiceWorker(true).catch((error: unknown) => {
      updateInProgress.current = false;
      console.error('No se pudo aplicar la actualización de PorrApp:', error);
    });
  }, [needRefresh, updateServiceWorker]);

  useEffect(() => {
    let refreshing = false;

    const onControllerChange = () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    };

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
    }

    return () => {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
      }
    };
  }, []);

  return null;
}
