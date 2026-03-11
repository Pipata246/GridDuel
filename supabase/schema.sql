-- Users of the Stars Duel Telegram Mini App
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  telegram_id bigint not null unique,
  username text,
  first_name text,
  last_name text,
  language_code text,
  photo_url text,
  balance numeric(18, 2) not null default 0,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

-- История транзакций по звёздам
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  delta numeric(18, 2) not null,
  comment text,
  created_at timestamptz not null default now()
);

create index if not exists idx_transactions_user_created_at
  on public.transactions (user_id, created_at desc);


