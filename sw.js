// Minimal service worker — enables PWA installability.
// MediaPipe WASM and model files are large; we skip caching them here
// and let the browser handle network requests directly.

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
