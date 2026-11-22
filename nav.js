/* NMC 화면 '뒤로' — 모든 화면 공통 (2026-11-22 지시: "전 창구에 뒤로가기 버튼 다 달아라. 그리고 내가 갓던 대로 뒤로 가도록 만들어라")
   · 위쪽 '뒤로' 단추 = 휴대폰 뒤로와 같음: 이 앱 안에서 거쳐 온 화면 · 칸 · 열어 본 창을 온 순서 그대로 한 걸음씩 되짚어 갑니다.
   · 처음 연 화면(바로가기 · 알림 · 새 창으로 연 것)이라 돌아갈 곳이 없으면 그 화면의 첫 창구(관리자 또는 홈)로 갑니다.
   · 화면 안의 칸(탭) 바꾸기 · 창 열기는 화면이 NMCNav.page({ get, set })로 알려 주면 기록에 남고, 뒤로 하면 그 순서대로 되돌아갑니다.
   · 돌아오면 보던 자리(위아래 위치)도 되살립니다.
   기록: 이 탭의 지나온 화면 목록(sessionStorage) + 브라우저 기록 칸마다 history.state { nmcI: 몇 번째 화면, nmcD: 그 화면 안 몇 걸음, v: 화면 안 상태, y: 위치 }
   회사 자료는 없습니다. */
(function () {
  'use strict';
  if (window.NMCNav || window.__NMC_GO) return;   // 이미 있음 · 이 화면은 곧 다른 화면으로 바뀜(첫 화면의 옛 링크 바꿔치기)
  var KEY = 'nmc_nav_v1', ss = null;
  try { ss = window.sessionStorage; ss.getItem(KEY); } catch (e) { ss = null; }
  function load() { try { var t = ss && JSON.parse(ss.getItem(KEY)); if (t && Array.isArray(t.list)) return t; } catch (e) { /* 새로 */ } return { cur: -1, list: [], rep: 0 }; }
  function save(t) { try { if (ss) ss.setItem(KEY, JSON.stringify(t)); } catch (e) { /* 못 씀 */ } }
  function st() { var s = history.state; return s && typeof s === 'object' ? s : {}; }
  function same(a, b) { return JSON.stringify(a == null ? null : a) === JSON.stringify(b == null ? null : b); }
  function empty(x) { return x == null || x === '' || x === 0 || x === false; }
  /** cur → v 가 '닫기'인가: v의 값은 모두 비었거나 cur와 같고, cur에 열려 있던 것 하나 이상이 v에서 비었음 */
  function isClose(cur, v) {
    if (!cur || !v || typeof cur !== 'object' || typeof v !== 'object') return false;
    var ks = Object.keys(cur).concat(Object.keys(v)), shut = false;
    for (var i = 0; i < ks.length; i++) {
      var k = ks[i];
      if (!empty(v[k]) && !same(v[k], cur[k])) return false;
      if (!empty(cur[k]) && empty(v[k])) shut = true;
    }
    return shut;
  }
  /** 지금 기록 칸의 상태를 고침 — 바뀐 것이 없으면 부르지 않음 (브라우저는 기록 고치기를 10초에 200번 넘게 하면 주소 이동까지 막음) */
  function put(patch, url) {
    var cur = st(), next = Object.assign({}, cur, patch);
    if (url == null && same(next, cur)) return;
    try { if (url == null) history.replaceState(next, ''); else history.replaceState(next, '', url); } catch (e) { /* 기록을 못 쓰는 곳 */ }
  }

  // ── 이 화면이 지나온 목록의 몇 번째인지 ──
  var T = load(), s0 = st(), idx;
  var file = location.pathname.replace(/^.*\/(?=[^/]*$)/, '') || 'index.html';
  var fromApp = false;   // 이 앱의 다른 화면에서 넘어왔나 (주소 입력 · 알림 · 다른 사이트 · 홈 화면 아이콘이면 아님)
  try { fromApp = !!document.referrer && new URL(document.referrer).origin === location.origin; } catch (e) { fromApp = false; }
  if (typeof s0.nmcI === 'number' && T.list[s0.nmcI]) idx = s0.nmcI;       // 새로고침 · 뒤로/앞으로로 다시 온 칸
  else if (!fromApp && !T.rep) { idx = 0; T.list = []; }                    // 바깥에서 처음 들어옴 → 여기가 첫 화면 ('뒤로'가 앱 밖으로 나가지 않게)
  else { idx = T.rep ? Math.max(T.cur, 0) : T.cur + 1; T.list = T.list.slice(0, idx); }   // 앱 안에서 새로 연 화면 (주소 바꿔치기면 같은 자리)
  T.rep = 0;
  var old = T.list[idx] && typeof s0.nmcI === 'number' ? T.list[idx] : null;
  T.list[idx] = { t: document.title || file, f: file, vs: old && Array.isArray(old.vs) ? old.vs : [] };
  T.cur = idx;
  save(T);
  var D = typeof s0.nmcD === 'number' ? s0.nmcD : 0;
  put({ nmcI: idx, nmcD: D });
  window.addEventListener('pageshow', function (e) { if (e.persisted) { var t = load(); t.cur = idx; save(t); } });   // 바로 앞 화면으로 돌아온 경우(저장된 화면)

  var HUB = '', HUB_NAME = '';      // 돌아갈 곳이 없을 때 갈 첫 창구
  var P = null, APPLY = 0, SKIP = 0, PEND = 0, READY = false, skipT = 0;

  function vsGet() { var t = load(); return (t.list[idx] && t.list[idx].vs) || []; }
  function vsSet(vs) { var t = load(); if (!t.list[idx]) t.list[idx] = { t: document.title || file, f: file, vs: [] }; t.list[idx].vs = vs.slice(0, 40); save(t); }

  /** 뒤로 갈 곳이 이 앱 안에 있나 */
  function can() {
    var s = st();
    return ((s.nmcD || 0) > 0 || (s.nmcI || 0) > 0) && history.length > 1;
  }
  /** 한 걸음 뒤로 */
  function back() {
    if (can()) { history.back(); return; }
    if (HUB) location.href = HUB;
  }
  /** 다음 화면이 이 칸을 바꿔치기(location.replace)할 때 */
  function replace(url) { var t = load(); t.rep = 1; t.cur = idx; save(t); location.replace(url); }

  function scrollLater(y) {
    if (y == null || isNaN(y)) return;
    var n = 0;
    (function go() {
      window.scrollTo(0, y);
      if (Math.abs(window.scrollY - y) > 2 && n++ < 12) setTimeout(go, 60);   // 내용이 늦게 그려지면 몇 번 더
    })();
  }

  /** 화면 안 상태를 알려 줌: get() → 지금 상태(작은 객체), set(v) → 그 상태로 바꿈, block() → 지금은 못 나가면 알림 글, url(v) → 그 상태의 주소,
      base() → 주소로 바로 열었을 때 그 아래에 깔 바탕 상태(창 닫은 상태) */
  function page(opts) {
    P = opts || null;
    if (!P) return;
    // 화면 안 칸을 기록하는 화면만: 보던 자리를 이 파일이 되살림 (그 밖의 화면은 브라우저가 알아서)
    try { if ('scrollRestoration' in history) history.scrollRestoration = 'manual'; } catch (e) { /* 그대로 */ }
    var s = st(), fresh = s.v === undefined;
    if (!fresh && !same(s.v, P.get())) { APPLY++; try { P.set(s.v); } finally { APPLY--; } }
    var v = P.get(), vs = vsGet();
    vs = vs.slice(0, D);
    var b = fresh && P.base ? P.base() : null;
    if (b && !same(b, v)) {   // 주소로 바로 연 창(예: 공문 한 건) → 바탕 칸을 먼저 두고 그 위에 한 칸 (닫으면 바탕으로, 한 번 더 뒤로면 온 화면으로)
      vs[D] = b; put({ v: b }, P.url ? P.url(b) : undefined);
      D++; vs[D] = v;
      try { history.pushState({ nmcI: idx, nmcD: D, v: v }, '', P.url ? P.url(v) : undefined); } catch (e) { D--; vs.length = D + 1; vs[D] = v; put({ v: v }); }
    } else { vs[D] = v; put({ v: v }); }
    vsSet(vs);
    READY = true;
    if (s.y != null) scrollLater(s.y);
  }
  /** 화면 안 상태가 바뀐 뒤 부름: 사람이 간 것이면 기록에 한 칸 더, 앱 안에서 닫아 앞 칸과 같아졌으면 기록도 한 칸 되돌림 */
  function sync() {
    if (!P || !READY) return;
    if (SKIP > 0 && !APPLY) { PEND = 1; return; }   // 닫기로 한 칸 되돌리는 중 → 끝난 뒤에 이어서 (순서가 엉키지 않게)
    var v = P.get(), cur = st().v;
    if (APPLY) { put({ v: v }); return; }
    if (same(v, cur)) return;
    var vs = vsGet();
    if (D > 0 && vs.length > D - 1 && same(v, vs[D - 1]) && isClose(cur, v) && history.length > 1) {   // 앱 안에서 닫기(×·저장 후 닫힘) → 기록도 한 칸 뒤로 (그때 오는 popstate는 건너뜀)
      D--; vs = vs.slice(0, D + 1); vsSet(vs);
      SKIP++;
      try { history.back(); } catch (e) { SKIP--; }
      clearTimeout(skipT); skipT = setTimeout(function () { if (SKIP > 0) { SKIP = 0; if (PEND) { PEND = 0; sync(); } } }, 1500);   // 브라우저가 되돌리지 못했으면 멈춰 있지 않게
      return;
    }
    D++;
    vs = vs.slice(0, D); vs[D] = v; vsSet(vs);
    try { history.pushState({ nmcI: idx, nmcD: D, v: v }, '', P.url ? P.url(v) : undefined); } catch (e) { /* 기록을 못 쓰는 곳 */ }
  }
  window.addEventListener('popstate', function (e) {
    var s = e.state && typeof e.state === 'object' ? e.state : {};
    if (SKIP > 0) { SKIP--; if (typeof s.nmcD === 'number') D = s.nmcD; if (!SKIP && PEND) { PEND = 0; sync(); } return; }
    if (s.nmcI !== idx) { if (typeof s.nmcD === 'number') D = s.nmcD; return; }   // 주소 끝(#)만 바뀐 칸 등
    var msg = P && P.block ? P.block() : '';
    if (msg) {   // 지금은 못 나감 → 있던 칸을 다시 쌓음
      var vs = vsGet();
      try { history.pushState({ nmcI: idx, nmcD: D, v: vs[D] }, '', P.url ? P.url(vs[D]) : undefined); } catch (er) { /* 그대로 */ }
      if (window.NMCNav.onBlock) window.NMCNav.onBlock(msg);
      return;
    }
    D = typeof s.nmcD === 'number' ? s.nmcD : 0;
    if (P && READY) {
      APPLY++;
      try { P.set(s.v); } finally { APPLY--; }
      var v = P.get(), vs2 = vsGet();
      vs2 = vs2.slice(0, D); vs2[D] = v; vsSet(vs2);
      put({ v: v });
    }
    if (s.y != null) scrollLater(s.y);
  });

  // ── 보던 자리: 누르기 직전 · 스크롤이 멈출 때 지금 칸에 적어 둠 (다른 화면으로 갔다 와도 그 자리) ──
  var yTimer = 0;
  function saveY() { if (P) put({ y: Math.round(window.scrollY || 0) }); }
  document.addEventListener('click', function (e) {
    var b = e.target && e.target.closest ? e.target.closest('[data-nmc-back]') : null;
    if (b) { e.preventDefault(); back(); return; }
    clearTimeout(yTimer); saveY();   // 스크롤 멈춤 기록이 늦게 와서 다음 칸에 잘못 적히지 않게
  }, true);
  window.addEventListener('scroll', function () { clearTimeout(yTimer); yTimer = setTimeout(saveY, 150); }, { passive: true });

  // ── 단추 모양 (모든 화면 같게) ──
  var ICON = '<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>';
  var HOME_ICON = '<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-7 9 7"/><path d="M5 10v10h5v-6h4v6h5V10"/></svg>';
  function escA(t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  /** 단추 글자: 기본 '뒤로' (잔업 화면처럼 여러 나라 말이면 그 말로) */
  function btn(cls, label) {
    var t = label ? escA(label) : '뒤로';
    return '<button type="button" class="nmc-back' + (cls ? ' ' + cls : '') + '" data-nmc-back aria-label="' + (label ? t : '뒤로 (온 길로 한 걸음)') + '">' + ICON + '<span>' + t + '</span></button>';
  }
  function css() {
    if (document.getElementById('nmc-nav-css')) return;
    var el = document.createElement('style');
    el.id = 'nmc-nav-css';
    el.textContent = '.nmc-back{display:inline-flex;align-items:center;justify-content:center;gap:3px;flex:none;min-height:40px;min-width:44px;margin:0;padding:0 13px 0 8px;' +
      'border:2px solid currentColor;border-radius:999px;background:transparent;color:inherit;font:inherit;font-size:15px;font-weight:800;line-height:1;cursor:pointer;white-space:nowrap;-webkit-tap-highlight-color:transparent}' +
      '.nmc-back:hover{background:rgba(127,127,127,.14)}.nmc-back:active{transform:translateY(1px)}' +
      '.nmc-back:focus-visible{outline:3px solid #F4B400;outline-offset:2px}.nmc-back[hidden]{display:none}' +
      '@media (max-width:360px){.nmc-back{padding:0 10px 0 6px;font-size:14px}}@media print{.nmc-back{display:none!important}}';
    (document.head || document.documentElement).appendChild(el);
  }
  css();
  /** 고정 머리글: 자리(slot)에 단추를 넣음 */
  function mount(slot, cls) {
    if (!slot || slot.querySelector('[data-nmc-back]')) return;
    slot.insertAdjacentHTML('afterbegin', btn(cls));
  }
  /* 고정 머리글은 표시만 하면 됨: <div data-nmc-slot data-nmc-hub="manage.html" data-nmc-hub-name="관리자"> → 맨 앞에 '뒤로'
     data-nmc-root = 맨 첫 화면(홈): 앱 안에서 거쳐 온 곳이 있을 때만 '뒤로'를 보임 */
  function auto() {
    var els = document.querySelectorAll('[data-nmc-slot]');
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (el.hasAttribute('data-nmc-hub') && !HUB) { HUB = el.getAttribute('data-nmc-hub') || ''; HUB_NAME = el.getAttribute('data-nmc-hub-name') || ''; }   // 화면이 먼저 정했으면 그대로
      if (el.hasAttribute('data-nmc-root') && !can()) continue;
      mount(el, el.getAttribute('data-nmc-cls') || '');
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', auto); else auto();

  window.NMCNav = {
    page: page, sync: sync, back: back, can: can, replace: replace, btn: btn, mount: mount, homeIcon: HOME_ICON,
    hub: function (url, name) { HUB = url || ''; HUB_NAME = name || ''; },
    hubName: function () { return HUB_NAME; },
    /** 주소 끝(#) · 물음표 뒤만 바꿈 — 기록 칸의 상태는 그대로 */
    url: function (u) { put({}, u); },
    applying: function () { return APPLY > 0; },
    depth: function () { return D; },
    index: function () { return idx; },
    trail: function () { return load().list.slice(0, idx + 1).map(function (x) { return x.t; }); },
    onBlock: null
  };
})();
