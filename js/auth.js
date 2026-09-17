/* =========================
   로그인
   로그인한 사람만 어드민 화면으로 들어갈 수 있게 합니다.
   로그인에 성공해야 views.js(실제 어드민 화면)를 불러옵니다.
   ========================= */

const supabaseClient = window.supabase.createClient(
  BREEVO_CONFIG.SUPABASE_URL,
  BREEVO_CONFIG.SUPABASE_ANON_KEY
);

let currentUser = null;

function renderLogin(errorMessage = '') {
  document.getElementById('app').innerHTML = `
    <div class="login-wrap">
      <div class="login-card">

        <div class="login-title">로그인</div>
        <div class="login-desc">
          등록된 관리자 계정으로 로그인해주세요.
        </div>

        <form id="loginForm">
          <div class="login-field">
            <label class="login-label" for="loginEmail">이메일</label>
            <input
              class="login-input"
              id="loginEmail"
              type="email"
              autocomplete="username"
              placeholder="name@lightenuf.com"
              required
            >
          </div>

          <div class="login-field">
            <label class="login-label" for="loginPassword">비밀번호</label>
            <input
              class="login-input"
              id="loginPassword"
              type="password"
              autocomplete="current-password"
              placeholder="비밀번호를 입력해주세요"
              required
            >
          </div>

          <button class="login-btn" id="loginSubmit" type="submit">
            로그인
          </button>
        </form>

        ${errorMessage ? `<div class="login-error">${errorMessage}</div>` : ''}

        <div class="login-note">
          계정이 없으시면 관리자에게 요청해주세요.<br>
          비밀번호를 잊으신 경우에도 관리자에게 문의하시면 재설정해드립니다.
        </div>

      </div>
    </div>
  `;

  document
    .getElementById('loginForm')
    .addEventListener('submit', handleLoginSubmit);

  document.getElementById('loginEmail').focus();
}

async function handleLoginSubmit(e) {
  e.preventDefault();

  const button = document.getElementById('loginSubmit');
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;

  button.disabled = true;
  button.textContent = '로그인 중…';

  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    renderLogin(loginErrorMessage(error));
    document.getElementById('loginEmail').value = email;
    document.getElementById('loginPassword').focus();
    return;
  }

  currentUser = data.user;
  startAdmin();
}

function loginErrorMessage(error) {
  const raw = String(error?.message || '');

  if (raw.includes('Invalid login credentials')) {
    return '이메일 또는 비밀번호가 맞지 않습니다. 다시 확인해주세요.';
  }

  if (raw.includes('Email not confirmed')) {
    return '아직 사용 승인이 되지 않은 계정입니다. 관리자에게 문의해주세요.';
  }

  if (raw.includes('Failed to fetch') || raw.includes('NetworkError')) {
    return '서버에 연결하지 못했습니다. 인터넷 연결을 확인해주세요.';
  }

  return '로그인에 실패했습니다. 잠시 후 다시 시도해주세요.';
}

async function signOutAdmin() {
  await supabaseClient.auth.signOut();
  currentUser = null;
  window.location.reload();
}

/* 로그인 성공 후 실제 어드민 화면(views.js)을 불러옵니다.
   한 번만 불러오도록 표시를 남깁니다. */
let adminStarted = false;

function startAdmin() {
  if (adminStarted) return;
  adminStarted = true;

  document.getElementById('app').innerHTML = '';

  const script = document.createElement('script');
  script.src = 'js/views.js';
  document.body.appendChild(script);
}

/* 이미 로그인한 적이 있으면 바로 들어갑니다. */
(async function bootstrap() {
  const { data } = await supabaseClient.auth.getSession();

  if (data?.session?.user) {
    currentUser = data.session.user;
    startAdmin();
    return;
  }

  renderLogin();
})();
