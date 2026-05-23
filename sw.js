const CACHE_NAME = 'cue-v1'
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/login.html',
  '/inscription.html',
  '/css/responsive.css'
]

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  )
})

self.addEventListener('fetch', e => {
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  )
})
