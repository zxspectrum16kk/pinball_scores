const CACHE_NAME = 'pinball-scores-v27';
const DATA_CACHE_NAME = 'pinball-data-v2';

const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './machines.html',
    './custom_list.html',
    './overall.html',
    './player.html',
    './players.html',
    './machine.html',
    './offline.html',
    './privacy.html',
    './admin.html',
    './styles.css',
    './main.js',
    './ui.js',
    './ui-machines.js',
    './ui-leaderboard.js',
    './ui-machine-detail.js',
    './ui-custom-list.js',
    './ui-player-profile.js',
    './ui-players.js',
    './ui-heatmap.js',
    './data.js',
    './utils.js',
    './stats.js',
    './admin.js',
    './offline-indicator.js',
    './update-notification.js',
    './register-sw.js',
    './icon-192.png',
    './blog logo 300x200.png',
    './manifest.json',
    './data/players.json'
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

// Fetch event - intelligent caching strategy
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Strategy 1a: players.json - Network first (must always be fresh for lastUpdated date)
    if (url.pathname.endsWith('/data/players.json')) {
        event.respondWith(
            fetch(event.request)
                .then((networkResponse) => {
                    if (networkResponse && networkResponse.status === 200) {
                        caches.open(DATA_CACHE_NAME).then((cache) => {
                            cache.put(event.request, networkResponse.clone());
                        });
                    }
                    return networkResponse;
                })
                .catch(() => {
                    return caches.match(event.request);
                })
        );
        return;
    }

    // Strategy 1b: Other data files - Stale-While-Revalidate
    // Serve cached data immediately, then update cache in background
    if (url.pathname.startsWith('/data/') && url.pathname.endsWith('.json')) {
        event.respondWith(
            caches.open(DATA_CACHE_NAME).then((cache) => {
                return cache.match(event.request).then((cachedResponse) => {
                    const fetchPromise = fetch(event.request)
                        .then((networkResponse) => {
                            // Update cache with fresh data
                            if (networkResponse && networkResponse.status === 200) {
                                cache.put(event.request, networkResponse.clone());
                            }
                            return networkResponse;
                        })
                        .catch(() => {
                            // Network failed, return cached version
                            console.log('[Service Worker] Network failed for', url.pathname, '- using cache');
                            return cachedResponse;
                        });

                    // Return cached data immediately if available, otherwise wait for network
                    return cachedResponse || fetchPromise;
                });
            })
        );
        return;
    }

    // Strategy 2: Navigation - Network first with offline fallback
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request)
                .catch(() => {
                    return caches.match(event.request)
                        .then((response) => {
                            // If page is cached, return it
                            if (response) return response;
                            // Otherwise show offline page
                            return caches.match('./offline.html');
                        });
                })
        );
        return;
    }

    // Strategy 3: Static assets - Cache first
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
    const cacheWhitelist = [CACHE_NAME, DATA_CACHE_NAME];

    event.waitUntil(
        caches.keys().then((keyList) => {
            return Promise.all(keyList.map((key) => {
                if (!cacheWhitelist.includes(key)) {
                    console.log('[Service Worker] Deleting old cache:', key);
                    return caches.delete(key);
                }
            }));
        }).then(() => {
            // Take control of all clients immediately
            return self.clients.claim();
        })
    );
});
