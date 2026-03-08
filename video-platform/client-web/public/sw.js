/**
 * Service Worker - PWA 离线支持
 * 
 * 策略:
 * - 静态资源 (JS/CSS/图片): Cache First
 * - API 请求: Network First, fallback cache
 * - 视频文件: Network Only (太大不缓存)
 */

const CACHE_NAME = "nexus-v1";
const STATIC_CACHE = "nexus-static-v1";
const API_CACHE = "nexus-api-v1";

const STATIC_URLS = [
    "/",
    "/index.html",
    "/manifest.json",
];

// 安装: 缓存核心静态资源
self.addEventListener("install", function (event) {
    event.waitUntil(
        caches.open(STATIC_CACHE).then(function (cache) { return cache.addAll(STATIC_URLS); })
    );
    self.skipWaiting();
});

// 激活: 清理旧缓存
self.addEventListener("activate", function (event) {
    event.waitUntil(
        caches.keys().then(function (keys) {
            return Promise.all(
                keys
                    .filter(function (k) { return k !== CACHE_NAME && k !== STATIC_CACHE && k !== API_CACHE; })
                    .map(function (k) { return caches.delete(k); })
            );
        })
    );
    self.clients.claim();
});

// 拦截请求
self.addEventListener("fetch", function (event) {
    var url = new URL(event.request.url);

    // 视频文件: 不缓存
    if (
        url.pathname.endsWith(".m3u8") ||
        url.pathname.endsWith(".ts") ||
        url.pathname.endsWith(".mp4") ||
        url.pathname.includes("/videos/")
    ) {
        return;
    }

    // API 请求: Network First
    if (url.pathname.startsWith("/api/")) {
        event.respondWith(networkFirst(event.request));
        return;
    }

    // 静态资源: Cache First
    if (
        url.pathname.match(/\.(js|css|png|jpg|jpeg|webp|svg|woff2?)$/) ||
        url.pathname.startsWith("/assets/")
    ) {
        event.respondWith(cacheFirst(event.request));
        return;
    }

    // HTML 页面: Network First (SPA fallback)
    if (event.request.mode === "navigate") {
        event.respondWith(
            fetch(event.request).catch(function () {
                return caches.match("/index.html").then(function (r) {
                    return r || new Response("离线中", { status: 503 });
                });
            })
        );
        return;
    }

    event.respondWith(networkFirst(event.request));
});

function cacheFirst(request) {
    return caches.match(request).then(function (cached) {
        if (cached) return cached;

        return fetch(request).then(function (response) {
            if (response.ok) {
                var cache = caches.open(STATIC_CACHE);
                cache.then(function (c) { c.put(request, response.clone()); });
            }
            return response;
        }).catch(function () {
            return new Response("", { status: 503 });
        });
    });
}

function networkFirst(request) {
    return fetch(request).then(function (response) {
        if (response.ok) {
            caches.open(API_CACHE).then(function (cache) {
                cache.put(request, response.clone());
            });
        }
        return response;
    }).catch(function () {
        return caches.match(request).then(function (cached) {
            return cached || new Response(JSON.stringify({ error: "离线" }), {
                status: 503,
                headers: { "Content-Type": "application/json" },
            });
        });
    });
}

// 推送通知
self.addEventListener("push", function (event) {
    var data = event.data ? event.data.json() : {};
    event.waitUntil(
        self.registration.showNotification(data.title || "Nexus Video", {
            body: data.body || "",
            icon: "/icons/icon-192.png",
            badge: "/icons/badge-72.png",
            data: data.url || "/",
            tag: data.tag || "default",
        })
    );
});

self.addEventListener("notificationclick", function (event) {
    event.notification.close();
    event.waitUntil(
        self.clients.openWindow(event.notification.data || "/")
    );
});
