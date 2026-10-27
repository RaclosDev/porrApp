import { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

/**
 * Este componente es invisible.
 * Se encarga de conectarse al Service Worker de la PWA.
 * Cuando se detecta que hay una nueva versión de la aplicación descargada,
 * fuerza automáticamente una recarga para que el usuario deje de ver
 * la versión antigua (anclada en el pasado).
 */
export default function PwaUpdater() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      console.log('SW Registered. Will check for updates.');
      if (r) {
        // Comprobar si hay nueva versión cada 15 minutos en background
        setInterval(
          () => {
            r.update().catch(() => {});
          },
          15 * 60 * 1000,
        );
      }
    },
    onRegisterError(error) {
      console.log('SW registration error', error);
    },
  });

  // Comprobar actualización automáticamente al volver a abrir/enfocar la app en el móvil
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && 'serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then((r) => r.update()).catch(() => {});
      }
    };
    window.addEventListener('visibilitychange', handleVisibilityChange);
    return () => window.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // Si hay actualización pendiente, forzar su activación
  useEffect(() => {
    if (needRefresh) {
      console.log('Nueva versión detectada. Forzando actualización de la PWA...');
      updateServiceWorker(true);
    }
  }, [needRefresh, updateServiceWorker]);

  // Cuando el nuevo Service Worker toma el control de la página, recargar inmediatamente
  useEffect(() => {
    let refreshing = false;
    const onControllerChange = () => {
      if (!refreshing) {
        refreshing = true;
        console.log('Nuevo Service Worker activo. Recargando aplicación...');
        window.location.reload();
      }
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

  return null; // Componente invisible
}
