/**
 * AVB Bandwidth Calculator - Service Worker
 * Provides offline support via Cache API
 */

const CACHE_NAME = 'avb-calc-v2026-2';

// Assets to cache for offline use
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/avbcalc.js',
    '/app.js',
    '/css/pico.min.css',
    '/css/app.css',
    '/manifest.webmanifest',
    '/JDKS-fav_48x48.ico',
    '/jdks.png'
];

// Install event - cache all assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Service Worker: Caching assets');
                return cache.addAll(ASSETS_TO_CACHE);
            })
            .then(() => {
                // Activate immediately without waiting
                return self.skipWaiting();
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames
                        .filter((name) => name !== CACHE_NAME)
                        .map((name) => {
                            console.log('Service Worker: Deleting old cache:', name);
                            return caches.delete(name);
                        })
                );
            })
            .then(() => {
                // Take control of all pages immediately
                return self.clients.claim();
            })
    );
});

// Fetch event - serve from cache, fall back to network
self.addEventListener('fetch', (event) => {
    // Only handle GET requests
    if (event.request.method !== 'GET') {
        return;
    }

    event.respondWith(
        caches.match(event.request)
            .then((cachedResponse) => {
                if (cachedResponse) {
                    // Return cached response
                    return cachedResponse;
                }

                // Not in cache - fetch from network
                return fetch(event.request)
                    .then((networkResponse) => {
                        // Don't cache non-successful responses
                        if (!networkResponse || networkResponse.status !== 200) {
                            return networkResponse;
                        }

                        // Clone the response (can only be consumed once)
                        const responseToCache = networkResponse.clone();

                        // Add to cache for future requests
                        caches.open(CACHE_NAME)
                            .then((cache) => {
                                cache.put(event.request, responseToCache);
                            });

                        return networkResponse;
                    })
                    .catch(() => {
                        // Network failed and not in cache
                        // Return a fallback for navigation requests
                        if (event.request.mode === 'navigate') {
                            return caches.match('/index.html');
                        }
                        return new Response('Offline', {
                            status: 503,
                            statusText: 'Service Unavailable'
                        });
                    });
            })
    );
});
