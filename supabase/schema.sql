-- Kör hela filen i Supabase: SQL Editor → New query → klistra in → Run.
-- Vem som helst kan skapa ett konto med e-post och lösenord. Allt nedan kräver inloggning
-- (rollen authenticated); Row Level Security avgör sedan vilka rader man kommer åt.

-- Äldre version släppte bara in studentmejl. Ta bort den spärren om den finns.
drop trigger if exists check_email_domain on auth.users;
drop function if exists public.reject_disallowed_email();

-- En rad per student med namn och kursplan
create table if not exists public.plans (
  user_id    uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  name       text not null default '' check (char_length(name) <= 80),
  start_year int check (start_year between 2010 and 2040),
  hide_done  boolean not null default false,
  plan       jsonb not null default '{"rows": {}, "summers": [], "items": []}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Äldre version hade "visible". Nu syns alla planer, men man kan dölja sina avklarade kurser.
alter table public.plans add column if not exists hide_done boolean not null default false;
alter table public.plans drop column if exists visible;

alter table public.plans enable row level security;

-- Direkt läsning: bara den egna planen. Klasskompisarnas planer hämtas via
-- classmate_plans() nedan, som tar bort avklarade kurser för den som valt att dölja dem.
drop policy if exists "Läs egen och synliga planer" on public.plans;
drop policy if exists "Läs egen plan" on public.plans;
create policy "Läs egen plan" on public.plans
  for select to authenticated
  using (user_id = auth.uid());

create or replace function public.classmate_plans()
returns table (user_id uuid, name text, start_year int, hide_done boolean, plan jsonb, updated_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select p.user_id, p.name, p.start_year, p.hide_done,
    case when p.hide_done then jsonb_set(p.plan, '{items}', coalesce(
      (select jsonb_agg(i) from jsonb_array_elements(coalesce(p.plan -> 'items', '[]'::jsonb)) i where i ->> 'status' is distinct from 'done'),
      '[]'::jsonb))
    else p.plan end,
    p.updated_at
  from public.plans p
  where auth.uid() is not null
    and p.user_id <> auth.uid()
    and p.name <> ''
$$;

revoke all on function public.classmate_plans() from public, anon;
grant execute on function public.classmate_plans() to authenticated;

drop policy if exists "Skapa egen plan" on public.plans;
create policy "Skapa egen plan" on public.plans
  for insert to authenticated
  with check (user_id = auth.uid() and auth.uid() is not null);

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
    execute format('create policy "Läs kurspoolen" on public.%I for select to authenticated using (auth.uid() is not null)', t);
    execute format('drop policy if exists "Lägg till i kurspoolen" on public.%I', t);
    execute format('create policy "Lägg till i kurspoolen" on public.%I for insert to authenticated with check (auth.uid() is not null)', t);
    execute format('drop policy if exists "Ändra i kurspoolen" on public.%I', t);
    execute format('create policy "Ändra i kurspoolen" on public.%I for update to authenticated using (auth.uid() is not null) with check (auth.uid() is not null)', t);
    execute format('drop policy if exists "Ta bort ur kurspoolen" on public.%I', t);
    execute format('create policy "Ta bort ur kurspoolen" on public.%I for delete to authenticated using (auth.uid() is not null)', t);
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

-- ---------- Skydd för kurspoolen ----------
-- "Ändrad av" sätts av databasen (namnet i ens plan, annars e-post) så att ingen kan låtsas vara någon annan.
create or replace function public.pool_set_editor()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_by := coalesce(
    nullif((select name from public.plans where user_id = auth.uid()), ''),
    auth.jwt() ->> 'email',
    ''
  );
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists pool_courses_editor on public.pool_courses;
create trigger pool_courses_editor before insert or update on public.pool_courses
  for each row execute function public.pool_set_editor();
drop trigger if exists pool_folders_editor on public.pool_folders;
create trigger pool_folders_editor before insert or update on public.pool_folders
  for each row execute function public.pool_set_editor();

-- Begränsa storleken på en kurs
alter table public.pool_courses drop constraint if exists pool_courses_data_size;
alter table public.pool_courses add constraint pool_courses_data_size check (pg_column_size(data) < 8000);

-- Historik: varje ändring och borttagning sparas, så att klotter kan återställas.
create table if not exists public.pool_history (
  id         bigint generated always as identity primary key,
  table_name text not null,
  row_id     text not null,
  action     text not null,
  old_row    jsonb,
  new_row    jsonb,
  changed_by text not null default coalesce(auth.jwt() ->> 'email', ''),
  changed_at timestamptz not null default now()
);
alter table public.pool_history enable row level security;
-- Ingen policy: historiken kan bara läsas av administratören i Supabase-panelen.

create or replace function public.pool_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    insert into public.pool_history (table_name, row_id, action, old_row, new_row)
    values (tg_table_name, old.id, tg_op, to_jsonb(old), null);
    return old;
  end if;
  insert into public.pool_history (table_name, row_id, action, old_row, new_row)
  values (tg_table_name, new.id, tg_op, case when tg_op = 'UPDATE' then to_jsonb(old) end, to_jsonb(new));
  return new;
end;
$$;

drop trigger if exists pool_courses_log on public.pool_courses;
create trigger pool_courses_log after insert or update or delete on public.pool_courses
  for each row execute function public.pool_log();
drop trigger if exists pool_folders_log on public.pool_folders;
create trigger pool_folders_log after insert or update or delete on public.pool_folders
  for each row execute function public.pool_log();

-- ---------- Behörigheter för Data API ----------
-- Projektet skapas med "Automatically expose new tables" avstängt, så vi ger exakt de
-- rättigheter sidan behöver. Bara inloggade (authenticated) kommer åt något, och
-- Row Level Security ovan avgör vilka rader. Utloggade (anon) kommer inte åt några tabeller.
grant usage on schema public to anon, authenticated;

revoke all on public.plans, public.pool_courses, public.pool_folders, public.grades, public.pool_history from anon, authenticated;
grant select, insert, update, delete on public.plans to authenticated;
grant select, insert, update, delete on public.pool_courses to authenticated;
grant select, insert, update, delete on public.pool_folders to authenticated;
grant select, insert, update, delete on public.grades to authenticated;
-- pool_history: ingen åtkomst via API:t, bara via Supabase-panelen.

-- Funktioner: bara de som sidan anropar får köras av inloggade.
revoke execute on function public.pool_set_editor(), public.pool_log() from public, anon, authenticated;
grant execute on function public.classmate_plans() to authenticated;

-- Rester från versionen med studentmejl (körs sist, när inga policyer använder funktionen längre)
drop function if exists public.email_allowed(text);
