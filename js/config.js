/* =========================
   접속 설정
   이 파일 하나만 채우면 실제 데이터에 연결됩니다.
   ========================= */

const BREEVO_CONFIG = {
  // Supabase 대시보드 → Project Settings → API Keys 에서 확인할 수 있습니다.
  // 이 두 값은 브라우저에 공개되는 값입니다. 실제 데이터 보호는 RLS(행 단위 접근 제어)가 담당합니다.
  SUPABASE_URL: 'https://bsgxbwoqjjrlkquhgity.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_oEd0VQw0ncyk2BF5BmFFBw_8cz5UXGF',

  // 아직 데이터베이스 테이블을 만들기 전이라 샘플 데이터로 실행합니다.
  // 테이블 생성과 데이터 이전이 끝나면 false 로 바꿔서 실제 데이터에 연결합니다.
  FORCE_SAMPLE_MODE: true
};

const IS_SAMPLE_MODE =
  BREEVO_CONFIG.FORCE_SAMPLE_MODE ||
  !BREEVO_CONFIG.SUPABASE_URL ||
  !BREEVO_CONFIG.SUPABASE_ANON_KEY;
