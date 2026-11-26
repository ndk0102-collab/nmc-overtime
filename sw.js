/* NMC 통합 관리 (홈 · 관리자 · 잔업 · 직원 급여 · 재고 · 거래명세서 · 공사 프로젝트 · 배합 시뮬레이션 · 손익계산서 · 공문함 · 오늘 할 일 · 부서 업무 · 폐타이어 관리대장 · 계근대 계량) — 앱 화면 파일만 저장해 둡니다. 기록 데이터는 항상 구글 시트에서 새로 받습니다.
   아침 알림(2026-11-21): 알림 신호(내용 없음)를 받으면 이 기기의 열쇠로 서버에서 오늘 할 일을 받아 알림을 띄웁니다. */
const CACHE = 'nmc-ot-v90';
const PUSH = 'nmc-push';   // 이 기기의 알림 열쇠 (화면 파일 저장소와 따로 — 새 판이 와도 지우지 않음)
const SHELL = ['./', './index.html', './overtime.html', './stock.html', './ledger.html', './statement.html', './manage.html', './pj.html', './mix.html', './today.html', './docs.html', './work.html', './tire.html', './tire-forms.js', './weigh.html', './push.js', './period.js', './preview.js', './nav.js', './menu.js', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/favicon-32.png', './icons/nmc-logo.png', './icons/nmc-logo-print.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== PUSH).map((k) => caches.delete(k))))
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

/* ── 아침 알림 (2026-11-21 지시: "매일 아침 8시에 오늘 입고 · 출고 · 처리할 중요 공문을 팝업처럼 휴대폰으로 · 관리 앱 깔린 컴퓨터에 다") ── */
function pushCfg() {
  return caches.open(PUSH).then((c) => c.match(new URL('__push_cfg', self.registration.scope).href))
    .then((r) => (r ? r.json() : null)).catch(() => null);
}
function serverCall(cfg, fn, args) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 20000);
  return fetch(cfg.api, { method: 'POST', body: JSON.stringify({ action: 'stock.call', fn: fn, args: args }), redirect: 'follow', cache: 'no-store', credentials: 'omit', signal: ctl.signal })
    .then((r) => r.json()).finally(() => clearTimeout(t));
}
self.addEventListener('push', (event) => {
  event.waitUntil((async () => {
    let title = 'NMC 오늘 할 일', body = '오늘 출고 · 입고 · 처리 대기 공문을 확인하십시오.';
    try {
      const cfg = await pushCfg();
      if (cfg && cfg.api && cfg.key) {
        const j = await serverCall(cfg, 'apiBriefDev', [cfg.key]);
        if (j && j.ok && j.data) { title = j.data.title || title; body = j.data.body || body; }
        else if (j && j.error === 'auth') body = '이 기기의 알림 등록이 삭제되었습니다. 관리 앱의 오늘 할 일에서 ‘이 기기 알림 등록’을 다시 진행하십시오.';
      }
    } catch (e) { /* 서버가 늦거나 인터넷이 끊기면 기본 글로 */ }
    await self.registration.showNotification(title, { body: body, tag: 'nmc-today', renotify: true, requireInteraction: true,
      icon: new URL('icons/icon-192.png', self.registration.scope).href, data: { url: new URL('today.html', self.registration.scope).href } });
  })());
});
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || new URL('today.html', self.registration.scope).href;
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    for (const c of list) { if (c.url.split('#')[0].split('?')[0] === url && 'focus' in c) return c.focus(); }   // 이미 열린 오늘 할 일 창이 있으면 그 창
    return self.clients.openWindow ? self.clients.openWindow(url) : null;
  }));
});
// 브라우저가 알림 구독을 새로 바꾸면 서버의 기기 주소도 바꿈 (기기 열쇠로)
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil((async () => {
    const cfg = await pushCfg();
    if (!cfg || !cfg.pub || !cfg.key) return;
    const b = cfg.pub.replace(/-/g, '+').replace(/_/g, '/');
    const key = Uint8Array.from(atob(b + '==='.slice((b.length + 3) % 4)), (c) => c.charCodeAt(0));
    const sub = await self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
    await serverCall(cfg, 'apiNotiRenew', [cfg.key, sub.toJSON()]);
  })().catch(() => {}));
});
