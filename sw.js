// FALQBIT app service worker: network first, offline fallback to the cached shell.
const CACHE = "falqbit-app-v17";
const SHELL = ["./app.html", "./falqbit.js", "./falqbit-config.json", "./icon.png", "./app-icon-192.png", "./fx.js", "./fx2.js", "./fx3.js", "./fxu.css", "./trade.html", "./calculator.html"];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin) return;
  e.respondWith(fetch(e.request).then((r) => { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return r; }).catch(() => caches.match(e.request)));
});
