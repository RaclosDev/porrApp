import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

/** Mensaje que manda sw-push.js al pulsar un aviso con la app ya abierta. */
export const PUSH_NAVIGATE = 'porrapp:navigate';

/**
 * Lleva a la pantalla del aviso pulsado cuando la app ya estaba abierta. En iPhone el service worker
 * no puede cambiar de pantalla (no hay `navigate()` y `openWindow` solo trae la app al frente), así
 * que le pasa la ruta y la app navega por su cuenta.
 */
export default function PushNavigation() {
  const navigate = useNavigate();
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const onMessage = (event: MessageEvent) => {
      const data: unknown = event.data;
      if (!data || typeof data !== 'object') return;
      const { type, url } = data as { type?: unknown; url?: unknown };
      // Solo rutas de la propia app.
      if (type !== PUSH_NAVIGATE || typeof url !== 'string') return;
      if (!url.startsWith('/') || url.startsWith('//')) return;
      navigate(url);
    };
    const worker = navigator.serviceWorker;
    const flushReceipts = () => {
      if (document.visibilityState !== 'hidden') {
        worker.controller?.postMessage({ type: 'porrapp:flush-push-receipts' });
      }
    };
    worker.addEventListener('message', onMessage);
    worker.addEventListener('controllerchange', flushReceipts);
    window.addEventListener('online', flushReceipts);
    document.addEventListener('visibilitychange', flushReceipts);
    flushReceipts();
    return () => {
      worker.removeEventListener('message', onMessage);
      worker.removeEventListener('controllerchange', flushReceipts);
      window.removeEventListener('online', flushReceipts);
      document.removeEventListener('visibilitychange', flushReceipts);
    };
  }, [navigate]);
  return null;
}
