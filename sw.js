// Offline support. Network first, so new builds show up straight away; cache is the fallback.
// Push notifications get added here in a later pass.
const CACHE = 'arise-v8';
const SHELL = ['./', './index.html', './app.js', './account.js', './manifest.webmanifest', './icon.svg', './icon-192.png', './icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        // Only good responses replace the cache. If the site is gone or broken (404, 500),
        // the last working copy keeps running, so data on the phone is never cut off.
        if (!res.ok) return caches.match(e.request).then((hit) => hit || res);
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
