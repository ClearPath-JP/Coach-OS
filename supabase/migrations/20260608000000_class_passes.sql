-- Class Passes (2026-06-08): prepaid class-credit packs ("10 classes for $120").
-- Coach defines a pass (class_passes); client buys it via a one-time Stripe Checkout with
-- payment_intent_data.transfer_data.destination = the coach's connected account (mirrors
-- class-booking's destination model), so the webhook lands on /api/webhooks/stripe. Each
-- purchase becomes a durable client_passes row; booking a class spends one credit.
-- Mirrors the dojo-memberships schema so booking can reuse the same coverage logic, but with
-- HARDENED write policies: every write requires workspace scope AND coach/owner membership
-- (clients never write these rows; purchase fulfillment + booking decrement run via the service
-- role, which bypasses RLS). Workspace-only write policies would be unsafe here because
-- current_workspace_id() resolves to the coach's workspace for clients too — without the
-- coach/owner check a client could PATCH their own balance via PostgREST and grant free classes.

-- Coach-defined pass products ------------------------------------------------
create table if not exists public.class_passes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  coach_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  price_cents integer not null check (price_cents >= 0),
  currency text not null default 'usd',
  credit_count integer not null check (credit_count > 0),     -- classes granted per purchase
  applies_to text not null default 'all' check (applies_to in ('all','types')),
  applies_to_types text[],                                    -- class types covered, when applies_to = 'types'
  expires_in_days integer check (expires_in_days is null or expires_in_days > 0), -- null = never expires
  status text not null default 'active' check (status in ('active','draft','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_class_passes_workspace on public.class_passes(workspace_id);
alter table public.class_passes enable row level security;
-- Read: anyone in the workspace (so clients can browse + buy). Write: coach/owner only.
drop policy if exists "class_passes_sel" on public.class_passes;
create policy "class_passes_sel" on public.class_passes for select using (workspace_id = current_workspace_id());
drop policy if exists "class_passes_ins" on public.class_passes;
create policy "class_passes_ins" on public.class_passes for insert with check (
  workspace_id = current_workspace_id()
  and (
    exists (select 1 from public.coaches c where c.user_id = auth.uid() and c.workspace_id = class_passes.workspace_id)
    or exists (select 1 from public.workspaces w where w.id = class_passes.workspace_id and w.owner_id = auth.uid())
  )
);
drop policy if exists "class_passes_upd" on public.class_passes;
create policy "class_passes_upd" on public.class_passes for update using (
  workspace_id = current_workspace_id()
  and (
    exists (select 1 from public.coaches c where c.user_id = auth.uid() and c.workspace_id = class_passes.workspace_id)
    or exists (select 1 from public.workspaces w where w.id = class_passes.workspace_id and w.owner_id = auth.uid())
  )
);
drop policy if exists "class_passes_del" on public.class_passes;
create policy "class_passes_del" on public.class_passes for delete using (
  workspace_id = current_workspace_id()
  and (
    exists (select 1 from public.coaches c where c.user_id = auth.uid() and c.workspace_id = class_passes.workspace_id)
    or exists (select 1 from public.workspaces w where w.id = class_passes.workspace_id and w.owner_id = auth.uid())
  )
);

-- Purchased balances (one row per purchase; additive — buying again stacks credits) --------
create table if not exists public.client_passes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  pass_id uuid not null references public.class_passes(id) on delete restrict,
  credits_total integer not null check (credits_total > 0),
  credits_remaining integer not null check (credits_remaining >= 0 and credits_remaining <= credits_total),
  status text not null default 'active' check (status in ('active','depleted','expired','refunded')),
  stripe_checkout_id text unique,             -- idempotency: one fulfillment per Checkout session
  purchased_at timestamptz not null default now(),
  expires_at timestamptz,                     -- null = never
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_client_passes_workspace on public.client_passes(workspace_id);
create index if not exists idx_client_passes_client on public.client_passes(client_id);
-- FIFO selection of usable credits (active, oldest-expiring first) during booking.
create index if not exists idx_client_passes_fifo
  on public.client_passes(client_id, workspace_id, status, expires_at);
alter table public.client_passes enable row level security;
-- Read: a client sees only their OWN passes (email match); coach/owner sees all in workspace.
-- Write: coach/owner only — clients NEVER write balances. Real writes (purchase fulfillment +
-- booking decrement) run via the service role, which bypasses RLS entirely.
drop policy if exists "client_passes_sel" on public.client_passes;
create policy "client_passes_sel" on public.client_passes for select using (
  workspace_id = current_workspace_id()
  and (
    client_id in (
      select id from public.clients where email = (select email from public.profiles where id = auth.uid())
    )
    or exists (select 1 from public.coaches c where c.user_id = auth.uid() and c.workspace_id = client_passes.workspace_id)
    or exists (select 1 from public.workspaces w where w.id = client_passes.workspace_id and w.owner_id = auth.uid())
  )
);
drop policy if exists "client_passes_ins" on public.client_passes;
create policy "client_passes_ins" on public.client_passes for insert with check (
  workspace_id = current_workspace_id()
  and (
    exists (select 1 from public.coaches c where c.user_id = auth.uid() and c.workspace_id = client_passes.workspace_id)
    or exists (select 1 from public.workspaces w where w.id = client_passes.workspace_id and w.owner_id = auth.uid())
  )
);
drop policy if exists "client_passes_upd" on public.client_passes;
create policy "client_passes_upd" on public.client_passes for update using (
  workspace_id = current_workspace_id()
  and (
    exists (select 1 from public.coaches c where c.user_id = auth.uid() and c.workspace_id = client_passes.workspace_id)
    or exists (select 1 from public.workspaces w where w.id = client_passes.workspace_id and w.owner_id = auth.uid())
  )
);
drop policy if exists "client_passes_del" on public.client_passes;
create policy "client_passes_del" on public.client_passes for delete using (
  workspace_id = current_workspace_id()
  and (
    exists (select 1 from public.coaches c where c.user_id = auth.uid() and c.workspace_id = client_passes.workspace_id)
    or exists (select 1 from public.workspaces w where w.id = client_passes.workspace_id and w.owner_id = auth.uid())
  )
);
