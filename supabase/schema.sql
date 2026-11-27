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

-- Step 5b: Recipes table and pgvector semantic search
-- Run in the Supabase SQL Editor.

create extension if not exists vector;

create table if not exists public.recipes (
  id text primary key,
  source_type text not null check (source_type in ('mealdb', 'web')),
  title text not null,
  category text,
  area text,
  ingredients jsonb not null,
  instructions text not null,
  thumbnail_url text,
  source_url text not null,
  source_name text not null,
  credit_text text not null,
  youtube_url text,
  structured_recipe jsonb,
  embedding vector(768) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists recipes_embedding_idx
  on public.recipes using hnsw (embedding vector_cosine_ops);

create index if not exists recipes_source_type_idx
  on public.recipes (source_type);

alter table public.recipes enable row level security;

create or replace function public.match_recipes(
  query_embedding vector(768),
  query_text text default '',
  match_threshold double precision default 0.5,
  match_count int default 3,
  match_offset int default 0
)
returns table (
  id text,
  source_type text,
  title text,
  category text,
  area text,
  ingredients jsonb,
  instructions text,
  thumbnail_url text,
  source_url text,
  source_name text,
  credit_text text,
  youtube_url text,
  similarity double precision,
  total_matches bigint
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  select
    r.id,
    r.source_type,
    r.title,
    r.category,
    r.area,
    r.ingredients,
    r.instructions,
    r.thumbnail_url,
    r.source_url,
    r.source_name,
    r.credit_text,
    r.youtube_url,
    (1 - (r.embedding <=> query_embedding))::double precision as similarity,
    count(*) over() as total_matches
  from public.recipes r
  where (1 - (r.embedding <=> query_embedding)) >= match_threshold
  order by
    (
      btrim(coalesce(query_text, '')) <> ''
      and position(lower(btrim(query_text)) in lower(r.title)) > 0
    ) desc,
    r.embedding <=> query_embedding asc
  limit greatest(match_count, 1)
  offset greatest(match_offset, 0);
$$;
