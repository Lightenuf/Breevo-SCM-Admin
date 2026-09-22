-- 회사 이메일(@lightenuf.com)만 가입할 수 있도록 제한합니다.
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 실행하세요.
--
-- 왜 필요한가:
--   어드민을 인터넷에 공개하면 주소를 아는 누구나 로그인 화면까지는 닿습니다.
--   이 표들의 접근 정책은 "로그인한 사람이면 전부 허용" 이라,
--   외부인이 스스로 가입할 수 있으면 전체 주문 데이터를 보게 됩니다.
--
-- 주의: 이 제한만으로는 충분하지 않습니다. 외부인이 실제로 존재하지 않는
-- abc@lightenuf.com 으로 가입을 시도할 수 있기 때문에, Authentication 설정에서
-- "Confirm email"(이메일 인증)이 반드시 켜져 있어야 합니다.
-- 인증 메일을 받을 수 없는 사람은 로그인 자체가 불가능해집니다.
--
-- 인플루언서 어드민(Influencer-Marketing-Admin)의 0002_restrict_signup_domain.sql
-- 과 같은 방식입니다.

create or replace function public.enforce_email_domain()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is null or lower(new.email) not like '%@lightenuf.com' then
    raise exception 'EMAIL_DOMAIN_NOT_ALLOWED'
      using hint = '회사 이메일(@lightenuf.com)로만 가입할 수 있습니다.';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_email_domain_trigger on auth.users;
create trigger enforce_email_domain_trigger
before insert on auth.users
for each row execute function public.enforce_email_domain();

-- 외부 협력사 등 다른 도메인 계정을 만들어야 할 일이 생기면
-- 아래를 실행해 잠시 제한을 풀고, 계정 생성 후 위 트리거를 다시 만들면 됩니다.
--   drop trigger if exists enforce_email_domain_trigger on auth.users;
