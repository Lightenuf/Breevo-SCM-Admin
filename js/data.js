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
   1. 주문 데이터 조회
   ========================= */

function gasGet() {
  if (IS_SAMPLE_MODE) {
    return sampleDelay(sampleData(), 240);
  }
  return notConnected('주문 데이터 조회');
}

/* =========================
   2. 관리자 설정
   ========================= */

function gasGetSettings() {
  if (IS_SAMPLE_MODE) {
    return sampleDelay({ ...sampleStore.settings }, 80);
  }
  return notConnected('설정 조회');
}

function gasSaveSettings(settings) {
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
  return notConnected('설정 저장');
}

/* =========================
   3. 주문 수정 / 상태 변경
   ========================= */

function gasUpdate(id, patch) {
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
  return notConnected('주문 수정');
}

function gasHold(id, hold) {
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
  return notConnected('보류 처리');
}

function gasCancel(ids) {
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
  return notConnected('완료 취소');
}

function gasComplete(ids) {
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
  return notConnected('발주 완료 처리');
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

function gasPreview(ids) {
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
  return notConnected('발주서 미리보기');
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
