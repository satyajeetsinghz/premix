/**
 * sw.js — BeatStream Service Worker
 *
 * Three caching strategies, each matched to the data type:
 *
 *  1. NETWORK ONLY      — Firebase / Firestore / Auth APIs
 *     Real-time data must never be served from cache. Stale Firestore
 *     responses would break live playlist updates, song likes, and auth.
 *
 *  2. NETWORK FIRST     — Cloudinary audio (res.cloudinary.com)
 *     Try network first; on failure serve the cached copy for offline
 *     playback. Audio files are large, immutable, and worth caching.
 *
 *  3. CACHE FIRST (stale-while-revalidate) — App shell
 *     Serve the cached HTML/JS/CSS instantly, then silently revalidate
 *     in the background so the next load gets fresh assets.
 *
 * POST / PUT / DELETE requests are never intercepted.
 *
 * Versioning: bump CACHE_VERSION on every production deploy so stale
 * shell assets are purged on the activate event.
 */

const CACHE_VERSION = "v1";
const SHELL_CACHE   = `beatstream-shell-${CACHE_VERSION}`;
const AUDIO_CACHE   = `beatstream-audio-${CACHE_VERSION}`;
const KNOWN_CACHES  = [SHELL_CACHE, AUDIO_CACHE];

/** Assets pre-cached on install — the minimal app shell. */
const SHELL_ASSETS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png",
];

/** Domains whose responses must always come from the network. */
const NETWORK_ONLY_ORIGINS = [
  "firestore.googleapis.com",
  "identitytoolkit.googleapis.com",
  "securetoken.googleapis.com",
  "firebase.googleapis.com",
];

/** Domain for Cloudinary audio files — network-first with cache fallback. */
const AUDIO_ORIGIN = "res.cloudinary.com";

// ── Install ────────────────────────────────────────────────────────────────
// Pre-cache shell assets, then skip the waiting phase so this SW takes
// control immediately without requiring a browser restart.
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting()),
  );
});

// ── Activate ───────────────────────────────────────────────────────────────
// Delete any caches from previous versions (different CACHE_VERSION), then
// immediately take control of all open tabs via clients.claim().
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => !KNOWN_CACHES.includes(key))
            .map((key)  => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

// ── Fetch ──────────────────────────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only intercept GET requests — never touch mutations.
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // ── 1. NETWORK ONLY: Firebase / Firestore / Auth ───────────────────────
  if (NETWORK_ONLY_ORIGINS.some((origin) => url.hostname.includes(origin))) {
    // Fall through — browser handles it normally (no event.respondWith).
    return;
  }

  // ── 2. NETWORK FIRST + cache fallback: Cloudinary audio ───────────────
  if (url.hostname.includes(AUDIO_ORIGIN)) {
    event.respondWith(networkFirstAudio(request));
    return;
  }

  // ── 3. CACHE FIRST (stale-while-revalidate): App shell ────────────────
  event.respondWith(cacheFirstShell(request));
});

// ── Strategy: network-first for audio ─────────────────────────────────────
async function networkFirstAudio(request) {
  const cache = await caches.open(AUDIO_CACHE);
  try {
    const networkResponse = await fetch(request);
    // Only cache valid 2xx responses — don't cache errors.
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch {
    // Network failed — serve the cached copy for offline playback.
    const cached = await cache.match(request);
    if (cached) return cached;
    // Nothing cached either — let the browser surface a network error.
    throw new Error(`[SW] No cached audio for: ${request.url}`);
  }
}

// ── Strategy: cache-first (stale-while-revalidate) for shell ─────────────
async function cacheFirstShell(request) {
  const cache  = await caches.open(SHELL_CACHE);
  const cached = await cache.match(request);

  // Kick off a background revalidation regardless of cache hit.
  const networkFetch = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => {
      // Network unavailable — silently swallow; cached copy will be used.
    });

  // If we have a cached copy, return it immediately (fast).
  // The background fetch updates the cache for the *next* visit.
  if (cached) return cached;

  // No cache hit — wait for the network response.
  return networkFetch;
}