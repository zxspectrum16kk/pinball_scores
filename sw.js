const CACHE_NAME = 'pinball-scores-v22';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './machines.html',
    './custom_list.html',
    './overall.html',
    './player.html',
    './players.html',
    './machine.html',
    './styles.css',
    './main.js',
    './ui.js',
    './ui-heatmap.js',
    './data.js',
    './utils.js',
    './stats.js',
    './icon-192.png',
    './blog logo 300x200.png'
];

// Install event - cache files
self.addEventListener('install', (event) => {
    // Force new SW to activate immediately
    self.skipWaiting();

    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[Service Worker] Caching app shell');
                return cache.addAll(ASSETS_TO_CACHE);
            })
            .catch((err) => {
                console.error('[Service Worker] Cache install failed:', err);
            })
    );
});

// Fetch event - serve from cache if available, otherwise fetch from network
// Fetch event
self.addEventListener('fetch', (event) => {
    // For navigation requests (HTML pages), try network first, then cache
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request)
                .catch(() => {
                    return caches.match(event.request)
                        .then((response) => {
                            if (response) return response;
                            // Optional: Return a offline.html here if you had one
                            // return caches.match('./offline.html');
                        });
                })
        );
        return;
    }

    // For everything else (CSS, JS, Images), try cache first, then network
    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                if (response) {
                    return response;
                }
                return fetch(event.request);
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keyList) => {
            return Promise.all(keyList.map((key) => {
                if (key !== CACHE_NAME) {
                    return caches.delete(key);
                }
            }));
        }).then(() => {
            // Take control of all clients immediately
            return self.clients.claim();
        })
    );
});
