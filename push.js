/* NMC 아침 알림 (2026-11-21): 이 기기에서 알림 받기 · 끄기 · 상태. '오늘 할 일'(today.html)과 관리자 창구(manage.html)가 씁니다.
   회사 자료는 이 파일에 없습니다. 기기 열쇠는 이 브라우저 안(캐시 저장소 'nmc-push')에만 두고, 알림 신호를 받은 서비스 워커(sw.js)가
   그 열쇠로 서버에서 오늘 할 일을 받아 알림을 띄웁니다. 신호 자체에는 내용이 없습니다. */
(function () {
  'use strict';
  var STORE = 'nmc-push', CFG = '__push_cfg';
  function cfgUrl() { return new URL(CFG, location.href).href; }
  function ios() { return /iPhone|iPad|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1); }
  function standalone() { return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true; }
  function supported() { return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window && 'caches' in window; }
  function b64u(s) {
    s = String(s).replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    var r = atob(s), a = new Uint8Array(r.length);
    for (var i = 0; i < r.length; i++) a[i] = r.charCodeAt(i);
    return a;
  }
  function sameKey(buf, a) {
    if (!buf || buf.byteLength !== a.length) return false;
    var x = new Uint8Array(buf);
    for (var i = 0; i < x.length; i++) if (x[i] !== a[i]) return false;
    return true;
  }
  function getCfg() {
    if (!('caches' in window)) return Promise.resolve(null);
    return caches.open(STORE).then(function (c) { return c.match(cfgUrl()); })
      .then(function (r) { return r ? r.json() : null; }).catch(function () { return null; });
  }
  function setCfg(o) {
    return caches.open(STORE).then(function (c) {
      return o ? c.put(cfgUrl(), new Response(JSON.stringify(o), { headers: { 'Content-Type': 'application/json' } })) : c.delete(cfgUrl());
    });
  }
  function getSub() {
    if (!('serviceWorker' in navigator)) return Promise.resolve(null);
    return navigator.serviceWorker.getRegistration().then(function (r) { return r && r.pushManager ? r.pushManager.getSubscription() : null; }).catch(function () { return null; });
  }
  function ready() { return navigator.serviceWorker.register('sw.js').then(function () { return navigator.serviceWorker.ready; }); }
  /** '안드로이드 · 크롬', '윈도우 PC · 엣지', '아이폰' 같은 이름 (사용자가 기기 목록에서 알아보기 쉽게) */
  function devName() {
    var ua = navigator.userAgent;
    var os = /Android/.test(ua) ? (/Mobile/.test(ua) ? '안드로이드 휴대폰' : '안드로이드 태블릿') : ios() ? (/iPad/.test(ua) || /Macintosh/.test(ua) ? '아이패드' : '아이폰')
      : /Windows/.test(ua) ? '윈도우 PC' : /Macintosh|Mac OS/.test(ua) ? '맥' : /CrOS/.test(ua) ? '크롬북' : /Linux/.test(ua) ? '리눅스 PC' : '기기';
    var br = /Edg\//.test(ua) ? '엣지' : /SamsungBrowser/.test(ua) ? '삼성 인터넷' : /Whale\//.test(ua) ? '웨일' : /Firefox\//.test(ua) ? '파이어폭스'
      : /CriOS|Chrome\//.test(ua) ? '크롬' : /Safari\//.test(ua) ? '사파리' : '';
    return os + (br && !(ios() && br === '사파리') ? ' · ' + br : '');
  }
  /** → Promise<{ state, cfg }>. state: 'on'(받는 중) · 'off'(안 받음) · 'denied'(브라우저에서 막음) · 'ios-install'(아이폰: 홈 화면에 추가 필요) · 'unsupported' */
  function state() {
    if (!supported()) return Promise.resolve({ state: ios() && !standalone() ? 'ios-install' : 'unsupported', cfg: null });
    if (Notification.permission === 'denied') return Promise.resolve({ state: 'denied', cfg: null });
    return Promise.all([getCfg(), getSub()]).then(function (a) {
      return { state: a[0] && a[0].key && a[1] && Notification.permission === 'granted' ? 'on' : 'off', cfg: a[0] };
    });
  }
  /** 알림 받기. call(fn, args) = 관리자 열쇠로 서버를 부르는 그 화면의 함수, api = 서버 주소.
   *  ask = false면 권한을 묻지 않음(이미 허용된 브라우저에서 저절로 다시 등록할 때) */
  function enable(call, api, ask) {
    if (!supported()) return Promise.reject(new Error(ios() && !standalone() ? 'ios-install' : 'unsupported'));
    var pub = '';
    return call('apiNoti', []).then(function (d) {
      pub = d && d.pub;
      if (!pub) throw new Error('no_key');
      if (Notification.permission === 'granted') return 'granted';
      if (ask === false) throw new Error('not_granted');
      return Notification.requestPermission();
    }).then(function (p) {
      if (p !== 'granted') throw new Error(p === 'denied' ? 'denied' : 'dismissed');
      return ready();
    }).then(function (reg) {
      var key = b64u(pub);
      return reg.pushManager.getSubscription().then(function (s) {
        if (s && s.options && s.options.applicationServerKey && !sameKey(s.options.applicationServerKey, key)) return s.unsubscribe().then(function () { return null; });
        return s;
      }).then(function (s) { return s || reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key }); });
    }).then(function (sub) {
      return call('apiNotiAdd', [sub.toJSON(), { name: devName(), ua: String(navigator.userAgent).slice(0, 120) }]);
    }).then(function (d) {
      return setCfg({ api: api, key: d.key, id: d.id, pub: d.pub, at: new Date().toISOString() }).then(function () { return d; });
    });
  }
  /** 이 기기 알림 끄기 (서버 기기 목록에서도 지움) */
  function disable(call) {
    return getCfg().then(function (cfg) {
      return getSub().then(function (s) { return s ? s.unsubscribe().catch(function () {}) : null; })
        .then(function () { return cfg && cfg.id && call ? call('apiNotiDel', [cfg.id]).catch(function () {}) : null; })
        .then(function () { return setCfg(null); });
    });
  }
  /** 관리자 창구에서: 이미 알림을 허용한 브라우저인데 등록이 없으면 묻지 않고 다시 등록 */
  function auto(call, api) {
    if (!supported() || Notification.permission !== 'granted') return Promise.resolve(false);
    return state().then(function (s) { return s.state === 'on' ? false : enable(call, api, false).then(function () { return true; }); }).catch(function () { return false; });
  }
  window.NMCPush = { supported: supported, ios: ios, standalone: standalone, state: state, enable: enable, disable: disable, auto: auto, cfg: getCfg, devName: devName };
})();
