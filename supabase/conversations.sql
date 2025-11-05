-- Conversations table and RLS policies

create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  title text not null,
  messages jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table conversations enable row level security;

create index if not exists conversations_user_id_idx on conversations(user_id);
create index if not exists conversations_updated_at_idx on conversations(updated_at desc);

drop policy if exists "conversations_select_own" on conversations;
create policy "conversations_select_own"
  on conversations for select using (auth.uid() = user_id);

drop policy if exists "conversations_insert_own" on conversations;
create policy "conversations_insert_own"
  on conversations for insert with check (auth.uid() = user_id);

drop policy if exists "conversations_update_own" on conversations;
create policy "conversations_update_own"
  on conversations for update using (auth.uid() = user_id);

drop policy if exists "conversations_delete_own" on conversations;
create policy "conversations_delete_own"
  on conversations for delete using (auth.uid() = user_id);


