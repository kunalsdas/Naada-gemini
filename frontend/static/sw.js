/**
 * Naada - Service Worker for PWA
 * Provides offline shell caching and audio file caching.
 */

const CACHE_NAME = "naada-v3";
const SHELL_ASSETS = [
    "/",
    "/static/css/style.css",
    "/static/js/therapy-audio.js?v=3",
    "/static/js/generative-audio.js?v=3",
    "/static/js/visualizer.js?v=3",
    "/static/js/audio-processor.js?v=3",
    "/static/js/camera.js?v=3",
    "/static/js/heart-rate.js?v=3",
    "/static/js/sound-journey.js?v=3",
    "/static/js/websocket-client.js?v=3",
    "/static/js/constants.js?v=3",
    "/static/js/therapy-controller.js?v=3",
    "/static/js/session-tracker.js?v=3",
    "/static/js/ui-effects.js?v=3",
    "/static/js/app.js?v=3",
];

self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(SHELL_ASSETS).catch(() => {
                console.log("[SW] Some assets failed to cache");
            });
        })
    );
    self.skipWaiting();
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(
                keys
                    .filter((key) => key !== CACHE_NAME)
                    .map((key) => caches.delete(key))
            )
        )
    );
    self.clients.claim();
});

self.addEventListener("fetch", (event) => {
    const url = new URL(event.request.url);

    if (
        url.pathname.startsWith("/ws/") ||
        url.pathname.startsWith("/api/") ||
        event.request.method !== "GET"
    ) {
        return;
    }

    if (url.pathname.startsWith("/static/audio/")) {
        event.respondWith(
            caches.match(event.request).then((cached) => {
                if (cached) return cached;
                return fetch(event.request).then((response) => {
                    if (response.ok) {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
                    }
                    return response;
                });
            })
        );
        return;
    }

    event.respondWith(
        fetch(event.request)
            .then((response) => {
                if (response.ok) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
                }
                return response;
            })
            .catch(() => caches.match(event.request))
    );
});
