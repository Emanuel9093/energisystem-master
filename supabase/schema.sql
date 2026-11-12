-- Kör hela filen i Supabase: SQL Editor → New query → klistra in → Run.
-- Domänlistan nedan måste stämma med ALLOWED_EMAIL_DOMAINS i js/config.js.

-- Vilka e-postdomäner som får använda sidan
create or replace function public.email_allowed(email text)
returns boolean
language sql
immutable
as $$
  select lower(coalesce(email, '')) ~ '@(student\.uu\.se|stud\.slu\.se)$'
$$;

-- Stoppa konton med andra e-postadresser redan när de skapas
create or replace function public.reject_disallowed_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.email_allowed(new.email) then
    raise exception 'Använd din studentadress (@student.uu.se eller @stud.slu.se).';
  end if;
  return new;
end;
$$;

drop trigger if exists check_email_domain on auth.users;
create trigger check_email_domain
  before insert on auth.users
  for each row execute function public.reject_disallowed_email();

-- En rad per student med namn och kursplan
create table if not exists public.plans (
  user_id    uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  name       text not null default '' check (char_length(name) <= 80),
  start_year int check (start_year between 2010 and 2040),
  visible    boolean not null default true,
  plan       jsonb not null default '{"courses": {}, "custom": []}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.plans enable row level security;

drop policy if exists "Läs egen och synliga planer" on public.plans;
create policy "Läs egen och synliga planer" on public.plans
  for select to authenticated
  using (
    user_id = auth.uid()
    or (visible and public.email_allowed(auth.jwt() ->> 'email'))
  );

drop policy if exists "Skapa egen plan" on public.plans;
create policy "Skapa egen plan" on public.plans
  for insert to authenticated
  with check (user_id = auth.uid() and public.email_allowed(auth.jwt() ->> 'email'));

drop policy if exists "Ändra egen plan" on public.plans;
create policy "Ändra egen plan" on public.plans
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Ta bort egen plan" on public.plans;
create policy "Ta bort egen plan" on public.plans
  for delete to authenticated
  using (user_id = auth.uid());
