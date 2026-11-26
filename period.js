/* 목록 보기 기간 · 업체명 바로 찾기 (2026-11-26 지시: "일별 월별 3개월 6개월 1년으로", "업체검색하면 리스트 바로 나올수있도록")
   거래명세서 · 세금계산서 · 발주서 화면이 같이 씀.
   - 일별 = 그날, 월별 = 그 달, 3개월 · 6개월 · 1년 = 이번 달까지 꽉 찬 달 3 · 6 · 12개 (‹ › = 그만큼 앞 · 뒤로, 달마다 합계가 그 달 전체)
   - 찾기 = 띄어쓰기 · (주) · ㈜ · 주식회사 · (유) · 유한회사 무시, 한글을 치는 중인 끝 자모는 빼고 (서버 coNorm_과 같은 기준)
   - 받은 목록은 이 탭 안에서만 기억(sessionStorage) — 창을 닫으면 지워짐 */
(function () {
  'use strict';
  var MODES = [['d', '일별'], ['m', '월별'], ['3', '3개월'], ['6', '6개월'], ['y', '1년']];
  var MON = { '3': 3, '6': 6, y: 12 };
  var WD = ['일', '월', '화', '수', '목', '금', '토'];
  function P3(d) { return [Number(d.slice(0, 4)), Number(d.slice(5, 7)), Number(d.slice(8, 10))]; }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function addDays(d, n) { var p = P3(d); return new Date(Date.UTC(p[0], p[1] - 1, p[2] + n)).toISOString().slice(0, 10); }
  function addYm(ym, k) { var y = Number(ym.slice(0, 4)), m = Number(ym.slice(5, 7)) - 1 + k; y += Math.floor(m / 12); m = ((m % 12) + 12) % 12; return y + '-' + pad(m + 1); }
  function lastDay(ym) { return ym + '-' + pad(new Date(Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 0)).getUTCDate()); }
  function wd(d) { var p = P3(d); return WD[new Date(Date.UTC(p[0], p[1] - 1, p[2])).getUTCDay()]; }
  function dateKo(d) { var p = P3(d); return p[0] + '년 ' + p[1] + '월 ' + p[2] + '일'; }
  function ymKo(ym) { return Number(ym.slice(0, 4)) + '년 ' + Number(ym.slice(5, 7)) + '월'; }
  function okMode(v) { return MODES.some(function (m) { return m[0] === v; }); }

  /** 지금 보기의 기간. st = { pm, day, ym, off } → { from, to, upto(목록에 넣을 끝 — 이번 기간이면 앞날짜 것까지), label, unit, key } */
  function range(st, today) {
    var pm = okMode(st.pm) ? st.pm : 'm';
    if (pm === 'd') { var d = st.day || today; return { pm: pm, from: d, to: d, upto: d, label: dateKo(d) + ' (' + wd(d) + ')', cur: d === today, unit: '날', key: 'd:' + d }; }
    if (pm === 'm') { var ym = st.ym || today.slice(0, 7); return { pm: pm, from: ym + '-01', to: lastDay(ym), upto: lastDay(ym), label: ymKo(ym), cur: ym === today.slice(0, 7), unit: '달', key: 'm:' + ym }; }
    var N = MON[pm], off = Math.min(0, Math.round(Number(st.off) || 0)), e = addYm(today.slice(0, 7), off * N), s = addYm(e, -(N - 1));
    var lab = s.slice(0, 4) === e.slice(0, 4) ? Number(s.slice(0, 4)) + '년 ' + Number(s.slice(5, 7)) + '월 ~ ' + Number(e.slice(5, 7)) + '월' : ymKo(s) + ' ~ ' + ymKo(e);
    return { pm: pm, from: s + '-01', to: lastDay(e), upto: off === 0 ? '9999-12-31' : lastDay(e), label: lab, cur: off === 0, unit: MODES.filter(function (m) { return m[0] === pm; })[0][1], key: pm + ':' + off };
  }
  /** ‹ › 한 칸 */
  function shift(st, k, today) {
    if (st.pm === 'd') st.day = addDays(st.day || today, k);
    else if (st.pm === 'm') st.ym = addYm(st.ym || today.slice(0, 7), k);
    else st.off = Math.min(0, (Math.round(Number(st.off) || 0)) + k);
    return st;
  }
  /** 앞으로 갈 수 있는지 (일별 = 오늘 + 31일까지, 월별 = 다음 달까지, 기간 = 이번 기간까지) · 뒤로 갈 수 있는지 (가장 오래된 날 first) */
  function canNext(st, today) {
    if (st.pm === 'd') return (st.day || today) < addDays(today, 31);
    if (st.pm === 'm') return (st.ym || today.slice(0, 7)) < addYm(today.slice(0, 7), 1);
    return (Number(st.off) || 0) < 0;
  }
  function canPrev(st, today, first) { return !first || range(st, today).from > first; }
  /** 보기 단추 5개 (data-ACT="pm" data-v) */
  function chips(pm, act, off) {
    return '<div class="pms" role="group" aria-label="보기 기간">' + MODES.map(function (m) {
      return '<button type="button" class="pm" data-' + act + '="' + m[0] + '" aria-pressed="' + (!off && pm === m[0]) + '">' + m[1] + '</button>';
    }).join('') + '</div>';
  }
  /** 보기를 바꿀 때: 일별 = 오늘(또는 보던 달의 오늘 · 1일), 월별 = 보던 날의 달, 기간 = 이번 기간 */
  function setMode(st, pm, today) {
    var prev = range(st, today);
    if (pm === 'd') st.day = prev.pm === 'm' && prev.from.slice(0, 7) !== today.slice(0, 7) ? prev.from : (st.day && prev.pm === 'd' ? st.day : today);
    if (pm === 'm') st.ym = prev.pm === 'd' ? prev.from.slice(0, 7) : prev.pm === 'm' ? (st.ym || today.slice(0, 7)) : today.slice(0, 7);
    if (MON[pm]) st.off = 0;
    st.pm = pm;
    return st;
  }

  /* ── 업체명 찾기 ── */
  function norm(v) { return String(v == null ? '' : v).replace(/\s+/g, '').replace(/\(주\)|㈜|주식회사|\(유\)|유한회사/g, '').toLowerCase(); }
  /** 찾는 말 → 정규화한 낱말들 (끝의 치는 중인 자모 빼고, (주)만이면 []) */
  function terms(q) {
    var t = String(q || '').replace(/[ㄱ-ㅎㅏ-ㅣ]+$/, '').trim();
    return t ? t.split(/\s+/).map(norm).filter(String).slice(0, 6) : [];
  }
  function hit(hay, T) { var h = norm(hay); for (var i = 0; i < T.length; i++) if (h.indexOf(T[i]) < 0) return false; return true; }
  /** 같은 열쇠로 묶기 (순서 유지) → [{ k, xs }] */
  function group(list, keyOf) {
    var G = {}, out = [];
    list.forEach(function (x) { var k = keyOf(x); if (!G[k]) { G[k] = { k: k, xs: [] }; out.push(G[k]); } G[k].xs.push(x); });
    return out;
  }

  /* ── 이 탭 안 임시 저장 (stale-while-revalidate: 저장해 둔 것을 먼저 보이고 서버 것으로 바꿈) ── */
  var PFX = 'nmc_c_';
  var cache = {
    get: function (k, maxMs) {
      try {
        var o = JSON.parse(sessionStorage.getItem(PFX + k) || 'null');
        if (!o || typeof o !== 'object' || !o.at) return null;
        if (maxMs && Date.now() - o.at > maxMs) return null;
        return o;
      } catch (e) { return null; }
    },
    set: function (k, v) {
      var s;
      try { s = JSON.stringify({ at: Date.now(), v: v }); } catch (e) { return false; }
      if (s.length > 2500000) return false;
      for (var t = 0; t < 2; t++) {
        try { sessionStorage.setItem(PFX + k, s); return true; } catch (e) {
          try {   // 자리가 모자라면 가장 오래된 임시 저장부터 지우고 한 번 더
            var ks = [];
            for (var i = 0; i < sessionStorage.length; i++) { var n = sessionStorage.key(i); if (n && n.indexOf(PFX) === 0 && n !== PFX + k) ks.push(n); }
            ks.sort(function (a, b) { var x = 0, y = 0; try { x = JSON.parse(sessionStorage.getItem(a)).at; y = JSON.parse(sessionStorage.getItem(b)).at; } catch (er) { /* 0 */ } return x - y; });
            if (!ks.length) return false;
            sessionStorage.removeItem(ks[0]);
          } catch (er) { return false; }
        }
      }
      return false;
    },
    del: function (k) { try { sessionStorage.removeItem(PFX + k); } catch (e) { /* 그대로 */ } }
  };

  window.NMCPeriod = { MODES: MODES, range: range, shift: shift, canNext: canNext, canPrev: canPrev, chips: chips, setMode: setMode, okMode: okMode,
    norm: norm, terms: terms, hit: hit, group: group, cache: cache, addDays: addDays, addYm: addYm, lastDay: lastDay, wd: wd, dateKo: dateKo, ymKo: ymKo };
})();
