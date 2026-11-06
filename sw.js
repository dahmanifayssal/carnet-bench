/* Carnet Bench — cache hors ligne : réseau d'abord, cache en secours (utile à la salle sans réseau). */
const CACHE = "carnet-bench-v1";
const SHELL = ["./", "index.html", "coach.html", "style.css", "common.js", "app.js", "coach.js", "programme.json", "manifest.webmanifest", "icon.svg"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  const key = url.pathname.endsWith("programme.json") ? new Request(url.origin + url.pathname) : req;
  e.respondWith(fetch(req).then(res => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(key, copy)); } return res; })
    .catch(() => caches.match(key, { ignoreSearch: true })));
});
