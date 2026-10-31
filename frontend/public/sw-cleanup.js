// Earlier workers stored authenticated API responses in a cache shared by every account.
self.addEventListener('activate', (event) => {
  event.waitUntil(caches.delete('api-runtime-cache'));
});
