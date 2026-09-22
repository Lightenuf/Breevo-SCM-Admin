/**
 * SCM 메일 발송 + Google Drive 저장
 *
 * 기존 SCM 전용 Apps Script(SCM 코드.txt)가 하던 일을 그대로 옮긴 것입니다.
 * 검사 규칙(제목·본문 필수, 첨부 20MB 제한, 참조 화이트리스트, xlsx만 허용)도
 * 원본과 동일하게 유지했습니다.
 *
 * 브라우저에는 인증 정보를 두지 않고, 여기(서버)에서만 사용합니다.
 */

const CONFIG = {
  // 받는 주소는 서버에서 고정합니다. 화면에서 바꿀 수 없습니다.
  LOGISTICS_EMAIL: 'nine-logis@naver.com',
  SCM_EMAIL: 'scm@lightenuf.com',
  SENDER_NAME: '라이트이너프 SCM',

  ALLOWED_CC: [
    'hjkim@lightenuf.com',
    'smeo@lightenuf.com',
  ],

  MAX_ATTACHMENT_BYTES: 20 * 1024 * 1024,
};

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

/** 파일명에 쓸 수 없는 문자를 정리합니다 (원본 safeFileName_ 과 동일) */
function safeFileName(value: unknown): string {
  const name = String(value || 'Breevo_요청서.xlsx')
    .replace(/[\\/:*?"<>|]/g, '_')
    .trim();

  if (!/\.xlsx$/i.test(name)) {
    throw new Error('XLSX 첨부파일만 전송할 수 있습니다.');
  }

  return name;
}

/** 갱신 토큰으로 접근 권한을 받아옵니다 */
async function getAccessToken(): Promise<string> {
  const body = new URLSearchParams({
    client_id: Deno.env.get('GOOGLE_CLIENT_ID') ?? '',
    client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET') ?? '',
    refresh_token: Deno.env.get('GOOGLE_REFRESH_TOKEN') ?? '',
    grant_type: 'refresh_token',
  });

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!res.ok) {
    throw new Error('Google 인증에 실패했습니다. 관리자에게 문의해주세요.');
  }

  const data = await res.json();
  return data.access_token;
}

/** 바이트 배열을 base64 문자열로 (큰 파일도 안전하게 나눠서 처리) */
function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;

  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }

  return btoa(binary);
}

/**
 * 같은 이름의 파일이 이미 있으면 (2), (3) … 을 붙입니다.
 * 기존 어드민의 저장 규칙과 동일합니다.
 */
async function uniqueFileName(
  accessToken: string,
  folderId: string,
  fileName: string,
): Promise<string> {
  if (!folderId) return fileName;

  const dot = fileName.lastIndexOf('.');
  const base = dot > 0 ? fileName.slice(0, dot) : fileName;
  const ext = dot > 0 ? fileName.slice(dot) : '';

  for (let n = 1; n <= 50; n++) {
    const candidate = n === 1 ? fileName : `${base} (${n})${ext}`;

    const query = encodeURIComponent(
      `name='${candidate.replace(/'/g, "\\'")}' and '${folderId}' in parents and trashed=false`,
    );

    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id)&supportsAllDrives=true&includeItemsFromAllDrives=true`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );

    if (!res.ok) return candidate;

    const data = await res.json();

    if (!data.files || data.files.length === 0) {
      return candidate;
    }
  }

  return fileName;
}

/** Drive 지정 폴더에 파일을 저장합니다 */
async function saveToDrive(
  accessToken: string,
  folderId: string,
  fileName: string,
  bytes: Uint8Array,
) {
  const metadata = {
    name: fileName,
    parents: folderId ? [folderId] : undefined,
  };

  const boundary = '-----breevo' + crypto.randomUUID();

  const head =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\r\n` +
    `Content-Transfer-Encoding: base64\r\n\r\n`;

  const tail = `\r\n--${boundary}--`;

  const body =
    new TextEncoder().encode(head + bytesToBase64(bytes) + tail);

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    },
  );

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Drive 저장에 실패했습니다: ${detail.slice(0, 200)}`);
  }

  return await res.json();
}

/** Gmail로 메일을 보냅니다 */
async function sendMail(
  accessToken: string,
  opts: {
    subject: string;
    body: string;
    cc: string[];
    fileName: string;
    bytes: Uint8Array;
  },
) {
  const boundary = '-----breevomail' + crypto.randomUUID();

  const headers = [
    `To: ${CONFIG.LOGISTICS_EMAIL}`,
    `From: =?UTF-8?B?${btoa(unescape(encodeURIComponent(CONFIG.SENDER_NAME)))}?= <${CONFIG.SCM_EMAIL}>`,
    opts.cc.length ? `Cc: ${opts.cc.join(', ')}` : '',
    `Reply-To: ${CONFIG.SCM_EMAIL}`,
    `Subject: =?UTF-8?B?${btoa(unescape(encodeURIComponent(opts.subject)))}?=`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
  ].filter(Boolean).join('\r\n');

  const mail =
    headers + '\r\n\r\n' +
    `--${boundary}\r\n` +
    'Content-Type: text/plain; charset="UTF-8"\r\n' +
    'Content-Transfer-Encoding: base64\r\n\r\n' +
    btoa(unescape(encodeURIComponent(opts.body))) + '\r\n' +
    `--${boundary}\r\n` +
    'Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\r\n' +
    'Content-Transfer-Encoding: base64\r\n' +
    `Content-Disposition: attachment; filename="=?UTF-8?B?${btoa(unescape(encodeURIComponent(opts.fileName)))}?="\r\n\r\n` +
    bytesToBase64(opts.bytes) + '\r\n' +
    `--${boundary}--`;

  const raw = btoa(unescape(encodeURIComponent(mail)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  const res = await fetch(
    'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw }),
    },
  );

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`메일 발송에 실패했습니다: ${detail.slice(0, 200)}`);
  }

  return await res.json();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors });
  }

  try {
    /* 로그인한 관리자만 호출할 수 있게 확인합니다. */
    const auth = req.headers.get('Authorization') ?? '';

    if (!auth.startsWith('Bearer ')) {
      return json({ success: false, message: '로그인이 필요합니다.' }, 401);
    }

    const userRes = await fetch(
      `${Deno.env.get('SUPABASE_URL')}/auth/v1/user`,
      {
        headers: {
          Authorization: auth,
          apikey: Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        },
      },
    );

    if (!userRes.ok) {
      return json({ success: false, message: '로그인 정보를 확인하지 못했습니다.' }, 401);
    }

    const payload = await req.json();

    const subject = String(payload?.subject ?? '').trim();
    const body = String(payload?.body ?? '').trim();
    const base64 = String(payload?.base64 ?? '').replace(/\s/g, '');
    const requestType = payload?.requestType === 'inbound' ? 'inbound' : 'outbound';

    /* mode: 'save' = Drive 저장만 / 'send' = 저장 후 메일까지 */
    const mode = payload?.mode === 'save' ? 'save' : 'send';

    if (!base64) throw new Error('첨부파일 데이터가 없습니다.');

    /* 메일을 보낼 때만 제목·본문을 확인합니다 (원본과 동일) */
    if (mode === 'send') {
      if (!subject) throw new Error('메일 제목을 입력해주세요.');
      if (!body) throw new Error('메일 내용을 입력해주세요.');
      if (subject.length > 250) throw new Error('메일 제목은 250자 이내로 입력해주세요.');
    }

    const fileName = safeFileName(payload?.fileName);

    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

    if (bytes.length > CONFIG.MAX_ATTACHMENT_BYTES) {
      throw new Error('첨부파일은 20MB 이하만 전송할 수 있습니다.');
    }

    /* 참조는 허용된 주소만 남깁니다 */
    const requested: string[] = Array.isArray(payload?.cc) ? payload.cc : [];
    const cc = [...new Set(
      requested
        .map((v) => String(v ?? '').trim().toLowerCase())
        .filter((v) => CONFIG.ALLOWED_CC.includes(v)),
    )];

    const accessToken = await getAccessToken();

    /* 먼저 Drive에 저장하고, 성공하면 메일을 보냅니다 (원본과 같은 순서) */
    const folderId = requestType === 'inbound'
      ? (Deno.env.get('DRIVE_INBOUND_FOLDER_ID') ?? '')
      : (Deno.env.get('DRIVE_SHIPMENT_FOLDER_ID') ?? '');

    let driveFile: { id?: string } = {};
    let savedName = fileName;

    if (folderId) {
      savedName = await uniqueFileName(accessToken, folderId, fileName);
      driveFile = await saveToDrive(accessToken, folderId, savedName, bytes);
    }

    if (mode === 'send') {
      await sendMail(accessToken, { subject, body, cc, fileName: savedName, bytes });
    }

    const sentAt = new Intl.DateTimeFormat('ko-KR', {
      timeZone: 'Asia/Seoul',
      hour12: false,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).format(new Date()).replace(/\. /g, '.').replace(/\.$/, '');

    return json({
      success: true,
      mode,
      to: mode === 'send' ? CONFIG.LOGISTICS_EMAIL : '',
      cc: mode === 'send' ? cc : [],
      fileName: savedName,
      fileId: driveFile.id ?? '',
      sentAt,
    });

  } catch (error) {
    return json({
      success: false,
      message: error instanceof Error ? error.message : String(error),
    }, 400);
  }
});
