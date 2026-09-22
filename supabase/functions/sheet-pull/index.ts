/**
 * 구글 시트 → Supabase 자동 동기화
 *
 * 서버가 스스로 구글 시트를 읽어서, 없는 내용을 채워 넣습니다.
 * 1분마다 자동으로 실행됩니다. (설정: 010_schedule_sheet_pull.sql)
 *
 * 특징
 *   · 구글 시트는 읽기만 합니다. 절대 쓰지 않습니다.
 *   · 같은 줄은 몇 번을 돌아도 한 번만 저장됩니다.
 *     (폼 응답은 '시트이름 + 행번호', 나머지는 관리ID 기준)
 *   · 어느 한 번 실패해도 다음 실행 때 다시 가져오므로 누락되지 않습니다.
 *   · 기존 어드민에서 한 수정·완료 처리도 '어드민 관리' 탭을 통해 따라옵니다.
 *
 * 앱스스크립트를 쓰지 않습니다.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const SPREADSHEET_ID = '11ep-MnueHqH3EdmwEQ8BYp0CeC8x-E_WCXH6c0u0LeI';

/** 협찬은 시트 이름에 수량이 들어 있습니다. */
const SPONSOR_SHEETS: Record<string, number> = {
  '12캔 응답': 12,
  '24캔 응답': 24,
  '36캔 응답': 36,
  '48캔 응답': 48,
  '96캔 응답': 96,
};

const SIMPLE_SHEETS: Record<string, { table: string; qty: number }> = {
  '엠베서더 응답': { table: 'ambassador_orders', qty: 12 },
  '이벤트 응답': { table: 'event_orders', qty: 6 },
  '샘플 응답': { table: 'sample_orders', qty: 12 },
};

const ALL_SHEETS = [
  ...Object.keys(SPONSOR_SHEETS),
  ...Object.keys(SIMPLE_SHEETS),
  'B2B 응답',
  '수동 발주',
  '어드민 관리',
];

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

/** 갱신 토큰으로 구글 접근 권한을 받아옵니다. */
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

/** 시트 여러 장을 한 번에 읽어옵니다. 보이는 그대로의 글자로 받습니다. */
async function readSheets(token: string): Promise<Record<string, string[][]>> {
  const ranges = ALL_SHEETS
    .map((s) => `ranges=${encodeURIComponent(`'${s}'!A1:AZ2000`)}`)
    .join('&');

  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values:batchGet`
    + `?${ranges}&valueRenderOption=FORMATTED_VALUE`,
    { headers: { Authorization: `Bearer ${token}` } },
  );

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`시트를 읽지 못했습니다: ${detail.slice(0, 200)}`);
  }

  const data = await res.json();
  const out: Record<string, string[][]> = {};

  (data.valueRanges ?? []).forEach((vr: { range: string; values?: string[][] }, i: number) => {
    out[ALL_SHEETS[i]] = vr.values ?? [];
  });

  return out;
}

function flavorOf(text: string): string | null {
  const t = String(text || '').replace(/\s/g, '');
  const apple = t.includes('사과');
  const peach = t.includes('복숭아');

  if (apple && peach) return 'mix';
  if (apple) return 'apple';
  if (peach) return 'peach';
  return null;
}

/**
 * 시트가 보여주는 날짜 글자를 해석합니다.
 *   '2026. 9. 22 오후 3:04:53'  (폼 응답)
 *   '2026.09.22 15:04:53'       (수동 발주 · 어드민 관리)
 *   '2026-09-22'
 */
function parseDate(text: string): Date | null {
  const s = String(text || '').trim();
  if (!s) return null;

  let m = s.match(
    /^(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})(?:\s*(오전|오후)?\s*(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/,
  );

  if (m) {
    let hour = Number(m[5] ?? 0);
    if (m[4] === '오후' && hour < 12) hour += 12;
    if (m[4] === '오전' && hour === 12) hour = 0;

    return new Date(Date.UTC(
      Number(m[1]), Number(m[2]) - 1, Number(m[3]),
      hour - 9, Number(m[6] ?? 0), Number(m[7] ?? 0),
    ));
  }

  m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/);

  if (m) {
    return new Date(Date.UTC(
      Number(m[1]), Number(m[2]) - 1, Number(m[3]),
      Number(m[4] ?? 0) - 9, Number(m[5] ?? 0), Number(m[6] ?? 0),
    ));
  }

  return null;
}

function isoDate(d: Date | null): string | null {
  if (!d) return null;
  return new Date(d.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

function isoTime(d: Date | null): string | null {
  return d ? d.toISOString() : null;
}

function num(text: string): number | null {
  const n = Number(String(text || '').replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) && String(text).trim() !== '' ? Math.round(n) : null;
}

/** 머리글 이름으로 값을 찾습니다. 열 순서가 바뀌어도 안전합니다. */
function picker(headers: string[]) {
  return (row: string[], keyword: string): string => {
    const i = headers.findIndex((h) => String(h).trim().includes(keyword));
    return i < 0 ? '' : String(row[i] ?? '').trim();
  };
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

    const book = await readSheets(await googleToken());
    const result: Record<string, number> = {};

    /** 표 하나에 한꺼번에 저장합니다. */
    const save = async (table: string, rows: unknown[], conflict: string) => {
      if (!rows.length) return;

      const { error } = await supabase
        .from(table)
        .upsert(rows, { onConflict: conflict, ignoreDuplicates: false });

      if (error) throw new Error(`${table}: ${error.message}`);

      result[table] = (result[table] ?? 0) + rows.length;
    };

    /* ---------- 협찬 ---------- */
    const sponsors: unknown[] = [];

    for (const [sheet, qty] of Object.entries(SPONSOR_SHEETS)) {
      const rows = book[sheet] ?? [];
      if (rows.length < 2) continue;

      const get = picker(rows[0]);

      rows.slice(1).forEach((r, i) => {
        if (!String(r?.[0] ?? '').trim()) return;

        const at = parseDate(get(r, '타임스탬프'));

        sponsors.push({
          source: 'form',
          source_sheet: sheet,
          source_row: i + 2,
          timestamp_raw: get(r, '타임스탬프') || null,
          received_date: isoDate(at),
          insta: get(r, '인스타그램') || null,
          name: get(r, '수령인 성함') || null,
          phone: get(r, '수령인 연락처') || null,
          addr: get(r, '제품 수령 주소') || null,
          event_date: isoDate(parseDate(get(r, '행사 날짜'))),
          qty,
          flavor: flavorOf(get(r, '제공 수량')),
        });
      });
    }

    await save('sponsor_orders', sponsors, 'source_sheet,source_row');

    /* ---------- 엠베서더 · 이벤트 · 샘플 ---------- */
    for (const [sheet, conf] of Object.entries(SIMPLE_SHEETS)) {
      const rows = book[sheet] ?? [];
      if (rows.length < 2) continue;

      const get = picker(rows[0]);
      const list: unknown[] = [];

      rows.slice(1).forEach((r, i) => {
        if (!String(r?.[0] ?? '').trim()) return;

        const at = parseDate(get(r, '타임스탬프'));

        list.push({
          source: 'form',
          source_sheet: sheet,
          source_row: i + 2,
          timestamp_raw: get(r, '타임스탬프') || null,
          received_date: isoDate(at),
          insta: get(r, '인스타그램') || null,
          name: get(r, '수령인 성함') || null,
          phone: get(r, '수령인 연락처') || null,
          addr: get(r, '제품 수령 주소') || null,
          qty: conf.qty,
          flavor: flavorOf(get(r, '제공')),
        });
      });

      await save(conf.table, list, 'source_sheet,source_row');
    }

    /* ---------- B2B ---------- */
    {
      const rows = book['B2B 응답'] ?? [];

      if (rows.length >= 2) {
        const get = picker(rows[0]);
        const list: unknown[] = [];

        rows.slice(1).forEach((r, i) => {
          if (!String(r?.[0] ?? '').trim()) return;

          const at = parseDate(get(r, '타임스탬프'));
          const product = get(r, 'B2B 제품');
          const qty = [...product.matchAll(/(\d+)\s*캔/g)]
            .reduce((sum, m) => sum + Number(m[1]), 0);

          list.push({
            source: 'form',
            source_sheet: 'B2B 응답',
            source_row: i + 2,
            timestamp_raw: get(r, '타임스탬프') || null,
            received_date: isoDate(at),
            received_at: isoTime(at),
            company: get(r, '거래처명') || null,
            branch: get(r, '지점') || null,
            name: get(r, '수령인 성함') || null,
            phone: get(r, '수령인 연락처') || null,
            addr: get(r, '제품 수령 주소') || null,
            qty: qty || null,
            flavor: flavorOf(product),
            b2b_product: product || null,
          });
        });

        await save('b2b_orders', list, 'source_sheet,source_row');
      }
    }

    /* ---------- 수동 발주 ---------- */
    {
      const rows = book['수동 발주'] ?? [];

      if (rows.length >= 2) {
        const get = picker(rows[0]);
        const list: unknown[] = [];

        rows.slice(1).forEach((r) => {
          const mid = get(r, '관리ID');
          if (!mid.includes('::manual::')) return;

          const [kind, , uid] = mid.split('::');

          list.push({
            id: uid,
            kind,
            registered_at: isoTime(parseDate(get(r, '등록일시'))),
            name: get(r, '수령인 성함') || null,
            phone: get(r, '수령인 연락처') || null,
            addr: get(r, '제품 수령 주소') || null,
            qty: num(get(r, '제공 수량')),
            flavor: flavorOf(get(r, '맛 구성')),
            company: get(r, '거래처명') || null,
            item_count: num(get(r, '구성 개수')) ?? 1,
          });
        });

        await save('manual_orders', list, 'id');
      }
    }

    /* ---------- 어드민 관리 (상태·메모·완료일) ---------- */
    {
      const rows = book['어드민 관리'] ?? [];

      if (rows.length >= 2) {
        const get = picker(rows[0]);
        const list: unknown[] = [];

        /* 새 어드민에서 방금 고친 내용을 시트의 옛 값으로 되돌리지 않도록,
           '마지막 수정'이 더 최근인 쪽만 반영합니다. */
        const { data: exist } = await supabase
          .from('order_overrides')
          .select('order_id, updated_at');

        const seen = new Map<string, number>();
        (exist ?? []).forEach((row: { order_id: string; updated_at: string }) => {
          seen.set(row.order_id, new Date(row.updated_at).getTime());
        });

        for (const r of rows.slice(1)) {
          const oid = get(r, '관리ID');
          if (!oid) continue;

          const touched = parseDate(get(r, '마지막 수정'));
          const mine = seen.get(oid);

          if (mine !== undefined && touched && touched.getTime() <= mine) {
            continue;   // 이미 더 최신 내용이 들어 있습니다.
          }

          const hold = ['TRUE', 'Y', '1'].includes(get(r, '보류').toUpperCase());

          list.push({
            order_id: oid,
            kind: get(r, '유형') || null,
            status: get(r, '상태') || null,
            edit_insta: get(r, '수정 인스타그램') || null,
            edit_name: get(r, '수정 수령인') || null,
            edit_phone: get(r, '수정 연락처') || null,
            edit_addr: get(r, '수정 주소') || null,
            edit_event_date: isoDate(parseDate(get(r, '수정 행사 날짜'))),
            edit_qty: num(get(r, '수정 수량')),
            edit_flavor: get(r, '수정 맛 구성') || null,
            memo: get(r, '내부 메모') || null,
            sheet_created_at: isoTime(parseDate(get(r, '발주서 생성일'))),
            done_at: isoTime(parseDate(get(r, '완료일'))),
            hold,
            updated_at: isoTime(touched) ?? new Date().toISOString(),
          });
        }

        await save('order_overrides', list, 'order_id');
      }
    }

    return json({
      success: true,
      저장: result,
      걸린시간_ms: Date.now() - started,
    });

  } catch (error) {
    return json({
      success: false,
      message: error instanceof Error ? error.message : String(error),
      걸린시간_ms: Date.now() - started,
    }, 500);
  }
});
