/* NMC 전체 메뉴 — 대분류 → 소분류 (2026-11-25 10:11 지시: "전체카테고리 -소카테고리로 해서 좀 정리를 하자. 정렬도 하고 전체적으로 체계적으로 만들어서 우리가 일하기 편하게")
   · 관리자 첫 화면(manage.html)과 관리자 화면마다 위쪽의 '메뉴' 단추가 이 목록 하나를 같이 씁니다. 메뉴를 바꿀 때는 여기 한 곳만 고칩니다.
   · 소분류는 그 화면의 그 칸으로 바로 엽니다 — 예: 거래명세서 작성 = statement.html?view=edit, 현재고 = stock.html?view=all&tab=stock
   · 순서 = 일하는 순서. 대분류: 업무 → 영업·출고 → 생산·재고 → 폐타이어 → 공사 → 재무 → 인사·급여, 소분류도 업무 흐름대로 (받은 발주서 → 출고 → 거래명세서 → 거래처 …)
   · 폐타이어(2026-11-25 지시): 서식-1 보고서 · 서식-2 보고서 · 계량증명서 관리 · 세금계산서 관리 · 총괄표 — 쓰던 서식 그대로 (tire.html)
   · '메뉴' 단추 = <a href="manage.html" data-nmc-menu> — 이 파일을 못 읽으면 관리자 첫 화면으로 그냥 갑니다.
   · 메뉴 창: 대분류별 소분류 · 지금 보고 있는 화면 표시 · 메뉴 찾기(초성도 됨: ㄱㄹㅁㅅㅅ → 거래명세서) · Esc · 바깥 누르면 닫힘
   회사 자료는 없습니다. */
(function () {
  'use strict';
  if (window.NMCMenu) return;

  var BASE = '';   // 이 파일이 있는 곳 (도면 화면처럼 한 단계 아래 폴더에서 읽어도 주소가 맞게)
  try { var cs = document.currentScript; if (cs && cs.src) BASE = cs.src.replace(/[?#].*$/, '').replace(/[^/]*$/, ''); } catch (e) { BASE = ''; }

  var IC = {
    work: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/><path d="M3 13h18"/>',
    sales: '<path d="M2 6h12v10H2z"/><path d="M14 9h4.5L22 12.5V16h-8"/><circle cx="6.5" cy="17.5" r="1.9"/><circle cx="17.5" cy="17.5" r="1.9"/>',
    stock: '<path d="M3 8l9-5 9 5v8l-9 5-9-5z"/><path d="M3 8l9 5 9-5"/><path d="M12 13v8"/>',
    cons: '<path d="M3 21h18"/><path d="M5 21V9l7-5 7 5v12"/><path d="M9 21v-6h6v6"/>',
    tire: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3.4"/><path d="M12 3v3.2M12 17.8V21M3 12h3.2M17.8 12H21M5.6 5.6l2.3 2.3M16.1 16.1l2.3 2.3M5.6 18.4l2.3-2.3M16.1 7.9l2.3-2.3"/>',
    fin: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    hr: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="9" r="2.6"/><path d="M15.6 14.1c3 .3 5.4 2.7 5.4 5.9"/>'
  };
  function icon(k, px) {
    return '<svg aria-hidden="true" width="' + (px || 20) + '" height="' + (px || 20) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' + (IC[k] || '') + '</svg>';
  }
  var MENU_IC = '<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M4 6.5h16M4 12h16M4 17.5h16"/></svg>';
  var HUB_IC = '<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"><rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/></svg>';
  var HOME_IC = '<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-7 9 7"/><path d="M5 10v10h5v-6h4v6h5V10"/></svg>';
  var FIND_IC = '<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/></svg>';

  /* ── 부서: 관리자 첫 화면이 서버에서 받은 부서 이름(이름만)을 이 탭에 적어 두면 메뉴 창도 같게 ── */
  var DEPTS0 = ['관리부', '대외사업부'], DKEY = 'nmc_menu_depts';
  function depts() {
    var v = null;
    try { v = JSON.parse(sessionStorage.getItem(DKEY) || 'null'); } catch (e) { v = null; }
    if (Array.isArray(v) && v.length && v.length <= 8 && v.every(function (x) { return typeof x === 'string' && x.length > 0 && x.length <= 20; })) return v;
    return DEPTS0;
  }
  function setDepts(names) {
    if (!Array.isArray(names)) return;
    var v = names.filter(function (x) { return typeof x === 'string' && x.length > 0 && x.length <= 20; }).slice(0, 8);
    if (!v.length) return;
    try { sessionStorage.setItem(DKEY, JSON.stringify(v)); } catch (e) { /* 못 씀 */ }
  }
  function deptItem(n) {
    return { k: 'dept:' + n, n: n, d: '업무 지시 · 업무 목록 · 일정 달력', u: 'work.html?d=' + encodeURIComponent(n), p: { d: n }, kw: '부서업무 업무지시', dept: n };
  }

  /* ── 메뉴 목록 ──
     k: 이름표 · n: 메뉴 이름 · d: 설명 · u: 여는 주소 · p: 지금 화면 맞추기(주소 · 화면 안 칸) · kw: 찾기 말 · w: 관리자 첫 화면에서 넓게(오늘 숫자) */
  function groups() {
    return [
      { k: 'work', n: '업무', d: '오늘 할 일 · 공문 · 부서 업무', c: '#3F3D8F', s: '#ECEBF7', items: [
        { k: 'today', n: '오늘 할 일', d: '오늘 출고 · 입고 · 공문 처리 대기 · 매일 아침 알림', u: 'today.html', w: 1, kw: '아침알림 오늘' },
        { k: 'docs', n: '공문함', d: '메일 · 팩스 공문 — 처리 대기 · 기한 · 찾기', u: 'docs.html', p: { cat: 'todo' }, w: 1, kw: '공문 처리대기 메일 팩스' },
        { k: 'docs-all', n: '수신 공문 전체', d: '일자별 목록 · 달력', u: 'docs.html?cat=all', p: { cat: 'all' }, kw: '공문 수신 달력' }
      ].concat(depts().map(deptItem)) },
      { k: 'sales', n: '영업·출고', d: '받은 발주서 → 출고 → 거래명세서', c: '#1E5AA8', s: '#E6EFFB', items: [
        { k: 'po', n: '받은 발주서', d: '메일 · 팩스로 받은 발주서 확인 · 출고 등록', u: 'docs.html?cat=po', p: { cat: 'po' }, kw: '발주 주문' },
        { k: 'out', n: '출고 관리', d: '발주서 올리기 · 출고 예정 · 물표 · 거래처별 찾기', u: 'stock.html?view=out', p: { view: 'out' }, kw: '출고 물표 출고예정 달력 발주서올리기 거래처찾기' },
        { k: 'stmt', n: '거래명세서', d: '일일 기록 · 인쇄 · 거래처 메일 발송', u: 'statement.html', p: { view: 'list' }, kw: '명세서 거래명세 인쇄 발행 일일기록' },
        { k: 'stmt-new', n: '거래명세서 작성', d: '새 거래명세서 작성 · 발행', u: 'statement.html?view=edit', p: { view: 'edit' }, kw: '명세서 새로 발행' },
        { k: 'cust', n: '거래처', d: '거래처 등록 · 수정 (가나다순)', u: 'statement.html?view=cust', p: { view: 'cust' }, kw: '고객 업체' },
        { k: 'co', n: '회사 정보', d: '거래명세서 공급자 칸 (상호 · 주소 · 전달사항)', u: 'statement.html?view=co', p: { view: 'co' }, kw: '공급자 상호' }
      ] },
      { k: 'stock', n: '생산·재고', d: '생산 · 반입 · 입고 → 재고', c: '#1B7A43', s: '#E4F3EA', items: [
        { k: 'prod', n: '생산 입력', d: '생산량 입력 (현장 화면)', u: 'stock.html', p: { view: 'prod' }, kw: '생산실적 생산량' },
        { k: 'in', n: '생산품 반입', d: '칼라칩 · SBR 고무분말 · 분철 (색상별 kg)', u: 'stock.html?view=in', p: { view: 'in' }, kw: '반입' },
        { k: 'recv', n: '원자재 입고', d: '폐타이어 · 원자재 · 부자재 (매입에 자동 반영)', u: 'ledger.html?view=recv', p: { view: 'recv' }, kw: '입고 원료 폐타이어 부자재' },
        { k: 'st-stock', n: '현재고', d: '품목 · 색상별 현재 재고', u: 'stock.html?view=all&tab=stock', p: { view: 'all', tab: 'stock' }, kw: '재고' },
        { k: 'st-plan', n: '출고·생산 예정', d: '출고예정 · 생산예정 · 부족 품목', u: 'stock.html?view=all&tab=plan', p: { view: 'all', tab: 'plan' }, kw: '예정 부족 출고예정 생산예정' },
        { k: 'st-sum', n: '재고 현황', d: '기간별 생산 · 출고 · 반입 (10일 단위)', u: 'stock.html?view=all&tab=sum', p: { view: 'all', tab: 'sum' }, kw: '현황 전체관리' },
        { k: 'st-log', n: '재고 기록', d: '생산 · 출고 · 반입 · 조정 기록', u: 'stock.html?view=all&tab=log', p: { view: 'all', tab: 'log' }, kw: '기록 이력 조정' }
      ] },
      { k: 'tire', n: '폐타이어', d: '서식-1 · 서식-2 · 계량증명서 · 세금계산서 · 총괄표', c: '#44505C', s: '#E9EDF1', items: [
        { k: 'tire-f1', n: '서식-1 보고서', d: '회수 · 재활용 관리 대장 (입고 · 재활용량 · 보관량)', u: 'tire.html?view=f1', p: { view: 'f1' }, kw: '서식1 회수 입고 반입 재활용량 보관량' },
        { k: 'tire-f2', n: '서식-2 보고서', d: '재활용제품 생산 · 판매 및 부산물 처리 관리대장', u: 'tire.html?view=f2', p: { view: 'f2' }, kw: '서식2 생산 고무분말 철심 섬유 판매' },
        { k: 'tire-weigh', n: '계량증명서 관리', d: '계량증명서(매입,매출) — 차량 · 계량 시각 · 총중량 · 공차중량', u: 'tire.html?view=weigh', p: { view: 'weigh' }, kw: '계량증명서 계량 매입 매출 차량 총중량' },
        { k: 'tire-tax', n: '세금계산서 관리', d: '세금계산서(매출) — SBR 고무분말 · 분철 판매', u: 'tire.html?view=tax', p: { view: 'tax' }, kw: '세금계산서 매출 판매 계산서' },
        { k: 'tire-sum', n: '총괄표', d: '폐타이어 재활용 관리대장 총괄표 · 엑셀 5가지 내려받기', u: 'tire.html?view=sum', p: { view: 'sum' }, kw: '총괄표 전년재고 엑셀 내려받기 다운로드 점검' }
      ] },
      { k: 'cons', n: '공사', d: '프로젝트 · 도면 · 배합', c: '#0E7490', s: '#E0F2F7', items: [
        { k: 'pj', n: '프로젝트 목록', d: '시공 목록 · 대금 · 도면 확정 · 물량 산출', u: 'pj.html', p: { view: 'list' }, kw: '공사 시공 프로젝트' },
        { k: 'pj-new', n: '프로젝트 등록', d: '새 시공 프로젝트 등록', u: 'pj.html?view=new', p: { view: 'new' }, kw: '공사등록' },
        { k: 'pj-cal', n: '공사 일정', d: '시공 일정 달력', u: 'pj.html?view=cal', p: { view: 'cal' }, kw: '일정 달력 시공' },
        { k: 'draw', n: '도면', d: '바닥 색상 설계 · 면적 산출표 · 3D', u: 'sketchbook/', kw: '스케치북 설계 면적' },
        { k: 'mix', n: '배합 시뮬레이션', d: 'NM01 ~ NM22 색상 배합 · 바닥 미리보기', u: 'mix.html', kw: '배합 색상' },
        { k: 'pj-spec', n: '물량 산출 기준', d: '칩 겉보기밀도 · 바인더 % 기본값', u: 'pj.html?view=spec', p: { view: 'spec' }, kw: '규격 밀도 바인더 산출' }
      ] },
      { k: 'fin', n: '재무', d: '매출 · 매입 → 손익', c: '#9A5B16', s: '#FBEFE1', items: [
        { k: 'sales-l', n: '매출', d: '일별 · 월별 · 분기별 · 연간 · 전년 대비', u: 'ledger.html?view=sales', p: { view: 'sales' }, kw: '판매' },
        { k: 'buy', n: '매입', d: '지출 등록 · 기간별 합계 · 전년 대비', u: 'ledger.html?view=buy', p: { view: 'buy' }, kw: '지출 비용' },
        { k: 'tax', n: '세금계산서', d: '받은 세금계산서 (매입 · 매출)', u: 'docs.html?cat=tax', p: { cat: 'tax' }, kw: '계산서' },
        { k: 'auto', n: '자동 수집', d: '세금계산서 · 통장 · 카드 엑셀 반영', u: 'ledger.html?view=auto', p: { view: 'auto' }, kw: '통장 카드 엑셀' },
        { k: 'sum', n: '매출·매입 종합', d: '기간별 매출 · 매입 합계', u: 'ledger.html?view=sum', p: { view: 'sum' }, kw: '종합 합계' },
        { k: 'pnl', n: '손익계산서', d: '월별 매출 · 원가 · 영업이익 · 원리금 상환 후 잉여금', u: 'pnl.html', kw: '손익 이익 원가 영업이익' },
        { k: 'ana', n: '판매 분석', d: '색상 · 거래처별 판매 · 이익 · 추이', u: 'stock.html?view=all&tab=ana', p: { view: 'all', tab: 'ana' }, kw: '분석 추이' }
      ] },
      { k: 'hr', n: '인사·급여', d: '잔업 · 근태 → 급여', c: '#7A3A14', s: '#F6EDE6', items: [
        { k: 'pay-ot', n: '잔업 기록', d: '직원별 잔업 확인', u: 'admin.html?tab=ot', p: { tab: 'ot' }, kw: '잔업 야근 연장근무' },
        { k: 'pay-att', n: '근태·연차', d: '근태 기록 · 연차', u: 'admin.html?tab=att', p: { tab: 'att' }, kw: '근태 연차 휴가' },
        { k: 'pay-adj', n: '추가·공제', d: '수당 · 공제 항목', u: 'admin.html?tab=adjust', p: { tab: 'adjust' }, kw: '수당 공제' },
        { k: 'pay-ledger', n: '급여대장', d: '월별 급여 계산', u: 'admin.html?tab=ledger', p: { tab: 'ledger' }, kw: '급여 월급' },
        { k: 'pay-slips', n: '급여명세서', d: '직원별 급여명세서', u: 'admin.html?tab=slips', p: { tab: 'slips' }, kw: '명세서 급여' },
        { k: 'pay-bank', n: '은행 이체 파일', d: '급여 이체용 은행 파일', u: 'admin.html?tab=bank', p: { tab: 'bank' }, kw: '이체 은행' },
        { k: 'pay-staff', n: '직원 설정', d: '직원 목록 · 급여 기본 정보', u: 'admin.html?tab=staff', p: { tab: 'staff' }, kw: '직원 인사' },
        { k: 'pay-cfg', n: '계산 기준', d: '급여 계산 요율 · 기준값', u: 'admin.html?tab=config', p: { tab: 'config' }, kw: '요율 기준' }
      ] }
    ];
  }
  function href(it) { return BASE + it.u; }
  function fileOf(u) { return String(u).split('?')[0]; }

  /* ── 지금 보고 있는 화면 = 주소 + 화면 안 칸(nav.js가 적어 둔 기록 칸의 상태) ── */
  var DEF = { 'statement.html': { view: 'list' }, 'pj.html': { view: 'list' }, 'ledger.html': { view: 'buy' }, 'docs.html': { cat: 'todo' }, 'admin.html': { tab: 'ot' }, 'stock.html': { view: 'prod' }, 'tire.html': { view: 'f1' } };
  var SV = { 'statement.html': { view: 'tab' }, 'pj.html': { view: 'tab' }, 'ledger.html': { view: 'view' }, 'stock.html': { tab: 'tab' }, 'docs.html': { cat: 'cat' }, 'admin.html': { tab: 'tab' }, 'work.html': { d: 'd' }, 'tire.html': { view: 'view' } };
  function hereFile() {
    var path = location.pathname || '';
    if (/\/sketchbook\/(?:index\.html)?$/.test(path)) return 'sketchbook/';
    return path.replace(/^.*\//, '') || 'index.html';
  }
  function here() {
    var file = hereFile(), cur = {}, d = DEF[file] || {}, k;
    for (k in d) cur[k] = d[k];
    try { new URLSearchParams(location.search).forEach(function (v, key) { cur[key] = v; }); } catch (e) { /* 그대로 */ }
    var st = history.state, v = st && typeof st === 'object' ? st.v : null, map = SV[file];
    if (v && typeof v === 'object' && map) for (k in map) { var x = v[map[k]]; if (x != null && x !== '') cur[k] = String(x); }
    if (file === 'docs.html' && cur.cat === 'gong') cur.cat = 'all';
    var best = null, bs = -1;
    groups().forEach(function (g) {
      g.items.forEach(function (it) {
        if (fileOf(it.u) !== file) return;
        var ok = true, s = 0, p = it.p || {};
        for (var q in p) { if (cur[q] === p[q]) s++; else ok = false; }
        if (ok && s > bs) { best = it; bs = s; }
      });
    });
    return best;
  }

  /* ── 찾기: 이름 · 설명 · 찾기 말 · 대분류 이름, 한글 초성(ㄱㄹㅁㅅㅅ)도 ── */
  var CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
  function cho(s) {
    var o = '';
    for (var i = 0; i < s.length; i++) { var c = s.charCodeAt(i); o += c >= 0xAC00 && c <= 0xD7A3 ? CHO.charAt(Math.floor((c - 0xAC00) / 588)) : s.charAt(i); }
    return o;
  }
  function norm(s) { return String(s == null ? '' : s).replace(/[\s·・,.\-→()~%]/g, '').toLowerCase(); }
  /** 찾는 말과 얼마나 맞나 (0 = 안 맞음) — 이름 처음 > 이름 안 > 초성 > 찾기 말 > 대분류 > 설명. 엔터는 가장 잘 맞는 메뉴로.
      설명에만 있는 말은 이름 · 찾기 말 · 대분류로 맞는 메뉴가 하나도 없을 때만 보임 (예: '출고'를 치면 설명에 '출고'가 든 메뉴까지 다 나오지 않게) */
  function score(it, g, n) {
    if (!n) return 1;
    if (/[가-힣a-z0-9][ㄱ-ㅎㅏ-ㅣ]+$/.test(n)) n = n.replace(/[ㄱ-ㅎㅏ-ㅣ]+$/, '');   // 한글을 치는 중(조합 중 끝 글자)은 앞 글자까지로
    var nm = norm(it.n), kw = norm(it.kw || ''), c;
    if (nm === n) return 100;
    if (nm.indexOf(n) === 0) return 90;
    if (nm.indexOf(n) > 0) return 80;
    if (/^[ㄱ-ㅎ]+$/.test(n)) {   // 초성은 메뉴 이름으로만
      c = cho(nm);
      return c.indexOf(n) === 0 ? 70 : c.indexOf(n) > 0 ? 60 : 0;
    }
    if (kw.indexOf(n) >= 0) return 50;
    if (norm(g.n).indexOf(n) >= 0) return 30;
    if (norm(it.d).indexOf(n) >= 0) return 20;
    return 0;
  }
  /** 화면의 [data-g](대분류) · [data-k](소분류)를 찾는 말로 걸러 보임 → { any: 하나라도 보이나, first: 가장 잘 맞는 소분류 칸(엔터로 열 곳, data-best 표시) } */
  function filter(scope, q) {
    var n = norm(q), K = {}, any = false, first = null, top = 0, i, j, el, x;
    groups().forEach(function (g) { g.items.forEach(function (it) { K[it.k] = [it, g]; }); });
    var secs = scope.querySelectorAll('[data-g]'), sc = [];
    for (i = 0; i < secs.length; i++) {
      var els = secs[i].querySelectorAll('[data-k]'), row = [];
      for (j = 0; j < els.length; j++) { el = els[j]; x = K[el.getAttribute('data-k')]; row.push(!n ? 1 : x ? score(x[0], x[1], n) : 0); top = Math.max(top, row[j]); }
      sc.push(row);
    }
    var min = top >= 30 ? 30 : 1;
    for (i = 0; i < secs.length; i++) {
      var sec = secs[i], es = sec.querySelectorAll('[data-k]'), gv = false;
      for (j = 0; j < es.length; j++) {
        var ok = sc[i][j] >= min;
        es[j].hidden = !ok;
        es[j].removeAttribute('data-best');
        if (ok) { gv = true; if (sc[i][j] === top && !first) first = es[j]; }   // 가장 잘 맞는 것 중 위에 있는 것 = 엔터
      }
      sec.hidden = !gv;
      if (gv) any = true;
    }
    if (first && n) first.setAttribute('data-best', '');
    return { any: any, first: first };
  }

  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  /** 머리글 '메뉴' 단추 (화면이 글로 머리글을 그릴 때) */
  /** '관리자' 단추 = 관리자 첫 화면으로 바로 (2026-11-25 20:31 지시 "모든창구에서 관리자 첫화면으로 돌아가는 버튼 하나 만들어라") */
  function hubBtn(cls) {
    return '<a class="nmc-hub' + (cls ? ' ' + cls : '') + '" href="' + esc(BASE + 'manage.html') + '" data-nmc-home aria-label="관리자 첫 화면" title="관리자 첫 화면">' + HOME_IC + '<span>관리자</span></a>';
  }
  /** 머리글 단추 묶음: 관리자(첫 화면으로) + 메뉴(전체 메뉴 창) — 화면이 글로 머리글을 그릴 때 */
  function btn(cls) {
    return hubBtn(cls) + '<a class="nmc-menu' + (cls ? ' ' + cls : '') + '" href="' + esc(BASE + 'manage.html') + '" data-nmc-menu aria-haspopup="dialog" aria-label="전체 메뉴" title="전체 메뉴">' + MENU_IC + '<span>메뉴</span></a>';
  }
  /** 화면에 그대로 적힌 '메뉴' 단추 앞에 '관리자' 단추를 붙임 (같은 모양 class) — 화면마다 따로 적지 않아도 모든 관리자 화면에 */
  function mountHub() {
    Array.prototype.forEach.call(document.querySelectorAll('a[data-nmc-menu]'), function (m) {
      const prev = m.previousElementSibling;
      if (prev && prev.hasAttribute('data-nmc-home')) return;
      const cls = String(m.className || '').split(/\s+/).filter(function (c) { return c && c !== 'nmc-menu'; }).join(' ');
      m.insertAdjacentHTML('beforebegin', hubBtn(cls));
    });
  }

  function css() {
    if (document.getElementById('nmc-menu-css')) return;
    var el = document.createElement('style');
    el.id = 'nmc-menu-css';
    el.textContent =
      'a.nmc-menu[data-nmc-menu],a.nmc-hub[data-nmc-home]{display:inline-flex;align-items:center;gap:5px;white-space:nowrap}a.nmc-menu[data-nmc-menu] svg,a.nmc-hub[data-nmc-home] svg{flex:none}' +
      '@media (max-width:420px){a.nmc-hub[data-nmc-home]>span,a.nmc-menu[data-nmc-menu]>span{position:absolute;width:1px;height:1px;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}' +   /* 휴대폰: 관리자 = 집 그림 · 메뉴 = 줄 세 개 (머리글 한 줄 — 이름은 읽어 주기 · 손가락 올리면 보임) */
        'header h1>small:not([id]){display:none}}' +   /* 휴대폰: 제목 옆 영문(STATEMENT · PROJECT · MIX)은 숨김 */

      '.nmm{position:fixed;inset:0;z-index:2147483000;display:flex;justify-content:center;align-items:flex-start;color:#0F172A;font-family:"Noto Sans KR","Malgun Gothic","Apple SD Gothic Neo",sans-serif;font-size:16px;line-height:1.5;word-break:keep-all;text-align:left;-webkit-text-size-adjust:100%}' +
      '.nmm[hidden],.nmm [hidden]{display:none!important}.nmm *{box-sizing:border-box}' +
      '.nmm .nmm-bg{position:absolute;inset:0;background:rgba(15,23,42,.5)}' +
      '.nmm .nmm-p{position:relative;display:flex;flex-direction:column;width:100%;height:100%;margin:0;background:#EEF2F7;outline:none;box-shadow:0 14px 44px rgba(15,23,42,.38)}' +
      '.nmm .nmm-h{display:flex;align-items:center;gap:8px;flex:none;margin:0;padding:10px 12px;padding-top:max(10px,env(safe-area-inset-top));background:#1B3A6B;color:#fff}' +
      '.nmm .nmm-h h2{margin:0;padding:0;font-size:18px;font-weight:800;line-height:1.3;white-space:nowrap;color:#fff;letter-spacing:0}' +
      '.nmm .nmm-q{flex:1;min-width:0;display:flex;align-items:center;gap:6px;min-height:42px;margin:0;padding:0 10px;border:0;border-radius:12px;background:#fff;color:#5B6474;font-weight:400}' +
      '.nmm .nmm-q input{flex:1;width:auto;min-width:0;height:40px;min-height:0;margin:0;padding:0;border:0;border-radius:0;outline:0;box-shadow:none;background:transparent;-webkit-appearance:none;appearance:none;font:inherit;font-size:16px;color:#0F172A}' +
      '.nmm .nmm-x{flex:none;width:auto;min-width:54px;min-height:42px;margin:0;padding:0 10px;border:0;border-radius:12px;background:rgba(255,255,255,.18);color:#fff;font:inherit;font-size:15px;font-weight:800;cursor:pointer;box-shadow:none}' +
      '.nmm .nmm-x:hover{background:rgba(255,255,255,.28);color:#fff}' +
      '.nmm .nmm-qk{display:flex;flex-wrap:wrap;gap:8px;flex:none;margin:0;padding:10px 12px 0}' +
      '.nmm .nmm-qk a{display:inline-flex;align-items:center;gap:5px;min-height:40px;padding:0 14px;border:2px solid #DCE3EC;border-radius:999px;background:#fff;color:#1B3A6B;font-size:14.5px;font-weight:800;text-decoration:none}' +
      '.nmm .nmm-b{flex:1;min-height:0;overflow:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;display:grid;gap:10px;align-content:start;margin:0;padding:10px 12px calc(16px + env(safe-area-inset-bottom))}' +
      '.nmm .nmm-g{min-width:0;margin:0;background:#fff;border:1px solid #DCE3EC;border-top:5px solid var(--c);border-radius:16px;padding:10px;box-shadow:none}' +
      '.nmm .nmm-gh{display:flex;align-items:center;gap:9px;margin:0 0 6px}' +
      '.nmm .nmm-ic{display:inline-flex;align-items:center;justify-content:center;flex:none;width:34px;height:34px;border-radius:10px;background:var(--s);color:var(--c)}' +
      '.nmm .nmm-gh h3{margin:0;padding:0;font-size:17px;font-weight:800;line-height:1.25;color:var(--c)}' +
      '.nmm .nmm-gh small{display:block;margin:0;font-size:12px;font-weight:700;line-height:1.35;color:#5B6474}' +
      '.nmm .nmm-g ul{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}' +
      '.nmm .nmm-g li{margin:0;padding:0;min-width:0}' +
      '.nmm .nmm-i{display:flex;flex-direction:column;justify-content:center;min-height:50px;height:100%;margin:0;padding:5px 9px;border:2px solid #E6EBF2;border-radius:11px;background:#F8FAFC;color:#0F172A;text-decoration:none}' +
      '.nmm .nmm-i b{display:block;font-size:15.5px;font-weight:800;line-height:1.3;color:#0F172A}' +
      '.nmm .nmm-i small{display:block;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;margin:0;font-size:12px;font-weight:600;line-height:1.35;color:#5B6474}' +
      '.nmm .nmm-i:hover{background:var(--s);border-color:var(--c);text-decoration:none}' +
      '.nmm .nmm-i[aria-current="page"]{background:var(--s);border-color:var(--c)}' +
      '.nmm .nmm-i em{display:inline-block;margin-left:5px;padding:0 6px;border-radius:999px;background:var(--c);color:#fff;font-size:11px;font-style:normal;font-weight:800;line-height:1.6;vertical-align:2px}' +
      '.nmm .nmm-none{margin:0;padding:22px 10px;text-align:center;color:#5B6474;font-weight:700}' +
      '.nmm li[data-best] .nmm-i{border-color:var(--c);border-style:dashed;background:#fff}' +
      '.nmm .nmm-i:focus-visible,.nmm .nmm-qk a:focus-visible,.nmm .nmm-x:focus-visible{outline:3px solid #F4B400;outline-offset:2px}' +
      '@media (max-width:330px){.nmm .nmm-g ul{grid-template-columns:1fr}}' +
      '@media (min-width:760px){.nmm .nmm-p{width:min(1120px,calc(100vw - 32px));height:auto;max-height:calc(100vh - 32px);margin-top:16px;border-radius:20px;overflow:hidden}' +
        '.nmm .nmm-h{padding:12px 16px}.nmm .nmm-qk{padding:12px 16px 0}.nmm .nmm-b{grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;padding:12px 16px 18px}' +
        '.nmm .nmm-i{min-height:48px}}' +
      '@media (min-width:1060px){.nmm .nmm-b{grid-template-columns:repeat(3,minmax(0,1fr))}' +   /* 대분류 7개(2026-11-25 폐타이어 추가): 3칸이면 마지막 줄에 혼자 남는 칸은 한 줄 전체 · 소분류 4칸 */
        '.nmm .nmm-g:last-child:nth-child(3n+1){grid-column:1/-1}.nmm .nmm-g:last-child:nth-child(3n+1) ul{grid-template-columns:repeat(4,minmax(0,1fr))}}' +
      '@media (min-width:1340px){.nmm .nmm-p{width:min(1480px,calc(100vw - 32px))}.nmm .nmm-b{grid-template-columns:repeat(4,minmax(0,1fr))}' +   /* 넓은 PC: 4칸 두 줄 — 메뉴 전체가 한 화면에 */
        '.nmm .nmm-g:last-child:nth-child(3n+1){grid-column:auto}.nmm .nmm-g:last-child:nth-child(3n+1) ul{grid-template-columns:repeat(2,minmax(0,1fr))}}' +
      '@media print{.nmm,a.nmc-menu[data-nmc-menu],a.nmc-hub[data-nmc-home]{display:none!important}}';
    (document.head || document.documentElement).appendChild(el);
  }

  /* ── 메뉴 창 ── */
  var D = null, OV = null, LAST = null;
  function $(id) { return document.getElementById(id); }
  function groupsHtml(cur) {
    return groups().map(function (g) {
      return '<section class="nmm-g" data-g="' + g.k + '" style="--c:' + g.c + ';--s:' + g.s + '" aria-labelledby="nmmG-' + g.k + '">' +
        '<div class="nmm-gh"><span class="nmm-ic">' + icon(g.k, 20) + '</span><div><h3 id="nmmG-' + g.k + '">' + esc(g.n) + '</h3><small>' + esc(g.d) + '</small></div></div><ul>' +
        g.items.map(function (it) {
          var on = !!cur && cur.k === it.k;
          return '<li data-k="' + esc(it.k) + '"><a class="nmm-i" href="' + esc(href(it)) + '" title="' + esc(it.n + ' — ' + it.d) + '"' + (on ? ' aria-current="page"' : '') + '><b>' + esc(it.n) + (on ? '<em>현재 화면</em>' : '') + '</b><small>' + esc(it.d) + '</small></a></li>';
        }).join('') + '</ul></section>';
    }).join('');
  }
  function build() {
    css();
    D = document.createElement('div');
    D.className = 'nmm';
    D.id = 'nmcMenu';
    D.hidden = true;
    D.innerHTML = '<div class="nmm-bg" data-nmm-x></div>' +
      '<div class="nmm-p" role="dialog" aria-modal="true" aria-labelledby="nmmT" tabindex="-1">' +
      '<div class="nmm-h"><h2 id="nmmT">전체 메뉴</h2>' +
      '<label class="nmm-q">' + FIND_IC + '<input id="nmmQ" type="search" placeholder="메뉴 찾기 (예: 명세서)" autocomplete="off" enterkeyhint="go" aria-label="메뉴 찾기"></label>' +
      '<button type="button" class="nmm-x" data-nmm-x aria-label="메뉴 닫기">닫기</button></div>' +
      '<div class="nmm-qk"><a href="' + esc(BASE + 'manage.html') + '">' + HUB_IC + '관리자 첫 화면</a><a href="' + esc(BASE + './') + '">' + HOME_IC + '홈</a></div>' +
      '<div class="nmm-b" id="nmmB"></div></div>';
    document.body.appendChild(D);
    var q = $('nmmQ');
    q.addEventListener('input', function () { find(q.value); });
    D.addEventListener('click', function (e) {
      if (e.target.closest('[data-nmm-x]')) { close(); return; }
      var a = e.target.closest('a.nmm-i[aria-current="page"]');
      if (a && !e.ctrlKey && !e.metaKey && !e.shiftKey) { e.preventDefault(); close(); }   // 지금 화면 = 닫기만
    });
    D.addEventListener('keydown', function (e) {
      if (e.isComposing || e.keyCode === 229) return;   // 한글 조합 중에는 건드리지 않음
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); return; }
      if (e.key === 'Enter' && e.target === q) {
        e.preventDefault(); e.stopPropagation();
        var r = find(q.value), a = r.first && r.first.querySelector('a');
        if (a && q.value.trim()) a.click();
        return;
      }
      if (e.key === 'Tab') {   // 창 안에서만 돎
        var fs = Array.prototype.filter.call(D.querySelectorAll('a[href],button,input'), function (x) { return x.offsetParent !== null; });
        if (!fs.length) return;
        var f0 = fs[0], f1 = fs[fs.length - 1];
        if (e.shiftKey && (document.activeElement === f0 || !D.contains(document.activeElement))) { e.preventDefault(); f1.focus(); }
        else if (!e.shiftKey && document.activeElement === f1) { e.preventDefault(); f0.focus(); }
      }
    });
  }
  function find(v) {
    var b = $('nmmB'), r = filter(b, v), none = $('nmmNone');
    if (!r.any && !none) { b.insertAdjacentHTML('beforeend', '<p class="nmm-none" id="nmmNone">찾는 메뉴가 없습니다. 다른 말로 찾아 주십시오.</p>'); }
    else if (none) none.hidden = r.any;
    return r;
  }
  function isOpen() { return !!D && !D.hidden && document.body.contains(D); }
  function open() {
    if (!document.body) return;
    if (!D || !document.body.contains(D)) build();
    var cur = here(), b = $('nmmB'), q = $('nmmQ');
    b.innerHTML = groupsHtml(cur);
    q.value = '';
    LAST = document.activeElement;
    D.hidden = false;
    OV = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    b.scrollTop = 0;
    var on = b.querySelector('[aria-current="page"]');
    if (on && on.scrollIntoView && b.scrollHeight > b.clientHeight) { try { on.scrollIntoView({ block: 'center' }); } catch (e) { /* 그대로 */ } }
    var fine = false;
    try { fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches; } catch (e) { fine = false; }
    if (fine) q.focus(); else D.querySelector('.nmm-p').focus();   // 휴대폰은 자판이 바로 올라오지 않게
  }
  function close() {
    if (!isOpen()) return;
    D.hidden = true;
    document.documentElement.style.overflow = OV || '';
    if (LAST && LAST.focus && document.body.contains(LAST)) { try { LAST.focus(); } catch (e) { /* 그대로 */ } }
    LAST = null;
  }
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('[data-nmc-menu]') : null;
    if (!a || e.button || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;   // 새 탭으로 열기는 그대로 (관리자 첫 화면)
    e.preventDefault();
    if (isOpen()) close(); else open();
  }, true);
  window.addEventListener('pagehide', close);   // 다른 화면으로 갔다가 '뒤로'로 오면 닫힌 채로
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountHub); else mountHub();
  css();

  window.NMCMenu = {
    groups: groups, href: href, icon: icon, btn: btn, hubBtn: hubBtn, mountHub: mountHub, here: here, filter: filter, setDepts: setDepts, deptItem: deptItem,
    open: open, close: close, isOpen: isOpen, menuIcon: MENU_IC, findIcon: FIND_IC
  };
})();
