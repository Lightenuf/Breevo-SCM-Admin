/* =========================
   접속 설정
   이 파일 하나만 채우면 실제 데이터에 연결됩니다.
   ========================= */

const BREEVO_CONFIG = {
  // Supabase 대시보드 → Settings → API 에서 복사해서 넣어주세요.
  SUPABASE_URL: '',
  SUPABASE_ANON_KEY: '',

  // 위 두 값이 비어 있으면 자동으로 샘플 데이터로 실행됩니다.
  // 실제 연결 후에도 강제로 샘플을 보고 싶으면 true 로 바꾸세요.
  FORCE_SAMPLE_MODE: false
};

const IS_SAMPLE_MODE =
  BREEVO_CONFIG.FORCE_SAMPLE_MODE ||
  !BREEVO_CONFIG.SUPABASE_URL ||
  !BREEVO_CONFIG.SUPABASE_ANON_KEY;
