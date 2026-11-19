/* NMC 통합 관리 (첫 화면 · 잔업 · 재고 · 손익) — 앱 화면 파일만 저장해 둡니다. 기록 데이터는 항상 구글 시트에서 새로 받습니다. */
const CACHE = 'nmc-ot-v49';
const SHELL = ['./', './index.html', './overtime.html', './stock.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/favicon-32.png', './icons/nmc-logo.png'];

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
// 브라우저가 잠시 들고 있는 예전 파일(최대 10분)을 쓰지 않고 늘 서버에 확인합니다 — 고친 화면이 바로 보이게 (2026-11-19).
// 화면 이동(navigate) 요청은 그대로 고쳐 쓸 수 없어 주소로 새로 만들고, 주소가 바뀌는 경우는 브라우저가 따라가게 둡니다.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  const fresh = req.mode === 'navigate'
    ? new Request(req.url, { cache: 'no-cache', credentials: 'same-origin', redirect: 'manual' })
    : new Request(req, { cache: 'no-cache' });
  event.respondWith(
    fetch(fresh)
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
