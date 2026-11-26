/* 받은 파일 그림으로 보기 (2026-11-26 지시: "발주서 누르면 … 파일열기 말고 발주서를 그림으로 바로 띄워서 볼수있게",
   "세금계산서도 누르면 바로 그림으로 볼수있게 띄워라", "클릭하면 속도가 너무 느리다. 빠르게 띄워라")
   - 서버(apiFileView)가 발주서함 · 공문함에 있는 파일만 보내 줌: PDF = 원본(쪽마다 그림으로 그림), 사진 = 원본 또는 드라이브 미리보기 그림,
     엑셀 = 읽기용 사본의 칸, 그 밖(한글 · 워드 등) = 드라이브 미리보기 그림 (없으면 원본 열기)
   - PDF는 pdf.js(무료 · Apache-2.0, lib/pdfjs 안, 처음 PDF를 열 때만 읽음)로 쪽마다 그림
   - 한 번 받은 파일은 이 화면에서 다시 받지 않음(누르는 즉시), 목록에 보이는 것은 미리 받아 둠(prefetch)
   - 받은 글자는 화면에 글자로만 넣음(HTML로 넣지 않음) */
(function () {
  'use strict';
  var BASE = (function () { var s = document.currentScript && document.currentScript.src; return s ? s.replace(/[^/]*$/, '') : ''; })();
  var MAX_PAGES = 12;
  var got = {};      // 파일 번호 → Promise(서버 답)
  var res = {};      // 파일 번호 → 서버 답 (받은 것)
  var pages = {};    // 파일 번호 + 폭 → Promise([그림 주소 …]) — PDF 쪽 그림
  var pdfLib = null;

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function css() {
    if (document.getElementById('nmc-pv-css')) return;
    var st = document.createElement('style');
    st.id = 'nmc-pv-css';
    st.textContent =
      '.npv{display:flex;flex-direction:column;gap:10px}' +
      '.npv-f{border:1px solid #DDD6CF;border-radius:10px;background:#fff;overflow:hidden}' +
      '.npv-h{display:flex;align-items:center;gap:8px;padding:7px 10px;border-bottom:1px solid #EFEAE5;font-size:13.5px;color:#33302D;background:#FBFAF8}' +
      '.npv-h b{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:700}' +
      '.npv-h button,.npv-h a{flex:none;font:inherit;font-weight:700;font-size:13px;color:#7A3A14;background:#fff;border:1px solid #DDD6CF;border-radius:8px;padding:4px 9px;cursor:pointer;text-decoration:none;min-height:32px;display:inline-flex;align-items:center}' +
      '.npv-b{position:relative;min-height:120px;background:#F5F3F1}' +
      '.npv-b img{display:block;width:100%;height:auto;background:#fff;cursor:zoom-in}' +
      '.npv-b img+img{border-top:6px solid #E7E2DC}' +
      '.npv-w{display:flex;align-items:center;justify-content:center;min-height:160px;color:#625C56;font-size:14px;padding:16px;text-align:center}' +
      '.npv-w i{width:22px;height:22px;border:3px solid #DDD6CF;border-top-color:#7A3A14;border-radius:50%;margin-right:10px;animation:npvr .8s linear infinite}' +
      '@keyframes npvr{to{transform:rotate(360deg)}}' +
      '.npv-e{padding:14px;color:#33302D;font-size:14px;line-height:1.55}' +
      '.npv-e .a{margin-top:8px;display:flex;gap:8px;flex-wrap:wrap}' +
      '.npv-e .a a,.npv-e .a button{font:inherit;font-weight:700;color:#7A3A14;background:#fff;border:2px solid #DDD6CF;border-radius:9px;padding:6px 12px;min-height:40px;text-decoration:none;cursor:pointer;display:inline-flex;align-items:center}' +
      '.npv-t{overflow:auto;max-height:70vh;background:#fff}' +
      '.npv-t table{border-collapse:collapse;font-size:13px;min-width:100%}' +
      '.npv-t td{border:1px solid #E7E2DC;padding:4px 7px;white-space:nowrap;vertical-align:top}' +
      '.npv-t tr:first-child td{background:#F6EDE6;font-weight:700}' +
      '.npv-x{white-space:pre-wrap;word-break:break-all;margin:0;padding:12px;font:13px/1.6 ui-monospace,Consolas,monospace;background:#fff;max-height:70vh;overflow:auto}' +
      '.npv-n{padding:6px 10px;font-size:12.5px;color:#625C56;background:#FBFAF8;border-top:1px solid #EFEAE5}' +
      /* 크게 보기 (화면 전체) */
      '.npv-o{position:fixed;inset:0;z-index:9999;background:rgba(20,18,16,.94);display:flex;flex-direction:column}' +
      '.npv-ob{display:flex;align-items:center;gap:6px;padding:8px 10px;padding-top:max(8px,env(safe-area-inset-top));color:#fff}' +
      '.npv-ob b{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:14px}' +
      '.npv-ob button,.npv-ob a{flex:none;min-width:44px;min-height:44px;border-radius:10px;border:1px solid rgba(255,255,255,.3);background:rgba(255,255,255,.12);color:#fff;font:700 15px/1 inherit;font-family:inherit;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;text-decoration:none;padding:0 10px}' +
      '.npv-os{flex:1;overflow:auto;-webkit-overflow-scrolling:touch;touch-action:pan-x pan-y pinch-zoom;padding:0 8px 16px}' +
      '.npv-os .pg{margin:0 auto 10px;background:#fff;transform-origin:top left}' +
      '.npv-os img{display:block;width:100%;height:auto}';
    document.head.appendChild(st);
  }
  function b64bytes(b64) { var s = atob(b64), n = s.length, u = new Uint8Array(n); for (var i = 0; i < n; i++) u[i] = s.charCodeAt(i); return u; }
  function blobUrl(b64, mime) { return URL.createObjectURL(new Blob([b64bytes(b64)], { type: /^image\//.test(mime) ? mime : 'image/png' })); }
  function errMsg(e) {
    var c = String((e && e.message) || e || '');
    if (c === 'bad_action') return '서버 업데이트(v68) 후 그림으로 표시됩니다. 지금은 원본 열기를 이용하십시오.';
    if (c === 'not_found') return '파일을 찾지 못했습니다. 드라이브에서 지워졌거나 옮겨졌을 수 있습니다.';
    if (c === 'net') return '인터넷 연결을 확인해 주십시오.';
    if (c === 'timeout') return '응답이 지연되고 있습니다. 다시 시도해 주십시오.';
    if (c === 'auth') return '로그인이 만료되었습니다. 비밀번호를 다시 입력해 주십시오.';
    return '그림을 만들지 못했습니다 (' + c.slice(0, 60) + ').';
  }

  /** 서버에서 파일 받기 (같은 파일은 한 번만) */
  function get(fid, call) {
    if (!got[fid]) {
      got[fid] = call('apiFileView', [fid]).then(function (r) { res[fid] = r; return r; }, function (e) { delete got[fid]; throw e; });
    }
    return got[fid];
  }
  /** 목록에 보이는 것 미리 받기 — 한 번에 2개씩 */
  var Q = [], running = 0;
  function prefetch(fids, call) {
    (fids || []).forEach(function (f) { if (f && !got[f] && Q.indexOf(f) < 0) Q.push(f); });
    pump(call);
  }
  function pump(call) {
    while (running < 2 && Q.length) {
      var f = Q.shift();
      if (got[f]) continue;
      running++;
      get(f, call).then(done, done);
    }
    function done() { running--; pump(call); }
  }

  function loadPdf() {
    if (pdfLib) return pdfLib;
    pdfLib = new Promise(function (ok, no) {
      if (window.pdfjsLib) { ok(window.pdfjsLib); return; }
      var s = document.createElement('script');
      s.src = BASE + 'lib/pdfjs/pdf.min.js';
      s.onload = function () {
        var L = window.pdfjsLib;
        if (!L) { no(new Error('pdf_lib')); return; }
        L.GlobalWorkerOptions.workerSrc = BASE + 'lib/pdfjs/pdf.worker.min.js';
        ok(L);
      };
      s.onerror = function () { pdfLib = null; no(new Error('net')); };
      document.head.appendChild(s);
    });
    return pdfLib;
  }
  /** PDF → 쪽 그림 주소들 (폭 px) */
  function pdfPages(fid, r, px) {
    var key = fid + '@' + px;
    if (pages[key]) return pages[key];
    pages[key] = loadPdf().then(function (L) {
      return L.getDocument({ data: b64bytes(r.b64), cMapUrl: BASE + 'lib/pdfjs/cmaps/', cMapPacked: true, isEvalSupported: false, useSystemFonts: true }).promise;
    }).then(function (doc) {
      var n = Math.min(doc.numPages, MAX_PAGES), out = [], i = 1;
      var one = function () {
        if (i > n) return Promise.resolve({ urls: out, total: doc.numPages });
        return doc.getPage(i).then(function (pg) {
          var v1 = pg.getViewport({ scale: 1 }), sc = px / v1.width, vp = pg.getViewport({ scale: sc });
          var c = document.createElement('canvas');
          c.width = Math.ceil(vp.width); c.height = Math.ceil(vp.height);
          var g = c.getContext('2d');
          g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
          return pg.render({ canvasContext: g, viewport: vp }).promise.then(function () {
            return new Promise(function (ok) { c.toBlob(function (b) { ok(b); }, 'image/jpeg', 0.9); });
          }).then(function (b) {
            out.push(b ? URL.createObjectURL(b) : c.toDataURL('image/jpeg', 0.9));
            c.width = c.height = 0;
            pg.cleanup();
            i++;
            return one();
          });
        });
      };
      return one();
    });
    pages[key].catch(function () { delete pages[key]; });
    return pages[key];
  }
  function pxFor(el) {
    var w = (el && el.clientWidth) || 600, d = Math.min(2, window.devicePixelRatio || 1);
    return Math.max(900, Math.min(1800, Math.round(w * d * 1.5)));
  }
  function tableHtml(rows) {
    return '<div class="npv-t"><table>' + rows.map(function (r) { return '<tr>' + r.map(function (c) { return '<td>' + esc(c) + '</td>'; }).join('') + '</tr>'; }).join('') + '</table></div>';
  }
  /** 한 파일을 칸(body)에 그림 → Promise(그림 주소들 · 쪽 수) */
  function paint(body, fid, r, opt) {
    if (r.kind === 'img') {
      var u = r._url || (r._url = blobUrl(r.b64, r.mime));
      body.innerHTML = '<img alt="' + esc(r.name || '') + '" src="' + u + '">' + (r.part ? '<div class="npv-n">큰 PDF라 첫 쪽만 그림으로 보였습니다. 나머지 쪽은 원본 열기로 보십시오.</div>' : '');
      return Promise.resolve({ urls: [u], total: 1 });
    }
    if (r.kind === 'pdf') {
      body.innerHTML = '<div class="npv-w"><i></i>PDF를 그림으로 만드는 중…</div>';
      return pdfPages(fid, r, pxFor(body)).then(function (P) {
        body.innerHTML = P.urls.map(function (u, i) { return '<img alt="' + esc((r.name || '') + ' ' + (i + 1) + '쪽') + '" src="' + u + '">'; }).join('') +
          (P.total > P.urls.length ? '<div class="npv-n">' + P.total + '쪽 중 ' + P.urls.length + '쪽까지 보였습니다. 나머지는 원본 열기로 보십시오.</div>' : '');
        return P;
      });
    }
    if (r.kind === 'table') { body.innerHTML = tableHtml(r.rows || []) + '<div class="npv-n">엑셀 파일의 칸 내용입니다 (서식 · 그림은 원본 열기).</div>'; return Promise.resolve({ urls: [], total: 0 }); }
    if (r.kind === 'text') { body.innerHTML = '<pre class="npv-x">' + esc(r.text || '') + '</pre>'; return Promise.resolve({ urls: [], total: 0 }); }
    body.innerHTML = '<div class="npv-e">' + (r.why === 'big' ? '파일이 커서 화면 그림을 만들지 못했습니다.' : '이 파일 형식(' + esc(String(r.name || '').split('.').pop()) + ')은 화면 그림을 만들 수 없습니다.') + ' 원본 열기로 보십시오.' +
      (opt.drive ? '<div class="a"><a href="' + esc(opt.drive(fid)) + '" target="_blank" rel="noopener">원본 열기</a></div>' : '') + '</div>';
    return Promise.resolve({ urls: [], total: 0 });
  }

  /** 칸(el)에 파일들을 차례로 그림. opt = { call, names: [이름…], drive: fid → 원본 주소, title } */
  function mount(el, fids, opt) {
    css();
    opt = opt || {};
    fids = (fids || []).filter(Boolean);
    if (!el) return;
    if (!fids.length) { el.innerHTML = ''; return; }
    el.classList.add('npv');
    el.innerHTML = fids.map(function (f, i) {
      var nm = (opt.names && opt.names[i]) || (res[f] && res[f].name) || ('파일 ' + (i + 1));
      return '<div class="npv-f" data-fid="' + esc(f) + '"><div class="npv-h"><b>' + esc(nm) + '</b>' +
        '<button type="button" data-npv="big" data-i="' + i + '" aria-label="크게 보기">크게</button>' +
        (opt.drive ? '<a href="' + esc(opt.drive(f)) + '" target="_blank" rel="noopener">원본</a>' : '') +
        '</div><div class="npv-b"><div class="npv-w"><i></i>불러오는 중…</div></div></div>';
    }).join('');
    var shown = {};
    fids.forEach(function (f, i) {
      var box = el.querySelectorAll('.npv-f')[i], body = box.querySelector('.npv-b');
      get(f, opt.call).then(function (r) {
        if (!box.isConnected) return;
        var nm = box.querySelector('.npv-h b');
        if (nm && !(opt.names && opt.names[i]) && r.name) nm.textContent = r.name;
        return paint(body, f, r, opt).then(function (P) { shown[f] = P; });
      }).catch(function (e) {
        if (!box.isConnected) return;
        body.innerHTML = '<div class="npv-e">' + esc(errMsg(e)) + '<div class="a"><button type="button" data-npv="retry">다시 시도</button>' +
          (opt.drive ? '<a href="' + esc(opt.drive(f)) + '" target="_blank" rel="noopener">원본 열기</a>' : '') + '</div></div>';
      });
    });
    el.onclick = function (ev) {
      var t = ev.target.closest('[data-npv]'), img = ev.target.closest('.npv-b img');
      if (img) { var b0 = img.closest('.npv-f'), j = Array.prototype.indexOf.call(el.querySelectorAll('.npv-f'), b0); big(fids, j, opt, Array.prototype.indexOf.call(b0.querySelectorAll('img'), img)); return; }
      if (!t) return;
      if (t.getAttribute('data-npv') === 'big') big(fids, Number(t.getAttribute('data-i')) || 0, opt, 0);
      if (t.getAttribute('data-npv') === 'retry') mount(el, fids, opt);
    };
  }

  /** 크게 보기: 화면 전체 · 확대(＋ −) · 돌리기 · 원본 · 닫기 (뒤로 가기 = 닫기) */
  function big(fids, i, opt, page) {
    css();
    var f = fids[i];
    var o = document.createElement('div');
    o.className = 'npv-o';
    o.setAttribute('role', 'dialog');
    o.setAttribute('aria-label', '크게 보기');
    var nm = (opt.names && opt.names[i]) || (res[f] && res[f].name) || '파일';
    o.innerHTML = '<div class="npv-ob"><b>' + esc(nm) + (fids.length > 1 ? ' (' + (i + 1) + '/' + fids.length + ')' : '') + '</b>' +
      (fids.length > 1 ? '<button type="button" data-o="prev" aria-label="이전 파일"' + (i <= 0 ? ' disabled' : '') + '>‹</button><button type="button" data-o="next" aria-label="다음 파일"' + (i >= fids.length - 1 ? ' disabled' : '') + '>›</button>' : '') +
      '<button type="button" data-o="out" aria-label="축소">−</button><button type="button" data-o="in" aria-label="확대">＋</button><button type="button" data-o="rot" aria-label="돌리기">⟳</button>' +
      (opt.drive ? '<a href="' + esc(opt.drive(f)) + '" target="_blank" rel="noopener" aria-label="원본 열기">원본</a>' : '') +
      '<button type="button" data-o="x" aria-label="닫기">×</button></div><div class="npv-os"><div class="npv-w" style="color:#fff"><i></i>불러오는 중…</div></div>';
    document.body.appendChild(o);
    var sc = o.querySelector('.npv-os'), z = 1, rot = 0, urls = [];
    var lay = function () {
      var w = sc.clientWidth - 16, ps = sc.querySelectorAll('.pg');
      Array.prototype.forEach.call(ps, function (p) {
        var img = p.querySelector('img'), r = img && img.naturalWidth ? img.naturalHeight / img.naturalWidth : 1.414, side = rot % 180 !== 0;
        var bw = Math.round(w * z), bh = Math.round(bw * r);
        p.style.width = (side ? bh : bw) + 'px'; p.style.height = (side ? bw : bh) + 'px'; p.style.position = 'relative';
        img.style.position = 'absolute'; img.style.width = bw + 'px'; img.style.height = bh + 'px'; img.style.left = '0'; img.style.top = '0';
        img.style.transformOrigin = 'top left';
        img.style.transform = rot === 90 ? 'translate(' + bh + 'px,0) rotate(90deg)' : rot === 180 ? 'translate(' + bw + 'px,' + bh + 'px) rotate(180deg)' : rot === 270 ? 'translate(0,' + bw + 'px) rotate(270deg)' : '';
      });
    };
    get(f, opt.call).then(function (r) {
      if (r.kind === 'pdf') return pdfPages(f, r, Math.max(1600, pxFor(sc))).then(function (P) { return P.urls; });
      if (r.kind === 'img') return [r._url || (r._url = blobUrl(r.b64, r.mime))];
      var tmp = document.createElement('div');
      return paint(tmp, f, r, opt).then(function () { sc.innerHTML = '<div style="background:#fff;border-radius:8px;overflow:auto">' + tmp.innerHTML + '</div>'; return null; });
    }).then(function (u) {
      if (!u) return;
      urls = u;
      sc.innerHTML = u.map(function (x, k) { return '<div class="pg"><img alt="' + esc(nm + ' ' + (k + 1) + '쪽') + '" src="' + x + '"></div>'; }).join('');
      var imgs = sc.querySelectorAll('img'), left = imgs.length;
      Array.prototype.forEach.call(imgs, function (im) { if (im.complete) { if (!--left) go(); } else im.onload = im.onerror = function () { if (!--left) go(); }; });
      if (!imgs.length) go();
      function go() { lay(); var t = sc.querySelectorAll('.pg')[page || 0]; if (t && page) sc.scrollTop = t.offsetTop; }
    }).catch(function (e) { sc.innerHTML = '<div class="npv-e" style="background:#fff;border-radius:8px">' + esc(errMsg(e)) + '</div>'; });
    var close = function () {
      o.remove(); window.removeEventListener('resize', lay); document.removeEventListener('keydown', key, true);
      if (history.state && history.state.npv) { closing = true; history.back(); }
      window.removeEventListener('popstate', pop);
    };
    var closing = false;
    var pop = function () { if (closing) { closing = false; return; } o.remove(); window.removeEventListener('resize', lay); document.removeEventListener('keydown', key, true); window.removeEventListener('popstate', pop); };
    var key = function (e) { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
    try { history.pushState(Object.assign({}, history.state || {}, { npv: 1 }), ''); window.addEventListener('popstate', pop); } catch (e) { /* 기록 없이 */ }
    window.addEventListener('resize', lay);
    document.addEventListener('keydown', key, true);
    o.addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-o]');
      if (!b) return;
      var k = b.getAttribute('data-o');
      if (k === 'x') close();
      else if (k === 'in') { z = Math.min(4, z * 1.4); lay(); }
      else if (k === 'out') { z = Math.max(0.5, z / 1.4); lay(); }
      else if (k === 'rot') { rot = (rot + 90) % 360; lay(); }
      else if (k === 'prev' || k === 'next') { close(); setTimeout(function () { big(fids, i + (k === 'next' ? 1 : -1), opt, 0); }, 0); }
    });
    var cb = o.querySelector('[data-o="x"]'); if (cb) cb.focus();
  }

  /** PDF 그리는 도구를 미리 읽어 둠 (발주서 칸 · 확인 화면을 열면 쉬는 틈에) — 처음 PDF를 누를 때 기다리지 않게 */
  function warm() {
    if (warm.done) return;
    warm.done = true;
    var go = function () { loadPdf().then(function () { try { fetch(BASE + 'lib/pdfjs/pdf.worker.min.js', { credentials: 'same-origin' }).catch(function () {}); } catch (e) { /* 그대로 */ } }, function () { warm.done = false; }); };
    if (window.requestIdleCallback) requestIdleCallback(go, { timeout: 3000 }); else setTimeout(go, 1500);
  }
  window.NMCPreview = { mount: mount, prefetch: prefetch, get: get, big: big, warm: warm, has: function (fid) { return !!res[fid]; } };
})();
