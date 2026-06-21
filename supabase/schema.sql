-- Clawd PFP Avatar Generator schema.
-- Run this in the Supabase SQL editor.

create extension if not exists pgcrypto;

create table if not exists public.avatars (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  image_url text not null,
  storage_path text not null,
  owner_wallet text,
  accessories jsonb not null default '{}'::jsonb,
  metadata_url text,
  nft_mint text,
  nft_signature text
);

alter table public.avatars enable row level security;

-- Public gallery reads. Writes happen through the server API using the service role key.
drop policy if exists "avatars are publicly readable" on public.avatars;
create policy "avatars are publicly readable"
  on public.avatars for select
  using (true);

-- Optional direct inserts from anon clients are intentionally disabled.
-- The server route inserts with the service role key.

-- Make the storage bucket public for generated avatar images and metadata.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  10485760,
  array['image/png', 'image/webp', 'image/jpeg', 'application/json']
)
on conflict (id) do update
set public = true,
    file_size_limit = 10485760,
    allowed_mime_types = array['image/png', 'image/webp', 'image/jpeg', 'application/json'];

-- Public can read files in the bucket.
drop policy if exists "avatars storage is publicly readable" on storage.objects;
create policy "avatars storage is publicly readable"
  on storage.objects for select
  using (bucket_id = 'avatars');

-- Realtime publication for the gallery.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'avatars'
  ) then
    alter publication supabase_realtime add table public.avatars;
  end if;
end $$;
