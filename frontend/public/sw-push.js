const RECEIPT_CACHE = 'porrapp-push-receipts-v1';
const RECEIPT_TOKEN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function sendReceipt(token) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch('/api/push/receipts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
      credentials: 'omit',
      redirect: 'error',
      signal: controller.signal,
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

async function rememberReceipt(token, expires) {
  const key = new URL('/__push-receipts/' + token, self.location.origin).href;
  let cache;
  try {
    cache = await caches.open(RECEIPT_CACHE);
    await cache.put(key, new Response(JSON.stringify({ token, expires })));
  } catch {
    // Un problema de almacenamiento no debe impedir confirmar el aviso que ya se ha procesado.
  }
  if (await sendReceipt(token)) {
    try {
      await cache?.delete(key);
    } catch {
      /* El próximo acuse es idempotente. */
    }
  }
}

async function flushReceipts() {
  try {
    const cache = await caches.open(RECEIPT_CACHE);
    const keys = await cache.keys();
    const pending = [];
    for (const [index, key] of keys.entries()) {
      const response = await cache.match(key);
      const receipt = await response?.json();
      if (!receipt || receipt.expires <= Date.now() || index < keys.length - 100) {
        await cache.delete(key);
      } else if (pending.length < 10 && RECEIPT_TOKEN.test(receipt.token)) {
        pending.push(sendReceipt(receipt.token).then((ok) => ok && cache.delete(key)));
      }
    }
    await Promise.all(pending);
  } catch {
    // Los acuses pendientes se vuelven a intentar al abrir la app o recibir otro push.
  }
}

self.addEventListener('message', (event) => {
  if (event.data?.type === 'porrapp:flush-push-receipts') event.waitUntil(flushReceipts());
});

// Avisos enviados por el servidor con Web Push.
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : '' };
  }
  const title = data.title || 'porrApp';
  const tracked = RECEIPT_TOKEN.test(data.receiptToken) && Number.isFinite(data.receiptExpiresAt);
  event.waitUntil(
    self.registration
      .showNotification(title, {
        body: data.body || '',
        icon: '/icon-paper-192.png',
        badge: '/icon-paper-192.png',
        // Un reenvío actualiza la misma tarjeta sin volver a sonar. También hay que mostrar una
        // notificación para los pushes repetidos: Safari exige que cada push sea visible.
        tag: tracked ? 'delivery-' + data.receiptToken : data.tag || 'porrapp',
        renotify: !tracked,
        data: { url: data.url || '/jornadas' },
      })
      .then(async () => {
        await flushReceipts();
        if (tracked)
          await rememberReceipt(
            data.receiptToken,
            Math.min(data.receiptExpiresAt, Date.now() + 2 * 86400000),
          );
      }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || '/', self.location.origin);
  // Solo se abren rutas de la propia app.
  const url = target.origin === self.location.origin ? target.href : self.location.origin;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const open = windows.find((client) => client.url.startsWith(self.location.origin));
      if (open) {
        // navigate() no existe en iOS y falla en ventanas que el SW no controla; ahí openWindow solo
        // trae la app al frente sin cambiar de pantalla. Entonces navega la propia app (PushNavigation).
        const path = target.origin === self.location.origin ? target.pathname + target.search : '/';
        const tellApp = () => open.postMessage({ type: 'porrapp:navigate', url: path });
        return open
          .focus()
          .catch(() => open)
          .then((client) => (client.navigate ? client.navigate(url) : Promise.reject()))
          .then((client) => client || tellApp())
          .catch(tellApp);
      }
      return self.clients.openWindow(url);
    }),
  );
});
