/* =========================
   접속 설정
   이 파일 하나만 채우면 실제 데이터에 연결됩니다.
   ========================= */

const BREEVO_CONFIG = {
  // Supabase 대시보드 → Project Settings → API Keys 에서 확인할 수 있습니다.
  // 이 두 값은 브라우저에 공개되는 값입니다. 실제 데이터 보호는 RLS(행 단위 접근 제어)가 담당합니다.
  SUPABASE_URL: 'https://bsgxbwoqjjrlkquhgity.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_oEd0VQw0ncyk2BF5BmFFBw_8cz5UXGF',

  // true 로 바꾸면 Supabase 대신 샘플 데이터로 화면을 확인할 수 있습니다.
  FORCE_SAMPLE_MODE: false
};

const IS_SAMPLE_MODE =
  BREEVO_CONFIG.FORCE_SAMPLE_MODE ||
  !BREEVO_CONFIG.SUPABASE_URL ||
  !BREEVO_CONFIG.SUPABASE_ANON_KEY;
