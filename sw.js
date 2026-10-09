// Service Worker игры Rabik: офлайн-запуск после первого онлайн-визита.
// Версия кэша — одна строка: bump при каждой сборке с изменившимися ассетами.
const CACHE = 'rabik-v3'

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
    './public/data/levels/006.json',
    './public/data/levels/007.json',
    './public/data/levels/008.json',
    './public/data/levels/009.json',
    './public/data/levels/010.json',
    './public/data/levels/011.json',
    './public/data/levels/012.json',
    './public/data/levels/013.json',
    './public/data/levels/014.json',
    './public/data/levels/015.json',
    './public/data/levels/016.json',
    './public/data/levels/017.json',
    './public/data/levels/018.json',
    './public/data/levels/019.json',
    './public/data/levels/020.json',
    './public/data/levels/021.json',
    './public/data/levels/022.json',
    './public/data/levels/023.json',
    './public/data/levels/024.json',
    './public/data/levels/025.json',
    './public/data/levels/026.json',
    './public/data/levels/027.json',
    './public/data/levels/028.json',
    './public/data/levels/029.json',
    './public/data/levels/030.json',
    './public/data/levels/031.json',
    './public/data/levels/032.json',
    './public/data/levels/033.json',
    './public/data/levels/034.json',
    './public/data/levels/035.json',
    './public/data/levels/036.json',
    './public/data/levels/037.json',
    './public/data/levels/038.json',
    './public/data/levels/039.json',
    './public/data/levels/040.json',
    './public/data/levels/041.json',
    './public/data/levels/042.json',
    './public/data/levels/043.json',
    './public/data/levels/044.json',
    './public/data/levels/045.json',
    './public/data/levels/046.json',
    './public/data/levels/047.json',
    './public/data/levels/048.json',
    './public/data/levels/049.json',
    './public/data/levels/050.json',
    './public/data/levels/051.json',
    './public/data/levels/052.json',
    './public/data/levels/053.json',
    './public/data/levels/054.json',
    './public/data/levels/055.json',
    './public/data/levels/056.json',
    './public/data/levels/057.json',
    './public/data/levels/058.json',
    './public/data/levels/059.json',
    './public/data/levels/060.json',
    './public/data/levels/061.json',
    './public/data/levels/062.json',
    './public/data/levels/063.json',
    './public/data/levels/064.json',
    './public/data/levels/065.json',
    './public/data/levels/066.json',
    './public/data/levels/067.json',
    './public/data/levels/068.json',
    './public/data/levels/069.json',
    './public/data/levels/070.json',
    './public/data/levels/071.json',
    './public/data/levels/072.json',
    './public/data/levels/073.json',
    './public/data/levels/074.json',
    './public/data/levels/075.json',
    './public/data/levels/076.json',
    './public/data/levels/077.json',
    './public/data/levels/078.json',
    './public/data/levels/079.json',
    './public/data/levels/080.json',
    './public/data/levels/081.json',
    './public/data/levels/082.json',
    './public/data/levels/083.json',
    './public/data/levels/084.json',
    './public/data/levels/085.json',
    './public/data/levels/086.json',
    './public/data/levels/087.json',
    './public/data/levels/088.json',
    './public/data/levels/089.json',
    './public/data/levels/090.json',
    './public/data/levels/091.json',
    './public/data/levels/092.json',
    './public/data/levels/093.json',
    './public/data/levels/094.json',
    './public/data/levels/095.json',
    './public/data/levels/096.json',
    './public/data/levels/097.json',
    './public/data/levels/098.json',
    './public/data/levels/099.json',
    './public/data/levels/100.json',
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
