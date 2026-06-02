-- Dojo Memberships (2026-06-01): coach-defined recurring plans + client subscriptions via Stripe.
-- Stripe model: a PLATFORM subscription Checkout with subscription_data.transfer_data.destination
-- = the coach's connected account (mirrors class-booking's destination model), so webhooks land on
-- the existing platform /api/webhooks/stripe endpoint. Product + Price live on the platform account.

create table if not exists public.membership_plans (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  coach_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  price_cents integer not null check (price_cents >= 0),
  currency text not null default 'usd',
  interval text not null default 'month' check (interval in ('month')),
  access_type text not null default 'unlimited' check (access_type in ('unlimited','limited','specific')),
  classes_per_period integer,                 -- when access_type = 'limited'
  applies_to text not null default 'all' check (applies_to in ('all','types')),
  applies_to_types text[],                    -- class types this plan covers, when applies_to = 'types'
  stripe_product_id text,
  stripe_price_id text,
  status text not null default 'active' check (status in ('active','draft','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_membership_plans_workspace on public.membership_plans(workspace_id);
alter table public.membership_plans enable row level security;
-- Plans are readable by everyone in the workspace (so clients can browse + subscribe);
-- writes are authorized server-side via requireCoach (RLS stays workspace-scoped like other tables).
drop policy if exists "mp_sel" on public.membership_plans;
create policy "mp_sel" on public.membership_plans for select using (workspace_id = current_workspace_id());
drop policy if exists "mp_ins" on public.membership_plans;
create policy "mp_ins" on public.membership_plans for insert with check (workspace_id = current_workspace_id());
drop policy if exists "mp_upd" on public.membership_plans;
create policy "mp_upd" on public.membership_plans for update using (workspace_id = current_workspace_id());
drop policy if exists "mp_del" on public.membership_plans;
create policy "mp_del" on public.membership_plans for delete using (workspace_id = current_workspace_id());

create table if not exists public.client_memberships (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  plan_id uuid not null references public.membership_plans(id) on delete restrict,
  stripe_subscription_id text,
  status text not null default 'incomplete'
    check (status in ('active','past_due','canceled','trialing','incomplete')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  classes_used_this_period integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  canceled_at timestamptz
);
create index if not exists idx_client_memberships_workspace on public.client_memberships(workspace_id);
create index if not exists idx_client_memberships_client on public.client_memberships(client_id);
create index if not exists idx_client_memberships_sub on public.client_memberships(stripe_subscription_id);
-- One live membership per client per workspace.
create unique index if not exists uq_client_live_membership
  on public.client_memberships(client_id, workspace_id)
  where status in ('active','trialing','past_due','incomplete');
alter table public.client_memberships enable row level security;
-- Client sees only their OWN membership (email match); coach/owner sees all in workspace.
-- Writes happen via the service role (webhook + API), so write policies stay workspace-scoped.
drop policy if exists "cm_sel" on public.client_memberships;
create policy "cm_sel" on public.client_memberships for select using (
  workspace_id = current_workspace_id()
  and (
    client_id in (
      select id from public.clients where email = (select email from public.profiles where id = auth.uid())
    )
    or exists (select 1 from public.coaches where user_id = auth.uid() and workspace_id = client_memberships.workspace_id)
    or exists (select 1 from public.workspaces where id = client_memberships.workspace_id and owner_id = auth.uid())
  )
);
drop policy if exists "cm_ins" on public.client_memberships;
create policy "cm_ins" on public.client_memberships for insert with check (workspace_id = current_workspace_id());
drop policy if exists "cm_upd" on public.client_memberships;
create policy "cm_upd" on public.client_memberships for update using (workspace_id = current_workspace_id());
drop policy if exists "cm_del" on public.client_memberships;
create policy "cm_del" on public.client_memberships for delete using (workspace_id = current_workspace_id());
