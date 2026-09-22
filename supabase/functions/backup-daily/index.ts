/**
 * 매일 자동 백업
 *
 * Supabase 의 모든 표를 파일 하나로 묶어 구글 드라이브에 저장합니다.
 * 하루 한 번 자동으로 실행됩니다. (설정: 010_schedule_backup.sql)
 *
 * 왜 구글 드라이브인가:
 *   Supabase 안에 백업을 두면, Supabase 에 문제가 생겼을 때 백업도 같이 사라집니다.
 *   그래서 다른 곳(구글 드라이브)에 둡니다.
 *
 * 무료 플랜에는 자동 백업이 없고, 기존 어드민을 끄면 구글 시트에도
 * 완료·메모 기록이 더 이상 쌓이지 않습니다. 그래서 이 백업이 유일한 대비책입니다.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

/** 백업할 표 (순서는 복구할 때 참고용입니다) */
const TABLES = [
  'sponsor_orders',
  'ambassador_orders',
  'event_orders',
  'sample_orders',
  'b2b_orders',
  'manual_orders',
  'order_overrides',
  'olive_uploads',
  'olive_rows',
  'shipment_recipients',
  'admin_settings',
];

const FOLDER_NAME = '브리보 어드민 백업';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

async function googleToken(): Promise<string> {
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

  if (!res.ok) throw new Error('구글 인증에 실패했습니다.');

  return (await res.json()).access_token;
}

/** 백업 폴더를 찾고, 없으면 만듭니다. */
async function ensureFolder(token: string): Promise<string> {
  const q = encodeURIComponent(
    `name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
  );

  const found = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id)`,
    { headers: { Authorization: `Bearer ${token}` } },
  );

  if (found.ok) {
    const data = await found.json();
    if (data.files?.length) return data.files[0].id;
  }

  const made = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder',
    }),
  });

  if (!made.ok) throw new Error('백업 폴더를 만들지 못했습니다.');

  return (await made.json()).id;
}

async function uploadJson(
  token: string,
  folderId: string,
  fileName: string,
  text: string,
) {
  const boundary = '-----breevobackup' + crypto.randomUUID();

  const body =
    `--${boundary}\r\n` +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify({ name: fileName, parents: [folderId] }) + '\r\n' +
    `--${boundary}\r\n` +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    text + '\r\n' +
    `--${boundary}--`;

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    },
  );

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`백업 저장에 실패했습니다: ${detail.slice(0, 200)}`);
  }

  return await res.json();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors });
  }

  const started = Date.now();

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const dump: Record<string, unknown[]> = {};
    const counts: Record<string, number> = {};

    for (const table of TABLES) {
      const { data, error } = await supabase.from(table).select('*');

      if (error) throw new Error(`${table}: ${error.message}`);

      dump[table] = data ?? [];
      counts[table] = (data ?? []).length;
    }

    const now = new Date(Date.now() + 9 * 3600 * 1000);
    const stamp = now.toISOString().slice(0, 19).replace('T', '_').replace(/:/g, '');

    const token = await googleToken();
    const folderId = await ensureFolder(token);

    const file = await uploadJson(
      token,
      folderId,
      `브리보_어드민_백업_${stamp}.json`,
      JSON.stringify({ 백업시각: now.toISOString(), 건수: counts, 자료: dump }, null, 1),
    );

    return json({
      success: true,
      파일: file.name,
      건수: counts,
      걸린시간_ms: Date.now() - started,
    });

  } catch (error) {
    return json({
      success: false,
      message: error instanceof Error ? error.message : String(error),
    }, 500);
  }
});
