// PorrApp se ha mudado a https://porrapp.app.
// Este service worker sustituye al de la aplicación que funcionaba en este dominio: borra lo que
// guardaba, se da de baja y recarga las pestañas abiertas para que muestren la página de mudanza.
self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
      await self.registration.unregister();
      const windows = await self.clients.matchAll({ type: 'window' });
      await Promise.all(windows.map((client) => client.navigate(client.url)));
    })(),
  );
});
