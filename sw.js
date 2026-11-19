// 会場の回線が切れても画面と画像が表示されるようにキャッシュします。
// ファイルを更新したら VERSION を上げてください。
const VERSION = "v1";
const FILES = ["./", "index.html", "style.css", "app.js", "data.js", "monitor.html",
  ...["a1","a2","a3","a4","m1","m2","m3","m4","m5","m6","m7","m8"].flatMap(k => [`img/${k}_s.webp`, `img/${k}_l.webp`]),
  "img/pa_l.webp", "img/pm_l.webp"];
self.addEventListener("install", e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k))))); self.clients.claim(); });
self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if (u.origin !== location.origin || e.request.method !== "GET") return; // 集計APIはキャッシュしない
  // data.js / app.js は最新を優先、それ以外はキャッシュ優先
  if (/\.(js|html)$|\/$/.test(u.pathname)) {
    e.respondWith(fetch(e.request).then(r => { const cp = r.clone(); caches.open(VERSION).then(c => c.put(e.request, cp)); return r; }).catch(() => caches.match(e.request, { ignoreSearch: true })));
  } else {
    e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(r => r || fetch(e.request)));
  }
});
