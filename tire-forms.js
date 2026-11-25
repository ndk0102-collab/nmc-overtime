/* 폐타이어 관리대장 서식 (2026-11-25 20:10 지시).
   "이 6가지가 서로 다 맞아떨어져야된다 … 1년이 끝나면 이 6가지를 동시에 우리가 다운받아갈수있게 만들어라."
   폐타이어 창구(tire.html)가 서버에서 받은 원장 하나로 서식을 만듭니다:
   서식-1 보고서 · 서식-2 보고서 · 세금계산서(매출) · 계량증명서(매입,매출) · 총괄표.
   숫자는 model() 한 곳에서만 셈 → 같은 숫자가 서식마다 같게 들어감 (서식끼리 어긋날 수 없음).
   회사 이름 · 거래처 · 숫자는 이 파일에 없습니다 (관리자 로그인 뒤 서버 자료). 엑셀은 ExcelJS(MIT)로 만듦. */
(function (G) {
  'use strict';
  var KINDS = ['고무분말', '철심', '섬유'];
  var ITEMS = ['고무분말', '미분', '타이어코드', '타이어비드'];
  var ITEM_KIND = { '고무분말': '고무분말', '미분': '고무분말', '타이어코드': '철심', '타이어비드': '철심' };
  var LIMIT = { prodDay: 60000, inLoad: 40000, weighGap: 10 };   // 점검 기준: 하루 고무분말 · 1대 입고가 이보다 크면 확인 알림, 계량 실중량과 판매 수량 차이가 이보다 크면 안내 (저울 10kg 단위)

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function mOf(s) { return Number(String(s).slice(5, 7)); }
  function nOr(v, d) { return v == null || v === '' || isNaN(Number(v)) ? d : Number(v); }
  function normCo(s) { return String(s || '').replace(/주식회사|유한회사|\(주\)|㈜|\(유\)|\s/g, ''); }
  /** 재고기록 출고 → 세금계산서 품목 (SBR 고무분말 미분 → 미분, 그 밖의 크기 → 고무분말, 분철 코드 · 비드) */
  function itemOf(o) {
    if (o.prod === '분철') return /비드/.test(o.color || '') ? '타이어비드' : '타이어코드';
    return String(o.color || '') === '미분' ? '미분' : '고무분말';
  }
  function weighOf(s) {
    if (!s) return null;
    var w = { car: s.car || '', no: s.no || '', t1: s.t1 || '', t2: s.t2 || '', gross: s.gross == null ? null : Number(s.gross), tare: s.tare == null ? null : Number(s.tare) };
    w.net = w.gross != null && w.tare != null ? w.gross - w.tare : null;
    return (w.car || w.no || w.t1 || w.t2 || w.net != null) ? w : null;
  }
  function cmpIn(a, b) {
    return a.date < b.date ? -1 : a.date > b.date ? 1 : (a.t1 || '99') < (b.t1 || '99') ? -1 : (a.t1 || '99') > (b.t1 || '99') ? 1 :
      String(a.at || '') < String(b.at || '') ? -1 : String(a.at || '') > String(b.at || '') ? 1 : (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  }
  function cmpLine(key) {
    return function (a, b) {
      return a[key] < b[key] ? -1 : a[key] > b[key] ? 1 : a.date < b.date ? -1 : a.date > b.date ? 1 : (a.key < b.key ? -1 : a.key > b.key ? 1 : 0);
    };
  }
  function z3() { return { '고무분말': 0, '철심': 0, '섬유': 0 }; }

  /* ─────────── 숫자 한 곳 ─────────── */
  /** 서버 apiTire 자료 → 서식에 들어가는 숫자 전부 */
  function model(d) {
    d = d || {};
    var y = String(d.y || ''), today = String(d.today || ''), set = d.set || {};
    var inY = function (s) { return String(s || '').slice(0, 4) === y; };
    var def = d.def || {};   // 기본 수율 · 철심 비율 · 섬유는 서버가 보냄 (이 파일에 회사 계산 기준을 두지 않음)
    var R = { yield: nOr(set.yield, nOr(def.yield, 1)), steelR: nOr(set.steelR, nOr(def.steelR, 0)), fiberKg: nOr(set.fiberKg, nOr(def.fiberKg, 0)) };
    var st0 = { tire: nOr(set.tire, 0), '고무분말': nOr(set.rubber, 0), '철심': nOr(set.steel, 0), '섬유': nOr(set.fiber, 0) };
    var lastM = today.slice(0, 4) === y ? mOf(today) : (today && today.slice(0, 4) < y ? 0 : 12);
    var coName = String((d.co && d.co.name) || ''), coShort = normCo(coName) || coName;
    var checks = [];
    var chk = function (lv, m, t, ref, ms) { checks.push({ lv: lv, m: m, t: t, ref: ref || null, ms: ms || null }); };
    var neg = { tire: [], '고무분말': [], '철심': [], '섬유': [] };   // 달 말 재고가 음수인 달 (한 줄로 모아 알림)

    // 1) 입고 (폐타이어 반입 1대 = 1줄)
    var ins = (d.ins || []).filter(function (r) { return inY(r.date); }).map(function (r) {
      return { id: r.id, date: r.date, co: r.co, item: r.item || '폐타이어', car: r.car || '', no: r.no || '', t1: r.t1 || '', t2: r.t2 || '',
        gross: r.gross == null ? null : Number(r.gross), tare: r.tare == null ? null : Number(r.tare), net: Number(r.net) || 0, memo: r.memo || '', src: r.src || '', at: r.at || '' };
    }).sort(cmpIn);
    ins.forEach(function (r) { if (r.net > LIMIT.inLoad) chk('warn', mOf(r.date), r.date + ' ' + r.co + ' 입고 ' + r.net.toLocaleString('ko-KR') + 'kg — 1대로 보기에 큰 숫자입니다. 계량표를 확인해 주십시오.', { v: 'in', id: r.id }); });

    // 2) 생산 (창구에서 넣은 날 = 그 값, 넣지 않은 날 = 생산 화면 SBR 고무분말 생산 합)
    var man = {}, auto = {}, dset = {};
    (d.prod || []).forEach(function (p) { if (inY(p.date)) { man[p.date] = p; dset[p.date] = 1; } });
    (d.stockProd || []).forEach(function (a) { if (inY(a[0])) { auto[a[0]] = Number(a[1]) || 0; dset[a[0]] = 1; } });
    var days = [];
    Object.keys(dset).sort().forEach(function (date) {
      var p = man[date], a = auto[date] || 0, rub, stl, fib, stAuto, fbAuto;
      if (p) {
        rub = Number(p.rubber) || 0;
        stAuto = p.steel == null || p.steel === ''; stl = stAuto ? Math.round(rub * R.steelR) : Number(p.steel);
        fbAuto = p.fiber == null || p.fiber === ''; fib = fbAuto ? (rub > 0 ? R.fiberKg : 0) : Number(p.fiber);
      } else {
        if (a <= 0) return;
        rub = a; stl = Math.round(a * R.steelR); fib = R.fiberKg; stAuto = true; fbAuto = true;
      }
      var day = { date: date, rubber: rub, steel: stl, fiber: fib, tot: rub + stl + fib, stAuto: stAuto, fbAuto: fbAuto, manual: !!p, stock: a,
        src: p ? (p.src || '직접') : '생산 화면', memo: p ? (p.memo || '') : '' };
      days.push(day);
      if (rub > LIMIT.prodDay) chk('warn', mOf(date), date + ' 고무분말 생산 ' + rub.toLocaleString('ko-KR') + 'kg — 하루 생산으로 보기에 큰 숫자입니다.' + (p ? '' : ' 생산 화면 기록을 확인해 주십시오.'), { v: 'prod', id: date });
      if (p && a > 0 && rub !== a) chk('info', mOf(date), date + ' 서식 고무분말 ' + rub.toLocaleString('ko-KR') + 'kg ≠ 생산 화면 ' + a.toLocaleString('ko-KR') + 'kg (서식은 창구에서 넣은 값으로 씀).', { v: 'prod', id: date });
    });
    var dayBy = {};
    days.forEach(function (x) { dayBy[x.date] = x; });

    // 3) 판매 (재고기록 출고 SBR 고무분말 · 분철 + 보완 · 추가 판매)
    var supBy = {}, outIds = {};
    (d.out || []).forEach(function (o) { outIds[o.id] = 1; });
    (d.sales || []).forEach(function (s) {
      if (!s.link) return;
      if (outIds[s.link]) supBy[s.link] = s;
      else chk('warn', mOf(s.date), s.date + ' 판매 보완 기록의 출고(' + s.link + ')가 없습니다 (출고가 지워졌거나 날짜가 다른 해로 바뀜).', { v: 'sale', id: 's:' + s.id });
    });
    var lines = [];
    (d.out || []).forEach(function (o) {
      if (!inY(o.date)) return;
      var s = supBy[o.id] || null, item = itemOf(o), qty = Number(o.qty) || 0;
      var oprice = o.price == null || o.price === '' ? null : Number(o.price);
      var price = s && s.price != null ? Number(s.price) : oprice;
      var supply = s && s.supply != null ? Number(s.supply) : (price != null ? Math.round(qty * price) : null);
      var tax = s && s.tax != null ? Number(s.tax) : (supply != null ? Math.floor(supply / 10) : null);
      lines.push({ key: 'o:' + o.id, src: 'out', id: o.id, sid: s ? s.id : '', date: o.date, invDate: (s && s.invDate) || '', sdate: (s && s.invDate) || o.date,
        cust: o.cust || '', item: item, kind: ITEM_KIND[item], spec: '', qty: qty, price: price, supply: supply, tax: tax, oprice: oprice,
        prod: o.prod, color: o.color || '', w: weighOf(s), ex: !!(s && s.ex), own: !!coShort && normCo(o.cust) === coShort, memo: s ? (s.memo || '') : '', omemo: o.memo || '' });
    });
    (d.sales || []).forEach(function (s) {
      if (s.link || !inY(s.date)) return;
      var item = ITEM_KIND[s.item] ? s.item : '고무분말';
      lines.push({ key: 's:' + s.id, src: 'add', id: s.id, sid: s.id, date: s.date, invDate: s.invDate || '', sdate: s.invDate || s.date,
        cust: s.cust || '', item: item, kind: ITEM_KIND[item], spec: s.spec || '', qty: Number(s.qty) || 0,
        price: s.price == null ? null : Number(s.price), supply: s.supply == null ? null : Number(s.supply), tax: s.tax == null ? null : Number(s.tax), oprice: null,
        w: weighOf(s), ex: false, own: !!coShort && normCo(s.cust) === coShort, memo: s.memo || '', omemo: '' });
    });
    lines.sort(cmpLine('sdate'));
    lines.forEach(function (l) {
      if (l.ex) return;
      var m = mOf(l.sdate);
      if (!inY(l.sdate)) chk('warn', mOf(l.date), l.date + ' ' + l.cust + ' ' + l.item + ' — 계산서 발행일(' + l.invDate + ')이 다른 해라서 올해 서식에 들어가지 않습니다.', { v: 'sale', id: l.key });
      else if (!l.own && l.supply == null) chk('warn', m, l.sdate + ' ' + l.cust + ' ' + l.item + ' ' + l.qty.toLocaleString('ko-KR') + 'kg — 단가가 없어 공급가액 · 세액을 계산하지 못했습니다.', { v: 'sale', id: l.key });
      if (l.w && l.w.net != null && Math.abs(l.w.net - l.qty) > LIMIT.weighGap) chk('info', mOf(l.date), l.date + ' ' + l.cust + ' 계량 실중량 ' + l.w.net.toLocaleString('ko-KR') + 'kg ≠ 판매 수량 ' + l.qty.toLocaleString('ko-KR') + 'kg (차이 ' + Math.abs(l.w.net - l.qty).toLocaleString('ko-KR') + 'kg).', { v: 'sale', id: l.key });
    });
    var saleL = lines.filter(function (l) { return !l.ex && inY(l.sdate); });                  // 서식-2 · 총괄표 (자사 사용 = 처리량)
    var taxL = saleL.filter(function (l) { return !l.own; });                                    // 세금계산서(매출)
    var weighL = lines.filter(function (l) { return !l.ex && !l.own; }).slice().sort(cmpLine('date'));   // 계량증명서 매출 (출고일)

    // 4) 달마다 합 · 재고 (같은 숫자를 모든 서식이 씀)
    var months = [], tire = st0.tire, stk = { '고무분말': st0['고무분말'], '철심': st0['철심'], '섬유': st0['섬유'] };
    var cum = { yld: 0, rec: 0, inKg: 0, prod: z3(), sale: z3(), steelAmt: 0 };
    for (var m = 1; m <= lastM; m++) {
      var T = { m: m, ins: [], days: [], sales: [], tax: [], wOut: [], inKg: 0, rec: 0, prod: z3(), sale: z3(), amt: z3(), supply: 0, vat: 0, taxKg: 0, wInNet: 0, wOutNet: 0 };
      ins.forEach(function (r) { if (mOf(r.date) === m) { T.ins.push(r); T.inKg += r.net; } });
      days.forEach(function (x) { if (mOf(x.date) === m && x.tot > 0) { T.days.push(x); T.rec += x.tot; T.prod['고무분말'] += x.rubber; T.prod['철심'] += x.steel; T.prod['섬유'] += x.fiber; } });
      saleL.forEach(function (l) { if (mOf(l.sdate) === m) { T.sales.push(l); T.sale[l.kind] += l.qty; if (l.supply != null && !l.own) T.amt[l.kind] += l.supply; } });
      taxL.forEach(function (l) { if (mOf(l.sdate) === m) { T.tax.push(l); T.taxKg += l.qty; T.supply += l.supply || 0; T.vat += l.tax || 0; } });
      weighL.forEach(function (l) { if (mOf(l.date) === m) { T.wOut.push(l); T.wOutNet += l.w && l.w.net != null ? l.w.net : l.qty; } });
      T.wInNet = T.inKg;
      T.yld = Math.round(T.inKg * R.yield);
      T.tire0 = tire; tire = tire + T.yld - T.rec; T.tire = tire;
      T.stk0 = {}; T.stk = {};
      KINDS.forEach(function (k) { T.stk0[k] = stk[k]; stk[k] = stk[k] + T.prod[k] - T.sale[k]; T.stk[k] = stk[k]; cum.prod[k] += T.prod[k]; cum.sale[k] += T.sale[k]; });
      cum.yld += T.yld; cum.rec += T.rec; cum.inKg += T.inKg; cum.steelAmt += T.amt['철심']; T.cumSteelAmt = cum.steelAmt;
      T.cum = { yld: cum.yld, rec: cum.rec, inKg: cum.inKg, prod: Object.assign({}, cum.prod), sale: Object.assign({}, cum.sale) };
      if (T.tire < 0) neg.tire.push([m, T.tire]);
      KINDS.forEach(function (k) { if (T.stk[k] < 0) neg[k].push([m, T.stk[k]]); });
      months.push(T);
    }
    var mtxt = function (a) {
      var ms = a.map(function (x) { return x[0]; }), run = ms.every(function (v, i) { return !i || v === ms[i - 1] + 1; });
      return ms.length === 1 ? ms[0] + '월' : run ? ms[0] + '월~' + ms[ms.length - 1] + '월' : ms.join(' · ') + '월';
    };
    var low = function (a) {   // 한 달이면 그 값, 여러 달이면 가장 낮은 달
      if (a.length === 1) return a[0][1].toLocaleString('ko-KR') + 'kg';
      var w = a[0]; a.forEach(function (x) { if (x[1] < w[1]) w = x; }); return '가장 낮은 달 ' + w[0] + '월 ' + w[1].toLocaleString('ko-KR') + 'kg';
    };
    if (neg.tire.length) chk('bad', neg.tire[0][0], mtxt(neg.tire) + ' 말 폐타이어 보관량이 음수입니다 (' + low(neg.tire) + ') — 재활용량이 반입(수율 적용)보다 많습니다. 입고 누락 또는 생산량 · 전년 재고를 확인해 주십시오.', { v: 'in' }, neg.tire.map(function (x) { return x[0]; }));
    KINDS.forEach(function (k) {
      if (neg[k].length) chk('bad', neg[k][0][0], mtxt(neg[k]) + ' 말 ' + k + ' 재고가 음수입니다 (' + low(neg[k]) + ') — 판매가 생산 + 재고보다 많습니다. 전년 재고 · 생산 · 판매를 확인해 주십시오.', { v: k === '철심' || k === '섬유' ? 'prod' : 'sale' }, neg[k].map(function (x) { return x[0]; }));
    });
    if (set.tire == null || set.rubber == null || set.steel == null) chk('warn', 0, y + '년 전년 재고(폐타이어 · 고무분말 · 철심)가 비어 있어 0으로 계산했습니다. 설정에서 넣어 주십시오.', { v: 'set' });
    var order = { bad: 0, warn: 1, info: 2 };
    checks.sort(function (a, b) { return order[a.lv] - order[b.lv] || a.m - b.m; });
    return { y: y, today: today, lastM: lastM, R: R, st0: st0, co: { name: coName, short: coShort || coName }, ins: ins, days: days, dayBy: dayBy,
      lines: lines, saleL: saleL, taxL: taxL, weighL: weighL, months: months, checks: checks,
      end: months.length ? months[months.length - 1] : null };
  }

  /* ─────────── 엑셀 공통 ─────────── */
  var BS = { m: 'medium', t: 'thin', h: 'hair', d: 'double', o: 'dotted' };
  /** 테두리 'm t . h' = 왼쪽 오른쪽 위 아래 (m 보통 굵게 · t 가늘게 · h 아주 가늘게 · d 두 줄 · o 점선 · . 없음) */
  function bd(s) {
    var p = String(s || '. . . .').split(' '), o = {}, k = ['left', 'right', 'top', 'bottom'];
    for (var i = 0; i < 4; i++) if (BS[p[i]]) o[k[i]] = { style: BS[p[i]] };
    return o;
  }
  var YEL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
  var BLU = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
  var NF = { kg: '#,##0_ ', kgR: '#,##0_);[Red]\\(#,##0\\)', acc: '_-* #,##0_-;\\-* #,##0_-;_-* "-"_-;_-@_-', md: 'm"/"d;@', hm: 'h:mm;@', pct: '0.0_);[Red]\\(0.0\\)', int: '0_ ' };
  function C(ws, r, c, v, o) {
    var cell = ws.getCell(r, c);
    if (v !== undefined && v !== null && v !== '') cell.value = v;
    if (o) {
      if (o.f) cell.font = { name: o.f[0], size: o.f[1], bold: !!o.f[2], color: o.f[3] ? { argb: o.f[3] } : undefined };
      if (o.a) cell.alignment = { horizontal: o.a[0] || undefined, vertical: o.a[1] || 'middle', wrapText: !!o.a[2], shrinkToFit: !!o.a[3] };
      if (o.n) cell.numFmt = o.n;
      if (o.b) cell.border = bd(o.b);
      if (o.fill) cell.fill = o.fill;
    }
    return cell;
  }
  /** 칸 합치기: ExcelJS mergeCells는 합친 칸들이 스타일 하나를 같이 써서 마지막 테두리가 전부를 덮음 → 스타일 없이 합치고, 끝에 테두리만 가장자리 칸에 나눠 줌 */
  function mg(ws, r1, c1, r2, c2) { ws.mergeCellsWithoutStyle(r1, c1, r2, c2); (ws.__mg = ws.__mg || []).push([r1, c1, r2, c2]); }
  function fixMerges(ws) {
    (ws.__mg || []).forEach(function (m) {
      var b = ws.getCell(m[0], m[1]).border || {};
      for (var r = m[0]; r <= m[2]; r++) for (var c = m[1]; c <= m[3]; c++) {
        if (r === m[0] && c === m[1]) continue;
        var cell = ws.getCell(r, c), cb = cell.border;
        if (cb && Object.keys(cb).length) continue;
        var o = {};
        if (c === m[1] && b.left) o.left = b.left;
        if (c === m[3] && b.right) o.right = b.right;
        if (r === m[0] && b.top) o.top = b.top;
        if (r === m[2] && b.bottom) o.bottom = b.bottom;
        if (Object.keys(o).length) cell.border = o;
      }
    });
  }
  function fx(f, r) { return { formula: f, result: r }; }
  function dval(s) { var p = String(s).split('-'); return new Date(Date.UTC(Number(p[0]), Number(p[1]) - 1, Number(p[2]))); }
  function tval(s) { var m = /^(\d{1,2}):(\d{2})/.exec(String(s || '')); return m ? (Number(m[1]) * 60 + Number(m[2])) / 1440 : null; }
  function serial(s) { var t = String(s || '').trim(); return /^\d{1,9}$/.test(t) ? Number(t) : t; }
  function col(n) { var s = ''; while (n > 0) { var q = (n - 1) % 26; s = String.fromCharCode(65 + q) + s; n = Math.floor((n - 1) / 26); } return s; }
  /** SUM(목록) — 255개를 넘으면 나눠 더함 */
  function sumList(refs) {
    if (!refs.length) return '0';
    var parts = [];
    for (var i = 0; i < refs.length; i += 250) parts.push('SUM(' + refs.slice(i, i + 250).join(',') + ')');
    return parts.join('+');
  }
  function sheet(wb, name, o) {
    var ws = wb.addWorksheet(name, { properties: { defaultRowHeight: o.rowH || 16.5 }, views: o.views || [{}] });
    (o.cols || []).forEach(function (w, i) { ws.getColumn(i + 1).width = w; });
    ws.pageSetup = Object.assign({ paperSize: 9, orientation: 'portrait', horizontalDpi: 600, verticalDpi: 600 }, o.page || {});
    return ws;
  }
  function newBook(ExcelJS) {
    var wb = new ExcelJS.Workbook();
    wb.creator = 'NMC 통합 관리';
    wb.calcProperties = { fullCalcOnLoad: true };
    return wb;
  }

  /* ─────────── 서식-1 보고서 (회수 · 재활용 관리 대장) ─────────── */
  function f1(wb, M) {
    var ws = sheet(wb, '서식-1 보고서', { cols: [11.12, 11, 9, 9, 9, 8.62, 9, 9, 9], page: { scale: 95, margins: { left: 0.7, right: 0.7, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3 } } });
    var B11 = ['바탕', 11, true], D9 = ['돋움', 9];
    var r = 1, prevCum = null, yTxt = String(M.R.yield);
    M.months.forEach(function (T, i) {
      var r0 = r;
      mg(ws, r0, 1, r0 + 1, 9);
      C(ws, r0, 1, '         재활용의무대상 제품,포장재의 회수,재활용 관리 대장', { f: ['바탕', 14, true], a: [null, 'middle'], b: 'm m m .' });
      for (var c = 2; c <= 9; c++) C(ws, r0, c, null, { b: c === 9 ? '. m m .' : '. . m .' });
      C(ws, r0 + 1, 1, null, { b: 'm . . .' }); C(ws, r0 + 1, 9, null, { b: '. m . .' });
      ws.getRow(r0).height = 18.75; ws.getRow(r0 + 1).height = 18.75;
      C(ws, r0 + 2, 1, '제품,포장재명: 폐타이어', { f: B11, a: [null, 'middle'], b: 'm . . .' });
      C(ws, r0 + 2, 9, '(단위:kg)', { f: ['바탕', 10], a: [null, 'middle'], b: '. m . m' });
      var h = r0 + 3, H = function (rr, cc, v, b, sz) { C(ws, rr, cc, v, { f: ['바탕', sz || 11, true], a: ['center', 'middle'], b: b }); };
      H(h, 1, '연월일', 'm m m .'); H(h, 2, '1)회수내역', 'm . m m'); H(h, 3, null, '. m m m'); H(h, 4, '처리내역', 'm . m m');
      H(h, 5, null, '. . m m'); H(h, 6, null, '. . m m'); H(h, 7, null, '. . m m'); H(h, 8, null, '. m m m'); H(h, 9, '4)보관량', 'm m m .');
      H(h + 1, 1, null, 'm m . .'); H(h + 1, 2, '업체명', 'm t m .'); H(h + 1, 3, '회수량', 't m m .'); H(h + 1, 4, '2)재활용', 'm . m t'); H(h + 1, 5, null, '. m m t');
      H(h + 1, 6, '3)그 밖의 사항', 'm . m t'); H(h + 1, 7, null, '. . m t'); H(h + 1, 8, null, '. m m t'); H(h + 1, 9, '전월보관량', 'm m . .', 10);
      H(h + 2, 1, null, 'm m . m'); H(h + 2, 2, null, 'm t . m'); H(h + 2, 3, null, 't m . m'); H(h + 2, 4, '방법및기준', '. t t m'); H(h + 2, 5, '재활용량', 't . t m');
      H(h + 2, 6, '업체명', 'm t t m'); H(h + 2, 7, '처리방법', 't t t m'); H(h + 2, 8, '처리량', 't m t m');
      ws.getRow(h + 2).height = 17.25;
      var iHdr = h + 2;
      C(ws, iHdr, 9, i === 0 ? T.tire0 : null, { f: B11, a: ['center', 'middle'], b: 'm m . m' });   // 원본: 전월보관량 값은 1월 칸에만
      // 줄: 입고 1대 = 1줄, 생산한 날은 그날 첫 줄에 재활용량 (입고 없는 생산일은 날짜만 있는 줄)
      var rows = [], byDate = {};
      T.ins.forEach(function (x) { var o = { date: x.date, co: x.co, net: x.net, rec: null }; rows.push(o); if (!byDate[x.date]) byDate[x.date] = o; });
      T.days.forEach(function (x) {
        if (byDate[x.date]) byDate[x.date].rec = x.tot;
        else { var o = { date: x.date, co: '', net: null, rec: x.tot }; rows.push(o); byDate[x.date] = o; }
      });
      rows.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
      var d0 = h + 3, rr = d0;
      rows.concat([null]).forEach(function (o) {
        C(ws, rr, 1, o ? dval(o.date) : null, { f: D9, a: ['right', 'middle'], n: NF.md, b: 'm m . h' });
        C(ws, rr, 2, o && o.co ? o.co : null, { f: D9, a: ['center', 'middle'], b: 'm t h h' });
        C(ws, rr, 3, o && o.net != null ? o.net : null, { f: D9, a: ['right', 'middle'], n: NF.kg, b: 't m . h' });
        C(ws, rr, 4, o ? '*' : null, { f: B11, a: ['center', 'middle'], b: '. t . h' });   // 원본: 방법및기준 '*'는 줄마다
        C(ws, rr, 5, o && o.rec != null ? o.rec : null, { f: D9, a: ['right', 'middle'], n: NF.kgR, b: '. . h h' });
        C(ws, rr, 6, null, { b: 'm t . h' }); C(ws, rr, 7, null, { b: 't t . h' }); C(ws, rr, 8, null, { b: 't m . h' }); C(ws, rr, 9, null, { b: '. m . h' });
        rr++;
      });
      var d1 = rr - 1, rs = rr, ry = rr + 1, rc = rr + 2;
      // 합계 · 수율 · 누계
      C(ws, rs, 1, T.m + '월합계', { f: ['돋움', 11, true], a: ['center', 'middle'], b: 'm m . t' });
      C(ws, rs, 2, null, { b: '. t . t' });
      C(ws, rs, 3, fx('SUM(C' + d0 + ':C' + d1 + ')', T.inKg), { f: D9, a: ['right', 'middle'], n: NF.kg, b: 't m . t' });
      C(ws, rs, 4, null, { b: '. t . t' });
      C(ws, rs, 5, fx('SUM(E' + d0 + ':E' + d1 + ')', T.rec), { f: D9, a: ['right', 'middle'], n: NF.kgR, b: 't m . t', fill: YEL });
      C(ws, rs, 6, null, { b: 'm t . t' }); C(ws, rs, 7, null, { b: 't t . t' }); C(ws, rs, 8, null, { b: 't m . t' }); C(ws, rs, 9, null, { b: '. m . t' });
      ws.getRow(rs).height = 17.25;
      mg(ws, ry, 1, ry, 2);
      C(ws, ry, 1, '수율적용(월계*' + yTxt + ')', { f: ['바탕', 14, true], a: [null, 'middle', false, true], b: 'm t m t' });
      C(ws, ry, 2, null, { b: '. t m t' });
      C(ws, ry, 3, fx('ROUND(C' + rs + '*' + yTxt + ',0)', T.yld), { f: D9, a: ['right', 'middle'], n: NF.kg, b: 't m t t' });
      C(ws, ry, 4, fx('SUM(D' + rs + ')', 0), { f: D9, a: [null, 'middle'], n: NF.kgR, b: '. t t t' }); C(ws, ry, 5, null, { b: 't . t t' });
      C(ws, ry, 6, null, { b: 'm t t t' }); C(ws, ry, 7, null, { b: 't t t t' }); C(ws, ry, 8, null, { b: 't m t t' }); C(ws, ry, 9, null, { b: '. m t t' });
      ws.getRow(ry).height = 18.75;
      C(ws, rc, 1, '누 계', { f: ['돋움', 11, true], a: ['center', 'middle'], b: 'm m t m' });
      C(ws, rc, 2, null, { b: '. t t m' });
      C(ws, rc, 3, fx(prevCum ? 'C' + prevCum + '+C' + ry : 'C' + ry, T.cum.yld), { f: D9, a: ['right', 'middle'], n: NF.kg, b: 't m t m' });
      C(ws, rc, 4, fx('SUM(D' + rs + ')', 0), { f: D9, a: [null, 'middle'], n: NF.kgR, b: '. t t m' });
      C(ws, rc, 5, fx(prevCum ? 'E' + prevCum + '+E' + rs : 'E' + rs, T.cum.rec), { f: D9, a: ['right', 'middle'], n: NF.kgR, b: 't . t m' });
      C(ws, rc, 6, null, { b: 'm t t m' }); C(ws, rc, 7, null, { b: 't t t m' }); C(ws, rc, 8, null, { b: 't m t m' });
      C(ws, rc, 9, fx('I' + (i === 0 ? iHdr : prevCum) + '+C' + ry + '-E' + rs, T.tire), { f: D9, a: ['right', 'middle'], n: NF.kgR, b: '. m t m' });
      prevCum = rc;
      r = rc + 2;
    });
    if (M.months.length) ws.pageSetup.printArea = 'A$1:I$' + (r - 2);
    fixMerges(ws);
    return ws;
  }

  /* ─────────── 서식-2 보고서 (생산 · 판매 및 부산물 처리 관리대장) ─────────── */
  var K2 = { '고무분말': '고무분말', '철심': '철 심', '섬유': '섬 유' }, K2S = { '고무분말': '고무분말', '철심': '철    심', '섬유': '섬    유' };
  function f2(wb, M) {
    var ws = sheet(wb, 'Sheet1', { cols: [9, 9, 13.38, 9, 9.88, 9, 9.88, 13.12, 11.12], page: { scale: 90, margins: { left: 0.7, right: 0.7, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3 } } });
    var BT11 = ['바탕', 11], BB11 = ['바탕', 11, true], DO8 = ['돋움', 8], DO10 = ['돋움', 10], BT8 = ['바탕', 8];
    var r = 1, prev = null, ratio = String(M.R.steelR);
    M.months.forEach(function (T, i) {
      var r0 = r;
      mg(ws, r0, 1, r0 + 1, 9);
      C(ws, r0, 1, '         재활용제품 생산.판매 및 부산물 처리 관리대장', { f: ['바탕', 11], a: [null, 'middle'], b: 'm m m .' });
      ws.getRow(r0).height = 16.5; ws.getRow(r0 + 1).height = 16.5;
      for (var c = 1; c <= 9; c++) C(ws, r0 + 2, c, c === 8 ? '       (단위:kg, 원)' : null, { f: BT11, a: [null, 'middle'], b: c === 1 ? 'm . . m' : c === 9 ? '. m . m' : '. . . m' });
      var h = r0 + 3;
      mg(ws, h, 1, h + 2, 1); mg(ws, h, 2, h, 3); mg(ws, h, 4, h, 8); mg(ws, h, 9, h + 2, 9);
      mg(ws, h + 1, 3, h + 2, 3); mg(ws, h + 1, 4, h + 2, 5); mg(ws, h + 1, 7, h + 2, 7);
      var H = function (rr, cc, v, b) { C(ws, rr, cc, v, { f: BB11, a: ['center', 'middle', cc === 4 && rr === h], b: b }); };
      H(h, 1, '연월일', 'm m m m'); H(h, 2, '1)생산내역', 'm m m m'); H(h, 3, null, '. m m m'); H(h, 4, '2)재활용제품 판매 맟 부산물 처리내역', 'm m m m');   // 원본 글자 그대로
      for (c = 5; c <= 8; c++) H(h, c, null, c === 8 ? '. m m m' : '. . m m');
      H(h, 9, '4)보관량', 'm m m m');
      H(h + 1, 1, null, 'm m . .'); H(h + 1, 2, '재활용제품', '. t . .'); H(h + 1, 3, '생산량', 't m m m'); H(h + 1, 4, '업체명', 'm t m m'); H(h + 1, 5, null, '. t m .');
      H(h + 1, 6, '판매량', 't t m t'); H(h + 1, 7, '단가', 't m m m'); H(h + 1, 8, '판매금액', 'm m m t'); H(h + 1, 9, null, 'm m . .');
      H(h + 2, 1, null, 'm m . m'); H(h + 2, 2, '및 부산물', '. t . m'); H(h + 2, 3, null, 't m . m'); H(h + 2, 4, null, 'm . . m'); H(h + 2, 5, null, '. t . m');
      H(h + 2, 6, '(처리량)', 't t t m'); H(h + 2, 7, null, 't m . m'); H(h + 2, 8, '(처리비용)', 'm m t m'); H(h + 2, 9, null, 'm m . m');
      var rr = h + 3, s0 = {};
      if (i === 0) {
        KINDS.forEach(function (k, j) {
          var last = j === 2;
          C(ws, rr, 1, j === 0 ? '년초재고' : null, { f: BB11, a: ['center', 'middle'], b: 'm m ' + (j === 0 ? 'm' : '.') + ' ' + (last ? 'm' : '.') });
          C(ws, rr, 2, k, { f: BB11, a: ['center', 'middle'], b: '. t . ' + (last ? 'm' : '.') });
          C(ws, rr, 3, T.stk0[k], { f: ['바탕', 8, true], a: ['center', 'middle'], n: NF.acc, b: 't m . ' + (last ? 'm' : '.') });
          mg(ws, rr, 4, rr, 5);
          C(ws, rr, 4, null, { b: 'm t ' + (j === 0 ? 'm' : '.') + ' ' + (last ? 'm' : '.') });
          C(ws, rr, 6, null, { b: 't t . ' + (last ? 'm' : '.') }); C(ws, rr, 7, null, { b: 't m . ' + (last ? 'm' : '.') }); C(ws, rr, 8, null, { b: 'm m ' + (j === 0 ? 'm' : '.') + ' ' + (last ? 'm' : '.') });
          C(ws, rr, 9, null, { b: 'm m . ' + (last ? 'm' : '.') });
          s0[k] = 'C' + rr; rr++;
        });
      }
      // 날짜별 묶음: 고무분말 · 철심 · 섬유 줄 (그 종류 판매가 여러 건이면 줄을 더 둠)
      var dset = {}, sBy = {};
      T.days.forEach(function (x) { dset[x.date] = 1; });
      T.sales.forEach(function (l) { dset[l.sdate] = 1; var kk = l.sdate + '|' + l.kind; (sBy[kk] = sBy[kk] || []).push(l); });
      var refs = { c: { '고무분말': [], '철심': [], '섬유': [] }, f: { '고무분말': [], '철심': [], '섬유': [] }, h: { '고무분말': [], '철심': [], '섬유': [] }, i: [] };
      Object.keys(dset).sort().forEach(function (date) {
        var day = M.dayBy[date] && M.dayBy[date].tot > 0 ? M.dayBy[date] : null, g0 = rr, cr = {};
        KINDS.forEach(function (k, j) {
          var sl = sBy[date + '|' + k] || [], n = Math.max(1, sl.length);
          for (var q = 0; q < n; q++) {
            var first = q === 0, lastRow = j === 2 && q === n - 1, top = rr === g0, l = sl[q] || null;
            var bb = lastRow ? 'm' : '.';
            C(ws, rr, 1, top ? dval(date) : null, { f: ['바탕', 10], a: ['right', 'middle'], n: NF.md, b: 'm m ' + (top ? 'm' : '.') + ' ' + bb });
            C(ws, rr, 2, first ? K2[k] : null, { f: DO10, a: ['center', 'middle'], b: 'm t ' + (top ? 'm' : '.') + ' ' + (lastRow ? 'm' : 'h') });
            var cv = null;
            if (first && day) {
              if (k === '고무분말') cv = day.rubber;
              else if (k === '철심') cv = day.stAuto ? fx('ROUND(' + cr['고무분말'] + '*' + ratio + ',0)', day.steel) : day.steel;
              else cv = day.fiber > 0 || !day.fbAuto ? day.fiber : null;
            }
            C(ws, rr, 3, cv, { f: BT8, a: ['center', 'middle'], n: NF.acc, b: 't m ' + (top ? 'm' : '.') + ' ' + bb });
            if (first) { cr[k] = 'C' + rr; if (day) refs.c[k].push('C' + rr); }
            mg(ws, rr, 4, rr, 5);
            C(ws, rr, 4, l ? l.cust : null, { f: BT11, a: [null, 'middle'], b: 'm t ' + (top ? 'm' : '.') + ' ' + (lastRow ? 'm' : 'h') });
            C(ws, rr, 6, l ? l.qty : null, { f: DO8, a: ['right', 'middle'], n: NF.kgR, b: 't t ' + (top ? 'm' : '.') + ' ' + (lastRow ? 'm' : 'h') });
            C(ws, rr, 7, l && l.price != null && !l.own ? l.price : null, { f: DO8, a: ['right', 'middle'], n: NF.kgR, b: 't m ' + (top ? 'm' : '.') + ' ' + (lastRow ? 'm' : 'h') });
            var hv = null;
            if (l && !l.own && l.supply != null) hv = l.price != null && Math.round(l.qty * l.price) === l.supply ? fx('ROUND(F' + rr + '*G' + rr + ',0)', l.supply) : l.supply;
            C(ws, rr, 8, hv, { f: DO8, a: ['right', 'middle'], n: NF.kgR, b: 'm m ' + (top ? 'm' : '.') + ' ' + (lastRow ? 'm' : 'h') });
            if (l) { refs.f[k].push('F' + rr); if (hv != null) refs.h[k].push('H' + rr); }
            var iv = null;
            if (lastRow && day) { iv = fx(cr['고무분말'] + '+' + cr['철심'] + '+' + cr['섬유'], day.tot); refs.i.push('I' + rr); }
            C(ws, rr, 9, iv, { f: DO8, a: ['center', 'middle'], n: NF.acc, b: 'm m ' + (top ? 'm' : '.') + ' ' + bb });
            if (lastRow) ws.getRow(rr).height = 17.25;
            rr++;
          }
        });
      });
      // 달 정리: 생산량 · 누계 · 공급량 · 누계 · 금액 · 보관량
      for (var e = 0; e < 2; e++) {
        C(ws, rr, 1, null, { f: DO10, b: '. m . .' }); C(ws, rr, 2, null, { b: 'm . . .' }); C(ws, rr, 3, null, { b: 't m . .' });
        mg(ws, rr, 4, rr, 5); C(ws, rr, 4, null, { b: '. . . m' }); C(ws, rr, 6, null, { b: 't t . .' }); C(ws, rr, 7, null, { b: '. m . .' });
        C(ws, rr, 9, e === 1 ? '보관량' : null, { f: DO8, a: ['center', 'middle'], b: 'm m . .' });
        rr++;
      }
      var rl = rr;
      C(ws, rl, 1, null, { b: '. m . d' }); C(ws, rl, 2, null, { b: 'm . . d' });
      C(ws, rl, 3, '생산량', { f: DO8, a: ['right', 'middle'], b: 't m . d' });
      mg(ws, rl, 4, rl, 5); C(ws, rl, 4, '생산량누계', { f: DO8, a: ['center', 'middle'], b: 'm t h d' });
      C(ws, rl, 6, '공급량', { f: DO8, a: ['right', 'middle'], b: 't t . d' }); C(ws, rl, 7, '공급량누계', { f: DO8, a: ['right', 'middle'], b: '. m . d' });
      C(ws, rl, 8, null, { b: '. . . d' });
      C(ws, rl, 9, fx(sumList(refs.i), T.rec), { f: DO8, a: ['center', 'middle'], n: NF.kgR, b: 'm m . d', fill: YEL });
      ws.getRow(rl).height = 17.25;
      rr++;
      var sr = {};
      KINDS.forEach(function (k, j) {
        var t0 = j === 0, l0 = j === 2, b2 = function (L, R) { return L + ' ' + R + ' ' + (t0 ? 'd' : 'h') + ' ' + (l0 ? 'd' : 'h'); };
        sr[k] = rr;
        C(ws, rr, 1, null, { b: 'd d ' + (t0 ? 'd' : '.') + ' ' + (l0 ? 'd' : '.') });
        C(ws, rr, 2, K2S[k], { f: DO10, a: ['center', 'middle'], b: b2('d', 'd') });
        C(ws, rr, 3, fx(sumList(refs.c[k]), T.prod[k]), { f: DO8, a: ['right', 'middle'], n: NF.kgR, b: b2('d', 't') });
        mg(ws, rr, 4, rr, 5);
        C(ws, rr, 4, fx(prev ? 'C' + rr + '+D' + prev.sr[k] : 'C' + rr, T.cum.prod[k]), { f: DO8, a: ['right', 'middle'], n: NF.kg, b: b2('t', 'd') });
        C(ws, rr, 6, k === '섬유' && !refs.f[k].length ? null : fx(sumList(refs.f[k]), T.sale[k]), { f: DO8, a: ['right', 'middle'], n: NF.kgR, b: b2('d', 't') });   // 원본: 섬유 공급량 칸은 비움
        C(ws, rr, 7, fx(prev ? 'F' + rr + '+G' + prev.sr[k] : 'F' + rr, T.cum.sale[k]), { f: DO8, a: ['right', 'middle'], n: NF.kg, b: b2('t', 'd') });
        // 원본 판매금액(H) 칸: 고무분말 비움 · 철심 = 철심 판매금액 · 섬유 = 고무분말 + 철심 칸
        var hv2 = k === '고무분말' ? null : k === '철심' ? fx(sumList(refs.h['철심']), T.amt['철심']) : fx('H' + sr['고무분말'] + '+H' + sr['철심'], T.amt['철심']);
        C(ws, rr, 8, hv2, { f: DO8, a: ['right', 'middle'], n: NF.kgR, b: b2('d', 'd') });
        var base = i === 0 ? s0[k] : 'I' + prev.sr[k];
        C(ws, rr, 9, fx(base + '+C' + rr + '-F' + rr, T.stk[k]), { f: DO8, a: ['right', 'middle'], n: NF.kgR, b: b2('d', 'm') });
        rr++;
      });
      var rt = rr, sum3 = function (cc) { return KINDS.map(function (k) { return cc + sr[k]; }).join('+'); }, add3 = function (o) { return o['고무분말'] + o['철심'] + o['섬유']; };
      C(ws, rt, 2, '합계', { f: DO10, a: ['center', 'middle'] });
      C(ws, rt, 3, fx(sum3('C'), add3(T.prod)), { f: ['맑은 고딕', 11], a: [null, 'middle'], n: NF.kgR });
      mg(ws, rt, 4, rt, 5);
      C(ws, rt, 4, fx(sum3('D'), add3(T.cum.prod)), { f: ['맑은 고딕', 11], a: ['center', 'middle'], n: NF.kg, b: '. . d .' });
      C(ws, rt, 6, fx('F' + sr['고무분말'] + '+F' + sr['철심'], T.sale['고무분말'] + T.sale['철심']), { f: ['맑은 고딕', 11], a: [null, 'middle'], n: NF.kgR, fill: BLU });   // 원본: 고무분말 + 철심
      C(ws, rt, 7, fx(sum3('G'), add3(T.cum.sale)), { f: ['맑은 고딕', 11], a: [null, 'middle'], n: NF.kg });
      C(ws, rt, 8, fx(prev ? 'H' + sr['섬유'] + '+H' + prev.rt : 'H' + sr['섬유'], T.cumSteelAmt), { f: ['맑은 고딕', 11], a: [null, 'middle'], n: NF.kgR });   // 원본: 철심 판매금액 누계
      C(ws, rt, 9, fx(sum3('I'), add3(T.stk)), { f: ['맑은 고딕', 11], a: [null, 'middle'], n: NF.kgR });
      prev = { sr: sr, rt: rt };
      r = rt + 2;
    });
    if (M.months.length) ws.pageSetup.printArea = 'A$1:I$' + (r - 2);
    fixMerges(ws);
    return ws;
  }

  /* ─────────── 세금계산서(매출) ─────────── */
  function fTax(wb, M) {
    var ws = sheet(wb, '매출', { rowH: 18, cols: [8.89, 13.11, 13, 9.78, 11.66, 7.89, 10.66, 8, 14.22, 10.89, 10.66], page: { scale: 63, margins: { left: 0.75, right: 0.75, top: 1, bottom: 1, header: 0.5, footer: 0.5 } } });
    var D10 = ['돋움', 10], D11 = ['돋움', 11, true];
    mg(ws, 1, 1, 1, 10);
    C(ws, 1, 1, M.y + '년 세금계산서(매출)', { f: ['돋움', 16, true], a: ['center', 'middle'] }); ws.getRow(1).height = 27.75;
    C(ws, 3, 1, M.co.name || null, { f: D11, a: [null, 'middle'] }); ws.getRow(3).height = 21.75;
    [['구분'], ['업체명', '(공급자)'], ['업체명', '(공급받는자)'], ['발행일'], ['품목'], ['규격'], ['수량'], ['단가'], ['공급가액'], ['세액']].forEach(function (x, j) {
      var c = j + 1, L = c === 1 ? 'm' : 't', R = c === 10 ? 'm' : 't', bot = c === 8 || c === 9 ? 'm' : 't';
      if (x.length === 1) { mg(ws, 4, c, 5, c); C(ws, 4, c, x[0], { f: D11, a: ['center', 'middle'], b: L + ' ' + R + ' m ' + bot }); C(ws, 5, c, null, { b: L + ' ' + R + ' . ' + bot }); }
      else { C(ws, 4, c, x[0], { f: D11, a: ['center', 'middle'], b: L + ' ' + R + ' m t' }); C(ws, 5, c, x[1], { f: ['돋움', 10, true], a: ['center', 'middle'], b: L + ' ' + R + ' t m' }); }
    });
    ws.getRow(4).height = 15.95; ws.getRow(5).height = 15.95;
    var r = 6, first = r, tb = 't t t t', all = { kg: 0, sup: 0, vat: 0 };
    M.months.forEach(function (T) {
      var m0 = r;
      T.tax.forEach(function (l, j) {
        C(ws, r, 1, j === 0 ? T.m + '월매출' : '매출', { f: D10, a: ['center', 'middle'], b: tb, fill: j === 0 ? YEL : undefined });
        C(ws, r, 2, M.co.short || null, { f: D10, a: ['center', 'middle'], b: tb });
        C(ws, r, 3, l.cust, { f: D10, a: ['center', 'middle'], b: tb });
        C(ws, r, 4, dval(l.sdate), { f: D10, a: ['center', 'middle'], n: NF.md, b: tb });
        C(ws, r, 5, l.item, { f: D10, a: ['center', 'middle'], b: tb });
        C(ws, r, 6, l.spec || null, { f: D10, a: ['center', 'middle'], n: '0_);\\(0\\)', b: tb });
        C(ws, r, 7, l.qty, { f: ['돋움', 10, false, 'FFFF0000'], a: ['right', 'middle'], n: NF.kgR, b: tb, fill: YEL });
        C(ws, r, 8, l.price != null ? l.price : null, { f: D10, a: ['right', 'middle'], n: NF.kgR, b: tb });
        var iv = null, jv = null;
        if (l.supply != null) {
          iv = l.price != null && Math.round(l.qty * l.price) === l.supply ? fx('ROUND(G' + r + '*H' + r + ',0)', l.supply) : l.supply;
          jv = l.tax === Math.floor(l.supply / 10) ? fx('ROUNDDOWN(I' + r + '*0.1,0)', l.tax) : l.tax;
        }
        C(ws, r, 9, iv, { f: D10, a: ['right', 'middle'], n: NF.kg, b: tb });
        C(ws, r, 10, jv, { f: D10, a: ['right', 'middle'], n: NF.kg, b: tb });
        r++;
      });
      if (T.tax.length) C(ws, r - 1, 11, fx('SUM(G' + m0 + ':G' + (r - 1) + ')', T.taxKg), { f: D10, a: ['right', 'middle'], n: NF.kgR });
      all.kg += T.taxKg; all.sup += T.supply; all.vat += T.vat;
    });
    var last = r - 1;
    if (last >= first) C(ws, r, 7, fx('SUM(G' + first + ':G' + last + ')', all.kg), { f: D10, a: ['right', 'middle'], n: NF.kgR });   // 원본: 끝 줄 = 한 해 수량 합계만
    ws.pageSetup.printArea = 'A$1:J$' + r;
    fixMerges(ws);
    return ws;
  }

  /* ─────────── 계량증명서(매입,매출) ─────────── */
  function fWeigh(wb, M) {
    var ws = sheet(wb, 'Sheet1', { cols: [8.38, 13, 15, 8.75, 6.88, 15.5, 7.38, 11.5, 11.88, 9.62, 10.62, 12.12, 11.5],
      page: { orientation: 'landscape', margins: { left: 0.7, right: 0.7, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3 } } });
    var G10 = ['맑은 고딕', 10], G11 = ['맑은 고딕', 11], GB = ['맑은 고딕', 11, true];
    mg(ws, 1, 1, 1, 12);
    C(ws, 1, 1, '                                      ' + M.y + '년 계량증명서(매입,매출)', { f: ['맑은 고딕', 18, true], a: [null, 'middle'] }); ws.getRow(1).height = 26.25;   // 원본: 앞 칸 띄움 · 18 굵게
    C(ws, 2, 1, '재활용사업자: ' + (M.co.name || ''), { f: GB, a: [null, 'middle'] });
    C(ws, 2, 12, '(단위:kg)', { f: ['맑은 고딕', 10, true], a: ['right', 'middle'] }); ws.getRow(2).height = 22.5;
    var hd = [['구 분'], ['발행처', '(계량한곳)'], ['거래처', '(매입매출처)'], ['품 명'], ['발행일'], ['차량번호'], ['일련번호'], ['1차 계량시간', ''], ['2차 계량시간', ''], ['총중량'], ['공차중량'], ['실중량']];
    hd.forEach(function (x, j) {
      var c = j + 1, L = c === 1 ? 'm' : 't', R = c === 12 ? 'm' : 't';
      if (x.length === 1) { mg(ws, 3, c, 4, c); C(ws, 3, c, x[0], { f: GB, a: ['center', 'middle'], b: L + ' ' + R + ' m m' }); C(ws, 4, c, null, { b: L + ' ' + R + ' . m' }); }
      else { C(ws, 3, c, x[0], { f: GB, a: ['center', 'middle'], b: L + ' ' + R + ' m .' }); C(ws, 4, c, x[1] || null, { f: ['맑은 고딕', 9, true], a: ['center', 'middle'], b: L + ' ' + R + ' . m' }); }
    });
    C(ws, 3, 13, '확인', { f: G11, a: ['center', 'middle'] });
    ws.getRow(4).height = 17.25;
    var r = 5, tb = function (c) { return (c === 1 ? 'm' : 't') + ' ' + (c === 12 ? 'm' : 't') + ' t t'; };
    var row = function (kind, co, item, date, w, qty) {
      C(ws, r, 1, kind, { f: G10, a: ['center', 'middle'], b: tb(1) });
      C(ws, r, 2, M.co.short || null, { f: G10, a: ['center', 'middle'], b: tb(2) });
      C(ws, r, 3, co, { f: G10, a: ['center', 'middle'], b: tb(3) });
      C(ws, r, 4, item, { f: G10, a: ['center', 'middle'], b: tb(4) });
      C(ws, r, 5, dval(date), { f: G11, a: ['center', 'middle'], n: NF.md, b: tb(5) });
      C(ws, r, 6, w && w.car ? w.car : null, { f: G11, a: ['right', 'middle'], b: tb(6) });
      C(ws, r, 7, w && w.no ? serial(w.no) : null, { f: G11, a: ['right', 'middle'], b: tb(7) });
      C(ws, r, 8, w ? tval(w.t1) : null, { f: G11, a: ['right', 'middle'], n: NF.hm, b: tb(8) });
      C(ws, r, 9, w ? tval(w.t2) : null, { f: G11, a: ['right', 'middle'], n: NF.hm, b: tb(9) });
      var has = w && w.gross != null && w.tare != null;
      C(ws, r, 10, has ? w.gross : null, { f: G11, a: ['right', 'middle'], n: NF.kgR, b: tb(10) });
      C(ws, r, 11, has ? w.tare : null, { f: G11, a: ['right', 'middle'], n: NF.kgR, b: tb(11) });
      C(ws, r, 12, has ? fx('J' + r + '-K' + r, w.gross - w.tare) : qty, { f: G11, a: ['right', 'middle'], n: NF.kgR, b: tb(12) });
      r++;
    };
    var tot = function (label, c3, a, b, sums, val) {
      C(ws, r, 1, label, { f: ['맑은 고딕', 10, true], a: ['center', 'middle'], b: tb(1), fill: YEL });
      for (var c = 2; c <= 12; c++) C(ws, r, c, c === 3 ? c3 : null, { f: G10, a: ['center', 'middle'], b: tb(c), fill: YEL });
      if (b >= a) {
        if (sums) { C(ws, r, 10, fx('SUM(J' + a + ':J' + b + ')', sums[0]), { f: G11, a: ['right', 'middle'], n: NF.kgR, b: tb(10), fill: YEL }); C(ws, r, 11, fx('SUM(K' + a + ':K' + b + ')', sums[1]), { f: G11, a: ['right', 'middle'], n: NF.kgR, b: tb(11), fill: YEL }); }
        C(ws, r, 12, fx('SUM(L' + a + ':L' + b + ')', val), { f: ['맑은 고딕', 11, true], a: ['right', 'middle'], n: NF.kgR, b: tb(12), fill: YEL });
      }
      return r++;
    };
    var inTot = [], outTot = [], inAll = 0, outAll = 0;
    M.months.forEach(function (T) {
      var a = r, g = 0, t = 0;
      T.ins.forEach(function (x) { row('매입', x.co, x.item || '폐타이어', x.date, x, x.net); if (x.gross != null && x.tare != null) { g += x.gross; t += x.tare; } });
      if (T.ins.length) { inTot.push('L' + tot(T.m + '월결산', null, a, r - 1, null, T.inKg)); inAll += T.inKg; }
    });
    var lastOut = 0;
    M.months.forEach(function (T) {
      var a = r, g = 0, t = 0;
      T.wOut.forEach(function (l) { row('매출', l.cust, l.item, l.date, l.w, l.qty); if (l.w && l.w.gross != null && l.w.tare != null) { g += l.w.gross; t += l.w.tare; } });
      if (T.wOut.length) { lastOut = tot(T.m + '월매출', T.m + '월분', a, r - 1, [g, t], T.wOutNet); outTot.push('L' + lastOut); outAll += T.wOutNet; }
    });
    if (lastOut) C(ws, lastOut, 13, fx(outTot.slice().reverse().join('+'), outAll), { f: G11, a: ['right', 'middle'], n: NF.kgR });   // 원본: 맨 끝 매출 달 줄 옆(M) = 한 해 매출 합
    wb.addWorksheet('Sheet2');   // 원본에 있는 빈 시트
    fixMerges(ws);
    return ws;
  }

  /* ─────────── 총괄표 ─────────── */
  function fSum(wb, M) {
    var ws = sheet(wb, M.y, { rowH: 13.5, cols: [9, 12.88, 9.25, 11.88, 12.88, 11.62, 11.62, 10.12, 9], views: [{ zoomScale: 85 }],
      page: { fitToPage: true, fitToWidth: 1, fitToHeight: 1, horizontalCentered: true, verticalCentered: true,
        margins: { left: 0.118, right: 0.118, top: 0.118, bottom: 0.118, header: 0.315, footer: 0.315 } } });
    var G10 = ['맑은 고딕', 10], G11 = ['맑은 고딕', 11];
    mg(ws, 1, 1, 1, 7);
    C(ws, 1, 1, (M.co.short ? '㈜' + M.co.short + ' ' : '') + M.y + '년 폐타이어 재활용 관리대장 총괄표', { f: ['맑은 고딕', 12, true], a: ['center', 'middle'] });
    C(ws, 2, 7, '(단위 : kg)', { f: G10, a: ['right', 'middle'] });
    mg(ws, 3, 1, 4, 1); mg(ws, 3, 2, 4, 2); mg(ws, 3, 3, 4, 3); mg(ws, 3, 4, 3, 6); mg(ws, 3, 7, 4, 7); mg(ws, 3, 8, 4, 8); mg(ws, 3, 9, 4, 9);
    var H = function (r, c, v, b) { C(ws, r, c, v, { f: G10, a: ['center', 'middle', true], b: b || 't t t t' }); };
    H(3, 1, '년월'); H(3, 2, '폐타이어\n반입량'); H(3, 3, null); H(3, 4, '재활용제품 생산·판매'); H(3, 5, null, '. . t t'); H(3, 6, null, '. t t t');
    H(3, 7, '폐타이어\n재고량'); H(3, 8, null); H(3, 9, '비고');
    H(4, 1, null); H(4, 2, null); H(4, 3, null); H(4, 4, '생산량', 't . t t'); H(4, 5, '판매량', 'o o t t'); H(4, 6, '재고량', '. t t t'); H(4, 7, null); H(4, 8, null); H(4, 9, null);
    var KN = KINDS.concat(['합계']), r = 5, prev = null, yy = M.y.slice(2);
    var block = function (label, b, vals) {
      var r0 = r;
      mg(ws, r0, 1, r0 + 3, 1); mg(ws, r0, 2, r0 + 3, 2); mg(ws, r0, 7, r0 + 3, 7); mg(ws, r0, 8, r0 + 3, 8);
      C(ws, r0, 1, label, { f: G11, a: ['center', 'middle'], n: NF.int, b: 't t t t' });
      C(ws, r0, 2, b, { f: G11, a: ['right', 'middle'], n: NF.kgR, b: 't t t t' });
      C(ws, r0, 7, vals.g, { f: G11, a: ['center', 'middle'], n: NF.kgR, b: 't t t t' });
      C(ws, r0, 8, null, { b: 't t t t' });
      KN.forEach(function (k, j) {
        var rr = r0 + j, top = j === 0 || j === 3 ? 't' : '.', bot = j >= 2 ? 't' : '.';
        C(ws, rr, 3, k, { f: G11, a: ['center', 'middle'], n: NF.int, b: 't t ' + (j === 0 ? 't' : '.') + ' ' + bot });
        C(ws, rr, 4, vals.d[j], { f: G11, a: ['right', 'middle'], n: NF.kgR, b: 't . ' + top + ' ' + bot });
        C(ws, rr, 5, vals.e[j], { f: G11, a: ['right', 'middle'], n: NF.kgR, b: 'o o ' + top + ' ' + bot });
        C(ws, rr, 6, vals.f[j], { f: G11, a: ['right', 'middle'], n: NF.kgR, b: '. t ' + top + ' ' + bot });
        C(ws, rr, 9, vals.i ? vals.i[j] : null, { f: G11, a: ['center', 'middle'], n: NF.pct, b: 't t ' + (j === 0 || j === 3 ? 't' : '.') + ' ' + bot });
        if (j > 0) { C(ws, rr, 1, null, { b: 't t . ' + bot }); C(ws, rr, 2, null, { b: 't t . ' + bot }); C(ws, rr, 7, null, { b: 't t . ' + bot }); C(ws, rr, 8, null, { b: 't t . ' + bot }); }
      });
      r += 4;
      return r0;
    };
    var pctF = function (r0, j, d, tot) { return fx('IF(D' + (r0 + 3) + '=0,"",D' + (r0 + j) + '/D' + (r0 + 3) + '*100)', tot ? d / tot * 100 : ''); };
    var st = M.st0, stSum = st['고무분말'] + st['철심'] + st['섬유'];
    var r5 = block('전년재고', null, { g: st.tire, d: [null, null, null, null], e: [null, null, null, null], f: [st['고무분말'], st['철심'], st['섬유'], fx('SUM(F5:F7)', stSum)] });
    prev = r5;
    var mRows = [];
    M.months.forEach(function (T) {
      var r0 = r, P = T.prod, S2 = T.sale, dt = P['고무분말'] + P['철심'] + P['섬유'], et = S2['고무분말'] + S2['철심'] + S2['섬유'];
      var f = KINDS.map(function (k, j) { return fx('F' + (prev + j) + '+D' + (r0 + j) + '-E' + (r0 + j), T.stk[k]); });
      f.push(fx('SUM(F' + r0 + ':F' + (r0 + 2) + ')', T.stk['고무분말'] + T.stk['철심'] + T.stk['섬유']));
      block(T.m === 1 ? yy + '.1월' : T.m + '월', T.yld, {
        g: fx('G' + prev + '+B' + r0 + '-D' + (r0 + 3), T.tire),
        d: [P['고무분말'], P['철심'], P['섬유'] || null, fx('SUM(D' + r0 + ':D' + (r0 + 2) + ')', dt)],
        e: [S2['고무분말'], S2['철심'], S2['섬유'] || null, fx('SUM(E' + r0 + ':E' + (r0 + 2) + ')', et)],
        f: f, i: [0, 1, 2, 3].map(function (j) { return pctF(r0, j, j < 3 ? P[KINDS[j]] : dt, dt); })
      });
      mRows.push(r0); prev = r0;
    });
    var Lst = M.end;   // 아직 안 온 달(올해): 원본처럼 열두 달 칸을 두고 재고는 앞달을 이어 받음
    for (var fm = M.months.length + 1; fm <= 12 && M.months.length; fm++) {
      var r1 = r, Sk = Lst.stk, skSum = Sk['고무분말'] + Sk['철심'] + Sk['섬유'];
      var ff = KINDS.map(function (k, j) { return fx('F' + (prev + j) + '+D' + (r1 + j) + '-E' + (r1 + j), Sk[k]); });
      ff.push(fx('SUM(F' + r1 + ':F' + (r1 + 2) + ')', skSum));
      block(fm + '월', null, { g: fx('G' + prev + '+B' + r1 + '-D' + (r1 + 3), Lst.tire), d: [null, null, null, fx('SUM(D' + r1 + ':D' + (r1 + 2) + ')', 0)],
        e: [null, null, null, fx('SUM(E' + r1 + ':E' + (r1 + 2) + ')', 0)], f: ff, i: [0, 1, 2, 3].map(function (j) { return pctF(r1, j, 0, 0); }) });
      mRows.push(r1); prev = r1;
    }
    if (M.months.length) {
      var r0 = r, E2 = M.end, cp = E2.cum.prod, cs = E2.cum.sale, dt = cp['고무분말'] + cp['철심'] + cp['섬유'];
      var sumK = function (cc, j) { return sumList(mRows.map(function (x) { return cc + (x + j); })); };
      var dd = KINDS.map(function (k, j) { return fx(sumK('D', j), cp[k]); }), ee = KINDS.map(function (k, j) { return fx(sumK('E', j), cs[k]); });
      dd.push(fx('SUM(D' + r0 + ':D' + (r0 + 2) + ')', dt)); ee.push(fx('SUM(E' + r0 + ':E' + (r0 + 2) + ')', cs['고무분말'] + cs['철심'] + cs['섬유']));
      var ff2 = KINDS.map(function (k, j) { return fx('F' + (5 + j) + '+D' + (r0 + j) + '-E' + (r0 + j), E2.stk[k]); });
      ff2.push(fx('SUM(F' + r0 + ':F' + (r0 + 2) + ')', E2.stk['고무분말'] + E2.stk['철심'] + E2.stk['섬유']));
      block('누계', fx(sumList(mRows.map(function (x) { return 'B' + x; })), E2.cum.yld), {
        g: fx('G5+B' + r0 + '-D' + (r0 + 3), E2.tire), d: dd, e: ee, f: ff2,
        i: [0, 1, 2, 3].map(function (j) { return pctF(r0, j, j < 3 ? cp[KINDS[j]] : dt, dt); })
      });
    }
    ws.pageSetup.printArea = 'A$1:G$' + (r - 1);
    fixMerges(ws);
    return ws;
  }

  /* ─────────── 파일 ─────────── */
  var FORMS = [
    { k: 'f1', name: '서식-1 보고서', file: function (y) { return y + '년 서식-1 보고서.xlsx'; }, build: f1 },
    { k: 'f2', name: '서식-2 보고서', file: function (y) { return y + '년 서식-2 보고서.xlsx'; }, build: f2 },
    { k: 'tax', name: '세금계산서(매출)', file: function (y) { return y + '년 세금계산서(매출).xlsx'; }, build: fTax },
    { k: 'weigh', name: '계량증명서(매입,매출)', file: function (y) { return y + '년 계량증명서(매입,매출).xlsx'; }, build: fWeigh },
    { k: 'sum', name: '총괄표', file: function (y) { return y + '년 총괄표.xlsx'; }, build: fSum }
  ];
  /** 서식 하나 → { name, buf } (ExcelJS 필요) */
  function build(ExcelJS, M, k) {
    var F = FORMS.filter(function (x) { return x.k === k; })[0];
    if (!F) return Promise.reject(new Error('bad_form'));
    var wb = newBook(ExcelJS);
    F.build(wb, M);
    return wb.xlsx.writeBuffer().then(function (buf) { return { name: F.file(M.y), buf: buf }; });
  }
  function buildAll(ExcelJS, M) {
    return FORMS.reduce(function (p, F) {
      return p.then(function (acc) { return build(ExcelJS, M, F.k).then(function (o) { acc.push(o); return acc; }); });
    }, Promise.resolve([]));
  }

  var api = { KINDS: KINDS, ITEMS: ITEMS, ITEM_KIND: ITEM_KIND, LIMIT: LIMIT, FORMS: FORMS, model: model, build: build, buildAll: buildAll, itemOf: itemOf, normCo: normCo, col: col };
  G.NMCTire = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
