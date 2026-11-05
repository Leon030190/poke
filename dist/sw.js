const VERSION = 'pokecatch-pwa-v1';
const CORE = VERSION + '-core';
const RUNTIME = VERSION + '-runtime';
const CORE_FILES = [
  './', './index.html', './manifest.webmanifest', './pwa-icon.svg',
  './boot.local.js', './bundle/app.46311d7f13.css',
  './bundle/vendor-supabase.8596965fe9.js', './bundle/app.224d481e7b.js',
  './css/borderless_sprites.css', './js/canvas_sprite_engine.js',
  './data/forms.json', './packs.json', './favicon.ico'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CORE).then(cache => cache.addAll(CORE_FILES)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(key => ![CORE, RUNTIME].includes(key)).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== location.origin) return;
  const request = event.request;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then(response => {
      const copy = response.clone();
      caches.open(CORE).then(cache => cache.put('./index.html', copy));
      return response;
    }).catch(() => caches.match('./index.html')));
    return;
  }
  event.respondWith(caches.match(request).then(cached => {
    const network = fetch(request).then(response => {
      if (response.ok) caches.open(RUNTIME).then(cache => cache.put(request, response.clone()));
      return response;
    });
    return cached || network.catch(() => new Response('', {status: 504, statusText: 'Offline'}));
  }));
});
