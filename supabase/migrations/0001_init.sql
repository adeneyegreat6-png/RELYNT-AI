-- Relynt AI core schema.
-- Run in the Supabase SQL editor (or `supabase db push`).
-- Every table has RLS on. Users can only READ their own rows from the browser;
-- all writes happen on the server, which verifies the session first.

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  request text not null,
  summary text not null,
  questions jsonb not null default '[]'::jsonb,
  status text not null default 'proposed'
    check (status in ('proposed', 'completed', 'cancelled')),
  created_at timestamptz not null default now()
);
create index plans_user_created on public.plans (user_id, created_at desc);

create table public.actions (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  position int not null,
  type text not null
    check (type in ('create_calendar_event', 'create_task', 'create_email_draft', 'research')),
  payload jsonb not null,
  reason text not null default '',
  status text not null default 'proposed'
    check (status in ('proposed', 'rejected', 'executing', 'succeeded', 'failed', 'cancelled')),
  result jsonb,
  error text,
  executed_at timestamptz,
  created_at timestamptz not null default now()
);
create index actions_user_created on public.actions (user_id, created_at desc);
create index actions_plan on public.actions (plan_id, position);

create table public.activity (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id uuid references public.plans(id) on delete cascade,
  action_id uuid references public.actions(id) on delete cascade,
  event text not null,
  detail text not null default '',
  created_at timestamptz not null default now()
);
create index activity_user_created on public.activity (user_id, created_at desc);

-- OAuth tokens for connected services. Refresh tokens are encrypted by the
-- app (AES-256-GCM) before they get here. No browser access at all: only the
-- server's service-role key can read this table.
create table public.connections (
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('google')),
  account_email text,
  scopes text not null,
  refresh_token_enc text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, provider)
);

alter table public.plans enable row level security;
alter table public.actions enable row level security;
alter table public.activity enable row level security;
alter table public.connections enable row level security;

create policy "own plans" on public.plans for select using (auth.uid() = user_id);
create policy "own actions" on public.actions for select using (auth.uid() = user_id);
create policy "own activity" on public.activity for select using (auth.uid() = user_id);
-- connections: intentionally no policies (deny all except service role).
