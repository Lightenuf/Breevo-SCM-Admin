-- ============================================================
-- 로그인한 관리자에게 표 접근 권한 부여
--
-- 001에서 RLS(행 단위 접근 제어)는 걸었지만,
-- 그보다 앞서 확인되는 '표 자체를 열어볼 권한'이 빠져 있었습니다.
-- 그래서 로그인해도 "permission denied for table" 오류가 났습니다.
--
-- 로그인하지 않은 사용자(anon)에게는 권한을 주지 않습니다.
-- ============================================================

grant usage on schema public to authenticated;

grant select, insert, update, delete
  on all tables in schema public
  to authenticated;

grant usage, select
  on all sequences in schema public
  to authenticated;

-- 앞으로 새로 만드는 표에도 같은 권한이 자동 적용되도록 합니다.
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;

alter default privileges in schema public
  grant usage, select on sequences to authenticated;


-- 확인용: 로그인 사용자가 접근할 수 있는 표 목록
select table_name as 표이름, string_agg(privilege_type, ', ' order by privilege_type) as 권한
from information_schema.role_table_grants
where grantee = 'authenticated'
  and table_schema = 'public'
group by table_name
order by table_name;
