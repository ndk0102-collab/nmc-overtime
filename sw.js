/* NMC 통합 관리 (첫 화면 · 잔업 · 재고 · 손익) — 앱 화면 파일만 저장해 둡니다. 기록 데이터는 항상 구글 시트에서 새로 받습니다. */
const CACHE = 'nmc-ot-v14';
const SHELL = ['./', './index.html', './overtime.html', './stock.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/favicon-32.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// 같은 주소의 화면 파일: 인터넷이 되면 새로 받고, 안 되면 저장해 둔 것을 보여 줍니다.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }).then((hit) => hit || caches.match('./index.html')))
  );
});
