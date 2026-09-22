-- 구글 시트 → Supabase 자동 동기화를 1분마다 실행합니다.
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 실행하세요.
--
-- 하는 일:
--   1분마다 sheet-pull 기능을 호출합니다.
--   그 기능이 구글 시트를 읽어서 새 신청을 채워 넣습니다.
--   시트는 읽기만 하고, 같은 줄은 중복 저장되지 않습니다.

-- 예약 실행과 외부 호출 기능을 켭니다.
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 이미 등록돼 있으면 지우고 다시 만듭니다.
select cron.unschedule('sheet-pull')
where exists (select 1 from cron.job where jobname = 'sheet-pull');

select cron.schedule(
  'sheet-pull',
  '* * * * *',          -- 매 분
  $$
  select net.http_post(
    url     := 'https://bsgxbwoqjjrlkquhgity.supabase.co/functions/v1/sheet-pull',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer sb_publishable_oEd0VQw0ncyk2BF5BmFFBw_8cz5UXGF'
    ),
    body    := '{}'::jsonb
  );
  $$
);

-- 등록 확인
select jobid, jobname, schedule, active from cron.job where jobname = 'sheet-pull';
