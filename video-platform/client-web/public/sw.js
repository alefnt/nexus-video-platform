// FILE: /video-platform/client-web/public/sw.js
/**
 * Service Worker — PWA Offline Support
 * 
 * Strategies:
 * - Cache First: Static assets (JS, CSS, images, fonts)
 * - Network First: API calls and dynamic content
 * - Stale While Revalidate: HTML pages
 */

const CACHE_VERSION = 'nexus-v1.2.0';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const API_CACHE = `${CACHE_VERSION}-api`;

// Static assets to precache
const PRECACHE_URLS = [
    '/',
    '/index.html',
    '/manifest.json',
];

// ============== Install ==============
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(STATIC_CACHE).then((cache) => {
            console.log('[SW] Precaching static assets');
            return cache.addAll(PRECACHE_URLS);
        })
    );
    self.skipWaiting();
});

// ============== Activate ==============
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys
                    .filter((key) => key !== STATIC_CACHE && key !== API_CACHE)
                    .map((key) => {
                        console.log('[SW] Removing old cache:', key);
                        return caches.delete(key);
                    })
            );
        })
    );
    self.clients.claim();
});

// ============== Fetch ==============
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET requests
    if (request.method !== 'GET') return;

    // Skip Chrome extension requests
    if (url.protocol === 'chrome-extension:') return;

    // API calls: Network First with cache fallback
    if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/payment/') ||
        url.pathname.startsWith('/metadata/') || url.pathname.startsWith('/content/')) {
        event.respondWith(networkFirstStrategy(request));
        return;
    }

    // Static assets: Cache First
    if (isStaticAsset(url.pathname)) {
        event.respondWith(cacheFirstStrategy(request));
        return;
    }

    // HTML pages: Stale While Revalidate
    event.respondWith(staleWhileRevalidate(request));
});

// ============== Strategies ==============

async function cacheFirstStrategy(request) {
    const cached = await caches.match(request);
    if (cached) return cached;

    try {
        const response = await fetch(request);
        if (response.ok) {
            const cache = await caches.open(STATIC_CACHE);
            cache.put(request, response.clone());
        }
        return response;
    } catch {
        return new Response('Offline', { status: 503 });
    }
}

async function networkFirstStrategy(request) {
    try {
        const response = await fetch(request);
        if (response.ok) {
            const cache = await caches.open(API_CACHE);
            cache.put(request, response.clone());
        }
        return response;
    } catch {
        const cached = await caches.match(request);
        return cached || new Response(JSON.stringify({ error: 'Offline' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}

async function staleWhileRevalidate(request) {
    const cached = await caches.match(request);
    const fetchPromise = fetch(request).then((response) => {
        if (response.ok) {
            const cache = caches.open(STATIC_CACHE);
            cache.then(c => c.put(request, response.clone()));
        }
        return response;
    }).catch(() => cached);

    return cached || fetchPromise;
}

// ============== Helpers ==============

function isStaticAsset(pathname) {
    return /\.(js|css|png|jpg|jpeg|gif|svg|woff|woff2|ttf|eot|ico|webp|avif)(\?.*)?$/i.test(pathname);
}

// ============== Push Notifications ==============
self.addEventListener('push', (event) => {
    if (!event.data) return;
    const data = event.data.json();

    event.waitUntil(
        self.registration.showNotification(data.title || 'Nexus', {
            body: data.body || '',
            icon: '/icons/icon-192x192.png',
            badge: '/icons/icon-72x72.png',
            data: data.url || '/',
            tag: data.tag || 'default',
        })
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        self.clients.openWindow(event.notification.data || '/')
    );
});
