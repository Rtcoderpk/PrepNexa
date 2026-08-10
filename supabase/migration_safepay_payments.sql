-- =============================================================
-- PrepNexa — Safepay payment-transaction ledger (idempotent webhooks)
-- =============================================================
-- Run this ENTIRE block in the Supabase SQL Editor. Idempotent: safe to re-run.
--
-- Adds a payment_transactions table used to make webhook processing
-- idempotent. Every verified webhook event is recorded once; a duplicate /
-- replayed event conflicts on (provider, transaction_id, event_type) and is
-- skipped, so a subscription can only be granted a single time per event.
--
--   succeeded | failed | pending | cancelled | expired
-- =============================================================

create table if not exists public.payment_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  provider text not null,
  transaction_id text not null,      -- e.g. Safepay tracker.token
  event_type text not null,          -- e.g. payment.succeeded
  status text not null check (status in ('succeeded', 'failed', 'pending', 'cancelled', 'expired')),
  amount integer,                    -- lowest denomination
  currency text,
  payload jsonb,                     -- raw webhook payload (audit trail)
  processed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  -- A given payment event should only ever be applied once.
  unique (provider, transaction_id, event_type)
);

create index if not exists payment_transactions_user_id_idx
  on public.payment_transactions (user_id, created_at desc);
create index if not exists payment_transactions_tx_idx
  on public.payment_transactions (provider, transaction_id);

alter table public.payment_transactions enable row level security;

create policy "Payment transactions are viewable by the owner"
  on public.payment_transactions for select
  using (auth.uid() = user_id);

create policy "Payment transactions are insertable by the owner"
  on public.payment_transactions for insert
  with check (auth.uid() = user_id);