-- 서버 기능(Edge Function)이 표에 쓸 수 있도록 권한을 줍니다.
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 실행하세요.
--
-- 왜 필요한가:
--   003 에서 로그인한 관리자(authenticated)에게만 권한을 줬습니다.
--   구글 폼 신청을 받아 저장하는 sheet-sync 기능은 서버 권한(service_role)으로
--   동작하는데, 그 권한이 없어서 저장이 거부됩니다.
--
--   service_role 키는 서버에만 있고 브라우저에는 절대 내려가지 않습니다.

grant usage on schema public to service_role;

grant select, insert, update, delete
  on all tables in schema public
  to service_role;

grant usage, select on all sequences in schema public to service_role;

-- 앞으로 새로 만드는 표에도 같은 권한이 자동으로 붙도록 합니다.
alter default privileges in schema public
  grant select, insert, update, delete on tables to service_role;

alter default privileges in schema public
  grant usage, select on sequences to service_role;
