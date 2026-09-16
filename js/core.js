const state = {
  data: null,
  page: 'today',
  sub: 'list',
  query: '',
  statusF: '전체',
  filterOpen: false,
  selected: new Set(),
  drawer: null,
  editing: false,
  notice: '',
  calYear: null,
  calMonth: null,
  calSelectedDate: null,
  oliveFile: '',
  oliveRows: [],
  oliveSummary: null,
  oliveHistoryId: '',
  oliveBusy: false,
  oliveError: '',
  leadDays: 4,
  alertOpen: false,
  composeMenuOpen: false,
  manualOpen: false,
  manualItems: [],
  shipmentTypeChoiceOpen: false,
  inboundTypeChoiceOpen: false,
  shipmentRequestType: 'outbound',
  shipmentRequestOpen: false,
  shipmentDraft: null,
  requestPreviewOpen: false,
  requestPreviewTab: 'request',
  requestEmailOpen: false,
  shipmentCalendarField: null,
  shipmentCalendarYear: null,
  shipmentCalendarMonth: null,
  b2bExpanded: new Set()
};

const TITLES = {
  today: [
    '오늘 발주',
    ''
  ],
  sponsor: [
    '협찬',
    ''
  ],
  olive: [
    '올리브영',
    ''
  ],
  amb: [
    '엠베서더',
    ''
  ],
  event: [
    '이벤트',
    ''
  ],
  sample: [
    '샘플',
    ''
  ],
  b2b: [
    'B2B',
    ''
  ],
  calendar: [
    '발주 달력',
    ''
  ],
  settings: [
    '설정',
    ''
  ]
};

function esc(v) {
  return String(v ?? '').replace(
    /[&<>"']/g,
    m => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[m]
  );
}

function fmtDate(v) {
  if (!v) return '—';
  const p = String(v).slice(0,10).split('-');
  return p.length === 3
    ? `${p[0]}.${p[1]}.${p[2]}`
    : esc(v);
}

function fmtDateTime(v) {
  if (!v) return '—';

  const text =
    String(v).trim();

  const numbers =
    text.match(/\d+/g);

  if (
    !numbers ||
    numbers.length < 3
  ) {
    return esc(text);
  }

  const year = Number(numbers[0]);
  const month = Number(numbers[1]);
  const day = Number(numbers[2]);

  if (numbers.length < 4) {
    return (
      String(year).padStart(4,'0') + '.' +
      String(month).padStart(2,'0') + '.' +
      String(day).padStart(2,'0')
    );
  }

  let hour = Number(numbers[3]);
  const minute = Number(numbers[4] || 0);
  const second = Number(numbers[5] || 0);

  if (
    text.includes('오후') &&
    hour < 12
  ) {
    hour += 12;
  }

  if (
    text.includes('오전') &&
    hour === 12
  ) {
    hour = 0;
  }

  return (
    String(year).padStart(4,'0') + '.' +
    String(month).padStart(2,'0') + '.' +
    String(day).padStart(2,'0') + ' ' +
    String(hour).padStart(2,'0') + ':' +
    String(minute).padStart(2,'0') + ':' +
    String(second).padStart(2,'0')
  );
}

function fmtTime(v) {
  if (!v) return '—';

  const numbers =
    String(v).trim().match(/\d+/g);

  if (!numbers || numbers.length < 4) {
    return '—';
  }

  const hour = Number(numbers[3]);
  const minute = Number(numbers[4] || 0);
  const second = Number(numbers[5] || 0);

  return (
    String(hour).padStart(2,'0') + ':' +
    String(minute).padStart(2,'0') + ':' +
    String(second).padStart(2,'0')
  );
}


function shortDate(v) {
  if (!v) return '—';
  const p = String(v).slice(0,10).split('-');
  return p.length === 3
    ? `${p[1]}.${p[2]}`
    : esc(v);
}

function dateTimeIso(v) {
  if (!v) return '';

  const m = String(v)
    .trim()
    .match(/^(\d{4})[.\/-](\d{1,2})[.\/-](\d{1,2})/);

  if (!m) return '';

  return `${m[1]}-${String(m[2]).padStart(2,'0')}-${String(m[3]).padStart(2,'0')}`;
}

function addDaysIso(iso, delta) {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return '';

  d.setDate(d.getDate() + delta);

  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2,'0'),
    String(d.getDate()).padStart(2,'0')
  ].join('-');
}

function statusClass(s) {
  return {
    '발주 대기': 'status-wait',
    '오늘 발주': 'status-today',
    '발주 지연': 'status-over',
    '발주 완료': 'status-done',
    '출고 대기': 'status-today',
    '출고 완료': 'status-done',
    '보류': 'status-hold',
    '정보 확인 필요': 'status-missing'
  }[s] || 'status-wait';
}

function badge(s) {
  return `
    <span class="badge-status ${statusClass(s)}">
      ${esc(s)}
    </span>
  `;
}

function kindBadge(k) {
  const c =
    k === '협찬'
      ? 'kind-sponsor'
      : k === '오배송건 재발송'
        ? 'kind-resend'
        : k === '올리브영'
        ? 'kind-olive'
        : k === '엠베서더'
          ? 'kind-amb'
          : k === '샘플'
            ? 'kind-sample'
            : k === 'B2B'
              ? 'kind-b2b'
              : 'kind-event';

  return `
    <span class="kind-badge ${c}">
      ${esc(k)}
    </span>
  `;
}

function flavorText(o) {
  return o.flavor === 'mix'
    ? `사과 ${o.appleQty} · 복숭아 ${o.peachQty}`
    : (o.flavorLabel || '—');
}

function monthKey(iso) {
  return String(iso || '').slice(0,7);
}

function todayIso() {
  return state.data?.today || '';
}

function nowMonth() {
  return monthKey(todayIso());
}

/* =========================
   알림 데이터
   ========================= */

function getAlertData() {
  const sponsors =
    state.data?.sponsor || [];

  const b2b =
    state.data?.b2b || [];

  const sponsorTodayCount =
    sponsors.filter(
      o => o.status === '오늘 발주'
    ).length;

  const b2bTodayCount =
    b2b.filter(
      o => o.status === '오늘 발주'
    ).length;

  const todayCount =
    sponsorTodayCount +
    b2bTodayCount;

  const waitingCount =
    sponsors.filter(
      o => o.status === '발주 대기'
    ).length;

  const base =
    new Date(todayIso() + 'T00:00:00');

  const weekStart =
    new Date(base);

  weekStart.setDate(
    base.getDate() - base.getDay()
  );

  const weekEnd =
    new Date(weekStart);

  weekEnd.setDate(
    weekStart.getDate() + 6
  );

  const toIso = d =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

  const startIso =
    toIso(weekStart);

  const endIso =
    toIso(weekEnd);

  const weekCount =
    sponsors.filter(
      o =>
        o.eventDate &&
        o.eventDate >= startIso &&
        o.eventDate <= endIso
    ).length;

  const range =
    `${String(weekStart.getMonth() + 1).padStart(2,'0')}.${String(weekStart.getDate()).padStart(2,'0')} – ${String(weekEnd.getMonth() + 1).padStart(2,'0')}.${String(weekEnd.getDate()).padStart(2,'0')}`;

  return {
    todayCount,
    sponsorTodayCount,
    b2bTodayCount,
    waitingCount,
    weekCount,
    range
  };
}

function renderAlertPopup() {
  if (!state.alertOpen) {
    return '';
  }

  const a = getAlertData();

  return `
    <div class="alert-popup">

      <div class="alert-popup-title">
        알림
      </div>

      <div class="alert-row">
        <div class="alert-dot ${a.todayCount ? '' : 'off'}"></div>
        <div>
          <div class="alert-row-title">
            오늘 발주 · 협찬 ${a.sponsorTodayCount}건 · B2B ${a.b2bTodayCount}건
          </div>
          <div class="alert-row-desc">
            발주 목록에서 선택 후 발주서를 생성하세요.
          </div>
        </div>
      </div>

      <div class="alert-row">
        <div class="alert-dot ${a.waitingCount ? '' : 'off'}"></div>
        <div>
          <div class="alert-row-title">
            발주 대기 ${a.waitingCount}건
          </div>
          <div class="alert-row-desc">
            발주 예정일 순으로 정렬되어 있습니다.
          </div>
        </div>
      </div>

      <div class="alert-row">
        <div class="alert-dot ${a.weekCount ? '' : 'off'}"></div>
        <div>
          <div class="alert-row-title">
            이번 주 행사 ${a.weekCount}건
          </div>
          <div class="alert-row-desc">
            ${a.range} 사이 행사가 예정된 건입니다.
          </div>
        </div>
      </div>

    </div>
  `;
}


/* =========================
   작성 메뉴 / 입고·출고 요청서 작성
   ========================= */

function createShipmentDraft() {
  const today =
    state.data?.today ||
    new Date().toISOString().slice(0,10);

  return {
    shipDate: today,
    arrivalDate: today,
    recipientKey: '',
    company: '',
    address: '',
    phone: '',
    transport: '',
    transportOther: '',
    pallet: 0,
    products:
      SHIPMENT_REQUEST_PRODUCTS.map(
        name => ({
          name,
          option: 24,
          cartons: 0,
          workDoneDate: '',
          workContent: ''
        })
      ),
    requestNote: '',
    workInstruction: ''
  };
}

function ensureShipmentDraft() {
  if (!state.shipmentDraft) {
    state.shipmentDraft =
      createShipmentDraft();
  }

  return state.shipmentDraft;
}

function renderComposeMenu() {
  if (!state.composeMenuOpen) {
    return '';
  }

  return `
    <div class="manual-modal-bg">
      <button
        type="button"
        class="manual-backdrop"
        data-action="close-compose-menu"
        aria-label="작성 메뉴 닫기"
      ></button>

      <div class="manual-modal compose-choice-modal">
        <div class="manual-modal-top">
          <div>
            <div class="manual-modal-title">
              작성하기
            </div>
            <div class="manual-modal-desc">
              작성할 문서를 선택해주세요.
            </div>
          </div>

          <button
            type="button"
            class="icon-btn"
            data-action="close-compose-menu"
            title="닫기"
          >×</button>
        </div>

        <div class="compose-choice-grid">
          <button
            type="button"
            class="compose-choice-card"
            data-action="open-manual-from-compose"
          >
            <div class="compose-choice-title">
              수동 발주 작성
            </div>
            <div class="compose-choice-desc">
              기존 수동 발주 작성 화면을 엽니다.
            </div>
          </button>

          <button
            type="button"
            class="compose-choice-card"
            data-action="open-shipment-type-choice"
          >
            <div class="compose-choice-title">
              입고·출고 요청서 작성
            </div>
            <div class="compose-choice-desc">
              입고 또는 출고 요청서를 작성하고 Drive 저장과 다운로드를 동시에 진행합니다.
            </div>
          </button>
        </div>
      </div>
    </div>
  `;
}

function renderShipmentTypeChoice() {
  if (!state.shipmentTypeChoiceOpen) return '';

  return `
    <div class="manual-modal-bg">
      <button type="button" class="manual-backdrop" data-action="close-shipment-type-choice" aria-label="입고·출고 선택 닫기"></button>
      <div class="manual-modal compose-choice-modal">
        <div class="manual-modal-top">
          <div>
            <div class="manual-modal-title">입고·출고 요청서 작성</div>
            <div class="manual-modal-desc">작성할 요청서 종류를 선택해주세요.</div>
          </div>
          <button type="button" class="icon-btn" data-action="close-shipment-type-choice" title="닫기">×</button>
        </div>
        <div class="compose-choice-grid">
          <button type="button" class="compose-choice-card" data-action="open-inbound-request">
            <div class="compose-choice-title">입고 요청서</div>
            <div class="compose-choice-desc">입고 일정과 예정 품목을 작성합니다.</div>
          </button>
          <button type="button" class="compose-choice-card" data-action="open-shipment-request">
            <div class="compose-choice-title">출고 요청서</div>
            <div class="compose-choice-desc">기존 출고 요청서 작성 화면을 엽니다.</div>
          </button>
        </div>
      </div>
    </div>
  `;
}

function renderInboundTypeChoice() {
  if (!state.inboundTypeChoiceOpen) return '';

  return `
    <div class="manual-modal-bg">
      <button type="button" class="manual-backdrop" data-action="close-inbound-type-choice" aria-label="입고 종류 선택 닫기"></button>
      <div class="manual-modal compose-choice-modal">
        <div class="manual-modal-top">
          <div>
            <div class="manual-modal-title">입고 요청서 작성</div>
            <div class="manual-modal-desc">입고할 품목 종류를 선택해주세요.</div>
          </div>
          <div class="manual-modal-top-actions">
            <button type="button" class="manual-back-btn" data-action="back-to-shipment-type-choice">← 뒤로</button>
            <button type="button" class="icon-btn" data-action="close-inbound-type-choice" title="닫기">×</button>
          </div>
        </div>
        <div class="compose-choice-grid">
          <button type="button" class="compose-choice-card" data-action="open-beverage-inbound-request">
            <div class="compose-choice-title">음료 입고</div>
            <div class="compose-choice-desc">브리보 음료의 수량과 팔레트를 작성합니다.</div>
          </button>
          <button type="button" class="compose-choice-card" data-action="open-material-inbound-request">
            <div class="compose-choice-title">부자재 입고</div>
            <div class="compose-choice-desc">박스, 완충제, 스티커 등 부자재를 작성합니다.</div>
          </button>
        </div>
      </div>
    </div>
  `;
}

function createInboundProduct() {
  return {
    productType: '',
    productName: '',
    optionName: '',
    manufactureDate: '',
    looseQty: '',
    cartons: '',
    pallets: '',
    barcode: '',
    workDoneDate: '',
    workContent: ''
  };
}

function createInboundDraft(inboundKind) {
  const today = state.data?.today || new Date().toISOString().slice(0,10);
  return {
    inboundDate: today,
    timePeriod: 'AM',
    timeHour: '10',
    timeMinute: '00',
    transport: '',
    transportOther: '',
    inboundKind: inboundKind === 'beverage' ? 'beverage' : 'material',
    products: [createInboundProduct()]
  };
}

function shipmentDateParts(value) {
  const text = String(value || '');
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) {
    const now = new Date();
    return {
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      day: now.getDate()
    };
  }

  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3])
  };
}

function shipmentDaysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

function shipmentMakeDate(year, month, day) {
  const y = Number(year);
  const m = Number(month);
  const maxDay = shipmentDaysInMonth(y, m);
  const d = Math.min(Math.max(Number(day), 1), maxDay);

  return (
    String(y).padStart(4,'0') + '-' +
    String(m).padStart(2,'0') + '-' +
    String(d).padStart(2,'0')
  );
}

function shipmentAdjustDatePart(field, part, delta) {
  const draft = ensureShipmentDraft();
  const current = shipmentDateParts(draft[field]);
  let year = current.year;
  let month = current.month;
  let day = current.day;

  if (part === 'year') {
    year += delta;
    year = Math.max(2000, Math.min(2100, year));
    day = Math.min(day, shipmentDaysInMonth(year, month));
  } else if (part === 'month') {
    month += delta;

    while (month < 1) {
      month += 12;
      year -= 1;
    }

    while (month > 12) {
      month -= 12;
      year += 1;
    }

    year = Math.max(2000, Math.min(2100, year));
    day = Math.min(day, shipmentDaysInMonth(year, month));
  } else if (part === 'day') {
    const d = new Date(year, month - 1, day, 12, 0, 0);
    d.setDate(d.getDate() + delta);
    year = d.getFullYear();
    month = d.getMonth() + 1;
    day = d.getDate();
  }

  draft[field] = shipmentMakeDate(year, month, day);
}

function shipmentDateDisplay(value) {
  const p = shipmentDateParts(value);
  return (
    String(p.year).padStart(4,'0') + '.' +
    String(p.month).padStart(2,'0') + '.' +
    String(p.day).padStart(2,'0')
  );
}

function shipmentCalendarMonthTitle(year, month) {
  return `${Number(year)}년 ${Number(month)}월`;
}

function shipmentCalendarBody(field, value) {
  const selected = shipmentDateParts(value);
  const isOpen = state.shipmentCalendarField === field;

  if (!isOpen) {
    return `
      <button
        type="button"
        class="shipment-date-button"
        data-shipment-calendar-toggle="${field}"
      >
        <span>${shipmentDateDisplay(value)}</span>
        <svg class="shipment-date-button-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="5" width="18" height="16" rx="2"></rect>
          <path d="M16 3v4M8 3v4M3 10h18"></path>
        </svg>
      </button>
    `;
  }

  const year = Number(state.shipmentCalendarYear || selected.year);
  const month = Number(state.shipmentCalendarMonth || selected.month);
  const firstWeekday = new Date(year, month - 1, 1, 12, 0, 0).getDay();
  const daysInMonth = shipmentDaysInMonth(year, month);

  const today = new Date();
  const todayKey = shipmentMakeDate(
    today.getFullYear(),
    today.getMonth() + 1,
    today.getDate()
  );

  let dayCells = '';

  for (let i = 0; i < firstWeekday; i++) {
    dayCells += '<div class="shipment-calendar-empty"></div>';
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dateValue = shipmentMakeDate(year, month, day);
    const classes = [
      'shipment-calendar-day',
      dateValue === value ? 'selected' : '',
      dateValue === todayKey ? 'today' : ''
    ].filter(Boolean).join(' ');

    dayCells += `
      <button
        type="button"
        class="${classes}"
        data-shipment-calendar-field="${field}"
        data-shipment-calendar-day="${day}"
      >${day}</button>
    `;
  }

  return `
    <button
      type="button"
      class="shipment-date-button"
      data-shipment-calendar-toggle="${field}"
    >
      <span>${shipmentDateDisplay(value)}</span>
      <svg class="shipment-date-button-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="5" width="18" height="16" rx="2"></rect>
        <path d="M16 3v4M8 3v4M3 10h18"></path>
      </svg>
    </button>

    <div class="shipment-calendar-panel">
      <div class="shipment-calendar-head">
        <button
          type="button"
          class="shipment-calendar-nav"
          data-shipment-calendar-nav="-1"
          data-shipment-calendar-field="${field}"
          aria-label="이전 달"
        >‹</button>

        <div class="shipment-calendar-title">
          ${shipmentCalendarMonthTitle(year, month)}
        </div>

        <button
          type="button"
          class="shipment-calendar-nav"
          data-shipment-calendar-nav="1"
          data-shipment-calendar-field="${field}"
          aria-label="다음 달"
        >›</button>
      </div>

      <div class="shipment-calendar-weekdays">
        ${['일','월','화','수','목','금','토']
          .map(day => `<div class="shipment-calendar-weekday">${day}</div>`)
          .join('')}
      </div>

      <div class="shipment-calendar-days">
        ${dayCells}
      </div>
    </div>
  `;
}

function renderShipmentDatePicker(field, value) {
  return `
    <div
      class="shipment-date-picker"
      data-shipment-date-control="${field}"
    >
      ${shipmentCalendarBody(field, value)}
    </div>
  `;
}

function shipmentRefreshDatePicker(field) {
  const d = ensureShipmentDraft();
  const el = document.querySelector(
    `[data-shipment-date-control="${field}"]`
  );

  if (el) {
    el.innerHTML = shipmentCalendarBody(field, d[field]);
  }
}

function shipmentToggleCalendar(field) {
  const d = ensureShipmentDraft();
  const previousField = state.shipmentCalendarField;

  if (previousField === field) {
    state.shipmentCalendarField = null;
    state.shipmentCalendarYear = null;
    state.shipmentCalendarMonth = null;
    shipmentRefreshDatePicker(field);
    return;
  }

  const p = shipmentDateParts(d[field]);
  state.shipmentCalendarField = field;
  state.shipmentCalendarYear = p.year;
  state.shipmentCalendarMonth = p.month;

  if (previousField) {
    shipmentRefreshDatePicker(previousField);
  }
  shipmentRefreshDatePicker(field);
}

function shipmentMoveCalendarMonth(field, delta) {
  if (state.shipmentCalendarField !== field) return;

  let year = Number(state.shipmentCalendarYear);
  let month = Number(state.shipmentCalendarMonth) + Number(delta || 0);

  while (month < 1) {
    month += 12;
    year -= 1;
  }
  while (month > 12) {
    month -= 12;
    year += 1;
  }

  state.shipmentCalendarYear = Math.max(2000, Math.min(2100, year));
  state.shipmentCalendarMonth = month;
  shipmentRefreshDatePicker(field);
}

function shipmentSelectCalendarDay(field, day) {
  const d = ensureShipmentDraft();
  const year = Number(state.shipmentCalendarYear);
  const month = Number(state.shipmentCalendarMonth);

  d[field] = shipmentMakeDate(year, month, Number(day));

  state.shipmentCalendarField = null;
  state.shipmentCalendarYear = null;
  state.shipmentCalendarMonth = null;

  shipmentRefreshDatePicker(field);
}

function applyShipmentRecipient(key) {
  const draft = ensureShipmentDraft();
  const found =
    SHIPMENT_REQUEST_RECIPIENTS.find(
      item => item.key === key
    );

  draft.recipientKey = key || '';

  if (!found) return;

  draft.company = found.company;
  draft.address = found.address;
  draft.phone = found.phone;

  if (found.transportOther) {
    draft.transport = 'other';
    draft.transportOther = found.transportOther;
  } else {
    draft.transport = '';
    draft.transportOther = '';
  }
}

function shipmentProductLoose(item) {
  return (
    Number(item?.option || 0) *
    Number(item?.cartons || 0)
  );
}

// 출고 요청서/작업지시서 엑셀에서는 일반 캔 상품명과 옵션명을 분리합니다.
// 일반 캔 상품명에는 맛 + 355ml까지만 표시하고, 개입수는 옵션명에만 표시합니다.
// 선물세트 2종은 기존 상품명을 그대로 유지합니다.
function shipmentExcelProductName(item) {
  const name = String(item?.name || '').trim();

  if (name.includes('[선물세트]')) {
    return name;
  }

  if (name.includes('사과')) {
    return '브리보 프리바이오틱 소다 사과 355ml';
  }

  if (name.includes('복숭아')) {
    return '브리보 프리바이오틱 소다 복숭아 355ml';
  }

  return name;
}

function shipmentActiveProducts() {
  const d = ensureShipmentDraft();

  return (d.products || [])
    .map((item,index) => ({ item,index }))
    .filter(({item}) => Number(item?.cartons || 0) > 0);
}

function renderShipmentWorkRows() {
  const active = shipmentActiveProducts();

  if (!active.length) {
    return `
      <div class="shipment-work-empty">
        출고품목의 카톤(박스) 수량을 1개 이상 선택하면, 선택한 상품별로 작업지시서 입력 행이 자동으로 나타납니다.
      </div>
    `;
  }

  return `
    <div class="shipment-work-list">
      ${active.map(({item,index},rowIndex) => `
        <div class="shipment-work-card">
          <div class="shipment-work-meta">
            <div class="shipment-work-meta-item">
              <div class="shipment-work-meta-label">No</div>
              <div class="shipment-work-meta-value">${rowIndex + 1}</div>
            </div>

            <div class="shipment-work-meta-item">
              <div class="shipment-work-meta-label">상품명</div>
              <div class="shipment-work-meta-value">${esc(shipmentExcelProductName(item))}</div>
            </div>

            <div class="shipment-work-meta-item">
              <div class="shipment-work-meta-label">옵션명</div>
              <div class="shipment-work-meta-value">${Number(item.option || 0)}개입</div>
            </div>

            <div class="shipment-work-meta-item">
              <div class="shipment-work-meta-label">수량(낱개)</div>
              <div class="shipment-work-meta-value">${shipmentProductLoose(item)}</div>
            </div>

            <div class="shipment-work-meta-item">
              <div class="shipment-work-meta-label">완료일 (선택)</div>
              <input
                class="shipment-work-date"
                type="text"
                inputmode="numeric"
                data-shipment-work-date="${index}"
                value="${esc(item.workDoneDate || '')}"
                placeholder="예: 260824"
              >
            </div>
          </div>

          <div class="manual-label">작업내용</div>
          <textarea
            class="shipment-textarea work"
            data-shipment-work-content="${index}"
            placeholder="이 상품 행에 들어갈 작업내용을 직접 작성해주세요."
          >${esc(item.workContent || '')}</textarea>
        </div>
      `).join('')}
    </div>
  `;
}

function shipmentRefreshDateControl(field) {
  const d = ensureShipmentDraft();
  const p = shipmentDateParts(d[field]);
  const values = {
    year: p.year,
    month: String(p.month).padStart(2,'0'),
    day: String(p.day).padStart(2,'0')
  };

  document
    .querySelectorAll(`[data-shipment-date-value-field="${field}"]`)
    .forEach(el => {
      const part = el.dataset.shipmentDateValuePart;
      if (part && values[part] !== undefined) {
        el.textContent = values[part];
      }
    });
}

function shipmentRefreshTransportControls() {
  const d = ensureShipmentDraft();

  document
    .querySelectorAll('[data-shipment-transport]')
    .forEach(btn => {
      btn.classList.toggle(
        'active',
        btn.dataset.shipmentTransport === d.transport
      );
    });

  const wrap =
    document.getElementById('shipmentTransportOtherWrap');

  if (wrap) {
    wrap.style.display =
      d.transport === 'other' ? 'block' : 'none';
  }

  const input =
    document.querySelector('[data-shipment-field="transportOther"]');

  if (input) {
    input.value = d.transportOther || '';
  }
}

function shipmentRefreshRecipientFields() {
  const d = ensureShipmentDraft();

  [
    ['company', d.company],
    ['address', d.address],
    ['phone', d.phone]
  ].forEach(([key,value]) => {
    const el =
      document.querySelector(`[data-shipment-field="${key}"]`);

    if (el) {
      el.value = value || '';
    }
  });

  shipmentRefreshTransportControls();
}

function shipmentRefreshPalletValue() {
  const d = ensureShipmentDraft();
  const el =
    document.querySelector('[data-shipment-pallet-value]');

  if (el) {
    el.textContent = Number(d.pallet || 0);
  }
}

function shipmentRefreshProductRow(index) {
  const d = ensureShipmentDraft();
  const item = d.products?.[index];

  if (!item) return;

  const count =
    document.querySelector(`[data-shipment-product-count="${index}"]`);
  const loose =
    document.querySelector(`[data-shipment-product-loose="${index}"]`);

  if (count) {
    count.textContent = Number(item.cartons || 0);
  }

  if (loose) {
    loose.textContent = `${shipmentProductLoose(item)}개`;
  }
}

function shipmentRefreshWorkSection() {
  const el =
    document.getElementById('shipmentWorkRows');

  if (el) {
    el.innerHTML = renderShipmentWorkRows();
  }
}

function inboundActiveProducts() {
  const d = ensureShipmentDraft();
  return (d.products || [])
    .map((item,sourceIndex) => ({ item,sourceIndex }))
    .filter(({item}) => String(item.productName || '').trim());
}

function renderInboundWorkRows() {
  const d = ensureShipmentDraft();
  const active = inboundActiveProducts();

  if (!active.length) {
    return `<div class="manual-modal-desc">입고 예정 품목을 선택하면 작업지시서 입력란이 표시됩니다.</div>`;
  }

  return `<div class="shipment-work-list">${active.map(({item,sourceIndex},index) => `
    <div class="shipment-work-card">
      <div class="shipment-work-meta inbound-work-meta">
        <div class="shipment-work-meta-item"><div class="shipment-work-meta-label">No</div><div class="shipment-work-meta-value">${index + 1}</div></div>
        <div class="shipment-work-meta-item"><div class="shipment-work-meta-label">상품명</div><div class="shipment-work-meta-value">${esc(item.productName)}</div></div>
        <div class="shipment-work-meta-item"><div class="shipment-work-meta-label">옵션명</div><div class="shipment-work-meta-value">${esc(item.optionName || '-')}</div></div>
        <div class="shipment-work-meta-item"><div class="shipment-work-meta-label">수량</div><div class="shipment-work-meta-value">${esc(d.inboundKind === 'beverage' ? item.cartons : item.looseQty) || '-'}</div></div>
      </div>
      <div class="shipment-work-fields">
        <div>
          <div class="manual-label">완료일</div>
          <input class="manual-field" type="text" data-inbound-work-date="${sourceIndex}" value="${esc(item.workDoneDate)}" placeholder="예: 2026-09-14">
        </div>
        <div>
          <div class="manual-label">작업내용</div>
          <input class="manual-field" type="text" data-inbound-work-content="${sourceIndex}" value="${esc(item.workContent)}" placeholder="작업내용을 입력해주세요.">
        </div>
      </div>
    </div>
  `).join('')}</div>`;
}

function inboundRefreshProducts() {
  const el = document.getElementById('inboundProductRows');
  const work = document.getElementById('inboundWorkRows');
  if (el) el.innerHTML = renderInboundProductRows();
  if (work) work.innerHTML = renderInboundWorkRows();
}

function renderInboundProductRows() {
  const d = ensureShipmentDraft();
  const beverage = d.inboundKind === 'beverage';
  const maxProducts = beverage ? 2 : 6;

  return `
    <div class="inbound-product-list">
    ${d.products.map((item,index) => `
    <div class="shipment-work-card inbound-product-card">
      ${d.products.length > 1 ? `
        <div class="shipment-work-card-top">
          <span></span>
          <button type="button" class="inbound-product-remove" data-action="remove-inbound-product" data-inbound-product-index="${index}">삭제</button>
        </div>
      ` : ''}
      <div class="manual-fields">
        ${beverage ? `
          <select class="manual-field" data-inbound-product-type="${index}">
            <option value="" ${!item.productType ? 'selected' : ''}>상품 선택</option>
            <option value="apple" ${item.productType === 'apple' ? 'selected' : ''}>브리보 프리바이오틱 소다 사과</option>
            <option value="peach" ${item.productType === 'peach' ? 'selected' : ''}>브리보 프리바이오틱 소다 복숭아</option>
            <option value="custom" ${item.productType === 'custom' ? 'selected' : ''}>직접 작성</option>
          </select>
        ` : `
          <input class="manual-field" type="text" data-inbound-product-field="productName" data-inbound-product-index="${index}" value="${esc(item.productName)}" placeholder="상품명 직접 작성">
        `}

        ${beverage && item.productType === 'custom' ? `
          <input class="manual-field" type="text" data-inbound-product-field="productName" data-inbound-product-index="${index}" value="${esc(item.productName)}" placeholder="상품명 직접 작성">
          <input class="manual-field" type="text" data-inbound-product-field="optionName" data-inbound-product-index="${index}" value="${esc(item.optionName)}" placeholder="옵션명 직접 작성">
        ` : beverage && item.productType ? `
          <input class="manual-field" type="text" value="24" readonly aria-label="옵션명">
        ` : !beverage ? `
          <input class="manual-field" type="text" data-inbound-product-field="optionName" data-inbound-product-index="${index}" value="${esc(item.optionName)}" placeholder="옵션명 직접 작성">
        ` : ''}

        <div class="shipment-two-col">
          <input class="manual-field" type="text" data-inbound-product-field="manufactureDate" data-inbound-product-index="${index}" value="${esc(item.manufactureDate)}" placeholder="제조일자">
          ${beverage ? `
            <input class="manual-field" type="number" min="0" data-inbound-product-field="cartons" data-inbound-product-index="${index}" value="${esc(item.cartons)}" placeholder="수량">
            <input class="manual-field" type="text" data-inbound-loose-preview="${index}" value="${item.cartons === '' ? '' : Number(item.cartons || 0) * 24}" placeholder="낱개 수량" readonly>
            <select class="manual-field" data-inbound-product-field="pallets" data-inbound-product-index="${index}">
              <option value="" ${item.pallets === '' ? 'selected' : ''}>팔레트 선택</option>
              <option value="combined" ${item.pallets === 'combined' ? 'selected' : ''}>합팔레트</option>
              ${Array.from({length:10},(_,i) => String(i + 1)).map(x => `<option value="${x}" ${String(item.pallets) === x ? 'selected' : ''}>${x}</option>`).join('')}
            </select>
          ` : `
            <input class="manual-field" type="number" min="0" data-inbound-product-field="looseQty" data-inbound-product-index="${index}" value="${esc(item.looseQty)}" placeholder="수량">
            <input class="manual-field" type="number" min="0" data-inbound-product-field="cartons" data-inbound-product-index="${index}" value="${esc(item.cartons)}" placeholder="카톤(박스)">
            <input class="manual-field" type="text" data-inbound-product-field="pallets" data-inbound-product-index="${index}" value="${esc(item.pallets)}" placeholder="팔레트">
          `}
        </div>
        <input class="manual-field" type="text" data-inbound-product-field="barcode" data-inbound-product-index="${index}" value="${esc(item.barcode)}" placeholder="바코드 번호">
      </div>
    </div>
    `).join('')}
    </div>
    ${d.products.length < maxProducts ? `<button type="button" class="inbound-product-add" data-action="add-inbound-product">+ 품목 추가</button>` : ''}
  `;
}

function renderInboundRequestModal() {
  const d = ensureShipmentDraft();
  const hours = Array.from({ length: 12 }, (_,i) => String(i + 1).padStart(2,'0'));
  const minutes = ['00','10','20','30','40','50'];

  return `
    <div class="manual-modal-bg">
      <button type="button" class="manual-backdrop" data-action="close-shipment-request" aria-label="입고 요청서 작성 닫기"></button>
        <div class="manual-modal shipment-modal">
        <div class="manual-modal-top">
          <div>
            <div class="manual-modal-title">${d.inboundKind === 'beverage' ? '음료 입고 요청서 작성' : '부자재 입고 요청서 작성'}</div>
            <div class="manual-modal-desc">작성한 내용을 미리 확인한 뒤 저장하거나 메일로 보낼 수 있습니다.</div>
          </div>
          <div class="manual-modal-top-actions">
            <button type="button" class="manual-back-btn" data-action="back-to-inbound-type-choice">← 뒤로</button>
            <button type="button" class="icon-btn" data-action="close-shipment-request" title="닫기">×</button>
          </div>
        </div>

        <div class="manual-section">
          <div class="manual-label">화주사명</div>
          <input class="manual-field" type="text" value="ex. 나인로지스" readonly>
        </div>

        <div class="manual-section">
          <div class="manual-label">입고일자/시간</div>
          <div class="shipment-two-col">
            ${renderShipmentDatePicker('inboundDate', d.inboundDate)}
            <div class="shipment-date-parts">
              <select class="manual-field" data-shipment-field="timePeriod">
                <option value="AM" ${d.timePeriod === 'AM' ? 'selected' : ''}>오전</option>
                <option value="PM" ${d.timePeriod === 'PM' ? 'selected' : ''}>오후</option>
              </select>
              <select class="manual-field" data-shipment-field="timeHour">
                ${hours.map(x => `<option value="${x}" ${d.timeHour === x ? 'selected' : ''}>${Number(x)}시</option>`).join('')}
              </select>
              <select class="manual-field" data-shipment-field="timeMinute">
                ${minutes.map(x => `<option value="${x}" ${d.timeMinute === x ? 'selected' : ''}>${x}분</option>`).join('')}
              </select>
            </div>
          </div>
        </div>

        <div class="manual-section">
          <div class="manual-label">운송수단</div>
          <div class="manual-options">
            ${[['parcel','택배'],['freight','화물'],['car','자차'],['other','기타']].map(([key,label]) => `
              <button type="button" class="manual-option ${d.transport === key ? 'active' : ''}" data-shipment-transport="${key}">${label}</button>
            `).join('')}
          </div>
          <div id="shipmentTransportOtherWrap" style="margin-top:9px;display:${d.transport === 'other' ? 'block' : 'none'}">
            <input class="manual-field" type="text" data-shipment-field="transportOther" value="${esc(d.transportOther)}" placeholder="기타 운송수단 입력">
          </div>
        </div>

        <div class="manual-section">
          <div class="manual-label">입고예정품목</div>
          <div id="inboundProductRows">${renderInboundProductRows()}</div>
        </div>

        <div class="manual-section">
          <div class="manual-label">작업 지시서</div>
          <div class="manual-modal-desc" style="margin-bottom:10px">선택한 품목의 상품명·옵션명·수량은 자동 반영되고 완료일과 작업내용은 직접 작성합니다.</div>
          <div id="inboundWorkRows">${renderInboundWorkRows()}</div>
        </div>

        <div class="manual-actions">
          <button type="button" class="btn" data-action="close-shipment-request">취소</button>
          <button type="button" class="btn dark" data-action="preview-inbound-request">미리보기</button>
        </div>
      </div>
    </div>
  `;
}

function renderShipmentRequestModal() {
  if (!state.shipmentRequestOpen) {
    return '';
  }

  if (state.shipmentRequestType === 'inbound') {
    return renderInboundRequestModal();
  }

  const d = ensureShipmentDraft();

  return `
    <div class="manual-modal-bg">
      <button
        type="button"
        class="manual-backdrop"
        data-action="close-shipment-request"
        aria-label="출고 요청서 작성 닫기"
      ></button>

      <div class="manual-modal shipment-modal">
        <div class="manual-modal-top">
          <div>
            <div class="manual-modal-title">
              출고 요청서 작성
            </div>
            <div class="manual-modal-desc">
              작성한 내용을 미리 확인한 뒤 저장하거나 메일로 보낼 수 있습니다.
            </div>
          </div>

          <div class="manual-modal-top-actions">
            <button type="button" class="manual-back-btn" data-action="back-to-shipment-type-choice">← 뒤로</button>
            <button
              type="button"
              class="icon-btn"
              data-action="close-shipment-request"
              title="닫기"
            >×</button>
          </div>
        </div>

        <div class="manual-section">
          <div class="shipment-two-col">
            <div>
              <div class="manual-label">출고일시</div>
              ${renderShipmentDatePicker('shipDate', d.shipDate)}
            </div>

            <div>
              <div class="manual-label">도착일시</div>
              ${renderShipmentDatePicker('arrivalDate', d.arrivalDate)}
            </div>
          </div>
        </div>

        <div class="manual-section">
          <div class="manual-label">운송수단</div>
          <div class="manual-options">
            ${[
              ['parcel','택배'],
              ['freight','화물'],
              ['car','자차'],
              ['other','기타']
            ].map(([key,label]) => `
              <button
                type="button"
                class="manual-option ${d.transport === key ? 'active' : ''}"
                data-shipment-transport="${key}"
              >${label}</button>
            `).join('')}
          </div>

          <div
            id="shipmentTransportOtherWrap"
            style="margin-top:9px;display:${d.transport === 'other' ? 'block' : 'none'}"
          >
            <input
              class="manual-field"
              type="text"
              data-shipment-field="transportOther"
              value="${esc(d.transportOther)}"
              placeholder="예: 밀크런 / 본사 배차 퀵 / 1T퀵"
            >
          </div>
        </div>

        <div class="manual-section">
          <div class="manual-label">수하인 정보</div>
          <div class="manual-fields">
            <select
              class="shipment-recipient-select"
              data-shipment-recipient
            >
              <option value="">업체 선택</option>
              ${SHIPMENT_REQUEST_RECIPIENTS.map(item => `
                <option
                  value="${esc(item.key)}"
                  ${d.recipientKey === item.key ? 'selected' : ''}
                >${esc(item.company)}</option>
              `).join('')}
            </select>

            <input
              class="manual-field"
              type="text"
              data-shipment-field="company"
              value="${esc(d.company)}"
              placeholder="업체명"
            >

            <textarea
              class="manual-field addr"
              data-shipment-field="address"
              placeholder="주소"
            >${esc(d.address)}</textarea>

            <input
              class="manual-field"
              type="text"
              data-shipment-field="phone"
              value="${esc(d.phone)}"
              placeholder="연락처"
            >

            <div class="shipment-pallet-row">
              <div>
                <div class="manual-label" style="margin:0">팔레트</div>
                <div class="manual-modal-desc">출고 요청서에는 숫자만 표시됩니다.</div>
              </div>
              <div class="shipment-number-stepper">
                <button type="button" data-shipment-pallet-delta="-1">−</button>
                <div class="shipment-number-value" data-shipment-pallet-value>${Number(d.pallet || 0)}</div>
                <button type="button" data-shipment-pallet-delta="1">+</button>
              </div>
            </div>
          </div>
        </div>

        <div class="manual-section">
          <div class="manual-label">출고품목</div>
          <div class="shipment-product-list">
            ${d.products.map((item,index) => `
              <div class="shipment-product-row">
                <div class="shipment-product-name">
                  ${esc(item.name)}
                </div>

                <select
                  class="shipment-option-select"
                  data-shipment-product-option="${index}"
                >
                  ${[12,24,48].map(option => `
                    <option
                      value="${option}"
                      ${Number(item.option) === option ? 'selected' : ''}
                    >${option}개입</option>
                  `).join('')}
                </select>

                <div class="shipment-number-stepper">
                  <button type="button" data-shipment-product-index="${index}" data-shipment-product-delta="-1">−</button>
                  <div class="shipment-number-value" data-shipment-product-count="${index}">${Number(item.cartons || 0)}</div>
                  <button type="button" data-shipment-product-index="${index}" data-shipment-product-delta="1">+</button>
                </div>

                <div class="shipment-loose-preview" data-shipment-product-loose="${index}">
                  ${shipmentProductLoose(item)}개
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <div class="manual-section">
          <div class="manual-label">기타요청사항</div>
          <textarea
            class="shipment-textarea"
            data-shipment-field="requestNote"
            placeholder="출고 요청서의 기타요청사항에 들어갈 내용을 직접 작성해주세요."
          >${esc(d.requestNote)}</textarea>
        </div>

        <div class="manual-section">
          <div class="manual-label">작업 지시사항</div>
          <div class="manual-modal-desc" style="margin-bottom:10px">
            출고품목에서 선택한 상품별로 작업지시서의 한 행씩 자동 연결됩니다. 상품명·옵션명·수량은 자동 반영되고, 완료일과 작업내용만 직접 작성하면 됩니다.
          </div>
          <div id="shipmentWorkRows">
            ${renderShipmentWorkRows()}
          </div>
        </div>

        <div class="manual-actions">
          <button
            type="button"
            class="btn"
            data-action="close-shipment-request"
          >취소</button>

          <button
            type="button"
            class="btn dark"
            data-action="preview-shipment-request"
          >미리보기</button>
        </div>
      </div>
    </div>
  `;
}

function requestTransportLabel(draft) {
  const labels = {
    parcel: '택배',
    freight: '화물',
    car: '자차',
    other: String(draft.transportOther || '').trim() || '기타'
  };
  return labels[draft.transport] || '-';
}

function requestPreviewFileName() {
  const inbound = state.shipmentRequestType === 'inbound';
  return `라이트이너프_${inbound ? '입고' : '출고'}요청서_${easyAdminDateStamp()}.xlsx`;
}

function renderRequestTransportCells(draft) {
  return [
    ['parcel','택배'],
    ['freight','화물'],
    ['car','자차'],
    ['other',draft.transport === 'other' ? `기타: ${esc(draft.transportOther || '')}` : '기타']
  ].map(([key,label]) => `
    <td class="${draft.transport === key ? 'selected-transport' : ''}">${label}</td>
  `).join('');
}

function renderInboundRequestPreview(draft) {
  const products = inboundActiveProducts().map(entry => entry.item);
  const beverage = draft.inboundKind === 'beverage';

  return `
    <div class="request-preview-title">입고 요청서</div>
    <table class="request-preview-table">
      <tbody>
        <tr><th colspan="7" class="section">기본 정보</th></tr>
        <tr><th colspan="2">화주사명</th><td colspan="5">ex. 나인로지스</td></tr>
        <tr><th colspan="2">입고일자/시간</th><td colspan="5">${esc(inboundDateTimeText(draft))}</td></tr>
        <tr><th colspan="2">운송수단</th>${renderRequestTransportCells(draft)}<td></td></tr>
${beverage ? `
  <tr>
    <th colspan="2">팔레트</th>
    <th>회사</th>
    <td colspan="2">한국팔레트</td>
    <th>팔레트</th>
    <td>${inboundPalletTotal(draft) || '-'}</td>
  </tr>
` : ''}
        <tr><th colspan="7" class="section">입고예정품목</th></tr>
        <tr>
          <th>상품명</th><th>옵션명</th><th>제조일자</th>
          <th>수량</th><th>카톤(박스)</th><th>팔레트</th><th>바코드 번호</th>
        </tr>
        ${products.map(item => `
          <tr>
            <td>${esc(item.productName || '-')}</td>
            <td>${esc(item.optionName || '-')}</td>
            <td>${esc(item.manufactureDate || '-')}</td>
            <td>${esc(beverage ? item.cartons : item.looseQty) || '-'}</td>
            <td>${esc(beverage ? item.looseQty : item.cartons) || '-'}</td>
            <td>${item.pallets === 'combined' ? '합팔레트' : (esc(item.pallets) || '-')}</td>
            <td>${esc(item.barcode || '-')}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    <div class="request-preview-note">미리보기는 저장될 내용을 확인하는 화면입니다. 실제 XLSX는 기존 원본 서식으로 저장됩니다.</div>
  `;
}

function renderOutboundRequestPreview(draft) {
  const products = shipmentActiveProducts();

  return `
    <div class="request-preview-title">출고 요청서</div>
    <table class="request-preview-table">
      <tbody>
        <tr><th colspan="6" class="section">출고기본 정보</th></tr>
        <tr><th>출고일시</th><td colspan="2">${esc(shipmentDateDisplay(draft.shipDate))}</td><th>도착일시</th><td colspan="2">${esc(shipmentDateDisplay(draft.arrivalDate))}</td></tr>
        <tr><th>운송수단</th>${renderRequestTransportCells(draft)}<td></td></tr>
        <tr><th colspan="6" class="section">수하인정보</th></tr>
        <tr><th>업체명</th><td colspan="5">${esc(draft.company || '-')}</td></tr>
        <tr><th>주소</th><td colspan="5">${esc(draft.address || '-')}</td></tr>
        <tr><th>연락처</th><td colspan="3">${esc(draft.phone || '-')}</td><th>팔레트</th><td>${Number(draft.pallet || 0) || '-'}</td></tr>
        <tr><th colspan="6" class="section">출고품목 목록</th></tr>
        <tr><th colspan="2">상품명</th><th>옵션명</th><th>카톤(박스)</th><th>수량(낱개)</th><th>기타요청사항</th></tr>
        ${products.map(item => `
          <tr>
            <td colspan="2">${esc(shipmentExcelProductName(item))}</td>
            <td>${Number(item.option || 0)}개입</td>
            <td>${Number(item.cartons || 0)}</td>
            <td>${shipmentProductLoose(item)}</td>
            <td>${esc(draft.requestNote || '-')}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    <div class="request-preview-note">미리보기는 저장될 내용을 확인하는 화면입니다. 실제 XLSX는 기존 원본 서식으로 저장됩니다.</div>
  `;
}

function renderRequestWorkPreview(draft) {
  const inbound = state.shipmentRequestType === 'inbound';
  const products = inbound
    ? inboundActiveProducts().map(entry => entry.item)
    : shipmentActiveProducts();

  return `
    <div class="request-preview-title">작업 지시서</div>
    <table class="request-preview-table">
      <thead>
        <tr><th style="width:50px">No</th><th>상품명</th><th>옵션명</th><th>수량</th><th>완료일</th><th>작업내용</th></tr>
      </thead>
      <tbody>
        ${products.map((item,index) => `
          <tr>
            <td>${index + 1}</td>
            <td>${esc(inbound ? item.productName : shipmentExcelProductName(item))}</td>
            <td>${esc(inbound ? (item.optionName || '-') : `${Number(item.option || 0)}개입`)}</td>
            <td>${esc(inbound ? (item.cartons || item.looseQty || '-') : shipmentProductLoose(item))}</td>
            <td>${esc(item.workDoneDate || '-')}</td>
            <td>${esc(item.workContent || '-')}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function renderRequestPreviewModal() {
  if (!state.requestPreviewOpen || !state.shipmentDraft) return '';

  const draft = state.shipmentDraft;
  const inbound = state.shipmentRequestType === 'inbound';
  const workTab = state.requestPreviewTab === 'work';

  return `
    <div class="manual-modal-bg">
      <button type="button" class="manual-backdrop" data-action="back-to-request-edit" aria-label="미리보기 닫기"></button>
      <div class="manual-modal request-preview-modal">
        <div class="manual-modal-top">
          <div>
            <div class="manual-modal-title">${inbound ? '입고' : '출고'} 요청서 미리보기</div>
            <div class="manual-modal-desc">저장되거나 메일에 첨부될 내용을 확인해주세요.</div>
          </div>
          <button type="button" class="icon-btn" data-action="back-to-request-edit" title="닫기">×</button>
        </div>

        <div class="request-preview-tabs">
          <button type="button" class="request-preview-tab ${!workTab ? 'active' : ''}" data-request-preview-tab="request">요청서</button>
          <button type="button" class="request-preview-tab ${workTab ? 'active' : ''}" data-request-preview-tab="work">작업지시서</button>
        </div>

        <div class="request-preview-sheet">
          ${workTab
            ? renderRequestWorkPreview(draft)
            : inbound
              ? renderInboundRequestPreview(draft)
              : renderOutboundRequestPreview(draft)}
        </div>

        <div class="manual-actions">
          <button type="button" class="btn" data-action="back-to-request-edit">수정하기</button>
          <button type="button" class="btn" data-action="save-preview-request">저장 및 다운로드</button>
          <button type="button" class="btn mail" data-action="open-request-email">메일 보내기</button>
        </div>
      </div>
    </div>
  `;
}

function renderRequestEmailModal() {
  if (!state.requestEmailOpen || !state.shipmentDraft) return '';

  return `
    <div class="manual-modal-bg">
      <button type="button" class="manual-backdrop" data-action="close-request-email" aria-label="메일 작성 닫기"></button>
      <div class="manual-modal" style="max-width:760px">
        <div class="manual-modal-top">
          <div>
            <div class="manual-modal-title">메일 보내기</div>
            <div class="manual-modal-desc">요청서는 Drive에 저장된 뒤 같은 파일이 메일에 첨부됩니다.</div>
          </div>
          <button type="button" class="icon-btn" data-action="close-request-email" title="닫기">×</button>
        </div>

        <div class="request-mail-summary">
          <div class="request-mail-summary-label">보내는 주소</div><div>scm@lightenuf.com</div>
          <div class="request-mail-summary-label">받는 주소</div><div>nine-logis@naver.com</div>
          <div class="request-mail-summary-label">첨부파일</div><div>${esc(requestPreviewFileName())}</div>
        </div>

        <div class="manual-section">
          <div class="manual-label">참조</div>
          <div class="request-mail-cc">
            <label><input type="checkbox" data-request-email-cc="hjkim@lightenuf.com"> hjkim@lightenuf.com</label>
            <label><input type="checkbox" data-request-email-cc="smeo@lightenuf.com"> smeo@lightenuf.com</label>
          </div>
        </div>

        <div class="manual-section">
          <div class="manual-label">제목</div>
          <input id="requestEmailSubject" class="manual-field" type="text" placeholder="메일 제목을 입력해주세요.">
        </div>

        <div class="manual-section">
          <div class="manual-label">내용</div>
          <textarea id="requestEmailBody" class="manual-field request-mail-body" placeholder="메일 내용을 입력해주세요."></textarea>
        </div>

        <div class="manual-actions">
          <button type="button" class="btn" data-action="close-request-email">취소</button>
          <button type="button" class="btn mail" data-action="send-request-email">최종 전송</button>
        </div>
      </div>
    </div>
  `;
}

/* =========================
   수동 발주 작성
   ========================= */

function renderManualOrderModal() {
  if (!state.manualOpen) {
    return '';
  }

  return `
    <div class="manual-modal-bg">
      <button
        type="button"
        class="manual-backdrop"
        data-action="close-manual"
        aria-label="수동 발주 작성 닫기"
      ></button>

      <div class="manual-modal">
        <div class="manual-modal-top">
          <div>
            <div class="manual-modal-title">
              수동 발주 작성
            </div>
            <div class="manual-modal-desc">
              수령 정보는 한 번만 입력하고 여러 수량·맛 구성을 한 번에 등록할 수 있습니다.
            </div>
          </div>

          <div class="manual-modal-top-actions">
            <button type="button" class="manual-back-btn" data-action="back-to-compose-choice">← 뒤로</button>
            <button
              type="button"
              class="icon-btn"
              data-action="close-manual"
              title="닫기"
            >
              ×
            </button>
          </div>
        </div>

        <div class="manual-section">
          <div class="manual-label">
            등록 채널
          </div>
          <div class="manual-options">
            <button type="button" class="manual-option" data-manual-kind="sponsor">협찬</button>
            <button type="button" class="manual-option" data-manual-kind="amb">엠베서더</button>
            <button type="button" class="manual-option" data-manual-kind="event">이벤트</button>
            <button type="button" class="manual-option" data-manual-kind="resend">오배송건 재발송</button>
            <button type="button" class="manual-option" data-manual-kind="sample">샘플</button>
            <button type="button" class="manual-option" data-manual-kind="b2b">B2B</button>
          </div>
        </div>

        <div class="manual-section">
          <div class="manual-label">
            수령 정보
          </div>
          <div class="manual-fields">
            <div id="manualCompanyWrap" style="display:none">
              <input
                id="manualCompany"
                class="manual-field"
                type="text"
                placeholder="B2B 거래처명"
              >
            </div>
            <input
              id="manualName"
              class="manual-field"
              type="text"
              placeholder="이름"
              autocomplete="name"
            >
            <input
              id="manualPhone"
              class="manual-field"
              type="text"
              placeholder="핸드폰 번호 (010-0000-0000)"
              inputmode="tel"
              autocomplete="tel"
            >
            <textarea
              id="manualAddr"
              class="manual-field addr"
              placeholder="주소"
              autocomplete="street-address"
            ></textarea>
          </div>
        </div>

        <div class="manual-section">
          <div class="manual-label">
            수량
          </div>
          <div class="manual-options">
            ${[6,12,24,36,48,96].map(q => `
              <button
                type="button"
                class="manual-option"
                data-manual-qty="${q}"
              >
                ${q}캔
              </button>
            `).join('')}
          </div>
        </div>

        <div class="manual-section">
          <div class="manual-label">
            맛 구성
          </div>
          <div class="manual-options">
            <button type="button" class="manual-option" data-manual-flavor="mix">사과 + 복숭아</button>
            <button type="button" class="manual-option" data-manual-flavor="apple">사과</button>
            <button type="button" class="manual-option" data-manual-flavor="peach">복숭아</button>
          </div>

          <div id="manualComposition" class="manual-compose-note">
            수량과 맛 구성을 선택하면 발주 구성이 아래에 추가됩니다.
          </div>
        </div>

        <div class="manual-actions">
          <button
            type="button"
            class="btn"
            data-action="close-manual"
          >
            취소
          </button>
          <button
            type="button"
            class="btn dark"
            data-action="save-manual"
          >
            수동 발주 등록
          </button>
        </div>
      </div>
    </div>
  `;
}

function manualItemKey(qty, flavor) {
  return `${Number(qty)}::${String(flavor || '')}`;
}

function manualItemLabel(item) {
  const qty = Number(item?.qty || 0);
  const flavor = item?.flavor || '';

  if (flavor === 'mix') {
    return `사과 ${qty / 2}캔 + 복숭아 ${qty / 2}캔`;
  }

  return (
    `${flavor === 'apple' ? '사과' : '복숭아'} ${qty}캔`
  );
}

function addManualSelection() {
  const kind =
    document.querySelector(
      '[data-manual-kind].active'
    )?.dataset.manualKind || '';

  if (
    !kind ||
    kind === 'sample'
  ) {
    updateManualCompositionNote();
    return;
  }

  const qty =
    Number(
      document.querySelector(
        '[data-manual-qty].active'
      )?.dataset.manualQty || 0
    );

  const flavor =
    document.querySelector(
      '[data-manual-flavor].active'
    )?.dataset.manualFlavor || '';

  const validGeneral =
    [6,12,24,36,48,96].includes(qty) &&
    ['apple','peach','mix'].includes(flavor) &&
    !(qty === 6 && flavor === 'mix');

  const validB2B =
    (
      qty === 24 &&
      ['apple','peach'].includes(flavor)
    ) ||
    (
      qty === 48 &&
      ['apple','peach','mix'].includes(flavor)
    );

  const valid =
    kind === 'b2b'
      ? validB2B
      : validGeneral;

  if (!valid) {
    updateManualCompositionNote();
    return;
  }

  const key =
    manualItemKey(qty, flavor);

  const exists =
    state.manualItems.some(
      item =>
        manualItemKey(
          item.qty,
          item.flavor
        ) === key
    );

  if (!exists) {
    state.manualItems.push({
      qty,
      flavor,
      count: 1
    });
  }

  updateManualCompositionNote();
}

function changeManualItemCount(key, delta) {
  const index =
    state.manualItems.findIndex(
      item =>
        manualItemKey(
          item.qty,
          item.flavor
        ) === key
    );

  if (index < 0) return;

  const item =
    state.manualItems[index];

  const next =
    Math.max(
      0,
      Number(item.count || 1) + delta
    );

  if (next === 0) {
    state.manualItems.splice(
      index,
      1
    );
  } else {
    item.count = next;
  }

  updateManualCompositionNote();
}

function updateManualCompositionNote() {
  const el =
    document.getElementById('manualComposition');

  if (!el) return;

  const kind =
    document.querySelector(
      '[data-manual-kind].active'
    )?.dataset.manualKind || '';

  if (kind === 'sample') {
    el.textContent =
      '실제 구성 · 사과 6캔 + 복숭아 6캔';
    return;
  }

  const items =
    Array.isArray(state.manualItems)
      ? state.manualItems
      : [];

  if (!items.length) {
    el.textContent =
      kind === 'b2b'
        ? '수량과 맛 구성을 선택하면 선택한 B2B 발주 구성이 아래에 추가됩니다.'
        : '수량과 맛 구성을 선택하면 발주 구성이 아래에 추가됩니다. 다른 수량과 맛도 이어서 선택할 수 있습니다.';
    return;
  }

  el.innerHTML = `
    <div class="manual-b2b-title">
      선택한 발주 구성
    </div>
    ${items.map(item => {
      const key =
        manualItemKey(
          item.qty,
          item.flavor
        );

      return `
        <div class="manual-b2b-item">
          <div class="manual-b2b-item-main">
            ${esc(manualItemLabel(item))}
          </div>
          <div class="manual-b2b-stepper">
            <button
              type="button"
              data-manual-item-minus="${esc(key)}"
              aria-label="구성 개수 줄이기"
            >−</button>
            <div class="manual-b2b-count">
              ${Number(item.count || 1)}
            </div>
            <button
              type="button"
              data-manual-item-plus="${esc(key)}"
              aria-label="구성 개수 늘리기"
            >+</button>
          </div>
        </div>
      `;
    }).join('')}
  `;
}

function applyManualKindRules(kind) {
  state.manualItems = [];

  const qtyButtons =
    Array.from(
      document.querySelectorAll('[data-manual-qty]')
    );

  const flavorButtons =
    Array.from(
      document.querySelectorAll('[data-manual-flavor]')
    );

  const companyWrap =
    document.getElementById('manualCompanyWrap');

  if (companyWrap) {
    companyWrap.style.display =
      kind === 'b2b'
        ? 'block'
        : 'none';
  }

  // 채널을 바꾸면 기존 선택값을 한 번 초기화합니다.
  qtyButtons.forEach(btn => {
    btn.disabled = false;
    btn.classList.remove('active');
  });

  flavorButtons.forEach(btn => {
    btn.disabled = false;
    btn.classList.remove('active');
  });

  // 샘플은 12캔 + 사과/복숭아 혼합 고정
  if (kind === 'sample') {
    qtyButtons.forEach(btn => {
      const isFixed =
        Number(btn.dataset.manualQty) === 12;

      btn.classList.toggle('active', isFixed);
      btn.disabled = !isFixed;
    });

    flavorButtons.forEach(btn => {
      const isFixed =
        btn.dataset.manualFlavor === 'mix';

      btn.classList.toggle('active', isFixed);
      btn.disabled = !isFixed;
    });
  }

  // B2B는 신청폼과 동일한 5가지 구성만 사용합니다.
  if (kind === 'b2b') {
    qtyButtons.forEach(btn => {
      const q =
        Number(btn.dataset.manualQty);

      btn.disabled =
        ![24,48].includes(q);
    });

    const mixBtn =
      document.querySelector(
        '[data-manual-flavor="mix"]'
      );

    if (mixBtn) {
      mixBtn.disabled = true;
    }
  }

  updateManualCompositionNote();
}

async function saveManualOrder() {
  const kind =
    document.querySelector(
      '[data-manual-kind].active'
    )?.dataset.manualKind || '';

  const name =
    document.getElementById('manualName')?.value.trim() || '';

  const phone =
    document.getElementById('manualPhone')?.value.trim() || '';

  const addr =
    document.getElementById('manualAddr')?.value.trim() || '';

  const company =
    document.getElementById('manualCompany')?.value.trim() || '';

  if (!kind) {
    return toast('협찬 / 엠베서더 / 이벤트 / 오배송건 재발송 / 샘플 / B2B 중 등록 채널을 선택해주세요.');
  }

  if (
    kind === 'b2b' &&
    !company
  ) {
    return toast('B2B 거래처명을 입력해주세요.');
  }

  if (!name) {
    return toast('이름을 입력해주세요.');
  }

  if (!phone) {
    return toast('핸드폰 번호를 입력해주세요.');
  }

  if (!addr) {
    return toast('주소를 입력해주세요.');
  }

  const payload = {
    kind,
    name,
    phone,
    addr,
    company
  };

  if (kind === 'sample') {
    payload.items = [
      {
        qty: 12,
        flavor: 'mix',
        count: 1
      }
    ];
  } else {
    const items =
      (state.manualItems || [])
        .map(item => ({
          qty: Number(item.qty),
          flavor: item.flavor,
          count: Math.max(
            1,
            Number(item.count || 1)
          )
        }));

    if (!items.length) {
      return toast('발주 구성을 하나 이상 추가해주세요.');
    }

    payload.items = items;
  }

  setLoading(true);

  try {
    const res =
      await gasCreateManualOrder(payload);

    setAdminData(
      res.data ||
      await gasGet()
    );

    state.manualOpen = false;
    state.manualItems = [];
    state.alertOpen = false;
    state.selected.clear();
    state.query = '';
    state.filterOpen = false;
    state.statusF = '전체';
    state.drawer = null;
    state.editing = false;

    state.page =
      kind === 'sponsor'
        ? 'sponsor'
        : kind === 'amb'
          ? 'amb'
          : kind === 'sample'
            ? 'sample'
            : kind === 'b2b'
              ? 'b2b'
              : 'event';

    state.sub = 'list';

    render();

    toast(
      `${kind === 'sponsor' ? '협찬' : kind === 'amb' ? '엠베서더' : kind === 'resend' ? '오배송건 재발송' : kind === 'sample' ? '샘플' : kind === 'b2b' ? 'B2B' : '이벤트'} 목록에 수동 발주를 등록했습니다.`
    );

  } catch(e) {
    toast(
      '수동 발주 등록 실패: ' +
      e.message
    );
  } finally {
    setLoading(false);
  }
}

