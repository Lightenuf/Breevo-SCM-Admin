-- 매일 새벽 3시(한국 시간)에 자동 백업합니다.
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 실행하세요.
--
-- Supabase 의 모든 표를 파일 하나로 묶어 구글 드라이브의
-- '브리보 어드민 백업' 폴더에 저장합니다.
--
-- 무료 플랜에는 자동 백업이 없고, 기존 어드민을 끄면 구글 시트에도
-- 완료·메모 기록이 쌓이지 않으므로 이 백업이 유일한 대비책입니다.

select cron.unschedule('backup-daily')
where exists (select 1 from cron.job where jobname = 'backup-daily');

select cron.schedule(
  'backup-daily',
  '0 18 * * *',         -- UTC 18:00 = 한국 시간 새벽 3시
  $$
  select net.http_post(
    url     := 'https://bsgxbwoqjjrlkquhgity.supabase.co/functions/v1/backup-daily',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer sb_publishable_oEd0VQw0ncyk2BF5BmFFBw_8cz5UXGF'
    ),
    body    := '{}'::jsonb
  );
  $$
);

select jobid, jobname, schedule, active from cron.job order by jobid;
