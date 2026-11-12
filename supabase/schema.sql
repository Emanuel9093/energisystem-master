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

-- ---------- Kurspoolen (delas av alla inloggade studenter) ----------
-- Studieplanens kurser och de inbyggda mapparna finns i koden. En rad här
-- ändrar en befintlig kurs/mapp (samma id) eller lägger till en ny.

create table if not exists public.pool_courses (
  id         text primary key check (char_length(id) between 1 and 40),
  data       jsonb not null,
  updated_by text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists public.pool_folders (
  id          text primary key check (char_length(id) between 1 and 40),
  name        text not null check (char_length(name) between 1 and 80),
  description text not null default '' check (char_length(description) <= 1000),
  sort        int not null default 100,
  updated_by  text not null default '',
  updated_at  timestamptz not null default now()
);

alter table public.pool_courses enable row level security;
alter table public.pool_folders enable row level security;

do $$
declare t text;
begin
  foreach t in array array['pool_courses', 'pool_folders'] loop
    execute format('drop policy if exists "Läs kurspoolen" on public.%I', t);
    execute format('create policy "Läs kurspoolen" on public.%I for select to authenticated using (public.email_allowed(auth.jwt() ->> ''email''))', t);
    execute format('drop policy if exists "Lägg till i kurspoolen" on public.%I', t);
    execute format('create policy "Lägg till i kurspoolen" on public.%I for insert to authenticated with check (public.email_allowed(auth.jwt() ->> ''email''))', t);
    execute format('drop policy if exists "Ändra i kurspoolen" on public.%I', t);
    execute format('create policy "Ändra i kurspoolen" on public.%I for update to authenticated using (public.email_allowed(auth.jwt() ->> ''email'')) with check (public.email_allowed(auth.jwt() ->> ''email''))', t);
    execute format('drop policy if exists "Ta bort ur kurspoolen" on public.%I', t);
    execute format('create policy "Ta bort ur kurspoolen" on public.%I for delete to authenticated using (public.email_allowed(auth.jwt() ->> ''email''))', t);
  end loop;
end $$;

-- ---------- Betyg (bara den egna raden syns, aldrig för klasskompisar) ----------

create table if not exists public.grades (
  user_id    uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  grades     jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.grades enable row level security;

drop policy if exists "Egna betyg" on public.grades;
create policy "Egna betyg" on public.grades
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
