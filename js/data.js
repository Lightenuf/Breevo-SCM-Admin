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

/* 전화번호에 하이픈을 넣습니다 (기존 formatPhone_ 와 동일) */
function formatPhone(value) {
  const digits = String(value || '').replace(/\D/g, '');

  if (digits.length === 11) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  }

  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  return String(value || '').trim();
}

/* B2B 제품 표기 (기존 b2bProductLabel_ 와 동일) */
function b2bProductLabel(qty, flavor) {
  const n = Number(qty) || 0;

  if (n === 48 && flavor === 'mix') return '사과 24캔 + 복숭아 24캔';
  if ((n === 24 || n === 48) && flavor === 'apple') return `사과 ${n}캔`;
  if ((n === 24 || n === 48) && flavor === 'peach') return `복숭아 ${n}캔`;

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
  if (ov.edit_phone)      out.phone = formatPhone(ov.edit_phone);
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
    /* 거래처를 구분하는 이름. 화면에서 펼치기/접기의 기준이 됩니다. */
    const key = String(order.company || '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();

    if (!key) return;

    if (!map[key]) {
      map[key] = {
        key,
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
   출고 거래처 목록
   담당자 연락처가 포함되어 코드가 아닌 Supabase에 보관합니다.
   로그인 직후 한 번 불러와 SHIPMENT_REQUEST_RECIPIENTS 를 채웁니다.
   ========================= */

async function loadShipmentRecipients() {
  if (IS_SAMPLE_MODE) return;

  const { data, error } = await supabaseClient
    .from('shipment_recipients')
    .select('*')
    .eq('active', true)
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('거래처 목록을 불러오지 못했습니다:', error.message);
    return;
  }

  SHIPMENT_REQUEST_RECIPIENTS = (data || []).map(r => ({
    key: r.key,
    company: r.company || r.label || '',
    address: r.addr || '',
    phone: r.phone || '',
    transportOther: r.transport_other || ''
  }));
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
      insta: r.insta || '', name: r.name || '', phone: formatPhone(r.phone),
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
        insta: r.insta || '', name: r.name || '', phone: formatPhone(r.phone),
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
      insta: '', name: r.name || '', phone: formatPhone(r.phone), addr: r.addr || '',
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
      insta: '', name: r.name || '', phone: formatPhone(r.phone), addr: r.addr || '',
      qty: r.qty, flavor: r.flavor,
      company: r.company || '', branch: r.company ? '수동 등록' : '',
      itemCount: r.item_count || 1,
      b2bProduct: b2bProductLabel(r.qty, r.flavor),
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
      /* 기존 어드민과 동일: 수동 등록 협찬은 행사일이 없으므로 발주 예정일을 오늘로 둡니다. */
      o.eventDate = o.eventDate || '';
      o.dueDate = o.eventDate ? addDaysIsoLocal(o.eventDate, -leadDays) : today;
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

    const editable = [
      'status', 'eventTitle', 'insta', 'name', 'phone',
      'addr', 'eventDate', 'qty', 'flavor', 'memo'
    ];

    Object.keys(patch || {}).forEach(key => {
      const field = editable.includes(key) ? key : null;
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
  if (!id) throw new Error('관리ID가 없습니다.');

  /* 화면이 보내는 이름(영문) → 표의 칸 이름.
     기존 updateOrder 가 받던 이름을 그대로 따릅니다. */
  const COLUMN = {
    status: 'status',
    eventTitle: 'event_title',
    insta: 'edit_insta',
    name: 'edit_name',
    phone: 'edit_phone',
    addr: 'edit_addr',
    eventDate: 'edit_event_date',
    qty: 'edit_qty',
    flavor: 'edit_flavor',
    memo: 'memo',
    hold: 'hold',
    sheetCreatedAt: 'sheet_created_at',
    doneAt: 'done_at'
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

    /* 맛 구성은 기존 어드민과 동일하게 한글 표기로 저장합니다. */
    if (column === 'edit_flavor') value = flavorLabelOf(value) || value;

    row[column] = value;
  });

  const { error } = await supabaseClient
    .from('order_overrides')
    .upsert(row, { onConflict: 'order_id' });

  if (error) throw new Error(error.message);

  /* 기존 어드민처럼 갱신된 전체 데이터를 함께 돌려줍니다.
     화면이 다시 조회하지 않아도 되므로 저장이 한 박자 빨라집니다. */
  return { success: true, data: await fetchAdminData() };
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

    return sampleDelay(sampleData(), 120);
  }

  await upsertOverride(id, {
    hold: !!hold,
    status: hold ? '보류' : ''
  });

  /* 원본 setOrderHold 는 getAdminData() 를 그대로 돌려줍니다.
     화면이 setAdminData(await gasHold(...)) 로 바로 받기 때문에
     { success, data } 로 감싸면 안 됩니다. */
  return fetchAdminData();
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

    return sampleDelay(sampleData(), 120);
  }

  for (const id of (ids || [])) {
    await upsertOverride(id, {
      status: '',
      doneAt: '',
      sheetCreatedAt: ''
    });
  }

  /* 원본 cancelOrderDone 과 동일하게 데이터 객체를 그대로 돌려줍니다. */
  return fetchAdminData();
}

async function gasComplete(ids) {
  if (IS_SAMPLE_MODE) {
    const stamp = sampleNowStamp();

    (ids || []).forEach(id => {
      const order = sampleFindOrder(id);
      if (!order) return;

      order.doneAt = stamp;
      order.sheetAt = stamp;
      order.hold = false;
      order.status = order.kind === 'sponsor' ? '발주 완료' : '출고 완료';
    });

    return sampleDelay({ success: true }, 120);
  }

  const stamp = new Date().toISOString();

  for (const id of (ids || [])) {
    const kind = String(id).split('::')[0];

    await upsertOverride(id, {
      status: kind === 'sponsor' ? '발주 완료' : '출고 완료',
      sheetCreatedAt: stamp,
      doneAt: stamp,
      /* 원본과 동일하게 완료 시 보류를 함께 내립니다.
         상태 계산에서 보류가 완료보다 우선이라, 빠뜨리면 완료된 건이 계속 보류로 보입니다. */
      hold: false
    });
  }

  return { success: true, data: await fetchAdminData() };
}

/* =========================
   4. 수동 발주 등록
   ========================= */

async function gasCreateManualOrder(payload) {
  if (IS_SAMPLE_MODE) {
    return Promise.reject(
      new Error(
        '샘플 모드에서는 수동 발주 등록이 저장되지 않습니다. ' +
        'Supabase 연결 후 사용할 수 있습니다.'
      )
    );
  }

  const kind = String(payload?.kind || '').trim();
  const name = String(payload?.name || '').trim();
  const phone = String(payload?.phone || '').trim();
  const addr = String(payload?.addr || '').trim();
  const company = String(payload?.company || '').trim();

  /* 기존 서버(createManualOrder)의 검사 규칙을 그대로 옮겼습니다. */
  if (!kind) {
    throw new Error('협찬 / 엠베서더 / 이벤트 / 오배송건 재발송 / 샘플 / B2B 중 등록 채널을 선택해주세요.');
  }
  if (kind === 'b2b' && !company) {
    throw new Error('B2B 거래처명을 입력해주세요.');
  }
  if (!name) throw new Error('이름을 입력해주세요.');
  if (!phone) throw new Error('핸드폰 번호를 입력해주세요.');
  if (!addr) throw new Error('주소를 입력해주세요.');

  const items = kind === 'sample'
    ? [{ qty: 12, flavor: 'mix', count: 1 }]
    : (Array.isArray(payload.items) ? payload.items : []).map(item => ({
        qty: Number(item?.qty),
        flavor: item?.flavor,
        count: Math.max(1, Number(item?.count || 1))
      }));

  if (!items.length) {
    throw new Error('발주 구성을 하나 이상 추가해주세요.');
  }

  const allowedQty = [6, 12, 24, 36, 48, 96];

  items.forEach(item => {
    if (!allowedQty.includes(item.qty)) {
      throw new Error('수량은 6 / 12 / 24 / 36 / 48 / 96 중에서 선택해주세요.');
    }
    if (!item.flavor) {
      throw new Error('맛 구성을 선택해주세요.');
    }
    if (item.qty === 6 && item.flavor === 'mix') {
      throw new Error('6캔은 사과+복숭아 혼합을 선택할 수 없습니다.');
    }
    if (kind === 'b2b') {
      const validB2B =
        (item.qty === 24 && ['apple', 'peach'].includes(item.flavor)) ||
        (item.qty === 48 && ['apple', 'peach', 'mix'].includes(item.flavor));

      if (!validB2B) {
        throw new Error('B2B 제품은 사과 24캔 / 복숭아 24캔 / 사과 48캔 / 복숭아 48캔 / 사과 24캔 + 복숭아 24캔 중에서 선택해주세요.');
      }
    }
  });

  const at = new Date().toISOString();

  const rows = items.map(item => ({
    kind,
    registered_at: at,
    name,
    phone,
    addr,
    qty: item.qty,
    flavor: item.flavor,
    company: kind === 'b2b' ? company : null,
    item_count: item.count
  }));

  const { error } = await supabaseClient
    .from('manual_orders')
    .insert(rows);

  if (error) throw new Error(error.message);

  return { success: true, count: rows.length, data: await fetchAdminData() };
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
   6~7. 요청서 Drive 저장 · SCM 메일 발송
   브라우저에 인증 정보를 두지 않기 위해 Supabase 서버 기능을 거칩니다.
   ========================= */

async function callScmFunction(payload) {
  const { data: session } = await supabaseClient.auth.getSession();
  const token = session?.session?.access_token;

  if (!token) {
    throw new Error('로그인이 필요합니다. 새로고침 후 다시 로그인해주세요.');
  }

  const res = await fetch(
    `${BREEVO_CONFIG.SUPABASE_URL}/functions/v1/send-scm-mail`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'apikey': BREEVO_CONFIG.SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    }
  );

  let result;

  try {
    result = await res.json();
  } catch {
    throw new Error('서버 응답을 읽지 못했습니다. 잠시 후 다시 시도해주세요.');
  }

  if (!res.ok || !result?.success) {
    throw new Error(result?.message || '요청을 처리하지 못했습니다.');
  }

  return result;
}

async function gasSaveShipmentRequestFile(payload) {
  if (IS_SAMPLE_MODE) {
    return Promise.reject(
      new Error(
        '샘플 모드에서는 Google Drive 저장을 하지 않습니다. ' +
        '파일 내용 확인은 미리보기 화면에서 가능합니다.'
      )
    );
  }

  return callScmFunction({
    mode: 'save',
    requestType: 'outbound',
    base64: payload?.base64,
    fileName: payload?.fileName || shipmentRequestFileNameOf('outbound'),
  });
}

async function gasSaveInboundRequestFile(payload) {
  if (IS_SAMPLE_MODE) {
    return Promise.reject(
      new Error(
        '샘플 모드에서는 Google Drive 저장을 하지 않습니다. ' +
        '파일 내용 확인은 미리보기 화면에서 가능합니다.'
      )
    );
  }

  return callScmFunction({
    mode: 'save',
    requestType: 'inbound',
    base64: payload?.base64,
    fileName: payload?.fileName || shipmentRequestFileNameOf('inbound'),
  });
}

/* 파일명은 화면이 쓰는 규칙(requestPreviewFileName)을 그대로 따릅니다. */
function shipmentRequestFileNameOf(type) {
  if (typeof requestPreviewFileName === 'function') {
    return requestPreviewFileName();
  }

  const t = todayIsoKst().replace(/-/g, '').slice(2);
  const label = type === 'inbound' ? '입고요청서' : '출고요청서';
  return `라이트이너프_${label}_${t}.xlsx`;
}

async function gasSaveAndSendRequestEmail(payload) {
  if (IS_SAMPLE_MODE) {
    return Promise.reject(
      new Error(
        '샘플 모드에서는 메일을 발송하지 않습니다. ' +
        '실제 발송은 Gmail API 연결 후 테스트합니다.'
      )
    );
  }

  const type = payload?.requestType === 'inbound' ? 'inbound' : 'outbound';

  return callScmFunction({
    mode: 'send',
    requestType: type,
    base64: payload?.base64,
    fileName: payload?.fileName || shipmentRequestFileNameOf(type),
    subject: payload?.subject,
    body: payload?.body,
    cc: payload?.cc,
  });
}

/* =========================
   8. 올리브영 발주 이력
   ========================= */

/* 나인로지스 배송 양식 14개 칸 ↔ 표의 칸 이름 */
const OLIVE_FIELD = {
  '보내는분성명': 'sender_name',
  '보내는분전화번호': 'sender_phone',
  '보내는분주소(전체, 분할)': 'sender_addr',
  '받는분성명': 'receiver_name',
  '주문자성명': 'orderer_name',
  '받는분전화번호': 'receiver_phone',
  '받는분기타연락처': 'receiver_phone2',
  '받는분우편번호': 'receiver_zip',
  '받는분주소(전체, 분할)': 'receiver_addr',
  '품목명': 'item_name',
  '배송메세지1': 'delivery_msg',
  '내품수량': 'item_qty',
  '박스수량': 'box_qty',
  '운송장번호': 'tracking_no'
};

async function gasSaveOliveUpload(payload) {
  if (IS_SAMPLE_MODE) {
    return Promise.reject(
      new Error(
        '샘플 모드에서는 올리브영 업로드 이력이 저장되지 않습니다. ' +
        'Supabase 연결 후 사용할 수 있습니다.'
      )
    );
  }

  const fingerprint = String(payload?.fingerprint || '');
  const rows = Array.isArray(payload?.rows) ? payload.rows : [];

  /* 같은 파일을 다시 올린 경우 기존 이력을 돌려줍니다 (중복 저장 방지) */
  if (fingerprint) {
    const { data: found } = await supabaseClient
      .from('olive_uploads')
      .select('*')
      .eq('fingerprint', fingerprint)
      .maybeSingle();

    if (found) {
      return { success: true, duplicate: true, history: { id: `olive::${found.id}` } };
    }
  }

  let appleQty = 0, peachQty = 0, otherQty = 0;

  rows.forEach(r => {
    const item = String(r['품목명'] || '');
    const qty = Number(r['내품수량']) || 0;

    if (item.includes('사과')) appleQty += qty;
    else if (item.includes('복숭아')) peachQty += qty;
    else otherQty += qty;
  });

  const { data: upload, error: uploadError } = await supabaseClient
    .from('olive_uploads')
    .insert({
      file_name: payload?.fileName || '',
      fingerprint: fingerprint || null,
      order_count: Number(payload?.orderCount) || 0,
      row_count: rows.length,
      apple_qty: appleQty,
      peach_qty: peachQty,
      other_qty: otherQty,
      status: '미다운로드'
    })
    .select()
    .single();

  if (uploadError) throw new Error(uploadError.message);

  const detailRows = rows.map((r, index) => {
    const out = { upload_id: upload.id, row_no: index + 1 };

    Object.keys(OLIVE_FIELD).forEach(label => {
      const column = OLIVE_FIELD[label];
      const value = r[label];

      out[column] = (column === 'item_qty' || column === 'box_qty')
        ? (value === '' || value == null ? null : Number(value))
        : (value == null ? '' : String(value));
    });

    return out;
  });

  if (detailRows.length) {
    const { error: rowError } = await supabaseClient
      .from('olive_rows')
      .insert(detailRows);

    if (rowError) throw new Error(rowError.message);
  }

  return { success: true, duplicate: false, history: { id: `olive::${upload.id}` } };
}

async function gasGetOliveHistoryRows(id) {
  if (IS_SAMPLE_MODE) {
    return Promise.reject(
      new Error('샘플 모드에는 저장된 올리브영 발주 데이터가 없습니다.')
    );
  }

  const uploadId = String(id || '').replace(/^olive::/, '');

  const { data, error } = await supabaseClient
    .from('olive_rows')
    .select('*')
    .eq('upload_id', uploadId)
    .order('row_no', { ascending: true });

  if (error) throw new Error(error.message);

  /* 화면이 쓰던 형식(한글 칸 이름)으로 되돌려줍니다. */
  return (data || []).map(r => {
    const out = {};
    Object.keys(OLIVE_FIELD).forEach(label => {
      const value = r[OLIVE_FIELD[label]];
      out[label] = value == null ? '' : value;
    });
    return out;
  });
}

async function gasMarkOliveDownloaded(id, fileName) {
  if (IS_SAMPLE_MODE) {
    return sampleDelay({ success: true }, 80);
  }

  const uploadId = String(id || '').replace(/^olive::/, '');

  const { error } = await supabaseClient
    .from('olive_uploads')
    .update({
      status: '다운로드 완료',
      downloaded_at: new Date().toISOString(),
      download_file_name: fileName || ''
    })
    .eq('id', uploadId);

  if (error) throw new Error(error.message);

  return { success: true };
}

/* =========================
   9. 실시간 갱신

   자동 동기화(1분마다)가 새 신청을 넣으면,
   Supabase 가 열려 있는 화면에 바로 알려줍니다.
   새로고침하지 않아도 목록에 나타납니다.
   ========================= */

const REALTIME_TABLES = [
  'sponsor_orders',
  'ambassador_orders',
  'event_orders',
  'sample_orders',
  'b2b_orders',
  'manual_orders',
  'order_overrides',
  'olive_uploads'
];

let realtimeChannel = null;
let realtimeTimer = null;

function startRealtime() {
  if (IS_SAMPLE_MODE || realtimeChannel) return;

  const channel = supabaseClient.channel('breevo-admin');

  /* 동기화 한 번에 수십 줄이 한꺼번에 바뀝니다.
     그때마다 다시 그리면 화면이 깜빡이므로, 잠잠해지면 한 번만 갱신합니다. */
  const bump = () => {
    clearTimeout(realtimeTimer);
    realtimeTimer = setTimeout(() => {
      if (typeof refreshQuietly === 'function') refreshQuietly();
    }, 1500);
  };

  REALTIME_TABLES.forEach(table => {
    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table },
      bump
    );
  });

  channel.subscribe();
  realtimeChannel = channel;
}
