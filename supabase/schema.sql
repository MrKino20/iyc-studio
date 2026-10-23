-- Galeries clients IYC Studio.
-- À coller dans Supabase : SQL Editor → New query → Run.
-- Les photos restent dans un bucket privé. Seul le serveur (clé service_role) y accède.

create table if not exists public.galleries (
  id text primary key,
  code text not null unique,
  client_name text not null,
  email text not null default '',
  session_date date,
  max_photos integer not null default 10 check (max_photos between 1 and 500),
  password_salt text not null,
  password_hash text not null,
  selection_photo_ids text[] not null default '{}',
  selection_submitted_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.gallery_photos (
  id text primary key,
  gallery_id text not null references public.galleries(id) on delete cascade,
  filename text not null default 'photo',
  ext text not null check (ext in ('.jpg', '.png', '.webp', '.gif')),
  position integer not null default 0
);

create index if not exists gallery_photos_gallery_idx on public.gallery_photos (gallery_id, position);

alter table public.galleries enable row level security;
alter table public.gallery_photos enable row level security;

insert into storage.buckets (id, name, public)
values ('private-galleries', 'private-galleries', false)
on conflict (id) do nothing;
