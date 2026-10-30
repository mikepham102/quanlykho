const CACHE = 'moc-inventory-shell-v35';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon.svg', './icon-192.png', './icon-512.png', './apple-touch-icon.png', './supabase-config.js'];
const BRAND_MANIFEST_KEY = new URL('__brand_manifest__.json', self.registration.scope);

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', event => {
  if (event.data?.type !== 'SET_BRAND_MANIFEST' || !event.data.manifest) return;
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.put(
        BRAND_MANIFEST_KEY,
        new Response(JSON.stringify(event.data.manifest), {
          headers: {
            'Content-Type': 'application/manifest+json; charset=utf-8',
            'Cache-Control': 'no-store'
          }
        })
      ))
      .then(() => event.ports[0]?.postMessage({ saved: true }))
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const requestUrl = new URL(event.request.url);

  if (requestUrl.origin === location.origin && requestUrl.pathname.endsWith('/manifest.webmanifest')) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const brandManifest = await cache.match(BRAND_MANIFEST_KEY);
      if (brandManifest) return brandManifest;
      try {
        const response = await fetch(event.request);
        if (response.ok) await cache.put(event.request, response.clone());
        return response;
      } catch {
        return await cache.match(event.request) || await cache.match('./manifest.webmanifest');
      }
    })());
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response.ok && requestUrl.origin === location.origin) {
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() => caches.match(event.request).then(cached => cached || caches.match('./index.html')))
  );
});
