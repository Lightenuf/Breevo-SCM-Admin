
/* =========================
   설정값을 협찬 일정에 적용
   ========================= */

function sponsorStatusFor(o,dueDate) {
  if (o.infoMissing) {
    return '정보 확인 필요';
  }

  if (o.hold) {
    return '보류';
  }

  if (o.doneAt) {
    return '발주 완료';
  }

  if (!dueDate) {
    return '정보 확인 필요';
  }

  if (dueDate < todayIso()) {
    return '발주 지연';
  }

  if (dueDate === todayIso()) {
    return '오늘 발주';
  }

  return '발주 대기';
}

function applyLeadDays() {
  if (!state.data) return;

  state.data.sponsor =
    (state.data.sponsor || []).map(o => {
      if (o.source === 'manual') {
        return {
          ...o,
          dueDate: o.dueDate || todayIso()
        };
      }

      const dueDate =
        addDaysIso(
          o.eventDate,
          -Number(state.leadDays || 4)
        );

      return {
        ...o,
        dueDate,
        status: sponsorStatusFor(o,dueDate)
      };
    });

  if (!state.data.summary) {
    state.data.summary = {};
  }

  state.data.summary.sponsorToday =
    state.data.sponsor.filter(
      o => o.status === '오늘 발주'
    ).length;

  state.data.summary.sponsorOverdue =
    state.data.sponsor.filter(
      o => o.status === '발주 지연'
    ).length;
}

function setAdminData(data) {
  state.data = data;
  applyLeadDays();
}

/* =========================
   데이터 로딩
   ========================= */

async function loadData(show = true) {
  setLoading(show);

  try {
    const [adminData,settings] =
      await Promise.all([
        gasGet(),
        gasGetSettings()
      ]);

    state.leadDays =
      Number(settings?.leadDays) || 4;

    setAdminData(adminData);

    if (state.calYear == null) {
      const [y,m] =
        state.data.today
          .split('-')
          .map(Number);

      state.calYear = y;
      state.calMonth = m - 1;
    }

    state.selected.clear();

    render();

  } catch(e) {
    toast(
      '데이터를 불러오지 못했습니다: ' +
      e.message
    );
  } finally {
    setLoading(false);
  }
}

function setLoading(on) {
  const el =
    document.getElementById('overlay');

  if (on) {
    el.innerHTML =
      '<div class="loading">데이터를 불러오는 중입니다…</div>';
    return;
  }

  el.innerHTML = '';

  if (state.drawer) {
    renderDrawer();
  } else {
    renderToast();
  }
}

function toast(msg) {
  state.notice = msg;
  renderToast();

  clearTimeout(window.__toast);

  window.__toast =
    setTimeout(() => {
      state.notice = '';
      renderToast();
    },2600);
}

function renderToast() {
  const el =
    document.getElementById('overlay');

  if (
    document.querySelector('.loading')
  ) {
    return;
  }

  el.innerHTML =
    state.notice
      ? `
        <div class="toast">
          ${esc(state.notice)}
        </div>
      `
      : '';
}

/* =========================
   상단
   ========================= */

function navButton(k,label,badgeNum = '') {
  return `
    <button
      data-nav="${k}"
      class="${state.page === k ? 'active' : ''}"
    >
      <span>${label}</span>

      ${
        badgeNum
          ? `
            <span class="badge">
              ${badgeNum}
            </span>
          `
          : ''
      }
    </button>
  `;
}

function headerMeta() {
  if (state.page === 'sponsor') {
    return `발주 기준 행사 ${state.leadDays}일 전`;
  }

  if (
    state.page === 'amb' ||
    state.page === 'event' ||
    state.page === 'sample'
  ) {
    return '폼 접수 후 출고';
  }

  if (state.page === 'b2b') {
    return '신청일 기준 당일 발주';
  }

  if (state.page === 'olive') {
    return '위수탁 주문서 직접 업로드';
  }

  return '';
}

/* =========================
   전체 렌더
   ========================= */

function render() {
  if (!state.data) {
    document.getElementById('app').innerHTML = '';
    return;
  }

  const d = state.data;

  const urgent = [
    ...d.sponsor.filter(
      o =>
        ['오늘 발주','발주 지연']
          .includes(o.status)
    ),
    ...d.ambassador.filter(
      o => o.status === '출고 대기'
    ),
    ...d.event.filter(
      o => o.status === '출고 대기'
    ),
    ...(d.sample || []).filter(
      o => o.status === '출고 대기'
    ),
    ...(d.b2b || []).filter(
      o =>
        ['오늘 발주','발주 지연']
          .includes(o.status)
    )
  ].length;

  const [title,desc] =
    TITLES[state.page] || ['',''];

  const alertData =
    getAlertData();

  document.getElementById('app').innerHTML = `
    <div class="app">

      <div class="top">

        <div class="brand">
          Breevo
        </div>

        <div class="nav">
          ${navButton('today','오늘 발주',urgent || '')}
          ${navButton(
            'sponsor',
            '협찬',
            (
              d.summary.sponsorToday +
              d.summary.sponsorOverdue
            ) || ''
          )}
          ${navButton('olive','올리브영')}
          ${navButton('amb','엠베서더')}
          ${navButton('event','이벤트')}
          ${navButton('sample','샘플')}
          ${navButton(
            'b2b',
            'B2B',
            (
              Number(d.summary?.b2bToday || 0) +
              Number(d.summary?.b2bOverdue || 0)
            ) || ''
          )}
        </div>

        <div class="tools">

          <!-- 달력 -->
          <button
            class="icon-btn ${
              state.page === 'calendar'
                ? 'active'
                : ''
            }"
            data-nav="calendar"
            title="발주 달력"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.9"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <rect
                x="3"
                y="4.5"
                width="18"
                height="16"
                rx="3"
              ></rect>
              <path d="M8 3v3M16 3v3M3 10h18"></path>
            </svg>
          </button>

          <!-- 작성 메뉴 -->
          <button
            class="icon-btn"
            data-action="toggle-compose-menu"
            title="작성"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.9"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M12 20h9"></path>
              <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"></path>
            </svg>
          </button>

          <!-- 알림 -->
          <div class="alert-wrap">
            <button
              class="icon-btn alert-btn ${
                state.alertOpen
                  ? 'alert-open'
                  : ''
              }"
              data-action="toggle-alert"
              title="알림"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.9"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M18 8.5a6 6 0 0 0-12 0c0 6.5-2.6 7.5-2.6 7.5h17.2S18 15 18 8.5"></path>
                <path d="M13.7 20a2 2 0 0 1-3.4 0"></path>
              </svg>

              ${
                alertData.todayCount
                  ? `
                    <span class="alert-count">
                      ${alertData.todayCount}
                    </span>
                  `
                  : ''
              }
            </button>

            ${renderAlertPopup()}
          </div>

          <!-- 설정 -->
          <button
            class="icon-btn ${
              state.page === 'settings'
                ? 'active'
                : ''
            }"
            data-nav="settings"
            title="설정"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.9"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <circle
                cx="12"
                cy="12"
                r="2.6"
              ></circle>

              <path d="M12 3.2c.9 0 1.6.7 1.7 1.5.05.5.4.9.9 1.1.5.2 1 .1 1.4-.2.7-.5 1.6-.4 2.2.2s.7 1.5.2 2.2c-.3.4-.4.9-.2 1.4.2.5.6.85 1.1.9.8.1 1.5.8 1.5 1.7s-.7 1.6-1.5 1.7c-.5.05-.9.4-1.1.9-.2.5-.1 1 .2 1.4.5.7.4 1.6-.2 2.2s-1.5.7-2.2.2c-.4-.3-.9-.4-1.4-.2-.5.2-.85.6-.9 1.1-.1.8-.8 1.5-1.7 1.5s-1.6-.7-1.7-1.5c-.05-.5-.4-.9-.9-1.1-.5-.2-1-.1-1.4.2-.7.5-1.6.4-2.2-.2s-.7-1.5-.2-2.2c.3-.4.4-.9.2-1.4-.2-.5-.6-.85-1.1-.9-.8-.1-1.5-.8-1.5-1.7s.7-1.6 1.5-1.7c.5-.05.9-.4 1.1-.9.2-.5.1-1-.2-1.4-.5-.7-.4-1.6.2-2.2s1.5-.7 2.2-.2c.4.3.9.4 1.4.2.5-.2.85-.6.9-1.1.1-.8.8-1.5 1.7-1.5z"></path>
            </svg>
          </button>

          <!-- 새로고침 -->
          <button
            class="icon-btn"
            data-action="refresh"
            title="새로고침"
          >
            ↻
          </button>

        </div>
      </div>

      <div class="main">

        <div class="header">

          <div class="header-left">
            <div>
              <div class="title">
                ${title}
              </div>

              ${
                desc
                  ? `
                    <div class="desc">
                      ${desc}
                    </div>
                  `
                  : ''
              }
            </div>
          </div>

          <div class="meta">
            ${headerMeta()}
          </div>
        </div>

        ${
          state.page === 'sponsor'
            ? renderSponsorMetrics()
            : ''
        }

        ${renderPage()}

      </div>
    </div>

    ${renderComposeMenu()}
    ${renderShipmentTypeChoice()}
    ${renderInboundTypeChoice()}
    ${renderManualOrderModal()}
    ${renderShipmentRequestModal()}
    ${renderRequestPreviewModal()}
    ${renderRequestEmailModal()}
  `;

  renderDrawer();
}

/* =========================
   페이지
   ========================= */

function renderPage() {
  if (state.page === 'today') {
    return renderToday();
  }

  if (state.page === 'sponsor') {
    return renderSponsorShell();
  }

  if (state.page === 'amb') {
    return renderShippingShell('amb');
  }

  if (state.page === 'event') {
    return renderShippingShell('event');
  }

  if (state.page === 'sample') {
    return renderShippingShell('sample');
  }

  if (state.page === 'b2b') {
    return renderB2BShell();
  }

  if (state.page === 'olive') {
    return renderOlive();
  }

  if (state.page === 'calendar') {
    return renderCalendar();
  }

  if (state.page === 'settings') {
    return renderSettings();
  }

  return '';
}

/* =========================
   협찬 KPI
   ========================= */

function renderSponsorMetrics() {
  const a = state.data.sponsor;
  const mk = nowMonth();

  const vals = [
    [
      '오늘 발주',
      a.filter(o => o.status === '오늘 발주').length,
      '발주 예정일 당일',
      '오늘 발주',
      true
    ],
    [
      '발주 지연',
      a.filter(o => o.status === '발주 지연').length,
      '발주 예정일 경과',
      '발주 지연',
      true
    ],
    [
      '발주 대기',
      a.filter(o => o.status === '발주 대기').length,
      '발주 예정일 이전',
      '발주 대기',
      false
    ],
    [
      '발주 완료',
      a.filter(o => o.status === '발주 완료').length,
      '수동발주서 다운로드 완료',
      '발주 완료',
      false
    ],
    [
      '이번 달 제공량',
      a
        .filter(
          o =>
            monthKey(o.eventDate) === mk
        )
        .reduce(
          (n,o) =>
            n + Number(o.qty || 0),
          0
        ),
      '이번 달 행사 기준',
      '전체',
      false
    ]
  ];

  return `
    <div class="card metrics">
      ${
        vals.map(
          ([l,v,s,f,ac]) => `
            <button
              class="metric"
              data-metric="${f}"
            >
              <div class="metric-label">
                ${l}
              </div>

              <div
                class="metric-num ${
                  ac && v
                    ? 'accent'
                    : ''
                }"
              >
                ${Number(v).toLocaleString()}
              </div>

              <div class="metric-sub">
                ${s}
              </div>
            </button>
          `
        ).join('')
      }
    </div>
  `;
}

/* =========================
   협찬
   ========================= */

function sponsorTabs() {
  return `
    <div class="tabs">
      <button
        class="tab ${
          state.sub === 'dash'
            ? 'active'
            : ''
        }"
        data-sub="dash"
      >
        대시보드
      </button>

      <button
        class="tab ${
          state.sub === 'list'
            ? 'active'
            : ''
        }"
        data-sub="list"
      >
        발주 목록
      </button>

      <button
        class="tab ${
          state.sub === 'history'
            ? 'active'
            : ''
        }"
        data-sub="history"
      >
        발주 내역
      </button>
    </div>
  `;
}

function searchToolbar(showDownload = true) {
  return `
    <div class="toolbar">

      <input
        id="searchInput"
        class="search"
        value="${esc(state.query)}"
        placeholder="업체 · 수령인 · 연락처"
      >

      ${
        showDownload
          ? `
            <button
              class="btn dark"
              data-action="download-selected"
              ${
                state.selected.size
                  ? ''
                  : 'disabled'
              }
            >
              수동발주서 다운로드${
                state.selected.size
                  ? ` (${state.selected.size})`
                  : ''
              }
            </button>
          `
          : ''
      }

    </div>
  `;
}

function renderSponsorShell() {
  return `
    <div class="card shell">

      <div class="subbar">
        ${sponsorTabs()}

        ${
          state.sub === 'list'
            ? searchToolbar(true)
            : state.sub === 'history'
              ? searchToolbar(false)
              : ''
        }
      </div>

      ${
        state.sub === 'dash'
          ? renderSponsorDash()
          : state.sub === 'history'
            ? renderHistory('sponsor')
            : renderSponsorList()
      }

    </div>
  `;
}

function renderSponsorDash() {
  const groups = [
    ['발주 지연','over'],
    ['오늘 발주','today'],
    ['발주 대기','']
  ];

  return `
    <div>
      ${
        groups.map(([s,c]) => {
          const arr =
            state.data.sponsor
              .filter(o => o.status === s)
              .sort(
                (a,b) =>
                  String(a.dueDate)
                    .localeCompare(
                      String(b.dueDate)
                    )
              );

          return `
            <div class="dash-group">

              <button class="dash-head ${c}">
                <span class="dash-dot"></span>

                <strong>
                  ${s}
                </strong>

                <span class="dash-count">
                  ${arr.length}
                </span>

                <span style="flex:1"></span>

                <span class="muted">
                  ${
                    s === '발주 지연'
                      ? '예정일 경과'
                      : s === '오늘 발주'
                        ? '발주 예정일 당일'
                        : '발주 예정일 이전'
                  }
                </span>
              </button>

              <div class="dash-body">

                <div class="tr th dash-grid">
                  <div>업체/인스타</div>
                  <div>행사일</div>
                  <div>발주 예정일</div>
                  <div>제공 수량</div>
                  <div>구성</div>
                  <div></div>
                </div>

                ${
                  arr.length
                    ? arr.map(
                        o => `
                          <div class="tr dash-grid">

                            <div class="main-text">
                              ${esc(o.insta || '—')}
                            </div>

                            <div class="cell">
                              ${fmtDate(o.eventDate)}
                            </div>

                            <div class="cell strong">
                              ${fmtDate(o.dueDate)}
                            </div>

                            <div class="cell strong">
                              ${o.qty}캔
                            </div>

                            <div class="cell">
                              ${esc(o.flavorLabel || '—')}
                            </div>

                            <button
                              class="btn small"
                              data-open="${esc(o.id)}"
                            >
                              상세
                            </button>

                          </div>
                        `
                      ).join('')
                    : `
                      <div class="empty">
                        해당 상태의 발주 건이 없습니다.
                      </div>
                    `
                }

              </div>
            </div>
          `;
        }).join('')
      }
    </div>
  `;
}

function sponsorFiltered() {
  const q =
    state.query
      .trim()
      .toLowerCase();

  return state.data.sponsor.filter(o => {
    if (
      state.statusF !== '전체' &&
      o.status !== state.statusF
    ) {
      return false;
    }

    if (!q) return true;

    return `
      ${o.insta}
      ${o.name}
      ${o.phone}
      ${o.addr}
    `
      .toLowerCase()
      .includes(q);
  });
}

function renderSponsorList() {
  const arr =
    sponsorFiltered();

  return `
    <div class="content">

      <div class="section-head">

        <div
          style="
            display:flex;
            align-items:center;
            gap:10px
          "
        >
          <div class="section-title">
            발주 목록
          </div>

          <div class="muted">
            ${arr.length}건 · 선택 ${state.selected.size}건
          </div>
        </div>

        <button
          class="btn"
          data-action="toggle-filter"
        >
          필터
        </button>
      </div>

      ${
        state.filterOpen
          ? renderFilters()
          : ''
      }

      <div class="table">

        <div class="tr th sponsor-grid">

          <button
            class="check ${
              allSelected(arr)
                ? 'on'
                : ''
            }"
            data-action="toggle-all"
          >
            ${
              allSelected(arr)
                ? '✓'
                : ''
            }
          </button>

          <div>업체</div>
          <div>수령인</div>
          <div>행사 날짜</div>
          <div>발주 예정일</div>
          <div>수량</div>
          <div>구성</div>
          <div>상태</div>
          <div></div>

        </div>

        ${
          arr.length
            ? arr.map(o => sponsorRow(o)).join('')
            : `
              <div class="empty">
                조건에 맞는 발주 건이 없습니다.
              </div>
            `
        }

      </div>
    </div>
  `;
}

function renderFilters() {
  const opts = [
    '전체',
    '발주 지연',
    '오늘 발주',
    '발주 대기',
    '발주 완료',
    '보류',
    '정보 확인 필요'
  ];

  return `
    <div class="filters">
      ${
        opts.map(
          x => `
            <button
              class="pill ${
                state.statusF === x
                  ? 'active'
                  : ''
              }"
              data-status="${x}"
            >
              ${x}
            </button>
          `
        ).join('')
      }
    </div>
  `;
}

function sponsorRow(o) {
  return `
    <div class="tr sponsor-grid">

      <button
        class="check ${
          state.selected.has(o.id)
            ? 'on'
            : ''
        }"
        data-check="${esc(o.id)}"
        ${
          o.infoMissing
            ? 'disabled'
            : ''
        }
      >
        ${
          state.selected.has(o.id)
            ? '✓'
            : ''
        }
      </button>

      <div>
        <div class="main-text">
          ${esc(o.insta || o.name || '—')}
        </div>

        <div class="subtext">
          ${o.source === 'manual' ? '수동 등록' : '구글폼'}
        </div>
      </div>

      <div class="cell strong">
        ${esc(o.name || '—')}
      </div>

      <div class="cell">
        ${fmtDate(o.eventDate)}
      </div>

      <div class="cell strong">
        ${fmtDate(o.dueDate)}
      </div>

      <div class="cell strong">
        ${o.qty}캔
      </div>

      <div class="cell">
        ${esc(o.flavorLabel || '—')}
      </div>

      <div>
        ${badge(o.status)}
      </div>

      <button
        class="btn small"
        data-open="${esc(o.id)}"
      >
        상세
      </button>

    </div>
  `;
}

/* =========================
   엠베서더 / 이벤트
   ========================= */

function shippingData(kind) {
  if (kind === 'amb') {
    return state.data.ambassador || [];
  }

  if (kind === 'sample') {
    return state.data.sample || [];
  }

  return state.data.event || [];
}

function shippingLabel(kind) {
  if (kind === 'amb') return '엠베서더';
  if (kind === 'sample') return '샘플';
  return '이벤트';
}

function renderShippingShell(kind) {
  const label =
    shippingLabel(kind);

  const tabs = `
    <div class="tabs">

      <button
        class="tab ${
          state.sub === 'list'
            ? 'active'
            : ''
        }"
        data-sub="list"
      >
        ${label} 목록
      </button>

      <button
        class="tab ${
          state.sub === 'history'
            ? 'active'
            : ''
        }"
        data-sub="history"
      >
        발주 내역
      </button>

    </div>
  `;

  return `
    <div class="card shell">

      <div class="subbar">
        ${tabs}

        ${
          state.sub === 'list'
            ? searchToolbar(true)
            : searchToolbar(false)
        }
      </div>

      ${
        state.sub === 'history'
          ? renderHistory(kind)
          : renderShippingList(kind)
      }

    </div>
  `;
}

function shippingFiltered(kind) {
  const arr =
    shippingData(kind);

  const q =
    state.query
      .trim()
      .toLowerCase();

  return arr.filter(
    o =>
      !q ||
      `
        ${o.insta}
        ${o.name}
        ${o.phone}
        ${o.addr}
        ${o.eventTitle || ''}
      `
        .toLowerCase()
        .includes(q)
  );
}

function renderShippingList(kind) {
  const arr =
    shippingFiltered(kind);

  const isAmb =
    kind === 'amb';

  const isSample =
    kind === 'sample';

  const label =
    shippingLabel(kind);

  return `
    <div class="content">

      <div class="section-head">

        <div
          style="
            display:flex;
            align-items:center;
            gap:10px
          "
        >
          <div class="section-title">
            ${label} 목록
          </div>

          <div class="muted">
            ${arr.length}건 · 선택 ${state.selected.size}건
          </div>
        </div>

      </div>

      <div class="table">

        <div
          class="
            tr
            th
            ${
              kind === 'event'
                ? 'event-grid'
                : 'ship-grid'
            }
          "
        >

          <button
            class="check ${
              allSelected(arr)
                ? 'on'
                : ''
            }"
            data-action="toggle-all"
          >
            ${
              allSelected(arr)
                ? '✓'
                : ''
            }
          </button>

          <div>
            ${
              isAmb || isSample
                ? '인플루언서'
                : '이벤트/인스타'
            }
          </div>

          <div>수령인</div>
          <div>연락처</div>
          <div>접수일</div>
          <div>수량</div>
          <div>구성</div>
          <div>상태</div>
          <div></div>

        </div>

        ${
          arr.length
            ? arr.map(
                o =>
                  shippingRow(o,kind)
              ).join('')
            : `
              <div class="empty">
                접수된 건이 없습니다.
              </div>
            `
        }

      </div>

      <div class="note">
        ${
          isAmb
            ? `
              엠베서더는 총 12캔 고정이며
              사과+복숭아 / 사과 / 복숭아 중
              신청값으로 출고합니다.
            `
            : isSample
              ? `
                샘플은 총 12캔 고정이며
                사과 6개입 선물세트 1개 +
                복숭아 6개입 선물세트 1개로 출고합니다.
              `
              : `
                이벤트는 1 BOX(6캔) 고정이며
                사과 또는 복숭아로 출고합니다.
              `
        }
      </div>
    </div>
  `;
}

function shippingRow(o,kind) {
  const isAmb =
    kind === 'amb';

  const isSample =
    kind === 'sample';

  const label =
    isAmb || isSample
      ? (o.insta || o.name || '—')
      : (
          o.eventTitle ||
          '브리보 이벤트'
        );

  return `
    <div
      class="
        tr
        ${
          kind === 'event'
            ? 'event-grid'
            : 'ship-grid'
        }
      "
    >

      <button
        class="check ${
          state.selected.has(o.id)
            ? 'on'
            : ''
        }"
        data-check="${esc(o.id)}"
        ${
          o.infoMissing
            ? 'disabled'
            : ''
        }
      >
        ${
          state.selected.has(o.id)
            ? '✓'
            : ''
        }
      </button>

      <div>

        <div class="main-text">
          ${esc(label)}
        </div>

        <div class="subtext">
          ${
            o.source === 'manual'
              ? '수동 등록'
              : isAmb
                ? '엠베서더 폼'
                : isSample
                  ? '샘플 폼'
                  : esc(
                      o.insta ||
                      '이벤트 신청폼'
                    )
          }
        </div>

      </div>

      <div class="cell strong">
        ${esc(o.name || '—')}
      </div>

      <div class="cell">
        ${esc(o.phone || '—')}
      </div>

      <div class="cell">
        ${fmtDate(o.receivedDate)}
      </div>

      <div class="cell strong">
        ${o.qty}캔
      </div>

      <div class="cell">
        ${esc(flavorText(o))}
      </div>

      <div>
        ${badge(o.status)}
      </div>

      <button
        class="btn small"
        data-open="${esc(o.id)}"
      >
        상세
      </button>

    </div>
  `;
}


/* =========================
   B2B
   - 거래처는 한 줄로 표시
   - 같은 거래처의 재주문은 아래 주문 이력으로 누적
   ========================= */

function b2bProductText(o) {
  if (o?.b2bProduct) {
    return o.b2bProduct;
  }

  if (
    Number(o?.qty) === 48 &&
    o?.flavor === 'mix'
  ) {
    return '사과 24캔 + 복숭아 24캔';
  }

  if (o?.flavor === 'apple') {
    return `사과 ${Number(o.qty || 0)}캔`;
  }

  if (o?.flavor === 'peach') {
    return `복숭아 ${Number(o.qty || 0)}캔`;
  }

  return flavorText(o || {});
}

function b2bQtyText(o) {
  const qty =
    Number(o?.qty || 0);

  const count =
    Math.max(
      1,
      Number(o?.itemCount || 1)
    );

  return (
    `${qty}캔` +
    (count > 1 ? ` x${count}` : '')
  );
}


function buildB2BGroupsClient(orders) {
  const map = {};

  (orders || []).forEach(o => {
    const key =
      String(o.company || '')
        .replace(/\s+/g,'')
        .trim()
        .toLowerCase();

    if (!key) return;

    if (!map[key]) {
      map[key] = {
        key,
        company: o.company || '—',
        branch: o.branch || '',
        name: o.name || '',
        phone: o.phone || '',
        addr: o.addr || '',
        pendingCount: 0,
        orders: []
      };
    }

    map[key].orders.push(o);

    if (o.status !== '출고 완료') {
      map[key].pendingCount += 1;
    }
  });

  return Object.values(map)
    .map(g => {
      g.orders.sort(
        (a,b) =>
          String(
            b.receivedAt ||
            b.receivedDate ||
            ''
          ).localeCompare(
            String(
              a.receivedAt ||
              a.receivedDate ||
              ''
            )
          )
      );

      const latest =
        g.orders[0] || {};

      return {
        ...g,
        company:
          latest.company ||
          g.company,
        branch:
          latest.branch ||
          g.branch,
        name:
          latest.name ||
          g.name,
        phone:
          latest.phone ||
          g.phone,
        addr:
          latest.addr ||
          g.addr,
        latestDate:
          latest.receivedDate || '',
        latestAt:
          latest.receivedAt ||
          latest.receivedDate || '',
        latestProduct:
          b2bProductText(latest),
        latestStatus:
          latest.status || ''
      };
    })
    .sort(
      (a,b) =>
        String(
          b.latestAt ||
          b.latestDate ||
          ''
        ).localeCompare(
          String(
            a.latestAt ||
            a.latestDate ||
            ''
          )
        )
    );
}


function b2bGroupsData() {
  const backendGroups =
    state.data?.b2bGroups;

  if (
    Array.isArray(backendGroups) &&
    backendGroups.length
  ) {
    return backendGroups;
  }

  return buildB2BGroupsClient(
    state.data?.b2b || []
  );
}


function b2bFilteredGroups() {
  const q =
    state.query
      .trim()
      .toLowerCase();

  return b2bGroupsData().filter(g => {
    if (!q) return true;

    const orderText =
      (g.orders || [])
        .map(
          o =>
            `${o.branch || ''} ${o.name || ''} ${o.phone || ''} ${o.addr || ''} ${b2bProductText(o)}`
        )
        .join(' ');

    return `
      ${g.company || ''}
      ${g.branch || ''}
      ${g.name || ''}
      ${g.phone || ''}
      ${g.addr || ''}
      ${g.latestProduct || ''}
      ${orderText}
    `
      .toLowerCase()
      .includes(q);
  });
}


function b2bSelectableOrders() {
  return b2bFilteredGroups()
    .flatMap(g => g.orders || [])
    .filter(
      o =>
        !o.infoMissing &&
        o.status !== '출고 완료'
    );
}


function renderB2BShell() {
  const tabs = `
    <div class="tabs">
      <button
        class="tab ${
          state.sub === 'list'
            ? 'active'
            : ''
        }"
        data-sub="list"
      >
        거래처 목록
      </button>

      <button
        class="tab ${
          state.sub === 'history'
            ? 'active'
            : ''
        }"
        data-sub="history"
      >
        발주 내역
      </button>
    </div>
  `;

  return `
    <div class="card shell">

      <div class="subbar">
        ${tabs}

        ${
          state.sub === 'list'
            ? searchToolbar(true)
            : searchToolbar(false)
        }
      </div>

      ${
        state.sub === 'history'
          ? renderHistory('b2b')
          : renderB2BList()
      }

    </div>
  `;
}


function renderB2BList() {
  const groups =
    b2bFilteredGroups();

  const allOrders =
    groups.flatMap(
      g => g.orders || []
    );

  const pending =
    allOrders.filter(
      o => o.status !== '출고 완료'
    ).length;

  return `
    <div class="content">

      <div class="section-head">
        <div
          style="
            display:flex;
            align-items:center;
            gap:10px
          "
        >
          <div class="section-title">
            B2B 거래처
          </div>

          <div class="muted">
            거래처 ${groups.length}곳 ·
            주문 ${allOrders.length}건 ·
            미처리 ${pending}건 ·
            선택 ${state.selected.size}건
          </div>
        </div>
      </div>

      <div class="table">

        <div class="tr th b2b-company-grid">
          <div>거래처</div>
          <div>수령인</div>
          <div>연락처</div>
          <div>최근 주문일</div>
          <div>주문 시간</div>
          <div>최근 주문</div>
          <div>미처리</div>
          <div></div>
        </div>

        ${
          groups.length
            ? groups.map(
                g => renderB2BCompany(g)
              ).join('')
            : `
              <div class="empty">
                접수된 B2B 거래처가 없습니다.
              </div>
            `
        }

      </div>

      <div class="note">
        같은 거래처가 다시 신청하면 새 거래처 행을 만들지 않고,
        기존 거래처 아래 주문 이력에 계속 누적됩니다.
        B2B는 신청한 날이 바로 발주일입니다.
      </div>
    </div>
  `;
}


function renderB2BCompany(g) {
  const key =
    String(g.key || '');

  const open =
    state.b2bExpanded.has(key);

  const orders =
    g.orders || [];

  return `
    <div>
      <div class="tr b2b-company-grid b2b-company-row">

        <div>
          <div class="main-text">
            ${esc(g.company || '—')}
          </div>
          <div class="subtext">
            주문 ${orders.length}건
          </div>
        </div>

        <div class="cell strong">
          ${esc(g.name || '—')}
        </div>

        <div class="cell">
          ${esc(g.phone || '—')}
        </div>

        <div class="cell">
          ${fmtDate(g.latestDate)}
        </div>

        <div class="cell">
          ${fmtTime(
            g.latestAt ||
            g.latestDate
          )}
        </div>

        <div class="cell strong">
          ${esc(
            g.latestProduct ||
            (
              orders[0]
                ? b2bProductText(orders[0])
                : '—'
            )
          )}
        </div>

        <div>
          ${
            Number(g.pendingCount || 0)
              ? `
                <span class="badge-status status-today">
                  ${Number(g.pendingCount || 0)}건
                </span>
              `
              : `
                <span class="badge-status status-done">
                  완료
                </span>
              `
          }
        </div>

        <button
          type="button"
          class="b2b-chevron"
          data-b2b-toggle="${esc(key)}"
          title="주문 이력 ${open ? '접기' : '펼치기'}"
        >
          ${open ? '⌃' : '⌄'}
        </button>

      </div>

      ${
        open
          ? renderB2BOrders(g)
          : ''
      }
    </div>
  `;
}


function renderB2BOrders(g) {
  const orders =
    g.orders || [];

  return `
    <div class="b2b-expanded">

      <div class="tr th b2b-order-grid">
        <div></div>
        <div>주문일</div>
        <div>주문 시간</div>
        <div>지점</div>
        <div>수령인</div>
        <div>주소</div>
        <div>B2B 제품</div>
        <div>수량</div>
        <div>상태</div>
        <div></div>
      </div>

      ${
        orders.length
          ? orders.map(o => {
              const selectable =
                !o.infoMissing &&
                o.status !== '출고 완료';

              return `
                <div class="tr b2b-order-grid">

                  <button
                    class="check ${
                      state.selected.has(o.id)
                        ? 'on'
                        : ''
                    }"
                    data-check="${esc(o.id)}"
                    ${
                      selectable
                        ? ''
                        : 'disabled'
                    }
                  >
                    ${
                      state.selected.has(o.id)
                        ? '✓'
                        : ''
                    }
                  </button>

                  <div class="cell">
                    ${fmtDate(o.receivedDate)}
                  </div>

                  <div class="cell">
                    ${fmtTime(
                      o.receivedAt ||
                      o.timestamp ||
                      o.receivedDate
                    )}
                  </div>

                  <div class="cell strong">
                    ${esc(o.branch || '—')}
                  </div>

                  <div class="cell strong">
                    ${esc(o.name || '—')}
                  </div>

                  <div class="cell">
                    ${esc(o.addr || '—')}
                  </div>

                  <div class="cell strong">
                    ${esc(b2bProductText(o))}
                  </div>

                  <div class="cell strong">
                    ${esc(b2bQtyText(o))}
                  </div>

                  <div>
                    ${badge(o.status)}
                  </div>

                  <button
                    class="btn small"
                    data-open="${esc(o.id)}"
                  >
                    상세
                  </button>

                </div>
              `;
            }).join('')
          : `
            <div class="empty">
              주문 이력이 없습니다.
            </div>
          `
      }

    </div>
  `;
}


/* =========================
   오늘 발주
   ========================= */

function renderToday() {
  const list = [
    ...state.data.sponsor
      .filter(
        o =>
          ['오늘 발주','발주 지연']
            .includes(o.status)
      )
      .map(
        o => ({
          ...o,
          _kind: '협찬'
        })
      ),

    ...state.data.ambassador
      .filter(
        o =>
          o.status === '출고 대기'
      )
      .map(
        o => ({
          ...o,
          _kind: '엠베서더'
        })
      ),

    ...state.data.event
      .filter(
        o =>
          o.status === '출고 대기'
      )
      .map(
        o => ({
          ...o,
          _kind: o.kindLabel || '이벤트'
        })
      ),

    ...(state.data.sample || [])
      .filter(
        o =>
          o.status === '출고 대기'
      )
      .map(
        o => ({
          ...o,
          _kind: '샘플'
        })
      ),

    ...(state.data.b2b || [])
      .filter(
        o =>
          ['오늘 발주','발주 지연']
            .includes(o.status)
      )
      .map(
        o => ({
          ...o,
          _kind: 'B2B'
        })
      ),

    ...(state.data.olive || [])
      .filter(
        o =>
          ['오늘 발주','발주 지연','출고 대기']
            .includes(o.status)
      )
      .map(
        o => ({
          ...o,
          _kind: '올리브영'
        })
      )
  ];

  const doneList = [
    ...state.data.sponsor
      .filter(o => o.status === '발주 완료')
      .map(o => ({ ...o, _kind: '협찬' })),

    ...state.data.ambassador
      .filter(o => o.status === '출고 완료')
      .map(o => ({ ...o, _kind: '엠베서더' })),

    ...state.data.event
      .filter(o => o.status === '출고 완료')
      .map(o => ({ ...o, _kind: o.kindLabel || '이벤트' })),

    ...(state.data.sample || [])
      .filter(o => o.status === '출고 완료')
      .map(o => ({ ...o, _kind: '샘플' })),

    ...(state.data.b2b || [])
      .filter(o => o.status === '출고 완료')
      .map(o => ({ ...o, _kind: 'B2B' })),

    ...(state.data.olive || [])
      .filter(
        o =>
          ['발주 완료','출고 완료']
            .includes(o.status)
      )
      .map(o => ({ ...o, _kind: '올리브영' }))
  ].sort(
    (a,b) =>
      String(b.doneAt || '')
        .localeCompare(
          String(a.doneAt || '')
        )
  );

  const displayName = o =>
    (o._kind === '이벤트' || o._kind === '오배송건 재발송')
      ? (
          o.eventTitle ||
          o.insta ||
          o.name ||
          '—'
        )
      : o._kind === 'B2B'
        ? (
            o.company ||
            o.name ||
            '—'
          )
        : (
            o.insta ||
            o.name ||
            '—'
          );

  const displayFlavor = o =>
    o._kind === 'B2B'
      ? b2bProductText(o)
      : o.flavor
        ? flavorText(o)
        : (
            o.productName ||
            o.itemName ||
            '—'
          );

  return `
    <div
      style="
        display:flex;
        flex-direction:column;
        gap:14px
      "
    >

      <div class="card content">

        <div class="section-head">

          <div
            style="
              display:flex;
              align-items:center;
              gap:10px
            "
          >
            <div class="section-title">
              오늘 보내야 할 발주
            </div>

            <div class="muted">
              협찬 ${
                list.filter(
                  x => x._kind === '협찬'
                ).length
              }건 ·
              엠베서더 ${
                list.filter(
                  x => x._kind === '엠베서더'
                ).length
              }건 ·
              이벤트 ${
                list.filter(
                  x => x._kind === '이벤트'
                ).length
              }건 ·
              샘플 ${
                list.filter(
                  x => x._kind === '샘플'
                ).length
              }건 ·
              B2B ${
                list.filter(
                  x => x._kind === 'B2B'
                ).length
              }건${
                (state.data.olive || []).length
                  ? ` · 올리브영 ${
                      list.filter(
                        x => x._kind === '올리브영'
                      ).length
                    }건`
                  : ''
              } ·
              선택 ${state.selected.size}건
            </div>
          </div>

          <button
            class="btn dark"
            data-action="download-selected"
            ${
              state.selected.size
                ? ''
                : 'disabled'
            }
          >
            수동발주서 다운로드${
              state.selected.size
                ? ` (${state.selected.size})`
                : ''
            }
          </button>

        </div>

        <div class="table">

          <div class="tr th today-grid">

            <button
              class="check ${
                allSelected(list)
                  ? 'on'
                  : ''
              }"
              data-action="toggle-all"
            >
              ${
                allSelected(list)
                  ? '✓'
                  : ''
              }
            </button>

            <div>구분</div>
            <div>업체/인플루언서</div>
            <div>수령인</div>
            <div>연락처</div>
            <div>수량</div>
            <div>구성</div>
            <div>상태</div>
            <div></div>

          </div>

          ${
            list.length
              ? list.map(
                  o => `
                    <div class="tr today-grid">

                      <button
                        class="check ${
                          state.selected.has(o.id)
                            ? 'on'
                            : ''
                        }"
                        data-check="${esc(o.id)}"
                        ${
                          o.infoMissing
                            ? 'disabled'
                            : ''
                        }
                      >
                        ${
                          state.selected.has(o.id)
                            ? '✓'
                            : ''
                        }
                      </button>

                      <div>
                        ${kindBadge(o._kind)}
                      </div>

                      <div class="main-text">
                        ${esc(displayName(o))}
                      </div>

                      <div class="cell strong">
                        ${esc(o.name || '—')}
                      </div>

                      <div class="cell">
                        ${esc(o.phone || '—')}
                      </div>

                      <div class="cell strong">
                        ${
                          o.qty
                            ? `${o.qty}캔`
                            : '—'
                        }
                      </div>

                      <div class="cell">
                        ${esc(displayFlavor(o))}
                      </div>

                      <div>
                        ${badge(o.status)}
                      </div>

                      <button
                        class="btn small"
                        data-open="${esc(o.id)}"
                      >
                        상세
                      </button>

                    </div>
                  `
                ).join('')
              : `
                <div class="empty">
                  오늘 처리할 발주가 없습니다.
                </div>
              `
          }

        </div>

        <div class="note">
          선택 후 XLSX 수동발주서를 내려받으면
          해당 건은 자동으로 완료 처리되고,
          아래 발주 완료 내역에 계속 남습니다.
        </div>

      </div>

      <div class="card content">

        <div class="section-head">

          <div class="section-title">
            발주 완료
          </div>

          <div class="muted">
            ${doneList.length}건
          </div>

        </div>

        <div class="table">

          <div class="tr th today-done-grid">
            <div>완료일</div>
            <div>구분</div>
            <div>업체/인플루언서</div>
            <div>수령인</div>
            <div>수량</div>
            <div>구성</div>
            <div>상태</div>
            <div></div>
          </div>

          ${
            doneList.length
              ? doneList.map(
                  o => `
                    <div class="tr today-done-grid">

                      <div class="cell">
                        ${esc(o.doneAt || '—')}
                      </div>

                      <div>
                        ${kindBadge(o._kind)}
                      </div>

                      <div class="main-text">
                        ${esc(displayName(o))}
                      </div>

                      <div class="cell strong">
                        ${esc(o.name || '—')}
                      </div>

                      <div class="cell strong">
                        ${
                          o.qty
                            ? `${o.qty}캔`
                            : '—'
                        }
                      </div>

                      <div class="cell">
                        ${esc(displayFlavor(o))}
                      </div>

                      <div>
                        ${badge(o.status)}
                      </div>

                      <button
                        class="btn small"
                        data-open="${esc(o.id)}"
                      >
                        상세
                      </button>

                    </div>
                  `
                ).join('')
              : `
                <div class="empty">
                  아직 완료된 발주가 없습니다.
                </div>
              `
          }

        </div>

      </div>

    </div>
  `;
}

/* =========================
   완료 내역
   ========================= */

function renderHistory(kind) {
  let arr =
    kind === 'sponsor'
      ? state.data.sponsor
      : kind === 'amb'
        ? state.data.ambassador
        : kind === 'sample'
          ? (state.data.sample || [])
          : kind === 'b2b'
            ? (state.data.b2b || [])
            : state.data.event;

  const doneLabel =
    kind === 'sponsor'
      ? '발주 완료'
      : '출고 완료';

  const q =
    state.query
      .trim()
      .toLowerCase();

  arr =
    arr
      .filter(
        o =>
          o.status === doneLabel &&
          (
            !q ||
            `
              ${o.company || ''}
              ${o.insta}
              ${o.name}
              ${o.phone}
            `
              .toLowerCase()
              .includes(q)
          )
      )
      .sort(
        (a,b) =>
          String(b.doneAt)
            .localeCompare(
              String(a.doneAt)
            )
      );

  return `
    <div class="content">

      <div class="section-head">
        <div class="section-title">
          완료 내역
        </div>

        <div class="muted">
          ${arr.length}건
        </div>
      </div>

      <div class="table">

        <div class="tr th history-grid">
          <div>완료일</div>
          <div>구분</div>
          <div>업체/인스타</div>
          <div>수량</div>
          <div>상태</div>
          <div></div>
        </div>

        ${
          arr.length
            ? arr.map(
                o => `
                  <div class="tr history-grid">

                    <div class="cell">
                      ${esc(o.doneAt || '—')}
                    </div>

                    <div>
                      ${
                        kindBadge(
                          kind === 'sponsor'
                            ? '협찬'
                            : kind === 'amb'
                              ? '엠베서더'
                              : kind === 'sample'
                                ? '샘플'
                                : kind === 'b2b'
                                  ? 'B2B'
                                  : (o.kindLabel || '이벤트')
                        )
                      }
                    </div>

                    <div class="main-text">
                      ${
                        esc(
                          o.company ||
                          o.insta ||
                          o.eventTitle ||
                          '—'
                        )
                      }
                    </div>

                    <div class="cell strong">
                      ${o.qty}캔
                    </div>

                    <div>
                      ${badge(o.status)}
                    </div>

                    <button
                      class="btn small"
                      data-open="${esc(o.id)}"
                    >
                      상세
                    </button>

                  </div>
                `
              ).join('')
            : `
              <div class="empty">
                완료된 내역이 없습니다.
              </div>
            `
        }

      </div>
    </div>
  `;
}

/* =========================
   올리브영
   ========================= */

function oliveHistoryProductSummary(h) {
  const parts = [];

  const apple =
    Number(h?.appleQty || 0);

  const peach =
    Number(h?.peachQty || 0);

  const other =
    Number(h?.otherQty || 0);

  if (apple) {
    parts.push(`사과 ${apple}박스`);
  }

  if (peach) {
    parts.push(`복숭아 ${peach}박스`);
  }

  if (other) {
    parts.push(`기타 ${other}개`);
  }

  return parts.length
    ? parts.join(' · ')
    : '—';
}

function renderOlive() {
  const summary =
    state.oliveSummary || null;

  const ready =
    !state.oliveBusy &&
    !state.oliveError &&
    Array.isArray(state.oliveRows) &&
    state.oliveRows.length > 0;

  const history =
    Array.isArray(state.data?.olive)
      ? state.data.olive
      : [];

  let statusText = '';

  if (state.oliveBusy) {
    statusText =
      '주문서 암호를 해제하고 주문 내용을 확인하고 있습니다.';
  } else if (state.oliveError) {
    statusText =
      state.oliveError;
  } else if (ready && summary) {
    statusText =
      `주문 ${summary.orderCount}건 · ` +
      `나인로지스 발주 ${summary.rowCount}행 변환 준비 완료`;
  } else {
    statusText =
      '파일을 선택하면 주문 내용을 확인한 뒤 나인로지스 수동 발주서로 변환합니다.';
  }

  return `
    <div
      style="
        display:flex;
        flex-direction:column;
        gap:14px
      "
    >

      <label class="upload">

        <div
          style="
            font-size:18px;
            margin-bottom:8px
          "
        >
          ⇧
        </div>

        <div class="small-label">
          올리브영 위수탁 주문서 ·
          XLSX, XLS, CSV
        </div>

        <div
          style="
            display:inline-block;
            margin-top:12px
          "
          class="btn dark"
        >
          파일 선택
        </div>

        <input
          id="oliveInput"
          type="file"
          accept=".xlsx,.xls,.csv"
        >

      </label>

      ${
        state.oliveFile
          ? `
            <div class="card content">

              <div
                style="
                  display:flex;
                  align-items:center;
                  justify-content:space-between;
                  gap:16px
                "
              >
                <div>
                  <div class="section-title">
                    선택된 파일
                  </div>

                  <div
                    class="small-label"
                    style="margin-top:6px"
                  >
                    ${esc(state.oliveFile)}
                  </div>
                </div>

                ${
                  ready
                    ? `
                      <button
                        class="btn dark"
                        data-action="olive-download"
                      >
                        나인로지스 수동발주서 다운로드
                      </button>
                    `
                    : ''
                }
              </div>

              <div
                class="note"
                style="${
                  state.oliveError
                    ? 'color:#C7563C;background:#FEF0EA;'
                    : ''
                }"
              >
                ${esc(statusText)}
              </div>

              ${
                ready
                  ? `
                    <div
                      style="
                        margin-top:14px;
                        padding-top:14px;
                        border-top:1px solid var(--line)
                      "
                    >
                      <div class="small-label">
                        변환 규칙
                      </div>
                      <div
                        style="
                          margin-top:7px;
                          font-size:12px;
                          line-height:1.65;
                          color:var(--m2)
                        "
                      >
                        보내는분성명은 라이트이너프(브리보)로 입력하고,
                        올리브영 주문서의 수취인·주문자·연락처·우편번호·주소·배송메세지·단품명·출하지시수량을
                        나인로지스 양식에 맞춰 2행부터 채웁니다.
                        단품명에 6개입이 포함되면 품목명 뒤에 -선물세트를 자동으로 붙입니다.
                      </div>
                    </div>
                  `
                  : ''
              }

            </div>
          `
          : ''
      }

      <div class="card content">
        <div class="section-head">
          <div>
            <div class="section-title">
              발주 이력
            </div>
            <div
              class="muted"
              style="margin-top:4px"
            >
              업로드한 주문서는 새로고침하거나 다시 접속해도 이곳에 남습니다.
            </div>
          </div>

          <div class="muted">
            ${history.length}건
          </div>
        </div>

        <div class="table">
          <div class="tr th olive-history-grid">
            <div>업로드 일시</div>
            <div>원본 파일명</div>
            <div>주문</div>
            <div>상품 요약</div>
            <div>상태</div>
            <div>다운로드 일시</div>
            <div></div>
          </div>

          ${
            history.length
              ? history.map(h => `
                  <div class="tr olive-history-grid">
                    <div class="cell">
                      ${fmtDateTime(h.uploadedAt)}
                    </div>

                    <div
                      class="main-text"
                      title="${esc(h.fileName || '')}"
                    >
                      ${esc(h.fileName || '—')}
                    </div>

                    <div>
                      <div class="cell strong">
                        ${Number(h.orderCount || 0)}건
                      </div>
                      <div class="subtext">
                        발주 ${Number(h.rowCount || 0)}행
                      </div>
                    </div>

                    <div class="cell strong">
                      ${esc(oliveHistoryProductSummary(h))}
                    </div>

                    <div>
                      <span
                        class="badge-status ${
                          h.status === '다운로드 완료'
                            ? 'status-done'
                            : 'status-wait'
                        }"
                      >
                        ${esc(h.status || '미다운로드')}
                      </span>
                    </div>

                    <div class="cell">
                      ${
                        h.downloadedAt
                          ? fmtDateTime(h.downloadedAt)
                          : '—'
                      }
                    </div>

                    <button
                      class="btn small"
                      data-action="olive-redownload"
                      data-olive-id="${esc(h.id)}"
                    >
                      ${
                        h.status === '다운로드 완료'
                          ? '다시 다운로드'
                          : '다운로드'
                      }
                    </button>
                  </div>
                `).join('')
              : `
                  <div class="empty">
                    아직 저장된 올리브영 발주 이력이 없습니다.
                  </div>
                `
          }
        </div>
      </div>

    </div>
  `;
}

/* =========================
   발주 달력
   ========================= */

function calendarItemsForDate(iso) {
  const items = [];

  (state.data.sponsor || []).forEach(o => {
    const who =
      o.insta ||
      o.name ||
      '—';

    if (o.dueDate === iso) {
      items.push({
        id: o.id,
        cellClass: '',
        filterKey: 'due',
        cellText: `${who} 발주`,
        who,
        type: '발주 예정',
        meta: `협찬 · ${o.qty || '—'}캔 · ${o.flavorLabel || '—'}${o.eventDate ? ` · 행사 ${shortDate(o.eventDate)}` : ''}`,
        status: o.status || ''
      });
    }

    if (o.eventDate === iso) {
      items.push({
        id: o.id,
        cellClass: 'eventday',
        filterKey: 'eventday',
        cellText: `${who} 행사`,
        who,
        type: '행사일',
        meta: `협찬 · ${o.qty || '—'}캔 · ${o.flavorLabel || '—'}`,
        status: o.status || ''
      });
    }
  });

  (state.data.b2b || []).forEach(o => {
    if (
      o.dueDate === iso &&
      o.status !== '출고 완료'
    ) {
      items.push({
        id: o.id,
        cellClass: '',
        filterKey: 'due',
        cellText: `${o.company || o.name || 'B2B'} 발주`,
        who: o.company || o.name || 'B2B',
        type: 'B2B 발주',
        meta: `${o.qty || '—'}캔 · ${b2bProductText(o)}`,
        status: o.status || ''
      });
    }
  });

  const shipped = [
    ...(state.data.sponsor || [])
      .filter(o => o.status === '발주 완료')
      .map(o => ({ ...o, _kind: '협찬', _class: 'sponsor' })),

    ...(state.data.ambassador || [])
      .filter(o => o.status === '출고 완료')
      .map(o => ({ ...o, _kind: '엠베서더', _class: 'amb' })),

    ...(state.data.event || [])
      .filter(o => o.status === '출고 완료')
      .map(o => ({ ...o, _kind: o.kindLabel || '이벤트', _class: 'event' })),

    ...(state.data.sample || [])
      .filter(o => o.status === '출고 완료')
      .map(o => ({ ...o, _kind: '샘플', _class: 'sample' })),

    ...(state.data.b2b || [])
      .filter(o => o.status === '출고 완료')
      .map(o => ({ ...o, _kind: 'B2B', _class: 'b2b' })),

    ...(state.data.olive || [])
      .filter(o => ['발주 완료','출고 완료'].includes(o.status))
      .map(o => ({ ...o, _kind: '올리브영', _class: 'olive' }))
  ];

  shipped.forEach(o => {
    if (dateTimeIso(o.doneAt) !== iso) {
      return;
    }

    const who =
      (o._kind === '이벤트' || o._kind === '오배송건 재발송')
        ? (
            o.eventTitle ||
            o.insta ||
            o.name ||
            '—'
          )
        : o._kind === 'B2B'
          ? (
              o.company ||
              o.name ||
              '—'
            )
          : (
              o.insta ||
              o.name ||
              '—'
            );

    const qtyMeta =
      o.qty
        ? ` · ${o.qty}캔${o.flavorLabel ? ` · ${o.flavorLabel}` : ''}`
        : '';

    items.push({
      id: o.id,
      cellClass: `shipped ${o._class}`,
      filterKey: o._class,
      cellText: `${o._kind} · ${who}`,
      who,
      type: `${o._kind} 발송 완료`,
      meta: `${o._kind}${qtyMeta}`,
      status: o.status || ''
    });
  });

  const filter = state.calFilter || 'all';

  return filter === 'all'
    ? items
    : items.filter(x => x.filterKey === filter);
}

function calendarSidebarRows(items, iso) {
  if (!items.length) {
    return `
      <div class="empty">
        선택한 날짜의 일정이 없습니다.
      </div>
    `;
  }

  const p = iso.split('-');
  const isToday = iso === todayIso();

  return items.map((item,index) => `
    <div
      class="up-row ${index === 0 ? 'first' : ''}"
      data-open="${esc(item.id)}"
    >
      <div class="datebox ${isToday ? 'hot' : ''}">
        <span class="datebox-month">
          ${Number(p[1])}월
        </span>
        <span class="datebox-day">
          ${Number(p[2])}
        </span>
      </div>

      <div style="min-width:0">
        <div class="up-name">
          ${esc(item.who || '—')}
        </div>

        <div class="up-meta">
          ${esc(item.type)} · ${esc(item.meta || '')}
        </div>

        ${item.status ? badge(item.status) : ''}
      </div>
    </div>
  `).join('');
}

function renderCalendar() {
  const y = state.calYear;
  const m = state.calMonth;

  const first =
    new Date(y,m,1);

  const start =
    new Date(
      y,
      m,
      1 - first.getDay()
    );

  const cells = [];
  const MAX_VISIBLE = 3;

  /* 이번 달을 담는 데 필요한 주 수만 그립니다.
     (항상 6주를 그리면 아래에 빈 줄이 남습니다) */
  const daysInMonth =
    new Date(y, m + 1, 0).getDate();

  const totalCells =
    Math.ceil((first.getDay() + daysInMonth) / 7) * 7;

  for (
    let i = 0;
    i < totalCells;
    i++
  ) {
    const dt =
      new Date(start);

    dt.setDate(
      start.getDate() + i
    );

    const iso =
      `${dt.getFullYear()}-${
        String(
          dt.getMonth() + 1
        ).padStart(2,'0')
      }-${
        String(
          dt.getDate()
        ).padStart(2,'0')
      }`;

    const dayItems =
      calendarItemsForDate(iso);

    const visibleItems =
      dayItems.slice(0,MAX_VISIBLE);

    const moreCount =
      Math.max(
        0,
        dayItems.length - MAX_VISIBLE
      );

    cells.push(`
      <div
        class="
          day
          ${dt.getMonth() !== m ? 'dim' : ''}
          ${iso === todayIso() ? 'today' : ''}
          ${iso === state.calSelectedDate ? 'selected' : ''}
        "
        data-cal-date="${iso}"
      >

        <div class="day-number">
          ${dt.getDate()}
        </div>

        ${
          visibleItems.map(item => `
            <div
              class="cal-event ${item.cellClass}"
              data-open="${esc(item.id)}"
            >
              ${esc(item.cellText)}
            </div>
          `).join('')
        }

        ${
          moreCount
            ? `<div class="cal-more">... +${moreCount}</div>`
            : ''
        }

      </div>
    `);
  }

  const today =
    new Date(
      todayIso() + 'T00:00:00'
    );

  const upcoming =
    (state.data.sponsor || [])
      .filter(o => {
        if (
          !o.dueDate ||
          o.status === '발주 완료'
        ) {
          return false;
        }

        const diff =
          Math.round(
            (
              new Date(
                o.dueDate + 'T00:00:00'
              ) -
              today
            ) /
            86400000
          );

        return (
          diff >= 0 &&
          diff <= 7
        );
      })
      .sort(
        (a,b) =>
          String(a.dueDate)
            .localeCompare(
              String(b.dueDate)
            )
      );

  const selectedIso =
    state.calSelectedDate;

  const selectedItems =
    selectedIso
      ? calendarItemsForDate(selectedIso)
      : [];

  const selectedParts =
    selectedIso
      ? selectedIso.split('-')
      : null;

  return `
    <div class="calendar-wrap">

      <div class="card calendar-card">

        <div class="cal-top">

          <button
            class="cal-arrow"
            data-action="cal-prev"
          >
            ‹
          </button>

          <span class="cal-month">
            ${y}년 ${m + 1}월
          </span>

          <button
            class="cal-arrow"
            data-action="cal-next"
          >
            ›
          </button>

          <button
            class="cal-today-btn"
            data-action="cal-today"
          >
            오늘
          </button>

        </div>

        <div class="cal-body">

        <div class="cal-legend">

          ${
            [
              { group: '',     key: 'all',      label: '전체' },
              { group: '예정', key: 'due',      label: '발주 예정일' },
              { group: '',     key: 'eventday', label: '행사일' },
              { group: '완료', key: 'sponsor',  label: '협찬' },
              { group: '',     key: 'amb',      label: '엠베서더' },
              { group: '',     key: 'event',    label: '이벤트' },
              { group: '',     key: 'sample',   label: '샘플' },
              { group: '',     key: 'b2b',      label: 'B2B' },
              { group: '',     key: 'olive',    label: '올리브영' }
            ].map(f => `
              ${f.group ? `<div class="legend-group">${f.group}</div>` : ''}
              <button
                class="legend-item ${(state.calFilter || 'all') === f.key ? 'on' : ''}"
                data-cal-filter="${f.key}"
              >
                <span class="legend-dot ${f.key}"></span>
                <span>${f.label}</span>
              </button>
            `).join('')
          }

        </div>

        <div class="cal-grid">

          <div class="week">
            ${
              ['일','월','화','수','목','금','토']
                .map(
                  x => `<div>${x}</div>`
                )
                .join('')
            }
          </div>

          <div class="days">
            ${cells.join('')}
          </div>

        </div>
        </div>
      </div>

      ${
        selectedIso
          ? `
            <div class="cal-popup-bg" data-action="cal-close"></div>

            <div class="cal-popup">

              <div class="cal-popup-top">
                <div>
                  <div class="cal-popup-date">
                    ${Number(selectedParts[1])}월 ${Number(selectedParts[2])}일
                  </div>
                  <div class="cal-popup-count">
                    일정 ${selectedItems.length}건
                  </div>
                </div>

                <button class="cal-popup-close" data-action="cal-close">
                  &times;
                </button>
              </div>

              <div class="cal-popup-body">
                ${
                  calendarSidebarRows(
                    selectedItems,
                    selectedIso
                  )
                }
              </div>

            </div>
          `
          : ''
      }
    </div>
  `;
}

/* =========================
   설정 페이지
   ========================= */

function connectionRow(name,status,connected) {
  return `
    <div class="setting-row">

      <strong
        style="
          font-size:13.5px;
        "
      >
        ${esc(name)}
      </strong>

      <span
        class="
          badge-status
          ${
            connected
              ? 'status-done'
              : 'status-wait'
          }
        "
      >
        ${esc(status)}
      </span>

    </div>
  `;
}

function renderSettings() {
  const qtyRules = [
    12,
    24,
    36,
    48,
    96
  ];

  const example =
    new Date(2026,7,20);

  example.setDate(
    example.getDate() -
    Number(state.leadDays || 4)
  );

  const exampleDue =
    `${example.getFullYear()}.${
      String(
        example.getMonth() + 1
      ).padStart(2,'0')
    }.${
      String(
        example.getDate()
      ).padStart(2,'0')
    }`;

  return `
    <div class="settings">

      <!-- 왼쪽 열 -->
      <div class="settings-column">

        <!-- 협찬 발주 기준 -->
        <div class="card setting-card">

          <div class="setting-title">
            협찬 발주 기준
          </div>

          <div class="lead-control">

            <span class="cell">
              행사
            </span>

            <input
              id="leadDaysInput"
              class="lead-input"
              type="number"
              min="0"
              max="30"
              value="${state.leadDays}"
            >

            <span class="cell">
              일 전에 발주
            </span>

          </div>

          <div class="note">
            현재 기준으로 행사 ${state.leadDays}일 전이 발주 예정일입니다.
            예) 행사 2026.08.20 → 발주 예정일 ${exampleDue}
          </div>

        </div>

        <!-- 데이터 연결 -->
        <div class="card setting-card">

          <div class="setting-title">
            데이터 연결
          </div>

          ${connectionRow(
            'Google Spreadsheet',
            '연결됨',
            true
          )}

          ${connectionRow(
            'Google Forms',
            '연결됨',
            true
          )}

          ${connectionRow(
            'ChannelTalk',
            '매크로 운영',
            true
          )}

          ${connectionRow(
            '올리브영 주문서',
            '직접 업로드',
            true
          )}

          ${connectionRow(
            '나인로지스 수동발주서 양식',
            '등록됨',
            true
          )}

        </div>

      </div>

      <!-- 오른쪽 열 -->
      <div class="settings-column">

        <!-- 제공 수량 규칙 -->
        <div class="card setting-card">

          <div class="setting-title">
            제공 수량 규칙
          </div>

          <div class="qty-head">
            <div>총 제공 수량</div>
            <div>사과</div>
            <div>복숭아</div>
          </div>

          ${
            qtyRules.map(
              q => `
                <div class="qty-row">

                  <div style="font-weight:800">
                    ${q}캔
                  </div>

                  <div style="color:#665854">
                    ${q / 2}캔
                  </div>

                  <div style="color:#665854">
                    ${q / 2}캔
                  </div>

                </div>
              `
            ).join('')
          }

          <div
            style="
              padding-top:9px;
              font-size:11.5px;
              color:#8A7A75
            "
          >
            혼합 선택 시 각각 절반씩 자동 계산합니다.
          </div>

        </div>

        <!-- 이지어드민 -->
        <div class="card setting-card">

          <div class="setting-title">
            이지어드민 설정
          </div>

          <div class="setting-row">

            <span class="cell">
              수동발주서 양식
            </span>

            <span
              class="
                badge-status
                status-done
              "
            >
              XLSX 생성 연결됨
            </span>

          </div>

          <div class="note">
            12캔 선물세트 예외,
            24캔 이상 실제 개입수,
            96캔 혼합 수령인 -1/-2 규칙을 적용합니다.
          </div>

        </div>

      </div>

    </div>
  `;
}

/* =========================
   선택
   ========================= */

function allSelected(arr) {
  const selectable =
    arr.filter(
      o => !o.infoMissing
    );

  return (
    selectable.length > 0 &&
    selectable.every(
      o =>
        state.selected.has(o.id)
    )
  );
}

function currentSelectable() {
  if (state.page === 'today') {
    return [
      ...state.data.sponsor.filter(
        o =>
          ['오늘 발주','발주 지연']
            .includes(o.status)
      ),
      ...state.data.ambassador.filter(
        o =>
          o.status === '출고 대기'
      ),
      ...state.data.event.filter(
        o =>
          o.status === '출고 대기'
      ),
      ...(state.data.sample || []).filter(
        o =>
          o.status === '출고 대기'
      ),
      ...(state.data.b2b || []).filter(
        o =>
          ['오늘 발주','발주 지연']
            .includes(o.status)
      )
    ].filter(
      o => !o.infoMissing
    );
  }

  if (state.page === 'sponsor') {
    return sponsorFiltered().filter(
      o => !o.infoMissing
    );
  }

  if (state.page === 'amb') {
    return shippingFiltered('amb').filter(
      o => !o.infoMissing
    );
  }

  if (state.page === 'event') {
    return shippingFiltered('event').filter(
      o => !o.infoMissing
    );
  }

  if (state.page === 'sample') {
    return shippingFiltered('sample').filter(
      o => !o.infoMissing
    );
  }

  if (state.page === 'b2b') {
    return b2bSelectableOrders();
  }

  return [];
}

/* =========================
   데이터 검색
   ========================= */

function findOrder(id) {
  return [
    ...state.data.sponsor,
    ...state.data.ambassador,
    ...state.data.event,
    ...(state.data.sample || []),
    ...(state.data.b2b || []),
    ...(state.data.olive || [])
  ].find(
    o => o.id === id
  ) || null;
}

/* =========================
   상세 Drawer
   ========================= */

function renderDrawer() {
  const root =
    document.getElementById('overlay');

  if (!state.drawer) {
    renderToast();
    return;
  }

  const o =
    findOrder(state.drawer);

  if (!o) {
    state.drawer = null;
    renderToast();
    return;
  }

  const isSponsor =
    o.kind === 'sponsor';

  const isEvent =
    o.kind === 'event';

  const isB2B =
    o.kind === 'b2b';

  const title =
    isB2B
      ? (
          o.company ||
          o.name ||
          'B2B 상세'
        )
      : isEvent
        ? (
            o.eventTitle ||
            '브리보 이벤트'
          )
        : (
            o.insta ||
            o.name ||
            '상세'
          );

  root.innerHTML = `
    <div class="drawer-bg">

      <div
        style="flex:1"
        data-action="close-drawer"
      ></div>

      <div class="drawer">

        <div class="drawer-top">

          <div>

            <div class="drawer-title">
              ${esc(title)}
            </div>

            <div
              style="
                display:flex;
                gap:8px;
                align-items:center;
                margin-top:7px
              "
            >
              ${badge(o.status)}

              ${
                isSponsor
                  ? `
                    <span class="muted">
                      발주 예정일
                      ${fmtDate(o.dueDate)}
                    </span>
                  `
                  : isB2B
                    ? `
                      <span class="muted">
                        신청일 ${fmtDateTime(
                          o.receivedAt ||
                          o.timestamp ||
                          o.receivedDate
                        )} · 당일 발주
                      </span>
                    `
                    : ''
              }
            </div>

          </div>

          <div
            style="
              display:flex;
              gap:7px
            "
          >

            <button
              class="btn small"
              data-action="toggle-edit"
            >
              ${
                state.editing
                  ? '수정 닫기'
                  : '정보 수정'
              }
            </button>

            <button
              class="icon-btn"
              data-action="close-drawer"
            >
              ×
            </button>

          </div>
        </div>

        ${
          state.editing
            ? renderEditForm(o)
            : renderInfoBlocks(o)
        }

        <div class="drawer-block">

          <h4>
            내부 메모
          </h4>

          <textarea
            id="memoField"
            class="field"
            style="margin-top:10px"
            placeholder="내부 메모"
          >${esc(o.memo || '')}</textarea>

          <button
            class="btn small"
            style="margin:9px 0 8px"
            data-action="save-memo"
          >
            메모 저장
          </button>

        </div>

        <div class="drawer-actions">

          ${
            (
              o.status === '발주 완료' ||
              o.status === '출고 완료'
            )
              ? `
                <button
                  class="btn"
                  data-action="cancel-done"
                >
                  완료 취소
                </button>
              `
              : `
                <button
                  class="btn dark"
                  data-action="download-single"
                  ${
                    o.infoMissing
                      ? 'disabled'
                      : ''
                  }
                >
                  수동발주서 다운로드
                </button>
              `
          }

          <button
            class="btn"
            data-action="toggle-hold"
          >
            ${
              o.hold
                ? '보류 해제'
                : '보류'
            }
          </button>

        </div>

      </div>
    </div>
  `;
}

function renderInfoBlocks(o) {
  const isSponsor =
    o.kind === 'sponsor';

  const isEvent =
    o.kind === 'event';

  const isB2B =
    o.kind === 'b2b';

  const isManual =
    o.source === 'manual';

  const who = `
    <div class="drawer-block">

      <h4>
        ${
          isEvent
            ? '당첨자 정보'
            : '수령 정보'
        }
      </h4>

      ${
        !isManual && !isB2B
          ? info('인스타그램',o.insta || '—')
          : ''
      }

      ${
        isEvent
          ? info(
              '이벤트명',
              o.eventTitle ||
              '브리보 이벤트'
            )
          : ''
      }

      ${
        isB2B
          ? info(
              '거래처명',
              o.company || '미입력'
            )
          : ''
      }

      ${
        isB2B
          ? info(
              '지점',
              o.branch || '미입력'
            )
          : ''
      }

      ${info('수령인',o.name || '미입력')}
      ${info('연락처',o.phone || '미입력')}
      ${info('수령 주소',o.addr || '미입력')}

    </div>
  `;

  const schedule =
    isB2B
      ? `
        <div class="drawer-block">

          <h4>
            진행 정보
          </h4>

          ${info(
            '신청일',
            fmtDateTime(
              o.receivedAt ||
              o.timestamp ||
              o.receivedDate
            )
          )}

          ${info(
            '발주 기준',
            '신청일 당일 발주'
          )}

          ${info(
            '접수 경로',
            isManual
              ? '수동 발주'
              : 'B2B 신청폼'
          )}

        </div>
      `
      : isManual
        ? `
          <div class="drawer-block">

            <h4>
              등록 정보
            </h4>

            ${info(
              '접수일',
              fmtDate(o.receivedDate)
            )}

            ${info(
              '등록 방식',
              '수동 발주'
            )}

            ${info(
              '처리 기준',
              isSponsor
                ? '등록 즉시 발주'
                : '등록 후 출고'
            )}

          </div>
        `
        : isSponsor
          ? `
            <div class="drawer-block">

              <h4>
                행사 정보
              </h4>

              ${info(
                '행사 날짜',
                fmtDate(o.eventDate)
              )}

              ${info(
                '발주 예정일',
                fmtDate(o.dueDate)
              )}

              ${info(
                '접수 경로',
                '구글폼'
              )}

            </div>
          `
          : `
            <div class="drawer-block">

              <h4>
                진행 정보
              </h4>

              ${info(
                '접수일',
                fmtDate(o.receivedDate)
              )}

              ${info(
                '출고 기준',
                '폼 접수 후 출고'
              )}

            </div>
          `;

  const product = `
    <div class="drawer-block">

      <h4>
        제품 정보
      </h4>

      ${info(
        '총 제공 수량',
        isB2B
          ? b2bQtyText(o)
          : o.qty + '캔'
      )}

      ${
        isB2B
          ? info(
              'B2B 제품',
              b2bProductText(o)
            )
          : info(
              '맛 구성',
              o.flavorLabel ||
              '미입력'
            )
      }

      ${info(
        '실제 구성',
        `사과 ${o.appleQty}캔 · 복숭아 ${o.peachQty}캔`
      )}

    </div>
  `;

  return (
    who +
    schedule +
    product +
    `
      <div
        class="muted"
        style="margin-top:12px"
      >
        수동발주서를 내려받으면
        자동으로 완료 처리됩니다.
      </div>
    `
  );
}

function info(k,v) {
  return `
    <div class="info-row">

      <div class="info-key">
        ${esc(k)}
      </div>

      <div class="info-val">
        ${esc(v)}
      </div>

    </div>
  `;
}

/* =========================
   정보 수정
   ========================= */

function renderEditForm(o) {
  const sponsor =
    o.kind === 'sponsor';

  const event =
    o.kind === 'event';

  const sample =
    o.kind === 'sample';

  const b2b =
    o.kind === 'b2b';

  const manual =
    o.source === 'manual';

  const qtyOpts =
    sample
      ? [12]
      : b2b
        ? [24,48]
        : manual
          ? [6,12,24,36,48,96]
          : sponsor
            ? [12,24,36,48,96]
            : [o.qty];

  const flavors =
    sample
      ? [
          ['mix','사과+복숭아']
        ]
      : b2b
        ? [
            ['mix','사과+복숭아'],
            ['apple','사과'],
            ['peach','복숭아']
          ]
        : manual
        ? (
            Number(o.qty) === 6
              ? [
                  ['apple','사과'],
                  ['peach','복숭아']
                ]
              : [
                  ['mix','사과+복숭아'],
                  ['apple','사과'],
                  ['peach','복숭아']
                ]
          )
        : event
          ? [
              ['apple','사과'],
              ['peach','복숭아']
            ]
          : [
              ['mix','사과+복숭아'],
              ['apple','사과'],
              ['peach','복숭아']
            ];

  return `
    <div class="drawer-block">

      <h4
        style="
          font-size:16px;
          color:var(--ink)
        "
      >
        정보 수정
      </h4>

      ${
        b2b
          ? ''
          : field(
              'editInsta',
              '인스타그램',
              o.insta || ''
            )
      }

      ${
        event
          ? field(
              'editEventTitle',
              '이벤트명',
              o.eventTitle ||
              '브리보 이벤트'
            )
          : ''
      }

      ${field(
        'editName',
        '수령인',
        o.name || ''
      )}

      ${field(
        'editPhone',
        '연락처',
        o.phone || ''
      )}

      ${field(
        'editAddr',
        '주소',
        o.addr || ''
      )}

      ${
        sponsor && !manual
          ? field(
              'editEventDate',
              '행사 날짜',
              o.eventDate || '',
              'date'
            )
          : ''
      }

      <div class="form-row">

        <label>
          제공 수량
        </label>

        <div class="option-row">

          ${
            qtyOpts.map(
              q => `
                <button
                  type="button"
                  class="
                    pill
                    ${
                      Number(o.qty) === q
                        ? 'active'
                        : ''
                    }
                  "
                  data-edit-qty="${q}"
                  ${
                    (!sponsor && !manual) || sample
                      ? 'disabled'
                      : ''
                  }
                >
                  ${q}캔
                </button>
              `
            ).join('')
          }

        </div>
      </div>

      <div class="form-row">

        <label>
          맛 구성
        </label>

        <div class="option-row">

          ${
            flavors.map(
              ([k,l]) => `
                <button
                  type="button"
                  class="
                    pill
                    ${
                      o.flavor === k
                        ? 'active'
                        : ''
                    }
                  "
                  data-edit-flavor="${k}"
                  ${
                    sample ||
                    (b2b && !manual) ||
                    (
                      b2b &&
                      Number(o.qty) === 24 &&
                      k === 'mix'
                    )
                      ? 'disabled'
                      : ''
                  }
                >
                  ${l}
                </button>
              `
            ).join('')
          }

        </div>
      </div>

      <div class="drawer-actions">

        <button
          class="btn dark"
          data-action="save-edit"
        >
          저장
        </button>

        <button
          class="btn"
          data-action="toggle-edit"
        >
          취소
        </button>

      </div>
    </div>
  `;
}

function field(id,label,val,type = 'text') {
  return `
    <div class="form-row">

      <label for="${id}">
        ${label}
      </label>

      <input
        id="${id}"
        type="${type}"
        class="field"
        value="${esc(val)}"
      >

    </div>
  `;
}

/* =========================
   XLSX
   ========================= */

function easyAdminBase64ToBytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

function easyAdminXmlEscape(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function easyAdminColumnName(index) {
  let n = index + 1;
  let result = '';

  while (n > 0) {
    const rem = (n - 1) % 26;
    result =
      String.fromCharCode(65 + rem) +
      result;
    n = Math.floor((n - 1) / 26);
  }

  return result;
}

function easyAdminCellXml(ref, value) {
  if (
    value === undefined ||
    value === null ||
    value === ''
  ) {
    return '';
  }

  if (
    typeof value === 'number' &&
    Number.isFinite(value)
  ) {
    return `<c r="${ref}"><v>${value}</v></c>`;
  }

  const text =
    easyAdminXmlEscape(value);

  return (
    `<c r="${ref}" t="inlineStr">` +
      `<is><t xml:space="preserve">${text}</t></is>` +
    `</c>`
  );
}

function easyAdminBuildSheetXml(originalXml, rows) {
  const row1Match =
    originalXml.match(
      /<row\b[^>]*\br="1"[^>]*>[\s\S]*?<\/row>/
    );

  if (!row1Match) {
    throw new Error(
      '이지어드민 원본 양식의 1행을 찾을 수 없습니다.'
    );
  }

  const dataRows =
    rows.map((row, rowIndex) => {
      const excelRow =
        rowIndex + 2;

      const cells =
        EASY_HEADERS
          .map((header, colIndex) => {
            const ref =
              easyAdminColumnName(colIndex) +
              excelRow;

            return easyAdminCellXml(
              ref,
              row[header]
            );
          })
          .join('');

      return (
        `<row r="${excelRow}" spans="1:14" ` +
        `ht="16.5" customHeight="1">` +
        cells +
        `</row>`
      );
    })
    .join('');

  const newSheetData =
    `<sheetData>` +
    row1Match[0] +
    dataRows +
    `</sheetData>`;

  let updated =
    originalXml.replace(
      /<sheetData>[\s\S]*?<\/sheetData>/,
      newSheetData
    );

  const lastRow =
    Math.max(1, rows.length + 1);

  updated =
    updated.replace(
      /<dimension ref="[^"]*"\/>/,
      `<dimension ref="A1:N${lastRow}"/>`
    );

  return updated;
}

async function easyAdminBuildTemplateBlob(rows) {
  if (typeof JSZip === 'undefined') {
    throw new Error(
      '엑셀 원본 양식을 처리하는 기능을 불러오지 못했습니다. 페이지를 새로고침한 뒤 다시 시도해주세요.'
    );
  }

  const zip =
    await JSZip.loadAsync(
      easyAdminBase64ToBytes(
        EASY_TEMPLATE_BASE64
      )
    );

  const sheetPath =
    'xl/worksheets/sheet1.xml';

  const sheetFile =
    zip.file(sheetPath);

  if (!sheetFile) {
    throw new Error(
      '이지어드민 원본 양식의 택배양식 시트를 찾을 수 없습니다.'
    );
  }

  const originalXml =
    await sheetFile.async('string');

  const updatedXml =
    easyAdminBuildSheetXml(
      originalXml,
      rows
    );

  // 원본 XLSX의 다른 파일(스타일, 글꼴, 테두리 등)은 그대로 두고
  // 택배양식의 2행 이후 데이터만 교체합니다.
  zip.file(
    sheetPath,
    updatedXml
  );

  return zip.generateAsync({
    type: 'blob',
    mimeType:
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    compression: 'DEFLATE'
  });
}

function easyAdminDateStamp() {
  const digits =
    String(
      state.data?.today || ''
    ).replace(/\D/g, '');

  if (digits.length >= 8) {
    return digits.slice(2, 8);
  }

  const d =
    new Date();

  const yy =
    String(d.getFullYear())
      .slice(-2);

  const mm =
    String(d.getMonth() + 1)
      .padStart(2, '0');

  const dd =
    String(d.getDate())
      .padStart(2, '0');

  return yy + mm + dd;
}

function oliveCurrentDateStamp() {
  const parts =
    new Intl.DateTimeFormat(
      'en-US',
      {
        timeZone: 'Asia/Seoul',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }
    )
      .formatToParts(new Date())
      .reduce((acc,part) => {
        acc[part.type] = part.value;
        return acc;
      },{});

  return (
    String(parts.year || '').slice(-2) +
    String(parts.month || '').padStart(2,'0') +
    String(parts.day || '').padStart(2,'0')
  );
}

function easyAdminDownloadBlob(blob, fileName) {
  const url =
    URL.createObjectURL(blob);

  const a =
    document.createElement('a');

  a.href = url;
  a.download = fileName;
  a.style.display = 'none';

  document.body.appendChild(a);
  a.click();
  a.remove();

  setTimeout(
    () => URL.revokeObjectURL(url),
    1000
  );
}




/* =========================
   출고 요청서 XLSX 생성 / Drive 저장 / 다운로드
   ========================= */

function shipmentXmlEscape(value) {
  return String(value ?? '')
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&apos;');
}

function shipmentInlineCellXml(ref, styleId, value) {
  return (
    `<c r="${ref}" s="${styleId}" t="inlineStr">` +
      `<is><t xml:space="preserve">${shipmentXmlEscape(value)}</t></is>` +
    `</c>`
  );
}

function shipmentNumberCellXml(ref, styleId, value) {
  const n = Number(value);

  return (
    `<c r="${ref}" s="${styleId}">` +
      `<v>${Number.isFinite(n) ? n : 0}</v>` +
    `</c>`
  );
}

function shipmentRowXml(sheetXml, rowNumber) {
  const re = new RegExp(
    `<row\\b[^>]*\\br="${rowNumber}"[^>]*>[\\s\\S]*?<\\/row>`
  );

  const match = sheetXml.match(re);

  if (!match) {
    throw new Error(
      `출고 요청서 원본 양식의 ${rowNumber}행을 찾을 수 없습니다.`
    );
  }

  return match[0];
}

function shipmentShiftRowXml(rowXml, newRow) {
  const oldMatch =
    rowXml.match(/<row\b[^>]*\br="(\d+)"/);

  if (!oldMatch) {
    return rowXml;
  }

  const oldRow = oldMatch[1];

  let out =
    rowXml.replace(
      new RegExp(`(<row\\b[^>]*\\br=")${oldRow}("[^>]*>)`),
      `$1${newRow}$2`
    );

  out = out.replace(
    new RegExp(`r="([A-Z]+)${oldRow}"`,'g'),
    `r="$1${newRow}"`
  );

  return out;
}

function shipmentCellStyleId(rowXml, ref, fallback) {
  const re = new RegExp(
    `<c\\b[^>]*\\br="${ref}"[^>]*\\bs="(\\d+)"`
  );

  const match = rowXml.match(re);

  return match
    ? Number(match[1])
    : Number(fallback || 0);
}

function shipmentReplaceCell(rowXml, ref, cellXml) {
  const re = new RegExp(
    `<c\\b(?=[^>]*\\br="${ref}"(?:\\s|\\/?>))[^>]*\\/>|` +
    `<c\\b(?=[^>]*\\br="${ref}"(?:\\s|\\/?>))[^>]*>[\\s\\S]*?<\\/c>`
  );

  if (re.test(rowXml)) {
    return rowXml.replace(re, cellXml);
  }

  return rowXml.replace(
    /<\/row>/,
    `${cellXml}</row>`
  );
}

function shipmentSetStringCell(rowXml, ref, value, fallbackStyle) {
  const style =
    shipmentCellStyleId(
      rowXml,
      ref,
      fallbackStyle
    );

  return shipmentReplaceCell(
    rowXml,
    ref,
    shipmentInlineCellXml(
      ref,
      style,
      value
    )
  );
}

function shipmentSetNumberCell(rowXml, ref, value, fallbackStyle) {
  const style =
    shipmentCellStyleId(
      rowXml,
      ref,
      fallbackStyle
    );

  return shipmentReplaceCell(
    rowXml,
    ref,
    shipmentNumberCellXml(
      ref,
      style,
      value
    )
  );
}

function shipmentSetCellStyle(rowXml, ref, styleId) {
  const re = new RegExp(
    `(<c\\b[^>]*\\br="${ref}"[^>]*\\bs=")\\d+("[^>]*>)`
  );

  return rowXml.replace(
    re,
    `$1${styleId}$2`
  );
}

function shipmentExcelSerial(isoDate) {
  const parts =
    String(isoDate || '')
      .split('-')
      .map(Number);

  if (
    parts.length !== 3 ||
    !parts[0] ||
    !parts[1] ||
    !parts[2]
  ) {
    return 0;
  }

  const utc =
    Date.UTC(
      parts[0],
      parts[1] - 1,
      parts[2]
    );

  return (
    utc / 86400000 +
    25569
  );
}

function shipmentPrepareTransportStyles(stylesXml) {
  const match =
    stylesXml.match(
      /<cellXfs\b([^>]*)>([\s\S]*?)<\/cellXfs>/
    );

  if (!match) {
    throw new Error(
      '출고 요청서 원본 양식의 스타일 정보를 찾을 수 없습니다.'
    );
  }

  const xfs =
    match[2].match(
      /<xf\b[^>]*(?:\/>|>[\s\S]*?<\/xf>)/g
    ) || [];

  if (
    !xfs[33] ||
    !xfs[35]
  ) {
    throw new Error(
      '출고 요청서 운송수단 스타일 정보를 찾을 수 없습니다.'
    );
  }

  const yellowSimple =
    xfs[33]
      .replace(/fillId="\d+"/,'fillId="4"')
      .replace(
        /<xf\b/,
        '<xf applyFill="1"'
      );

  const otherWhite =
    xfs[35]
      .replace(/fillId="\d+"/,'fillId="0"');

  const yellowStyleId = xfs.length;
  const otherWhiteStyleId = xfs.length + 1;

  let openTag =
    `<cellXfs${match[1]}>`;

  if (/count="\d+"/.test(openTag)) {
    openTag =
      openTag.replace(
        /count="\d+"/,
        `count="${xfs.length + 2}"`
      );
  } else {
    openTag =
      openTag.replace(
        />$/,
        ` count="${xfs.length + 2}">`
      );
  }

  const replacement =
    openTag +
    match[2] +
    yellowSimple +
    otherWhite +
    '</cellXfs>';

  return {
    xml:
      stylesXml.replace(
        match[0],
        replacement
      ),
    yellowStyleId,
    otherWhiteStyleId
  };
}

function shipmentBuildSheet1Xml(
  originalXml,
  draft,
  styles
) {
  const rows = {};

  for (let i = 1; i <= 18; i++) {
    rows[i] =
      shipmentRowXml(
        originalXml,
        i
      );
  }

  // 기존 1~10행은 그대로 두고 값만 교체합니다.
  rows[5] =
    shipmentSetNumberCell(
      rows[5],
      'B5',
      shipmentExcelSerial(draft.shipDate),
      25
    );

  rows[5] =
    shipmentSetNumberCell(
      rows[5],
      'E5',
      shipmentExcelSerial(draft.arrivalDate),
      25
    );

  rows[8] =
    shipmentSetStringCell(
      rows[8],
      'B8',
      draft.company,
      40
    );

  rows[9] =
    shipmentSetStringCell(
      rows[9],
      'B9',
      draft.address,
      40
    );

  rows[10] =
    shipmentSetStringCell(
      rows[10],
      'B10',
      draft.phone,
      40
    );

  // 운송수단은 선택된 칸만 노란색으로 표시합니다.
  rows[6] = shipmentSetStringCell(rows[6],'B6','택배',33);
  rows[6] = shipmentSetStringCell(rows[6],'C6','화물',33);
  rows[6] = shipmentSetStringCell(rows[6],'D6','자차',33);
  rows[6] = shipmentSetStringCell(
    rows[6],
    'E6',
    draft.transport === 'other'
      ? `기타: ${draft.transportOther || ''}`
      : '기타:',
    35
  );

  rows[6] = shipmentSetCellStyle(rows[6],'B6',33);
  rows[6] = shipmentSetCellStyle(rows[6],'C6',33);
  rows[6] = shipmentSetCellStyle(rows[6],'D6',33);
  rows[6] = shipmentSetCellStyle(
    rows[6],
    'E6',
    styles.otherWhiteStyleId
  );

  if (draft.transport === 'parcel') {
    rows[6] = shipmentSetCellStyle(rows[6],'B6',styles.yellowStyleId);
  } else if (draft.transport === 'freight') {
    rows[6] = shipmentSetCellStyle(rows[6],'C6',styles.yellowStyleId);
  } else if (draft.transport === 'car') {
    rows[6] = shipmentSetCellStyle(rows[6],'D6',styles.yellowStyleId);
  } else if (draft.transport === 'other') {
    rows[6] = shipmentSetCellStyle(rows[6],'E6',35);
  }

  // 연락처 아래 팔레트 행을 추가합니다.
  let row11 =
    shipmentShiftRowXml(
      rows[10],
      11
    );

  row11 = shipmentSetStringCell(row11,'A11','팔레트',42);
  row11 = shipmentSetNumberCell(row11,'B11',Number(draft.pallet || 0),40);
  ['C11','D11','E11','F11'].forEach(ref => {
    row11 = shipmentSetStringCell(row11,ref,'',41);
  });

  // 출고품목 영역을 한 행씩 아래로 이동하고 최대 4개 상품 행을 확보합니다.
  let row12 = shipmentShiftRowXml(rows[11],12);
  let row13 = shipmentShiftRowXml(rows[12],13);
  let row14 = shipmentShiftRowXml(rows[13],14);
  let row15 = shipmentShiftRowXml(rows[14],15);
  let row16 = shipmentShiftRowXml(rows[14],16);
  let row17 = shipmentShiftRowXml(rows[14],17);
  let row18 = shipmentShiftRowXml(rows[15],18);
  const row19 = shipmentShiftRowXml(rows[16],19);
  const row20 = shipmentShiftRowXml(rows[17],20);
  const row21 = shipmentShiftRowXml(rows[18],21);

  row13 = shipmentSetStringCell(row13,'D13','수량(낱개)',28);
  row13 = shipmentSetStringCell(row13,'E13','기타요청사항',28);
  row13 = shipmentSetStringCell(row13,'F13','',28);

  const productRows = [row14,row15,row16,row17];

  const selectedProducts =
    (draft.products || [])
      .filter(item => Number(item.cartons || 0) > 0)
      .slice(0,4);

  let totalCartons = 0;
  let totalLoose = 0;

  for (let i = 0; i < 4; i++) {
    let row = productRows[i];
    const excelRow = 14 + i;
    const item = selectedProducts[i];

    ['A','B','C','D','E','F'].forEach(col => {
      row = shipmentSetStringCell(
        row,
        `${col}${excelRow}`,
        '',
        col === 'A' ? 11 : 21
      );
    });

    if (item) {
      const cartons = Number(item.cartons || 0);
      const option = Number(item.option || 0);
      const loose = option * cartons;

      totalCartons += cartons;
      totalLoose += loose;

      row = shipmentSetStringCell(row,`A${excelRow}`,shipmentExcelProductName(item),11);
      row = shipmentSetNumberCell(row,`B${excelRow}`,option,11);
      row = shipmentSetNumberCell(row,`C${excelRow}`,cartons,11);
      row = shipmentSetNumberCell(row,`D${excelRow}`,loose,21);
    }

    productRows[i] = row;
  }

  productRows[0] =
    shipmentSetStringCell(
      productRows[0],
      'E14',
      draft.requestNote || '',
      44
    );

  row18 = shipmentSetStringCell(row18,'A18','합 계',46);
  row18 = shipmentSetStringCell(row18,'B18','',27);
  row18 = shipmentSetNumberCell(row18,'C18',totalCartons,47);
  row18 = shipmentSetNumberCell(row18,'D18',totalLoose,47);
  row18 = shipmentSetStringCell(row18,'E18','',47);
  row18 = shipmentSetStringCell(row18,'F18','',21);

  const newSheetData =
    '<sheetData>' +
      [
        rows[1],rows[2],rows[3],rows[4],rows[5],
        rows[6],rows[7],rows[8],rows[9],rows[10],
        row11,row12,row13,
        ...productRows,
        row18,row19,row20,row21
      ].join('') +
    '</sheetData>';

  let updated =
    originalXml.replace(
      /<sheetData>[\s\S]*?<\/sheetData>/,
      newSheetData
    );

  const merges = [
    'A1:F2',
    'E3:F3',
    'A4:F4',
    'B5:C5',
    'E5:F5',
    'E6:F6',
    'A7:F7',
    'B8:F8',
    'B9:F9',
    'B10:F10',
    'B11:F11',
    'A12:F12',
    'E13:F13',
    'E14:F17',
    'A18:B18',
    'E18:F18',
    'A19:B21',
    'C19:F21'
  ];

  const mergeXml =
    `<mergeCells count="${merges.length}">` +
      merges
        .map(ref => `<mergeCell ref="${ref}"/>`)
        .join('') +
    '</mergeCells>';

  if (/<mergeCells\b[\s\S]*?<\/mergeCells>/.test(updated)) {
    updated = updated.replace(
      /<mergeCells\b[\s\S]*?<\/mergeCells>/,
      mergeXml
    );
  } else {
    updated = updated.replace(
      /<\/worksheet>/,
      `${mergeXml}</worksheet>`
    );
  }

  return updated;
}

function shipmentBuildSheet2Xml(originalXml, draft) {
  const active =
    (draft.products || [])
      .map((item,index) => ({ item,index }))
      .filter(({item}) => Number(item?.cartons || 0) > 0);

  const templateRow =
    shipmentRowXml(
      originalXml,
      4
    );

  let updated = originalXml;

  for (let i = 0; i < 4; i++) {
    const excelRow = 4 + i;
    const entry = active[i];

    let row =
      shipmentShiftRowXml(
        templateRow,
        excelRow
      );

    if (entry) {
      const item = entry.item;

      row = shipmentSetNumberCell(
        row,
        `A${excelRow}`,
        i + 1,
        9
      );
      row = shipmentSetStringCell(
        row,
        `B${excelRow}`,
        shipmentExcelProductName(item),
        11
      );
      row = shipmentSetStringCell(
        row,
        `C${excelRow}`,
        `${Number(item.option || 0)}개입`,
        13
      );
      row = shipmentSetNumberCell(
        row,
        `D${excelRow}`,
        shipmentProductLoose(item),
        14
      );
      row = shipmentSetStringCell(
        row,
        `E${excelRow}`,
        String(item.workDoneDate || '').trim(),
        15
      );
      row = shipmentSetStringCell(
        row,
        `F${excelRow}`,
        String(item.workContent || '').trim(),
        17
      );
    } else {
      row = shipmentSetStringCell(row,`A${excelRow}`,'',9);
      row = shipmentSetStringCell(row,`B${excelRow}`,'',11);
      row = shipmentSetStringCell(row,`C${excelRow}`,'',13);
      row = shipmentSetStringCell(row,`D${excelRow}`,'',14);
      row = shipmentSetStringCell(row,`E${excelRow}`,'',15);
      row = shipmentSetStringCell(row,`F${excelRow}`,'',17);
    }

    const rowPattern =
      new RegExp(
        `<row\\b(?=[^>]*\\br="${excelRow}"(?:\\s|\\/?>))[^>]*(?:\\/>|>[\\s\\S]*?<\\/row>)`
      );

    if (rowPattern.test(updated)) {
      updated = updated.replace(
        rowPattern,
        row
      );
    } else {
      updated = updated.replace(
        /<\/sheetData>/,
        `${row}</sheetData>`
      );
    }
  }

  return updated;
}

async function shipmentBuildWorkbookBlob(draft) {
  if (typeof JSZip === 'undefined') {
    throw new Error(
      '출고 요청서 엑셀 처리 기능을 불러오지 못했습니다. 페이지를 새로고침한 뒤 다시 시도해주세요.'
    );
  }

  const zip =
    await JSZip.loadAsync(
      easyAdminBase64ToBytes(
        SHIPMENT_REQUEST_TEMPLATE_BASE64
      )
    );

  const sheet1File =
    zip.file('xl/worksheets/sheet1.xml');

  const sheet2File =
    zip.file('xl/worksheets/sheet2.xml');

  const stylesFile =
    zip.file('xl/styles.xml');

  if (
    !sheet1File ||
    !sheet2File ||
    !stylesFile
  ) {
    throw new Error(
      '출고 요청서 원본 XLSX 구조를 확인하지 못했습니다.'
    );
  }

  const [sheet1Xml,sheet2Xml,stylesXml] =
    await Promise.all([
      sheet1File.async('string'),
      sheet2File.async('string'),
      stylesFile.async('string')
    ]);

  const styles =
    shipmentPrepareTransportStyles(
      stylesXml
    );

  zip.file(
    'xl/styles.xml',
    styles.xml
  );

  zip.file(
    'xl/worksheets/sheet1.xml',
    shipmentBuildSheet1Xml(
      sheet1Xml,
      draft,
      styles
    )
  );

  zip.file(
    'xl/worksheets/sheet2.xml',
    shipmentBuildSheet2Xml(
      sheet2Xml,
      draft
    )
  );

  return zip.generateAsync({
    type: 'blob',
    mimeType:
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    compression: 'DEFLATE'
  });
}

async function shipmentBlobToBase64(blob) {
  const bytes =
    new Uint8Array(
      await blob.arrayBuffer()
    );

  let binary = '';
  const chunk = 0x8000;

  for (
    let i = 0;
    i < bytes.length;
    i += chunk
  ) {
    binary +=
      String.fromCharCode(
        ...bytes.subarray(
          i,
          Math.min(i + chunk, bytes.length)
        )
      );
  }

  return btoa(binary);
}

function inboundDateTimeText(draft) {
  const p = shipmentDateParts(draft.inboundDate);
  const period = draft.timePeriod === 'PM' ? '오후' : '오전';
  const hour = Number(draft.timeHour || 0);
  const minute = String(draft.timeMinute || '00').padStart(2,'0');

  return `${p.year}년 ${p.month}월 ${p.day}일 / ${period} ${hour}시 ${minute}분`;
}

function inboundCloneXfWithFill(xf, fillId) {
  let out = String(xf || '')
    .replace(/\sapplyFill="\d+"/g, '')
    .replace(/fillId="\d+"/, `fillId="${fillId}"`);

  return out.replace(/<xf\b/, '<xf applyFill="1"');
}

function inboundPrepareTransportStyles(stylesXml, inboundKind) {
  const match = stylesXml.match(
    /<cellXfs\b([^>]*)>([\s\S]*?)<\/cellXfs>/
  );

  if (!match) {
    throw new Error('입고 요청서의 스타일 정보를 찾지 못했습니다.');
  }

  const xfs = match[2].match(
    /<xf\b[^>]*(?:\/>|>[\s\S]*?<\/xf>)/g
  ) || [];

  const sourceStyles = inboundKind === 'beverage'
    ? { C7: 9, D7: 15, E7: 16, F7: 18 }
    : { C7: 69, D7: 70, E7: 62, F7: 63 };

  const added = [];
  const white = {};
  const yellow = {};

  Object.entries(sourceStyles).forEach(([ref,styleId]) => {
    if (!xfs[styleId]) {
      throw new Error('입고 요청서의 운송수단 서식을 찾지 못했습니다.');
    }

    white[ref] = xfs.length + added.length;
    added.push(inboundCloneXfWithFill(xfs[styleId], 0));
    yellow[ref] = xfs.length + added.length;
    added.push(inboundCloneXfWithFill(xfs[styleId], 3));
  });

  let openTag = `<cellXfs${match[1]}>`;
  const nextCount = xfs.length + added.length;

  if (/count="\d+"/.test(openTag)) {
    openTag = openTag.replace(/count="\d+"/, `count="${nextCount}"`);
  } else {
    openTag = openTag.replace(/>$/, ` count="${nextCount}">`);
  }

  return {
    xml: stylesXml.replace(
      match[0],
      openTag + match[2] + added.join('') + '</cellXfs>'
    ),
    white,
    yellow
  };
}

function inboundValueOrDash(value) {
  return String(value ?? '').trim() === '' ? '-' : String(value).trim();
}

function inboundPalletTotal(draft) {
  const pallets = inboundActiveProducts().map(({item}) => item.pallets).filter(value => String(value || '').trim());
  const numericTotal = pallets.reduce((sum,value) => sum + (value === 'combined' ? 0 : Number(value || 0)),0);
  return numericTotal + (pallets.includes('combined') ? 1 : 0);
}

function inboundBuildMaterialSheet1Xml(originalXml, draft, styles) {
  const rows = {};
  for (let i = 1; i <= 19; i++) {
    rows[i] = shipmentRowXml(originalXml, i);
  }

  rows[6] = shipmentSetStringCell(
    rows[6],
    'B6',
    inboundDateTimeText(draft),
    8
  );
  rows[5] = shipmentSetStringCell(rows[5],'B5','ex. 나인로지스',52);
  rows[10] = shipmentSetStringCell(rows[10],'D10','수량',7);

  rows[7] = shipmentSetStringCell(rows[7],'C7','택배',69);
  rows[7] = shipmentSetStringCell(rows[7],'D7','화물',70);
  rows[7] = shipmentSetStringCell(rows[7],'E7','자차',62);
  rows[7] = shipmentSetStringCell(
    rows[7],
    'F7',
    draft.transport === 'other'
      ? `기타: ${String(draft.transportOther || '').trim()}`
      : '기타:',
    63
  );

  ['C7','D7','E7','F7'].forEach(ref => {
    rows[7] = shipmentSetCellStyle(rows[7], ref, styles.white[ref]);
  });

  const selectedRef = {
    parcel: 'C7',
    freight: 'D7',
    car: 'E7',
    other: 'F7'
  }[draft.transport];

  if (selectedRef) {
    rows[7] = shipmentSetCellStyle(rows[7], selectedRef, styles.yellow[selectedRef]);
  }

  const active = inboundActiveProducts().map(entry => entry.item).slice(0,6);

  for (let i = 0; i < 6; i++) {
    const rowNumber = 11 + i;
    let row = rows[rowNumber];
    const item = active[i];

    ['A','B','C','D','E','F','G'].forEach(col => {
      row = shipmentSetStringCell(
        row,
        `${col}${rowNumber}`,
        '-',
        col === 'A' ? 3 : col === 'G' ? 33 : 2
      );
    });

    if (item) {
      row = shipmentSetStringCell(row,`A${rowNumber}`,inboundValueOrDash(item.productName),3);
      row = shipmentSetStringCell(row,`B${rowNumber}`,inboundValueOrDash(item.optionName),2);
      row = shipmentSetStringCell(row,`C${rowNumber}`,inboundValueOrDash(item.manufactureDate),2);

      if (String(item.looseQty).trim() !== '') {
        row = shipmentSetNumberCell(row,`D${rowNumber}`,Number(item.looseQty),34);
      }
      if (String(item.cartons).trim() !== '') {
        row = shipmentSetNumberCell(row,`E${rowNumber}`,Number(item.cartons),2);
      }
      if (String(item.pallets).trim() !== '') {
        const palletNumber = Number(item.pallets);
        row = Number.isFinite(palletNumber) && String(item.pallets).trim() !== ''
          ? shipmentSetNumberCell(row,`F${rowNumber}`,palletNumber,2)
          : shipmentSetStringCell(row,`F${rowNumber}`,inboundValueOrDash(item.pallets),2);
      }
      row = shipmentSetStringCell(row,`G${rowNumber}`,inboundValueOrDash(item.barcode),33);
    }

    rows[rowNumber] = row;
  }

  return originalXml.replace(
    /<sheetData>[\s\S]*?<\/sheetData>/,
    '<sheetData>' +
      Array.from({ length: 19 }, (_,i) => rows[i + 1]).join('') +
    '</sheetData>'
  );
}

function inboundBuildMaterialSheet2Xml(originalXml, draft) {
  const active = inboundActiveProducts().map(entry => entry.item).slice(0,6);
  const templateRow = shipmentRowXml(originalXml, 4);
  let updated = originalXml;
  const header = shipmentSetStringCell(shipmentRowXml(updated,3),'D3','수량',19);
  updated = updated.replace(/<row\b(?=[^>]*\br="3"(?:\s|\/?>))[^>]*(?:\/>|>[\s\S]*?<\/row>)/,header);

  for (let i = 0; i < 6; i++) {
    const excelRow = 4 + i;
    const item = active[i];
    let row;

    try {
      row = shipmentRowXml(originalXml, excelRow);
    } catch (e) {
      row = shipmentShiftRowXml(templateRow, excelRow);
    }

    if (item) {
      row = shipmentSetNumberCell(row,`A${excelRow}`,i + 1,28);
      row = shipmentSetStringCell(row,`B${excelRow}`,item.productName,11);
      row = shipmentSetStringCell(row,`C${excelRow}`,item.optionName,13);
      row = shipmentSetNumberCell(row,`D${excelRow}`,Number(item.looseQty || 0),14);
      row = shipmentSetStringCell(row,`E${excelRow}`,item.workDoneDate,15);
      row = shipmentSetStringCell(row,`F${excelRow}`,item.workContent,17);
    } else {
      row = shipmentSetStringCell(row,`A${excelRow}`,'',28);
      row = shipmentSetStringCell(row,`B${excelRow}`,'',11);
      row = shipmentSetStringCell(row,`C${excelRow}`,'',13);
      row = shipmentSetStringCell(row,`D${excelRow}`,'',14);
      row = shipmentSetStringCell(row,`E${excelRow}`,'',15);
      row = shipmentSetStringCell(row,`F${excelRow}`,'',17);
    }

    const rowPattern = new RegExp(
      `<row\\b(?=[^>]*\\br="${excelRow}"(?:\\s|\\/?>))[^>]*(?:\\/>|>[\\s\\S]*?<\\/row>)`
    );

    updated = rowPattern.test(updated)
      ? updated.replace(rowPattern,row)
      : updated.replace(/<\/sheetData>/,`${row}</sheetData>`);
  }

  return updated;
}

function inboundBuildBeverageSheet1Xml(originalXml, draft, styles) {
  const rows = {};
  for (let i = 1; i <= 16; i++) rows[i] = shipmentRowXml(originalXml,i);
  rows[5] = shipmentSetStringCell(rows[5],'B5','ex. 나인로지스',10);
  rows[6] = shipmentSetStringCell(rows[6],'B6',inboundDateTimeText(draft),13);
  rows[7] = shipmentSetStringCell(rows[7],'C7','택배',9);
  rows[7] = shipmentSetStringCell(rows[7],'D7','화물',15);
  rows[7] = shipmentSetStringCell(rows[7],'E7','자차',16);
  rows[7] = shipmentSetStringCell(rows[7],'F7',draft.transport === 'other' ? `기타: ${String(draft.transportOther || '').trim()}` : '기타:',18);
  ['C7','D7','E7','F7'].forEach(ref => { rows[7] = shipmentSetCellStyle(rows[7],ref,styles.white[ref]); });
  const selectedRef = {parcel:'C7',freight:'D7',car:'E7',other:'F7'}[draft.transport];
  if (selectedRef) rows[7] = shipmentSetCellStyle(rows[7],selectedRef,styles.yellow[selectedRef]);
  const palletTotal = inboundPalletTotal(draft);
  rows[8] = palletTotal > 0
    ? shipmentSetNumberCell(rows[8],'F8',palletTotal,23)
    : shipmentSetStringCell(rows[8],'F8','-',23);
  rows[11] = shipmentSetStringCell(rows[11],'D11','수량',20);
  const active = inboundActiveProducts().map(entry => entry.item).slice(0,2);
  for (let i = 0; i < 2; i++) {
    const rowNumber = 12 + i;
    let row = rows[rowNumber];
    const item = active[i];
    const stylesByCol = {A:43,B:16,C:44,D:46,E:50,F:51,G:52};
    Object.keys(stylesByCol).forEach(col => { row = shipmentSetStringCell(row,`${col}${rowNumber}`,'-',stylesByCol[col]); });
    if (item) {
      row = shipmentSetStringCell(row,`A${rowNumber}`,inboundValueOrDash(item.productName),43);
      row = shipmentSetStringCell(row,`B${rowNumber}`,inboundValueOrDash(item.optionName),16);
      row = shipmentSetStringCell(row,`C${rowNumber}`,inboundValueOrDash(item.manufactureDate),44);
      if (String(item.cartons).trim() !== '') row = shipmentSetNumberCell(row,`D${rowNumber}`,Number(item.cartons),46);
      if (String(item.looseQty).trim() !== '') row = shipmentSetNumberCell(row,`E${rowNumber}`,Number(item.looseQty),50);
      row = shipmentSetStringCell(row,`F${rowNumber}`,item.pallets === 'combined' ? '합팔레트' : inboundValueOrDash(item.pallets),51);
      row = shipmentSetStringCell(row,`G${rowNumber}`,inboundValueOrDash(item.barcode),52);
    }
    rows[rowNumber] = row;
  }
  return originalXml.replace(/<sheetData>[\s\S]*?<\/sheetData>/,'<sheetData>' + Array.from({length:16},(_,i) => rows[i + 1]).join('') + '</sheetData>');
}

function inboundBuildBeverageSheet2Xml(originalXml, draft) {
  const active = inboundActiveProducts().map(entry => entry.item).slice(0,2);
  let updated = originalXml;
  const header = shipmentSetStringCell(shipmentRowXml(updated,3),'D3','수량',19);
  updated = updated.replace(/<row\b(?=[^>]*\br="3"(?:\s|\/?>))[^>]*(?:\/>|>[\s\S]*?<\/row>)/,header);
  for (let i = 0; i < 2; i++) {
    const excelRow = 4 + i;
    const item = active[i];
    let row = shipmentRowXml(originalXml,excelRow);
    const values = item
      ? [i + 1,item.productName,item.optionName,item.cartons,item.workDoneDate,item.workContent]
      : ['','','','','',''];
    row = shipmentSetNumberCell(row,`A${excelRow}`,values[0] || 0,excelRow === 4 ? 24 : 35);
    row = shipmentSetStringCell(row,`B${excelRow}`,values[1],excelRow === 4 ? 26 : 37);
    row = shipmentSetStringCell(row,`C${excelRow}`,values[2],excelRow === 4 ? 26 : 37);
    if (item && String(item.cartons).trim() !== '') row = shipmentSetNumberCell(row,`D${excelRow}`,Number(item.cartons),excelRow === 4 ? 28 : 37);
    else row = shipmentSetStringCell(row,`D${excelRow}`,'',excelRow === 4 ? 28 : 37);
    row = shipmentSetStringCell(row,`E${excelRow}`,values[4],excelRow === 4 ? 30 : 39);
    row = shipmentSetStringCell(row,`F${excelRow}`,values[5],excelRow === 4 ? 33 : 41);
    const pattern = new RegExp(`<row\\b(?=[^>]*\\br="${excelRow}"(?:\\s|\\/?>))[^>]*(?:\\/>|>[\\s\\S]*?<\\/row>)`);
    updated = updated.replace(pattern,row);
  }
  return updated;
}

async function inboundBuildWorkbookBlob(draft) {
  if (typeof JSZip === 'undefined') {
    throw new Error('입고 요청서 엑셀 처리 기능을 불러오지 못했습니다.');
  }

  const zip = await JSZip.loadAsync(
    easyAdminBase64ToBytes(draft.inboundKind === 'beverage' ? BEVERAGE_INBOUND_REQUEST_TEMPLATE_BASE64 : MATERIAL_INBOUND_REQUEST_TEMPLATE_BASE64)
  );

  const sheet1File = zip.file('xl/worksheets/sheet1.xml');
  const sheet2File = zip.file('xl/worksheets/sheet2.xml');
  const stylesFile = zip.file('xl/styles.xml');

  if (!sheet1File || !sheet2File || !stylesFile) {
    throw new Error('입고 요청서 원본 XLSX 구조를 확인하지 못했습니다.');
  }

  const [sheet1Xml,sheet2Xml,stylesXml] = await Promise.all([
    sheet1File.async('string'),
    sheet2File.async('string'),
    stylesFile.async('string')
  ]);

  const styles = inboundPrepareTransportStyles(stylesXml,draft.inboundKind);
  zip.file('xl/styles.xml',styles.xml);
  zip.file('xl/worksheets/sheet1.xml',draft.inboundKind === 'beverage' ? inboundBuildBeverageSheet1Xml(sheet1Xml,draft,styles) : inboundBuildMaterialSheet1Xml(sheet1Xml,draft,styles));
  zip.file('xl/worksheets/sheet2.xml',draft.inboundKind === 'beverage' ? inboundBuildBeverageSheet2Xml(sheet2Xml,draft) : inboundBuildMaterialSheet2Xml(sheet2Xml,draft));

  return zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    compression: 'DEFLATE'
  });
}

function validateInboundRequestDraft() {
  const d = ensureShipmentDraft();

  if (!d.inboundDate) return '입고일자를 선택해주세요.';
  if (!d.transport) return '운송수단을 선택해주세요.';
  if (d.transport === 'other' && !String(d.transportOther || '').trim()) {
    return '기타 운송수단을 입력해주세요.';
  }
  if (!inboundActiveProducts().length) {
    return '입고 예정 품목을 하나 이상 선택해주세요.';
  }
  return '';
}

function validateOutboundRequestDraft() {
  const d = ensureShipmentDraft();

  d.company = String(d.company || '').trim();
  d.address = String(d.address || '').trim();
  d.phone = String(d.phone || '').trim();
  d.transportOther = String(d.transportOther || '').trim();
  d.requestNote = String(d.requestNote || '').trim();

  (d.products || []).forEach(item => {
    item.workDoneDate = String(item.workDoneDate || '').trim();
    item.workContent = String(item.workContent || '').trim();
  });

  if (!d.shipDate || !d.arrivalDate) return '출고일시와 도착일시를 확인해주세요.';
  if (!d.transport) return '운송수단을 선택해주세요.';
  if (d.transport === 'other' && !d.transportOther) return '기타 운송수단 내용을 입력해주세요.';
  if (!d.company) return '업체명을 입력해주세요.';
  if (!d.address) return '주소를 입력해주세요.';
  if (!d.phone) return '연락처를 입력해주세요.';
  if (!(d.products || []).some(item => Number(item.cartons || 0) > 0)) {
    return '출고할 상품의 카톤(박스) 수량을 하나 이상 선택해주세요.';
  }
  return '';
}

function openRequestPreview() {
  const error = state.shipmentRequestType === 'inbound'
    ? validateInboundRequestDraft()
    : validateOutboundRequestDraft();

  if (error) return toast(error);

  state.shipmentRequestOpen = false;
  state.requestPreviewOpen = true;
  state.requestPreviewTab = 'request';
  state.requestEmailOpen = false;
  render();
}

async function saveInboundRequest() {
  const d = ensureShipmentDraft();

  if (!d.inboundDate) return toast('입고일자를 선택해주세요.');
  if (!d.transport) return toast('운송수단을 선택해주세요.');
  if (d.transport === 'other' && !String(d.transportOther || '').trim()) {
    return toast('기타 운송수단을 입력해주세요.');
  }

  const active = inboundActiveProducts().map(entry => entry.item);
  if (!active.length) return toast('입고 예정 품목을 하나 이상 선택해주세요.');

  setLoading(true);

  try {
    const blob = await inboundBuildWorkbookBlob(d);
    const base64 = await shipmentBlobToBase64(blob);
    const saved = await gasSaveInboundRequestFile({ base64 });

    if (!saved?.fileName) {
      throw new Error('Google Drive 저장 결과를 확인하지 못했습니다.');
    }

    easyAdminDownloadBlob(blob,saved.fileName);
    state.shipmentRequestOpen = false;
    state.requestPreviewOpen = false;
    state.requestEmailOpen = false;
    state.shipmentDraft = null;
    state.composeMenuOpen = false;
    render();
    toast(`${saved.fileName} 저장 및 다운로드 완료`);
  } catch (e) {
    toast('입고 요청서 저장 실패: ' + e.message);
  } finally {
    setLoading(false);
  }
}

async function saveShipmentRequest() {
  const d = ensureShipmentDraft();

  d.company = String(d.company || '').trim();
  d.address = String(d.address || '').trim();
  d.phone = String(d.phone || '').trim();
  d.transportOther = String(d.transportOther || '').trim();
  d.requestNote = String(d.requestNote || '').trim();

  (d.products || []).forEach(item => {
    item.workDoneDate =
      String(item.workDoneDate || '').trim();
    item.workContent =
      String(item.workContent || '').trim();
  });

  if (!d.shipDate || !d.arrivalDate) {
    return toast('출고일시와 도착일시를 확인해주세요.');
  }

  if (!d.transport) {
    return toast('운송수단을 선택해주세요.');
  }

  if (
    d.transport === 'other' &&
    !d.transportOther
  ) {
    return toast('기타 운송수단 내용을 입력해주세요.');
  }

  if (!d.company) {
    return toast('업체명을 입력해주세요.');
  }

  if (!d.address) {
    return toast('주소를 입력해주세요.');
  }

  if (!d.phone) {
    return toast('연락처를 입력해주세요.');
  }

  const hasProduct =
    (d.products || []).some(
      item => Number(item.cartons || 0) > 0
    );

  if (!hasProduct) {
    return toast('출고할 상품의 카톤(박스) 수량을 하나 이상 선택해주세요.');
  }

  setLoading(true);

  try {
    const blob =
      await shipmentBuildWorkbookBlob(d);

    const base64 =
      await shipmentBlobToBase64(blob);

    // Drive 저장이 성공한 뒤 같은 파일을 브라우저에도 다운로드합니다.
    const saved =
      await gasSaveShipmentRequestFile({
        base64
      });

    if (
      !saved ||
      !saved.fileName
    ) {
      throw new Error(
        'Google Drive 저장 결과를 확인하지 못했습니다.'
      );
    }

    easyAdminDownloadBlob(
      blob,
      saved.fileName
    );

    state.shipmentRequestOpen = false;
    state.requestPreviewOpen = false;
    state.requestEmailOpen = false;
    state.shipmentDraft = null;
    state.composeMenuOpen = false;

    render();

    toast(
      `${saved.fileName} 저장 및 다운로드 완료`
    );

  } catch(e) {
    toast(
      '출고 요청서 저장 실패: ' +
      e.message
    );
  } finally {
    setLoading(false);
  }
}

async function sendCurrentRequestEmail() {
  const subject = document.getElementById('requestEmailSubject')?.value.trim() || '';
  const body = document.getElementById('requestEmailBody')?.value.trim() || '';
  const cc = [...document.querySelectorAll('[data-request-email-cc]:checked')]
    .map(input => input.dataset.requestEmailCc)
    .filter(Boolean);

  if (!subject) return toast('메일 제목을 입력해주세요.');
  if (!body) return toast('메일 내용을 입력해주세요.');

  const confirmed = window.confirm(
    `nine-logis@naver.com으로 ${requestPreviewFileName()}을(를) 보내시겠습니까?`
  );

  if (!confirmed) return;

  setLoading(true);

  try {
    const draft = ensureShipmentDraft();
    const blob = state.shipmentRequestType === 'inbound'
      ? await inboundBuildWorkbookBlob(draft)
      : await shipmentBuildWorkbookBlob(draft);
    const base64 = await shipmentBlobToBase64(blob);
    const result = await gasSaveAndSendRequestEmail({
      requestType: state.shipmentRequestType,
      base64,
      subject,
      body,
      cc
    });

    if (!result?.success) {
      throw new Error('메일 발송 결과를 확인하지 못했습니다.');
    }

    state.requestEmailOpen = false;
    state.requestPreviewOpen = false;
    state.shipmentRequestOpen = false;
    state.shipmentDraft = null;
    state.composeMenuOpen = false;
    render();
    toast(`${result.fileName} 저장 및 메일 발송 완료 (${result.sentAt})`);
  } catch (e) {
    toast('메일 발송 실패: ' + e.message);
  } finally {
    setLoading(false);
  }
}


function oliveCleanText(value) {
  if (
    value === undefined ||
    value === null
  ) {
    return '';
  }

  return String(value)
    .replace(/^\uFEFF/, '')
    .trim();
}

function oliveNumber(value) {
  const cleaned =
    oliveCleanText(value)
      .replace(/,/g, '');

  if (!cleaned) {
    return NaN;
  }

  const n = Number(cleaned);

  return Number.isFinite(n)
    ? n
    : NaN;
}

function olivePostalCode(value) {
  const digits =
    oliveCleanText(value)
      .replace(/\D/g, '');

  if (!digits) {
    return '';
  }

  // 사용자가 제공한 나인로지스 작성 예시처럼
  // 우편번호는 일반 숫자 셀로 넣습니다. (예: 03003 → 3003)
  const n = Number(digits);

  return Number.isFinite(n)
    ? n
    : digits;
}

function oliveProductName(value) {
  const name =
    oliveCleanText(value);

  if (!name) {
    return '';
  }

  if (
    /6\s*개입/i.test(name) &&
    !/선물\s*세트|선물세트/i.test(name)
  ) {
    return name + '-선물세트';
  }

  return name;
}

function oliveMatrixToRows(matrix) {
  if (
    !Array.isArray(matrix) ||
    !matrix.length ||
    !Array.isArray(matrix[0])
  ) {
    throw new Error(
      '올리브영 주문서에서 표 데이터를 찾지 못했습니다.'
    );
  }

  const headers =
    matrix[0].map(oliveCleanText);

  const indexOf =
    name => headers.indexOf(name);

  const required = [
    '주문번호',
    '단품명',
    '출하지시수량',
    '주문자',
    '수취인',
    '수취인주소',
    '우편번호'
  ];

  const missing =
    required.filter(
      name => indexOf(name) < 0
    );

  const phoneColumns = [
    '수취인핸드폰번호',
    '수취인전화번호',
    '안심번호'
  ].filter(
    name => indexOf(name) >= 0
  );

  if (!phoneColumns.length) {
    missing.push(
      '수취인핸드폰번호/수취인전화번호'
    );
  }

  if (missing.length) {
    throw new Error(
      '올리브영 주문서 형식이 맞지 않습니다. 확인이 필요한 항목: ' +
      missing.join(', ')
    );
  }

  const rows = [];
  const orderNumbers =
    new Set();

  for (
    let rowIndex = 1;
    rowIndex < matrix.length;
    rowIndex++
  ) {
    const source =
      Array.isArray(matrix[rowIndex])
        ? matrix[rowIndex]
        : [];

    const cell =
      name => {
        const idx =
          indexOf(name);

        return idx >= 0
          ? source[idx]
          : '';
      };

    const orderNumber =
      oliveCleanText(
        cell('주문번호')
      );

    const productRaw =
      oliveCleanText(
        cell('단품명')
      );

    if (
      !orderNumber &&
      !productRaw
    ) {
      continue;
    }

    const qty =
      oliveNumber(
        cell('출하지시수량')
      );

    if (
      !Number.isFinite(qty)
    ) {
      throw new Error(
        `주문서 ${rowIndex + 1}행의 출하지시수량을 확인해주세요.`
      );
    }

    if (qty <= 0) {
      continue;
    }

    const recipient =
      oliveCleanText(
        cell('수취인')
      );

    const orderer =
      oliveCleanText(
        cell('주문자')
      );

    const address =
      oliveCleanText(
        cell('수취인주소')
      );

    const postal =
      olivePostalCode(
        cell('우편번호')
      );

    const phone =
      oliveCleanText(
        cell('수취인핸드폰번호')
      ) ||
      oliveCleanText(
        cell('수취인전화번호')
      ) ||
      oliveCleanText(
        cell('안심번호')
      );

    const product =
      oliveProductName(
        productRaw
      );

    const message =
      oliveCleanText(
        cell('배송메세지')
      );

    const missingRow = [];

    if (!recipient) {
      missingRow.push('수취인');
    }

    if (!phone) {
      missingRow.push('수취인 연락처');
    }

    if (!address) {
      missingRow.push('수취인주소');
    }

    if (postal === '') {
      missingRow.push('우편번호');
    }

    if (!product) {
      missingRow.push('단품명');
    }

    if (missingRow.length) {
      throw new Error(
        `주문서 ${rowIndex + 1}행의 ${missingRow.join(', ')} 정보를 확인해주세요.`
      );
    }

    rows.push({
      '보내는분성명':
        '라이트이너프(브리보)',
      '보내는분전화번호':
        '',
      '보내는분주소(전체, 분할)':
        '',
      '받는분성명':
        recipient,
      '주문자성명':
        orderer,
      '받는분전화번호':
        phone,
      '받는분기타연락처':
        '',
      '받는분우편번호':
        postal,
      '받는분주소(전체, 분할)':
        address,
      '품목명':
        product,
      '배송메세지1':
        message,
      '내품수량':
        qty,
      '박스수량':
        '',
      '운송장번호':
        ''
    });

    if (orderNumber) {
      orderNumbers.add(
        orderNumber
      );
    }
  }

  if (!rows.length) {
    throw new Error(
      '발주로 변환할 주문이 없습니다.'
    );
  }

  return {
    rows,
    orderCount:
      orderNumbers.size ||
      rows.length,
    rowCount:
      rows.length
  };
}

async function oliveFileFingerprint(file) {
  const buffer =
    await file.arrayBuffer();

  if (
    window.crypto?.subtle &&
    typeof window.crypto.subtle.digest === 'function'
  ) {
    const digest =
      await window.crypto.subtle.digest(
        'SHA-256',
        buffer
      );

    return Array.from(
      new Uint8Array(digest)
    )
      .map(
        b => b.toString(16).padStart(2,'0')
      )
      .join('');
  }

  // 오래된 브라우저용 예비값입니다.
  // 최신 Chrome/Safari에서는 위 SHA-256 경로를 사용합니다.
  return [
    file?.name || '',
    file?.size || 0,
    file?.lastModified || 0
  ].join('::');
}


async function oliveReadMatrix(file) {
  const ext =
    String(file?.name || '')
      .split('.')
      .pop()
      .toLowerCase();

  if (ext === 'csv') {
    if (
      typeof XLSX === 'undefined'
    ) {
      throw new Error(
        '엑셀 파일 읽기 기능을 불러오지 못했습니다.'
      );
    }

    const text =
      await file.text();

    const wb =
      XLSX.read(
        text,
        {
          type: 'string'
        }
      );

    const ws =
      wb.Sheets[
        wb.SheetNames[0]
      ];

    return XLSX.utils.sheet_to_json(
      ws,
      {
        header: 1,
        defval: '',
        raw: false
      }
    );
  }

  const signature =
    new Uint8Array(
      await file
        .slice(0, 8)
        .arrayBuffer()
    );

  const isOle =
    signature.length >= 8 &&
    signature[0] === 0xD0 &&
    signature[1] === 0xCF &&
    signature[2] === 0x11 &&
    signature[3] === 0xE0 &&
    signature[4] === 0xA1 &&
    signature[5] === 0xB1 &&
    signature[6] === 0x1A &&
    signature[7] === 0xE1;

  // 올리브영에서 내려받는 비밀번호 보호 XLSX는
  // OLE 컨테이너의 Agile Encryption 형식이므로
  // 암호화가 확인된 XLSX만 1212로 해제합니다.
  if (
    ext === 'xlsx' &&
    isOle
  ) {
    if (
      typeof XlsxPopulate ===
      'undefined'
    ) {
      throw new Error(
        '암호화 주문서 해제 기능을 불러오지 못했습니다. 페이지를 새로고침한 뒤 다시 시도해주세요.'
      );
    }

    let workbook;

    try {
      workbook =
        await XlsxPopulate
          .fromDataAsync(
            file,
            {
              password: '1212'
            }
          );
    } catch(e) {
      throw new Error(
        '올리브영 주문서 암호를 해제하지 못했습니다. 주문서 파일 또는 비밀번호를 확인해주세요.'
      );
    }

    const sheet =
      workbook.sheet(0);

    const usedRange =
      sheet?.usedRange();

    return usedRange
      ? usedRange.value()
      : [];
  }

  if (
    typeof XLSX === 'undefined'
  ) {
    throw new Error(
      '엑셀 파일 읽기 기능을 불러오지 못했습니다.'
    );
  }

  const buffer =
    await file.arrayBuffer();

  let wb;

  try {
    wb =
      XLSX.read(
        buffer,
        {
          type: 'array'
        }
      );
  } catch(e) {
    throw new Error(
      '주문서 파일을 읽지 못했습니다. 올리브영 원본 XLSX 파일인지 확인해주세요.'
    );
  }

  const ws =
    wb.Sheets[
      wb.SheetNames[0]
    ];

  if (!ws) {
    throw new Error(
      '주문서의 첫 번째 시트를 찾지 못했습니다.'
    );
  }

  return XLSX.utils.sheet_to_json(
    ws,
    {
      header: 1,
      defval: '',
      raw: false
    }
  );
}

async function handleOliveFile(file) {
  state.oliveFile =
    file?.name || '';

  state.oliveRows = [];
  state.oliveSummary = null;
  state.oliveHistoryId = '';
  state.oliveError = '';
  state.oliveBusy = true;

  render();

  let message = '';

  try {
    const [matrix,fingerprint] =
      await Promise.all([
        oliveReadMatrix(file),
        oliveFileFingerprint(file)
      ]);

    const result =
      oliveMatrixToRows(
        matrix
      );

    const saved =
      await gasSaveOliveUpload({
        fileName:
          file?.name || '',
        fingerprint,
        orderCount:
          result.orderCount,
        rows:
          result.rows
      });

    state.oliveRows =
      result.rows;

    state.oliveSummary = {
      orderCount:
        result.orderCount,
      rowCount:
        result.rowCount
    };

    state.oliveHistoryId =
      saved?.history?.id || '';

    setAdminData(
      await gasGet()
    );

    message =
      saved?.duplicate
        ? `이미 업로드된 주문서입니다. 기존 발주 이력을 불러왔습니다.`
        : `올리브영 주문 ${result.orderCount}건을 확인하고 발주 이력에 저장했습니다.`;

  } catch(e) {
    state.oliveRows = [];
    state.oliveSummary = null;
    state.oliveHistoryId = '';

    state.oliveError =
      e?.message ||
      '올리브영 주문서 처리 중 오류가 발생했습니다.';

    message =
      state.oliveError;
  } finally {
    state.oliveBusy = false;
    render();
    toast(message);
  }
}


function oliveTemplateCellStyle(rowXml, colName) {
  const pattern =
    new RegExp(
      `<c\\b[^>]*\\br="${colName}\\d+"[^>]*>`,
      'i'
    );

  const selfPattern =
    new RegExp(
      `<c\\b[^>]*\\br="${colName}\\d+"[^>]*/>`,
      'i'
    );

  const match =
    rowXml.match(pattern) ||
    rowXml.match(selfPattern);

  if (!match) {
    return '';
  }

  const styleMatch =
    match[0].match(/\bs="(\d+)"/i);

  return styleMatch
    ? styleMatch[1]
    : '';
}

function oliveStyledCellXml(ref, styleId, value) {
  const styleAttr =
    styleId === '' ||
    styleId === undefined ||
    styleId === null
      ? ''
      : ` s="${styleId}"`;

  if (
    value === undefined ||
    value === null ||
    value === ''
  ) {
    return `<c r="${ref}"${styleAttr}/>`;
  }

  if (
    typeof value === 'number' &&
    Number.isFinite(value)
  ) {
    return (
      `<c r="${ref}"${styleAttr}>` +
        `<v>${value}</v>` +
      `</c>`
    );
  }

  const text =
    easyAdminXmlEscape(value);

  return (
    `<c r="${ref}"${styleAttr} t="inlineStr">` +
      `<is><t xml:space="preserve">${text}</t></is>` +
    `</c>`
  );
}

function oliveBuildSheetXml(originalXml, rows) {
  const rowMatches =
    originalXml.match(
      /<row\b[^>]*\br="\d+"[^>]*>[\s\S]*?<\/row>/g
    ) || [];

  const templateRows =
    new Map();

  rowMatches.forEach(rowXml => {
    const numMatch =
      rowXml.match(/\br="(\d+)"/);

    if (numMatch) {
      templateRows.set(
        Number(numMatch[1]),
        rowXml
      );
    }
  });

  const row1 =
    templateRows.get(1);

  const fallbackRow =
    templateRows.get(2);

  if (!row1) {
    throw new Error(
      '나인로지스 원본 양식의 1행을 찾을 수 없습니다.'
    );
  }

  if (!fallbackRow) {
    throw new Error(
      '나인로지스 원본 양식의 데이터 행 서식을 찾을 수 없습니다.'
    );
  }

  const dataRows =
    rows.map((row, rowIndex) => {
      const excelRow =
        rowIndex + 2;

      const sourceRow =
        templateRows.get(excelRow) ||
        fallbackRow;

      const openMatch =
        sourceRow.match(/^<row\b([^>]*)>/);

      let attrs =
        openMatch
          ? openMatch[1]
          : '';

      if (/\br="\d+"/.test(attrs)) {
        attrs =
          attrs.replace(
            /\br="\d+"/,
            `r="${excelRow}"`
          );
      } else {
        attrs =
          ` r="${excelRow}"` +
          attrs;
      }

      if (/\bspans="[^"]*"/.test(attrs)) {
        attrs =
          attrs.replace(
            /\bspans="[^"]*"/,
            'spans="1:26"'
          );
      }

      const cells = [];

      for (
        let colIndex = 0;
        colIndex < 26;
        colIndex++
      ) {
        const colName =
          easyAdminColumnName(
            colIndex
          );

        const ref =
          colName +
          excelRow;

        const styleId =
          oliveTemplateCellStyle(
            sourceRow,
            colName
          );

        const value =
          colIndex < EASY_HEADERS.length
            ? row[
                EASY_HEADERS[
                  colIndex
                ]
              ]
            : '';

        cells.push(
          oliveStyledCellXml(
            ref,
            styleId,
            value
          )
        );
      }

      return (
        `<row${attrs}>` +
        cells.join('') +
        `</row>`
      );
    })
    .join('');

  const newSheetData =
    `<sheetData>` +
    row1 +
    dataRows +
    `</sheetData>`;

  let updated =
    originalXml.replace(
      /<sheetData>[\s\S]*?<\/sheetData>/,
      newSheetData
    );

  const lastRow =
    Math.max(
      1,
      rows.length + 1
    );

  updated =
    updated.replace(
      /<dimension ref="[^"]*"\/>/,
      `<dimension ref="A1:Z${lastRow}"/>`
    );

  return updated;
}

async function oliveBuildTemplateBlob(rows) {
  if (
    typeof JSZip === 'undefined'
  ) {
    throw new Error(
      '나인로지스 원본 양식을 처리하는 기능을 불러오지 못했습니다. 페이지를 새로고침한 뒤 다시 시도해주세요.'
    );
  }

  const zip =
    await JSZip.loadAsync(
      easyAdminBase64ToBytes(
        OLIVE_NINELOGIS_TEMPLATE_BASE64
      )
    );

  const sheetPath =
    'xl/worksheets/sheet1.xml';

  const sheetFile =
    zip.file(sheetPath);

  if (!sheetFile) {
    throw new Error(
      '나인로지스 원본 양식의 택배양식 시트를 찾을 수 없습니다.'
    );
  }

  const originalXml =
    await sheetFile.async(
      'string'
    );

  const updatedXml =
    oliveBuildSheetXml(
      originalXml,
      rows
    );

  // 사용자가 제공한 빈 나인로지스 XLSX의
  // 1행 제목과 기존 서식은 유지하고 2행부터 주문 데이터만 채웁니다.
  zip.file(
    sheetPath,
    updatedXml
  );

  return zip.generateAsync({
    type: 'blob',
    mimeType:
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    compression:
      'DEFLATE'
  });
}

async function downloadOliveNineLogis() {
  const rows =
    Array.isArray(
      state.oliveRows
    )
      ? state.oliveRows
      : [];

  if (!rows.length) {
    return toast(
      '먼저 올리브영 주문서를 선택해주세요.'
    );
  }

  setLoading(true);

  try {
    const blob =
      await oliveBuildTemplateBlob(
        rows
      );

    // 버튼을 누르는 순간의 한국 날짜를 사용합니다.
    // 어드민을 며칠 동안 열어둔 경우에도 오래된 날짜가 붙지 않습니다.
    const name =
      `올리브영_위수탁_나인로지스_수동 발주서_양식 (${oliveCurrentDateStamp()}).xlsx`;

    easyAdminDownloadBlob(
      blob,
      name
    );

    let historyMessage = '';

    if (state.oliveHistoryId) {
      try {
        await gasMarkOliveDownloaded(
          state.oliveHistoryId,
          name
        );

        setAdminData(
          await gasGet()
        );
      } catch(e) {
        historyMessage =
          ' · 이력 상태 저장은 실패했습니다.';

        console.warn(
          '[Breevo] 올리브영 다운로드 이력 저장 실패:',
          e
        );
      }
    }

    render();

    toast(
      `나인로지스 수동발주서 ${rows.length}행을 다운로드했습니다.${historyMessage}`
    );
  } catch(e) {
    toast(
      '올리브영 발주서 생성 중 오류가 발생했습니다: ' +
      (
        e?.message ||
        '알 수 없는 오류'
      )
    );
  } finally {
    setLoading(false);
  }
}


async function redownloadOliveHistory(id) {
  id = String(id || '').trim();

  if (!id) {
    return toast(
      '다시 다운로드할 발주 이력을 찾지 못했습니다.'
    );
  }

  setLoading(true);

  try {
    const rows =
      await gasGetOliveHistoryRows(id);

    if (!rows || !rows.length) {
      throw new Error(
        '저장된 발주 데이터가 없습니다.'
      );
    }

    const blob =
      await oliveBuildTemplateBlob(
        rows
      );

    const name =
      `올리브영_위수탁_나인로지스_수동 발주서_양식 (${oliveCurrentDateStamp()}).xlsx`;

    easyAdminDownloadBlob(
      blob,
      name
    );

    await gasMarkOliveDownloaded(
      id,
      name
    );

    setAdminData(
      await gasGet()
    );

    render();

    toast(
      `저장된 올리브영 발주서 ${rows.length}행을 다시 다운로드했습니다.`
    );

  } catch(e) {
    toast(
      '올리브영 발주서 다시 다운로드 중 오류가 발생했습니다: ' +
      (
        e?.message ||
        '알 수 없는 오류'
      )
    );
  } finally {
    setLoading(false);
  }
}


async function downloadIds(ids) {
  if (!ids.length) {
    return toast(
      '발주서를 만들 건을 선택해 주세요.'
    );
  }

  const orders =
    ids
      .map(findOrder)
      .filter(Boolean);

  if (
    orders.some(
      o => o.infoMissing
    )
  ) {
    return toast(
      '정보 확인이 필요한 건은 먼저 정보를 수정해 주세요.'
    );
  }

  if (
    orders.some(
      o =>
        ['발주 완료','출고 완료']
          .includes(o.status)
    ) &&
    !confirm(
      '이미 완료된 건이 포함되어 있습니다. 다시 발주서를 내려받을까요?'
    )
  ) {
    return;
  }

  setLoading(true);

  try {
    const rows =
      await gasPreview(ids);

    if (
      !rows ||
      !rows.length
    ) {
      throw new Error(
        '생성할 발주 행이 없습니다.'
      );
    }

    // 사용자가 제공한 실제 이지어드민 원본 XLSX를 그대로 유지합니다.
    // 1행은 값과 서식을 건드리지 않고, 2행부터 발주 데이터만 넣습니다.
    const blob =
      await easyAdminBuildTemplateBlob(
        rows
      );

    const name =
      `라이트이너프_이지어드민_수동_택배양식(${easyAdminDateStamp()}).xlsx`;

    easyAdminDownloadBlob(
      blob,
      name
    );

    await gasComplete(ids);

    state.selected.clear();
    state.drawer = null;
    state.editing = false;

    setAdminData(
      await gasGet()
    );

    render();

    toast(
      `${ids.length}건 수동발주서 다운로드 · 완료 처리했습니다.`
    );

  } catch(e) {
    toast(
      '발주서 생성 중 오류가 발생했습니다: ' +
      e.message
    );
  } finally {
    setLoading(false);
  }
}

/* =========================
   정보 저장
   ========================= */

async function saveEdit() {
  const o =
    findOrder(state.drawer);

  if (!o) return;

  const patch = {
    insta:
      document.getElementById(
        'editInsta'
      )?.value || '',

    name:
      document.getElementById(
        'editName'
      )?.value || '',

    phone:
      document.getElementById(
        'editPhone'
      )?.value || '',

    addr:
      document.getElementById(
        'editAddr'
      )?.value || '',

    flavor:
      document.querySelector(
        '[data-edit-flavor].active'
      )?.dataset.editFlavor ||
      o.flavor
  };

  if (
    o.kind === 'sponsor' &&
    o.source !== 'manual'
  ) {
    patch.eventDate =
      document.getElementById(
        'editEventDate'
      )?.value ||
      o.eventDate;
  }

  if (
    o.kind === 'sponsor' ||
    o.source === 'manual'
  ) {
    patch.qty =
      Number(
        document.querySelector(
          '[data-edit-qty].active'
        )?.dataset.editQty ||
        o.qty
      );
  }

  if (o.kind === 'event') {
    patch.eventTitle =
      document.getElementById(
        'editEventTitle'
      )?.value ||
      '브리보 이벤트';
  }

  setLoading(true);

  try {
    const res =
      await gasUpdate(
        o.id,
        patch
      );

    setAdminData(
      res.data ||
      await gasGet()
    );

    state.editing = false;

    render();

    toast(
      '정보를 수정했습니다.'
    );

  } catch(e) {
    toast(
      '수정 실패: ' +
      e.message
    );
  } finally {
    setLoading(false);
  }
}

async function saveMemo() {
  const o =
    findOrder(state.drawer);

  if (!o) return;

  const memo =
    document.getElementById(
      'memoField'
    )?.value || '';

  setLoading(true);

  try {
    const res =
      await gasUpdate(
        o.id,
        { memo }
      );

    setAdminData(
      res.data ||
      await gasGet()
    );

    // 저장하면 상세 창을 닫고 목록으로 돌아갑니다.
    state.drawer = null;
    state.editing = false;

    render();

    toast(
      '메모를 저장했습니다.'
    );

  } catch(e) {
    toast(
      '메모 저장 실패: ' +
      e.message
    );
  } finally {
    setLoading(false);
  }
}

async function toggleHold() {
  const o =
    findOrder(state.drawer);

  if (!o) return;

  const wasHold =
    !!o.hold;

  setLoading(true);

  try {
    setAdminData(
      await gasHold(
        o.id,
        !wasHold
      )
    );

    render();

    toast(
      wasHold
        ? '보류를 해제했습니다.'
        : '보류 처리했습니다.'
    );

  } catch(e) {
    toast(
      '처리 실패: ' +
      e.message
    );
  } finally {
    setLoading(false);
  }
}

async function cancelDone() {
  const o =
    findOrder(state.drawer);

  if (!o) return;

  if (
    !confirm(
      '완료 상태를 취소할까요?'
    )
  ) {
    return;
  }

  setLoading(true);

  try {
    setAdminData(
      await gasCancel([o.id])
    );

    render();

    toast(
      '완료 상태를 취소했습니다.'
    );

  } catch(e) {
    toast(
      '처리 실패: ' +
      e.message
    );
  } finally {
    setLoading(false);
  }
}

/* =========================
   설정 저장
   ========================= */

async function saveLeadDays(days) {
  if (
    !Number.isInteger(days) ||
    days < 0 ||
    days > 30
  ) {
    toast(
      '발주 기준일은 0~30 사이의 숫자로 입력해주세요.'
    );
    return;
  }

  setLoading(true);

  try {
    const settings =
      await gasSaveSettings({
        leadDays: days
      });

    state.leadDays =
      Number(settings.leadDays);

    applyLeadDays();

    render();

    toast(
      `협찬 발주 기준을 행사 ${days}일 전으로 변경했습니다.`
    );

  } catch(e) {
    toast(
      '발주 기준 변경 실패: ' +
      e.message
    );
  } finally {
    setLoading(false);
  }
}

/* =========================
   페이지 전환
   ========================= */

function resetPage(page) {
  state.page = page;
  state.query = '';
  state.selected.clear();
  state.filterOpen = false;
  state.statusF = '전체';
  state.drawer = null;
  state.editing = false;
  state.alertOpen = false;
  state.composeMenuOpen = false;
  state.shipmentTypeChoiceOpen = false;
  state.manualOpen = false;
  state.manualItems = [];
  state.shipmentRequestOpen = false;
  state.shipmentDraft = null;

  if (page === 'sponsor') {
    state.sub = 'dash';
  } else if (
    ['amb','event','sample','b2b','olive']
      .includes(page)
  ) {
    state.sub = 'list';
  }

  render();
}

/* =========================
   클릭 이벤트
   ========================= */

document.addEventListener(
  'click',
  e => {

    const nav =
      e.target.closest('[data-nav]');

    if (nav) {
      resetPage(nav.dataset.nav);
      return;
    }

    const sub =
      e.target.closest('[data-sub]');

    if (sub) {
      state.sub = sub.dataset.sub;
      state.selected.clear();
      state.query = '';
      render();
      return;
    }

    const metric =
      e.target.closest('[data-metric]');

    if (metric) {
      state.sub = 'list';
      state.statusF =
        metric.dataset.metric;

      state.filterOpen =
        metric.dataset.metric !== '전체';

      render();
      return;
    }

    const b2bToggle =
      e.target.closest('[data-b2b-toggle]');

    if (b2bToggle) {
      const key =
        b2bToggle.dataset.b2bToggle || '';

      if (state.b2bExpanded.has(key)) {
        state.b2bExpanded.delete(key);
      } else {
        state.b2bExpanded.add(key);
      }

      render();
      return;
    }

    const open =
      e.target.closest('[data-open]');

    if (open) {
      state.drawer =
        open.dataset.open;

      state.editing = false;

      renderDrawer();
      return;
    }

    const calFilter =
      e.target.closest('[data-cal-filter]');

    if (calFilter) {
      state.calFilter = calFilter.dataset.calFilter;
      render();
      return;
    }

    const calDate =
      e.target.closest('[data-cal-date]');

    if (calDate) {
      const iso =
        calDate.dataset.calDate;

      state.calSelectedDate = iso;

      const [yy,mm] =
        iso
          .split('-')
          .map(Number);

      state.calYear = yy;
      state.calMonth = mm - 1;

      render();
      return;
    }

    const check =
      e.target.closest('[data-check]');

    if (
      check &&
      !check.disabled
    ) {
      const id =
        check.dataset.check;

      state.selected.has(id)
        ? state.selected.delete(id)
        : state.selected.add(id);

      render();
      return;
    }

    const st =
      e.target.closest('[data-status]');

    if (st) {
      state.statusF =
        st.dataset.status;

      render();
      return;
    }

    const qty =
      e.target.closest('[data-edit-qty]');

    if (
      qty &&
      !qty.disabled
    ) {
      document
        .querySelectorAll('[data-edit-qty]')
        .forEach(
          x =>
            x.classList.remove('active')
        );

      qty.classList.add('active');

      const editingOrder =
        findOrder(state.drawer);

      if (
        editingOrder?.kind === 'b2b'
      ) {
        const q =
          Number(qty.dataset.editQty);

        const mix =
          document.querySelector(
            '[data-edit-flavor="mix"]'
          );

        if (mix) {
          mix.disabled =
            q !== 48;

          if (
            mix.disabled &&
            mix.classList.contains('active')
          ) {
            mix.classList.remove('active');

            const apple =
              document.querySelector(
                '[data-edit-flavor="apple"]'
              );

            if (apple) {
              apple.classList.add('active');
            }
          }
        }
      }

      return;
    }

    const fl =
      e.target.closest('[data-edit-flavor]');

    if (
      fl &&
      !fl.disabled
    ) {
      document
        .querySelectorAll('[data-edit-flavor]')
        .forEach(
          x =>
            x.classList.remove('active')
        );

      fl.classList.add('active');
      return;
    }

    const manualKind =
      e.target.closest('[data-manual-kind]');

    if (manualKind) {
      document
        .querySelectorAll('[data-manual-kind]')
        .forEach(
          x => x.classList.remove('active')
        );

      manualKind.classList.add('active');
      applyManualKindRules(
        manualKind.dataset.manualKind
      );
      return;
    }

    const manualQty =
      e.target.closest('[data-manual-qty]');

    if (
      manualQty &&
      !manualQty.disabled
    ) {
      document
        .querySelectorAll('[data-manual-qty]')
        .forEach(
          x => x.classList.remove('active')
        );

      manualQty.classList.add('active');

      const qtyValue =
        Number(manualQty.dataset.manualQty);

      const mixBtn =
        document.querySelector(
          '[data-manual-flavor="mix"]'
        );

      const manualKindValue =
        document.querySelector(
          '[data-manual-kind].active'
        )?.dataset.manualKind || '';

      if (mixBtn) {
        mixBtn.disabled =
          manualKindValue === 'b2b'
            ? qtyValue !== 48
            : qtyValue === 6;

        if (mixBtn.disabled) {
          mixBtn.classList.remove('active');
        }
      }

      updateManualCompositionNote();
      return;
    }

    const manualFlavor =
      e.target.closest('[data-manual-flavor]');

    if (
      manualFlavor &&
      !manualFlavor.disabled
    ) {
      document
        .querySelectorAll('[data-manual-flavor]')
        .forEach(
          x => x.classList.remove('active')
        );

      manualFlavor.classList.add('active');

      const manualKindValue =
        document.querySelector(
          '[data-manual-kind].active'
        )?.dataset.manualKind || '';

      if (manualKindValue !== 'sample') {
        addManualSelection();
      } else {
        updateManualCompositionNote();
      }

      return;
    }

    const manualItemMinus =
      e.target.closest('[data-manual-item-minus]');

    if (manualItemMinus) {
      changeManualItemCount(
        manualItemMinus.dataset.manualItemMinus,
        -1
      );
      return;
    }

    const manualItemPlus =
      e.target.closest('[data-manual-item-plus]');

    if (manualItemPlus) {
      changeManualItemCount(
        manualItemPlus.dataset.manualItemPlus,
        1
      );
      return;
    }


    const shipmentCalendarToggle =
      e.target.closest('[data-shipment-calendar-toggle]');

    if (shipmentCalendarToggle) {
      shipmentToggleCalendar(
        shipmentCalendarToggle.dataset.shipmentCalendarToggle
      );
      return;
    }

    const shipmentCalendarNav =
      e.target.closest('[data-shipment-calendar-nav]');

    if (shipmentCalendarNav) {
      shipmentMoveCalendarMonth(
        shipmentCalendarNav.dataset.shipmentCalendarField,
        Number(shipmentCalendarNav.dataset.shipmentCalendarNav || 0)
      );
      return;
    }

    const shipmentCalendarDay =
      e.target.closest('[data-shipment-calendar-day]');

    if (shipmentCalendarDay) {
      shipmentSelectCalendarDay(
        shipmentCalendarDay.dataset.shipmentCalendarField,
        Number(shipmentCalendarDay.dataset.shipmentCalendarDay)
      );
      return;
    }

    const shipmentTransportBtn =
      e.target.closest('[data-shipment-transport]');

    if (shipmentTransportBtn) {
      const d = ensureShipmentDraft();
      d.transport =
        shipmentTransportBtn.dataset.shipmentTransport || '';

      if (d.transport !== 'other') {
        d.transportOther = '';
      }

      shipmentRefreshTransportControls();
      return;
    }

    const shipmentPalletBtn =
      e.target.closest('[data-shipment-pallet-delta]');

    if (shipmentPalletBtn) {
      const d = ensureShipmentDraft();
      d.pallet = Math.max(
        0,
        Number(d.pallet || 0) +
        Number(shipmentPalletBtn.dataset.shipmentPalletDelta || 0)
      );
      shipmentRefreshPalletValue();
      return;
    }

    const shipmentProductBtn =
      e.target.closest('[data-shipment-product-delta]');

    if (shipmentProductBtn) {
      const d = ensureShipmentDraft();
      const index =
        Number(shipmentProductBtn.dataset.shipmentProductIndex);
      const delta =
        Number(shipmentProductBtn.dataset.shipmentProductDelta || 0);

      if (d.products[index]) {
        d.products[index].cartons = Math.max(
          0,
          Number(d.products[index].cartons || 0) + delta
        );
      }

      shipmentRefreshProductRow(index);
      shipmentRefreshWorkSection();
      return;
    }

    const requestPreviewTab =
      e.target.closest('[data-request-preview-tab]');

    if (requestPreviewTab) {
      state.requestPreviewTab =
        requestPreviewTab.dataset.requestPreviewTab === 'work'
          ? 'work'
          : 'request';
      render();
      return;
    }

    const a =
      e.target.closest('[data-action]');

    if (!a) return;

    const act =
      a.dataset.action;

    if (act === 'toggle-compose-menu') {
      state.composeMenuOpen =
        !state.composeMenuOpen;
      state.inboundTypeChoiceOpen = false;
      state.manualOpen = false;
      state.shipmentRequestOpen = false;
      state.alertOpen = false;
      render();

    } else if (act === 'close-compose-menu') {
      state.composeMenuOpen = false;
      render();

    } else if (act === 'open-shipment-type-choice') {
      state.composeMenuOpen = false;
      state.shipmentTypeChoiceOpen = true;
      state.inboundTypeChoiceOpen = false;
      state.manualOpen = false;
      state.shipmentRequestOpen = false;
      render();

    } else if (act === 'close-shipment-type-choice') {
      state.shipmentTypeChoiceOpen = false;
      render();

    } else if (act === 'open-inbound-request') {
      state.composeMenuOpen = false;
      state.shipmentTypeChoiceOpen = false;
      state.manualOpen = false;
      state.manualItems = [];
      state.inboundTypeChoiceOpen = true;
      render();

    } else if (act === 'close-inbound-type-choice') {
      state.inboundTypeChoiceOpen = false;
      render();

    } else if (act === 'open-beverage-inbound-request' || act === 'open-material-inbound-request') {
      state.inboundTypeChoiceOpen = false;
      state.shipmentRequestType = 'inbound';
      state.shipmentDraft = createInboundDraft(act === 'open-beverage-inbound-request' ? 'beverage' : 'material');
      state.shipmentCalendarField = null;
      state.shipmentCalendarYear = null;
      state.shipmentCalendarMonth = null;
      state.shipmentRequestOpen = true;
      state.requestPreviewOpen = false;
      state.requestEmailOpen = false;
      render();

    } else if (act === 'open-manual-from-compose') {
      state.composeMenuOpen = false;
      state.manualOpen = true;
      state.manualItems = [];
      state.shipmentRequestOpen = false;
      render();

    } else if (act === 'open-shipment-request') {
      state.composeMenuOpen = false;
      state.shipmentTypeChoiceOpen = false;
      state.manualOpen = false;
      state.manualItems = [];
      state.shipmentRequestType = 'outbound';
      state.shipmentDraft = createShipmentDraft();
      state.shipmentCalendarField = null;
      state.shipmentCalendarYear = null;
      state.shipmentCalendarMonth = null;
      state.shipmentRequestOpen = true;
      state.requestPreviewOpen = false;
      state.requestEmailOpen = false;
      render();

    } else if (act === 'close-shipment-request') {
      state.shipmentRequestOpen = false;
      state.requestPreviewOpen = false;
      state.requestEmailOpen = false;
      state.shipmentDraft = null;
      state.shipmentCalendarField = null;
      state.shipmentCalendarYear = null;
      state.shipmentCalendarMonth = null;
      render();

    } else if (act === 'back-to-shipment-type-choice') {
      state.inboundTypeChoiceOpen = false;
      state.shipmentRequestOpen = false;
      state.requestPreviewOpen = false;
      state.requestEmailOpen = false;
      state.shipmentRequestType = null;
      state.shipmentDraft = null;
      state.shipmentCalendarField = null;
      state.shipmentCalendarYear = null;
      state.shipmentCalendarMonth = null;
      state.shipmentTypeChoiceOpen = true;
      render();

    } else if (act === 'back-to-inbound-type-choice') {
      state.shipmentRequestOpen = false;
      state.requestPreviewOpen = false;
      state.requestEmailOpen = false;
      state.shipmentDraft = null;
      state.shipmentCalendarField = null;
      state.shipmentCalendarYear = null;
      state.shipmentCalendarMonth = null;
      state.inboundTypeChoiceOpen = true;
      render();

    } else if (act === 'back-to-compose-choice') {
      state.manualOpen = false;
      state.manualItems = [];
      state.composeMenuOpen = true;
      render();

    } else if (act === 'add-inbound-product') {
      const d = ensureShipmentDraft();
      const maxProducts = d.inboundKind === 'beverage' ? 2 : 6;
      if ((d.products || []).length < maxProducts) {
        d.products.push(createInboundProduct());
        inboundRefreshProducts();
      }

    } else if (act === 'remove-inbound-product') {
      const d = ensureShipmentDraft();
      const index = Number(a.dataset.inboundProductIndex);
      if (d.products.length > 1 && Number.isInteger(index) && d.products[index]) {
        d.products.splice(index, 1);
        inboundRefreshProducts();
      }

    } else if (act === 'preview-shipment-request' || act === 'preview-inbound-request') {
      openRequestPreview();

    } else if (act === 'back-to-request-edit') {
      state.requestEmailOpen = false;
      state.requestPreviewOpen = false;
      state.shipmentRequestOpen = true;
      render();

    } else if (act === 'save-preview-request') {
      state.shipmentRequestType === 'inbound'
        ? saveInboundRequest()
        : saveShipmentRequest();

    } else if (act === 'open-request-email') {
      state.requestEmailOpen = true;
      render();

    } else if (act === 'close-request-email') {
      state.requestEmailOpen = false;
      render();

    } else if (act === 'send-request-email') {
      sendCurrentRequestEmail();

    } else if (act === 'save-shipment-request') {
      saveShipmentRequest();

    } else if (act === 'save-inbound-request') {
      saveInboundRequest();

    } else if (act === 'close-manual') {
      state.manualOpen = false;
      state.manualItems = [];
      render();

    } else if (act === 'save-manual') {
      saveManualOrder();

    } else if (act === 'toggle-alert') {
      state.alertOpen =
        !state.alertOpen;
      state.composeMenuOpen = false;
      state.manualOpen = false;
      state.manualItems = [];
      state.shipmentRequestOpen = false;
      state.shipmentDraft = null;
      render();

    } else if (act === 'refresh') {
      state.alertOpen = false;
      loadData(true);

    } else if (
      act === 'toggle-filter'
    ) {
      state.filterOpen =
        !state.filterOpen;
      render();

    } else if (
      act === 'toggle-all'
    ) {
      const arr =
        currentSelectable();

      const on =
        arr.length &&
        arr.every(
          o =>
            state.selected.has(o.id)
        );

      arr.forEach(o => {
        on
          ? state.selected.delete(o.id)
          : state.selected.add(o.id);
      });

      render();

    } else if (
      act === 'download-selected'
    ) {
      downloadIds(
        [...state.selected]
      );

    } else if (
      act === 'download-single'
    ) {
      downloadIds(
        [state.drawer]
      );

    } else if (
      act === 'olive-download'
    ) {
      downloadOliveNineLogis();

    } else if (
      act === 'olive-redownload'
    ) {
      redownloadOliveHistory(
        a.dataset.oliveId || ''
      );

    } else if (
      act === 'close-drawer'
    ) {
      state.drawer = null;
      state.editing = false;
      render();

    } else if (
      act === 'toggle-edit'
    ) {
      state.editing =
        !state.editing;
      renderDrawer();

    } else if (
      act === 'save-edit'
    ) {
      saveEdit();

    } else if (
      act === 'save-memo'
    ) {
      saveMemo();

    } else if (
      act === 'toggle-hold'
    ) {
      toggleHold();

    } else if (
      act === 'cancel-done'
    ) {
      cancelDone();

    } else if (
      act === 'cal-prev'
    ) {
      state.calSelectedDate = null;
      state.calMonth--;

      if (state.calMonth < 0) {
        state.calMonth = 11;
        state.calYear--;
      }

      render();

    } else if (
      act === 'cal-next'
    ) {
      state.calSelectedDate = null;
      state.calMonth++;

      if (state.calMonth > 11) {
        state.calMonth = 0;
        state.calYear++;
      }

      render();

    } else if (
      act === 'cal-today'
    ) {
      const [y,m] =
        todayIso()
          .split('-')
          .map(Number);

      state.calYear = y;
      state.calMonth = m - 1;
      state.calSelectedDate = todayIso();

      render();

    } else if (
      act === 'cal-close'
    ) {
      state.calSelectedDate = null;
      render();
    }
  }
);

/* =========================
   검색
   ========================= */

document.addEventListener(
  'input',
  e => {
    const inboundWorkDate =
      e.target.closest('[data-inbound-work-date]');

    if (inboundWorkDate) {
      const d = ensureShipmentDraft();
      const index = Number(inboundWorkDate.dataset.inboundWorkDate);
      if (d.products?.[index]) d.products[index].workDoneDate = inboundWorkDate.value;
      return;
    }

    const inboundWorkContent =
      e.target.closest('[data-inbound-work-content]');

    if (inboundWorkContent) {
      const d = ensureShipmentDraft();
      const index = Number(inboundWorkContent.dataset.inboundWorkContent);
      if (d.products?.[index]) d.products[index].workContent = inboundWorkContent.value;
      return;
    }

    const inboundProductField =
      e.target.closest('[data-inbound-product-field]');

    if (inboundProductField) {
      const d = ensureShipmentDraft();
      const index = Number(inboundProductField.dataset.inboundProductIndex);
      const key = inboundProductField.dataset.inboundProductField;
      if (d.products?.[index] && key) {
        d.products[index][key] = inboundProductField.value;
        if (d.inboundKind === 'beverage' && key === 'cartons') {
          d.products[index].looseQty = inboundProductField.value === '' ? '' : Number(inboundProductField.value || 0) * 24;
          const preview = document.querySelector(`[data-inbound-loose-preview="${index}"]`);
          if (preview) preview.value = d.products[index].looseQty;
        }
        const work = document.getElementById('inboundWorkRows');
        if (work) work.innerHTML = renderInboundWorkRows();
      }
      return;
    }

    const shipmentWorkDate =
      e.target.closest('[data-shipment-work-date]');

    if (shipmentWorkDate) {
      const d = ensureShipmentDraft();
      const index =
        Number(shipmentWorkDate.dataset.shipmentWorkDate);

      if (d.products?.[index]) {
        d.products[index].workDoneDate =
          shipmentWorkDate.value;
      }
      return;
    }

    const shipmentWorkContent =
      e.target.closest('[data-shipment-work-content]');

    if (shipmentWorkContent) {
      const d = ensureShipmentDraft();
      const index =
        Number(shipmentWorkContent.dataset.shipmentWorkContent);

      if (d.products?.[index]) {
        d.products[index].workContent =
          shipmentWorkContent.value;
      }
      return;
    }

    const shipmentField =
      e.target.closest('[data-shipment-field]');

    if (shipmentField) {
      const d = ensureShipmentDraft();
      const key = shipmentField.dataset.shipmentField;

      if (key) {
        d[key] = shipmentField.value;
      }
      return;
    }

    if (
      e.target.id === 'searchInput'
    ) {
      const pos =
        e.target.selectionStart;

      state.query =
        e.target.value;

      render();

      const n =
        document.getElementById(
          'searchInput'
        );

      if (n) {
        n.focus();
        n.setSelectionRange(
          pos,
          pos
        );
      }
    }
  }
);

/* =========================
   변경 이벤트
   ========================= */

document.addEventListener(
  'change',
  e => {

    if (e.target.matches('[data-inbound-product-type]')) {
      const d = ensureShipmentDraft();
      const index = Number(e.target.dataset.inboundProductType);
      const item = d.products?.[index];
      const type = e.target.value;

      if (item) {
        item.productType = type;
        if (type === 'apple') {
          item.productName = '브리보 프리바이오틱 소다 사과';
          item.optionName = '24';
        } else if (type === 'peach') {
          item.productName = '브리보 프리바이오틱 소다 복숭아';
          item.optionName = '24';
        } else {
          item.productName = '';
          item.optionName = '';
        }
      }

      inboundRefreshProducts();
      return;
    }

    if (e.target.matches('select[data-inbound-product-field]')) {
      const d = ensureShipmentDraft();
      const index = Number(e.target.dataset.inboundProductIndex);
      const key = e.target.dataset.inboundProductField;
      if (d.products?.[index] && key) d.products[index][key] = e.target.value;
      return;
    }

    if (e.target.matches('[data-shipment-field]')) {
      const d = ensureShipmentDraft();
      const key = e.target.dataset.shipmentField;
      if (key) d[key] = e.target.value;
      return;
    }

    if (e.target.matches('[data-shipment-recipient]')) {
      applyShipmentRecipient(e.target.value);
      shipmentRefreshRecipientFields();
      return;
    }

    if (e.target.matches('[data-shipment-product-option]')) {
      const d = ensureShipmentDraft();
      const index =
        Number(e.target.dataset.shipmentProductOption);

      if (d.products[index]) {
        d.products[index].option =
          Number(e.target.value) || 24;
      }

      shipmentRefreshProductRow(index);
      shipmentRefreshWorkSection();
      return;
    }

    if (
      e.target.id === 'leadDaysInput'
    ) {
      const days =
        Number(e.target.value);

      if (
        !Number.isInteger(days) ||
        days < 0 ||
        days > 30
      ) {
        e.target.value =
          state.leadDays;

        toast(
          '발주 기준일은 0~30 사이의 숫자로 입력해주세요.'
        );

        return;
      }

      saveLeadDays(days);
      return;
    }

    if (
      e.target.id === 'oliveInput'
    ) {
      const f =
        e.target.files?.[0];

      if (f) {
        handleOliveFile(f);
      }
    }

  }
);

/* =========================
   신청폼 자동 반영
   - 기존 신청폼 어드민과 동일하게 30초마다 시트 확인
   - 로딩 오버레이 / 페이지 새로고침 없음
   - 새 신청 ID가 생겼을 때만 목록 갱신
   ========================= */

let autoRefreshBusy = false;

function autoRefreshIdSignature(data) {
  return JSON.stringify(
    [
      ...(data?.sponsor || []),
      ...(data?.ambassador || []),
      ...(data?.event || []),
      ...(data?.sample || []),
      ...(data?.b2b || []),
      ...(data?.olive || [])
    ]
      .map(o => String(o?.id || ''))
      .filter(Boolean)
      .sort()
  );
}

async function autoRefreshAdminData() {
  if (
    autoRefreshBusy ||
    document.visibilityState !== 'visible' ||
    state.composeMenuOpen ||
    state.shipmentTypeChoiceOpen ||
    state.inboundTypeChoiceOpen ||
    state.manualOpen ||
    state.shipmentRequestOpen ||
    state.requestPreviewOpen ||
    state.requestEmailOpen ||
    state.editing ||
    state.drawer ||
    state.alertOpen ||
    state.page === 'settings'
  ) {
    return;
  }

  autoRefreshBusy = true;

  try {
    const before = autoRefreshIdSignature(state.data);
    const selectedBefore = new Set(state.selected);
    const adminData = await gasGet();
    const after = autoRefreshIdSignature(adminData);

    // 새 신청/삭제가 없으면 DOM을 전혀 건드리지 않습니다.
    if (before === after) {
      return;
    }

    setAdminData(adminData);

    const validIds = new Set(
      [
        ...(state.data.sponsor || []),
        ...(state.data.ambassador || []),
        ...(state.data.event || []),
        ...(state.data.sample || []),
        ...(state.data.b2b || []),
        ...(state.data.olive || [])
      ].map(o => o.id)
    );

    state.selected = new Set(
      [...selectedBefore].filter(id => validIds.has(id))
    );

    // .content에는 fade animation을 적용하지 않으므로
    // 새 신청은 목록 전체가 번쩍이지 않고 행만 즉시 추가된 것처럼 보입니다.
    render();

  } catch(e) {
    console.warn('[Breevo] 자동 데이터 갱신 실패:', e);
  } finally {
    autoRefreshBusy = false;
  }
}

/* =========================
   시작
   ========================= */

loadData(true);

window.__breevoRefreshTimer = setInterval(
  autoRefreshAdminData,
  30000
);

