// Service Worker игры Rabik: офлайн-запуск после первого онлайн-визита.
// Версия кэша — одна строка: bump при каждой сборке с изменившимися ассетами.
const CACHE = 'rabik-v1'

const PRECACHE = [
    // @generated:precache:start
    './index.html',
    './index.js',
    './manifest.webmanifest',
    './icons/apple-touch-icon.png',
    './icons/icon-192.png',
    './icons/icon-512.png',
    './public/assets/sprites/rabbit.json',
    './public/assets/sprites/rabbit.png',
    './public/assets/sprites/tiles.jpg',
    './public/assets/sprites/tiles.json',
    './public/assets/ui/button/back.png',
    './public/assets/ui/button/credits.png',
    './public/assets/ui/button/play.png',
    './public/assets/ui/logo.png',
    './public/assets/ui/lvlsel/art.png',
    './public/assets/ui/lvlsel/done.png',
    './public/assets/ui/lvlsel/none.png',
    './public/assets/ui/modal/fail.png',
    './public/assets/ui/modal/menu.png',
    './public/assets/ui/modal/win.png',
    './public/data/levels/001.json',
    './public/data/levels/002.json',
    './public/data/levels/003.json',
    './public/data/levels/004.json',
    './public/data/levels/005.json',
    './public/data/levels/index.json',
    // @generated:precache:end
]

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches
            .open(CACHE)
            .then((cache) => cache.addAll(PRECACHE))
            .then(() => self.skipWaiting()),
    )
})

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches
            .keys()
            .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
            .then(() => self.clients.claim()),
    )
})

self.addEventListener('fetch', (event) => {
    const { request } = event
    if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return
    // Навигации без сети — на оболочку, а не в пустую страницу.
    if (request.mode === 'navigate') {
        event.respondWith(fetch(request).catch(() => caches.match('./index.html')))
        return
    }
    event.respondWith(
        caches.match(request).then(
            (cached) =>
                cached ??
                fetch(request).then((response) => {
                    if (response.ok) {
                        const copy = response.clone()
                        caches.open(CACHE).then((cache) => cache.put(request, copy))
                    }
                    return response
                }),
        ),
    )
})
