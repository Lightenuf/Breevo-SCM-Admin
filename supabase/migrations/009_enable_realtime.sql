-- 어드민 화면이 새로고침 없이 갱신되도록, 변경 알림을 켭니다.
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 실행하세요.
--
-- 자동 동기화가 새 신청을 넣으면 Supabase 가 열려 있는 어드민에 알려주고,
-- 어드민이 알아서 목록을 다시 불러옵니다.

do $$
declare
  t text;
begin
  foreach t in array array[
    'sponsor_orders', 'ambassador_orders', 'event_orders',
    'sample_orders', 'b2b_orders', 'manual_orders',
    'order_overrides', 'olive_uploads'
  ]
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- 확인
select tablename as 알림켜진표
from pg_publication_tables
where pubname = 'supabase_realtime' and schemaname = 'public'
order by tablename;
