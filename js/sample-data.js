/* =========================
   샘플 데이터
   Supabase 연결 전에 화면을 확인하기 위한 가짜 데이터입니다.
   실제 운영 데이터가 아니며, 연결되면 사용되지 않습니다.
   서버(getAdminData)가 돌려주던 것과 똑같은 형태를 유지합니다.
   ========================= */

function sampleIso(delta) {
  const d = new Date();
  d.setDate(d.getDate() + delta);

  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0')
  ].join('-');
}

function sampleStamp(delta, time = '14:20:11') {
  const iso = sampleIso(delta).split('-');
  return `${iso[0]}. ${Number(iso[1])}. ${Number(iso[2])} 오후 ${time}`;
}

function sampleSplit(qty, flavor) {
  if (flavor === 'apple') return { apple: qty, peach: 0 };
  if (flavor === 'peach') return { apple: 0, peach: qty };
  if (flavor === 'mix') return { apple: qty / 2, peach: qty / 2 };
  return { apple: 0, peach: 0 };
}

function sampleFlavorLabel(flavor) {
  if (flavor === 'mix') return '사과+복숭아';
  if (flavor === 'apple') return '사과';
  if (flavor === 'peach') return '복숭아';
  return '';
}

function sampleOrder(o) {
  const split = sampleSplit(o.qty, o.flavor);

  return {
    source: 'form',
    insta: '',
    name: '',
    phone: '',
    addr: '',
    memo: '',
    sheetAt: '',
    doneAt: '',
    hold: false,
    infoMissing: false,
    flavorLabel: sampleFlavorLabel(o.flavor),
    appleQty: split.apple,
    peachQty: split.peach,
    ...o
  };
}

function sampleB2BGroups(orders) {
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

    if (order.status !== '출고 완료') {
      map[key].pendingCount += 1;
    }
  });

  return Object.values(map);
}

function buildSampleAdminData() {
  const today = sampleIso(0);

  const sponsor = [
    sampleOrder({
      id: 'sponsor::48캔 응답::7',
      kind: 'sponsor', kindLabel: '협찬',
      sourceSheet: '48캔 응답', sourceRow: 7,
      timestamp: sampleStamp(-9), receivedDate: sampleIso(-9),
      insta: '@hana_daily', name: '김하나', phone: '010-1234-0001',
      addr: '서울시 성동구 왕십리로 00, 000동 0000호',
      eventDate: sampleIso(2), dueDate: sampleIso(-2),
      qty: 48, flavor: 'mix', status: '발주 지연'
    }),
    sampleOrder({
      id: 'sponsor::24캔 응답::12',
      kind: 'sponsor', kindLabel: '협찬',
      sourceSheet: '24캔 응답', sourceRow: 12,
      timestamp: sampleStamp(-6), receivedDate: sampleIso(-6),
      insta: '@yeonwoo.log', name: '박연우', phone: '010-1234-0002',
      addr: '경기도 성남시 분당구 판교역로 00, 000호',
      eventDate: sampleIso(4), dueDate: today,
      qty: 24, flavor: 'apple', status: '오늘 발주'
    }),
    sampleOrder({
      id: 'sponsor::96캔 응답::4',
      kind: 'sponsor', kindLabel: '협찬',
      sourceSheet: '96캔 응답', sourceRow: 4,
      timestamp: sampleStamp(-3), receivedDate: sampleIso(-3),
      insta: '@seoul_pilates', name: '이서현', phone: '010-1234-0003',
      addr: '서울시 강남구 테헤란로 00, 0층',
      eventDate: sampleIso(10), dueDate: sampleIso(6),
      qty: 96, flavor: 'mix', status: '발주 대기'
    }),
    sampleOrder({
      id: 'sponsor::12캔 응답::21',
      kind: 'sponsor', kindLabel: '협찬',
      sourceSheet: '12캔 응답', sourceRow: 21,
      timestamp: sampleStamp(-14), receivedDate: sampleIso(-14),
      insta: '@mom_jieun', name: '최지은', phone: '010-1234-0004',
      addr: '인천시 연수구 송도과학로 00, 000동 0000호',
      eventDate: sampleIso(-4), dueDate: sampleIso(-8),
      qty: 12, flavor: 'peach', status: '발주 완료',
      doneAt: sampleStamp(-8, '11:02:40'),
      sheetAt: sampleStamp(-8, '11:02:40')
    }),
    sampleOrder({
      id: 'sponsor::36캔 응답::9',
      kind: 'sponsor', kindLabel: '협찬',
      sourceSheet: '36캔 응답', sourceRow: 9,
      timestamp: sampleStamp(-2), receivedDate: sampleIso(-2),
      insta: '@runner_kim', name: '', phone: '010-1234-0005',
      addr: '',
      eventDate: sampleIso(7), dueDate: sampleIso(3),
      qty: 36, flavor: 'mix', status: '정보 확인 필요',
      infoMissing: true
    }),
    sampleOrder({
      id: 'sponsor::24캔 응답::15',
      kind: 'sponsor', kindLabel: '협찬',
      sourceSheet: '24캔 응답', sourceRow: 15,
      timestamp: sampleStamp(-5), receivedDate: sampleIso(-5),
      insta: '@cafe_soo', name: '정수민', phone: '010-1234-0006',
      addr: '부산시 해운대구 센텀중앙로 00, 000호',
      eventDate: sampleIso(6), dueDate: sampleIso(2),
      qty: 24, flavor: 'peach', status: '보류',
      hold: true, memo: '행사 일정 조율 중 (샘플 메모)'
    })
  ];

  const ambassador = [
    sampleOrder({
      id: 'amb::엠베서더 응답::5',
      kind: 'amb', kindLabel: '엠베서더',
      sourceSheet: '엠베서더 응답', sourceRow: 5,
      timestamp: sampleStamp(-1), receivedDate: sampleIso(-1),
      insta: '@yoga_with_min', name: '한소민', phone: '010-1234-0011',
      addr: '서울시 마포구 월드컵북로 00, 000호',
      qty: 12, flavor: 'mix', status: '출고 대기'
    }),
    sampleOrder({
      id: 'amb::엠베서더 응답::6',
      kind: 'amb', kindLabel: '엠베서더',
      sourceSheet: '엠베서더 응답', sourceRow: 6,
      timestamp: sampleStamp(0, '09:40:02'), receivedDate: today,
      insta: '@daily_jiwon', name: '오지원', phone: '010-1234-0012',
      addr: '대전시 유성구 대학로 00, 000동 0000호',
      qty: 12, flavor: 'apple', status: '출고 대기'
    }),
    sampleOrder({
      id: 'amb::엠베서더 응답::4',
      kind: 'amb', kindLabel: '엠베서더',
      sourceSheet: '엠베서더 응답', sourceRow: 4,
      timestamp: sampleStamp(-7), receivedDate: sampleIso(-7),
      insta: '@hyein_table', name: '강혜인', phone: '010-1234-0013',
      addr: '서울시 서초구 반포대로 00, 000호',
      qty: 12, flavor: 'peach', status: '출고 완료',
      doneAt: sampleStamp(-6, '16:11:25')
    })
  ];

  const event = [
    sampleOrder({
      id: 'event::이벤트 응답::18',
      kind: 'event', kindLabel: '이벤트',
      sourceSheet: '이벤트 응답', sourceRow: 18,
      timestamp: sampleStamp(0, '10:15:33'), receivedDate: today,
      eventTitle: '브리보 여름 이벤트',
      insta: '@summer_gina', name: '윤지나', phone: '010-1234-0021',
      addr: '광주시 서구 상무중앙로 00, 000호',
      qty: 6, flavor: 'apple', status: '출고 대기'
    }),
    sampleOrder({
      id: 'event::manual::a1b2c3',
      kind: 'resend', kindLabel: '오배송건 재발송',
      source: 'manual',
      timestamp: sampleStamp(-1, '17:30:00'), receivedDate: sampleIso(-1),
      eventTitle: '오배송건 재발송',
      insta: '', name: '임도현', phone: '010-1234-0022',
      addr: '울산시 남구 삼산로 00, 000동 0000호',
      qty: 12, flavor: 'mix', status: '출고 대기',
      memo: '맛 구성 오배송으로 재발송 (샘플 메모)'
    }),
    sampleOrder({
      id: 'event::이벤트 응답::16',
      kind: 'event', kindLabel: '이벤트',
      sourceSheet: '이벤트 응답', sourceRow: 16,
      timestamp: sampleStamp(-4), receivedDate: sampleIso(-4),
      eventTitle: '브리보 여름 이벤트',
      insta: '@bora_pick', name: '신보라', phone: '010-1234-0023',
      addr: '서울시 용산구 이태원로 00, 000호',
      qty: 6, flavor: 'peach', status: '출고 완료',
      doneAt: sampleStamp(-3, '15:22:08')
    })
  ];

  const sample = [
    sampleOrder({
      id: 'sample::샘플 응답::3',
      kind: 'sample', kindLabel: '샘플',
      sourceSheet: '샘플 응답', sourceRow: 3,
      timestamp: sampleStamp(0, '11:05:12'), receivedDate: today,
      insta: '@buyer_lee', name: '이현주', phone: '010-1234-0031',
      addr: '서울시 중구 을지로 00, 00층 (올리브영 MD)',
      qty: 12, flavor: 'mix', status: '출고 대기'
    }),
    sampleOrder({
      id: 'sample::샘플 응답::2',
      kind: 'sample', kindLabel: '샘플',
      sourceSheet: '샘플 응답', sourceRow: 2,
      timestamp: sampleStamp(-8), receivedDate: sampleIso(-8),
      insta: '', name: '노경수', phone: '010-1234-0032',
      addr: '경기도 하남시 미사대로 00, 000호',
      qty: 12, flavor: 'mix', status: '출고 완료',
      doneAt: sampleStamp(-7, '13:44:19')
    })
  ];

  const b2b = [
    sampleOrder({
      id: 'b2b::B2B 응답::31',
      kind: 'b2b', kindLabel: 'B2B',
      sourceSheet: 'B2B 응답', sourceRow: 31,
      timestamp: sampleStamp(0, '09:12:44'),
      receivedDate: today,
      receivedAt: sampleStamp(0, '09:12:44'),
      dueDate: today,
      company: '윤잇', branch: '본점',
      name: '서지훈', phone: '010-1234-0041',
      addr: '서울시 강남구 논현로 00, 0층',
      qty: 48, flavor: 'mix',
      b2bProduct: '48캔 (사과 24 + 복숭아 24)',
      status: '오늘 발주'
    }),
    sampleOrder({
      id: 'b2b::B2B 응답::30',
      kind: 'b2b', kindLabel: 'B2B',
      sourceSheet: 'B2B 응답', sourceRow: 30,
      timestamp: sampleStamp(-2, '16:05:20'),
      receivedDate: sampleIso(-2),
      receivedAt: sampleStamp(-2, '16:05:20'),
      dueDate: sampleIso(-2),
      company: '윤잇', branch: '2호점',
      name: '서지훈', phone: '010-1234-0041',
      addr: '서울시 송파구 올림픽로 00, 0층',
      qty: 24, flavor: 'apple',
      b2bProduct: '24캔 (사과)',
      status: '발주 지연'
    }),
    sampleOrder({
      id: 'b2b::B2B 응답::28',
      kind: 'b2b', kindLabel: 'B2B',
      sourceSheet: 'B2B 응답', sourceRow: 28,
      timestamp: sampleStamp(-6, '10:31:02'),
      receivedDate: sampleIso(-6),
      receivedAt: sampleStamp(-6, '10:31:02'),
      dueDate: sampleIso(-6),
      company: '윤잇', branch: '본점',
      name: '서지훈', phone: '010-1234-0041',
      addr: '서울시 강남구 논현로 00, 0층',
      qty: 48, flavor: 'mix',
      b2bProduct: '48캔 (사과 24 + 복숭아 24)',
      status: '출고 완료',
      doneAt: sampleStamp(-5, '14:02:55')
    })
  ];

  const olive = [
    {
      id: 'olive::sample-0001',
      uploadedAt: sampleStamp(0, '10:02:31'),
      fileName: '올리브영_위수탁_위닝_주문서_브리보_샘플(주문서).xlsx',
      fingerprint: 'sample-fingerprint-0001',
      orderCount: 14,
      rowCount: 18,
      appleQty: 96,
      peachQty: 72,
      otherQty: 0,
      status: '미다운로드',
      downloadedAt: '',
      downloadFileName: ''
    },
    {
      id: 'olive::sample-0002',
      uploadedAt: sampleStamp(-3, '09:48:10'),
      fileName: '올리브영_위수탁_위닝_주문서_브리보_샘플2(주문서).xlsx',
      fingerprint: 'sample-fingerprint-0002',
      orderCount: 9,
      rowCount: 11,
      appleQty: 48,
      peachQty: 60,
      otherQty: 0,
      status: '다운로드 완료',
      downloadedAt: sampleStamp(-3, '10:20:44'),
      downloadFileName: '올리브영_위수탁_나인로지스_수동 발주서_양식 (샘플).xlsx'
    }
  ];

  const b2bGroups = sampleB2BGroups(b2b);

  return {
    generatedAt: sampleStamp(0, '00:00:00'),
    today,

    sponsor,
    ambassador,
    event,
    sample,
    b2b,
    b2bGroups,
    olive,

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
