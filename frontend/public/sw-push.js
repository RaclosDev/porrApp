// Recordatorios de predicción enviados por el servidor con Web Push.
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : '' };
  }
  const title = data.title || 'porrApp';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      icon: '/icon-paper-192.png',
      badge: '/icon-paper-192.png',
      tag: data.tag || 'porrapp',
      renotify: true,
      data: { url: data.url || '/jornadas' },
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
        return open.focus().then((client) => (client.navigate ? client.navigate(url) : client));
      }
      return self.clients.openWindow(url);
    }),
  );
});
