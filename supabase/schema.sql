-- Step 5a: Chats and Messages schema for Beginner Cooking Companion
-- Run in the Supabase SQL Editor.

create table if not exists public.chats (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists chats_updated_at_idx
  on public.chats (updated_at desc);

create table if not exists public.messages (
  id text primary key,
  chat_id uuid not null references public.chats(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  parts jsonb not null,
  created_at timestamptz not null default now()
);

-- Postgres does not auto-index foreign keys; index chat_id + created_at
-- for fast ON DELETE CASCADE and chronological message loading.
create index if not exists messages_chat_id_created_at_idx
  on public.messages (chat_id, created_at asc);

-- Enable RLS with zero public/anon policies so the public Data API is locked down.
-- Our Next.js server connects using SUPABASE_SECRET_KEY (server-only), which bypasses RLS.
alter table public.chats enable row level security;
alter table public.messages enable row level security;
