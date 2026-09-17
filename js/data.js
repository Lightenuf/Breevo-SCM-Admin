/* =========================
   데이터 연결부
   기존 Apps Script(google.script.run) 호출 15개를 대체합니다.
   화면 코드(core.js / views.js)는 이 함수들의 이름과 반환 형태만 알면 되므로,
   여기만 바꾸면 화면은 한 줄도 건드리지 않고 백엔드를 교체할 수 있습니다.
   ========================= */

const SENDER_NAME = '라이트이너프(브리보)';
const LOGISTICS_EMAIL = 'nine-logis@naver.com';
const SCM_EMAIL = 'scm@lightenuf.com';

/* 샘플 모드에서 화면 동작을 확인하기 위한 메모리 저장소 */
const sampleStore = {
  data: null,
  settings: { leadDays: 4 }
};

function sampleData() {
  if (!sampleStore.data) {
    sampleStore.data = buildSampleAdminData();
  }
  return sampleStore.data;
}

function sampleAllOrders() {
  const d = sampleData();
  return [
    ...d.sponsor,
    ...d.ambassador,
    ...d.event,
    ...d.sample,
    ...d.b2b
  ];
}

function sampleFindOrder(id) {
  return sampleAllOrders().find(o => o.id === id) || null;
}

function sampleDelay(value, ms = 180) {
  return new Promise(resolve => {
    setTimeout(() => resolve(value), ms);
  });
}

function sampleNowStamp() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');

  return (
    `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  );
}

function notConnected(name) {
  return Promise.reject(
    new Error(
      `아직 Supabase에 연결되지 않았습니다 (${name}). ` +
      `js/config.js 에 주소와 키를 넣어주세요.`
    )
  );
}

/* =========================
   이지어드민 발주행 생성 규칙
   Code.gs 의 buildEasyAdminRows_ 를 그대로 옮긴 것입니다.
   6캔 선물세트, 12캔 분할, 96캔 혼합 시 수령인 -1 / -2 규칙 포함.
   ========================= */

function easyProductName(taste, packSize, giftSet) {
  return (
    `브리보 프리바이오틱 소다 ` +
    `${taste} 355ml ` +
    `${packSize}개입` +
    (giftSet ? ' 선물세트' : '')
  );
}

function buildEasyAdminRows(order) {
  const result = [];
  const itemCount = Math.max(1, Number(order.itemCount) || 1);

  const makeRow = (recipientName, taste, packSize, giftSet, innerQty) => ({
    '보내는분성명': SENDER_NAME,
    '보내는분전화번호': '',
    '보내는분주소(전체, 분할)': '',
    '받는분성명': recipientName,
    '주문자성명': '',
    '받는분전화번호': order.phone,
    '받는분기타연락처': '',
    '받는분우편번호': '',
    '받는분주소(전체, 분할)': order.addr,
    '품목명': easyProductName(taste, packSize, giftSet),
    '배송메세지1': '',
    '내품수량': innerQty,
    '박스수량': '',
    '운송장번호': ''
  });

  if (order.qty === 6) {
    if (order.flavor === 'apple') {
      result.push(makeRow(order.name, '사과', 6, true, itemCount));
    }
    if (order.flavor === 'peach') {
      result.push(makeRow(order.name, '복숭아', 6, true, itemCount));
    }
    return result;
  }

  if (order.qty === 12) {
    if (order.flavor === 'mix') {
      result.push(makeRow(order.name, '사과', 6, true, itemCount));
      result.push(makeRow(order.name, '복숭아', 6, true, itemCount));
    }
    if (order.flavor === 'apple') {
      result.push(makeRow(order.name, '사과', 6, true, 2 * itemCount));
    }
    if (order.flavor === 'peach') {
      result.push(makeRow(order.name, '복숭아', 6, true, 2 * itemCount));
    }
    return result;
  }

  if (order.flavor === 'mix') {
    const eachQty = order.qty / 2;
    const appleName = order.qty === 96 ? `${order.name}-1` : order.name;
    const peachName = order.qty === 96 ? `${order.name}-2` : order.name;

    result.push(makeRow(appleName, '사과', eachQty, false, itemCount));
    result.push(makeRow(peachName, '복숭아', eachQty, false, itemCount));
  }

  if (order.flavor === 'apple') {
    result.push(makeRow(order.name, '사과', order.qty, false, itemCount));
  }

  if (order.flavor === 'peach') {
    result.push(makeRow(order.name, '복숭아', order.qty, false, itemCount));
  }

  return result;
}

/* =========================
   Supabase 조회 공통
   기존 Code.gs 의 계산 규칙을 그대로 옮겼습니다.
   ========================= */

function todayIsoKst() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(new Date());
}

function nowStampKst() {
  const p = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul', hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  }).formatToParts(new Date()).reduce((a, x) => (a[x.type] = x.value, a), {});

  return `${p.year}.${p.month}.${p.day} ${p.hour}:${p.minute}:${p.second}`;
}

function flavorLabelOf(flavor) {
  if (flavor === 'mix') return '사과+복숭아';
  if (flavor === 'apple') return '사과';
  if (flavor === 'peach') return '복숭아';
  return '';
}

/* 화면과 어드민 관리(order_overrides)를 잇는 기존 관리ID 형식 그대로 */
function legacyId(kind, row) {
  return row.source === 'manual'
    ? `${kind}::manual::${row.id}`
    : `${kind}::${row.source_sheet}::${row.source_row}`;
}

function addDaysIsoLocal(iso, delta) {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return '';
  d.setDate(d.getDate() + delta);
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0')
  ].join('-');
}

function stampText(value) {
  if (!value) return '';
  const p = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul', hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  }).formatToParts(new Date(value)).reduce((a, x) => (a[x.type] = x.value, a), {});

  return `${p.year}.${p.month}.${p.day} ${p.hour}:${p.minute}:${p.second}`;
}

/* 원본 값 위에 '어드민 관리'의 수정 내용을 덮어씁니다. */
function applyOverride(base, ov) {
  if (!ov) return base;

  const out = { ...base };

  if (ov.edit_insta)      out.insta = ov.edit_insta;
  if (ov.edit_name)       out.name = ov.edit_name;
  if (ov.edit_phone)      out.phone = ov.edit_phone;
  if (ov.edit_addr)       out.addr = ov.edit_addr;
  if (ov.edit_event_date) out.eventDate = ov.edit_event_date;
  if (ov.edit_qty)        out.qty = Number(ov.edit_qty);

  if (ov.edit_flavor) {
    const f = String(ov.edit_flavor).replace(/\s/g, '');
    out.flavor =
      (f === '사과+복숭아' || f === 'mix') ? 'mix'
      : (f === '사과' || f === 'apple') ? 'apple'
      : (f === '복숭아' || f === 'peach') ? 'peach'
      : out.flavor;
  }

  if (ov.event_title) out.eventTitle = ov.event_title;

  out.memo = ov.memo || '';
  out.sheetAt = stampText(ov.sheet_created_at);
  out.doneAt = stampText(ov.done_at);
  out.hold = !!ov.hold;

  return out;
}

function splitQtyOf(qty, flavor) {
  const n = Number(qty) || 0;
  if (flavor === 'apple') return { apple: n, peach: 0 };
  if (flavor === 'peach') return { apple: 0, peach: n };
  if (flavor === 'mix')   return { apple: n / 2, peach: n / 2 };
  return { apple: 0, peach: 0 };
}

function sponsorStatusOf(o, dueDate, today) {
  if (o.infoMissing) return '정보 확인 필요';
  if (o.hold) return '보류';
  if (o.doneAt) return '발주 완료';
  if (!dueDate) return '정보 확인 필요';
  if (dueDate < today) return '발주 지연';
  if (dueDate === today) return '오늘 발주';
  return '발주 대기';
}

function shippingStatusOf(o) {
  if (o.infoMissing) return '정보 확인 필요';
  if (o.hold) return '보류';
  if (o.doneAt) return '출고 완료';
  return '출고 대기';
}

function b2bStatusOf(o, receivedDate, today) {
  if (o.infoMissing) return '정보 확인 필요';
  if (o.hold) return '보류';
  if (o.doneAt) return '출고 완료';
  if (!receivedDate) return '정보 확인 필요';
  if (receivedDate < today) return '발주 지연';
  if (receivedDate === today) return '오늘 발주';
  return '발주 대기';
}

const SPONSOR_RANK = {
  '발주 지연': 1, '오늘 발주': 2, '정보 확인 필요': 3,
  '발주 대기': 4, '보류': 5, '발주 완료': 6
};

function groupB2B(orders) {
  const map = {};

  orders.forEach(order => {
    const key = String(order.company || '').trim();
    if (!key) return;

    if (!map[key]) {
      map[key] = {
        company: order.company,
        branch: order.branch || '',
        name: order.name,
        phone: order.phone,
        addr: order.addr,
        latestDate: order.receivedDate,
        latestAt: order.receivedAt || order.receivedDate,
        latestProduct: order.b2bProduct,
        latestQty: order.qty,
        latestFlavor: order.flavor,
        latestFlavorLabel: order.flavorLabel,
        pendingCount: 0,
        orders: []
      };
    }

    map[key].orders.push(order);
    if (order.status !== '출고 완료') map[key].pendingCount += 1;
  });

  return Object.values(map);
}

/* =========================
   1. 주문 데이터 조회
   ========================= */

async function fetchAdminData() {
  const today = todayIsoKst();

  const [
    sponsorRes, ambRes, eventRes, sampleRes,
    b2bRes, manualRes, ovRes, oliveRes, settingRes
  ] = await Promise.all([
    supabaseClient.from('sponsor_orders').select('*'),
    supabaseClient.from('ambassador_orders').select('*'),
    supabaseClient.from('event_orders').select('*'),
    supabaseClient.from('sample_orders').select('*'),
    supabaseClient.from('b2b_orders').select('*'),
    supabaseClient.from('manual_orders').select('*'),
    supabaseClient.from('order_overrides').select('*'),
    supabaseClient.from('olive_uploads').select('*'),
    supabaseClient.from('admin_settings').select('*').eq('key', 'lead_days').maybeSingle()
  ]);

  const firstError = [
    sponsorRes, ambRes, eventRes, sampleRes,
    b2bRes, manualRes, ovRes, oliveRes
  ].find(r => r.error);

  if (firstError) {
    throw new Error(firstError.error.message);
  }

  const leadDays = Number(settingRes?.data?.value) || 4;

  const ovMap = {};
  (ovRes.data || []).forEach(o => { ovMap[o.order_id] = o; });

  /* ── 협찬 ── */
  const sponsor = (sponsorRes.data || []).map(r => {
    const id = legacyId('sponsor', r);

    let o = {
      id, kind: 'sponsor', kindLabel: '협찬',
      source: r.source, sourceSheet: r.source_sheet, sourceRow: r.source_row,
      timestamp: r.timestamp_raw, receivedDate: r.received_date,
      insta: r.insta || '', name: r.name || '', phone: r.phone || '',
      addr: r.addr || '', eventDate: r.event_date,
      qty: r.qty, flavor: r.flavor,
      memo: '', sheetAt: '', doneAt: '', hold: false
    };

    o = applyOverride(o, ovMap[id]);

    o.infoMissing =
      !o.name || !o.phone || !o.addr || !o.eventDate || !o.qty || !o.flavor;

    o.dueDate = addDaysIsoLocal(o.eventDate, -leadDays);
    o.status = sponsorStatusOf(o, o.dueDate, today);
    o.flavorLabel = flavorLabelOf(o.flavor);

    const s = splitQtyOf(o.qty, o.flavor);
    o.appleQty = s.apple;
    o.peachQty = s.peach;

    return o;
  });

  /* ── 엠베서더 / 이벤트 / 샘플 ── */
  const makeShipping = (rows, kind, kindLabel, withFlavorCheck = true) =>
    (rows || []).map(r => {
      const id = legacyId(kind, r);

      let o = {
        id, kind, kindLabel,
        source: r.source, sourceSheet: r.source_sheet, sourceRow: r.source_row,
        timestamp: r.timestamp_raw, receivedDate: r.received_date,
        eventTitle: r.event_title || '',
        insta: r.insta || '', name: r.name || '', phone: r.phone || '',
        addr: r.addr || '', qty: r.qty, flavor: r.flavor,
        memo: '', sheetAt: '', doneAt: '', hold: false
      };

      o = applyOverride(o, ovMap[id]);

      o.infoMissing = withFlavorCheck
        ? (!o.name || !o.phone || !o.addr || !o.flavor)
        : (!o.name || !o.phone || !o.addr);

      o.status = shippingStatusOf(o);
      o.flavorLabel = flavorLabelOf(o.flavor);

      const s = splitQtyOf(o.qty, o.flavor);
      o.appleQty = s.apple;
      o.peachQty = s.peach;

      return o;
    });

  const ambassador = makeShipping(ambRes.data, 'amb', '엠베서더');
  const event = makeShipping(eventRes.data, 'event', '이벤트');
  const sample = makeShipping(sampleRes.data, 'sample', '샘플', false);

  event.forEach(o => { if (!o.eventTitle) o.eventTitle = '브리보 이벤트'; });

  /* ── B2B ── */
  const b2b = (b2bRes.data || []).map(r => {
    const id = legacyId('b2b', r);

    let o = {
      id, kind: 'b2b', kindLabel: 'B2B',
      source: r.source, sourceSheet: r.source_sheet, sourceRow: r.source_row,
      timestamp: r.timestamp_raw,
      receivedDate: r.received_date,
      receivedAt: stampText(r.received_at) || r.timestamp_raw,
      company: r.company || '', branch: r.branch || '',
      insta: '', name: r.name || '', phone: r.phone || '', addr: r.addr || '',
      qty: r.qty, flavor: r.flavor, b2bProduct: r.b2b_product || '',
      memo: '', sheetAt: '', doneAt: '', hold: false
    };

    o = applyOverride(o, ovMap[id]);

    const validProduct =
      (o.qty === 24 && ['apple', 'peach'].includes(o.flavor)) ||
      (o.qty === 48 && ['apple', 'peach', 'mix'].includes(o.flavor));

    o.infoMissing =
      !o.company || !o.branch || !o.name || !o.phone || !o.addr ||
      !o.receivedDate || !validProduct;

    o.dueDate = o.receivedDate;
    o.status = b2bStatusOf(o, o.receivedDate, today);
    o.flavorLabel = flavorLabelOf(o.flavor);

    const s = splitQtyOf(o.qty, o.flavor);
    o.appleQty = s.apple;
    o.peachQty = s.peach;

    return o;
  });

  /* ── 수동 발주: 각 채널 목록에 합칩니다 ── */
  (manualRes.data || []).forEach(r => {
    const kind = r.kind;
    const id = `${kind}::manual::${r.id}`;
    const receivedDate = String(r.registered_at || '').slice(0, 10);

    let o = {
      id, kind,
      kindLabel: {
        sponsor: '협찬', amb: '엠베서더', event: '이벤트',
        resend: '오배송건 재발송', sample: '샘플', b2b: 'B2B'
      }[kind] || kind,
      source: 'manual',
      timestamp: stampText(r.registered_at),
      receivedDate,
      receivedAt: stampText(r.registered_at),
      insta: '', name: r.name || '', phone: r.phone || '', addr: r.addr || '',
      qty: r.qty, flavor: r.flavor,
      company: r.company || '', branch: r.company ? '수동 등록' : '',
      itemCount: r.item_count || 1,
      b2bProduct: r.qty ? `${r.qty}캔 (${flavorLabelOf(r.flavor)})` : '',
      eventDate: null,
      memo: '', sheetAt: '', doneAt: '', hold: false
    };

    o = applyOverride(o, ovMap[id]);

    o.infoMissing = !o.name || !o.phone || !o.addr || !o.qty || !o.flavor;
    o.flavorLabel = flavorLabelOf(o.flavor);

    const s = splitQtyOf(o.qty, o.flavor);
    o.appleQty = s.apple;
    o.peachQty = s.peach;

    if (kind === 'sponsor') {
      o.dueDate = o.eventDate ? addDaysIsoLocal(o.eventDate, -leadDays) : receivedDate;
      o.status = o.infoMissing ? '정보 확인 필요'
        : o.hold ? '보류'
        : o.doneAt ? '발주 완료'
        : o.dueDate < today ? '발주 지연'
        : o.dueDate === today ? '오늘 발주'
        : '발주 대기';
      sponsor.push(o);
    } else if (kind === 'amb') {
      o.status = shippingStatusOf(o);
      ambassador.push(o);
    } else if (kind === 'sample') {
      o.status = shippingStatusOf(o);
      sample.push(o);
    } else if (kind === 'b2b') {
      o.dueDate = receivedDate;
      o.status = b2bStatusOf(o, receivedDate, today);
      b2b.push(o);
    } else {
      /* event 와 resend(오배송건 재발송)는 이벤트 목록에 함께 표시됩니다 */
      if (!o.eventTitle) {
        o.eventTitle = kind === 'resend' ? '오배송건 재발송' : '브리보 이벤트';
      }
      o.status = shippingStatusOf(o);
      event.push(o);
    }
  });

  /* ── 정렬 (기존 어드민과 동일) ── */
  sponsor.sort((a, b) =>
    ((SPONSOR_RANK[a.status] || 9) - (SPONSOR_RANK[b.status] || 9)) ||
    String(a.dueDate || '').localeCompare(String(b.dueDate || ''))
  );

  const byReceivedDesc = (a, b) =>
    String(b.receivedDate || '').localeCompare(String(a.receivedDate || ''));

  ambassador.sort(byReceivedDesc);
  event.sort(byReceivedDesc);
  sample.sort(byReceivedDesc);
  b2b.sort((a, b) =>
    String(b.receivedAt || b.receivedDate || '')
      .localeCompare(String(a.receivedAt || a.receivedDate || ''))
  );

  /* ── 올리브영 이력 ── */
  const olive = (oliveRes.data || [])
    .map(r => ({
      id: `olive::${r.id}`,
      uploadedAt: stampText(r.uploaded_at),
      fileName: r.file_name || '',
      fingerprint: r.fingerprint || '',
      orderCount: r.order_count || 0,
      rowCount: r.row_count || 0,
      appleQty: r.apple_qty || 0,
      peachQty: r.peach_qty || 0,
      otherQty: r.other_qty || 0,
      status: r.status || '미다운로드',
      downloadedAt: stampText(r.downloaded_at),
      downloadFileName: r.download_file_name || ''
    }))
    .sort((a, b) => String(b.uploadedAt).localeCompare(String(a.uploadedAt)));

  const b2bGroups = groupB2B(b2b);

  return {
    generatedAt: nowStampKst(),
    today,
    sponsor, ambassador, event, sample, b2b, b2bGroups, olive,
    summary: {
      sponsor: sponsor.length,
      ambassador: ambassador.length,
      event: event.length,
      sample: sample.length,
      b2b: b2b.length,
      b2bCompanies: b2bGroups.length,
      olive: olive.length,
      sponsorToday: sponsor.filter(x => x.status === '오늘 발주').length,
      sponsorOverdue: sponsor.filter(x => x.status === '발주 지연').length,
      ambassadorWaiting: ambassador.filter(x => x.status === '출고 대기').length,
      eventWaiting: event.filter(x => x.status === '출고 대기').length,
      sampleWaiting: sample.filter(x => x.status === '출고 대기').length,
      b2bToday: b2b.filter(x => x.status === '오늘 발주').length,
      b2bOverdue: b2b.filter(x => x.status === '발주 지연').length
    }
  };
}

function gasGet() {
  if (IS_SAMPLE_MODE) {
    return sampleDelay(sampleData(), 240);
  }
  return fetchAdminData();
}

/* =========================
   2. 관리자 설정
   ========================= */

async function gasGetSettings() {
  if (IS_SAMPLE_MODE) {
    return sampleDelay({ ...sampleStore.settings }, 80);
  }

  const { data, error } = await supabaseClient
    .from('admin_settings')
    .select('value')
    .eq('key', 'lead_days')
    .maybeSingle();

  if (error) throw new Error(error.message);

  return { leadDays: Number(data?.value) || 4 };
}

async function gasSaveSettings(settings) {
  if (IS_SAMPLE_MODE) {
    const days = Number(settings?.leadDays);

    if (!Number.isFinite(days) || days < 0 || days > 30) {
      return Promise.reject(
        new Error('발주 기준일은 0일에서 30일 사이로 입력해주세요.')
      );
    }

    sampleStore.settings.leadDays = Math.round(days);
    return sampleDelay({ ...sampleStore.settings }, 80);
  }

  const days = Number(settings?.leadDays);

  if (!Number.isFinite(days) || days < 0 || days > 30) {
    throw new Error('발주 기준일은 0일에서 30일 사이로 입력해주세요.');
  }

  const { error } = await supabaseClient
    .from('admin_settings')
    .update({ value: String(Math.round(days)), updated_at: new Date().toISOString() })
    .eq('key', 'lead_days');

  if (error) throw new Error(error.message);

  return { leadDays: Math.round(days) };
}

/* =========================
   3. 주문 수정 / 상태 변경
   ========================= */

async function gasUpdate(id, patch) {
  if (IS_SAMPLE_MODE) {
    const order = sampleFindOrder(id);

    if (!order) {
      return Promise.reject(new Error('주문을 찾지 못했습니다.'));
    }

    const map = {
      '상태': 'status',
      '이벤트명': 'eventTitle',
      '수정 인스타그램': 'insta',
      '수정 수령인': 'name',
      '수정 연락처': 'phone',
      '수정 주소': 'addr',
      '수정 행사 날짜': 'eventDate',
      '수정 수량': 'qty',
      '수정 맛 구성': 'flavor',
      '내부 메모': 'memo'
    };

    Object.keys(patch || {}).forEach(key => {
      const field = map[key];
      if (!field) return;

      const value = patch[key];
      if (value === '' || value == null) return;

      order[field] = field === 'qty' ? Number(value) : value;
    });

    if (order.flavor) {
      order.flavorLabel = sampleFlavorLabel(order.flavor);
      const split = sampleSplit(order.qty, order.flavor);
      order.appleQty = split.apple;
      order.peachQty = split.peach;
    }

    return sampleDelay({ success: true }, 120);
  }

  return upsertOverride(id, patch);
}

/* 어드민 관리(order_overrides)에 수정 내용을 기록합니다.
   기존 시트의 열 이름을 그대로 받아서 표의 칸으로 옮깁니다. */
async function upsertOverride(id, patch) {
  const COLUMN = {
    '상태': 'status',
    '이벤트명': 'event_title',
    '수정 인스타그램': 'edit_insta',
    '수정 수령인': 'edit_name',
    '수정 연락처': 'edit_phone',
    '수정 주소': 'edit_addr',
    '수정 행사 날짜': 'edit_event_date',
    '수정 수량': 'edit_qty',
    '수정 맛 구성': 'edit_flavor',
    '내부 메모': 'memo',
    '보류': 'hold',
    '발주서 생성일': 'sheet_created_at',
    '완료일': 'done_at'
  };

  const KIND_LABEL = {
    sponsor: '협찬', amb: '엠베서더', event: '이벤트',
    resend: '오배송건 재발송', sample: '샘플', b2b: 'B2B', olive: '올리브영'
  };

  const row = {
    order_id: id,
    kind: KIND_LABEL[String(id).split('::')[0]] || null,
    updated_at: new Date().toISOString()
  };

  Object.keys(patch || {}).forEach(key => {
    const column = COLUMN[key];
    if (!column) return;

    let value = patch[key];

    if (column === 'hold') {
      row.hold = value === true || value === 'TRUE' || value === 'true';
      return;
    }

    /* 원본 어드민과 동일하게, 보낸 값이 비어 있으면 해당 칸을 비웁니다. */
    if (value === '' || value == null) {
      row[column] = null;
      return;
    }

    if (column === 'edit_qty') value = Number(value);

    row[column] = value;
  });

  const { error } = await supabaseClient
    .from('order_overrides')
    .upsert(row, { onConflict: 'order_id' });

  if (error) throw new Error(error.message);

  return { success: true };
}

async function gasHold(id, hold) {
  if (IS_SAMPLE_MODE) {
    const order = sampleFindOrder(id);

    if (!order) {
      return Promise.reject(new Error('주문을 찾지 못했습니다.'));
    }

    order.hold = !!hold;
    order.status = hold
      ? '보류'
      : (order.kind === 'sponsor' ? '발주 대기' : '출고 대기');

    return sampleDelay({ success: true }, 120);
  }

  return upsertOverride(id, {
    '보류': hold ? 'TRUE' : 'FALSE',
    '상태': hold ? '보류' : ''
  });
}

async function gasCancel(ids) {
  if (IS_SAMPLE_MODE) {
    (ids || []).forEach(id => {
      const order = sampleFindOrder(id);
      if (!order) return;

      order.doneAt = '';
      order.sheetAt = '';
      order.status = order.kind === 'sponsor' ? '발주 대기' : '출고 대기';
    });

    return sampleDelay({ success: true }, 120);
  }

  for (const id of (ids || [])) {
    await upsertOverride(id, {
      '상태': '',
      '완료일': '',
      '발주서 생성일': ''
    });
  }

  return { success: true };
}

async function gasComplete(ids) {
  if (IS_SAMPLE_MODE) {
    const stamp = sampleNowStamp();

    (ids || []).forEach(id => {
      const order = sampleFindOrder(id);
      if (!order) return;

      order.doneAt = stamp;
      order.sheetAt = stamp;
      order.status = order.kind === 'sponsor' ? '발주 완료' : '출고 완료';
    });

    return sampleDelay({ success: true }, 120);
  }

  const stamp = new Date().toISOString();

  for (const id of (ids || [])) {
    const kind = String(id).split('::')[0];

    await upsertOverride(id, {
      '상태': kind === 'sponsor' ? '발주 완료' : '출고 완료',
      '발주서 생성일': stamp,
      '완료일': stamp
    });
  }

  return { success: true };
}

/* =========================
   4. 수동 발주 등록
   ========================= */

function gasCreateManualOrder(payload) {
  if (IS_SAMPLE_MODE) {
    return Promise.reject(
      new Error(
        '샘플 모드에서는 수동 발주 등록이 저장되지 않습니다. ' +
        'Supabase 연결 후 사용할 수 있습니다.'
      )
    );
  }
  return notConnected('수동 발주 등록');
}

/* =========================
   5. 이지어드민 수동발주서
   ========================= */

async function gasPreview(ids) {
  if (IS_SAMPLE_MODE) {
    const selected = (ids || [])
      .map(id => sampleFindOrder(id))
      .filter(Boolean);

    const rows = [];
    selected.forEach(order => {
      buildEasyAdminRows(order).forEach(row => rows.push(row));
    });

    return sampleDelay(rows, 200);
  }

  const data = await fetchAdminData();

  const all = [
    ...data.sponsor, ...data.ambassador, ...data.event,
    ...data.sample, ...data.b2b
  ];

  const rows = [];

  (ids || []).forEach(id => {
    const order = all.find(o => o.id === id);
    if (!order) return;
    buildEasyAdminRows(order).forEach(row => rows.push(row));
  });

  return rows;
}

/* =========================
   6. 입고 / 출고 요청서 파일 저장 (Google Drive)
   ========================= */

function gasSaveShipmentRequestFile(payload) {
  if (IS_SAMPLE_MODE) {
    return Promise.reject(
      new Error(
        '샘플 모드에서는 Google Drive 저장을 하지 않습니다. ' +
        '파일 내용 확인은 미리보기 화면에서 가능합니다.'
      )
    );
  }
  return notConnected('출고 요청서 저장');
}

function gasSaveInboundRequestFile(payload) {
  if (IS_SAMPLE_MODE) {
    return Promise.reject(
      new Error(
        '샘플 모드에서는 Google Drive 저장을 하지 않습니다. ' +
        '파일 내용 확인은 미리보기 화면에서 가능합니다.'
      )
    );
  }
  return notConnected('입고 요청서 저장');
}

/* =========================
   7. SCM 메일 발송
   ========================= */

function gasSaveAndSendRequestEmail(payload) {
  if (IS_SAMPLE_MODE) {
    return Promise.reject(
      new Error(
        '샘플 모드에서는 메일을 발송하지 않습니다. ' +
        '실제 발송은 Gmail API 연결 후 테스트합니다.'
      )
    );
  }
  return notConnected('메일 발송');
}

/* =========================
   8. 올리브영 발주 이력
   ========================= */

function gasSaveOliveUpload(payload) {
  if (IS_SAMPLE_MODE) {
    return Promise.reject(
      new Error(
        '샘플 모드에서는 올리브영 업로드 이력이 저장되지 않습니다. ' +
        'Supabase 연결 후 사용할 수 있습니다.'
      )
    );
  }
  return notConnected('올리브영 업로드 저장');
}

function gasGetOliveHistoryRows(id) {
  if (IS_SAMPLE_MODE) {
    return Promise.reject(
      new Error('샘플 모드에는 저장된 올리브영 발주 데이터가 없습니다.')
    );
  }
  return notConnected('올리브영 이력 조회');
}

function gasMarkOliveDownloaded(id, fileName) {
  if (IS_SAMPLE_MODE) {
    return sampleDelay({ success: true }, 80);
  }
  return notConnected('올리브영 다운로드 기록');
}
