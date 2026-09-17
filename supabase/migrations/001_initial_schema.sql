-- ============================================================
-- 브리보 발주 어드민 — 데이터베이스 초기 구조
--
-- 기존 구글 스프레드시트(11ep-Mn...)의 탭 12개를 옮긴 것입니다.
-- 구글 시트 원본은 그대로 두고, 복사본만 여기에 보관합니다.
--
-- 열 이름은 기존 시트의 항목을 그대로 따릅니다.
-- ============================================================


-- ============================================================
-- 1. 협찬 주문
--    기존: 12캔/24캔/36캔/48캔/96캔 응답 (5개 탭)
--    → 하나의 표로 합치고, 캔 수는 qty 칸에 기록합니다.
--      어느 탭에서 왔는지는 source_sheet 칸에 남겨둡니다.
-- ============================================================
create table if not exists sponsor_orders (
  id            uuid primary key default gen_random_uuid(),

  source        text not null default 'form',   -- form(구글폼) / manual(수동등록)
  source_sheet  text,                           -- 원본 탭 이름 (예: '24캔 응답')
  source_row    integer,                        -- 원본 행 번호

  timestamp_raw text,                           -- 원본 타임스탬프 문자열 그대로
  received_date date,                           -- 신청일

  insta         text,                           -- 인스타그램 아이디
  name          text,                           -- 수령인 성함
  phone         text,                           -- 수령인 연락처
  addr          text,                           -- 제품 수령 주소

  event_date    date,                           -- 행사 날짜
  qty           integer,                        -- 제공 수량 (12/24/36/48/96)
  flavor        text,                           -- apple / peach / mix

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);


-- ============================================================
-- 2. 엠베서더 주문  (기존: 엠베서더 응답)
--    12캔 고정
-- ============================================================
create table if not exists ambassador_orders (
  id            uuid primary key default gen_random_uuid(),
  source        text not null default 'form',
  source_sheet  text,
  source_row    integer,
  timestamp_raw text,
  received_date date,
  insta         text,
  name          text,
  phone         text,
  addr          text,
  qty           integer default 12,
  flavor        text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);


-- ============================================================
-- 3. 이벤트 주문  (기존: 이벤트 응답)
--    6캔(1박스) 고정. 오배송건 재발송도 이 표에 함께 기록됩니다.
-- ============================================================
create table if not exists event_orders (
  id            uuid primary key default gen_random_uuid(),
  source        text not null default 'form',
  source_sheet  text,
  source_row    integer,
  timestamp_raw text,
  received_date date,
  event_title   text,                           -- 이벤트명
  insta         text,
  name          text,
  phone         text,
  addr          text,
  qty           integer default 6,
  flavor        text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);


-- ============================================================
-- 4. 샘플 주문  (기존: 샘플 응답)
--    12캔 고정, 사과+복숭아 선물세트
-- ============================================================
create table if not exists sample_orders (
  id            uuid primary key default gen_random_uuid(),
  source        text not null default 'form',
  source_sheet  text,
  source_row    integer,
  timestamp_raw text,
  received_date date,
  insta         text,
  name          text,
  phone         text,
  addr          text,
  qty           integer default 12,
  flavor        text default 'mix',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);


-- ============================================================
-- 5. B2B 주문  (기존: B2B 응답)
-- ============================================================
create table if not exists b2b_orders (
  id            uuid primary key default gen_random_uuid(),
  source        text not null default 'form',
  source_sheet  text,
  source_row    integer,
  timestamp_raw text,
  received_date date,
  received_at   timestamptz,                    -- 주문 접수 일시 (거래명세서 기준일)
  company       text,                           -- 거래처명 (예: 윤잇)
  branch        text,                           -- 지점
  name          text,
  phone         text,
  addr          text,
  qty           integer,                        -- 24 / 48
  flavor        text,
  b2b_product   text,                           -- 'B2B 제품 제공' 원문
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);


-- ============================================================
-- 6. 수동 발주  (기존: 수동 발주)
--    어드민 화면에서 직접 등록한 주문
-- ============================================================
create table if not exists manual_orders (
  id            uuid primary key default gen_random_uuid(),
  kind          text not null,                  -- sponsor/amb/event/resend/sample/b2b
  registered_at timestamptz not null default now(),
  name          text,
  phone         text,
  addr          text,
  qty           integer,
  flavor        text,
  company       text,                           -- B2B 거래처명
  item_count    integer default 1,              -- 구성 개수
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);


-- ============================================================
-- 7. 주문 상태·수정 내용  (기존: 어드민 관리)
--    주문 원본은 그대로 두고, 바꾼 내용만 여기에 덮어씁니다.
--    order_id 는 기존 시트의 '관리ID' 와 같은 역할입니다.
-- ============================================================
create table if not exists order_overrides (
  order_id        text primary key,             -- 예: sponsor::24캔 응답::12

  kind            text,                         -- 주문 종류
  status          text,                         -- 발주 완료 / 출고 완료 / 보류 등
  event_title     text,

  edit_insta      text,                         -- 수정 인스타그램
  edit_name       text,                         -- 수정 수령인
  edit_phone      text,                         -- 수정 연락처
  edit_addr       text,                         -- 수정 주소
  edit_event_date date,                         -- 수정 행사 날짜
  edit_qty        integer,                      -- 수정 수량
  edit_flavor     text,                         -- 수정 맛 구성

  memo            text,                         -- 내부 메모
  sheet_created_at timestamptz,                 -- 발주서 생성일
  done_at         timestamptz,                  -- 완료일
  hold            boolean not null default false,-- 보류 여부

  updated_at      timestamptz not null default now()
);


-- ============================================================
-- 8. 올리브영 발주 이력  (기존: 올리브영 발주 이력)
--    업로드 정보와 변환된 배송 행을 나눠서 보관합니다.
-- ============================================================
create table if not exists olive_uploads (
  id              uuid primary key default gen_random_uuid(),
  uploaded_at     timestamptz not null default now(),
  file_name       text,                         -- 원본 파일명
  fingerprint     text unique,                  -- 파일 지문 (같은 파일 재업로드 방지)
  order_count     integer default 0,            -- 주문 건수
  row_count       integer default 0,            -- 발주 행수
  apple_qty       integer default 0,
  peach_qty       integer default 0,
  other_qty       integer default 0,
  status          text default '미다운로드',      -- 미다운로드 / 다운로드 완료
  downloaded_at   timestamptz,
  download_file_name text
);

-- 나인로지스 배송 양식 14개 칸을 그대로 보관합니다.
create table if not exists olive_rows (
  id              uuid primary key default gen_random_uuid(),
  upload_id       uuid not null references olive_uploads(id) on delete cascade,
  row_no          integer,                      -- 행 번호

  sender_name     text,                         -- 보내는분성명
  sender_phone    text,                         -- 보내는분전화번호
  sender_addr     text,                         -- 보내는분주소(전체, 분할)
  receiver_name   text,                         -- 받는분성명
  orderer_name    text,                         -- 주문자성명
  receiver_phone  text,                         -- 받는분전화번호
  receiver_phone2 text,                         -- 받는분기타연락처
  receiver_zip    text,                         -- 받는분우편번호
  receiver_addr   text,                         -- 받는분주소(전체, 분할)
  item_name       text,                         -- 품목명
  delivery_msg    text,                         -- 배송메세지1
  item_qty        integer,                      -- 내품수량
  box_qty         integer,                      -- 박스수량
  tracking_no     text                          -- 운송장번호
);

create index if not exists olive_rows_upload_idx on olive_rows(upload_id);


-- ============================================================
-- 9. 출고 거래처  (기존: 화면 코드에 직접 적혀 있던 8곳)
--    담당자 연락처가 포함되어 코드가 아닌 여기에 보관합니다.
-- ============================================================
create table if not exists shipment_recipients (
  id          uuid primary key default gen_random_uuid(),
  key         text unique not null,             -- 화면에서 쓰는 식별자
  label       text not null,                    -- 목록에 보이는 이름
  company     text,                             -- 업체명
  addr        text,                             -- 주소
  phone       text,                             -- 연락처 (담당자명 포함)
  sort_order  integer default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);


-- ============================================================
-- 10. 관리자 설정  (기존: Apps Script 속성 + 코드에 박혀 있던 값들)
--     이름=값 형태로 보관합니다.
-- ============================================================
create table if not exists admin_settings (
  key         text primary key,
  value       text,
  description text,
  updated_at  timestamptz not null default now()
);

insert into admin_settings (key, value, description) values
  ('lead_days',        '4',                      '협찬 발주 기준일 (행사 며칠 전에 발주할지)'),
  ('logistics_email',  'nine-logis@naver.com',   '요청서 메일 수신처 (나인로지스)'),
  ('scm_email',        'scm@lightenuf.com',      '요청서 메일 발신 계정'),
  ('cc_emails',        'hjkim@lightenuf.com,smeo@lightenuf.com', '메일 참조 허용 주소'),
  ('olive_password',   '1212',                   '올리브영 주문서 파일 암호'),
  ('sender_name',      '라이트이너프(브리보)',      '발주서 보내는분 성명')
on conflict (key) do nothing;


-- ============================================================
-- 11. 접근 제어 (RLS)
--     로그인한 관리자만 데이터를 보고 고칠 수 있게 합니다.
--     로그인하지 않으면 아무것도 조회되지 않습니다.
-- ============================================================
alter table sponsor_orders      enable row level security;
alter table ambassador_orders   enable row level security;
alter table event_orders        enable row level security;
alter table sample_orders       enable row level security;
alter table b2b_orders          enable row level security;
alter table manual_orders       enable row level security;
alter table order_overrides     enable row level security;
alter table olive_uploads       enable row level security;
alter table olive_rows          enable row level security;
alter table shipment_recipients enable row level security;
alter table admin_settings      enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array[
    'sponsor_orders','ambassador_orders','event_orders','sample_orders',
    'b2b_orders','manual_orders','order_overrides','olive_uploads',
    'olive_rows','shipment_recipients','admin_settings'
  ]
  loop
    execute format(
      'create policy "로그인한 관리자만 접근" on %I
         for all
         to authenticated
         using (true)
         with check (true)', t
    );
  end loop;
end $$;
