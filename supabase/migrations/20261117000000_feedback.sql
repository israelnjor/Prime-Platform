-- Prime Productivity platform: feedback from the products' in-app forms, and Prime Console's push subscriptions.
-- Everything is reached only through the platform's server (its secret key): row-level security is on with no
-- policies, so the public (publishable) key can read or write nothing here.

create table if not exists public.feedback (
  id             uuid primary key,                         -- made by the product: retries are the same report
  product        text not null check (product ~ '^[a-z0-9-]{2,40}$'),
  category       text not null check (category in ('bug', 'difficulty', 'idea', 'general')),
  description    text not null check (char_length(description) between 3 and 10000),
  email          text not null check (char_length(email) <= 320),
  follow_up      boolean not null default false,
  created_at     timestamptz,                              -- when the tester wrote it (their clock)
  received_at    timestamptz not null default now(),       -- first announced to the platform
  completed_at   timestamptz,                              -- every attachment stored; the owner notified
  install_id     text check (char_length(install_id) <= 64),
  ip_hash        text,
  diagnostics    jsonb not null default '{}'::jsonb,
  attachments    jsonb not null default '[]'::jsonb,       -- [{ file, name, type, size, sha256 }]
  announce_count integer not null default 1,
  status         text not null default 'new' check (status in ('new', 'seen', 'done'))
);
create index if not exists feedback_received on public.feedback (received_at desc);
create index if not exists feedback_install on public.feedback (install_id, received_at);
create index if not exists feedback_ip on public.feedback (ip_hash, received_at);
alter table public.feedback enable row level security;

create table if not exists public.push_subscriptions (
  endpoint     text primary key,
  subscription jsonb not null,
  email        text,
  created_at   timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;

-- Attachments: a private bucket, 10 MB a file; files at <report id>/<a0, a1…>.
insert into storage.buckets (id, name, public, file_size_limit)
values ('feedback', 'feedback', false, 10485760)
on conflict (id) do nothing;
