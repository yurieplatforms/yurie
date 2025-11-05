-- Profiles table and sync with auth.users

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  first_name text,
  last_name text,
  full_name text,
  name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create index if not exists profiles_email_idx on public.profiles(email);

-- RLS policies: users can read/update their own profile
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select using (auth.uid() = user_id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Keep updated_at fresh on client updates as well
drop function if exists public.set_profile_updated_at();
create function public.set_profile_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_profile_updated_at on public.profiles;
create trigger set_profile_updated_at
  before update on public.profiles
  for each row execute function public.set_profile_updated_at();

-- Trigger: insert row on new auth user
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  md jsonb;
  fn text;
  ln text;
  nm text;
  full_name_val text;
begin
  md := new.raw_user_meta_data;
  fn := coalesce(md->>'first_name', null);
  ln := coalesce(md->>'last_name', null);
  nm := coalesce(md->>'name', null);
  full_name_val := coalesce(md->>'full_name', nm, nullif(trim(concat_ws(' ', fn, ln)), ''));

  insert into public.profiles (user_id, email, first_name, last_name, full_name, name)
  values (new.id, new.email, fn, ln, full_name_val, coalesce(full_name_val, nm));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Trigger: update profile when auth.users metadata/email changes
drop trigger if exists on_auth_user_updated on auth.users;
drop function if exists public.handle_user_metadata_updated();
create function public.handle_user_metadata_updated()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  md jsonb;
  fn text;
  ln text;
  nm text;
  full_name_val text;
begin
  md := new.raw_user_meta_data;
  fn := coalesce(md->>'first_name', null);
  ln := coalesce(md->>'last_name', null);
  nm := coalesce(md->>'name', null);
  full_name_val := coalesce(md->>'full_name', nm, nullif(trim(concat_ws(' ', fn, ln)), ''));

  update public.profiles
    set email = new.email,
        first_name = fn,
        last_name = ln,
        full_name = full_name_val,
        name = coalesce(full_name_val, nm),
        updated_at = now()
  where user_id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_updated
  after update of raw_user_meta_data, email on auth.users
  for each row execute function public.handle_user_metadata_updated();

-- One-time backfill for existing users (safe to re-run)
insert into public.profiles (user_id, email, first_name, last_name, full_name, name)
select
  u.id,
  u.email,
  u.raw_user_meta_data->>'first_name',
  u.raw_user_meta_data->>'last_name',
  coalesce(
    u.raw_user_meta_data->>'full_name',
    u.raw_user_meta_data->>'name',
    nullif(trim(concat_ws(' ', u.raw_user_meta_data->>'first_name', u.raw_user_meta_data->>'last_name')), '')
  ),
  coalesce(
    u.raw_user_meta_data->>'full_name',
    u.raw_user_meta_data->>'name',
    nullif(trim(concat_ws(' ', u.raw_user_meta_data->>'first_name', u.raw_user_meta_data->>'last_name')), '')
  )
from auth.users u
on conflict (user_id) do update set
  email = excluded.email,
  first_name = excluded.first_name,
  last_name = excluded.last_name,
  full_name = excluded.full_name,
  name = excluded.name,
  updated_at = now();


