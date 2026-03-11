-- Users of the Stars Duel Telegram Mini App
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  telegram_id bigint not null unique,
  username text,
  first_name text,
  last_name text,
  language_code text,
  photo_url text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

